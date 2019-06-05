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
      },
      {
        index: 'gen3-dev-file',
        type: 'file',
      },
    ],
    configIndex: inputConfig.config_index,
    authFilterField: inputConfig.auth_filter_field || 'gen3_resource_path',
    aggregationIncludeMissingData: typeof inputConfig.aggs_include_missing_data === 'undefined' ? true : inputConfig.aggs_include_missing_data,
    missingDataAlias: inputConfig.missing_data_alias || 'no data',
  },

  port: 80,
  path: '/graphql',
  arboristEndpoint: 'mock',
  tierAccessLevel: 'private',
  tierAccessLimit: 1000,
  logLevel: 'INFO',
  enableEncryptWhiteList: typeof inputConfig.enable_encrypt_whitelist === 'undefined' ? true : inputConfig.enable_encrypt_whitelist,
  encryptWhitelist: inputConfig.encrypt_whitelist || ['__missing__', 'unknown', 'not reported', 'no data'],
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

// only three options for tier access level: 'private' (default), 'regular', and 'libre'
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
