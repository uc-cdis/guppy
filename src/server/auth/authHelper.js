import _ from 'lodash';
import { addTwoFilters } from '../utils/utils';
import log from '../logger';
import {
  getRequestResourceListFromFilter,
  buildFilterWithResourceList,
  getAccessibleResourcesFromArboristasync,
} from './utils';
import config from '../config';

export class AuthHelper {
  constructor(jwt) {
    this._jwt = jwt;
  }

  async initialize() {
    try {
      this._accessibleResourceList = await getAccessibleResourcesFromArboristasync(this._jwt);
      log.debug('[AuthHelper] accessible resources:', this._accessibleResourceList);

      const promiseList = [];
      config.esConfig.indices.forEach(({ index, type }) => {
        const subListPromise = this.getOutOfScopeResourceList(index, type);
        promiseList.push(subListPromise);
      });
      const listResult = await Promise.all(promiseList);

      this._unaccessibleResourceList = [];
      listResult.forEach((list) => {
        this._unaccessibleResourceList = _.union(this._unaccessibleResourceList, list);
      });
      log.debug('[AuthHelper] unaccessible resources:', this._unaccessibleResourceList);
    } catch (err) {
      log.error('[AuthHelper] error when initializing:', err);
    }
  }

  getAccessibleResources() {
    return this._accessibleResourceList;
  }

  getUnaccessibleResources() {
    return this._unaccessibleResourceList;
  }

  async getOutOfScopeResourceList(esIndex, esType, filter, filterSelf) {
    const requestResourceList = await getRequestResourceListFromFilter(
      esIndex,
      esType,
      filter,
      filterSelf,
    );
    log.debug('[AuthHelper] filter:', filter);
    log.debug(`[AuthHelper] request resource list: [${requestResourceList.join(', ')}]`);
    const outOfScopeResourceList = _.difference(requestResourceList, this._accessibleResourceList);
    log.debug(`[AuthHelper] out-of-scope resource list: [${outOfScopeResourceList.join(', ')}]`);
    return outOfScopeResourceList;
  }

  applyAccessibleFilter(filter) {
    const accessiblePart = buildFilterWithResourceList(this._accessibleResourceList);
    const appliedFilter = addTwoFilters(filter, accessiblePart);
    return appliedFilter;
  }

  applyUnaccessibleFilter(filter) {
    const unaccessiblePart = buildFilterWithResourceList(this._unaccessibleResourceList);
    const appliedFilter = addTwoFilters(filter, unaccessiblePart);
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
