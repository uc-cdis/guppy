import { tierAccessResolver, hideNumberResolver } from '../resolvers';
import esInstance from '../../../es/index';

jest.mock('../../../config');
jest.mock('../../../logger');
jest.mock('../../../es/index', () => ({
  __esModule: true,
  default: {
    getESIndexConfigByName: jest.fn().mockReturnValue({}),
  },
}));

const esIndex = 'gen3-dev-subject';
const esType = 'subject';

const makeAuthHelper = (overrides = {}) => ({
  getOutOfScopeResourceList: jest.fn().mockResolvedValue([]),
  applyAccessibleFilter: jest.fn((f) => ({ AND: [f, { IN: { gen3_resource_path: ['internal-project-1'] } }] })),
  applyUnaccessibleFilter: jest.fn((f) => ({ AND: [f, { IN: { gen3_resource_path: ['external-project-1'] } }] })),
  getAccessibleResources: jest.fn().mockReturnValue(['internal-project-1']),
  ...overrides,
});

describe('tierAccessResolver with tiered_access_level=regular', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    esInstance.getESIndexConfigByName.mockReturnValue({});
  });

  test('resolves with needEncryptAgg=true for accessibility=all with no out-of-scope resources', async () => {
    const authHelper = makeAuthHelper();
    const resolver = tierAccessResolver({ isRawDataQuery: false, esType, esIndex });
    const mockResolve = jest.fn().mockResolvedValue('result');
    const args = { filter: { eq: { gender: 'female' } }, accessibility: 'all' };

    await resolver(mockResolve, {}, args, { authHelper }, {});

    expect(mockResolve).toHaveBeenCalledWith(
      {},
      { ...args, needEncryptAgg: true },
      { authHelper },
      {},
    );
  });

  test('resolves with needEncryptAgg=false for accessibility=accessible with no out-of-scope resources', async () => {
    const authHelper = makeAuthHelper();
    const resolver = tierAccessResolver({ isRawDataQuery: false, esType, esIndex });
    const mockResolve = jest.fn().mockResolvedValue('result');
    const args = { filter: { eq: { gender: 'female' } }, accessibility: 'accessible' };

    await resolver(mockResolve, {}, args, { authHelper }, {});

    expect(mockResolve).toHaveBeenCalledWith(
      {},
      { ...args, needEncryptAgg: false },
      { authHelper },
      {},
    );
  });

  test('applies unaccessible filter for accessibility=unaccessible with no out-of-scope resources', async () => {
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const resolver = tierAccessResolver({ isRawDataQuery: false, esType, esIndex });
    const mockResolve = jest.fn().mockResolvedValue('result');
    const filter = { eq: { gender: 'female' } };
    const args = { filter, accessibility: 'unaccessible' };

    await resolver(mockResolve, {}, args, { authHelper }, {});

    expect(authHelper.applyUnaccessibleFilter).toHaveBeenCalledWith(filter);
    expect(mockResolve).toHaveBeenCalledWith(
      {},
      { ...args, filter: unaccessibleFilter, needEncryptAgg: true },
      { authHelper },
      {},
    );
  });

  test('resolves with needEncryptAgg=true for accessibility=all with out-of-scope resources', async () => {
    const authHelper = makeAuthHelper({
      getOutOfScopeResourceList: jest.fn().mockResolvedValue(['external-project-1']),
    });
    const resolver = tierAccessResolver({ isRawDataQuery: false, esType, esIndex });
    const mockResolve = jest.fn().mockResolvedValue('result');
    const filter = { eq: { gender: 'female' } };
    const args = { filter, accessibility: 'all' };

    await resolver(mockResolve, {}, args, { authHelper }, {});

    expect(mockResolve).toHaveBeenCalledWith(
      {},
      { ...args, filter, needEncryptAgg: true },
      { authHelper },
      {},
    );
  });

  test('applies accessible filter for accessibility=accessible with out-of-scope resources', async () => {
    const accessibleFilter = { IN: { gen3_resource_path: ['internal-project-1'] } };
    const authHelper = makeAuthHelper({
      getOutOfScopeResourceList: jest.fn().mockResolvedValue(['external-project-1']),
      applyAccessibleFilter: jest.fn().mockReturnValue(accessibleFilter),
    });
    const resolver = tierAccessResolver({ isRawDataQuery: false, esType, esIndex });
    const mockResolve = jest.fn().mockResolvedValue('result');
    const filter = { eq: { gender: 'female' } };
    const args = { filter, accessibility: 'accessible' };

    await resolver(mockResolve, {}, args, { authHelper }, {});

    expect(authHelper.applyAccessibleFilter).toHaveBeenCalledWith(filter);
    expect(mockResolve).toHaveBeenCalledWith(
      {},
      { ...args, filter: accessibleFilter, needEncryptAgg: false },
      { authHelper },
      {},
    );
  });

  test('applies unaccessible filter for accessibility=unaccessible with out-of-scope resources', async () => {
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      getOutOfScopeResourceList: jest.fn().mockResolvedValue(['external-project-1']),
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const resolver = tierAccessResolver({ isRawDataQuery: false, esType, esIndex });
    const mockResolve = jest.fn().mockResolvedValue('result');
    const filter = { eq: { gender: 'female' } };
    const args = { filter, accessibility: 'unaccessible' };

    await resolver(mockResolve, {}, args, { authHelper }, {});

    expect(authHelper.applyUnaccessibleFilter).toHaveBeenCalledWith(filter);
    expect(mockResolve).toHaveBeenCalledWith(
      {},
      { ...args, filter: unaccessibleFilter, needEncryptAgg: true },
      { authHelper },
      {},
    );
  });

  test('throws 401 for raw data query with out-of-scope resources when accessibility=all', async () => {
    const authHelper = makeAuthHelper({
      getOutOfScopeResourceList: jest.fn().mockResolvedValue(['external-project-1']),
    });
    const resolver = tierAccessResolver({ isRawDataQuery: true, esType, esIndex });
    const mockResolve = jest.fn();
    const args = { filter: undefined, accessibility: 'all' };

    await expect(resolver(mockResolve, {}, args, { authHelper }, {})).rejects.toThrow();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  test('applies accessible filter for raw data query when accessibility=accessible with out-of-scope resources', async () => {
    const accessibleFilter = { IN: { gen3_resource_path: ['internal-project-1'] } };
    const authHelper = makeAuthHelper({
      getOutOfScopeResourceList: jest.fn().mockResolvedValue(['external-project-1']),
      applyAccessibleFilter: jest.fn().mockReturnValue(accessibleFilter),
    });
    const resolver = tierAccessResolver({ isRawDataQuery: true, esType, esIndex });
    const mockResolve = jest.fn().mockResolvedValue('result');
    const filter = { eq: { gender: 'female' } };
    const args = { filter, accessibility: 'accessible' };

    await resolver(mockResolve, {}, args, { authHelper }, {});

    expect(authHelper.applyAccessibleFilter).toHaveBeenCalledWith(filter);
    expect(mockResolve).toHaveBeenCalledWith(
      {},
      { ...args, filter: accessibleFilter, needEncryptAgg: false },
      { authHelper },
      {},
    );
  });
});

