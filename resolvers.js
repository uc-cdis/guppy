import GraphQLJSON from 'graphql-type-json';

const listQueryResolver = esConnector => async (parent, args, context, info) => {
  let { offset, size, filter, sort } = args;
  console.log('input filter: ', JSON.stringify(filter, null, 4));
  console.log('input sort: ', JSON.stringify(sort, null, 4));
  const fields = []; // TODO 
  const data = await esConnector.getData(fields, filter, sort, offset, size);
  return data;
};

const aggsQueryResolver = esConnector => async (parent, args, context, info) => {
  let { offset, size, filter } = args;
  return { 
    filter,
    offset,
    size,
  };
};

const aggsTotalQueryResolver = esConnector => async (parent, args, context, info) => {
  const {filter} = parent;
  const count = await esConnector.getTotalCount(filter);
  return {
    total: count
  };
};

const numericHistogramResolver = esConnector => async (parent, args, context, info) => {
  const {filter, field} = parent;
  const {rangeStart, rangeEnd, rangeStep, binCount} = args;
  const result = await esConnector.numericAggregation({
    filter, 
    field, 
    rangeStart, 
    rangeEnd, 
    rangeStep, 
    binCount,
  });
  return result;
};

const textHistogramResolver = esConnector => async (parent, args, context, info) => {
  const {filter, field} = parent;
  const result = await esConnector.textAggregation({
    filter, 
    field, 
  });
  return result;
};

const aggregateFieldResolver = (field) => (parent, args, context, info) => {
  const {filter} = parent;
  return {filter, field: field};
}

const getResolver = (esConfig, esConnector) => {
  const esType = esConfig.type;
  const fields = esConnector.getESFields();
  const aggregateFieldResolverMappings = fields.reduce((acc, field) => {
    acc[field] = aggregateFieldResolver(field);
    return acc;
  }, {});
  return {  
    JSON: GraphQLJSON,
    Query: {
      [esType]: listQueryResolver(esConnector),
      aggs: aggsQueryResolver(esConnector),
    },
    Aggregates: {
      [esType]: aggsTotalQueryResolver,
      ...aggregateFieldResolverMappings,
      // gender: (parent, args, context, info) => {
      //   const {filter} = parent;
      //   return {filter, field: 'gender'};
      // },
      // file_count: (parent, args, context, info) => {
      //   const {filter} = parent;
      //   return {filter, field: 'file_count'};
      // },
    },
    HistogramForNumber: {
      histogram: numericHistogramResolver(esConnector)
    },
    HistogramForString: {
      histogram: textHistogramResolver(esConnector)
    }
  };
};

export default getResolver;