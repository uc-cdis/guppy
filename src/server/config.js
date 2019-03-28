
const config = {
  esConfig: {
    host: 'localhost:9200',
    indices: [
      {
        index: 'gen3-dev-subject',
        type: 'subject',
      },
      {
        index: 'gen3-dev-file',
        type: 'file',
      },
    ],
  },

  port: 3000,
  path: '/graphql',
};

if (process.env.GEN3_ES_ENDPOINT) {
  config.esConfig.host = process.env.GEN3_ES_ENDPOINT;
}
if (process.env.GEN3_ES_INDEX) {
  config.esConfig.index = process.env.GEN3_ES_INDEX;
}
if (process.env.GEN3_ES_TYPE) {
  config.esConfig.type = process.env.GEN3_ES_TYPE;
}

export default config;
