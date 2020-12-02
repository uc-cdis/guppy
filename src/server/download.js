import getAuthHelperInstance from './auth/authHelper';
import headerParser from './utils/headerParser';
import { validSignature } from './utils/utils';
import esInstance from './es/index';
import log from './logger';
import config from './config';
import CodedError from './utils/error';


const downloadRouter = async (req, res, next) => {
  const {
    type, filter, sort, fields, accessibility,
  } = req.body;

  log.debug('[download] ', JSON.stringify(req.body, null, 4));
  const esIndex = esInstance.getESIndexByType(type);
  const jwt = headerParser.parseJWT(req);
  const authHelper = await getAuthHelperInstance(jwt);

  var isValid = validSignature(req);

  try {
    let appliedFilter;
    /**
     * Tier acces strategy for download endpoint:
     * 1. if data commons is secure, add auth filter layer onto filter
     * 2. if data commons is regular:
     *   a. if request contains out-of-access resource, return 401
     *   b. if request contains only accessible resouces, return response
     * 3. if data commons is private, always return reponse without any auth check
     */
    switch (config.tierAccessLevel) {
      case 'private': {
        appliedFilter = authHelper.applyAccessibleFilter(filter, isValid);
        break;
      }
      case 'regular': {
        if (accessibility === 'accessible') {
          appliedFilter = authHelper.applyAccessibleFilter(filter, isValid);
        } else {
          const outOfScopeResourceList = await authHelper.getOutOfScopeResourceList(
            esIndex, type, filter,
          );
          // if requesting resources > allowed resources, return 401,
          if (outOfScopeResourceList.length > 0) {
            log.info('[download] requesting out-of-scope resources, return 401');
            log.info(`[download] the following resources are out-of-scope: [${outOfScopeResourceList.join(', ')}]`);
            throw new CodedError(401, 'You don\'t have access to all the data you are querying. Try using \'accessibility: accessible\' in your query');
          } else { // else, go ahead download
            appliedFilter = filter;
          }
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
