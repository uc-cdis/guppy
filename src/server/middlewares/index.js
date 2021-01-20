import authMiddleware from './authMiddleware';
import tierAccessMiddleware from './tierAccessMiddleware';
import perIndexTierAccessMiddleware from './perIndexTierAccessMiddleware';
import config from '../config';
import log from '../logger';

const middlewares = [];

// If a universal tierAccessLevel has not been applied in the manifest,
// we apply ES-index-specific tiered access settings.
switch (config.tierAccessLevel) {
  case 'libre':
    log.info('[Server] applying libre middleware across indices.');
    break;
  case 'regular':
    log.info('[Server] applying regular middleware across indices.');
    middlewares.push(tierAccessMiddleware);
    break;
  case 'private':
    log.info('[Server] applying private middleware across indices.');
    middlewares.push(authMiddleware);
    break;
  default:
    log.info('[Server] applying index-scoped middleware.');
    middlewares.push(perIndexTierAccessMiddleware);
    break;
}
export default middlewares;
