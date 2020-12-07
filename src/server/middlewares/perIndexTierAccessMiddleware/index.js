import config from '../../config';
import { firstLetterUpperCase } from '../../utils/utils';
import authMWResolver from '../authMiddleware/resolvers';
import { tierAccessResolver, hideNumberResolver } from '../tierAccessMiddleware/resolvers';

const queryIndexMapping = {};
const aggsIndexMapping = {};
const histogramIndexMapping = {};
const histogramForStringIndexMapping = {};
const totalCountTypeMapping = {};

config.esConfig.indices.forEach((item) => {
  if (item.tier_access_level === 'private') {
    queryIndexMapping[item.index] = authMWResolver;
    aggsIndexMapping[item.index] = authMWResolver;
  } else if (item.tier_access_level === 'regular') {
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
    histogramIndexMapping[item.index] = { histogram: hideNumberResolver(false) };
    histogramForStringIndexMapping[item.index] = { histogram: hideNumberResolver(false) };
  } else if (item.tier_access_level === 'libre') {
    // No additional resolvers necessary
  } else {
    throw new Error(`tier_access_level invalid for index ${item.index}. Either set all index-scoped tiered-access levels or a site-wide tiered-access level.`);
  }
}, {});

const perIndexTierAccessMiddleware = {
  Query: {
    ...queryIndexMapping,
  },
  Aggregation: {
    ...aggsIndexMapping,
  },
  ...totalCountTypeMapping,
  HistogramForNumber: {
    ...histogramIndexMapping,
  },
  HistogramForString: {
    ...histogramForStringIndexMapping,
  },
};

export default perIndexTierAccessMiddleware;
