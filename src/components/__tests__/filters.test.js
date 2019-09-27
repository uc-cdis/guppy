/* eslint-disable global-require,import/no-dynamic-require */
// Tests for Utils/filters.js
import { mergeFilters } from '../Utils/filters';

describe('can merge simple selectedValue filters', () => {
  const userFilter = { data_format: { selectedValues: ['VCF'] } };
  const adminFilter = { project_id: { selectedValues: ['jnkns-jenkins'] } };

  const mergedFilterExpected = {
    project_id: { selectedValues: ['jnkns-jenkins'] },
    data_format: { selectedValues: ['VCF'] },
  };

  test('merge filters', async () => {
    const mergedFilter = mergeFilters(userFilter, adminFilter);
    expect(mergedFilter)
      .toEqual(mergedFilterExpected);
  });
});

describe('can merge admin-provided selectedValue filters with user-provided range filters', () => {
  const userFilter = {
    bmi: { lowerBound: 28, upperBound: 99 },
    age: { lowerBound: 26, upperBound: 33 },
    data_type: { selectedValues: ['Aligned Reads'] },
  };
  const adminFilter = { project_id: { selectedValues: ['jnkns-jenkins', 'jnkns-jenkins2'] } };

  const mergedFilterExpected = {
    project_id: { selectedValues: ['jnkns-jenkins', 'jnkns-jenkins2'] },
    bmi: { lowerBound: 28, upperBound: 99 },
    age: { lowerBound: 26, upperBound: 33 },
    data_type: { selectedValues: ['Aligned Reads'] },
  };

  test('merge filters', async () => {
    const mergedFilter = mergeFilters(userFilter, adminFilter);
    expect(mergedFilter)
      .toEqual(mergedFilterExpected);
  });
});

describe('will select user-applied filter for a given key if it is more exclusive than admin filter', () => {
  const userFilter = {
    project_id: { selectedValues: ['jnkns-jenkins2'] },
    age: { lowerBound: 26, upperBound: 33 },
    data_type: { selectedValues: ['Aligned Reads'] },
  };
  const adminFilter = { project_id: { selectedValues: ['jnkns-jenkins', 'jnkns-jenkins2'] } };

  const mergedFilterExpected = {
    project_id: { selectedValues: ['jnkns-jenkins2'] },
    age: { lowerBound: 26, upperBound: 33 },
    data_type: { selectedValues: ['Aligned Reads'] },
  };

  test('merge filters', async () => {
    const mergedFilter = mergeFilters(userFilter, adminFilter);
    expect(mergedFilter)
      .toEqual(mergedFilterExpected);
  });
});
