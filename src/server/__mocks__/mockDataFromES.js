import nock from 'nock';
import config from './config';

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

const mockTextAggs = () => {
  // non filter applied
  const genderAggsQuery = {
    size: 0,
    aggs: {
      genderAggs: {
        composite: {
          sources: [
            {
              gender: {
                terms: {
                  field: 'gender',
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
  const fakeGenderAggs = {
    aggregations: {
      genderAggs: {
        after_key: {
          gender: 'unknown',
        },
        buckets: [
          {
            key: {
              gender: 'no data',
            },
            doc_count: 40,
          },
          {
            key: {
              gender: 'unknown',
            },
            doc_count: 38,
          },
          {
            key: {
              gender: 'female',
            },
            doc_count: 35,
          },
          {
            key: {
              gender: 'male',
            },
            doc_count: 27,
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, genderAggsQuery)
    .reply(200, fakeGenderAggs);

  // filter applied
  const genderAggsQuery2 = {
    size: 0,
    query: {
      terms: {
        gender: [
          'female',
          'male',
        ],
      },
    },
    aggs: {
      genderAggs: {
        composite: {
          sources: [
            {
              gender: {
                terms: {
                  field: 'gender',
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
  const fakeGenderAggs2 = {
    aggregations: {
      genderAggs: {
        after_key: {
          gender: 'male',
        },
        buckets: [
          {
            key: {
              gender: 'no data',
            },
            doc_count: 40,
          },
          {
            key: {
              gender: 'female',
            },
            doc_count: 35,
          },
          {
            key: {
              gender: 'male',
            },
            doc_count: 27,
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, genderAggsQuery2)
    .reply(200, fakeGenderAggs2);

  // auth filter applied
  const genderAggsQuery3 = {
    size: 0,
    query: {
      terms: {
        gen3_resource_path: [
          'internal-project-1',
          'internal-project-2',
        ],
      },
    },
    aggs: {
      genderAggs: {
        composite: {
          sources: [
            {
              gender: {
                terms: {
                  field: 'gender',
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
  const fakeGenderAggs3 = {
    aggregations: {
      genderAggs: {
        after_key: {
          gender: 'male',
        },
        buckets: [
          {
            key: {
              gender: 'no data',
            },
            doc_count: 20,
          },
          {
            key: {
              gender: 'unknown',
            },
            doc_count: 19,
          },
          {
            key: {
              gender: 'female',
            },
            doc_count: 18,
          },
          {
            key: {
              gender: 'male',
            },
            doc_count: 15,
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, genderAggsQuery3)
    .reply(200, fakeGenderAggs3);
};

const mockNumericAggsGlobalStats = () => {
  // non filter or range applied
  const fileCountGlobalStatsAggsQuery = {
    size: 0,
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
    },
  };
  const fakeFileCountGlobalStatsAggs = {
    aggregations: {
      numeric_aggs_stats: {
        count: 100,
        min: 1,
        max: 99,
        avg: 50,
        sum: 5000,
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountGlobalStatsAggsQuery)
    .reply(200, fakeFileCountGlobalStatsAggs);

  // with filter applied
  const fileCountGlobalStatsAggsQuery1 = {
    size: 0,
    query: {
      term: {
        gender: 'female',
      },
    },
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
    },
  };
  const fakeFileCountGlobalStatsAggs1 = {
    aggregations: {
      numeric_aggs_stats: {
        count: 70,
        min: 2,
        max: 98,
        avg: 50,
        sum: 3000,
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountGlobalStatsAggsQuery1)
    .reply(200, fakeFileCountGlobalStatsAggs1);

  // with range applied
  const fileCountGlobalStatsAggsQuery2 = {
    size: 0,
    query: {
      bool: {
        must: [
          {
            range: {
              file_count: {
                gte: 50,
              },
            },
          },
          {
            range: {
              file_count: {
                lt: 70,
              },
            },
          },
        ],
      },
    },
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
    },
  };
  const fakeFileCountGlobalStatsAggs2 = {
    aggregations: {
      numeric_aggs_stats: {
        count: 70,
        min: 50,
        max: 70,
        avg: 50,
        sum: 3000,
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountGlobalStatsAggsQuery2)
    .reply(200, fakeFileCountGlobalStatsAggs2);

  // with range applied
  const fileCountGlobalStatsAggsQuery3 = {
    size: 0,
    query: {
      terms: {
        gen3_resource_path: ['internal-project-1', 'internal-project-2'],
      },
    },
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
    },
  };
  const fakeFileCountGlobalStatsAggs3 = {
    aggregations: {
      numeric_aggs_stats: {
        count: 70,
        min: 20,
        max: 80,
        avg: 50,
        sum: 3000,
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountGlobalStatsAggsQuery3)
    .reply(200, fakeFileCountGlobalStatsAggs3);
};

const mockHistogramFixWidth = () => {
  // non filter nor range applied
  const fileCountHistogramFixWidthQuery = {
    size: 0,
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
      numeric_aggs: {
        histogram: {
          field: 'file_count',
          interval: 30,
        },
        aggs: {
          numeric_item_aggs_stats: {
            stats: {
              field: 'file_count',
            },
          },
        },
      },
    },
  };
  const fileCountHistogramFixWidthResult = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 0.0,
            doc_count: 25,
            numeric_item_aggs_stats: {
              count: 25,
              min: 1.0,
              max: 28.0,
              avg: 16.2,
              sum: 405.0,
            },
          },
          {
            key: 30.0,
            doc_count: 39,
            numeric_item_aggs_stats: {
              count: 39,
              min: 30.0,
              max: 59.0,
              avg: 44.4,
              sum: 1732.0,
            },
          },
          {
            key: 60.0,
            doc_count: 23,
            numeric_item_aggs_stats: {
              count: 23,
              min: 60.0,
              max: 89.0,
              avg: 75.3,
              sum: 1734.0,
            },
          },
          {
            key: 90.0,
            doc_count: 13,
            numeric_item_aggs_stats: {
              count: 13,
              min: 92.0,
              max: 99.0,
              avg: 96.0,
              sum: 1248.0,
            },
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountHistogramFixWidthQuery)
    .reply(200, fileCountHistogramFixWidthResult);

  // with filter applied
  const fileCountHistogramFixWidthQuery1 = {
    size: 0,
    query: {
      term: {
        gender: 'female',
      },
    },
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
      numeric_aggs: {
        histogram: {
          field: 'file_count',
          interval: 30,
        },
        aggs: {
          numeric_item_aggs_stats: {
            stats: {
              field: 'file_count',
            },
          },
        },
      },
    },
  };
  const fileCountHistogramFixWidthResult1 = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 0.0,
            doc_count: 15,
            numeric_item_aggs_stats: {
              count: 15,
              min: 1.0,
              max: 28.0,
              avg: 16.2,
              sum: 405.0,
            },
          },
          {
            key: 30.0,
            doc_count: 29,
            numeric_item_aggs_stats: {
              count: 29,
              min: 30.0,
              max: 59.0,
              avg: 44.4,
              sum: 1732.0,
            },
          },
          {
            key: 60.0,
            doc_count: 13,
            numeric_item_aggs_stats: {
              count: 13,
              min: 60.0,
              max: 89.0,
              avg: 75.3,
              sum: 1734.0,
            },
          },
          {
            key: 90.0,
            doc_count: 3,
            numeric_item_aggs_stats: {
              count: 3,
              min: 92.0,
              max: 99.0,
              avg: 96.0,
              sum: 1248.0,
            },
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountHistogramFixWidthQuery1)
    .reply(200, fileCountHistogramFixWidthResult1);

  // with range applied
  const fileCountHistogramFixWidthQuery2 = {
    size: 0,
    query: {
      bool: {
        must: [
          {
            range: {
              file_count: {
                gte: 40,
              },
            },
          },
          {
            range: {
              file_count: {
                lt: 70,
              },
            },
          },
        ],
      },
    },
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
      numeric_aggs: {
        histogram: {
          field: 'file_count',
          interval: 30,
          offset: 10,
        },
        aggs: {
          numeric_item_aggs_stats: {
            stats: {
              field: 'file_count',
            },
          },
        },
      },
    },
  };
  const fileCountHistogramFixWidthResult2 = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 40.0,
            doc_count: 29,
            numeric_item_aggs_stats: {
              count: 29,
              min: 40.0,
              max: 69.0,
              avg: 44.4,
              sum: 1732.0,
            },
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountHistogramFixWidthQuery2)
    .reply(200, fileCountHistogramFixWidthResult2);

  // with auth filter applied
  const fileCountHistogramFixWidthQuery3 = {
    size: 0,
    query: {
      terms: {
        gen3_resource_path: [
          'internal-project-1',
          'internal-project-2',
        ],
      },
    },
    aggs: {
      numeric_aggs_stats: {
        stats: {
          field: 'file_count',
        },
      },
      numeric_aggs: {
        histogram: {
          field: 'file_count',
          interval: 30,
        },
        aggs: {
          numeric_item_aggs_stats: {
            stats: {
              field: 'file_count',
            },
          },
        },
      },
    },
  };
  const fileCountHistogramFixWidthResult3 = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 0.0,
            doc_count: 25,
            numeric_item_aggs_stats: {
              count: 25,
              min: 1.0,
              max: 28.0,
              avg: 16.2,
              sum: 405.0,
            },
          },
          {
            key: 30.0,
            doc_count: 39,
            numeric_item_aggs_stats: {
              count: 39,
              min: 30.0,
              max: 59.0,
              avg: 44.4,
              sum: 1732.0,
            },
          },
          {
            key: 60.0,
            doc_count: 23,
            numeric_item_aggs_stats: {
              count: 23,
              min: 60.0,
              max: 89.0,
              avg: 75.3,
              sum: 1734.0,
            },
          },
          {
            key: 90.0,
            doc_count: 13,
            numeric_item_aggs_stats: {
              count: 13,
              min: 92.0,
              max: 99.0,
              avg: 96.0,
              sum: 1248.0,
            },
          },
        ],
      },
    },
  };
  nock(config.esConfig.host)
    .persist()
    .post(/_search$/, fileCountHistogramFixWidthQuery3)
    .reply(200, fileCountHistogramFixWidthResult3);
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
