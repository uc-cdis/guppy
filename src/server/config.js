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
    configIndex: inputConfig.configIndex,
    authFilterField: inputConfig.auth_filter_field || 'gen3_resource_path',
  },

  port: 80,
  path: '/graphql',
  arboristEndpoint: 'mock',
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

log.info('[config] starting server using config', JSON.stringify(config, null, 4));

export default config;
