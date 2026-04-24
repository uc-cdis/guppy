import { getRequestResourceListFromFilter } from '../utils';
import config from '../../config';
import { textAggregation } from '../../es/aggs';

jest.mock('../../config');
jest.mock('../../logger');
jest.mock('../../es/aggs', () => ({
  textAggregation: jest.fn(),
}));

describe('getRequestResourceListFromFilter', () => {
  const mockTextAggregation = jest.mocked(textAggregation);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return list of resource keys when valid filter is provided', async () => {
    config.esConfig = { authFilterField: 'nested.field.name' };
    mockTextAggregation.mockResolvedValue([{ key: 'resource1' }, { key: 'resource2' }]);

    const result = await getRequestResourceListFromFilter(
      'testIndex',
      'testType',
      { term: { key: 'value' } },
      null,
    );

    expect(mockTextAggregation)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          esIndex: 'testIndex',
          esType: 'testType',
        }),
        {
          field: 'name',
          filter: { term: { key: 'value' } },
          filterSelf: null,
          nestedPath: 'nested.field',
        },
      );
    expect(result)
      .toEqual(['resource1', 'resource2']);
  });

  test('should handle case where no nested path is present in authFilterField', async () => {
    config.esConfig = { authFilterField: 'simpleFieldName' };
    mockTextAggregation.mockResolvedValue([{ key: 'resource3' }]);

    const result = await getRequestResourceListFromFilter(
      'testIndex',
      'testType',
      { term: { key: 'anotherValue' } },
      null,
    );

    expect(mockTextAggregation)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          esIndex: 'testIndex',
          esType: 'testType',
        }),
        {
          field: 'simpleFieldName',
          filter: { term: { key: 'anotherValue' } },
          filterSelf: null,
          nestedPath: undefined,
        },
      );
    expect(result)
      .toEqual(['resource3']);
  });

  test('should return an empty array when textAggregation returns no results', async () => {
    config.esConfig = { authFilterField: 'nested.field.name' };
    mockTextAggregation.mockResolvedValue([]);

    const result = await getRequestResourceListFromFilter(
      'testIndex',
      'testType',
      { term: { key: 'emptyValue' } },
      null,
    );

    expect(mockTextAggregation)
      .toHaveBeenCalledWith(
        expect.objectContaining({
          esIndex: 'testIndex',
          esType: 'testType',
        }),
        {
          field: 'name',
          filter: { term: { key: 'emptyValue' } },
          filterSelf: null,
          nestedPath: 'nested.field',
        },
      );
    expect(result)
      .toEqual([]);
  });
});
