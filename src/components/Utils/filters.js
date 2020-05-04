/* eslint import/prefer-default-export: 0 */

/**
   * This function takes two objects containing filters to be applied
   * and combines them into one filter object in the same format.
   * Note: the admin filter takes precedence. Selected values in the user
   * filter will be discarded if the key collides. This is to avoid
   * the user undoing the admin filter. (Multiple user checkboxes increase the
   * amount of data shown when combined, but an admin filter should always decrease
   * or keep constant the amount of data shown when combined with a user filter).
  * */
export const mergeFilters = (userFilter, adminAppliedPreFilter) => {
  const filterAB = { ...userFilter };
  Object.keys(adminAppliedPreFilter).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(userFilter, key)
          && Object.prototype.hasOwnProperty.call(adminAppliedPreFilter, key)) {
      const userFilterSubset = userFilter[key].selectedValues.filter(
        (x) => adminAppliedPreFilter[key].selectedValues.includes(x),
      );
      if (userFilterSubset.length > 0) {
        // The user-applied filter is more exclusive than the admin-applied filter.
        filterAB[key].selectedValues = userFilter[key].selectedValues;
      } else {
        // The admin-applied filter is more exclusive than the user-applied filter.
        filterAB[key].selectedValues = adminAppliedPreFilter[key].selectedValues;
      }
    } else if (Object.prototype.hasOwnProperty.call(adminAppliedPreFilter, key)) {
      filterAB[key] = { selectedValues: adminAppliedPreFilter[key].selectedValues };
    }
  });

  return filterAB;
};

/**
   * This function updates the counts in the initial set of tab options
   * calculated from unfiltered data.
   * It is used to retain field options in the rendering if
   * they are still checked but their counts are zero.
   */
export const updateCountsInInitialTabsOptions = (
  initialTabsOptions, processedTabsOptions, filtersApplied, accessibleFieldCheckList,
) => {
  const updatedTabsOptions = {};
  try {
    Object.keys(initialTabsOptions).forEach((field) => {
      updatedTabsOptions[field] = { histogram: [] };
      // if in tiered access mode
      // we need not to process filters for field in accessibleFieldCheckList
      if (accessibleFieldCheckList
        && accessibleFieldCheckList.includes(field)
        && processedTabsOptions[field]) {
        updatedTabsOptions[field] = processedTabsOptions[field];
        return;
      }
      const { histogram } = initialTabsOptions[field];
      histogram.forEach((opt) => {
        const { key } = opt;
        if (typeof (key) !== 'string') { // key is a range, just copy the histogram
          updatedTabsOptions[field].histogram = initialTabsOptions[field].histogram;
          if (processedTabsOptions[field]
            && processedTabsOptions[field].histogram
            && processedTabsOptions[field].histogram.length > 0
            && updatedTabsOptions[field].histogram) {
            const newCount = processedTabsOptions[field].histogram[0].count;
            updatedTabsOptions[field].histogram[0].count = newCount;
          }
          return;
        }
        const findOpt = processedTabsOptions[field].histogram.find((o) => o.key === key);
        if (findOpt) {
          const { count } = findOpt;
          updatedTabsOptions[field].histogram.push({ key, count });
        }
      });
      if (filtersApplied[field]) {
        if (filtersApplied[field].selectedValues) {
          filtersApplied[field].selectedValues.forEach((optKey) => {
            if (!updatedTabsOptions[field].histogram.find((o) => o.key === optKey)) {
              updatedTabsOptions[field].histogram.push({ key: optKey, count: 0 });
            }
          });
        }
      }
    });
  } catch (err) {
    /* eslint-disable no-console */
    // hopefully we won't get here but in case of
    // out-of-index error or obj undefined error
    console.error('error when processing filter data', err);
    console.trace();
    /* eslint-enable no-console */
  }
  return updatedTabsOptions;
};

function sortCountThenAlpha(a, b) {
  if (a.count === b.count) {
    return a.key < b.key ? -1 : 1;
  }
  return b.count - a.count;
}

export const sortTabsOptions = (tabsOptions) => {
  const fields = Object.keys(tabsOptions);
  const sortedTabsOptions = { ...tabsOptions };
  for (let x = 0; x < fields.length; x += 1) {
    const field = fields[x];

    const optionsForThisField = sortedTabsOptions[field].histogram;
    optionsForThisField.sort(sortCountThenAlpha);
    sortedTabsOptions[field].histogram = optionsForThisField;
  }
  return sortedTabsOptions;
};
