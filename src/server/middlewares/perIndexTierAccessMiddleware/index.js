import config from '../../config';
import { firstLetterUpperCase } from '../../utils/utils';
import authMWResolver from '../authMiddleware/resolvers';
import { tierAccessResolver, hideNumberResolver } from '../tierAccessMiddleware/resolvers';

const queryIndexMapping = {};
const aggsIndexMapping = {};
const histogramIndexMapping = {};
const histogramForStringIndexMapping = {};
const totalCountIndexMapping = {};

config.esConfig.indices.reduce((acc, item) => {
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
    totalCountIndexMapping[aggregationName] = {
      _totalCount: hideNumberResolver(true),
    };
    histogramIndexMapping[item.index] = { histogram: hideNumberResolver(false) };
    histogramForStringIndexMapping[item.index] = { histogram: hideNumberResolver(false) };
  } else if (item.tier_access_level === 'libre') {
    // No additional resolvers necessary
  } else {
    throw new Error(`tier_access_level invalid for index ${item.index}. Please set index-scoped or site-wide tiered-access levels.`);
  }
  return acc;
}, {});

const perIndexTierAccessMiddleware = {
  Query: {
    ...queryIndexMapping,
  },
  Aggregation: {
    ...aggsIndexMapping,
  },
  ...totalCountIndexMapping,
  HistogramForNumber: {
    ...histogramIndexMapping,
  },
  HistogramForString: {
    ...histogramForStringIndexMapping,
  },
};

export default perIndexTierAccessMiddleware;
