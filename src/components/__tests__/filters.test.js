/* eslint-disable global-require,import/no-dynamic-require */
// Tests for Utils/filters.js
import { mergeFilters, updateCountsInInitialTabsOptions } from '../Utils/filters';

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


describe('can update a small set of tabs with new counts', () => {
  const initialTabsOptions = {
    annotated_sex: {
      histogram: [
        { key: 'yellow', count: 137675 },
        { key: 'pink', count: 56270 },
        { key: 'orange', count: 107574 },
      ],
    },
    extra_data: {
      histogram: [
        { key: 'a', count: 2 },
      ],
    },
  };

  const processedTabsOptions = {
    annotated_sex: {
      histogram: [
        { key: 'yellow', count: 1 },
        { key: 'orange', count: 107574 },
      ],
    },
    extra_data: { histogram: [] },
  };

  const expectedUpdatedTabsOptions = {
    annotated_sex: {
      histogram: [
        { key: 'yellow', count: 1 },
        { key: 'pink', count: 0 },
        { key: 'orange', count: 107574 },
      ],
    },
    extra_data: {
      histogram: [
        { key: 'a', count: 0 },
      ],
    },
  };

  const actualUpdatedTabsOptions = updateCountsInInitialTabsOptions(
    initialTabsOptions, processedTabsOptions,
  );

  test('update tab counts', async () => {
    expect(expectedUpdatedTabsOptions)
      .toEqual(actualUpdatedTabsOptions);
  });
});
