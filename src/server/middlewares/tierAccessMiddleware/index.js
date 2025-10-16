import config from '../../config';
import { firstLetterUpperCase, prefixForIndex } from '../../utils/utils';
import { tierAccessResolver, hideNumberResolver } from './resolvers';

// apply this middleware to all es types' data/aggregation resolvers

const tierAccessMiddleware = {};

if (config.esConfig.useNamespace) {
  config.esConfig.indices.forEach((item) => {
    const prefix = prefixForIndex(item);
    const queryTypeMapping = {};
    const aggsTypeMapping = {};
    const totalCountTypeMapping = {};
    queryTypeMapping[`${prefix}_${item.type}`] = tierAccessResolver({
      isRawDataQuery: true,
      esType: item.type,
      esIndex: item.index,
    });
    aggsTypeMapping[item.type] = tierAccessResolver({
      esType: item.type,
      esIndex: item.index,
    });
    const aggregationName = `${prefix}_${firstLetterUpperCase(item.type)}Aggregation`;
    totalCountTypeMapping[aggregationName] = {
      _totalCount: hideNumberResolver(true),
    };

    tierAccessMiddleware['Query'] = { ...queryTypeMapping };
    tierAccessMiddleware[`${prefix}_HistogramForNumber`] = {
      histogram: hideNumberResolver(false),
      asTextHistogram: hideNumberResolver(false),
    };
    tierAccessMiddleware[`${prefix}_HistogramForString`] = {
      histogram: hideNumberResolver(false),
      asTextHistogram: hideNumberResolver(false),
    };
  });
} else {
  const queryTypeMapping = {};
  const aggsTypeMapping = {};
  const totalCountTypeMapping = {};
  config.esConfig.indices.forEach((item) => {
    queryTypeMapping[item.type] = tierAccessResolver({
      isRawDataQuery: true,
      esType: item.type,
      esIndex: item.index,
    });
    aggsTypeMapping[item.type] = tierAccessResolver({
      esType: item.type,
      esIndex: item.index,
    });
    const aggregationName = `${firstLetterUpperCase(item.type)}Aggregation`;
    totalCountTypeMapping[aggregationName] = {
      _totalCount: hideNumberResolver(true),
    };
  });

  tierAccessMiddleware.Query = {
    ...queryTypeMapping,
  };
  tierAccessMiddleware.Aggregation = {
    ...aggsTypeMapping,
  };
  tierAccessMiddleware.HistogramForNumber = {
    histogram: hideNumberResolver(false),
    asTextHistogram: hideNumberResolver(false),
  };
  tierAccessMiddleware.HistogramForString = {
    histogram: hideNumberResolver(false),
    asTextHistogram: hideNumberResolver(false),
  };
  Object.keys(totalCountTypeMapping).forEach((key) => {
    tierAccessMiddleware[key] = totalCountTypeMapping[key];
  });
}

export default tierAccessMiddleware;
