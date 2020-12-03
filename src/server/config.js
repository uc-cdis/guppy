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
        index: 'gen3-dev-subject',
        type: 'subject',
        tier_access_level: 'private',
      },
      {
        index: 'gen3-dev-file',
        type: 'file',
        tier_access_level: 'private',
      },
    ],
    tierAccessLevel: 'private',
    configIndex: (inputConfig.indices) ? inputConfig.config_index : 'gen3-dev-config',
    authFilterField: inputConfig.auth_filter_field || 'auth_resource_path',
    aggregationIncludeMissingData: typeof inputConfig.aggs_include_missing_data === 'undefined' ? true : inputConfig.aggs_include_missing_data,
    missingDataAlias: inputConfig.missing_data_alias || 'no data',
  },

  port: 80,
  path: '/graphql',
  arboristEndpoint: 'http://arborist-service',
  tierAccessLimit: 1000,
  tierAccessSensitiveRecordExclusionField: inputConfig.tier_access_sensitive_record_exclusion_field,
  logLevel: inputConfig.log_level || 'INFO',
  enableEncryptWhiteList: typeof inputConfig.enable_encrypt_whitelist === 'undefined' ? false : inputConfig.enable_encrypt_whitelist,
  encryptWhitelist: inputConfig.encrypt_whitelist || ['__missing__', 'unknown', 'not reported', 'no data'],
  analyzedTextFieldSuffix: '.analyzed',
  matchedTextHighlightTagName: 'em',
  allowedMinimumSearchLen: 2,
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

// In cases where index-scoped tiered-access settings are not provided,
// we fall back on the manifest-provided TIER_ACCESS_LEVEL value.
// This allows for backwards-compatibility and flexibility between commons' use cases.
if (process.env.TIER_ACCESS_LEVEL) {
  if (process.env.TIER_ACCESS_LEVEL !== 'private'
  && process.env.TIER_ACCESS_LEVEL !== 'regular'
  && process.env.TIER_ACCESS_LEVEL !== 'libre') {
    throw new Error(`Invalid TIER_ACCESS_LEVEL "${process.env.TIER_ACCESS_LEVEL}"`);
  }
  config.tierAccessLevel = process.env.TIER_ACCESS_LEVEL;
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
