import mockSearchEndpoint from './utils';

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
  mockSearchEndpoint(genderAggsQuery, fakeGenderAggs);

  // filter applied
  const genderAggsQuery2 = {
    size: 0,
    query: {
      bool: {
        must: [
          {
            terms: {
              gender: [
                'female',
                'male',
              ],
            },
          },
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
  mockSearchEndpoint(genderAggsQuery2, fakeGenderAggs2);

  // auth filter applied
  const genderAggsQuery3 = {
    size: 0,
    query: {
      bool: {
        must: [
          {
            terms: {
              gen3_resource_path: [
                'internal-project-1',
                'internal-project-2',
              ],
            },
          },
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
  mockSearchEndpoint(genderAggsQuery3, fakeGenderAggs3);
};

export default mockTextAggs;
