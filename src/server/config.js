import { readFileSync } from 'fs';
import log from './logger';

let inputConfig = {};
if (process.env.GUPPY_CONFIG_FILEPATH) {
  const configFilepath = process.env.GUPPY_CONFIG_FILEPATH;
  inputConfig = JSON.parse(readFileSync(configFilepath).toString());
  log.info('[config] read guppy config from', configFilepath, JSON.stringify(inputConfig, null, 4));
}

const config = {
  esConfig: {
    host: 'localhost:9200',
    indices: inputConfig.indices || [
      {
        index: 'default-commons-index',
        type: 'metadata',
      },
    ],
    configIndex: (inputConfig.indices) ? inputConfig.config_index : 'default-commons-config-index',
    authFilterField: inputConfig.auth_filter_field || 'auth_resource_path',
    aggregationIncludeMissingData: typeof inputConfig.aggs_include_missing_data === 'undefined' ? true : inputConfig.aggs_include_missing_data,
    missingDataAlias: inputConfig.missing_data_alias || 'no data',
  },
  port: 80,
  path: '/graphql',
  arboristEndpoint: 'http://arborist-service',
  tierAccessLevel: 'libre',
  tierAccessLimit: 1000,
  tierAccessSensitiveRecordExclusionField: inputConfig.tier_access_sensitive_record_exclusion_field,
  logLevel: inputConfig.log_level || 'INFO',
  enableEncryptWhiteList: typeof inputConfig.enable_encrypt_whitelist === 'undefined' ? false : inputConfig.enable_encrypt_whitelist,
  encryptWhitelist: inputConfig.encrypt_whitelist || ['__missing__', 'unknown', 'not reported', 'no data'],
  analyzedTextFieldSuffix: '.analyzed',
  matchedTextHighlightTagName: 'em',
  allowedMinimumSearchLen: 2,
  ignoredFields: ['@version'],
  doubleUnderscorePrefix: 'x__',
};

if (process.env.GEN3_ES_ENDPOINT) {
  config.esConfig.host = process.env.GEN3_ES_ENDPOINT;
}
if (!config.esConfig.host.startsWith('http')) {
  config.esConfig.host = `http://${config.esConfig.host}`;
}

if (process.env.GEN3_ARBORIST_ENDPOINT) {
  config.arboristEndpoint = process.env.GEN3_ARBORIST_ENDPOINT;
}

if (process.env.GUPPY_PORT) {
  config.port = process.env.GUPPY_PORT;
}

if (process.env.DOUBLE_UNDERSCORE) {
  config.doubleUnderscorePrefix = process.env.DOUBLE_UNDERSCORE;
}

// comma separated string of fields to ignore
if (process.env.IGNORED_FIELDS) {
  if (typeof process.env.IGNORED_FIELDS !== 'string') {
    throw new Error('IGNORED_FIELDS must be a comma separated string');
  }
  config.ignoredFields = process.env.IGNORED_FIELDS.split(',');
}

const allowedTierAccessLevels = ['private', 'regular', 'libre'];

if (process.env.TIER_ACCESS_LEVEL) {
  if (!allowedTierAccessLevels.includes(process.env.TIER_ACCESS_LEVEL)) {
    throw new Error(`Invalid TIER_ACCESS_LEVEL "${process.env.TIER_ACCESS_LEVEL}"`);
  }
  config.tierAccessLevel = process.env.TIER_ACCESS_LEVEL;
}

if (process.env.TIER_ACCESS_LIMIT) {
  config.tierAccessLimit = process.env.TIER_ACCESS_LIMIT;
}

if (process.env.INTERNAL_LOCAL_TEST) {
  config.internalLocalTest = process.env.INTERNAL_LOCAL_TEST;
}

if (process.env.LOG_LEVEL) {
  config.logLevel = process.env.LOG_LEVEL;
}

if (process.env.ANALYZED_TEXT_FIELD_SUFFIX) {
  config.analyzedTextFieldSuffix = process.env.ANALYZED_TEXT_FIELD_SUFFIX;
}

// Either all indices should have explicit index-scoped tiered-access values or
// the manifest should have a site-wide TIER_ACCESS_LEVEL value.
// This approach is backwards-compatible with commons configured for past versions of tiered-access.
let allIndicesHaveTierAccessSettings = true;
config.esConfig.indices.forEach((item) => {
  if (!item.tier_access_level && !config.tierAccessLevel) {
    throw new Error('Either set all index-scoped tiered-access levels or a site-wide tiered-access level.');
  }
  if (item.tier_access_level && !allowedTierAccessLevels.includes(item.tier_access_level)) {
    throw new Error(`tier_access_level invalid for index ${item.type}.`);
  }
  if (!item.tier_access_level) {
    allIndicesHaveTierAccessSettings = false;
  }
});

// If the indices all have settings, empty out the default
// site-wide TIER_ACCESS_LEVEL from the config.
if (allIndicesHaveTierAccessSettings) {
  delete config.tierAccessLevel;
}

// check whitelist is enabled
if (config.enableEncryptWhiteList) {
  if (typeof config.encryptWhitelist !== 'object') {
    config.encryptWhitelist = [config.encryptWhitelist];
  }
} else {
  config.encryptWhitelist = [];
}

log.setLogLevel(config.logLevel);
log.info('[config] starting server using config', JSON.stringify(config, null, 4));

export default config;
