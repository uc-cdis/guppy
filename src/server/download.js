import getAuthHelperInstance from './auth/authHelper';
import headerParser from './utils/headerParser';
import esInstance from './es/index';
import log from './logger';
import config from './config';
import CodedError from './utils/error';
import rs from 'jsrsasign';


const downloadRouter = async (req, res, next) => {
  const {
    type, filter, sort, fields, accessibility,
  } = req.body;

  log.debug('[download] ', JSON.stringify(req.body, null, 4));
  const esIndex = esInstance.getESIndexByType(type);
  const jwt = headerParser.parseJWT(req);
  const signature = headerParser.parseSignature(req);
  const authHelper = await getAuthHelperInstance(jwt);


  var data = req.body;
  data = JSON.stringify(data);

  const public_key_text = config.public_key;
  const hashmessage = signature
  var public_key = rs.KEYUTIL.getKey(public_key_text);
  var isValid = public_key.verify(data, hashmessage)  

  if (isValid) {
    log.info("VALID")
  }
  else {
    log.info("NOT VALID")
  }

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
        appliedFilter = authHelper.applyAccessibleFilter(filter=filter, skipUserAuthz=isValid);
        break;
      }
      case 'regular': {
        log.debug('[download] regular commons');
        if (accessibility === 'accessible') {
          appliedFilter = authHelper.applyAccessibleFilter(filter=filter, skipUserAuthz=isValid);
        } else {
          const outOfScopeResourceList = await authHelper.getOutOfScopeResourceList(
            esIndex, type, filter,
          );
          // if requesting resources > allowed resources, return 401,
          if (outOfScopeResourceList.length > 0) {
            throw new CodedError(401, `You don't have access to following resources: [${outOfScopeResourceList.join(', ')}]`);
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
