import getAuthHelperInstance from './auth/authHelper';
import headerParser from './utils/headerParser';
import esInstance from './es/index';
import log from './logger';
import config from './config';
import CodedError from './utils/error';

const downloadRouter = async (req, res, next) => {
  const {
    type, filter, sort, fields, accessibility,
  } = req.body;

  log.debug('[download] ', JSON.stringify(req.body, null, 4));
  const esIndexConfig = esInstance.getESIndexConfigByType(type);
  const tierAccessLevel = (config.tierAccessLevel
    ? config.tierAccessLevel : esIndexConfig.tier_access_level);
  const jwt = headerParser.parseJWT(req);
  const authHelper = await getAuthHelperInstance(jwt);

  try {
    let appliedFilter;
    /**
     * Tier access strategy for download endpoint:
     * 1. if the data commons or the index is private, add auth filter layer onto filter
     * 2. if the data commons or the index is regular:
     *   a. if request contains out-of-access resource, return 401
     *   b. if request contains only accessible resouces, return response
     * 3. if the data commons or the index is libre, always return reponse without any auth check
     */
    switch (tierAccessLevel) {
      case 'private': {
        appliedFilter = authHelper.applyAccessibleFilter(filter);
        break;
      }
      case 'regular': {
        log.debug('[download] regular commons');
        if (accessibility === 'accessible') {
          appliedFilter = authHelper.applyAccessibleFilter(filter);
        } else {
          const outOfScopeResourceList = await authHelper.getOutOfScopeResourceList(
            esIndexConfig.index,
            type,
            filter,
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
        throw new Error(`Invalid TIER_ACCESS_LEVEL "${tierAccessLevel}"`);
    }
    const data = await esInstance.downloadData({
      esIndex: esIndexConfig.index, esType: type, filter: appliedFilter, sort, fields,
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(data);
  } catch (err) {
    log.error(err);
    next(err);
  }
  return 0;
};

export default downloadRouter;
