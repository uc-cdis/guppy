import { Client } from '@elastic/elasticsearch';
import _ from 'lodash';
import { UserInputError } from 'apollo-server';
import config from '../config';
import getFilterObj from './filter';
import getESSortBody from './sort';
import * as esAggregator from './aggs';
import log from '../logger';
import { SCROLL_PAGE_SIZE } from './const';
import CodedError from '../utils/error';
import { fromFieldsToSource, buildNestedField, processNestedFieldNames } from '../utils/utils';

class ES {
  constructor(esConfig = config.esConfig) {
    this.config = esConfig;
    this.client = new Client({
      node: this.config.host,
      // log: 'trace'
    });
    this.client.ping({}, (error) => {
      if (error) {
        log.error(`[ES] elasticsearch cluster at ${this.config.host} is down!`);
      } else {
        log.info(`[ES] connected to elasticsearch at ${this.config.host}.`);
        this.connected = true;
      }
    });
  }

  /**
   * Query ES data (search API) by index, type, and queryBody
   * See https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#_search
   * @param {string} esIndex
   * @param {string} esType
   * @param {object} queryBody
   */
  async query(esIndex, esType, queryBody) {
    const validatedQueryBody = {};
    Object.keys(queryBody).forEach((key) => {
      if (typeof queryBody[key] !== 'undefined' && queryBody[key] !== null) {
        validatedQueryBody[key] = queryBody[key];
      }
    });
    validatedQueryBody.highlight = {
      pre_tags: [
        `<${config.matchedTextHighlightTagName}>`,
      ],
      post_tags: [
        `</${config.matchedTextHighlightTagName}>`,
      ],
      fields: {
        [`*${config.analyzedTextFieldSuffix}`]: {},
      },
    };
    log.info('[ES.query] index, type, query body: ', esIndex, esType, JSON.stringify(validatedQueryBody));
    return this.client.search({
      index: esIndex,
      type: esType,
      body: validatedQueryBody,
    }).then((resp) => resp.body, (err) => {
      log.error(`[ES.query] error during querying: ${err.message}`);
      throw new Error(err.message);
    });
  }

  /**
   * Fetch elastic search data using scroll API
   * See https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-scroll.html
   * @param {string} esIndex
   * @param {string} esType
   * @param {Object} argument - arg object for filter, fields, and sort
   */
  async scrollQuery(esIndex, esType, {
    filter,
    fields,
    sort,
  }) {
    if (!esIndex || !esType) {
      throw new CodedError(
        400,
        'Invalid es index or es type name',
      );
    }
    const allESFields = _.flattenDeep(this.getESFields(esIndex).fields.map((f) => {
      if (f.nestedProps) {
        return processNestedFieldNames(f);
      }
      return f.name;
    }));
    const fieldsNotBelong = _.difference(fields, allESFields);
    if (fieldsNotBelong.length > 0) {
      throw new CodedError(
        400,
        `Invalid fields: "${fieldsNotBelong.join('", "')}"`,
      );
    }
    const validatedQueryBody = filter ? { query: filter } : {};
    log.debug('[ES.scrollQuery] scroll query body: ', JSON.stringify(validatedQueryBody, null, 4));

    let currentBatch;
    let scrollID;
    let totalData = [];
    let batchSize = 0;

    // This is really ridiculous that ES's JS library has it, but we need to
    // convert list of sort obj into comma separated strings to make it work
    // see https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#_search
    const sortStringList = sort && sort.map((item) => `${Object.keys(item)[0]}:${Object.values(item)[0]}`);

    while (!currentBatch || batchSize > 0) {
      if (typeof scrollID === 'undefined') { // first batch
        const res = await this.client.search({ // eslint-disable-line no-await-in-loop
          index: esIndex,
          type: esType,
          body: validatedQueryBody,
          scroll: '1m',
          size: SCROLL_PAGE_SIZE,
          _source: fields,
          sort: sortStringList,
        }).then((resp) => resp, (err) => {
          log.error('[ES.query] error when query', err.message);
          throw new Error(err.message);
        });
        currentBatch = res.body;
        log.debug('[ES scrollQuery] created scroll');
      } else { // following batches
        const res = await this.client.scroll({ // eslint-disable-line no-await-in-loop
          scroll_id: scrollID,
          scroll: '1m',
        });
        currentBatch = res.body;
      }

      // merge fetched batches
      scrollID = currentBatch._scroll_id;
      batchSize = currentBatch.hits.hits.length;
      log.debug('[ES scrollQuery] get batch size = ', batchSize, ' merging...');

      // TODO: change it to streaming
      totalData = totalData.concat(currentBatch.hits.hits.map((item) => item._source));
    }

    log.debug('[ES scrollQuery] end scrolling');
    await this.client.clearScroll({
      scroll_id: scrollID,
    });
    log.debug('[ES scrollQuery] scroll cleaned');
    return totalData;
  }

