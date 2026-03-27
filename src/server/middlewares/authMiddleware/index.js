import config from '../../config';
import { prefixForIndex } from '../../utils/utils';
import authMWResolver from './resolvers';

// apply this middleware to all es types' data/aggregation resolvers
const authMiddleware = { Query: {} };

if (config.esConfig.useNamespace) {
  config.esConfig.indices.forEach((item) => {
    const prefix = prefixForIndex(item);
    // Root Query field is renamed to ${prefix}_${item.type} via RenameRootFields
    authMiddleware.Query[`${prefix}_${item.type}`] = authMWResolver;
    // Aggregation type is renamed to ${prefix}_Aggregation via RenameTypes;
    // the field name within the type stays as item.type
    const aggsTypeName = `${prefix}_Aggregation`;
    authMiddleware[aggsTypeName] = {
      ...authMiddleware[aggsTypeName],
      [item.type]: authMWResolver,
    };
  });
} else {
  const typeMapping = config.esConfig.indices.reduce((acc, item) => {
    acc[item.type] = authMWResolver;
    return acc;
  }, {});
  authMiddleware.Query = { ...typeMapping };
  authMiddleware.Aggregation = { ...typeMapping };
}

export default authMiddleware;
