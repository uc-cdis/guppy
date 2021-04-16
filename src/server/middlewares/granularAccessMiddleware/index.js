import config from '../../config';
import { firstLetterUpperCase } from '../../utils/utils';
import { granularAccessResolver, granularHideNumberResolver } from './resolvers';


// apply this middleware to all es types' data/aggregation resolvers
const queryTypeMapping = {};
const aggsTypeMapping = {};
const totalCountTypeMapping = {};
config.esConfig.indices.forEach((item) => {
  queryTypeMapping[item.type] = granularAccessResolver({
    isRawDataQuery: true,
    esType: item.type,
    esIndex: item.index,
  });
  aggsTypeMapping[item.type] = granularAccessResolver({ esType: item.type, esIndex: item.index });
  const aggregationName = `${firstLetterUpperCase(item.type)}Aggregation`;
  totalCountTypeMapping[aggregationName] = {
    _totalCount: granularHideNumberResolver(true),
  };
});
const granularAccessMiddleware = {
  Query: {
    ...queryTypeMapping,
  },
  Aggregation: {
    ...aggsTypeMapping,
  },
  ...totalCountTypeMapping,
  HistogramForNumber: {
    histogram: granularHideNumberResolver(false),
  },
  HistogramForString: {
    histogram: granularHideNumberResolver(false),
  },
};

export default granularAccessMiddleware;
