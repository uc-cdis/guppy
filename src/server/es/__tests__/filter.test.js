// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock
import { UserInputError } from 'apollo-server';
import getFilterObj from '../filter';
import esInstance from '../index';
import setupMockDataEndpoint from '../../__mocks__/mockDataFromES';
import config from '../../config';

jest.mock('../../config');
jest.mock('../../logger');

setupMockDataEndpoint();
const esIndex = 'gen3-dev-subject';
const esType = 'subject';

describe('Transfer GraphQL filter to ES filter, filter unit', () => {
  test('could transfer graphql filter to ES filter object, empty filter', async () => {
    await esInstance.initialize();
    const gqlFilter1 = {};
    const gqlFilter2 = undefined;
    const gqlFilter3 = null;
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = null;
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, "=" operator (for string)', async () => {
    await esInstance.initialize();
    // eq, EQ, =
    const gqlFilter1 = { eq: { gender: 'female' } };
    const gqlFilter2 = { EQ: { gender: 'female' } };
    const gqlFilter3 = { '=': { gender: 'female' } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = {
      term: {
        gender: 'female',
      },
    };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, "in" operator (for string)', async () => {
    await esInstance.initialize();
    // in, IN
    const gqlFilter1 = { in: { gender: ['female', 'unknown'] } };
    const gqlFilter2 = { IN: { gender: ['female', 'unknown'] } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const expectedESFilter = {
      terms: {
        gender: ['female', 'unknown'],
      },
    };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, "=" operator (for number)', async () => {
    await esInstance.initialize();
    // eq, EQ, =
    const gqlFilter1 = { eq: { file_count: 10 } };
    const gqlFilter2 = { EQ: { file_count: 10 } };
    const gqlFilter3 = { '=': { file_count: 10 } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = {
      term: {
        file_count: 10,
      },
    };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, "in" operator (for number)', async () => {
    await esInstance.initialize();
    // in, IN
    const gqlFilter1 = { in: { file_count: [10, 20] } };
    const gqlFilter2 = { IN: { file_count: [10, 20] } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const expectedESFilter = {
      terms: {
        file_count: [10, 20],
      },
    };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, ">" operator', async () => {
    await esInstance.initialize();
    // >, gt, GT
    const gqlFilter1 = { '>': { file_count: 10 } };
    const gqlFilter2 = { gt: { file_count: 10 } };
    const gqlFilter3 = { GT: { file_count: 10 } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = { range: { file_count: { gt: 10 } } };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, ">=" operator', async () => {
    await esInstance.initialize();
    // >=, gte, GTE
    const gqlFilter1 = { '>=': { file_count: 10 } };
    const gqlFilter2 = { gte: { file_count: 10 } };
    const gqlFilter3 = { GTE: { file_count: 10 } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = { range: { file_count: { gte: 10 } } };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, "<" operator', async () => {
    await esInstance.initialize();
    // <, lt, LT
    const gqlFilter1 = { '<': { file_count: 10 } };
    const gqlFilter2 = { lt: { file_count: 10 } };
    const gqlFilter3 = { LT: { file_count: 10 } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = { range: { file_count: { lt: 10 } } };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, "<=" operator', async () => {
    await esInstance.initialize();
    // <=, lte, LTE
    const gqlFilter1 = { '<=': { file_count: 10 } };
    const gqlFilter2 = { lte: { file_count: 10 } };
    const gqlFilter3 = { LTE: { file_count: 10 } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = { range: { file_count: { lte: 10 } } };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, range ">=" and "<=" operator', async () => {
    await esInstance.initialize();
    // <=, lte, LTE
    const gqlFilter1 = { and: [{ '<=': { file_count: 20 } }, { '>=': { file_count: 10 } }] };
    const gqlFilter2 = { and: [{ lte: { file_count: 20 } }, { gte: { file_count: 10 } }] };
    const gqlFilter3 = { and: [{ LTE: { file_count: 20 } }, { GTE: { file_count: 10 } }] };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = { bool: { must: [{ range: { file_count: { lte: 20, gte: 10 } } }] } };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, range "<=" operator', async () => {
    await esInstance.initialize();
    // <=, lte, LTE
    const gqlFilter1 = { and: [{ '<=': { file_count: 20 } }] };
    const gqlFilter2 = { and: [{ lte: { file_count: 20 } }] };
    const gqlFilter3 = { and: [{ LTE: { file_count: 20 } }] };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter = { bool: { must: [{ range: { file_count: { lte: 20 } } }] } };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
    expect(resultESFilter3).toEqual(expectedESFilter);
  });

  test('could transfer graphql filter to ES filter object, "search" operator', async () => {
    await esInstance.initialize();
    const keyword = 'male';
    const gqlFilter1 = { search: { keyword } };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const expectedESFilter1 = { multi_match: { query: keyword, fields: [`*${config.analyzedTextFieldSuffix}`] } };
    expect(resultESFilter1).toEqual(expectedESFilter1);

    const targetFields = ['gender', 'name'];
    const gqlFilter2 = { search: { keyword, fields: targetFields } };
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const expectedTargetFields = targetFields.map((f) => `${f}${config.analyzedTextFieldSuffix}`);
    const expectedESFilter2 = { multi_match: { query: keyword, fields: expectedTargetFields } };
    expect(resultESFilter2).toEqual(expectedESFilter2);

    const targetField = 'gender';
    const gqlFilter3 = { search: { keyword, fields: targetField } };
    const resultESFilter3 = getFilterObj(esInstance, esIndex, gqlFilter3);
    const expectedESFilter3 = { multi_match: { query: keyword, fields: [`${targetField}${config.analyzedTextFieldSuffix}`] } };
    expect(resultESFilter3).toEqual(expectedESFilter3);
  });

  test('could throw err for invalid operator', async () => {
    await esInstance.initialize();

    expect(() => { // for string field
      const gqlFilter = { '+': { gender: 'female' } };
      getFilterObj(esInstance, esIndex, esType, gqlFilter);
    }).toThrow(UserInputError);

    expect(() => { // for int field
      const gqlFilter = { '+': { file_count: 10 } };
      getFilterObj(esInstance, esIndex, esType, gqlFilter);
    }).toThrow(UserInputError);
  });

  test('could throw err for nonexisting field', async () => {
    await esInstance.initialize();

    expect(() => { // for string field
      const gqlFilter = { '=': { strange_field: 'value' } };
      getFilterObj(esInstance, esIndex, esType, gqlFilter);
    }).toThrow(UserInputError);
  });
});

describe('Transfer GraphQL filter to ES filter, combined filter', () => {
  test('could combine filter using binary operator "and"', async () => {
    await esInstance.initialize();
    const gqlFilter1 = {
      AND: [
        { eq: { gender: 'female' } },
        { eq: { file_count: 10 } },
      ],
    };
    const gqlFilter2 = {
      and: [
        { eq: { gender: 'female' } },
        { eq: { file_count: 10 } },
      ],
    };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const expectedESFilter = {
      bool: {
        must: [
          {
            term: {
              gender: 'female',
            },
          },
          {
            term: {
              file_count: 10,
            },
          },
        ],
      },
    };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
  });

  test('could combine filter using binary operator "or"', async () => {
    await esInstance.initialize();
    const gqlFilter1 = {
      OR: [
        { eq: { gender: 'female' } },
        { eq: { file_count: 10 } },
      ],
    };
    const gqlFilter2 = {
      or: [
        { eq: { gender: 'female' } },
        { eq: { file_count: 10 } },
      ],
    };
    const resultESFilter1 = getFilterObj(esInstance, esIndex, gqlFilter1);
    const resultESFilter2 = getFilterObj(esInstance, esIndex, gqlFilter2);
    const expectedESFilter = {
      bool: {
        should: [
          {
            term: {
              gender: 'female',
            },
          },
          {
            term: {
              file_count: 10,
            },
          },
        ],
      },
    };
    expect(resultESFilter1).toEqual(expectedESFilter);
    expect(resultESFilter2).toEqual(expectedESFilter);
  });

  test('could combine filter using nested binary operator', async () => {
    await esInstance.initialize();
    const gqlFilter = {
      OR: [
        {
          and: [
            { eq: { gender: 'female' } },
            { eq: { file_count: 10 } },
          ],
        },
        {
          or: [
            {
              and: [
                { eq: { gender: 'male' } },
                { eq: { file_count: 20 } },
              ],
            },
            {
              and: [
                { eq: { gender: 'unknown' } },
                { eq: { file_count: 30 } },
              ],
            },
          ],
        },
      ],
    };
    const resultESFilter = getFilterObj(esInstance, esIndex, gqlFilter);
    const expectedESFilter = {
      bool: {
        should: [
          {
            bool: {
              must: [
                {
                  term: {
                    gender: 'female',
                  },
                },
                {
                  term: {
                    file_count: 10,
                  },
                },
              ],
            },
          },
          {
            bool: {
              should: [
                {
                  bool: {
                    must: [
                      {
                        term: {
                          gender: 'male',
                        },
                      },
                      {
                        term: {
                          file_count: 20,
                        },
                      },
                    ],
                  },
                },
                {
                  bool: {
                    must: [
                      {
                        term: {
                          gender: 'unknown',
                        },
                      },
                      {
                        term: {
                          file_count: 30,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    };
    expect(resultESFilter).toEqual(expectedESFilter);
  });
});

describe('Transfer GraphQL filter to ES filter, with other params', () => {
  test('could skip filter field if filterSelf=false, filter unit', async () => {
    await esInstance.initialize();
    const gqlFilter = { eq: { gender: 'female' } };
    const resultESFilter = getFilterObj(esInstance, esIndex, gqlFilter, 'gender', false);
    const expectedESFilter = null;
    expect(resultESFilter).toEqual(expectedESFilter);
  });

  test('could skip filter field if filterSelf=false, combined filter', async () => {
    const gqlFilter = {
      AND: [
        { eq: { gender: 'female' } },
        { eq: { file_count: 10 } },
      ],
    };
    const resultESFilter = getFilterObj(esInstance, esIndex, gqlFilter, 'gender', false);
    const expectedESFilter = {
      bool: {
        must: [
          {
            term: {
              file_count: 10,
            },
          },
        ],
      },
    };
    expect(resultESFilter).toEqual(expectedESFilter);
  });

  test('could skip filter field if filterSelf=false, with unrelated fields', async () => {
    await esInstance.initialize();
    const gqlFilter = { eq: { gender: 'female' } };
    const resultESFilter = getFilterObj(esInstance, esIndex, gqlFilter, 'file_count', false);
    const expectedESFilter = {
      term: {
        gender: 'female',
      },
    };
    expect(resultESFilter).toEqual(expectedESFilter);
  });

  test('could skip filter field if filterSelf=false, with defaultAuthFilter', async () => {
    await esInstance.initialize();
    const defaultAuthFilter = { '=': { gen3_resource_path: 'internal' } };
    const gqlFilter = { eq: { gender: 'female' } };
    const resultESFilter = getFilterObj(esInstance, esIndex, gqlFilter, 'gender', false, defaultAuthFilter);
    const expectedESFilter = {
      term: {
        gen3_resource_path: 'internal',
      },
    };
    expect(resultESFilter).toEqual(expectedESFilter);
  });
});
