import nock from 'nock';
import config from './config';
import mockTextAggs from './mockESData/mockTextAggs';
import mockNumericAggsGlobalStats from './mockESData/mockNumericAggsGlobalStats';
import mockHistogramFixWidth from './mockESData/mockNumericHistogramFixWidth';

const mockPing = () => {
  nock(config.esConfig.host)
    .head('/')
    .reply(200, 'hello');
};

const mockResourcePath = () => {
  const queryResource = {
    size: 0,
    aggs: {
      gen3_resource_pathAggs: {
        composite: {
          sources: [
            {
              gen3_resource_path: {
                terms: {
                  field: 'gen3_resource_path',
                  missing: 'no data',
                },
              },
            },
          ],
          size: 10000,
        },
      },
    },
  };
  const fakeResource = {
    aggregations: {
      gen3_resource_pathAggs: {
        buckets: [
          {
            key: {
              gen3_resource_path: 'internal-project-1',
            },
            doc_count: 50,
          },
          {
            key: {
              gen3_resource_path: 'internal-project-2',
            },
            doc_count: 10,
          },
          {
            key: {
              gen3_resource_path: 'external-project-1',
            },
            doc_count: 30,
          },
          {
            key: {
              gen3_resource_path: 'external-project-2',
            },
            doc_count: 20,
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, queryResource)
    .reply(200, fakeResource);
};

const mockArborist = () => {
  nock(config.arboristEndpoint)
    .persist()
    .post('/auth/resources')
    .reply(200, {
      resources: [
        'internal-project-1',
        'internal-project-2',
      ],
    });
};

const mockESMapping = () => {
  const fakeSubjectMapping = {
    'gen3-dev-subject': {
      mappings: {
        subject: {
          properties: {
            gen3_resource_path: {
              type: 'keyword',
            },
            gender: {
              type: 'keyword',
            },
            file_count: {
              type: 'integer',
            },
            name: {
              type: 'text',
            },
            some_array_integer_field: {
              type: 'integer',
            },
            some_array_string_field: {
              type: 'keyword',
            },
            whatever_lab_result_value: {
              type: 'float',
            },
          },
        },
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .get(/_mapping\/subject/)
    .reply(200, fakeSubjectMapping);
  const fakeFileMapping = {
    'gen3-dev-file': {
      mappings: {
        file: {
          properties: {
            gen3_resource_path: {
              type: 'keyword',
            },
            file_id: {
              type: 'keyword',
            },
            subject_id: {
              type: 'keyword',
            },
          },
        },
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .get(/_mapping\/file/)
    .reply(200, fakeFileMapping);
};

const mockArrayConfig = () => {
  const arrayConfigQuery = { query: { ids: { values: ['gen3-dev-subject', 'gen3-dev-file'] } } };
  const fakeArrayConfig = {
    hits: {
      total: 1,
      max_score: 1.0,
      hits: [
        {
          _index: 'gen3-dev-config',
          _type: '_doc',
          _id: 'gen3-dev-subject',
          _score: 1.0,
          _source: {
            array: [
              'some_array_integer_field',
              'some_array_string_field',
            ],
          },
        },
      ],
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/gen3-dev-config\/_search$/, arrayConfigQuery)
    .reply(200, fakeArrayConfig);
};

const setup = () => {
  mockArborist();
  mockPing();
  mockResourcePath();
  mockESMapping();
  mockArrayConfig();
  mockTextAggs();
  mockNumericAggsGlobalStats();
  mockHistogramFixWidth();
};

export default setup;
