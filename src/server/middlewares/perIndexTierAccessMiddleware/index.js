import config from '../../config';
import { firstLetterUpperCase } from '../../utils/utils';
import authMWResolver from '../authMiddleware/resolvers';
import { tierAccessResolver, hideNumberResolver } from '../tierAccessMiddleware/resolvers';

const queryTypeMapping = {};
const aggsTypeMapping = {};
const totalCountTypeMapping = {};

config.esConfig.indices.forEach((item) => {
  if (item.tier_access_level === 'private') {
    queryTypeMapping[item.type] = authMWResolver;
    aggsTypeMapping[item.type] = authMWResolver;
  } else if (item.tier_access_level === 'regular') {
    queryTypeMapping[item.type] = tierAccessResolver({
      isRawDataQuery: true,
      esType: item.type,
      esIndex: item.type,
    });
    aggsTypeMapping[item.type] = tierAccessResolver({ esType: item.type, esIndex: item.type });
    const aggregationName = `${firstLetterUpperCase(item.type)}Aggregation`;
    totalCountTypeMapping[aggregationName] = {
      _totalCount: hideNumberResolver(true),
    };
  } else if (item.tier_access_level === 'libre') {
    // No additional resolvers necessary
  } else {
    throw new Error(`tier_access_level invalid for index ${item.type}. Either set all index-scoped tiered-access levels or a site-wide tiered-access level.`);
  }
}, {});

const perIndexTierAccessMiddleware = {
  Query: {
    ...queryTypeMapping,
  },
  Aggregation: {
    ...aggsTypeMapping,
  },
  ...totalCountTypeMapping,
  RegularAccessHistogramForNumber: {
    histogram: hideNumberResolver(false),
  },
  RegularAccessHistogramForString: {
    histogram: hideNumberResolver(false),
  },
};

export default perIndexTierAccessMiddleware;
