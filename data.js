import elasticsearch from 'elasticsearch';

const AGGS_QUERY_NAME = 'numeric_aggs';
const AGGS_GLOBAL_STATS_NAME = 'numeric_aggs_stats';
const AGGS_ITEM_STATS_NAME = 'numeric_item_aggs_stats';

class ESConnector {
  constructor(esConfig) {
    this.config = esConfig;
    this.client = new elasticsearch.Client({
      host: esConfig.host,
      //log: 'trace'
    });
    this.client.ping({
      requestTimeout: 30000,
    }, function (error) {
      if (error) {
        console.error('elasticsearch cluster is down!');
      } else {
        console.log(`connected to elasticsearch at ${esConfig.host}.`);
      }
    });
  }

  async _query(queryBody) {
    console.log('_query: ', JSON.stringify(queryBody, null, 4));
    return this.client.search({
      index: this.config.index,
      type: this.config.type,
      body: queryBody,
    }).then(function (resp) {
      return resp;
    }, function (err) {
      console.trace(err.message);
    });
  }

  _getESFieldType(field) {
    const mockESFieldType = {
      gender: 'string',
      file_count: 'number',
      race: 'string',
    };
    return mockESFieldType[field];
  }

  _getFilterItemForString(field, value) {
    // FIXME: "is not"
    return {
      term: {
        [field]: value
      }
    };
  }

  _getFilterItemForNumbers(op, field, value) {
    const rangeOperator = {
      '>': 'gt',
      '>=': 'gte', 
      '<': 'lt', 
      '<=': 'lte',
    };
    if (op in rangeOperator) {
      return {
        range: {
          [field]: { [rangeOperator[op]]: value }
        }
      }
    }
    else if (op === '=') {
      return {
        term: {
          [field]: value
        }  
      };
    }
    else {
      throw new Error(`Invalid numeric operation ${numOp}`)
    }
  }

  _getFilterObj(graphqlFilterObj) {
    const topLevelOp = Object.keys(graphqlFilterObj)[0];
    let resultFilterObj = {};
    if (topLevelOp === 'AND') {
      resultFilterObj = {
        bool: {
          must: graphqlFilterObj[topLevelOp].map(filterItem => this._getFilterObj(filterItem))
        }
      }
    }
    else if (topLevelOp === 'OR') {
      resultFilterObj = {
        bool: {
          should: graphqlFilterObj[topLevelOp].map(filterItem => this._getFilterObj(filterItem))
        }
      }
    }
    else {
      const field = graphqlFilterObj[topLevelOp][0];
      const value = graphqlFilterObj[topLevelOp][1];
      const fieldType = this._getESFieldType(field);
      if (fieldType === 'string') {
        resultFilterObj = this._getFilterItemForString(field, value);
      }
      else if (fieldType === 'number') {
        resultFilterObj = this._getFilterItemForNumbers(topLevelOp, field, value);
      }
      else {
        throw new Error(`Invalid es field type ${fieldType}`);
      }
    }
    return resultFilterObj;
  }

  async _filterData(filter, offset = 0, size) {
    const queryBody = {from: offset};
    if (!!filter) {
      queryBody.query = this._getFilterObj(filter);
    }
    if (typeof size !== undefined) {
      queryBody.size = size;
    }
    const result = await this._query(queryBody);
    return result;
  }

  async filterData(filter, offset = 0, size) {
    const result = await this._filterData(filter, offset, size);
    return result;
  }

  async getTotalCount(filter) {
    const result = await this._filterData(filter, 0, 0);
    return result.hits.total;
  }

  async getData(offset = 0, size) {
    const queryBody = {
      query : {
        match_all : {}
      },
      from: offset,
    };
    if (!!size) {
      queryBody.size = size;
    }
    const result = await this._query(queryBody);
    return result;
  }

  async _numericHistogramWithFixedBinCount({
    filter, 
    field, 
    rangeStart, 
    rangeEnd, 
    binCount,
  }) {
    const globalStats = await this._numericGlobalStats({filter, field, rangeStart, rangeEnd});
    const {min, max} = globalStats;
    const histogramStart = typeof rangeStart === 'undefined' ? min : rangeStart;
    const histogramEnd = typeof rangeEnd === 'undefined' ? (max + 1) : rangeEnd;
    const rangeStep = (histogramEnd - histogramStart) / binCount;
    return this._numericHistogramWithFixedRangeStep({
      filter,
      field,
      rangeStart: histogramStart, 
      rangeEnd: histogramEnd,
      rangeStep,
    });
  }

