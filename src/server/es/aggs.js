import { UserInputError } from 'apollo-server';
import getFilterObj from './filter';
import {
  AGGS_GLOBAL_STATS_NAME,
  AGGS_ITEM_STATS_NAME,
  AGGS_NESTED_QUERY_NAME,
  AGGS_QUERY_NAME,
} from './const';
import config from '../config';

const PAGE_SIZE = 10000;

const updateAggObjectForTermsFields = (termsFields, aggsObj) => {
  const newAggsObj = { ...aggsObj };
  termsFields.forEach((element) => {
    const variableName = `${element}Terms`;
    newAggsObj[variableName] = {
      terms: {
        field: element,
        size: PAGE_SIZE,
      },
    };
  });
  return newAggsObj;
};

const updateAggObjectForMissingFields = (missingFields, aggsObj) => {
  const newAggsObj = { ...aggsObj };
  missingFields.forEach((element) => {
    const variableName = `${element}Missing`;
    newAggsObj[variableName] = {
      missing: {
        field: element,
      },
    };
  });
  return newAggsObj;
};

const processResultsForNestedAgg = (nestedAggFields, item, resultObj) => {
  let missingFieldResult;
  if (nestedAggFields && nestedAggFields.missingFields) {
    missingFieldResult = [];
    nestedAggFields.missingFields.forEach((element) => {
      const variableName = `${element}Missing`;
      missingFieldResult.push({
        field: element,
        count: item[variableName].doc_count,
      });
    });
  }

  let termsFieldResult;
  if (nestedAggFields && nestedAggFields.termsFields) {
    termsFieldResult = [];
    nestedAggFields.termsFields.forEach((element) => {
      const tempResult = {};
      tempResult.field = element;
      tempResult.terms = [];
      tempResult.count = 0;
      const variableName = `${element}Terms`;
      if (item[variableName].buckets && item[variableName].buckets.length > 0) {
        item[variableName].buckets.forEach((itemElement) => {
          tempResult.terms.push({
            key: itemElement.key,
            count: itemElement.doc_count,
          });
          tempResult.count += itemElement.doc_count;
        });
      } else {
        tempResult.terms.push({
          key: null,
          count: 0,
        });
      }
      termsFieldResult.push(tempResult);
    });
  }

  const newResultObj = {
    ...resultObj,
    ...(missingFieldResult && { missingFields: missingFieldResult }),
    ...(termsFieldResult && { termsFields: termsFieldResult }),
  };
  return newResultObj;
};

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
 * Export for test
 * @param {object} param0 - some ES related arguments: esInstance, esIndex, and esType
 * @param {object} param1 - some graphql related arguments
 * @param {object} param1.filter - filter (if any) to apply on aggregation
 * @param {object} param1.field - field to aggregate. Required
 * @param {object} param1.rangeStart - start value of the histogram, if empty, default to minimum
 * @param {object} param1.rangeEnd - end value of the histogram, if empty, default to maximum
 * @param {object} param1.rangeStep - histogram width. Required.
 * @param {object} param1.filterSelf - only valid if to avoid filtering the same aggregation field
 * @param {object} param1.defaultAuthFilter - once param1.filter is empty,
 *                                            use this auth related filter instead
 * @param {object} param1.nestedAggFields - fields for sub-aggregations
 *                                          (terms and/or missing aggregation)
 * @param {object} param1.nestedPath - path info used by nested aggregation
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
    filterSelf,
    defaultAuthFilter,
    nestedAggFields,
    nestedPath,
  },
) => {
  const queryBody = { size: 0 };
  if (!!filter || !!defaultAuthFilter) {
    queryBody.query = getFilterObj(
      esInstance,
      esIndex,
      filter,
      field,
      filterSelf,
      defaultAuthFilter,
    );
  }
  queryBody.query = appendAdditionalRangeQuery(field, queryBody.query, rangeStart, rangeEnd);
  let aggsObj = {
    [AGGS_GLOBAL_STATS_NAME]: {
      stats: {
        field: (nestedPath) ? `${nestedPath}.${field}` : `${field}`,
      },
    },
  };
  if (nestedAggFields && nestedAggFields.termsFields) {
    aggsObj = updateAggObjectForTermsFields(nestedAggFields.termsFields, aggsObj);
  }
  if (nestedAggFields && nestedAggFields.missingFields) {
    aggsObj = updateAggObjectForMissingFields(nestedAggFields.missingFields, aggsObj);
  }
  if (nestedPath) {
    queryBody.aggs = {
      [AGGS_NESTED_QUERY_NAME]: {
        nested: {
          path: nestedPath,
        },
        aggs: {
          ...aggsObj,
        },
      },
    };
  } else {
    queryBody.aggs = aggsObj;
  }

  const result = await esInstance.query(esIndex, esType, queryBody);
  let resultStats = (nestedPath)
    ? result.aggregations[AGGS_NESTED_QUERY_NAME][AGGS_GLOBAL_STATS_NAME]
    : result.aggregations[AGGS_GLOBAL_STATS_NAME];
  const range = [
    typeof rangeStart === 'undefined' ? resultStats.min : rangeStart,
    typeof rangeEnd === 'undefined' ? resultStats.max : rangeEnd,
  ];
  resultStats = {
    key: range,
    ...resultStats,
  };
  resultStats = processResultsForNestedAgg(nestedAggFields, result.aggregations, resultStats);
  return resultStats;
};

