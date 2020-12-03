import authMiddleware from './authMiddleware';
import tierAccessMiddleware from './tierAccessMiddleware';
// import perIndexTierAccessMiddleware from './perIndexTierAccessMiddleware';
import config from '../config';

const middlewares = [];

// If a universal tierAccessLevel has not been applied in the manifest,
// we apply ES-index-specific tiered access settings.
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
    // middlewares.push(perIndexTierAccessMiddleware);
    break;
}
export default middlewares;
