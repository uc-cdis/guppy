import authMiddleware from './authMiddleware';
import tierAccessMiddleware from './tierAccessMiddleware';
import perIndexTierAccessMiddleware from './perIndexTierAccessMiddleware';
import config from '../config';

const middlewares = [];

// If a universal tierAccessLevel has not been applied in the manifest,
// we apply ES-index-specific tiered access settings.
switch (config.tierAccessLevel) {
  case 'libre':
    console.log('[Server] applying libre middleware.');
    break;
  case 'regular':
    console.log('[Server] applying site-wide regular middleware.');
    middlewares.push(tierAccessMiddleware);
    break;
  case 'private':
    console.log('[Server] applying site-wide private middleware.');
    middlewares.push(authMiddleware);
    break;
  default:
    console.log('[Server] applying index-scoped middleware.');
    middlewares.push(perIndexTierAccessMiddleware);
    break;
}
export default middlewares;
