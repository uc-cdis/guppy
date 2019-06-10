import { UserInputError } from 'apollo-server';
import getFilterObj from './filter';
import {
  AGGS_GLOBAL_STATS_NAME,
  AGGS_ITEM_STATS_NAME,
  AGGS_QUERY_NAME,
} from './const';
import config from '../config';

/**
 * This function appends extra range limitation onto a query body "oldQuery"
 * export for test
 * @param {string} field - which field to append range limitation to
 * @param {object} oldQuery  - the old query body to append
 * @param {number} rangeStart - the range start
 * @param {number} rangeEnd - the range end
 */
export const appendAdditionalRangeQuery = (field, oldQuery, rangeStart, rangeEnd) => {
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
 * @returns {min, max, sum, count, avg, key}
 */
export const numericGlobalStats = async (
  {
    esInstance,
    esIndex,
    esType,
  },
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
    defaultAuthFilter,
  }) => {
  const queryBody = { size: 0 };
  if (!filter || !defaultAuthFilter) {
    queryBody.query = getFilterObj(
      esInstance, esIndex, esType, filter, undefined, undefined, defaultAuthFilter,
    );
  }
  queryBody.query = appendAdditionalRangeQuery(field, queryBody.query, rangeStart, rangeEnd);
  const aggsObj = {
    [AGGS_GLOBAL_STATS_NAME]: {
      stats: { field },
    },
  };
  queryBody.aggs = aggsObj;
  const result = await esInstance.query(esIndex, esType, queryBody);
  let resultStats = result.aggregations[AGGS_GLOBAL_STATS_NAME];
  const range = [
    typeof rangeStart === 'undefined' ? resultStats.min : rangeStart,
    typeof rangeEnd === 'undefined' ? resultStats.max : rangeEnd,
  ];
  resultStats = {
    key: range,
    ...resultStats,
  };
  return resultStats;
};

/**
 * This function does aggregation for numeric field, and returns histogram with given width.
 * Export for test.
 * @param {object} param0 - some ES related arguments: esInstance, esIndex, and esType
 * @param {object} param1 - some graphql related arguments
 * @param {object} param1.filter - filter (if any) to apply on aggregation
 * @param {object} param1.field - field to aggregate
 * @param {object} param1.rangeStart - start value of the histogram, if empty, default to minimum
 * @param {object} param1.rangeEnd - end value of the histogram, if empty, default to maximum
 * @param {object} param1.rangeStep - histogram width. Required.
 * @param {object} param1.filterSelf - only valid if to avoid filtering the same aggregation field
 * @param {object} param1.defaultAuthFilter - some auth related filter (if any) by default
 */
export const numericHistogramWithFixedRangeStep = async (
  {
    esInstance,
    esIndex,
    esType,
  },
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
    rangeStep,
    filterSelf,
    defaultAuthFilter,
  }) => {
  const queryBody = { size: 0 };
  if (typeof filter !== 'undefined') {
    queryBody.query = getFilterObj(
      esInstance,
      esIndex,
      esType,
      filter,
      field,
      filterSelf,
      defaultAuthFilter,
    );
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
  const result = await esInstance.query(esIndex, esType, queryBody);
  const parsedAggsResult = result.aggregations[AGGS_QUERY_NAME].buckets.map(item => ({
    key: [item.key, item.key + rangeStep],
    ...item[AGGS_ITEM_STATS_NAME],
  }));
  return parsedAggsResult;
};

export const numericHistogramWithFixedBinCount = async (
  {
    esInstance,
    esIndex,
    esType,
  },
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
    binCount,
    filterSelf,
    defaultAuthFilter,
  }) => {
  const globalStats = await numericGlobalStats(
    {
      esInstance,
      esIndex,
      esType,
    },
    {
      filter,
      field,
      rangeStart,
      rangeEnd,
      defaultAuthFilter,
    },
  );
  const { min, max } = globalStats;
  const histogramStart = typeof rangeStart === 'undefined' ? min : rangeStart;
  const histogramEnd = typeof rangeEnd === 'undefined' ? (max + 1) : rangeEnd;
  const rangeStep = (histogramEnd - histogramStart) / binCount;
  return numericHistogramWithFixedRangeStep(
    {
      esInstance,
      esIndex,
      esType,
    },
    {
      filter,
      field,
      rangeStart: histogramStart,
      rangeEnd: histogramEnd,
      rangeStep,
      filterSelf,
      defaultAuthFilter,
    },
  );
};