/**
 * This function does aggregation for numeric field, and returns histogram with given width.
 * Export for test
 * @param {object} param0 - some ES related arguments: esInstance, esIndex, and esType
 * @param {object} param1 - some graphql related arguments
 * @param {object} param1.filter - filter (if any) to apply on aggregation
 * @param {object} param1.field - field to aggregate. Required
 * @param {object} param1.rangeStart - start value of the histogram, if empty, default to minimum
 * @param {object} param1.rangeEnd - end value of the histogram, if empty, default to maximum
 * @param {object} param1.rangeStep - histogram width. Required.
 * @param {object} param1.filterSelf - only valid if to avoid filtering the same aggregation field
 * @param {object} param1.defaultAuthFilter - once param1.filter is empty,
 *                                            use this auth related filter instead
 * @param {object} param1.nestedAggFields - fields for sub-aggregations
 *                                          (terms and/or missing aggregation)
 * @param {object} param1.nestedPath - path info used by nested aggregation
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
    nestedAggFields,
    nestedPath,
  },
) => {
  const queryBody = { size: 0 };
  if (!!filter || !!defaultAuthFilter) {
    queryBody.query = getFilterObj(
      esInstance,
      esIndex,
      filter,
      field,
      filterSelf,
      defaultAuthFilter,
      nestedAggFields,
    );
  }
  queryBody.query = appendAdditionalRangeQuery(field, queryBody.query, rangeStart, rangeEnd);
  const aggsObj = {
    [AGGS_GLOBAL_STATS_NAME]: {
      stats: {
        field: (nestedPath) ? `${nestedPath}.${field}` : `${field}`,
      },
    },
  };
  aggsObj[AGGS_QUERY_NAME] = {
    histogram: {
      field: (nestedPath) ? `${nestedPath}.${field}` : `${field}`,
      interval: rangeStep,
    },
    aggs: {
      [AGGS_ITEM_STATS_NAME]: {
        stats: {
          field: (nestedPath) ? `${nestedPath}.${field}` : `${field}`,
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
  if (nestedAggFields && nestedAggFields.termsFields) {
    aggsObj[AGGS_QUERY_NAME].aggs = updateAggObjectForTermsFields(
      nestedAggFields.termsFields,
      aggsObj[AGGS_QUERY_NAME].aggs,
    );
  }
  if (nestedAggFields && nestedAggFields.missingFields) {
    aggsObj[AGGS_QUERY_NAME].aggs = updateAggObjectForMissingFields(
      nestedAggFields.missingFields,
      aggsObj[AGGS_QUERY_NAME].aggs,
    );
  }

  if (nestedPath) {
    queryBody.aggs = {
      [AGGS_NESTED_QUERY_NAME]: {
        nested: {
          path: nestedPath,
        },
        aggs: {
          ...aggsObj,
        },
      },
    };
  } else {
    queryBody.aggs = aggsObj;
  }

  const result = await esInstance.query(esIndex, esType, queryBody);
  const finalResults = [];
  let resultObj;
  const resultBuckets = (nestedPath)
    ? result.aggregations[AGGS_NESTED_QUERY_NAME][AGGS_QUERY_NAME].buckets
    : result.aggregations[AGGS_QUERY_NAME].buckets;
  resultBuckets.forEach((item) => {
    resultObj = processResultsForNestedAgg(nestedAggFields, item, resultObj);
    finalResults.push({
      key: [item.key, item.key + rangeStep],
      ...item[AGGS_ITEM_STATS_NAME],
      ...resultObj,
    });
  });
  return finalResults;
};

/**
 * This function does aggregation for numeric field, and returns histogram with fixed bin count.
 * Export for test
 * @param {object} param0 - some ES related arguments: esInstance, esIndex, and esType
 * @param {object} param1 - some graphql related arguments
 * @param {object} param1.filter - filter (if any) to apply on aggregation
 * @param {object} param1.field - field to aggregate. Required
 * @param {object} param1.rangeStart - start value of the histogram, if empty, default to minimum
 * @param {object} param1.rangeEnd - end value of the histogram, if empty, default to maximum
 * @param {object} param1.binCount - histogram bin count. Required.
 * @param {object} param1.filterSelf - only valid if to avoid filtering the same aggregation field
 * @param {object} param1.defaultAuthFilter - once param1.filter is empty,
 *                                            use this auth related filter instead
 * @param {object} param1.nestedAggFields - fields for sub-aggregations
 *                                          (terms and/or missing aggregation)
 * @param {object} param1.nestedPath - path info used by nested aggregation
 */
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
    nestedAggFields,
    nestedPath,
  },
) => {
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
      filterSelf,
      defaultAuthFilter,
      nestedAggFields,
      nestedPath,
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
      nestedAggFields,
      nestedPath,
    },
  );
};

