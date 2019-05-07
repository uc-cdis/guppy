import GraphQLJSON from 'graphql-type-json';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import log from './logger';
import { firstLetterUpperCase } from './utils/utils';

/**
 * This function parses all requesting fields from a request
 * @param {object} resolveInfo - info argument from resolver function
 * @returns {string[]} parsed fields
 */
const parseFieldsFromTypeResolveInfo = (resolveInfo) => {
  const parsedInfo = parseResolveInfo(resolveInfo);
  const typeName = firstLetterUpperCase(parsedInfo.name);
  const fields = Object.keys(parsedInfo.fieldsByTypeName[typeName]);
  return fields;
};

/**
 * This is for getting raw data, by specific es index and es type
 * @param {object} esInstance
 * @param {string} esIndex
 * @param {string} esType
 */
const typeQueryResolver = (esInstance, esIndex, esType) => (parent, args, context, resolveInfo) => {
  const {
    offset, first, filter, sort,
  } = args;
  log.debug('[resolver.typeQueryResolver] es type', esType);
  log.debug('[resolver.typeQueryResolver] args', args);
  const fields = parseFieldsFromTypeResolveInfo(resolveInfo);
  const dataPromise = esInstance.getData({
    esIndex, esType, fields, filter, sort, offset, size: first,
  });
  return dataPromise;
};

/**
 * This resolver passes down `filter` and `filterSelf` element to children resolvers.
 * It is a parent resolver for aggregation data
 * @param {object} esInstance
 * @param {string} esIndex
 * @param {string} esType
 */
const typeAggsQueryResolver = (esInstance, esIndex, esType) => (parent, args) => {
  const {
    filter, filterSelf, needEncryptAgg, accessibility,
  } = args;
  log.debug('[resolver.typeAggsQueryResolver] args', args);
  return {
    filter,
    filterSelf,
    esInstance,
    esIndex,
    esType,
    needEncryptAgg,
    accessibility,
  };
};

/**
 * This resolver is for getting _totalCount
 * @param {object} parent
 */
const aggsTotalQueryResolver = (parent) => {
  const {
    filter, esInstance, esIndex, esType,
  } = parent;
  const countPromise = esInstance.getCount(esIndex, esType, filter);
  return countPromise;
};

/**
 * This resolver is for numeric aggregation.
 * It inherits some arguments from its parent, also parses its arguments,
 * and then calls numeric aggregation function, and finally returns response
 * @param {object} parent
 * @param {object} args
 */
const numericHistogramResolver = async (parent, args, context) => {
  const {
    esInstance, esIndex, esType,
    filter, field, filterSelf, accessibility,
  } = parent;
  const {
    rangeStart, rangeEnd, rangeStep, binCount,
  } = args;
  const { authHelper } = context;
  const defaultAuthFilter = await authHelper.getDefaultFilter(accessibility);
  log.debug('[resolver.numericHistogramResolver] args', args);
  const resultPromise = esInstance.numericAggregation({
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
  });
  return resultPromise;
};

/**
 * This resolver is for text aggregation.
 * It inherits arguments from its parent,
 * and then calls text aggregation function, and finally returns response
 * @param {object} parent
 * @param {object} args
 */
const textHistogramResolver = async (parent, args, context) => {
  log.debug('[resolver.textHistogramResolver] args', args);
  const {
    esInstance, esIndex, esType,
    filter, field, filterSelf, accessibility,
  } = parent;
  const { authHelper } = context;
  const defaultAuthFilter = await authHelper.getDefaultFilter(accessibility);
  const resultPromise = esInstance.textAggregation({
    esIndex,
    esType,
    filter,
    field,
    filterSelf,
    defaultAuthFilter,
  });
  return resultPromise;
};

const getFieldAggregationResolverMappings = (esInstance, esIndex) => {
  const fieldAggregationResolverMappings = {};
  const { fields } = esInstance.getESFields(esIndex);
  fields.forEach((field) => {
    fieldAggregationResolverMappings[`${field}`] = (parent => ({ ...parent, field }));
  });
  return fieldAggregationResolverMappings;
};

/**
 * Tree-structured resolvers pass down arguments.
 * For better understanding, following is an example query, and related resolvers for each level:
 *
 * query {
 *   subject (filter: xx, offset: xx, first: xx, sort: xx) {  ---> `typeQueryResolver`
 *     gender
 *     race
 *   }
 *   _aggregation {
 *     subject (filter: xx, filterSelf: xx} { ---> `typeAggsQueryResolver`
 *       _totalCount  ---> `aggsTotalQueryResolver`
 *       gender {
 *         histogram {  ---> `textHistogramResolver`
 *           key
 *           count
 *         }
 *       }
 *       file_count {
 *         histogram (rangeStart: xx, rangeEnd: xx, rangeStep: xx, binCount: xx)
 *         {  ---> `numericHistogramResolver`
 *           key
 *           count
 *         }
 *       }
 *     }
 *   }
 *   _mapping {
 *     subject ---> see `mappingResolvers`
 *   }
 * }
 */

/**
 * Create resolvers for the whole graphql schema tree
 * See comments above for more detailed example.
 * @param {object} esConfig
 * @param {object} esInstance
 */
const getResolver = (esConfig, esInstance) => {
  const typeResolverMappings = esConfig.indices.reduce((acc, cfg) => {
    acc[cfg.type] = typeQueryResolver(esInstance, cfg.index, cfg.type);
    return acc;
  }, {});

  const typeAggregationResolverMappings = esConfig.indices.reduce((acc, cfg) => {
    acc[cfg.type] = typeAggsQueryResolver(esInstance, cfg.index, cfg.type);
    return acc;
  }, {});

  const typeAggregationResolvers = esConfig.indices.reduce((acc, cfg) => {
    const typeAggsName = `${firstLetterUpperCase(cfg.type)}Aggregation`;
    acc[typeAggsName] = {
      _totalCount: aggsTotalQueryResolver,
      ...getFieldAggregationResolverMappings(esInstance, cfg.index),
    };
    return acc;
  }, {});

  const mappingResolvers = esConfig.indices.reduce((acc, cfg) => {
    acc[cfg.type] = () => (esInstance.getESFields(cfg.index).fields);
    return acc;
  }, {});

  const resolver = {
    JSON: GraphQLJSON,
    Query: {
      ...typeResolverMappings,
      _aggregation: parent => ({ ...parent }),
      _mapping: parent => ({ ...parent }),
    },
    Aggregation: {
      ...typeAggregationResolverMappings,
    },
    ...typeAggregationResolvers,
    HistogramForNumber: {
      histogram: numericHistogramResolver,
    },
    HistogramForString: {
      histogram: textHistogramResolver,
    },
    Mapping: {
      ...mappingResolvers,
    },
  };
  log.info('[resolver] graphql resolver generated.');
  log.rawOutput(log.levelEnums.DEBUG, resolver);
  return resolver;
};

export default getResolver;
