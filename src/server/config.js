
const config = {
  esConfig: {
    host: 'esproxy-service:9200',
    index: 'gen3-dev-subject',
    type: 'subject',
  },

  port: 3000,
  path: '/graphql',
};

export default config;
