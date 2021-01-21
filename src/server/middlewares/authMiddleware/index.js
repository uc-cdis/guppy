import config from '../../config';
import authMWResolver from './resolvers';

// apply this middleware to all es types' data/aggregation resolvers
const typeMapping = config.esConfig.indices.reduce((acc, item) => {
  acc[item.type] = authMWResolver;
  return acc;
}, {});
const authMiddleware = {
  Query: {
    ...typeMapping,
  },
  Aggregation: {
    ...typeMapping,
  },
};

export default authMiddleware;
