import mockSearchEndpoint from './utils';

const mockNestedAggs = () => {
  // only missing fields in nestedAggFields variables
  const missingAggsQuery = {
    size: 0,
    aggs: {
      projectAggs: {
        composite: {
          sources: [
            {
              project: {
                terms: {
                  field: 'project',
                  missing: 'no data',
                },
              },
            },
          ],
          size: 10000,
        },
        aggs: {
          someNonExistingFieldMissing: {
            missing: {
              field: 'someNonExistingField',
            },
          },
          genderMissing: {
            missing: {
              field: 'gender',
            },
          },
        },
      },
    },
  };
  const fakeMissingAggs = {
    aggregations: {
      projectAggs: {
        after_key: {
          project: 'internal-project-2',
        },
        buckets: [
          {
            key: {
              project: 'internal-project-1',
            },
            doc_count: 41,
            genderMissing: {
              doc_count: 0,
            },
            someNonExistingFieldMissing: {
              doc_count: 41,
            },
          },
          {
            key: {
              project: 'internal-project-2',
            },
            doc_count: 35,
            genderMissing: {
              doc_count: 0,
            },
            someNonExistingFieldMissing: {
              doc_count: 35,
            },
          },
        ],
      },
    },
  };
  mockSearchEndpoint(missingAggsQuery, fakeMissingAggs);

  // only terms fields in nestedAggFields variables
  const termsAggsQuery = {
    size: 0,
    aggs: {
      projectAggs: {
        composite: {
          sources: [
            {
              project: {
                terms: {
                  field: 'project',
                  missing: 'no data',
                },
              },
            },
          ],
          size: 10000,
        },
        aggs: {
          genderTerms: {
            terms: {
              field: 'gender',
            },
          },
          someNonExistingFieldTerms: {
            terms: {
              field: 'someNonExistingField',
            },
          },
        },
      },
    },
  };
  const fakeTermsAggs = {
    aggregations: {
      projectAggs: {
        after_key: {
          project: 'internal-project-2',
        },
        buckets: [
          {
            key: {
              project: 'internal-project-1',
            },
            doc_count: 41,
            genderTerms: {
              doc_count_error_upper_bound: 0,
              sum_other_doc_count: 0,
              buckets: [
                {
                  key: 'male',
                  doc_count: 22,
                },
                {
                  key: 'unknown',
                  doc_count: 10,
                },
                {
                  key: 'female',
                  doc_count: 9,
                },
              ],
            },
            someNonExistingFieldTerms: {
              buckets: [],
            },
          },
          {
            key: {
              project: 'internal-project-2',
            },
            doc_count: 35,
            genderTerms: {
              buckets: [
                {
                  key: 'male',
                  doc_count: 13,
                },
                {
                  key: 'female',
                  doc_count: 11,
                },
                {
                  key: 'unknown',
                  doc_count: 11,
                },
              ],
            },
            someNonExistingFieldTerms: {
              buckets: [],
            },
          },

        ],
      },
    },
  };
  mockSearchEndpoint(termsAggsQuery, fakeTermsAggs);

  // combined missing and terms fields in nestedAggFields variables
  const combinedAggsQuery = {
    size: 0,
    aggs: {
      projectAggs: {
        composite: {
          sources: [
            {
              project: {
                terms: {
                  field: 'project',
                  missing: 'no data',
                },
              },
            },
          ],
          size: 10000,
        },
        aggs: {
          genderMissing: {
            missing: {
              field: 'gender',
            },
          },
          someNonExistingFieldMissing: {
            missing: {
              field: 'someNonExistingField',
            },
          },
          genderTerms: {
            terms: {
              field: 'gender',
            },
          },
          someNonExistingFieldTerms: {
            terms: {
              field: 'someNonExistingField',
            },
          },
        },
      },
    },
  };
  const combinedTermsAggs = {
    aggregations: {
      projectAggs: {
        after_key: {
          project: 'internal-project-2',
        },
        buckets: [
          {
            key: {
              project: 'internal-project-1',
            },
            doc_count: 41,
            genderTerms: {
              buckets: [
                {
                  key: 'male',
                  doc_count: 22,
                },
                {
                  key: 'unknown',
                  doc_count: 10,
                },
                {
                  key: 'female',
                  doc_count: 9,
                },
              ],
            },
            someNonExistingFieldTerms: {
              buckets: [],
            },
            genderMissing: {
              doc_count: 0,
            },
            someNonExistingFieldMissing: {
              doc_count: 41,
            },
          },
          {
            key: {
              project: 'internal-project-2',
            },
            doc_count: 35,
            genderTerms: {
              buckets: [
                {
                  key: 'male',
                  doc_count: 13,
                },
                {
                  key: 'female',
                  doc_count: 11,
                },
                {
                  key: 'unknown',
                  doc_count: 11,
                },
              ],
            },
            someNonExistingFieldTerms: {
              buckets: [],
            },
            genderMissing: {
              doc_count: 0,
            },
            someNonExistingFieldMissing: {
              doc_count: 35,
            },
          },
        ],
      },
    },
  };
  mockSearchEndpoint(combinedAggsQuery, combinedTermsAggs);
};

export default mockNestedAggs;
