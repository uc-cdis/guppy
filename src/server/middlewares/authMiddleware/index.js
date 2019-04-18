import _ from 'lodash';
import log from '../../logger';
import config from '../../config';
import arboristClient from './arboristClient';
import CodedError from '../../utils/error';

export const applyAuthFilter = async (jwt, parsedFilter) => {
  // if mock arborist endpoint, just skip auth middleware
  if (config.arboristEndpoint === 'mock') {
    log.debug('[authMiddleware] using mock arborist endpoint, skip auth middleware');
    return parsedFilter;
  }

  // asking arborist for auth resource list, and add to filter args
  const data = await arboristClient.listAuthorizedResources(jwt);
  log.debug('[authMiddleware] list resources: ');
  log.rawOutput(data);
  if (data && data.error) {
    throw new CodedError(data.error.code, data.error.message);
  }
  const resources = data.resources ? _.uniq(data.resources) : [];
  log.debug('[authMiddleware] add limitation for field ', config.esConfig.authFilterField, ' within resources: ', resources);
  const authPart = {
    IN: {
      [config.esConfig.authFilterField]: [...resources],
    },
  };
  const appliedFilter = parsedFilter ? {
    AND: [
      parsedFilter,
      authPart,
    ],
  } : authPart;
  return appliedFilter;
};

const authMWResolver = async (resolve, root, args, context, info) => {
  const { jwt } = context;

  // if mock arborist endpoint, just skip auth middleware
  if (config.arboristEndpoint === 'mock') {
    log.debug('[authMiddleware] using mock arborist endpoint, skip auth middleware');
    return resolve(root, args, context, info);
  }

  // asking arborist for auth resource list, and add to filter args
  const parsedFilter = args.filter;
  const appliedFilter = await applyAuthFilter(jwt, parsedFilter);
  const newArgs = {
    ...args,
    filter: appliedFilter,
  };
  if (typeof newArgs.filter === 'undefined') {
    delete newArgs.filter;
  }
  return resolve(root, newArgs, context, info);
};

// apply this middleware to all es types' data/aggregation resolvers
const typeMapping = config.esConfig.indices.reduce((acc, item) => {
  acc[item.type] = authMWResolver;
  return acc;
}, {});
const authMiddleware = {
  Query: {
    ...typeMapping,
  },
  Aggregation: {
    ...typeMapping,
  },
};

export default authMiddleware;
