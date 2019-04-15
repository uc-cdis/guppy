import { applyAuthFilter } from './middlewares/authMiddleware';
import headerParser from './utils/headerParser';
import esInstance from './es/index';
import log from './logger';

const downloadRouter = async (req, res, next) => {
  const {
    type, filter, sort, fields,
  } = req.body;
  log.debug('[download] ', JSON.stringify(req.body, null, 4));
  const jwt = headerParser.parseJWT(req);
  try {
    const esIndex = esInstance.getESIndexByType(type);
    const appliedFilter = await applyAuthFilter(jwt, filter);
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
