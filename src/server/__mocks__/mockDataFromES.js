import nock from 'nock';
import config from './config';
import mockTextAggs from './mockESData/mockTextAggs';
import mockNumericAggsGlobalStats from './mockESData/mockNumericAggsGlobalStats';
import mockHistogramFixWidth from './mockESData/mockNumericHistogramFixWidth';
import mockHistogramFixBinCount from './mockESData/mockNumericHistogramFixBinCount';
import mockNestedTermsAndMissingAggs from './mockESData/mockNestedTermsAndMissingAggs';
import mockNestedAggs from './mockESData/mockNestedAggs';

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
                  missing_bucket: true,
                  order: 'desc',
                },
              },
            },
          ],
          size: 10000,
        },
      },
    },
    highlight: {
      pre_tags: [
        '<em>',
      ],
      post_tags: [
        '</em>',
      ],
      fields: {
        '*.analyzed': {},
      },
    },
    track_total_hits: true,
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

  // with filter of internal resource
  const queryResourceWithFilter1 = {
    size: 0,
    query: {
      term: {
        gen3_resource_path: 'internal-project-1',
      },
    },
    aggs: {
      gen3_resource_pathAggs: {
        composite: {
          sources: [
            {
              gen3_resource_path: {
                terms: {
                  field: 'gen3_resource_path',
                  missing_bucket: true,
                  order: 'desc',
                },
              },
            },
          ],
          size: 10000,
        },
      },
    },
    highlight: {
      pre_tags: [
        '<em>',
      ],
      post_tags: [
        '</em>',
      ],
      fields: {
        '*.analyzed': {},
      },
    },
    track_total_hits: true,
  };
  const fakeResourceWithFilter1 = {
    aggregations: {
      gen3_resource_pathAggs: {
        after_key: {
          gen3_resource_path: 'internal-project-1',
        },
        buckets: [
          {
            key: {
              gen3_resource_path: 'internal-project-1',
            },
            doc_count: 36,
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, queryResourceWithFilter1)
    .reply(200, fakeResourceWithFilter1);

  // with filter of external resource
  const queryResourceWithFilter2 = {
    size: 0,
    query: {
      term: {
        gen3_resource_path: 'external-project-1',
      },
    },
    aggs: {
      gen3_resource_pathAggs: {
        composite: {
          sources: [
            {
              gen3_resource_path: {
                terms: {
                  field: 'gen3_resource_path',
                  missing_bucket: true,
                  order: 'desc',
                },
              },
            },
          ],
          size: 10000,
        },
      },
    },
    highlight: {
      pre_tags: [
        '<em>',
      ],
      post_tags: [
        '</em>',
      ],
      fields: {
        '*.analyzed': {},
      },
    },
    track_total_hits: true,
  };
  const fakeResourceWithFilter2 = {
    aggregations: {
      gen3_resource_pathAggs: {
        after_key: {
          gen3_resource_path: 'external-project-1',
        },
        buckets: [
          {
            key: {
              gen3_resource_path: 'external-project-1',
            },
            doc_count: 36,
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, queryResourceWithFilter2)
    .reply(200, fakeResourceWithFilter2);
};

const mockArborist = () => {
  nock(config.arboristEndpoint)
    .persist()
    .post('/auth/mapping')
    .reply(200, {
      'internal-project-1': [ // accessible
        {
          service: '*',
          method: 'create',
        },
        {
          service: '*',
          method: 'delete',
        },
        {
          service: '*',
          method: 'read',
        },
        {
          service: '*',
          method: 'read-storage',
        },
        {
          service: '*',
          method: 'update',
        },
      ],
      'internal-project-2': [ // accessible
        {
          service: '*',
          method: 'read',
        },
      ],
      'internal-project-3': [ // not accessible since method does not match
        {
          service: '*',
          method: 'create',
        },
        {
          service: '*',
          method: 'delete',
        },
        {
          service: '*',
          method: 'read-storage',
        },
        {
          service: '*',
          method: 'update',
        },
      ],
      'internal-project-4': [ // accessible
        {
          service: '*',
          method: '*',
        },
      ],
      'internal-project-5': [ // accessible
        {
          service: 'guppy',
          method: '*',
        },
      ],
      'internal-project-6': [ // not accessible since service does not match
        {
          service: 'indexd',
          method: '*',
        },
      ],
    });
};

const mockESMapping = () => {
  const fakeSubjectMapping = {
    'gen3-dev-subject': {
      mappings: {
        properties: {
          gen3_resource_path: {
            type: 'keyword',
          },
          visits: {
            type: 'nested',
            properties: {
              days_to_visit: { type: 'integer' },
              visit_label: {
                type: 'keyword',
                fields: {
                  analyzed: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'search_analyzer',
                    term_vector: 'with_positions_offsets',
                  },
                },
              },
              follow_ups: {
                type: 'nested',
                properties: {
                  days_to_follow_up: {
                    type: 'integer',
                  },
                  follow_up_label: {
                    type: 'keyword',
                    fields: {
                      analyzed: {
                        type: 'text',
                        analyzer: 'ngram_analyzer',
                        search_analyzer: 'search_analyzer',
                        term_vector: 'with_positions_offsets',
                      },
                    },
                  },
                },
              },
            },
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
  };
  nock(config.esConfig.host)
    .persist()
    .get(/subject\/_mapping/)
    .reply(200, fakeSubjectMapping);
  const fakeFileMapping = {
    'gen3-dev-file': {
      mappings: {
        properties: {
          gen3_resource_path: {
            type: 'keyword',
          },
          file_id: {
            type: 'keyword',
          },
          file_size: {
            type: 'long',
          },
          subject_id: {
            type: 'keyword',
          },
        },
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .get(/file\/_mapping/)
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
  mockHistogramFixBinCount();
  mockNestedTermsAndMissingAggs();
  mockNestedAggs();
};

export default setup;
