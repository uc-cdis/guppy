// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock
import { GraphQLError } from 'graphql';
import getESSortBody from '../sort';
import esInstance from '../index';
import setupMockDataEndpoint from '../../__mocks__/mockDataFromES';

jest.mock('../../config');
jest.mock('../../logger');

setupMockDataEndpoint();
const esIndex = 'gen3-dev-subject';

describe('Transfer GraphQL sort argument to ES sort argument', () => {
  test('object format sort arg', async () => {
    await esInstance.initialize();
    const graphQLSort1 = { gender: 'asc' };
    const expectedESSort1 = [
      {
        gender: {
          order: 'asc',
        },
      },
    ];
    const resultESSort1 = getESSortBody(graphQLSort1, esInstance, esIndex);
    expect(resultESSort1).toEqual(expectedESSort1);

    const graphQLSort2 = { gender: 'asc', file_count: 'desc' };
    const expectedESSort2 = [
      {
        gender: {
          order: 'asc',
        },
      },
      {
        file_count: {
          order: 'desc',
        },
      },
    ];
    const resultESSort2 = getESSortBody(graphQLSort2, esInstance, esIndex);
    expect(resultESSort2).toEqual(expectedESSort2);

    const graphQLSort3 = { gender: 'asc', file_count: 'desc', 'visits.visit_label': 'asc' };
    const expectedESSort3 = [
      {
        gender: {
          order: 'asc',
        },
      },
      {
        file_count: {
          order: 'desc',
        },
      },
      {
        'visits.visit_label': {
          nested: {
            path: 'visits',
          },
          order: 'asc',
        },
      },
    ];
    const resultESSort3 = getESSortBody(graphQLSort3, esInstance, esIndex);
    expect(resultESSort3).toEqual(expectedESSort3);
  });

  test('array format sort arg', async () => {
    await esInstance.initialize();
    const graphQLSort1 = [{ gender: 'asc' }];
    const expectedESSort1 = [
      {
        gender: {
          order: 'asc',
        },
      },
    ];
    const resultESSort1 = getESSortBody(graphQLSort1, esInstance, esIndex);
    expect(resultESSort1).toEqual(expectedESSort1);

    const graphQLSort2 = [{ gender: 'asc' }, { file_count: 'desc' }];
    const expectedESSort2 = [
      {
        gender: {
          order: 'asc',
        },
      },
      {
        file_count: {
          order: 'desc',
        },
      },
    ];
    const resultESSort2 = getESSortBody(graphQLSort2, esInstance, esIndex);
    expect(resultESSort2).toEqual(expectedESSort2);

    const graphQLSort3 = [{ gender: 'asc' }, { file_count: 'desc' }, { 'visits.visit_label': 'asc' }];
    const expectedESSort3 = [
      {
        gender: {
          order: 'asc',
        },
      },
      {
        file_count: {
          order: 'desc',
        },
      },
      {
        'visits.visit_label': {
          nested: {
            path: 'visits',
          },
          order: 'asc',
        },
      },
    ];
    const resultESSort3 = getESSortBody(graphQLSort3, esInstance, esIndex);
    expect(resultESSort3).toEqual(expectedESSort3);
  });

  test('array format sort arg with nonexisting field', async () => {
    await esInstance.initialize();
    expect(() => {
      const graphQLSort = { invalid_field: 'asc' };
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);

    expect(() => {
      const graphQLSort = [{ invalid_field: 'asc' }];
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);

    expect(() => {
      const graphQLSort = { gender: 'female', invalid_field: 'asc' };
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);

    expect(() => {
      const graphQLSort = [{ gender: 'female', 'visits.invalid_field': 'asc' }];
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);
  });

  test('array format sort arg with invalid method', async () => {
    await esInstance.initialize();
    expect(() => {
      const graphQLSort = { gender: 'invalid_method' };
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);

    expect(() => {
      const graphQLSort = [{ gender: 'invalid_method' }];
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);

    expect(() => {
      const graphQLSort = { gender: 'asc', file_count: 'invalid_method' };
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);

    expect(() => {
      const graphQLSort = { gender: 'asc', 'visits.visit_label': 'invalid_method' };
      getESSortBody(graphQLSort, esInstance, esIndex);
    }).toThrow(GraphQLError);
  });
});
