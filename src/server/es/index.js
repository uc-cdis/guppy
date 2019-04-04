import elasticsearch from 'elasticsearch';
import request from 'request';
import config from '../config';
import * as esFilter from './filter';
import * as esAggregator from './aggs';
import log from '../logger';
import { SCROLL_PAGE_SIZE } from './const';

class ES {
  constructor(esConfig = config.esConfig) {
    this.config = esConfig;
    this.client = new elasticsearch.Client({
      host: this.config.host,
      // log: 'trace'
    });
    this.client.ping({
      requestTimeout: 30000,
    }, (error) => {
      if (error) {
        log.error(`[ES] elasticsearch cluster at ${this.config.host} is down!`);
      } else {
        log.info(`[ES] connected to elasticsearch at ${this.config.host}.`);
        this.connected = true;
      }
    });
  }

  async _getESFieldsTypes(esIndex, esType) {
    return this.client.indices.getMapping({
      index: esIndex,
      type: esType,
    }).then((resp) => {
      const mappingObj = resp[esIndex].mappings[esType].properties;
      const fieldTypes = Object.keys(mappingObj).reduce((acc, field) => {
        const esFieldType = mappingObj[field].type;
        acc[field] = esFieldType;
        return acc;
      }, {});
      return fieldTypes;
    }, (err) => {
      console.trace(err.message);
    });
  }

  async query(esIndex, esType, queryBody) {
    const validatedQueryBody = {};
    Object.keys(queryBody).forEach((key) => {
      if (typeof queryBody[key] !== 'undefined' && queryBody[key] !== null) {
        validatedQueryBody[key] = queryBody[key];
      }
    });
    log.info('[ES.query] query body: ', JSON.stringify(validatedQueryBody, null, 4));
    return this.client.search({
      index: esIndex,
      type: esType,
      body: validatedQueryBody,
    }).then(resp => resp, (err) => {
      log.error('[ES.query] error when query');
      console.trace(err.message);
    });
  }

  async scrollQuery(esIndex, esType, {
    filter,
    fields,
    sort,
  }) {
    if (!esIndex || !esType) {
      throw new Error('Invalid es index or es type name');
    }
    const validatedQueryBody = filter ? { query: filter } : {};
    log.debug('[ES.scrollQuery] scroll query body: ', JSON.stringify(validatedQueryBody, null, 4));

    let currentBatch;
    let scrollID;
    let totalData = [];
    let batchSize = 0;

    while (!currentBatch || batchSize > 0) {
      if (typeof scrollID === 'undefined') { // first batch
        currentBatch = await this.client.search({ // eslint-disable-line no-await-in-loop
          index: esIndex,
          type: esType,
          body: validatedQueryBody,
          scroll: '2m',
          size: SCROLL_PAGE_SIZE,
          _source: fields,
          sort,
        }).then(resp => resp, (err) => {
          log.error('[ES.query] error when query');
          console.trace(err.message);
        });
        log.debug('[ES scrollQuery] created scroll ', scrollID);
      } else { // following batches
        currentBatch = await this.client.scroll({ // eslint-disable-line no-await-in-loop
          scroll_id: scrollID,
          scroll: '2m',
        });
      }

      // merge fetched batches
      log.debug('[ES scrollQuery] get batch size = ', batchSize, ' merging...');
      scrollID = currentBatch._scroll_id;
      batchSize = currentBatch.hits.hits.length;

      // TODO: change it to streaming
      totalData = totalData.concat(currentBatch.hits.hits.map(item => item._source));
    }

    log.debug('[ES scrollQuery] end scrolling, cleaning', scrollID);
    request.delete(
      this.config.host,
      { scroll_id: scrollID },
    );
    return totalData;
  }

  async initialize() {
    this.fieldTypes = {};
    log.info('[ES.initialize] getting mapping from elasticsearch...');
    const promiseList = this.config.indices
      .map(cfg => this._getESFieldsTypes(cfg.index, cfg.type)
        .then(res => ({ index: cfg.index, fieldTypes: res })));
    const resultList = await Promise.all(promiseList);
    log.info('[ES.initialize] got mapping from elasticsearch');
    resultList.forEach((res) => {
      this.fieldTypes[res.index] = res.fieldTypes;
    });
    log.debug('[ES.initialize]', JSON.stringify(this.fieldTypes, null, 4));
    return this.fieldTypes;
  }

  getESFieldTypeMappingByIndex(esIndex) {
    return this.fieldTypes[esIndex];
  }

  getESFields(esIndex) {
    const res = {};
    this.config.indices.forEach((cfg) => {
      res[cfg.index] = {
        index: cfg.index,
        type: cfg.type,
        fields: Object.keys(this.fieldTypes[cfg.index]),
      };
    });
    if (typeof esIndex === 'undefined') {
      return res;
    }
    return res[esIndex];
  }

  getCount(esIndex, esType, filter) {
    return esFilter.getCount(this, esIndex, esType, filter);
  }

  getData({
    esIndex, esType, fields, filter, sort, offset, size,
  }) {
    return esFilter.getData(
      {
        esInstance: this,
        esIndex,
        esType,
      },
      {
        fields, filter, sort, offset, size,
      },
    );
  }

  downloadData({
    esIndex, esType, fields, filter, sort,
  }) {
    return esFilter.getDataUsingScroll(
      {
        esInstance: this,
        esIndex,
        esType,
      },
      {
        fields, filter, sort,
      },
    );
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
      },
    );
  }

  textAggregation({
    esIndex,
    esType,
    filter,
    field,
    filterSelf,
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
      },
    );
  }
}

const es = new ES();

export default es;
