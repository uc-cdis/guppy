// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock
import setupMockDataEndpoint from '../../__mocks__/mockDataFromES';
import {
  appendAdditionalRangeQuery,
  textAggregation,
  numericGlobalStats,
  numericHistogramWithFixedRangeStep,
  numericHistogramWithFixedBinCount,
} from '../aggs';
import esInstance from '../index';

jest.mock('../../config');
jest.mock('../../logger');

setupMockDataEndpoint();
const esIndex = 'gen3-dev-subject';
const esType = 'subject';

describe('could append range limitation onto ES query object', () => {
  const field = 'file_count';
  const exampleQuery = {
    term: {
      gender: 'female',
    },
  };
  const rangeStart = 10;
  const rangeEnd = 40;
  const expectedRangeStartPart = {
    range: {
      [field]: { gte: rangeStart },
    },
  };
  const expectedRangeEndPart = {
    range: {
      [field]: { lt: rangeEnd },
    },
  };
  test('with rangeStart, rangeEnd, and origin query', () => {
    const result = appendAdditionalRangeQuery(field, exampleQuery, rangeStart, rangeEnd);
    const expectedResult = {
      bool: {
        must: [
          exampleQuery,
          [expectedRangeStartPart, expectedRangeEndPart],
        ],
      },
    };
    expect(result).toEqual(expectedResult);
  });

  test('with either rangeStart or rangeEnd', () => {
    const result1 = appendAdditionalRangeQuery(field, exampleQuery, rangeStart);
    const expectedResult1 = {
      bool: {
        must: [
          exampleQuery,
          [expectedRangeStartPart],
        ],
      },
    };
    expect(result1).toEqual(expectedResult1);

    const result2 = appendAdditionalRangeQuery(field, exampleQuery, undefined, rangeEnd);
    const expectedResult2 = {
      bool: {
        must: [
          exampleQuery,
          [expectedRangeEndPart],
        ],
      },
    };
    expect(result2).toEqual(expectedResult2);
  });

  test('with empty query', () => {
    const result = appendAdditionalRangeQuery(field, undefined, rangeStart, rangeEnd);
    const expectedResult = {
      bool: {
        must: [
          expectedRangeStartPart,
          expectedRangeEndPart,
        ],
      },
    };
    expect(result).toEqual(expectedResult);

    // all empty
    const result2 = appendAdditionalRangeQuery(field, undefined);
    const expectedResult2 = undefined;
    expect(result2).toEqual(expectedResult2);
  });
});

// see /src/server/__mocks__/mockESData/mockTextAggs.js for mock results
describe('could aggregate for text fields', () => {
  test('basic aggregation', async () => {
    await esInstance.initialize();
    const field = 'gender';
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { field },
    );
    const expectedResults = [
      {
        key: 'unknown',
        count: 38,
      },
      {
        key: 'female',
        count: 35,
      },
      {
        key: 'male',
        count: 27,
      },
      {
        key: 'no data',
        count: 40,
      }, // missing data always at end
    ];
    expect(result).toEqual(expectedResults);
  });

  test('aggregation with filter applied', async () => {
    await esInstance.initialize();
    const field = 'gender';
    const filter = {
      in: {
        gender: ['female', 'male'],
      },
    };
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { filter, field },
    );
    const expectedResults = [
      {
        key: 'female',
        count: 35,
      },
      {
        key: 'male',
        count: 27,
      },
      {
        key: 'no data',
        count: 40,
      }, // missing data always at end
    ];
    expect(result).toEqual(expectedResults);
  });

  test('aggregation with filter applied, and filterSelf is false', async () => {
    await esInstance.initialize();
    const field = 'gender';
    const filter = {
      in: {
        gender: ['female', 'male'],
      },
    };
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { filter, field, filterSelf: false },
    );
    const expectedResults = [
      {
        key: 'unknown',
        count: 38,
      },
      {
        key: 'female',
        count: 35,
      },
      {
        key: 'male',
        count: 27,
      },
      {
        key: 'no data',
        count: 40,
      }, // missing data always at end
    ];
    expect(result).toEqual(expectedResults);
  });

  test('aggregation with default auth filter', async () => {
    await esInstance.initialize();
    const field = 'gender';
    const authFilter = {
      in: {
        gen3_resource_path: ['internal-project-1', 'internal-project-2'],
      },
    };
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { field, defaultAuthFilter: authFilter },
    );
    const expectedResults = [
      {
        key: 'unknown',
        count: 19,
      },
      {
        key: 'female',
        count: 18,
      },
      {
        key: 'male',
        count: 15,
      },
      {
        key: 'no data',
        count: 20,
      }, // missing data always at end
    ];
    expect(result).toEqual(expectedResults);
  });
});

