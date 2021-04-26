import config from '../../config';
import { firstLetterUpperCase } from '../../utils/utils';
import { tierAccessResolver, hideNumberResolver } from './resolvers';


// apply this middleware to all es types' data/aggregation resolvers
const queryTypeMapping = {};
const aggsTypeMapping = {};
const totalCountTypeMapping = {};
config.esConfig.indices.forEach((item) => {
  queryTypeMapping[item.type] = tierAccessResolver({
    isRawDataQuery: true,
    esType: item.type,
    esIndex: item.index,
  });
  aggsTypeMapping[item.type] = tierAccessResolver({ esType: item.type, esIndex: item.index });
  const aggregationName = `${firstLetterUpperCase(item.type)}Aggregation`;
  totalCountTypeMapping[aggregationName] = {
    _totalCount: hideNumberResolver(true),
  };
});
const tierAccessMiddleware = {
  Query: {
    ...queryTypeMapping,
  },
  Aggregation: {
    ...aggsTypeMapping,
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
