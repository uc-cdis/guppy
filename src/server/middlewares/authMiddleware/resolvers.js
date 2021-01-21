import log from '../../logger';
import config from '../../config';
import esInstance from '../../es/index';

const authMWResolver = async (resolve, root, args, context, info) => {
  // Assert that either this index is "private" access or
  // that the index has no setting and site-wide config is "private".
  const indexConfig = esInstance.getESIndexConfigByName(esIndex);
  const indexIsPrivateAccess = indexConfig.tier_access_level === 'private';
  const tierAccessPrivateAndNotIndexScoped = !indexConfig.tier_access_level && config.tierAccessLevel === 'private';
  assert(indexIsPrivateAccess || tierAccessPrivateAndNotIndexScoped, 'Auth middleware layer only for "private" tier access level');


  const { authHelper } = context;

  // if mock arborist endpoint, just skip auth middleware
  if (!config.internalLocalTest) {
    if (config.arboristEndpoint === 'mock') {
      log.debug('[authMiddleware] using mock arborist endpoint, skip auth middleware');
      return resolve(root, args, context, info);
    }
  }

  // asking arborist for auth resource list, and add to filter args
  const parsedFilter = args.filter;
  const appliedFilter = await authHelper.applyAccessibleFilter(parsedFilter);
  const newArgs = {
    ...args,
    filter: appliedFilter,
  };
  if (typeof newArgs.filter === 'undefined') {
    delete newArgs.filter;
  }
  return resolve(root, newArgs, context, info);
};

export default authMWResolver;
