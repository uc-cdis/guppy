import { fromFieldsToSource } from '../utils';
import UtilsData from '../__mockData__/utils.data';

describe('Parse fields from GraphQL query to fields in ES query', () => {
  test('could parse fields in GraphQL query correctly', async () => {
    expect(fromFieldsToSource(UtilsData.parsedInfo)).toEqual(UtilsData.fields);
  });
});
