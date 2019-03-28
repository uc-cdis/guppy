import elasticsearch from 'elasticsearch';
import config from '../config';
import * as esFilter from './filter';
import * as esAggregator from './aggs';
import log from '../logger';

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

  async getCount(esIndex, esType, filter) {
    return esFilter.getCount(this, esIndex, esType, filter);
  }

  async getData({
    esIndex, esType, fields, filter, sort, offset = 0, size,
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

  async numericAggregation({
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

  async textAggregation({
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
