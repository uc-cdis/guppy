import _ from 'lodash';
import log from '../logger';
import { textAggregation } from '../es/aggs';
import esInstance from '../es/index';
import arboristClient from './arboristClient';
import CodedError from '../utils/error';
import config from '../config';

export const getAccessibleResourcesFromArboristasync = async (jwt) => {
  let data;
  if (config.internalLocalTest) {
    data = {
      resources: [ // these are just for testing
        '/programs/DEV/projects/test',
        '/programs/jnkns/projects/jenkins',
      ],
    };
  } else {
    data = await arboristClient.listAuthMapping(jwt);
  }

  log.debug('[authMiddleware] list resources: ', JSON.stringify(data, null, 4));
  if (data && data.error) {
    // if user is not in arborist db, assume has no access to any
    if (data.error.code === 404) {
      return [];
    }
    throw new CodedError(data.error.code, data.error.message);
  }

  read = resourcePathsWithServiceMethodCombination(data, ['guppy', '*'], ['read', '*']);
  const read_resources = data.resources ? _.uniq(data.resources) : [];
  return read_resources, data;
};

export const checkIfUserCanRefreshServer = async (data) => {
  if (config.internalLocalTest) {
    data = {
      resources: [ // these are just for testing
        '/programs/DEV/projects/test',
        '/programs/jnkns/projects/jenkins',
      ],
    };
  }

  log.debug('[authMiddleware] list resources: ', JSON.stringify(data, null, 4));
  if (data && data.error) {
    // if user is not in arborist db, assume has no access to any
    if (data.error.code === 404) {
      return false;
    }
    throw new CodedError(data.error.code, data.error.message);
  }
  data = resourcePathsWithServiceMethodCombination(data, ['guppy'], ['admin_access', '*']);

  // Only guppy_admin resource path can control guppy admin access
  return data.resources ? data.resources.includes('/guppy_admin') : false;
};

export const getRequestResourceListFromFilter = async (
  esIndex,
  esType,
  filter,
  filterSelf,
) => textAggregation(
  { esInstance, esIndex, esType },
  { field: config.esConfig.authFilterField, filter, filterSelf },
).then((res) => (res.map((item) => item.key)));

export const buildFilterWithResourceList = (resourceList = []) => {
  const filter = {
    IN: {
      [config.esConfig.authFilterField]: [...resourceList],
    },
  };
  return filter;
};

export const resourcePathsWithServiceMethodCombination = (userAuthMapping, services, methods = {}) => {
  const data = {
    resources: [],
  };
  Object.keys(userAuthMapping).forEach((key) => {
  // logic: you have access to a project if you have
  // access to any of the combinations made by the method and service lists
    if (userAuthMapping[key] && userAuthMapping[key].some((x) => (
      methods.includes(x.method)
        && services.includes(x.service)
    ))) {
      data.resources.push(key);
    }
  });
  return data;
};
