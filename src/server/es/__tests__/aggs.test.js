// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock
import setupMockDataEndpoint from '../../__mocks__/mockDataFromES';
import {
  appendAdditionalRangeQuery,
  textAggregation,
  numericGlobalStats,
  numericHistogramWithFixedRangeStep,
  // numericHistogramWithFixedBinCount, // TOOD: check with mock endpoint
  // numericAggregation, // TODO: only check if this function correctly calls previous 2 functions
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

describe('could aggregate for text fields', () => {
  test('basic aggregation', async () => {
    await esInstance.initialize();
    const field = 'gender';
    const result = await textAggregation(
      { esInstance, esIndex, esType },
      { field },
    );
    const expectedResults = [
      { key: 'unknown', count: 38 },
      { key: 'female', count: 35 },
      { key: 'male', count: 27 },
      { key: 'no data', count: 40 }, // missing data always at end
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
      { key: 'female', count: 35 },
      { key: 'male', count: 27 },
      { key: 'no data', count: 40 }, // missing data always at end
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
      { key: 'unknown', count: 38 },
      { key: 'female', count: 35 },
      { key: 'male', count: 27 },
      { key: 'no data', count: 40 }, // missing data always at end
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
      { key: 'unknown', count: 19 },
      { key: 'female', count: 18 },
      { key: 'male', count: 15 },
      { key: 'no data', count: 20 }, // missing data always at end
    ];
    expect(result).toEqual(expectedResults);
  });
});

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
