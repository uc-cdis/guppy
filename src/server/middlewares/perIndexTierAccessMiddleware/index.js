import config from '../../config';
import { firstLetterUpperCase } from '../../utils/utils';
import authMWResolver from '../authMiddleware/resolvers';
import { tierAccessResolver, hideNumberResolver } from '../tierAccessMiddleware/resolvers';

const queryTypeMapping = {};
const aggsTypeMapping = {};
const totalCountTypeMapping = {};
let atLeastOneIndexIsRegularAccess = false;

config.esConfig.indices.forEach((item) => {
  if (item.tier_access_level === 'private') {
    queryTypeMapping[item.type] = authMWResolver;
    aggsTypeMapping[item.type] = authMWResolver;
  } else if (item.tier_access_level === 'regular') {
    atLeastOneIndexIsRegularAccess = true;
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
  }
  // No additional resolvers necessary for tier_access_level == 'libre'
}, {});

const perIndexTierAccessMiddleware = {
  Query: {
    ...queryTypeMapping,
  },
  Aggregation: {
    ...aggsTypeMapping,
  },
  ...totalCountTypeMapping,
};

if (atLeastOneIndexIsRegularAccess) {
  perIndexTierAccessMiddleware.RegularAccessHistogramForNumber = {
    histogram: hideNumberResolver(false),
  };

  perIndexTierAccessMiddleware.RegularAccessHistogramForString = {
    histogram: hideNumberResolver(false),
  };
}

export default perIndexTierAccessMiddleware;
