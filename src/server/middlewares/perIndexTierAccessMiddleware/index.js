import config from '../../config';
import { firstLetterUpperCase, prefixForIndex } from '../../utils/utils';
import authMWResolver from '../authMiddleware/resolvers';
import { tierAccessResolver, hideNumberResolver } from '../tierAccessMiddleware/resolvers';

const perIndexTierAccessMiddleware = { Query: {} };
let atLeastOneIndexIsRegularAccess = false;

config.esConfig.indices.forEach((item) => {
  if (config.esConfig.useNamespace) {
    const prefix = prefixForIndex(item);
    // Root Query field is renamed to ${prefix}_${item.type} via RenameRootFields
    const queryField = `${prefix}_${item.type}`;
    // Aggregation type is renamed to ${prefix}_Aggregation via RenameTypes;
    // the field name within the type stays as item.type
    const aggsTypeName = `${prefix}_Aggregation`;

    if (item.tier_access_level === 'private') {
      perIndexTierAccessMiddleware.Query[queryField] = authMWResolver;
      perIndexTierAccessMiddleware[aggsTypeName] = {
        ...perIndexTierAccessMiddleware[aggsTypeName],
        [item.type]: authMWResolver,
      };
    } else if (item.tier_access_level === 'regular') {
      atLeastOneIndexIsRegularAccess = true;
      perIndexTierAccessMiddleware.Query[queryField] = tierAccessResolver({
        isRawDataQuery: true,
        esType: item.type,
        esIndex: item.index,
      });
      perIndexTierAccessMiddleware[aggsTypeName] = {
        ...perIndexTierAccessMiddleware[aggsTypeName],
        [item.type]: tierAccessResolver({ esType: item.type, esIndex: item.index }),
      };
      // ${firstLetterUpperCase(item.type)}Aggregation type is also renamed via RenameTypes
      const totalCountTypeName = `${prefix}_${firstLetterUpperCase(item.type)}Aggregation`;
      perIndexTierAccessMiddleware[totalCountTypeName] = {
        _totalCount: hideNumberResolver(true),
      };
    }
    // No additional resolvers necessary for tier_access_level == 'libre'
  } else {
    if (item.tier_access_level === 'private') {
      perIndexTierAccessMiddleware.Query[item.type] = authMWResolver;
      perIndexTierAccessMiddleware.Aggregation = {
        ...perIndexTierAccessMiddleware.Aggregation,
        [item.type]: authMWResolver,
      };
    } else if (item.tier_access_level === 'regular') {
      atLeastOneIndexIsRegularAccess = true;
      perIndexTierAccessMiddleware.Query[item.type] = tierAccessResolver({
        isRawDataQuery: true,
        esType: item.type,
        esIndex: item.index,
      });
      perIndexTierAccessMiddleware.Aggregation = {
        ...perIndexTierAccessMiddleware.Aggregation,
        [item.type]: tierAccessResolver({ esType: item.type, esIndex: item.index }),
      };
      const aggregationName = `${firstLetterUpperCase(item.type)}Aggregation`;
      perIndexTierAccessMiddleware[aggregationName] = {
        _totalCount: hideNumberResolver(true),
      };
    }
    // No additional resolvers necessary for tier_access_level == 'libre'
  }
});

if (atLeastOneIndexIsRegularAccess) {
  if (config.esConfig.useNamespace) {
    config.esConfig.indices
      .filter((item) => item.tier_access_level === 'regular')
      .forEach((item) => {
        const prefix = prefixForIndex(item);
        perIndexTierAccessMiddleware[`${prefix}_RegularAccessHistogramForNumber`] = {
          histogram: hideNumberResolver(false),
          asTextHistogram: hideNumberResolver(false),
        };
        perIndexTierAccessMiddleware[`${prefix}_RegularAccessHistogramForString`] = {
          histogram: hideNumberResolver(false),
          asTextHistogram: hideNumberResolver(false),
        };
      });
  } else {
    perIndexTierAccessMiddleware.RegularAccessHistogramForNumber = {
      histogram: hideNumberResolver(false),
      asTextHistogram: hideNumberResolver(false),
    };
    perIndexTierAccessMiddleware.RegularAccessHistogramForString = {
      histogram: hideNumberResolver(false),
      asTextHistogram: hideNumberResolver(false),
    };
  }
}

export default perIndexTierAccessMiddleware;
