// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock
import { UserInputError } from 'apollo-server';
import setupMockDataEndpoint from '../../__mocks__/mockDataFromES';
import {
  appendAdditionalRangeQuery,
  textAggregation,
  numericGlobalStats,
  numericHistogramWithFixedRangeStep, // TOOD: check with mock endpoint
  numericHistogramWithFixedBinCount, // TOOD: check with mock endpoint
  numericAggregation, // TODO: only check if this function correctly calls previous 2 functions
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

describe('could aggregate for numeric fields', () => {
  const field = 'file_count';
  test('aggregation for global stats', async () => {
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

  test('aggregation for global stats, with filter', async () => {
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

  test('aggregation for global stats, with range', async () => {
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

  test('aggregation for global stats, with filterSelf', async () => {
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

  test('aggregation for global stats, with defaultAuthFilter', async () => {
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
