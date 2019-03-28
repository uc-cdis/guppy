import GraphQLJSON from 'graphql-type-json';
import log from './logger';

const firstLetterUpperCase = str => str.charAt(0).toUpperCase() + str.slice(1);

const typeQueryResolver = (esInstance, esIndex, esType) => async (parent, args) => {
  const {
    offset, size, filter, sort,
  } = args;
  log.debug('[resolver.typeQueryResolver] filter', JSON.stringify(filter, null, 4));
  log.debug('[resolver.typeQueryResolver] sort', JSON.stringify(sort, null, 4));
  log.debug('[resolver.typeQueryResolver] args', JSON.strinargs);
  const fields = []; // TODO
  const data = await esInstance.getData({
    esIndex, esType, fields, filter, sort, offset, size,
  });
  return data;
};

const aggsQueryResolver = async (parent, args) => {
  log.debug('[resolver.aggsQueryResolver] args', args);
  return { ...parent };
};

const typeAggsQueryResolver = (esInstance, esIndex, esType) => async (parent, args) => {
  log.debug('[resolver.typeAggsQueryResolver] args', args);
  const {
    filter, offset, size, filterSelf,
  } = args;
  return {
    filter,
    offset,
    size,
    filterSelf,
    esInstance,
    esIndex,
    esType,
  };
};

const aggsTotalQueryResolver = async (parent, args) => {
  log.debug('[resolver.aggsTotalQueryResolver] args', args);
  const {
    filter, esInstance, esIndex, esType,
  } = parent;
  log.debug('[resolver.aggsTotalQueryResolver] filter', filter);
  const count = await esInstance.getCount(esIndex, esType, filter);
  return count;
};

const aggregateFieldResolver = field => (parent, args) => {
  log.debug('[resolver.aggregateFieldResolver] args', args);
  const {
    filter, filterSelf, esInstance, esIndex, esType,
  } = parent;
  return {
    filter,
    field,
    filterSelf,
    esInstance,
    esIndex,
    esType,
  };
};

const numericHistogramResolver = async (parent, args) => {
  log.debug('[resolver.numericHistogramResolver] args', args);
  const {
    esInstance, esIndex, esType, filter, field, filterSelf,
  } = parent;
  const {
    rangeStart, rangeEnd, rangeStep, binCount,
  } = args;
  const result = await esInstance.numericAggregation({
    esIndex,
    esType,
    filter,
    field,
    rangeStart,
    rangeEnd,
    rangeStep,
    binCount,
    filterSelf,
  });
  return result;
};

const textHistogramResolver = async (parent, args) => {
  log.debug('[resolver.textHistogramResolver] args', args);
  const {
    esInstance, esIndex, esType,
    filter, field, filterSelf,
  } = parent;
  const result = await esInstance.textAggregation({
    esIndex,
    esType,
    filter,
    field,
    filterSelf,
  });
  return result;
};

const getFieldAggregationResolverMappings = (esInstance, esIndex) => {
  const fieldAggregationResolverMappings = {};
  const { fields } = esInstance.getESFields(esIndex);
  fields.forEach((field) => {
    fieldAggregationResolverMappings[`${field}`] = aggregateFieldResolver(field);
  });
  return fieldAggregationResolverMappings;
};

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

  const resolver = {
    JSON: GraphQLJSON,
    Query: {
      ...typeResolverMappings,
      _aggregation: aggsQueryResolver,
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
  };
  log.info('[resolver] graphql resolver generated.');
  log.debug('[resolver] graphql resolver', resolver);
  return resolver;
};

export default getResolver;
