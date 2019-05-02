import assert from 'assert';
import { ApolloError, UserInputError } from 'apollo-server';
import log from '../../logger';
import config from '../../config';
import esInstance from '../../es/index';
import CodedError from '../../utils/error';
import { firstLetterUpperCase, addTwoFilters } from '../../utils/utils';
import { getOutOfScopeResourceList, applyAccessibleFilter } from '../../utils/accessibilities';

const ENCRYPT_COUNT = -1;

const resolverWithAccessibleFilterApplied = async (
  resolve, root, args, context, info, jwt, filter,
) => {
  const appliedFilter = await applyAccessibleFilter(jwt, filter);
  const newArgs = {
    ...args,
    filter: appliedFilter,
    needEncryptAgg: false,
  };
  if (typeof newArgs.filter === 'undefined') {
    delete newArgs.filter;
  }
  return resolve(root, newArgs, context, info);
};

const resolverWithUnaccessibleFilterApplied = async (
  resolve, root, args, context, info, jwt, esIndex, esType, filter,
) => {
  const outOfScopeResourceList = await getOutOfScopeResourceList(jwt, esIndex, esType, filter);
  const outOfScopeFilter = {
    IN: {
      [config.esConfig.authFilterField]: [...outOfScopeResourceList],
    },
  };
  const appliedFilter = addTwoFilters(outOfScopeFilter, filter);
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
  try {
    assert(config.tierAccessLevel === 'regular', 'Tier access middleware layer only for "regular" tier access level');
    const { jwt } = context;
    const esIndex = esInstance.getESIndexByType(esType);
    const { filter, accessibility } = args;

    const outOfScopeResourceList = await getOutOfScopeResourceList(jwt, esIndex, esType, filter);
    // if requesting resources is within allowed resources, return result
    if (outOfScopeResourceList.length === 0) {
      return resolve(root, { ...args, needEncryptAgg: false }, context, info);
    }
    // else, check if it's raw data query or aggs query
    if (isRawDataQuery) { // raw data query for out-of-scope resources are forbidden
      log.debug('[tierAccessResolver] requesting out-of-scope resources, return 401');
      throw new ApolloError(`You don't have access to following ${config.esConfig.projectField}s: \
        [${outOfScopeResourceList.join(', ')}]`, 401);
    }

    /**
     * Here we have a bypass for `regular`-tier-access-leveled commons:
     * `accessibility` has 3 options: `all`, `accessible`, and `unaccessible`.
     * For `all`, behavior is the same as usual
     * For `accessible`, we will apply auth filter on top of filter argument
     * For `unaccessible`, we apply unaccessible filters on top of filter argument
     */
    if (accessibility === 'all') {
      return resolve(root, { ...args, needEncryptAgg: true }, context, info);
    }
    if (accessibility === 'accessible') {
      log.debug('[tierAccessResolver] applying "accessible" to resolver');
      return resolverWithAccessibleFilterApplied(
        resolve, root, args, context, info, jwt, filter,
      );
    }
    return resolverWithUnaccessibleFilterApplied(
      resolve, root, args, context, info, jwt, esIndex, esType, filter,
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
 * This resolver middleware is appended after aggreagtion resolvers,
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