// see /src/server/__mocks__/mockESData/mockNumericAggsGlobalStats.js for mock results
describe('could aggregate for numeric fields, global stats', () => {
  const field = 'file_count';
  test('basic global stats', async () => {
    await esInstance.initialize();
    const result = await numericGlobalStats(
      { esInstance, esIndex, esType },
      { field },
    );
    const expectedResults = {
      key: [1, 99],
      min: 1,
      max: 99,
      avg: 50,
      sum: 5000,
      count: 100,
    };
    expect(result).toEqual(expectedResults);
  });

  test('global stats with filter', async () => {
    await esInstance.initialize();
    const filter = { eq: { gender: 'female' } };
    const result = await numericGlobalStats(
      { esInstance, esIndex, esType },
      { field, filter },
    );
    const expectedResults = {
      key: [2, 98],
      min: 2,
      max: 98,
      avg: 50,
      sum: 3000,
      count: 70,
    };
    expect(result).toEqual(expectedResults);
  });

  test('global stats with range', async () => {
    await esInstance.initialize();
    const result = await numericGlobalStats(
      { esInstance, esIndex, esType },
      { field, rangeStart: 50, rangeEnd: 70 },
    );
    const expectedResults = {
      key: [50, 70],
      min: 50,
      max: 70,
      avg: 50,
      sum: 3000,
      count: 70,
    };
    expect(result).toEqual(expectedResults);
  });

  test('global stats with filterSelf', async () => {
    await esInstance.initialize();
    const filter = { gte: { file_count: 50 } };
    const result = await numericGlobalStats(
      { esInstance, esIndex, esType },
      { field, filter, filterSelf: false },
    );
    const expectedResults = {
      key: [1, 99],
      min: 1,
      max: 99,
      avg: 50,
      sum: 5000,
      count: 100,
    };
    expect(result).toEqual(expectedResults);
  });

  test('global stats with defaultAuthFilter', async () => {
    await esInstance.initialize();
    const defaultAuthFilter = {
      in: {
        gen3_resource_path: ['internal-project-1', 'internal-project-2'],
      },
    };
    const result = await numericGlobalStats(
      { esInstance, esIndex, esType },
      { field, defaultAuthFilter },
    );
    const expectedResults = {
      key: [20, 80],
      min: 20,
      max: 80,
      avg: 50,
      sum: 3000,
      count: 70,
    };
    expect(result).toEqual(expectedResults);
  });
});

