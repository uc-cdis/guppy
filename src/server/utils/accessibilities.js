import _ from 'lodash';
import { textAggregation } from '../es/aggs';
import esInstance from '../es/index';
import { addTwoFilters } from './utils';
import arboristClient from '../middlewares/authMiddleware/arboristClient';
import CodedError from './error';
import log from '../logger';
import config from '../config';

const getAccessibleResourcesFromArborist = async (jwt) => {
  let data;
  if (config.internalLocalTest) {
    data = {
      resources: [ // these are just for testing
        '/programs/DEV/projects/test',
        '/programs/jnkns/projects/jenkins',
      ],
    };
  } else {
    data = await arboristClient.listAuthorizedResources(jwt);
  }

  log.debug('[authMiddleware] list resources: ', JSON.stringify(data, null, 4));
  if (data && data.error) {
    throw new CodedError(data.error.code, data.error.message);
  }
  const resources = data.resources ? _.uniq(data.resources) : [];
  return resources;
};

const getRequestResourceListFromFilter = async (esIndex, esType, filter) => textAggregation(
  { esInstance, esIndex, esType },
  { field: config.esConfig.authFilterField, filter },
).then(res => (res.map(item => item.key)));

const buildFilterWithResourceList = (resourceList = []) => {
  const filter = {
    IN: {
      [config.esConfig.authFilterField]: [...resourceList],
    },
  };
  return filter;
};

export const applyAccessibleFilter = async (jwt, parsedFilter) => {
  // if mock arborist endpoint, just skip auth middleware
  if (!config.internalLocalTest) {
    if (config.arboristEndpoint === 'mock') {
      log.debug('[authMiddleware] using mock arborist endpoint, skip auth middleware');
      return parsedFilter;
    }
  }

  // asking arborist for auth resource list, and add to filter args
  const resources = await getAccessibleResourcesFromArborist(jwt);
  const authPart = buildFilterWithResourceList(resources);
  const appliedFilter = addTwoFilters(parsedFilter, authPart);
  return appliedFilter;
};

export const getOutOfScopeResourceList = async (jwt, esIndex, esType, filter) => {
  log.debug('[tierAccessResolver] filter: ', JSON.stringify(filter, null, 4));
  const requestResourceList = await getRequestResourceListFromFilter(esIndex, esType, filter);
  log.debug(`[tierAccessResolver] request resource list: [${requestResourceList.join(', ')}]`);
  const accessibleResourcesList = await getAccessibleResourcesFromArborist(jwt);
  log.debug(`[tierAccessResolver] accessable resource list: [${accessibleResourcesList.join(', ')}]`);
  // compare resources with JWT
  const outOfScopeResourceList = _.difference(requestResourceList, accessibleResourcesList);
  log.debug(`[tierAccessResolver] out-of-scope resource list: [${outOfScopeResourceList.join(', ')}]`);
  return outOfScopeResourceList;
};

export const getDefaultFilter = async (jwt, accessibility = 'all') => {
  if (accessibility === 'all') {
    return {};
  }
  if (accessibility === 'accessible') {
    const resources = await getAccessibleResourcesFromArborist(jwt);
    return buildFilterWithResourceList(resources);
  }
  if (accessibility === 'unaccessible') {
    const resources = await getOutOfScopeResourceList(jwt);
    return buildFilterWithResourceList(resources);
  }
  throw new Error(`Invalid accessibility argument: ${accessibility}`);
};
