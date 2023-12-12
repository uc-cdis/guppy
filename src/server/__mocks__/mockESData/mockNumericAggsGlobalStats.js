import mockSearchEndpoint from './utils';

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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountGlobalStatsAggsQuery, fakeFileCountGlobalStatsAggs);

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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountGlobalStatsAggsQuery1, fakeFileCountGlobalStatsAggs1);

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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountGlobalStatsAggsQuery2, fakeFileCountGlobalStatsAggs2);

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
    track_total_hits: true,
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
  mockSearchEndpoint(fileCountGlobalStatsAggsQuery3, fakeFileCountGlobalStatsAggs3);
};

export default mockNumericAggsGlobalStats;
