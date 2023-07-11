import _ from 'lodash';
import assert from 'assert';
import { ApolloError, UserInputError } from 'apollo-server';
import log from '../../logger';
import config from '../../config';
import esInstance from '../../es/index';
import CodedError from '../../utils/error';
import { isWhitelisted, addTwoFilters } from '../../utils/utils';

const ENCRYPT_COUNT = -1;

const resolverWithAccessibleFilterApplied = (
  resolve,
  root,
  args,
  context,
  info,
  authHelper,
  filter,
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
  resolve,
  root,
  args,
  context,
  info,
  authHelper,
  filter,
) => {
  const appliedFilter = authHelper.applyUnaccessibleFilter(filter);
  const newArgs = {
    ...args,
    filter: appliedFilter,
    needEncryptAgg: true,
  };
  return resolve(root, newArgs, context, info);
};

export const tierAccessResolver = (
  {
    isRawDataQuery,
    esType,
    esIndex,
  },
) => async (resolve, root, args, context, info) => {
  try {
    // Assert that either this index is "regular" access or
    // that the index has no setting and site-wide config is "regular".
    const indexConfig = esInstance.getESIndexConfigByName(esIndex);
    const indexIsRegularAccess = indexConfig.tier_access_level === 'regular';
    const siteIsRegularAccess = config.tierAccessLevel === 'regular';
    assert(indexIsRegularAccess || siteIsRegularAccess, 'Tier access middleware layer only for "regular" tier access level');

    const { authHelper } = context;
    const { filter, filterSelf, accessibility } = args;

    const outOfScopeResourceList = await authHelper.getOutOfScopeResourceList(
      esIndex,
      esType,
      filter,
      filterSelf,
    );
    // if requesting resources is within allowed resources, return result
    if (outOfScopeResourceList.length === 0) {
      // unless it's requesting for `unaccessible` data, just resolve this
      switch (accessibility) {
        case 'accessible':
          return resolve(root, { ...args, needEncryptAgg: false }, context, info);
        case 'unaccessible':
          return resolverWithUnaccessibleFilterApplied(
            resolve,
            root,
            args,
            context,
            info,
            authHelper,
            filter,
          );
        default:
          return resolve(root, { ...args, needEncryptAgg: true }, context, info);
      }
    }
    // else, check if it's raw data query or aggs query
    if (isRawDataQuery) { // raw data query for out-of-scope resources are forbidden
      if (accessibility === 'accessible') {
        return resolverWithAccessibleFilterApplied(
          resolve,
          root,
          args,
          context,
          info,
          authHelper,
          filter,
        );
      }
      log.info('[tierAccessResolver] requesting out-of-scope resources, return 401');
      log.info(`[tierAccessResolver] the following resources are out-of-scope: [${outOfScopeResourceList.join(', ')}]`);
      throw new ApolloError('You don\'t have access to all the data you are querying. Try using \'accessibility: accessible\' in your query', 401);
    }

    /**
     * Here we have a bypass for `regular`-tier-access-leveled commons:
     * `accessibility` has 3 options: `all`, `accessible`, and `unaccessible`.
     * For `all`, behavior is the same as usual
     * For `accessible`, we will apply auth filter on top of filter argument
     * For `unaccessible`, we apply unaccessible filters on top of filter argument
     */
    const sensitiveRecordExclusionEnabled = !!config.tierAccessSensitiveRecordExclusionField;
    if (accessibility === 'all') {
      if (sensitiveRecordExclusionEnabled) {
        // Sensitive study exclusion is enabled: For all of the projects user does
        // not have access to, hide the studies marked 'sensitive' from the aggregation.
        // (See doc/queries.md#Tiered_Access_sensitive_record_exclusion)
        const projectsUserHasAccessTo = authHelper.getAccessibleResources();
        const sensitiveStudiesFilter = {
          OR: [
            {
              IN: {
                [config.esConfig.authFilterField]: projectsUserHasAccessTo,
              },
            },
            {
              '!=': {
                [config.tierAccessSensitiveRecordExclusionField]: 'true',
              },
            },
          ],
        };
        return resolve(
          root,
          {
            ...args,
            filter: addTwoFilters(filter, sensitiveStudiesFilter),
            needEncryptAgg: true,
          },
          context,
          info,
        );
      }

      return resolve(
        root,
        {
          ...args,
          filter,
          needEncryptAgg: true,
        },
        context,
        info,
      );
    }
    if (accessibility === 'accessible') {
      // We do not need to apply sensitive studies filter here, because
      // user has access to all of these projects.
      log.debug('[tierAccessResolver] applying "accessible" to resolver');
      return resolverWithAccessibleFilterApplied(
        resolve,
        root,
        args,
        context,
        info,
        authHelper,
        filter,
      );
    }
    // The below code executes if accessibility === 'unaccessible'.
    if (sensitiveRecordExclusionEnabled) {
      // Apply sensitive studies filter. Hide the studies marked 'sensitive' from
      // the aggregation.
      const sensitiveStudiesFilter = {
        '!=': {
          [config.tierAccessSensitiveRecordExclusionField]: 'true',
        },
      };
      return resolverWithUnaccessibleFilterApplied(
        resolve,
        root,
        args,
        context,
        info,
        authHelper,
        addTwoFilters(filter, sensitiveStudiesFilter),
      );
    }
    return resolverWithUnaccessibleFilterApplied(
      resolve,
      root,
      args,
      context,
      info,
      authHelper,
      filter,
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
export const hideNumberResolver = (isGettingTotalCount) => async (
  resolve,
  root,
  args,
  context,
  info,
) => {
  // for aggregations, hide all counts that are greater than limited number
  const { needEncryptAgg } = root;
  const result = await resolve(root, args, context, info);
  log.debug('[hideNumberResolver] result: ', result);
  if (!needEncryptAgg) return result;

  const newRoot = root;
  newRoot.accessibility = 'unaccessible';
  const { authHelper } = context;
  newRoot.filter = authHelper.applyUnaccessibleFilter(newRoot.filter);
  const unaccessibleResult = await resolve(newRoot, args, context, info);
  log.debug('[hideNumberResolver] unaccessibleResult: ', unaccessibleResult);

  // if getting total count, only encrypt if unaccessibleResult is between (0, tierAccessLimit)
  if (isGettingTotalCount) {
    return (unaccessibleResult > 0
      && unaccessibleResult < config.tierAccessLimit) ? ENCRYPT_COUNT : result;
  }

  const encryptedResult = result.map((item) => {
    // we don't encrypt whitelisted results or if result is not found in unaccessibleResult
    if (isWhitelisted(item.key) || !(unaccessibleResult.some((e) => e.key === item.key))) {
      return item;
    }
    // we only encrypt if count from no-access item is small
    const unaccessibleResultItem = _.find(unaccessibleResult, (e) => e.key === item.key);
    if (unaccessibleResultItem.count < config.tierAccessLimit) {
      return {
        key: item.key,
        count: ENCRYPT_COUNT,
      };
    }
    return item;
  });
  return encryptedResult;
};