/**
 * This function does aggregation for numeric field, and returns histogram
 * @param {object} param0 - some ES related arguments: esInstance, esIndex, and esType
 * @param {object} param1 - some graphql related arguments
 * @param {object} param1.filter - filter (if any) to apply on aggregation
 * @param {object} param1.field - field to aggregate. Required
 * @param {object} param1.rangeStart - start value of the histogram, if empty, default to minimum
 * @param {object} param1.rangeEnd - end value of the histogram, if empty, default to maximum
 * @param {object} param1.rangeStep - histogram width, conflict with `binCount`
 * @param {object} param1.binCount - histogram bin count, conflict with `rangeStep`
 * @param {object} param1.filterSelf - only valid if to avoid filtering the same aggregation field
 * @param {object} param1.defaultAuthFilter - once param1.filter is empty,
 *                                            use this auth related filter instead
 * @param {object} param1.nestedAggFields - fields for sub-aggregations
 *                                          (terms and/or missing aggregation)
 * @param {object} param1.nestedPath - path info used by nested aggregation
 */
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
    nestedAggFields,
    nestedPath,
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
        nestedAggFields,
        nestedPath,
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
        nestedAggFields,
        nestedPath,
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
      filterSelf,
      defaultAuthFilter,
      nestedAggFields,
      nestedPath,
    },
  );
  return [result];
};

