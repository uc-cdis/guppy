const config = {
  esConfig: {
    host: 'http://mock-eshost',
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
    configIndex: 'gen3-dev-config',
    authFilterField: 'gen3_resource_path',
  },

  port: 3000,
  path: '/graphql',
  tierAccessLevel: 'regular',
  tierAccessLimit: 20,
  arboristEndpoint: 'http://mock-arborist',
};

export default config;
