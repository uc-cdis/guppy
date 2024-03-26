import mockSearchEndpoint from './utils';

const mockHistogramFixBinCount = () => {
  // non filter nor range applied
  const fileCountHistogramFixBinCountQuery = {
    size: 0,
    query: {
      bool: {
        must: [
          {
            range: {
              file_count: {
                gte: 1,
              },
            },
          },
          {
            range: {
              file_count: {
                lt: 100,
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
          interval: 24.75,
          offset: 1,
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
  const fileCountHistogramFixBinCountResult = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 1.0,
            doc_count: 20,
            numeric_item_aggs_stats: {
              count: 20,
              min: 1.0,
              max: 23.0,
              avg: 13.45,
              sum: 269.0,
            },
          },
          {
            key: 25.75,
            doc_count: 35,
            numeric_item_aggs_stats: {
              count: 35,
              min: 26.0,
              max: 50.0,
              avg: 39.23,
              sum: 1373.0,
            },
          },
          {
            key: 50.5,
            doc_count: 20,
            numeric_item_aggs_stats: {
              count: 20,
              min: 51.0,
              max: 73.0,
              avg: 60.95,
              sum: 1219.0,
            },
          },
          {
            key: 75.25,
            doc_count: 25,
            numeric_item_aggs_stats: {
              count: 25,
              min: 76.0,
              max: 99.0,
              avg: 90.32,
              sum: 2258.0,
            },
          },
        ],
      },
      numeric_aggs_stats: {
        count: 100,
        min: 1.0,
        max: 99.0,
        avg: 51.19,
        sum: 5119.0,
      },
    },
  };
  mockSearchEndpoint(fileCountHistogramFixBinCountQuery, fileCountHistogramFixBinCountResult);

  // with filter applied
  const fileCountHistogramFixBinCountQuery1 = {
    size: 0,
    query: {
      bool: {
        must: [
          {
            term: {
              gender: 'female',
            },
          },
          [
            {
              range: {
                file_count: {
                  gte: 2,
                },
              },
            },
            {
              range: {
                file_count: {
                  lt: 99,
                },
              },
            },
          ],
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
          interval: 24.25,
          offset: 2,
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
  const fileCountHistogramFixBinCountResult1 = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 2.0,
            doc_count: 9,
            numeric_item_aggs_stats: {
              count: 9,
              min: 3.0,
              max: 26.0,
              avg: 13.89,
              sum: 125.0,
            },
          },
          {
            key: 26.25,
            doc_count: 11,
            numeric_item_aggs_stats: {
              count: 11,
              min: 27.0,
              max: 49.0,
              avg: 37.27,
              sum: 410.0,
            },
          },
          {
            key: 50.5,
            doc_count: 8,
            numeric_item_aggs_stats: {
              count: 8,
              min: 51.0,
              max: 73.0,
              avg: 61.25,
              sum: 490.0,
            },
          },
          {
            key: 74.75,
            doc_count: 6,
            numeric_item_aggs_stats: {
              count: 6,
              min: 76.0,
              max: 98.0,
              avg: 85.5,
              sum: 513.0,
            },
          },
        ],
      },
      numeric_aggs_stats: {
        count: 34,
        min: 3.0,
        max: 98.0,
        avg: 45.24,
        sum: 1538.0,
      },
    },
  };
  mockSearchEndpoint(fileCountHistogramFixBinCountQuery1, fileCountHistogramFixBinCountResult1);

  // with range applied
  const fileCountHistogramFixBinCountQuery2 = {
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
      numeric_aggs: {
        histogram: {
          field: 'file_count',
          interval: 5,
          offset: 5,
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
  const fileCountHistogramFixBinCountResult2 = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 50.0,
            doc_count: 6,
            numeric_item_aggs_stats: {
              count: 6,
              min: 50.0,
              max: 54.0,
              avg: 52.0,
              sum: 312.0,
            },
          },
          {
            key: 55.0,
            doc_count: 4,
            numeric_item_aggs_stats: {
              count: 4,
              min: 57.0,
              max: 59.0,
              avg: 58.25,
              sum: 233.0,
            },
          },
          {
            key: 60.0,
            doc_count: 5,
            numeric_item_aggs_stats: {
              count: 5,
              min: 60.0,
              max: 64.0,
              avg: 61.6,
              sum: 308.0,
            },
          },
          {
            key: 65.0,
            doc_count: 4,
            numeric_item_aggs_stats: {
              count: 4,
              min: 67.0,
              max: 69.0,
              avg: 68.25,
              sum: 273.0,
            },
          },
        ],
      },
      numeric_aggs_stats: {
        count: 19,
        min: 50.0,
        max: 69.0,
        avg: 59.26,
        sum: 1126.0,
      },
    },
  };
  mockSearchEndpoint(fileCountHistogramFixBinCountQuery2, fileCountHistogramFixBinCountResult2);

  // with defaultAuthFilter applied
  const fileCountHistogramFixBinCountQuery3 = {
    size: 0,
    query: {
      bool: {
        must: [
          {
            terms: {
              gen3_resource_path: ['internal-project-1', 'internal-project-2'],
            },
          },
          [
            {
              range: {
                file_count: {
                  gte: 20,
                },
              },
            },
            {
              range: {
                file_count: {
                  lt: 81,
                },
              },
            },
          ],
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
          interval: 15.25,
          offset: 4.75,
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
  const fileCountHistogramFixBinCountResult3 = {
    aggregations: {
      numeric_aggs: {
        buckets: [
          {
            key: 20.0,
            doc_count: 7,
            numeric_item_aggs_stats: {
              count: 7,
              min: 21.0,
              max: 34.0,
              avg: 28.29,
              sum: 198.0,
            },
          },
          {
            key: 35.25,
            doc_count: 15,
            numeric_item_aggs_stats: {
              count: 15,
              min: 39.0,
              max: 50.0,
              avg: 43.53,
              sum: 653.0,
            },
          },
          {
            key: 50.5,
            doc_count: 12,
            numeric_item_aggs_stats: {
              count: 12,
              min: 51.0,
              max: 64.0,
              avg: 56.83,
              sum: 682.0,
            },
          },
          {
            key: 65.75,
            doc_count: 3,
            numeric_item_aggs_stats: {
              count: 3,
              min: 69.0,
              max: 76.0,
              avg: 71.33,
              sum: 214.0,
            },
          },
        ],
      },
      numeric_aggs_stats: {
        count: 37,
        min: 21.0,
        max: 76.0,
        avg: 47.22,
        sum: 1747.0,
      },
    },
  };
  mockSearchEndpoint(fileCountHistogramFixBinCountQuery3, fileCountHistogramFixBinCountResult3);
};

export default mockHistogramFixBinCount;
