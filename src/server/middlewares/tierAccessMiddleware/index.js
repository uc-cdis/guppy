import _ from 'lodash';
import assert from 'assert';
import { ApolloError, UserInputError } from 'apollo-server';
import { parseResolveInfo } from 'graphql-parse-resolve-info';
import log from '../../logger';
import config from '../../config';
import { parseValuesFromFilter } from '../../es/filter';
import { textAggregation } from '../../es/aggs';
import esInstance from '../../es/index';
import { getAccessableResources, applyAuthFilter } from '../authMiddleware';
import CodedError from '../../utils/error';
import { firstLetterUpperCase } from '../../utils/utils';

/**
 * This function parses all requesting keys under aggregation query,
 * and check if keys contains '_totalCount'
 * @param {object} resolveInfo - info argument from resolver function
 * @returns {bool} is querying _totalCount
 */
const isQueryingTotalCount = (resolveInfo) => {
  const parsedInfo = parseResolveInfo(resolveInfo);
  const aggTypeName = `${firstLetterUpperCase(parsedInfo.name)}Aggregation`;
  const queryKeysUnderAggs = Object.keys(parsedInfo.fieldsByTypeName[aggTypeName]);
  return queryKeysUnderAggs.includes('_totalCount');
};

export const getRequestResourceListFromFilter = async (esIndex, esType, filter) => {
  let resourceList;
  if (filter) {
    resourceList = parseValuesFromFilter(filter, config.esConfig.resourceField);
    if (resourceList && resourceList.length > 0) {
      return Promise.resolve(resourceList);
    }
  }
  return textAggregation(
    { esInstance, esIndex, esType },
    { field: config.esConfig.resourceField },
  ).then(res => (res.map(item => item.key)));
};

const getOutOfScopeResourceList = async (jwt, esIndex, esType, filter) => {
  log.debug('[tierAccessResolver] filter: ', JSON.stringify(filter, null, 4));
  const requestResourceList = await getRequestResourceListFromFilter(esIndex, esType, filter);
  log.debug(`[tierAccessResolver] request resource list: [${requestResourceList.join(', ')}]`);
  const accessableResourcesList = await getAccessableResources(jwt);
  log.debug(`[tierAccessResolver] accessable resource list: [${accessableResourcesList.join(', ')}]`);
  // compare resources with JWT
  const outOfScopeResourceList = _.difference(requestResourceList, accessableResourcesList);
  log.debug(`[tierAccessResolver] out-of-scope resource list: [${outOfScopeResourceList.join(', ')}]`);
  return outOfScopeResourceList;
};

const ENCRYPT_COUNT = -1;

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
    const { filter, useTierAccessLevel } = args;

    const outOfScopeResourceList = await getOutOfScopeResourceList(jwt, esIndex, esType, filter);
    // if requesting resources is within allowed resources, return result
    if (outOfScopeResourceList.length === 0) {
      return resolve(root, args, context, info);
    }
    // else, check if it's raw data query or aggs query
    if (isRawDataQuery) { // raw data query for out-of-scope resources are forbidden
      log.debug('[tierAccessResolver] requesting out-of-scope resources, return 401');
      throw new ApolloError(`You don't have access to following ${config.esConfig.resourceField}s: \
        [${outOfScopeResourceList.join(', ')}]`, 401);
    }
    if (useTierAccessLevel) {
      // here we have a bypass if front-end want aggregation using private level access.
      // for regular commons, only allow more secured level queries, i.e. "private"
      assert(useTierAccessLevel === 'private');
      log.debug('[tierAccessResolver] using private level access');
      const appliedFilter = await applyAuthFilter(jwt, filter);
      const newArgs = {
        ...args,
        filter: appliedFilter,
      };
      if (typeof newArgs.filter === 'undefined') {
        delete newArgs.filter;
      }
      return resolve(root, newArgs, context, info);
    }

    const result = await resolve(root, args, context, info);
    // for aggregations, hide all counts that are greater than limited number
    const isGettingTotalCount = isQueryingTotalCount(info);
    if (isGettingTotalCount) { // TODO
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

// apply this middleware to all es types' data/aggregation resolvers
const queryTypeMapping = {};
const aggsTypeMapping = {};
config.esConfig.indices.forEach((item) => {
  queryTypeMapping[item.type] = tierAccessResolver({
    isRawDataQuery: true,
    esType: item.type,
  });
  aggsTypeMapping[item.type] = tierAccessResolver({ esType: item.type });
});
const tierAccessMiddleware = {
  Query: {
    ...queryTypeMapping,
  },
  Aggregation: {
    ...aggsTypeMapping,
  },
};

export default tierAccessMiddleware;
