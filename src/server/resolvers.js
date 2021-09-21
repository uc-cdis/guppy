import GraphQLJSON from 'graphql-type-json';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import _ from 'lodash';
import log from './logger';
import { buildNestedFieldMapping, filterFieldMapping, firstLetterUpperCase } from './utils/utils';
import { esFieldNumericTextTypeMapping, NumericTextTypeTypeEnum } from './es/const';

/**
 * This is for getting raw data, by specific es index and es type
 * @param {object} esInstance
 * @param {string} esIndex
 * @param {string} esType
 */
const typeQueryResolver = (esInstance, esIndex, esType) => (parent, args, context, resolveInfo) => {
  const {
    offset, first, filter, sort, format,
  } = args;
  const fields = parseResolveInfo(resolveInfo);
  return esInstance.getData({
    esIndex, esType, fields, filter, sort, offset, size: first, format,
  });
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
    filter, filterSelf, nestedAggFields, needEncryptAgg, accessibility,
  } = args;
  log.debug('[resolver.typeAggsQueryResolver] args', args);
  return {
    filter,
    filterSelf,
    esInstance,
    esIndex,
    esType,
    nestedAggFields,
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
  return esInstance.getCount(esIndex, esType, filter);
};

/**
 * This resolver is for numeric aggregation.
 * It inherits some arguments from its parent, also parses its arguments,
 * and then calls numeric aggregation function, and finally returns response
 * @param {object} parent
 * @param {object} args
 * @param {object} context
 */
const numericHistogramResolver = async (parent, args, context) => {
  const {
    esInstance, esIndex, esType,
    filter, field, nestedAggFields, filterSelf, accessibility, nestedPath,
  } = parent;
  log.debug('[resolver.numericHistogramResolver] parent', parent);
  const {
    rangeStart, rangeEnd, rangeStep, binCount,
  } = args;
  const { authHelper } = context;
  const defaultAuthFilter = await authHelper.getDefaultFilter(accessibility);
  log.debug('[resolver.numericHistogramResolver] args', args);

  return esInstance.numericAggregation({
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
  });
};

/**
 * This resolver is for text aggregation.
 * It inherits arguments from its parent,
 * and then calls text aggregation function, and finally returns response
 * @param {object} parent
 * @param {object} args
 * @param {object} context
 */
const textHistogramResolver = async (parent, args, context) => {
  log.debug('[resolver.textHistogramResolver] args', args);
  const {
    esInstance, esIndex, esType,
    filter, field, nestedAggFields, filterSelf, accessibility, nestedPath, isNumericField,
  } = parent;
  log.debug('[resolver.textHistogramResolver] parent', parent);
  const {
    filterNestedEntity,
    reverseNested,
  } = args;
  const { authHelper } = context;
  const defaultAuthFilter = await authHelper.getDefaultFilter(accessibility);
  return esInstance.textAggregation({
    esIndex,
    esType,
    filter,
    field,
    filterSelf,
    defaultAuthFilter,
    nestedAggFields,
    nestedPath,
    isNumericField,
    filterNestedEntity,
    reverseNested,
  });
};

const getFieldAggregationResolverMappingsByField = (field) => {
  let isNumericField = false;
  if (esFieldNumericTextTypeMapping[field.type] === NumericTextTypeTypeEnum.ES_NUMERIC_TYPE) {
    isNumericField = true;
  }
  if (field.type !== 'nested') {
    return ((parent) => ({ ...parent, field: field.name, isNumericField }));
  }
  // if field is nested type, update nestedPath info with parent's nestedPath and pass down
  return ((parent) => ({
    ...parent, field: field.name, nestedPath: (parent.nestedPath) ? `${parent.nestedPath}.${field.name}` : `${field.name}`, isNumericField,
  }));
};

const getFieldAggregationResolverMappings = (esInstance, esIndex) => {
  const { fields } = esInstance.getESFields(esIndex);
  const fieldAggregationResolverMappings = {};
  fields.forEach((field) => {
    fieldAggregationResolverMappings[`${field.name}`] = getFieldAggregationResolverMappingsByField(field);
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
 *     subject (filter: xx, filterSelf: xx} {  ---> `typeAggsQueryResolver`
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
 *       visits {  ---> `typeNestedAggregationResolver` (fall-through)
 *         visit_label {
 *           histogram {  ---> `textHistogramResolver`
 *             key
 *             count
 *           }
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

  const typeNestedAggregationResolvers = esConfig.indices.reduce((acc, cfg) => {
    const { fields } = esInstance.getESFields(cfg.index);
    const nestedFieldsArray = fields.filter((entry) => entry.type === 'nested');

    // similar level by level "flatten" logic as for schema
    while (nestedFieldsArray.length > 0) {
      const nestedFields = nestedFieldsArray.shift();
      const typeNestedAggsName = `NestedHistogramFor${firstLetterUpperCase(nestedFields.name)}`;
      acc[typeNestedAggsName] = {};
      if (nestedFields.type === 'nested' && nestedFields.nestedProps) {
        nestedFields.nestedProps.forEach((props) => {
          if (props.type === 'nested') {
            nestedFieldsArray.push(props);
          }
          acc[typeNestedAggsName][props.name] = getFieldAggregationResolverMappingsByField(props);
        });
      }
    }
    return acc;
  }, {});

  const mappingResolvers = esConfig.indices.reduce((acc, cfg) => {
    log.debug(`${cfg.index} `, esInstance.getESFields(cfg.index));
    acc[cfg.type] = filterFieldMapping(
      _.flattenDeep(
        esInstance.getESFields(cfg.index).fields.map(
          (f) => buildNestedFieldMapping(f),
        ),
      ),
    );
    return acc;
  }, {});

  const resolver = {
    JSON: GraphQLJSON,
    Query: {
      ...typeResolverMappings,
      _aggregation: (parent) => ({ ...parent }),
      _mapping: (parent) => ({ ...parent }),
    },
    Aggregation: {
      ...typeAggregationResolverMappings,
    },
    ...typeAggregationResolvers,
    ...typeNestedAggregationResolvers,
    HistogramForNumber: {
      histogram: numericHistogramResolver,
      asTextHistogram: textHistogramResolver,
    },
    HistogramForString: {
      histogram: textHistogramResolver,
    },
    RegularAccessHistogramForNumber: {
      histogram: numericHistogramResolver,
      asTextHistogram: textHistogramResolver,
    },
    RegularAccessHistogramForString: {
      histogram: textHistogramResolver,
    },
    GranularAccessHistogramForNumber: {
      histogram: numericHistogramResolver,
      asTextHistogram: textHistogramResolver,
    },
    GranularAccessHistogramForString: {
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
