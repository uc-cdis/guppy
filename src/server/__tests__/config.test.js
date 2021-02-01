/* eslint-disable global-require,import/no-dynamic-require */
jest.mock('../logger');

describe('config', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  /* --------------- For tier access --------------- */
  test('default tier access level should be private', async () => {
    const config = require('../config').default;
    expect(config.tierAccessLevel).toEqual('private');
  });

  test('config for libre tier access level', async () => {
    process.env.TIER_ACCESS_LEVEL = 'libre';
    const config = require('../config').default;
    expect(config.tierAccessLevel).toEqual('libre');
  });

  test('config for regular tier access level', async () => {
    process.env.TIER_ACCESS_LEVEL = 'regular';
    const config = require('../config').default;
    expect(config.tierAccessLevel).toEqual('regular');
  });

  test('should show error if invalid tier access level', async () => {
    process.env.TIER_ACCESS_LEVEL = 'invalid-level';
    expect(() => (require('../config'))).toThrow(new Error(`Invalid TIER_ACCESS_LEVEL "${process.env.TIER_ACCESS_LEVEL}"`));
  });

  test('should show error if invalid tier access level in guppy block', async () => {
    process.env.TIER_ACCESS_LEVEL = null;
    const fileName = './testConfigFiles/test-invalid-index-scoped-tier-access.json';
    process.env.GUPPY_CONFIG_FILEPATH = `${__dirname}/${fileName}`;
    const invalidItemType = 'subject_private';
    expect(() => (require('../config'))).toThrow(new Error(`tier_access_level invalid for index ${invalidItemType}."`));
  });

  test('clears out site-wide default tiered-access setting if index-scoped levels set', async () => {
    process.env.TIER_ACCESS_LEVEL = null;
    const fileName = './testConfigFiles/test-invalid-index-scoped-tier-access.json';
    process.env.GUPPY_CONFIG_FILEPATH = `${__dirname}/${fileName}`;
    const config = require('../config').default;
    const { indices } = require(fileName);
    expect(config.tierAccessLevel).toBe(null);
    expect(JSON.stringify(config.esConfig.indices)).toEqual(JSON.stringify(indices));
  });

  /* --------------- For whitelist --------------- */
  test('could disable whitelist', async () => {
    const config = require('../config').default;
    expect(config.enableEncryptWhiteList).toBe(false);
    expect(config.encryptWhitelist).toEqual([]);
  });

  test('could read list of string into whitelist', async () => {
    const fileName = './testConfigFiles/test-whitelist.json';
    process.env.GUPPY_CONFIG_FILEPATH = `${__dirname}/${fileName}`;
    const config = require('../config').default;
    const whitelist = require(fileName).encrypt_whitelist;
    expect(config.enableEncryptWhiteList).toBe(true);
    expect(config.encryptWhitelist).toEqual(whitelist);
  });

  test('could read string as whitelist', async () => {
    const fileName = './testConfigFiles/test-whitelist-string.json';
    process.env.GUPPY_CONFIG_FILEPATH = `${__dirname}/${fileName}`;
    const config = require('../config').default;
    const whitelist = require(fileName).encrypt_whitelist;
    expect(config.enableEncryptWhiteList).toBe(true);
    expect(config.encryptWhitelist).toEqual([whitelist]);
  });

  /* --------------- For missing data --------------- */
  test('could exclude missing data for aggregation', async () => {
    process.env.GUPPY_CONFIG_FILEPATH = `${__dirname}/testConfigFiles/test-no-missing-data.json`;
    const config = require('../config').default;
    expect(config.esConfig.aggregationIncludeMissingData).toBe(false);
  });

  test('could include and alias missing data for aggregation', async () => {
    const fileName = './testConfigFiles/test-missing-data.json';
    process.env.GUPPY_CONFIG_FILEPATH = `${__dirname}/${fileName}`;
    const config = require('../config').default;
    const alias = require(fileName).missing_data_alias;
    expect(config.esConfig.aggregationIncludeMissingData).toBe(true);
    expect(config.esConfig.missingDataAlias).toEqual(alias);
  });
});