  /**
   * Get mapping from ES with given index and type.
   * Return a Promise of an Object: { <field>: <type> }
   * If error, print error stack
   * @param {string} esIndex
   * @param {string} esType
   */
  async _getESFieldsTypes(esIndex, esType) {
    const errMsg = `[ES.initialize] error getting mapping from ES index "${esIndex}"`;
    return this.client.indices.getMapping({
      index: esIndex,
      type: esType,
    }).then((resp) => {
      try {
        const esIndexAlias = Object.keys(resp.body)[0];
        return resp.body[esIndexAlias].mappings[esType].properties;
      } catch (err) {
        throw new Error(`${errMsg}: ${err}`);
      }
    }, (err) => {
      throw new Error(`${errMsg}: ${err.message}`);
    });
  }

  async _getMappingsForAllIndices() {
    if (!this.config.indices || this.config.indices === 0) {
      const errMsg = '[ES.initialize] Error when initializing: empty "config.indices" block';
      throw new Error(errMsg);
    }
    const fieldTypes = {};
    log.info('[ES.initialize] getting mapping from elasticsearch...');
    const promiseList = this.config.indices
      .map((cfg) => this._getESFieldsTypes(cfg.index, cfg.type)
        .then((res) => ({ index: cfg.index, fieldTypes: res })));
    const resultList = await Promise.all(promiseList);
    log.info('[ES.initialize] got mapping from elasticsearch');
    resultList.forEach((res) => {
      fieldTypes[res.index] = res.fieldTypes;
    });
    log.debug('[ES.initialize]', JSON.stringify(fieldTypes, null, 4));
    return fieldTypes;
  }

  /**
   * Read array config and check if there's any array fields for each index.
   * Array fields are grouped and stored by index as a doc in array config,
   * and we set _id as index name for this doc.
   */
  async _getArrayFieldsFromConfigIndex() {
    if (typeof this.config.configIndex === 'undefined') {
      log.info('[ES.initialize] no array fields from es config index.');
      return Promise.resolve({});
    }
    if (!this.fieldTypes) {
      return {};
    }
    const arrayFields = {};
    log.info(`[ES.initialize] getting array fields from es config index "${this.config.configIndex}"...`);
    return this.client.search({
      index: this.config.configIndex,
      body: {
        query: {
          ids: {
            values: Object.keys(this.fieldTypes),
          },
        },
      },
    }).then((resp) => {
      try {
        resp.body.hits.hits.forEach((doc) => {
          const index = doc._id;
          if (!this.fieldTypes[index]) {
            const errMsg = `[ES.initialize] wrong array entry from config index: index "${index}" not found, skipped.`;
            log.error(errMsg);
            return;
          }
          const fields = doc._source.array;

          // for (let i = 0; i < indicesWithArrayFields.length; i += 1) {
          //   const indexName = indicesWithArrayFields[i];
          //   if (!indicesMetadata[indexName]) {
          //     indicesMetadata[indexName] = {};
          //   }
          //   indicesMetadata[indexName].arrayFields = this.arrayFields[indexName];
          // }
        

          fields.forEach((field) => {
            const nodes = field.split('.');
            let nestedObject = this.fieldTypes[index];
            nodes.forEach((n) => {
              if (n in nestedObject) {
                nestedObject = nestedObject[n].properties;
              } else {
                const errMsg = `[ES.initialize] wrong array entry from config: field "${field}" not found in index ${index}, skipped.`;
                console.log(errMsg);
              }
            });
            if (!arrayFields[index]) arrayFields[index] = [];
            arrayFields[index].push(field);
          });


        });
        log.info('[ES.initialize] got array fields from es config index:', JSON.stringify(arrayFields, null, 4));
      } catch (err) {
        throw new Error(err);
      }
      return arrayFields;
    }, (err) => {
      throw new Error(err.message);
    });
  }

