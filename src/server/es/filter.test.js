import { parseValuesFromFilter } from './filter';

test('could parse values from filter object', () => {
  const targetField = 'project';

  expect(parseValuesFromFilter(undefined, targetField)).toEqual([]);
  expect(parseValuesFromFilter({}, targetField)).toEqual([]);

  const inputFilterObj1 = {
    '=': {
      [targetField]: 'proj-1',
    },
  };
  const resultValues1 = parseValuesFromFilter(inputFilterObj1, targetField);
  const expectedValues1 = ['proj-1'];
  expect(resultValues1).toEqual(expectedValues1);

  const inputFilterObj2 = {
    AND: [
      {
        '=': {
          [targetField]: 'proj-1',
        },
      },
      {
        IN: {
          [targetField]: ['proj-2', 'proj-3'],
        },
      },
    ],
  };
  const resultValues2 = parseValuesFromFilter(inputFilterObj2, targetField);
  const expectedValues2 = ['proj-1', 'proj-2', 'proj-3'];
  expect(resultValues2).toEqual(expectedValues2);

  const inputFilterObj3 = {
    OR: [
      {
        in: {
          testField: [1, 2, 3],
        },
      },
      {
        or: [
          {
            '=': { [targetField]: 'proj-4' },
          },
          {
            IN: { [targetField]: ['proj-5', 'proj-6'] },
          },
        ],
      },
    ],
  };
  const resultValues3 = parseValuesFromFilter(inputFilterObj3, targetField);
  const expectedValues3 = ['proj-4', 'proj-5', 'proj-6'];
  expect(resultValues3).toEqual(expectedValues3);
});
