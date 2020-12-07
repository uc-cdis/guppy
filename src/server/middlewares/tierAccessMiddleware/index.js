import config from '../../config';
import { firstLetterUpperCase } from '../../utils/utils';
import { tierAccessResolver, hideNumberResolver } from './resolvers';

// apply this middleware to all es types' data/aggregation resolvers
const queryIndexMapping = {};
const aggsIndexMapping = {};
const totalCountTypeMapping = {};
config.esConfig.indices.forEach((item) => {
  queryIndexMapping[item.index] = tierAccessResolver({
    isRawDataQuery: true,
    esType: item.type,
    esIndex: item.index,
  });
  aggsIndexMapping[item.index] = tierAccessResolver({ esType: item.type, esIndex: item.index });
  const aggregationName = `${firstLetterUpperCase(item.type)}Aggregation`;
  totalCountTypeMapping[aggregationName] = {
    _totalCount: hideNumberResolver(true),
  };
});
const tierAccessMiddleware = {
  Query: {
    ...queryIndexMapping,
  },
  Aggregation: {
    ...aggsIndexMapping,
  },
  ...totalCountTypeMapping,
  HistogramForNumber: {
    histogram: hideNumberResolver(false),
  },
  HistogramForString: {
    histogram: hideNumberResolver(false),
  },
};

export default tierAccessMiddleware;
