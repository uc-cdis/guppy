import _ from 'lodash';
import { addTwoFilters } from '../utils/utils';
import log from '../logger';
import {
  getRequestResourceListFromFilter,
  buildFilterWithResourceList,
  getAccessibleResourcesFromArboristasync,
} from './utils';
import config from '../config';

class AuthHelper {
  constructor(jwt) {
    this._jwt = jwt;
  }

  async initialize() {
    try {
      this._accessibleResourceList = await getAccessibleResourcesFromArboristasync(this._jwt);
      const promistList = [];
      config.esConfig.indices.forEach(({ index, type }) => {
        const subListPromise = this.getOutOfScopeResourceList(index, type);
        promistList.push(subListPromise);
      });
      this._unaccessibleResourceList = [];
      const listResult = await Promise.all(promistList);
      listResult.forEach((list) => {
        this._unaccessibleResourceList = _.union(this._unaccessibleResourceList, list);
      });
      log.debug('[AuthHelper] accessible resources: ', this._accessibleResourceList);
      log.debug('[AuthHelper] unaccessible resources: ', this._unaccessibleResourceList);
    } catch (err) {
      log.error('[Auth] error when initializing');
    }
  }

  getAccessibleResources() {
    return this._accessibleResourceList;
  }

  getUnaccessibleResources() {
    return this._unaccessibleResourceList;
  }

  async getOutOfScopeResourceList(esIndex, esType, filter) {
    const requestResourceList = await getRequestResourceListFromFilter(
      esIndex, esType, filter,
    );
    log.debug(`[tierAccessResolver] request resource list: [${requestResourceList.join(', ')}]`);
    const outOfScopeResourceList = _.difference(requestResourceList, this._accessibleResourceList);
    log.debug(`[tierAccessResolver] out-of-scope resource list: [${outOfScopeResourceList.join(', ')}]`);
    return outOfScopeResourceList;
  }

  applyAccessibleFilter(filter) {
    const accessiblePart = buildFilterWithResourceList(this._accessibleResourceList);
    const appliedFilter = addTwoFilters(filter, accessiblePart);
    return appliedFilter;
  }

  applyUnaccessibleFilter(filter) {
    const accessiblePart = buildFilterWithResourceList(this._unaccessibleResourceList);
    const appliedFilter = addTwoFilters(filter, accessiblePart);
    return appliedFilter;
  }

  getDefaultFilter(accessibility) {
    if (accessibility === 'all') {
      return {};
    }
    if (accessibility === 'accessible') {
      return this.applyAccessibleFilter();
    }
    if (accessibility === 'unaccessible') {
      return this.applyUnaccessibleFilter();
    }
    throw new Error(`Invalid accessibility argument: ${accessibility}`);
  }
}

const getAuthHelperInstance = async (jwt) => {
  const authHelper = new AuthHelper(jwt);
  await authHelper.initialize();
  return authHelper;
};

export default getAuthHelperInstance;
