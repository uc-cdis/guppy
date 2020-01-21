import authMiddleware from './authMiddleware';
import tierAccessMiddleware from './tierAccessMiddleware';
import config from '../config';

const middlewares = [];
switch (config.tierAccessLevel) {
  case 'libre':
    break;
  case 'regular':
    middlewares.push(tierAccessMiddleware);
    break;
  case 'private':
    middlewares.push(authMiddleware);
    break;
  default:
    throw new Error(`Invalid tier access level ${config.tierAccessLevel}`);
}
export default middlewares;
