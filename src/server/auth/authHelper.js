import _ from 'lodash';
import { addTwoFilters } from '../utils/utils';
import log from '../logger';
import {
  getRequestResourceListFromFilter,
  buildFilterWithResourceList,
  getAccessibleResourcesFromArboristasync,
} from './utils';
import arboristClient from './arboristClient';
import config from '../config';

export class AuthHelper {
  constructor(jwt) {
    this._jwt = jwt;
  }

  async initialize() {
    try {
      // TODO REMOVE PATCH FOR ARBORIST PERFORMANCES
      // Check if the user is an ADMIN
      isAdmin = arboristClient.checkResourceAuth(this._jwt, "/services/amanuensis", "*", "amanuensis")
      log.info(isAdmin);
      log.info("LUCAAAAAAAAAAAAAAAAAAAAAA")
      this._isAdmin = true;

      if (this._isAdmin === false) {
        // TODO END REMOVE
        var start = process.hrtime(); 
        this._accessibleResourceList = await getAccessibleResourcesFromArboristasync(this._jwt);
        log.debug('[AuthHelper] accessible resources:', this._accessibleResourceList);
        var elapsed = process.hrtime(start)[1] / 1000000;
        log.info("LUCAAAA arborist accessible time: " + elapsed.toFixed(3) + " ms");
        start = process.hrtime();

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
        var elapsed = process.hrtime(start)[1] / 1000000;
        log.info("LUCAAAA ES unaccessible time: " + elapsed.toFixed(3) + " ms");

        log.debug('[AuthHelper] unaccessible resources:', this._unaccessibleResourceList);
      }
      
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

  isAdmin() {
    return this._isAdmin === true;
  }

  async getOutOfScopeResourceList(esIndex, esType, filter, filterSelf) {
    const requestResourceList = await getRequestResourceListFromFilter(
      esIndex, esType, filter, filterSelf,
    );
    log.debug('[AuthHelper] filter:', filter);
    log.debug(`[AuthHelper] request resource list: [${requestResourceList.join(', ')}]`);
    const outOfScopeResourceList = _.difference(requestResourceList, this._accessibleResourceList);
    log.debug(`[AuthHelper] out-of-scope resource list: [${outOfScopeResourceList.join(', ')}]`);
    return outOfScopeResourceList;
  }

  applyAccessibleFilter(filter, skipUserAuthz = false) {
    const accessiblePart = (!skipUserAuthz
      ? buildFilterWithResourceList(this._accessibleResourceList)
      : null);
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