  /**
   * We do following things when initializing:
   * 1. get mappings from all indices, and save to "this.fieldTypes":
   * {
   *    <index1>: {
   *      <field1>: <type1>
   *      <field2>: <type2>
   *    }
   *    ...
   * }
   * 2. get configs from config index for array fields, save to "this.arrayFields":
   * {
   *    <index1>: [<field1>, <field2>],
   *    <index2>: [<field1>, <field2>],
   *    ...
   * }
   */
  async initialize() {
    this.fieldTypes = await this._getMappingsForAllIndices();
    this.arrayFields = await this._getArrayFieldsFromConfigIndex();
  }

  /**
   * Get ES fields' mapping type by es index name
   * Returns an object of field=>type mapping
   * @param {string} esIndex
   */
  getESFieldTypeMappingByIndex(esIndex) {
    return this.fieldTypes[esIndex];
  }

  /**
   * Get fields by esIndex
   * If esIndex is not set, return all fields grouped by index and types.
   * @param {string} esIndex
   */
  getESFields(esIndex) {
    const res = {};
    this.config.indices.forEach((cfg) => {
      res[cfg.index] = {
        index: cfg.index,
        type: cfg.type,
        fields: Object.entries(this.fieldTypes[cfg.index]).map(([key, value]) => {
          let r;
          if (value.type !== 'nested') {
            r = { name: key, type: value.type };
          } else {
            r = buildNestedField(key, value);
          }
          return r;
        }),
      };
    });
    if (typeof esIndex === 'undefined') {
      return res;
    }
    return res[esIndex];
  }

  /**
   * Get es index by es type
   * Throw 400 error if there's no existing es type
   * @param {string} esType
   */
  getESIndexByType(esType) {
    const index = this.config.indices.find((i) => i.type === esType);
    if (index) return index.index;
    throw new CodedError(
      400,
      `Invalid es type: "${esType}"`,
    );
  }

  /**
   * Get es indexConfig by es type
   * Throw 400 error if there's no existing es type
   * @param {string} esType
   */
  getESIndexConfigByType(esType) {
    const index = this.config.indices.find((i) => i.type === esType);
    if (index) return index;
    throw new CodedError(
      400,
      `Invalid es type: "${esType}"`,
    );
  }

  /**
   * Get es index config by es index name
   * Throw 400 error if there's no existing es index of that name
   * @param {string} esIndexName
   */
  getESIndexConfigByName(esIndexName) {
    const indexConfig = this.config.indices.find((i) => i.index === esIndexName);
    if (indexConfig) return indexConfig;
    throw new CodedError(
      400,
      `Invalid es index name: "${esIndexName}"`,
    );
  }

  /**
   * Get all es indices and their alias
   */
  getAllESIndices() {
    const indicesArray = this.config.indices.map((e) => e.index);
    if (this.config.configIndex) {
      indicesArray.push(this.config.configIndex);
    }
    return this.client.indices.getAlias({
      index: indicesArray,
    }).then((resp) => {
      try {
        const indicesMetadata = resp.body;
        const indicesWithArrayFields = Object.keys(this.arrayFields);
        for (let i = 0; i < indicesWithArrayFields.length; i += 1) {
          const indexName = indicesWithArrayFields[i];
          if (!indicesMetadata[indexName]) {
            indicesMetadata[indexName] = {};
          }
          indicesMetadata[indexName].arrayFields = this.arrayFields[indexName];
        }
        return {
          statusCode: resp.statusCode,
          warnings: resp.warnings,
          indices: {
            ...indicesMetadata,
          },
        };
      } catch (err) {
        throw new Error(err);
      }
    }, (err) => {
      throw new Error(err);
    });
  }