// see /src/server/__mocks__/mockESData/mockNumericHistogramFixWidth.js for mock results
describe('could aggregate for numeric fields, fixed histogram width', () => {
  const field = 'file_count';
  test('fixed histogram width', async () => {
    await esInstance.initialize();
    const result = await numericHistogramWithFixedRangeStep(
      { esInstance, esIndex, esType },
      { field, rangeStep: 30 },
    );
    const expectedResults = [
      {
        avg: 16.2,
        count: 25,
        key: [
          0,
          30,
        ],
        max: 28,
        min: 1,
        sum: 405,
      },
      {
        avg: 44.4,
        count: 39,
        key: [
          30,
          60,
        ],
        max: 59,
        min: 30,
        sum: 1732,
      },
      {
        avg: 75.3,
        count: 23,
        key: [
          60,
          90,
        ],
        max: 89,
        min: 60,
        sum: 1734,
      },
      {
        avg: 96,
        count: 13,
        key: [
          90,
          120,
        ],
        max: 99,
        min: 92,
        sum: 1248,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed histogram width, with filter', async () => {
    await esInstance.initialize();
    const filter = { eq: { gender: 'female' } };
    const result = await numericHistogramWithFixedRangeStep(
      { esInstance, esIndex, esType },
      { field, rangeStep: 30, filter },
    );
    const expectedResults = [
      {
        avg: 16.2,
        count: 15,
        key: [
          0,
          30,
        ],
        max: 28,
        min: 1,
        sum: 405,
      },
      {
        avg: 44.4,
        count: 29,
        key: [
          30,
          60,
        ],
        max: 59,
        min: 30,
        sum: 1732,
      },
      {
        avg: 75.3,
        count: 13,
        key: [
          60,
          90,
        ],
        max: 89,
        min: 60,
        sum: 1734,
      },
      {
        avg: 96,
        count: 3,
        key: [
          90,
          120,
        ],
        max: 99,
        min: 92,
        sum: 1248,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed histogram width, with range', async () => {
    await esInstance.initialize();
    const result = await numericHistogramWithFixedRangeStep(
      { esInstance, esIndex, esType },
      {
        field, rangeStep: 30, rangeStart: 40, rangeEnd: 70,
      },
    );
    const expectedResults = [
      {
        avg: 44.4,
        count: 29,
        key: [
          40,
          70,
        ],
        max: 69,
        min: 40,
        sum: 1732,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed histogram width, with filterSelf', async () => {
    await esInstance.initialize();
    const filter = { gte: { file_count: 50 } };
    const result = await numericHistogramWithFixedRangeStep(
      { esInstance, esIndex, esType },
      {
        field, filter, filterSelf: false, rangeStep: 30,
      },
    );
    const expectedResults = [
      {
        avg: 16.2,
        count: 25,
        key: [
          0,
          30,
        ],
        max: 28,
        min: 1,
        sum: 405,
      },
      {
        avg: 44.4,
        count: 39,
        key: [
          30,
          60,
        ],
        max: 59,
        min: 30,
        sum: 1732,
      },
      {
        avg: 75.3,
        count: 23,
        key: [
          60,
          90,
        ],
        max: 89,
        min: 60,
        sum: 1734,
      },
      {
        avg: 96,
        count: 13,
        key: [
          90,
          120,
        ],
        max: 99,
        min: 92,
        sum: 1248,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed histogram width, with defaultAuthFilter', async () => {
    await esInstance.initialize();
    const defaultAuthFilter = {
      in: {
        gen3_resource_path: ['internal-project-1', 'internal-project-2'],
      },
    };
    const result = await numericHistogramWithFixedRangeStep(
      { esInstance, esIndex, esType },
      {
        field, rangeStep: 30, defaultAuthFilter,
      },
    );
    const expectedResults = [
      {
        avg: 16.2,
        count: 25,
        key: [
          0,
          30,
        ],
        max: 28,
        min: 1,
        sum: 405,
      },
      {
        avg: 44.4,
        count: 39,
        key: [
          30,
          60,
        ],
        max: 59,
        min: 30,
        sum: 1732,
      },
      {
        avg: 75.3,
        count: 23,
        key: [
          60,
          90,
        ],
        max: 89,
        min: 60,
        sum: 1734,
      },
      {
        avg: 96,
        count: 13,
        key: [
          90,
          120,
        ],
        max: 99,
        min: 92,
        sum: 1248,
      },
    ];
    expect(result).toEqual(expectedResults);
  });
});

// see /src/server/__mocks__/mockESData/mockNumericHistogramFixBinCount.js for mock results
describe('could aggregate for numeric fields, fixed bin count', () => {
  const field = 'file_count';
  test('fixed bin count', async () => {
    await esInstance.initialize();
    const result = await numericHistogramWithFixedBinCount(
      { esInstance, esIndex, esType },
      { field, binCount: 4 },
    );
    const expectedResults = [
      {
        key: [
          1,
          25.75,
        ],
        count: 20,
        min: 1,
        max: 23,
        avg: 13.45,
        sum: 269,
      },
      {
        key: [
          25.75,
          50.5,
        ],
        count: 35,
        min: 26,
        max: 50,
        avg: 39.23,
        sum: 1373,
      },
      {
        key: [
          50.5,
          75.25,
        ],
        count: 20,
        min: 51,
        max: 73,
        avg: 60.95,
        sum: 1219,
      },
      {
        key: [
          75.25,
          100,
        ],
        count: 25,
        min: 76,
        max: 99,
        avg: 90.32,
        sum: 2258,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed bin count, with filter applied', async () => {
    await esInstance.initialize();
    const filter = { eq: { gender: 'female' } };
    const result = await numericHistogramWithFixedBinCount(
      { esInstance, esIndex, esType },
      { field, binCount: 4, filter },
    );
    const expectedResults = [
      {
        key: [
          2,
          26.25,
        ],
        count: 9,
        min: 3.0,
        max: 26.0,
        avg: 13.89,
        sum: 125.0,
      },
      {
        key: [
          26.25,
          50.5,
        ],
        count: 11,
        min: 27.0,
        max: 49.0,
        avg: 37.27,
        sum: 410.0,
      },
      {
        key: [
          50.5,
          74.75,
        ],
        count: 8,
        min: 51.0,
        max: 73.0,
        avg: 61.25,
        sum: 490.0,
      },
      {
        key: [
          74.75,
          99,
        ],
        count: 6,
        min: 76.0,
        max: 98.0,
        avg: 85.5,
        sum: 513.0,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed bin count, with range applied', async () => {
    await esInstance.initialize();
    const result = await numericHistogramWithFixedBinCount(
      { esInstance, esIndex, esType },
      {
        field, binCount: 4, rangeStart: 50, rangeEnd: 70,
      },
    );
    const expectedResults = [
      {
        key: [
          50,
          55,
        ],
        count: 6,
        min: 50.0,
        max: 54.0,
        avg: 52.0,
        sum: 312.0,
      },
      {
        key: [
          55,
          60,
        ],
        count: 4,
        min: 57.0,
        max: 59.0,
        avg: 58.25,
        sum: 233.0,
      },
      {
        key: [
          60,
          65,
        ],
        count: 5,
        min: 60.0,
        max: 64.0,
        avg: 61.6,
        sum: 308.0,
      },
      {
        key: [
          65,
          70,
        ],
        count: 4,
        min: 67.0,
        max: 69.0,
        avg: 68.25,
        sum: 273.0,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed bin count, with filterSelf applied', async () => {
    await esInstance.initialize();
    const filter = { gte: { file_count: 50 } };
    const result = await numericHistogramWithFixedBinCount(
      { esInstance, esIndex, esType },
      {
        field, binCount: 4, filter, filterSelf: false,
      },
    );
    const expectedResults = [
      {
        key: [
          1,
          25.75,
        ],
        count: 20,
        min: 1,
        max: 23,
        avg: 13.45,
        sum: 269,
      },
      {
        key: [
          25.75,
          50.5,
        ],
        count: 35,
        min: 26,
        max: 50,
        avg: 39.23,
        sum: 1373,
      },
      {
        key: [
          50.5,
          75.25,
        ],
        count: 20,
        min: 51,
        max: 73,
        avg: 60.95,
        sum: 1219,
      },
      {
        key: [
          75.25,
          100,
        ],
        count: 25,
        min: 76,
        max: 99,
        avg: 90.32,
        sum: 2258,
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('fixed bin count, with defaultAuthFilter applied', async () => {
    await esInstance.initialize();
    const defaultAuthFilter = {
      in: {
        gen3_resource_path: ['internal-project-1', 'internal-project-2'],
      },
    };
    const result = await numericHistogramWithFixedBinCount(
      { esInstance, esIndex, esType },
      { field, binCount: 4, defaultAuthFilter },
    );
    const expectedResults = [
      {
        key: [
          20,
          35.25,
        ],
        count: 7,
        min: 21.0,
        max: 34.0,
        avg: 28.29,
        sum: 198.0,
      },
      {
        key: [
          35.25,
          50.5,
        ],
        count: 15,
        min: 39.0,
        max: 50.0,
        avg: 43.53,
        sum: 653.0,
      },
      {
        key: [
          50.5,
          65.75,
        ],
        count: 12,
        min: 51.0,
        max: 64.0,
        avg: 56.83,
        sum: 682.0,
      },
      {
        key: [
          65.75,
          81,
        ],
        count: 3,
        min: 69.0,
        max: 76.0,
        avg: 71.33,
        sum: 214.0,
      },
    ];
    expect(result).toEqual(expectedResults);
  });
});

// see /src/server/__mocks__/mockESData/mockNestedTermsAndMissingAggs.js for mock results
describe('could only aggregate to find missing fields (both existing and non-existing fields)', () => {
  test('nested missing-only aggregation', async () => {
    await esInstance.initialize();
    const field = 'project';
    const nestedAggFields = {
      missingFields: [
        'gender',
        'someNonExistingField',
      ],
    };
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { field, nestedAggFields },
    );
    const expectedResults = [
      {
        key: 'internal-project-1',
        count: 41,
        missingFields: [
          {
            field: 'gender',
            count: 0,
          },
          {
            field: 'someNonExistingField',
            count: 41,
          },
        ],
      },
      {
        key: 'internal-project-2',
        count: 35,
        missingFields: [
          {
            field: 'gender',
            count: 0,
          },
          {
            field: 'someNonExistingField',
            count: 35,
          },
        ],
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('nested terms-only aggregation', async () => {
    await esInstance.initialize();
    const field = 'project';
    const nestedAggFields = {
      termsFields: [
        'gender',
        'someNonExistingField',
      ],
    };
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { field, nestedAggFields },
    );
    const expectedResults = [
      {
        key: 'internal-project-1',
        count: 41,
        termsFields: [
          {
            field: 'gender',
            count: 41,
            terms: [
              {
                key: 'male',
                count: 22,
              },
              {
                key: 'unknown',
                count: 10,
              },
              {
                key: 'female',
                count: 9,
              },
            ],
          },
          {
            field: 'someNonExistingField',
            count: 0,
            terms: [
              {
                key: null,
                count: 0,
              },
            ],
          },
        ],
      },
      {
        key: 'internal-project-2',
        count: 35,
        termsFields: [
          {
            field: 'gender',
            count: 35,
            terms: [
              {
                key: 'male',
                count: 13,
              },
              {
                key: 'female',
                count: 11,
              },
              {
                key: 'unknown',
                count: 11,
              },
            ],
          },
          {
            field: 'someNonExistingField',
            count: 0,
            terms: [
              {
                key: null,
                count: 0,
              },
            ],
          },
        ],
      },
    ];
    expect(result).toEqual(expectedResults);
  });

  test('nested terms and missing combined aggregation', async () => {
    await esInstance.initialize();
    const field = 'project';
    const nestedAggFields = {
      missingFields: [
        'gender',
        'someNonExistingField',
      ],
      termsFields: [
        'gender',
        'someNonExistingField',
      ],
    };
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { field, nestedAggFields },
    );
    const expectedResults = [
      {
        key: 'internal-project-1',
        count: 41,
        missingFields: [
          {
            field: 'gender',
            count: 0,
          },
          {
            field: 'someNonExistingField',
            count: 41,
          },
        ],
        termsFields: [
          {
            field: 'gender',
            count: 41,
            terms: [
              {
                key: 'male',
                count: 22,
              },
              {
                key: 'unknown',
                count: 10,
              },
              {
                key: 'female',
                count: 9,
              },
            ],
          },
          {
            field: 'someNonExistingField',
            count: 0,
            terms: [
              {
                key: null,
                count: 0,
              },
            ],
          },
        ],
      },
      {
        key: 'internal-project-2',
        count: 35,
        missingFields: [
          {
            field: 'gender',
            count: 0,
          },
          {
            field: 'someNonExistingField',
            count: 35,
          },
        ],
        termsFields: [
          {
            field: 'gender',
            count: 35,
            terms: [
              {
                key: 'male',
                count: 13,
              },
              {
                key: 'female',
                count: 11,
              },
              {
                key: 'unknown',
                count: 11,
              },
            ],
          },
          {
            field: 'someNonExistingField',
            count: 0,
            terms: [
              {
                key: null,
                count: 0,
              },
            ],
          },
        ],
      },
    ];
    expect(result).toEqual(expectedResults);
  });
});

// see /src/server/__mocks__/mockESData/mockNestedAggs.js for mock results
describe('could aggregate for one-level nested text fields', () => {
  test('one-level nested text aggregation', async () => {
    await esInstance.initialize();
    const field = 'visit_label';
    const nestedPath = 'visits';
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { field, nestedPath },
    );
    const expectedResults = [
      {
        key: 'vst_lbl_3',
        count: 29,
      },
      {
        key: 'vst_lbl_1',
        count: 21,
      },
      {
        key: 'vst_lbl_2',
        count: 19,
      },
      {
        key: 'no data',
        count: 40,
      }, // missing data always at end
    ];
    expect(result).toEqual(expectedResults);
  });

  test('two-level nested numeric aggregation -- global stats', async () => {
    await esInstance.initialize();
    const field = 'days_to_follow_up';
    const nestedPath = 'visits.follow_ups';
    const result = await numericGlobalStats(
      { esInstance, esIndex, esType },
      { field, nestedPath },
    );
    const expectedResults = {
      key: [
        1,
        3,
      ],
      count: 69,
      min: 1.0,
      max: 3.0,
      avg: 2.1159420289855073,
      sum: 146.0,
    };
    expect(result).toEqual(expectedResults);
  });

  test('two-level nested numeric aggregation -- fixed bin width', async () => {
    await esInstance.initialize();
    const field = 'days_to_follow_up';
    const nestedPath = 'visits.follow_ups';
    const result = await numericHistogramWithFixedRangeStep(
      { esInstance, esIndex, esType },
      { field, rangeStep: 1, nestedPath },
    );
    const expectedResults = [
      {
        key: [
          1,
          2,
        ],
        count: 21,
        max: 1,
        min: 1,
        sum: 21,
        avg: 1,
      },
      {
        key: [
          2,
          3,
        ],
        count: 19,
        max: 2,
        min: 2,
        sum: 38,
        avg: 2,
      },
      {
        key: [
          3,
          4,
        ],
        count: 29,
        max: 3,
        min: 3,
        sum: 87,
        avg: 3,
      },
    ];
    expect(result).toEqual(expectedResults);
  });
});
