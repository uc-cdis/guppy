// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock 
import getAuthHelperInstance from '../authHelper';
import esInstance from '../../es/index';
import setupMockDataEndpoint from '../../__mocks__/mockDataFromES';

jest.mock('../../config');
jest.mock('../../logger');

setupMockDataEndpoint();

describe('AuthHelper', () => {
  test('could create auth helper instance', async () => {
    const authHelper = await getAuthHelperInstance('fake-jwt');
    expect(authHelper.getAccessibleResources()).toEqual(['internal-project-1', 'internal-project-2', 'internal-project-4']);
    expect(authHelper.getAccessibleResources()).not.toContain(['internal-project-3']);
    expect(authHelper.getUnaccessibleResources()).toEqual(['external-project-1', 'external-project-2']);
  });

  test('could get out-of-scope resources according to filter', async () => {
    const authHelper = await getAuthHelperInstance('fake-jwt');
    await esInstance.initialize();
    const outOfScopeResources = await authHelper.getOutOfScopeResourceList('gen3-dev-subject', 'subject');
    expect(outOfScopeResources).toEqual(['external-project-1', 'external-project-2']);

    const filter1 = {
      eq: {
        gen3_resource_path: 'internal-project-1',
      },
    };
    const outOfScopeResources1 = await authHelper
      .getOutOfScopeResourceList('gen3-dev-subject', 'subject', filter1);
    expect(outOfScopeResources1).toEqual([]); // with filter there's no out-of-scope resources

    const filter2 = {
      eq: {
        gen3_resource_path: 'external-project-1',
      },
    };
    const outOfScopeResources2 = await authHelper
      .getOutOfScopeResourceList('gen3-dev-subject', 'subject', filter2);
    expect(outOfScopeResources2).toEqual(['external-project-1']); // with filter there's one out-of-scope resources
  });

  test('could combine filter with accessible or unaccessible filter', async () => {
    const authHelper = await getAuthHelperInstance('fake-jwt');

    // adding on an empty filter
    const resultFilter1 = authHelper.applyAccessibleFilter();
    const expectedFilter1 = {
      IN: {
        gen3_resource_path: [
          'internal-project-1',
          'internal-project-2',
          'internal-project-4',
        ],
      },
    };
    expect(resultFilter1).toEqual(expectedFilter1);

    // adding on a normal filter
    const filter = {
      '=': {
        gender: 'female',
      },
    };
    const expectedFilter2 = {
      AND: [
        filter,
        {
          IN: {
            gen3_resource_path: [
              'internal-project-1',
              'internal-project-2',
              'internal-project-4',
            ],
          },
        },
      ],
    };
    const resultFilter2 = authHelper.applyAccessibleFilter(filter);
    expect(resultFilter2).toEqual(expectedFilter2);

    // adding normal filter to unaccessible filter
    const expectedFilter3 = {
      AND: [
        filter,
        {
          IN: {
            gen3_resource_path: [
              'external-project-1',
              'external-project-2',
            ],
          },
        },
      ],
    };
    const resultFilter3 = authHelper.applyUnaccessibleFilter(filter);
    expect(resultFilter3).toEqual(expectedFilter3);
  });

  test('could get accessible or unaccessible resource as default auth filter', async () => {
    const authHelper = await getAuthHelperInstance('fake-jwt');

    const res1 = authHelper.getDefaultFilter('all');
    expect(res1).toEqual({});

    const res2 = authHelper.getDefaultFilter('accessible');
    const exp2 = {
      IN: {
        gen3_resource_path: [
          'internal-project-1',
          'internal-project-2',
          'internal-project-4',
        ],
      },
    };
    expect(res2).toEqual(exp2);

    const res3 = authHelper.getDefaultFilter('unaccessible');
    const exp3 = {
      IN: {
        gen3_resource_path: [
          'external-project-1',
          'external-project-2',
        ],
      },
    };
    expect(res3).toEqual(exp3);
  });
});
