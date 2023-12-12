import mockSearchEndpoint from './utils';

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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountHistogramFixWidthQuery, fileCountHistogramFixWidthResult);

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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountHistogramFixWidthQuery1, fileCountHistogramFixWidthResult1);

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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountHistogramFixWidthQuery2, fileCountHistogramFixWidthResult2);

  // with auth filter applied
  const fileCountHistogramFixWidthQuery3 = {
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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountHistogramFixWidthQuery3, fileCountHistogramFixWidthResult3);
};

export default mockHistogramFixWidth;