describe('hideNumberResolver with tiered_access_level=regular', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns result as-is when needEncryptAgg=false', async () => {
    const buckets = [{ key: 'female', count: 35 }, { key: 'male', count: 27 }];
    const mockResolve = jest.fn().mockResolvedValue(buckets);
    const root = { needEncryptAgg: false };
    const authHelper = makeAuthHelper();

    const resolver = hideNumberResolver(false);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual(buckets);
    expect(mockResolve).toHaveBeenCalledTimes(1);
  });

  test('hides text agg bucket counts below tierAccessLimit (20) when needEncryptAgg=true', async () => {
    const accessibleBuckets = [
      { key: 'female', count: 35 },
      { key: 'male', count: 27 },
      { key: 'unknown', count: 5 },
    ];
    const unaccessibleBuckets = [
      { key: 'female', count: 25 },
      { key: 'male', count: 21 },
      { key: 'unknown', count: 3 },
    ];
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const mockResolve = jest.fn()
      .mockResolvedValueOnce(accessibleBuckets)
      .mockResolvedValueOnce(unaccessibleBuckets);

    const root = { needEncryptAgg: true, filter: undefined };
    const resolver = hideNumberResolver(false);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual([
      { key: 'female', count: 35 },
      { key: 'male', count: 27 },
      { key: 'unknown', count: -1 },
    ]);
  });

  test('does not encrypt bucket count when unaccessible count >= tierAccessLimit', async () => {
    const accessibleBuckets = [{ key: 'female', count: 35 }];
    const unaccessibleBuckets = [{ key: 'female', count: 20 }];
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const mockResolve = jest.fn()
      .mockResolvedValueOnce(accessibleBuckets)
      .mockResolvedValueOnce(unaccessibleBuckets);

    const root = { needEncryptAgg: true, filter: undefined };
    const resolver = hideNumberResolver(false);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual([{ key: 'female', count: 35 }]);
  });

  test('does not encrypt bucket count when key is not in unaccessible results', async () => {
    const accessibleBuckets = [
      { key: 'female', count: 35 },
      { key: 'male', count: 27 },
    ];
    const unaccessibleBuckets = [{ key: 'female', count: 25 }];
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const mockResolve = jest.fn()
      .mockResolvedValueOnce(accessibleBuckets)
      .mockResolvedValueOnce(unaccessibleBuckets);

    const root = { needEncryptAgg: true, filter: undefined };
    const resolver = hideNumberResolver(false);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual([
      { key: 'female', count: 35 },
      { key: 'male', count: 27 },
    ]);
  });

  test('hides histogram bucket counts below tierAccessLimit when needEncryptAgg=true', async () => {
    const accessibleBuckets = [
      { key: [0, 30], count: 25 },
      { key: [30, 60], count: 39 },
      { key: [60, 90], count: 5 },
    ];
    const unaccessibleBuckets = [
      { key: [0, 30], count: 25 },
      { key: [30, 60], count: 30 },
      { key: [60, 90], count: 3 },
    ];
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const mockResolve = jest.fn()
      .mockResolvedValueOnce(accessibleBuckets)
      .mockResolvedValueOnce(unaccessibleBuckets);

    const root = { needEncryptAgg: true, filter: undefined };
    const resolver = hideNumberResolver(false);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual([
      { key: [0, 30], count: 25 },
      { key: [30, 60], count: 39 },
      { key: [60, 90], count: -1 },
    ]);
  });

  test('returns -1 for total count when unaccessible count is between 0 and tierAccessLimit', async () => {
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const mockResolve = jest.fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(5);

    const root = { needEncryptAgg: true, filter: undefined };
    const resolver = hideNumberResolver(true);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual(-1);
  });

  test('returns original count for total count when unaccessible count is 0', async () => {
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const mockResolve = jest.fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0);

    const root = { needEncryptAgg: true, filter: undefined };
    const resolver = hideNumberResolver(true);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual(100);
  });

  test('returns original count for total count when unaccessible count >= tierAccessLimit', async () => {
    const unaccessibleFilter = { IN: { gen3_resource_path: ['external-project-1'] } };
    const authHelper = makeAuthHelper({
      applyUnaccessibleFilter: jest.fn().mockReturnValue(unaccessibleFilter),
    });
    const mockResolve = jest.fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(20);

    const root = { needEncryptAgg: true, filter: undefined };
    const resolver = hideNumberResolver(true);
    const result = await resolver(mockResolve, root, {}, { authHelper }, {});

    expect(result).toEqual(100);
  });
});
