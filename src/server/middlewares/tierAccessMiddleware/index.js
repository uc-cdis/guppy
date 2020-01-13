import assert from 'assert';
import { ApolloError, UserInputError } from 'apollo-server';
import log from '../../logger';
import config from '../../config';
import esInstance from '../../es/index';
import CodedError from '../../utils/error';
import { firstLetterUpperCase, isWhitelisted } from '../../utils/utils';

const ENCRYPT_COUNT = -1;

const resolverWithAccessibleFilterApplied = (
  resolve, root, args, context, info, authHelper, filter,
) => {
  const appliedFilter = authHelper.applyAccessibleFilter(filter);
  const newArgs = {
    ...args,
    filter: appliedFilter,
    needEncryptAgg: false,
  };
  return resolve(root, newArgs, context, info);
};

const resolverWithUnaccessibleFilterApplied = (
  resolve, root, args, context, info, authHelper, filter,
) => {
  const appliedFilter = authHelper.applyUnaccessibleFilter(filter);
  const newArgs = {
    ...args,
    filter: appliedFilter,
    needEncryptAgg: true,
  };
  return resolve(root, newArgs, context, info);
};

const tierAccessResolver = (
  {
    isRawDataQuery,
    esType,
  },
) => async (resolve, root, args, context, info) => {
  log.info('[yeah] entered tieraccessresolver 53');
  console.log('[yeah] entered tieraccessresolver 53');
  try {
    assert(config.tierAccessLevel === 'regular', 'Tier access middleware layer only for "regular" tier access level');
    const { authHelper } = context;
    const esIndex = esInstance.getESIndexByType(esType);
    const { filter, accessibility } = args;
    log.info('[yeah] 59 filter: ', JSON.stringify(filter));

    const outOfScopeResourceList = await authHelper.getOutOfScopeResourceList(
      esIndex, esType, filter,
    );
    log.info('[yeah] 63');
    // if requesting resources is within allowed resources, return result
    if (outOfScopeResourceList.length === 0) {
      // unless it's requesting for `unaccessible` data, just resolve this
      if (accessibility !== 'unaccessible') {
        log.info('[yeah] 67');
        return resolve(root, { ...args, needEncryptAgg: false }, context, info);
      }
      log.info('[yeah] 70');
      return resolverWithUnaccessibleFilterApplied(
        resolve, root, args, context, info, authHelper, filter,
      );
    }
    // else, check if it's raw data query or aggs query
    if (isRawDataQuery) { // raw data query for out-of-scope resources are forbidden
      if (accessibility === 'accessible') {
        log.info('[yeah] 78');
        return resolverWithAccessibleFilterApplied(
          resolve, root, args, context, info, authHelper, filter,
        );
      }
      log.debug('[tierAccessResolver] requesting out-of-scope resources, return 401');
      throw new ApolloError(`You don't have access to following resources: \
        [${outOfScopeResourceList.join(', ')}]`, 401);
    }
    log.info('[yeah] 88');

    /**
     * Here we have a bypass for `regular`-tier-access-leveled commons:
     * `accessibility` has 3 options: `all`, `accessible`, and `unaccessible`.
     * For `all`, behavior is the same as usual
     * For `accessible`, we will apply auth filter on top of filter argument
     * For `unaccessible`, we apply unaccessible filters on top of filter argument
     */
    log.info('[cool] guppy server line 91 with filter: ', JSON.stringify(filter));
    if (accessibility == 'all' || accessibility == 'unaccessible') {
      // This is specifically the case where 
      // the user is requesting aggregate counts (not a raw query)
      // and the out-of-scope resource list is non-zero
      
      log.info('[cool] going to modify the filter!');
      
      let projectsUserHasAccessTo = authHelper.getAccessibleResources();
      
      log.info('[cool] got projects from user: ', JSON.stringify(projectsUserHasAccessTo));

      let filterAndList = filter["AND"] || [];
      
      // {"AND":[{"IN":{"carotid_plaque":["Plaque not present"]}},{"IN":{"carotid_stenosis":["75%-99%"]}}]}
      
      filterAndList.push( { "IN" : { "sensitive_study": [ "false" ] } } );
      filterAndList.push( { "IN" : { "project_id": projectsUserHasAccessTo } } );
      filter["AND"] = filterAndList;
      

      // getUnaccessibleResources()
      // filter: ( sensitive = false && have project id in the list of projects the user has access to)
      // filter = modifyFilter();
    }
    log.info('[yeah] guppy server line 95 with filter: ', JSON.stringify(filter));

    if (accessibility === 'all') {
      return resolve(root, { ...args, needEncryptAgg: true }, context, info);
    }
    if (accessibility === 'accessible') {
      log.debug('[tierAccessResolver] applying "accessible" to resolver');
      return resolverWithAccessibleFilterApplied(
        resolve, root, args, context, info, authHelper, filter,
      );
    }
    return resolverWithUnaccessibleFilterApplied(
      resolve, root, args, context, info, authHelper, filter,
    );
  } catch (err) {
    if (err instanceof ApolloError) {
      if (err.extensions.code >= 500) {
        console.trace(err); // eslint-disable-line no-console
      }
    } else if (err instanceof CodedError) {
      if (err.code >= 500) {
        console.trace(err); // eslint-disable-line no-console
      }
    } else if (!(err instanceof UserInputError)) {
      console.trace(err); // eslint-disable-line no-console
    }
    throw err;
  }
};

/**
 * This resolver middleware is appended after aggregation resolvers,
 * it hide number that is less than allowed visible number for regular tier access
 * @param {bool} isGettingTotalCount
 */
const hideNumberResolver = isGettingTotalCount => async (resolve, root, args, context, info) => {
  // for aggregations, hide all counts that are greater than limited number
  const { needEncryptAgg } = root;
  const result = await resolve(root, args, context, info);
  if (!needEncryptAgg) return result;
  if (isGettingTotalCount) {
    return (result < config.tierAccessLimit) ? ENCRYPT_COUNT : result;
  }

  const encryptedResult = result.map((item) => {
    if (isWhitelisted(item.key)) { // we don't encrypt whitelisted results
      return item;
    }
    if (item.count < config.tierAccessLimit) {
      return {
        key: item.key,
        count: ENCRYPT_COUNT,
      };
    }
    return item;
  });
  return encryptedResult;
};

// apply this middleware to all es types' data/aggregation resolvers
const queryTypeMapping = {};
const aggsTypeMapping = {};
const totalCountTypeMapping = {};
config.esConfig.indices.forEach((item) => {
  console.log('[yeah] esConfig ', JSON.stringify(item));
  log.info('[yeah] esConfig ', JSON.stringify(item));
  queryTypeMapping[item.type] = tierAccessResolver({
    isRawDataQuery: true,
    esType: item.type,
  });
  aggsTypeMapping[item.type] = tierAccessResolver({ esType: item.type });
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