  async _numericHistogramWithFixedRangeStep({
    filter, 
    field, 
    rangeStart, 
    rangeEnd, 
    rangeStep,
  }) {
    let queryBody = {size: 0};
    if (!!filter) {
      queryBody.query = this._getFilterObj(filter);
    }
    queryBody.query = this._appendAdditionalRangeQuery(field, queryBody.query, rangeStart, rangeEnd);
    let aggsObj = {
      [AGGS_GLOBAL_STATS_NAME]: {
        stats: {field: field}
      }
    }
    aggsObj[AGGS_QUERY_NAME] = {
      histogram: {
        field: field, 
        interval: rangeStep,
      },
      aggs: {
        [AGGS_ITEM_STATS_NAME]: {
          stats: {
            field: field
          }
        }
      }
    };
    if (typeof rangeStart !== 'undefined') {
      let offset = rangeStart;
      while (offset - rangeStep > 0) {
        offset = offset - rangeStep;
      }
      aggsObj[AGGS_QUERY_NAME].histogram.offset = offset;
    }
    queryBody.aggs = aggsObj;
    const result = await this._query(queryBody);
    const parsedAggsResult = result.aggregations[AGGS_QUERY_NAME].buckets.map(item => {
      return {
        _range: [item.key, item.key+rangeStep],
        ...item[AGGS_ITEM_STATS_NAME]
      };
    });
    return parsedAggsResult;
  }

  _appendAdditionalRangeQuery(field, oldQuery, rangeStart, rangeEnd) {
    let appendFilter = [];
    if (typeof rangeStart !== 'undefined') {
      appendFilter.push({
        range: {
          [field]: { 'gte': rangeStart }
        }
      });
    }
    if (typeof rangeEnd !== 'undefined') {
      appendFilter.push({
        range: {
          [field]: { 'lt': rangeEnd }
        }
      });
    }
    if (appendFilter.length > 0) {
      const newQuery = {
        bool: {
          must: oldQuery ? [
            oldQuery,
            [...appendFilter]
          ] : [...appendFilter]
        }
      }
      return newQuery;
    }
    else return oldQuery;
  }

  /**
   * get global stats for a field
   * @param {*} param0 
   * @returns {min, max, sum, count, avg, _range}
   */
  async _numericGlobalStats({
    filter,
    field,
    rangeStart, 
    rangeEnd,
  }) {
    let queryBody = {size: 0};
    if (!!filter) {
      queryBody.query = this._getFilterObj(filter);
    }
    queryBody.query = this._appendAdditionalRangeQuery(field, queryBody.query, rangeStart, rangeEnd);
    const aggsObj = {
      [AGGS_GLOBAL_STATS_NAME]: {
        stats: {field: field}
      }
    };
    queryBody.aggs = aggsObj;
    const result = await this._query(queryBody);
    let resultStats = result.aggregations[AGGS_GLOBAL_STATS_NAME];
      resultStats = {
        _range: [
          typeof rangeStart === 'undefined' ? resultStats.min : rangeStart, 
          typeof rangeEnd === 'undefined' ? resultStats.max : rangeEnd, 
        ],
        ...resultStats,
      };
    return resultStats;
  }

  async numericAggregation({
    filter, 
    field,
    rangeStart, 
    rangeEnd, 
    rangeStep, 
    binCount,
  }) {
    let result;
    if (rangeStep <= 0) {
      throw new Error(`Invalid rangeStep ${rangeStep}`);
    }
    if (rangeStart > rangeEnd) {
      throw new Error(`Invalid rangeStart (${rangeStep}) > rangeEnd (${rangeEnd})`);
    }
    if (binCount <= 0) {
      throw new Error(`Invalid binCount ${binCount}`);
    }
    if (!!rangeStep && !!binCount) {
      throw new Error('Cannot set "rangeStep" and "binCount" at same time.');
    }
    if (!!rangeStep) {
      result = await this._numericHistogramWithFixedRangeStep({
        filter, 
        field, 
        rangeStart, 
        rangeEnd, 
        rangeStep,
      });
      return result;
    }
    else if (!!binCount) {
      result = await this._numericHistogramWithFixedBinCount({
        filter, 
        field, 
        rangeStart, 
        rangeEnd, 
        binCount,
      });
      return result;
    }
    else {
      result = await this._numericGlobalStats({
        filter,
        field,
        rangeStart, 
        rangeEnd,
      });
      return [result];
    }
  }

  async textAggregation({
    filter, 
    field,
  }) {
    let queryBody = {size: 0};
    if (!!filter) {
      queryBody.query = this._getFilterObj(filter);
    }
    const aggsName = `${field}Aggs`;
    queryBody.aggs = {
      [aggsName]: {
        terms: {
          field: field
        }
      }
    };
    const result = await this._query(queryBody);
    let parsedResults = result.aggregations[aggsName].buckets.map(item => {
      return {
        key: item.key,
        count: item.doc_count,
      };
    });
    return parsedResults;
  }
}

export default ESConnector;