  /**
   * Check if the field is array
   */
  isArrayField(esIndex, field) {

    // TODO see where isArrayField gets the field from and pass the nested path with it to have a direct match and avoid limitation of using unique names

    let isNestedArray = false;
    if (this.arrayFields[esIndex]) {
      for (let i = 0; i < this.arrayFields[esIndex].length; i += 1) {
        const nodes = this.arrayFields[esIndex][i].split('.');
        if (nodes[nodes.length - 1] == field) {
          isNestedArray = true;
        }
      }
    }

    return (this.arrayFields[esIndex] && (this.arrayFields[esIndex].includes(field) || (isNestedArray)));
  }

  filterData(
    { esIndex, esType },
    {
      filter, fields, sort, offset = 0, size,
    },
  ) {
    const queryBody = { from: offset };
    if (typeof filter !== 'undefined') {
      queryBody.query = getFilterObj(this, esIndex, filter);
    }
    queryBody.sort = getESSortBody(sort, this, esIndex);
    if (typeof size !== 'undefined') {
      queryBody.size = size;
    }
    if (fields !== undefined) {
      if (fields) {
        const esFields = fromFieldsToSource(fields);
        if (esFields.length > 0) queryBody._source = esFields;
      } else {
        queryBody._source = false;
      }
    }
    return this.query(esIndex, esType, queryBody);
  }

  async getCount(esIndex, esType, filter) {
    const result = await this.filterData(
      { esInstance: this, esIndex, esType },
      { filter, fields: false },
    );
    return result.hits.total;
  }

  async getData({
    esIndex, esType, fields, filter, sort, offset, size,
  }) {
    if (typeof size !== 'undefined' && offset + size > SCROLL_PAGE_SIZE) {
      throw new UserInputError(`Large graphql query forbidden for offset + size > ${SCROLL_PAGE_SIZE},
      offset = ${offset} and size = ${size},
      please use download endpoint for large data queries instead.`);
    }
    const result = await this.filterData(
      { esInstance: this, esIndex, esType },
      {
        filter, fields, sort, offset, size,
      },
    );
    const { hits } = result.hits;
    const hitsWithMatchedResults = hits.map((h) => {
      if (!('highlight' in h)) {
        // ES doesn't returns "highlight"
        return h._source;
      }
      // ES returns highlight, transfer them into "_matched" schema
      const matchedList = Object.keys(h.highlight).map((f) => {
        let field = f;
        if (f.endsWith(config.analyzedTextFieldSuffix)) {
          // remove ".analyzed" suffix from field name
          field = f.substr(0, f.length - config.analyzedTextFieldSuffix.length);
        }
        return {
          field,
          // just use ES highlights' format,
          // should be a list of string, with matched part emphasized with <
          highlights: h.highlight[f],
        };
      });
      return {
        ...h._source,
        _matched: matchedList,
      };
    });
    return hitsWithMatchedResults;
  }

  downloadData({
    esIndex, esType, fields, filter, sort,
  }) {
    const esFilterObj = filter ? getFilterObj(this, esIndex, filter) : undefined;
    return this.scrollQuery(esIndex, esType, {
      filter: esFilterObj,
      fields,
      sort: getESSortBody(sort, this, esIndex),
    });
  }

  numericAggregation({
    esIndex,
    esType,
    filter,
    field,
    rangeStart,
    rangeEnd,
    rangeStep,
    binCount,
    filterSelf,
    defaultAuthFilter,
    nestedAggFields,
    nestedPath,
  }) {
    return esAggregator.numericAggregation(
      {
        esInstance: this,
        esIndex,
        esType,
      },
      {
        esIndex,
        esType,
        filter,
        field,
        rangeStart,
        rangeEnd,
        rangeStep,
        binCount,
        filterSelf,
        defaultAuthFilter,
        nestedAggFields,
        nestedPath,
      },
    );
  }

  textAggregation({
    esIndex,
    esType,
    filter,
    field,
    filterSelf,
    defaultAuthFilter,
    nestedAggFields,
    nestedPath,
    isNumericField,
  }) {
    return esAggregator.textAggregation(
      {
        esInstance: this,
        esIndex,
        esType,
      },
      {
        filter,
        field,
        filterSelf,
        defaultAuthFilter,
        nestedAggFields,
        nestedPath,
        isNumericField,
      },
    );
  }
}

const es = new ES();

export default es;
