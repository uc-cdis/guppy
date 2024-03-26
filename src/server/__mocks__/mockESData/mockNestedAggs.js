import mockSearchEndpoint from './utils';

const mockNestedAggs = () => {
  // one-level text
  const nestedAggsQuery1 = {
    size: 0,
    aggs: {
      visit_labelNestedAggs: {
        nested: {
          path: 'visits',
        },
        aggs: {
          visit_labelAggs: {
            composite: {
              sources: [
                {
                  'visits.visit_label': {
                    terms: {
                      field: 'visits.visit_label',
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
      },
    },
    track_total_hits: true,
  };
  const fakeNestedAggs1 = {
    aggregations: {
      visit_labelNestedAggs: {
        doc_count: 69,
        visit_labelAggs: {
          after_key: {
            'visits.visit_label': 'vst_lbl_3',
          },
          buckets: [
            {
              key: {
                'visits.visit_label': 'vst_lbl_1',
              },
              doc_count: 21,
            },
            {
              key: {
                'visits.visit_label': 'vst_lbl_2',
              },
              doc_count: 19,
            },
            {
              key: {
                'visits.visit_label': 'vst_lbl_3',
              },
              doc_count: 29,
            },
            {
              key: {
                'visits.visit_label': null,
              },
              doc_count: 40,
            },
          ],
        },
      },
    },
    track_total_hits: true,
  };
  mockSearchEndpoint(nestedAggsQuery1, fakeNestedAggs1);

  // two-level numeric global stats
  const nestedAggsQuery2 = {
    size: 0,
    aggs: {
      numeric_nested_aggs: {
        nested: {
          path: 'visits.follow_ups',
        },
        aggs: {
          numeric_aggs_stats: {
            stats: {
              field: 'visits.follow_ups.days_to_follow_up',
            },
          },
        },
      },
    },
    track_total_hits: true,
  };
  const fakeNestedAggs2 = {
    aggregations: {
      numeric_nested_aggs: {
        doc_count: 69,
        numeric_aggs_stats: {
          count: 69,
          min: 1.0,
          max: 3.0,
          avg: 2.1159420289855073,
          sum: 146.0,
        },
      },
    },
    track_total_hits: true,
  };
  mockSearchEndpoint(nestedAggsQuery2, fakeNestedAggs2);

  // two-level numeric fixed bin width
  const nestedAggsQuery3 = {
    size: 0,
    aggs: {
      numeric_nested_aggs: {
        nested: {
          path: 'visits.follow_ups',
        },
        aggs: {
          numeric_aggs_stats: {
            stats: {
              field: 'visits.follow_ups.days_to_follow_up',
            },
          },
          numeric_aggs: {
            histogram: {
              field: 'visits.follow_ups.days_to_follow_up',
              interval: 1,
            },
            aggs: {
              numeric_item_aggs_stats: {
                stats: {
                  field: 'visits.follow_ups.days_to_follow_up',
                },
              },
            },
          },
        },
      },
    },
    track_total_hits: true,
  };
  const fakeNestedAggs3 = {
    aggregations: {
      numeric_nested_aggs: {
        doc_count: 69,
        numeric_aggs: {
          buckets: [
            {
              key: 1.0,
              doc_count: 21,
              numeric_item_aggs_stats: {
                count: 21,
                min: 1.0,
                max: 1.0,
                avg: 1.0,
                sum: 21.0,
              },
            },
            {
              key: 2.0,
              doc_count: 19,
              numeric_item_aggs_stats: {
                count: 19,
                min: 2.0,
                max: 2.0,
                avg: 2.0,
                sum: 38.0,
              },
            },
            {
              key: 3.0,
              doc_count: 29,
              numeric_item_aggs_stats: {
                count: 29,
                min: 3.0,
                max: 3.0,
                avg: 3.0,
                sum: 87.0,
              },
            },
          ],
        },
        numeric_aggs_stats: {
          count: 69,
          min: 1.0,
          max: 3.0,
          avg: 2.1159420289855073,
          sum: 146.0,
        },
      },
    },
    track_total_hits: true,
  };
  mockSearchEndpoint(nestedAggsQuery3, fakeNestedAggs3);
};

export default mockNestedAggs;
