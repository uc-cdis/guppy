import { getFilterObj } from './filter';
import {
  AGGS_GLOBAL_STATS_NAME,
  AGGS_ITEM_STATS_NAME,
  AGGS_QUERY_NAME,
} from './const';

const appendAdditionalRangeQuery = (field, oldQuery, rangeStart, rangeEnd) => {
  const appendFilter = [];
  if (typeof rangeStart !== 'undefined') {
    appendFilter.push({
      range: {
        [field]: { gte: rangeStart },
      },
    });
  }
  if (typeof rangeEnd !== 'undefined') {
    appendFilter.push({
      range: {
        [field]: { lt: rangeEnd },
      },
    });
  }
  if (appendFilter.length > 0) {
    const newQuery = {
      bool: {
        must: oldQuery ? [
          oldQuery,
          [...appendFilter],
        ] : [...appendFilter],
      },
    };
    return newQuery;
  }
  return oldQuery;
};

/**
 * get global stats for a field
 * @param {*} param0
 * @returns {min, max, sum, count, avg, _range}
 */
const numericGlobalStats = async (
  esContext,
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
  }) => {
  const queryBody = { size: 0 };
  if (typeof filter !== 'undefined') {
    queryBody.query = getFilterObj(esContext, filter);
  }
  queryBody.query = appendAdditionalRangeQuery(field, queryBody.query, rangeStart, rangeEnd);
  const aggsObj = {
    [AGGS_GLOBAL_STATS_NAME]: {
      stats: { field },
    },
  };
  queryBody.aggs = aggsObj;
  const result = await esContext.queryHandler(queryBody);
  let resultStats = result.aggregations[AGGS_GLOBAL_STATS_NAME];
  resultStats = {
    _range: [
      typeof rangeStart === 'undefined' ? resultStats.min : rangeStart,
      typeof rangeEnd === 'undefined' ? resultStats.max : rangeEnd,
    ],
    ...resultStats,
  };
  return resultStats;
};

const numericHistogramWithFixedRangeStep = async (
  esContext,
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
    rangeStep,
  }) => {
  const queryBody = { size: 0 };
  if (typeof filter !== 'undefined') {
    queryBody.query = getFilterObj(esContext, filter);
  }
  queryBody.query = appendAdditionalRangeQuery(field, queryBody.query, rangeStart, rangeEnd);
  const aggsObj = {
    [AGGS_GLOBAL_STATS_NAME]: {
      stats: { field },
    },
  };
  aggsObj[AGGS_QUERY_NAME] = {
    histogram: {
      field,
      interval: rangeStep,
    },
    aggs: {
      [AGGS_ITEM_STATS_NAME]: {
        stats: {
          field,
        },
      },
    },
  };
  if (typeof rangeStart !== 'undefined') {
    let offset = rangeStart;
    while (offset - rangeStep > 0) {
      offset -= rangeStep;
    }
    aggsObj[AGGS_QUERY_NAME].histogram.offset = offset;
  }
  queryBody.aggs = aggsObj;
  const result = await esContext.queryHandler(queryBody);
  const parsedAggsResult = result.aggregations[AGGS_QUERY_NAME].buckets.map(item => ({
    _range: [item.key, item.key + rangeStep],
    ...item[AGGS_ITEM_STATS_NAME],
  }));
  return parsedAggsResult;
};

const numericHistogramWithFixedBinCount = async (
  esContext,
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
    binCount,
  }) => {
  const globalStats = await numericGlobalStats(esContext, {
    filter, field, rangeStart, rangeEnd,
  });
  const { min, max } = globalStats;
  const histogramStart = typeof rangeStart === 'undefined' ? min : rangeStart;
  const histogramEnd = typeof rangeEnd === 'undefined' ? (max + 1) : rangeEnd;
  const rangeStep = (histogramEnd - histogramStart) / binCount;
  return numericHistogramWithFixedRangeStep(
    esContext,
    {
      filter,
      field,
      rangeStart: histogramStart,
      rangeEnd: histogramEnd,
      rangeStep,
    },
  );
};

export const numericAggregation = async (
  esContext,
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
    rangeStep,
    binCount,
  },
) => {
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
  if (typeof rangeStep !== 'undefined' && typeof binCount !== 'undefined') {
    throw new Error('Cannot set "rangeStep" and "binCount" at same time.');
  }
  if (typeof rangeStep !== 'undefined') {
    result = await numericHistogramWithFixedRangeStep(
      esContext,
      {
        filter,
        field,
        rangeStart,
        rangeEnd,
        rangeStep,
      },
    );
    return result;
  }
  if (typeof binCount !== 'undefined') {
    result = await numericHistogramWithFixedBinCount(
      esContext,
      {
        filter,
        field,
        rangeStart,
        rangeEnd,
        binCount,
      },
    );
    return result;
  }
  result = await numericGlobalStats(
    esContext,
    {
      filter,
      field,
      rangeStart,
      rangeEnd,
    },
  );
  return [result];
};

export const textAggregation = async (
  esContext,
  {
    filter,
    field,
  },
) => {
  const queryBody = { size: 0 };
  if (typeof filter !== 'undefined') {
    queryBody.query = getFilterObj(esContext, filter);
  }
  const aggsName = `${field}Aggs`;
  queryBody.aggs = {
    [aggsName]: {
      terms: {
        field,
      },
    },
  };
  const result = await esContext.queryHandler(queryBody);
  const parsedResults = result.aggregations[aggsName].buckets.map(item => ({
    key: item.key,
    count: item.doc_count,
  }));
  return parsedResults;
};