/**
 * This function does aggregation for text field, and returns histogram
 * @param {object} param0 - some ES related arguments: esInstance, esIndex, and esType
 * @param {object} param1 - some graphql related arguments
 * @param {object} param1.filter - filter (if any) to apply on aggregation
 * @param {object} param1.field - field to aggregate. Required
 * @param {object} param1.filterSelf - only valid if to avoid filtering the same aggregation field
 * @param {object} param1.defaultAuthFilter - once param1.filter is empty,
 *                                            use this auth related filter instead
 * @param {object} param1.nestedAggFields - fields for sub-aggregations
 *                                          (terms and/or missing aggregation)
 * @param {object} param1.nestedPath - path info used by nested aggregation
 */
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
    nestedAggFields,
    nestedPath,
    isNumericField,
  },
) => {
  const queryBody = { size: 0 };
  if (!!filter || !!defaultAuthFilter) {
    queryBody.query = getFilterObj(
      esInstance,
      esIndex,
      filter,
      field,
      filterSelf,
      defaultAuthFilter,
    );
  }

  let missingAlias = {};
  // don't add missing alias to numeric field by default
  // since the value of missing alias is a string
  if (config.esConfig.aggregationIncludeMissingData && !isNumericField) {
    missingAlias = { missing: config.esConfig.missingDataAlias };
  }
  const aggsName = `${field}Aggs`;
  const aggsObj = {};
  let aggsNestedName;
  let fieldNestedName;
  if (nestedPath) {
    aggsNestedName = `${field}NestedAggs`;
    fieldNestedName = `${nestedPath}.${field}`;
  }

  if (nestedAggFields && nestedAggFields.termsFields) {
    missingAlias = {};
    aggsObj.aggs = updateAggObjectForTermsFields(nestedAggFields.termsFields, aggsObj.aggs);
  }

  if (nestedAggFields && nestedAggFields.missingFields) {
    missingAlias = {};
    aggsObj.aggs = updateAggObjectForMissingFields(nestedAggFields.missingFields, aggsObj.aggs);
  }

  // build up ES query if is nested aggregation
  if (aggsNestedName) {
    queryBody.aggs = {
      [aggsNestedName]: {
        nested: {
          path: nestedPath,
        },
        aggs: {
          [aggsName]: {
            composite: {
              sources: [
                {
                  [fieldNestedName]: {
                    terms: {
                      field: fieldNestedName,
                      ...missingAlias,
                    },
                  },
                },
              ],
              size: PAGE_SIZE,
            },
            ...aggsObj,
          },
        },
      },
    };
  } else {
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
        ...aggsObj,
      },
    };
  }
  let resultSize;
  let finalResults = [];
  /* eslint-disable */
  do {
    // parse ES query result based on whether is doing nested aggregation or not (if `aggsNestedName` is defined)
    const result = await esInstance.query(esIndex, esType, queryBody);
    resultSize = 0;

    const resultBuckets = (aggsNestedName) ? result.aggregations[aggsNestedName][aggsName].buckets : result.aggregations[aggsName].buckets;

    resultBuckets.forEach((item) => {
      const resultObj = processResultsForNestedAgg (nestedAggFields, item, {})
      finalResults.push({
        key: (fieldNestedName)? item.key[fieldNestedName] : item.key[field],
        count: item.doc_count,
        ...resultObj
      });
      resultSize += 1;
    });
    const afterKey = (aggsNestedName) ? result.aggregations[aggsNestedName][aggsName].after_key : result.aggregations[aggsName].after_key;
    if (typeof afterKey === 'undefined') break;
    (aggsNestedName) ? queryBody.aggs[aggsNestedName].aggs[aggsName].composite.after = afterKey : queryBody.aggs[aggsName].composite.after = afterKey;
  } while (resultSize === PAGE_SIZE);
  /* eslint-enable */

  // order aggregations by doc count
  finalResults = finalResults.sort((e1, e2) => e2.count - e1.count);

  // make the missing data bucket to the bottom of the list
  if (config.esConfig.aggregationIncludeMissingData) {
    const missingDataIndex = finalResults
      .findIndex((b) => b.key === config.esConfig.missingDataAlias);
    const missingDataItem = finalResults.find((b) => b.key === config.esConfig.missingDataAlias);
    if (missingDataItem) {
      finalResults.splice(missingDataIndex, 1);
      finalResults.splice(finalResults.length, 0, missingDataItem);
    }
  }
  return finalResults;
};
