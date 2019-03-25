import GraphQLJSON from 'graphql-type-json';

const listQueryResolver = esInstance => async (parent, args) => {
  const {
    offset, size, filter, sort,
  } = args;
  console.log('input filter: ', JSON.stringify(filter, null, 4));
  console.log('input sort: ', JSON.stringify(sort, null, 4));
  const fields = []; // TODO
  const data = await esInstance.getData(fields, filter, sort, offset, size);
  return data;
};

const aggsQueryResolver = async (parent, args) => {
  const {
    offset, size, filter, filterSelf,
  } = args;
  return {
    filter,
    offset,
    size,
    filterSelf,
  };
};

const aggsTotalQueryResolver = esInstance => async (parent) => {
  const { filter } = parent;
  const count = await esInstance.getCount(filter);
  return {
    total: count,
  };
};

const numericHistogramResolver = esInstance => async (parent, args) => {
  const { filter, field, filterSelf } = parent;
  const {
    rangeStart, rangeEnd, rangeStep, binCount,
  } = args;
  const result = await esInstance.numericAggregation({
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

const textHistogramResolver = esInstance => async (parent) => {
  const { filter, field, filterSelf } = parent;
  const result = await esInstance.textAggregation({
    filter,
    field,
    filterSelf,
  });
  return result;
};

const aggregateFieldResolver = field => (parent) => {
  const { filter, filterSelf } = parent;
  return { filter, field, filterSelf };
};

const getResolver = (esConfig, esInstance) => {
  const esType = esConfig.type;
  const fields = esInstance.getESFields();
  const aggregateFieldResolverMappings = fields.reduce((acc, field) => {
    acc[field] = aggregateFieldResolver(field);
    return acc;
  }, {});
  return {
    JSON: GraphQLJSON,
    Query: {
      [esType]: listQueryResolver(esInstance),
      aggs: aggsQueryResolver,
    },
    Aggregates: {
      [esType]: aggsTotalQueryResolver(esInstance),
      ...aggregateFieldResolverMappings,
    },
    HistogramForNumber: {
      histogram: numericHistogramResolver(esInstance),
    },
    HistogramForString: {
      histogram: textHistogramResolver(esInstance),
    },
  };
};

export default getResolver;
