/* eslint-disable global-require,import/no-dynamic-require */
// Tests for Utils/filters.js
import {
  mergeFilters, updateCountsInInitialTabsOptions, sortTabsOptions, buildFilterStatusForURLFilter,
} from '../Utils/filters';

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
  const allFilterValues = [
    'annotated_sex',
    'extra_data',
  ];

  const initialTabsOptions = {
    annotated_sex: {
      asTextHistogram: [
        { key: 'yellow', count: 137675 },
        { key: 'pink', count: 56270 },
        { key: 'silver', count: 2020 },
        { key: 'orange', count: 107574 },
      ],
    },
    extra_data: {
      asTextHistogram: [
        { key: 'a', count: 2 },
      ],
    },
  };

  const processedTabsOptions = {
    annotated_sex: {
      asTextHistogram: [
        { key: 'yellow', count: 1 },
        { key: 'orange', count: 107574 },
      ],
    },
    extra_data: { asTextHistogram: [] },
  };

  const filtersApplied = { annotated_sex: { selectedValues: ['silver'] } };

  // Silver has a count of zero, but it is in the filter, so it should remain visible
  const expectedUpdatedTabsOptions = {
    annotated_sex: {
      histogram: [
        { key: 'yellow', count: 1 },
        { key: 'orange', count: 107574 },
        { key: 'silver', count: 0 },
      ],
    },
    extra_data: {
      histogram: [],
    },
  };

  const actualUpdatedTabsOptions = updateCountsInInitialTabsOptions(
    initialTabsOptions,
    processedTabsOptions,
    filtersApplied,
    undefined,
    allFilterValues,
  );

  test('update tab counts', async () => {
    expect(actualUpdatedTabsOptions)
      .toEqual(expectedUpdatedTabsOptions);
  });
});

describe('can update a small set of tabs with new counts, test with ranger slide', () => {
  const allFilterValues = [
    'field1',
    'field2',
  ];
  const initialTabsOptions = {
    field1: {
      asTextHistogram: [
        { key: 'option1', count: 137675 },
        { key: 'option2', count: 56270 },
        { key: 'option3', count: 2020 },
        { key: 'option4', count: 107574 },
      ],
    },
    field2: {
      asTextHistogram: [
        { key: [0, 100], count: 100 },
      ],
    },
  };

  const processedTabsOptions = {
    field1: {
      asTextHistogram: [
        { key: 'option3', count: 30 },
      ],
    },
    field2: {
      asTextHistogram: [
        {
          key: [4, 39],
          count: 49,
        },
      ],
    },
  };

  const filtersApplied = {
    field1: {
      selectedValues: ['option2'],
    },
    field2: {
      lowerBound: 4,
      upperBound: 39,
    },
  };

  // option2 has a count of zero, but it is in the filter, so it should remain visible
  const expectedUpdatedTabsOptions = {
    field1: {
      histogram: [
        { key: 'option3', count: 30 },
        { key: 'option2', count: 0 },
      ],
    },
    field2: {
      histogram: [
        { key: [4, 39], count: 49 },
      ],
    },
  };

  const actualUpdatedTabsOptions = updateCountsInInitialTabsOptions(
    initialTabsOptions,
    processedTabsOptions,
    filtersApplied,
    undefined,
    allFilterValues,
  );

  test('update tab counts', async () => {
    expect(actualUpdatedTabsOptions)
      .toEqual(expectedUpdatedTabsOptions);
  });
});

describe('can sort tabs options', () => {
  const tabsOptionsOne = {
    annotated_sex: {
      histogram: [
        { key: 'orange', count: 30 },
        { key: 'pink', count: 21 },
        { key: 'yellow', count: 99 },
        { key: 'zorp', count: 4162 },
        { key: 'shiny', count: 0 },
        { key: 'green', count: 0 },
        { key: 'blue', count: 0 },
      ],
    },
    extra_data: {
      histogram: [
        { key: 'a', count: 0 },
        { key: 'b', count: 0 },
        { key: 'c', count: 1 },
      ],
    },
  };

  const expectedSort = {
    annotated_sex: {
      histogram: [
        { key: 'zorp', count: 4162 },
        { key: 'yellow', count: 99 },
        { key: 'orange', count: 30 },
        { key: 'pink', count: 21 },
        { key: 'blue', count: 0 },
        { key: 'green', count: 0 },
        { key: 'shiny', count: 0 },
      ],
    },
    extra_data: {
      histogram: [
        { key: 'c', count: 1 },
        { key: 'a', count: 0 },
        { key: 'b', count: 0 },
      ],
    },
  };

  const actualSort = sortTabsOptions(tabsOptionsOne);

  test('test sorting tabs options', async () => {
    expect(actualSort)
      .toEqual(expectedSort);
  });
});

describe('can convert between filter applied and filter displayed forms', () => {
  // Unit test for buildFilterStatusForURLFilter()
  const inputFilterFromURL = {
    carotid_plaque: { selectedValues: ['Plaque present', 'Plaque not present'] },
    cac_score: { lowerBound: 33, upperBound: 97 },
    project_id: { selectedValues: ['DEV-test'] },
  };
  const tabs = [
    {
      title: 'Medical History',
      fields: ['cac_score', 'cac_volume', 'carotid_plaque',
        'carotid_stenosis', 'cimt_1', 'cimt_2', 'vte_case_status',
        'vte_followup_start_age', 'vte_prior_history', 'antihypertensive_meds',
        'fasting_lipids', 'lipid_lowering_medication',
      ],
    },
    {
      title: 'Diagnosis',
      fields: [
        'bp_diastolic', 'basophil_ncnc_bld', 'eosinophil_ncnc_bld', 'hdl',
        'hematocrit_vfr_bld', 'hemoglobin_mcnc_bld', 'ldl', 'lymphocyte_ncnc_bld',
        'mch_entmass_rbc', 'mchc_mcnc_rbc', 'mcv_entvol_rbc', 'monocyte_ncnc_bld',
        'neutrophil_ncnc_bld', 'platelet_ncnc_bld', 'pmv_entvol_bld', 'rbc_ncnc_bld',
        'rdw_ratio_rbc', 'wbc_ncnc_bld',
      ],
    },
    {
      title: 'Subject',
      fields: [
        'project_id', 'consent_codes', 'data_type', 'data_format',
        'race', 'annotated_sex', 'hispanic_subgroup', 'ethnicity', 'subcohort', 'weight_baseline',
      ],
    },
  ];

  const displayFilterExpected = [
    [[33, 97], {}, { 'Plaque present': true, 'Plaque not present': true }, {}, {}, {},
      {}, {}, {}, {}, {}, {}],
    [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
    [{ 'DEV-test': true }, {}, {}, {}, {}, {}, {}, {}, {}, {}],
  ];

  test('build filter display from url', async () => {
    const displayFilter = buildFilterStatusForURLFilter(inputFilterFromURL, tabs);
    expect(displayFilter)
      .toEqual(displayFilterExpected);
  });
});
