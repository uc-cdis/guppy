import authMiddleware from './authMiddleware';
import tierAccessMiddleware from './tierAccessMiddleware';
import config from '../config';

const middlewares = [];
log.info('[yeah] insidee middlewares index.js 6');
switch (config.tierAccessLevel) {
  case 'libre':
  log.info('[yeah] insidee middlewares index.js 9');
    break;
  case 'regular':
    log.info('[yeah] insidee middlewares index.js 12');
    middlewares.push(tierAccessMiddleware);
    break;
  case 'private':
    log.info('[yeah] insidee middlewares index.js 16');
    middlewares.push(authMiddleware);
    break;
  default:
    throw new Error(`Invalid tier access level ${config.tierAccessLevel}`);
}
export default middlewares;
