import _ from 'lodash';
import { applyAuthFilter, getAccessableResources } from './middlewares/authMiddleware';
import { getRequestResourceListFromFilter } from './middlewares/tierAccessMiddleware';
import headerParser from './utils/headerParser';
import esInstance from './es/index';
import log from './logger';
import config from './config';
import CodedError from './utils/error';

const downloadRouter = async (req, res, next) => {
  const {
    type, filter, sort, fields,
  } = req.body;
  log.debug('[download] ', JSON.stringify(req.body, null, 4));
  const esIndex = esInstance.getESIndexByType(type);
  const jwt = headerParser.parseJWT(req);

  try {
    let appliedFilter;
    /**
     * Tier acces strategy for download endpoint:
     * 1. if data commons is secure, add auth filter layer onto filter
     * 2. if data commons is regular:
     *   a. if request contains out-of-access resource, return 401
     *   b. if request contains only accessable resouces, return response
     * 3. if data commons is private, always return reponse without any auth check
     */
    switch (config.tierAccessLevel) {
      case 'private': {
        appliedFilter = await applyAuthFilter(jwt, filter);
        break;
      }
      case 'regular': {
        log.debug('[download] regular commons');
        const requestResourceList = await getRequestResourceListFromFilter(esIndex, type, filter);
        log.debug(`[download] request resource list: [${requestResourceList.join(', ')}]`);
        const accessableResourcesList = await getAccessableResources(jwt);
        log.debug(`[download] accessable resource list: [${accessableResourcesList.join(', ')}]`);
        // compare resources with JWT
        const outOfScopeResourceList = _.difference(requestResourceList, accessableResourcesList);
        // if requesting resources > allowed resources, return 401,
        if (outOfScopeResourceList.length > 0) {
          throw new CodedError(401, `You don't have access to following ${config.esConfig.resourceField}s: [${outOfScopeResourceList.join(', ')}]`);
        } else { // else, go ahead download
          appliedFilter = filter;
        }
        break;
      }
      case 'libre': {
        appliedFilter = filter;
        break;
      }
      default:
        throw new Error(`Invalid TIER_ACCESS_LEVEL "${config.tierAccessLevel}"`);
    }
    const data = await esInstance.downloadData({
      esIndex, esType: type, filter: appliedFilter, sort, fields,
    });
    res.send(data);
  } catch (err) {
    next(err);
  }
  return 0;
};

export default downloadRouter;
