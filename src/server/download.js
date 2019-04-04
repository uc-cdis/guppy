import { applyAuthFilter } from './middlewares/authMiddleware';
import headerParser from './middlewares/headerParser';
import esInstance from './es/index';
import log from './logger';

const downloadRouter = async (req, res, next) => {
  const {
    index, type, filter, sort, fields,
  } = req.body;
  log.debug('[download] ', JSON.stringify(req.body, null, 4));
  const jwt = headerParser.parseJWT(req);
  try {
    const appliedFilter = await applyAuthFilter(jwt, filter);
    esInstance.downloadData({
      esIndex: index, esType: type, filter: appliedFilter, sort, fields,
    }).then((data) => {
      res.send(data);
    });
  } catch (errMsg) {
    const error = new Error(errMsg);
    return next(error);
  }
  return 0;
};

export default downloadRouter;