export const numericAggregation = async (
  {
    esInstance,
    esIndex,
    esType,
  },
  {
    filter,
    field,
    rangeStart,
    rangeEnd,
    rangeStep,
    binCount,
    filterSelf,
    defaultAuthFilter,
  },
) => {
  if (rangeStep <= 0) {
    throw new UserInputError(`Invalid rangeStep ${rangeStep}`);
  }
  if (rangeStart > rangeEnd) {
    throw new UserInputError(`Invalid rangeStart (${rangeStep}) > rangeEnd (${rangeEnd})`);
  }
  if (binCount <= 0) {
    throw new UserInputError(`Invalid binCount ${binCount}`);
  }
  if (typeof rangeStep !== 'undefined' && typeof binCount !== 'undefined') {
    throw new UserInputError('Invalid to set "rangeStep" and "binCount" at same time');
  }
  if (typeof rangeStep !== 'undefined') {
    return numericHistogramWithFixedRangeStep(
      {
        esInstance,
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
        filterSelf,
        defaultAuthFilter,
      },
    );
  }
  if (typeof binCount !== 'undefined') {
    return numericHistogramWithFixedBinCount(
      {
        esInstance,
        esIndex,
        esType,
      },
      {
        filter,
        field,
        rangeStart,
        rangeEnd,
        binCount,
        filterSelf,
        defaultAuthFilter,
      },
    );
  }
  const result = await numericGlobalStats(
    {
      esInstance,
      esIndex,
      esType,
    },
    {
      filter,
      field,
      rangeStart,
      rangeEnd,
    },
  );
  return [result];
};

const PAGE_SIZE = 10000;
export const textAggregation = async (
  {
    esInstance,
    esIndex,
    esType,
  },
  {
    filter,
    field,
    filterSelf,
    defaultAuthFilter,
  },
) => {
  const queryBody = { size: 0 };
  if (typeof filter !== 'undefined' || typeof defaultAuthFilter !== 'undefined') {
    queryBody.query = getFilterObj(
      esInstance,
      esIndex,
      esType,
      filter,
      field,
      filterSelf,
      defaultAuthFilter,
    );
  }

  let missingAlias = {};
  if (config.esConfig.aggregationIncludeMissingData) {
    missingAlias = { missing: config.esConfig.missingDataAlias };
  }
  const aggsName = `${field}Aggs`;
  queryBody.aggs = {
    [aggsName]: {
      composite: {
        sources: [
          {
            [field]: {
              terms: {
                field,
                ...missingAlias,
              },
            },
          },
        ],
        size: PAGE_SIZE,
      },
    },
  };
  let resultSize;
  const finalResults = [];
  /* eslint-disable */
  do {
    const result = await esInstance.query(esIndex, esType, queryBody); 
    resultSize = 0;

    result.aggregations[aggsName].buckets.forEach((item) => {
      finalResults.push({
        key: item.key[field],
        count: item.doc_count,
      });
      resultSize += 1;
    });
    const afterKey = result.aggregations[aggsName].after_key;
    if (typeof afterKey === 'undefined') break;
    queryBody.aggs[aggsName].composite.after = afterKey;
  } while (resultSize === PAGE_SIZE);
  /* eslint-enable */

  // make the missing data bucket to the bottom of the list
  if (config.esConfig.aggregationIncludeMissingData) {
    const missingDataIndex = finalResults
      .findIndex(b => b.key === config.esConfig.missingDataAlias);
    const missingDataItem = finalResults.find(b => b.key === config.esConfig.missingDataAlias);
    if (missingDataItem) {
      finalResults.splice(missingDataIndex, 1);
      finalResults.splice(finalResults.length, 0, missingDataItem);
    }
  }
  return finalResults;
};
