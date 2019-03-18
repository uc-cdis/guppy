
const config = {
  esConfig: {
    host: 'localhost:9200',
    index: 'gen3-dev-subject',
    type: 'subject',
  },

  port: 3000,
  path: '/graphql',
};

if (process.env['GEN3_ES_ENDPOINT']) {
  config.esConfig.host = process.env['GEN3_ES_ENDPOINT'];
}

export default config;
