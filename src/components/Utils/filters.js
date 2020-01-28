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
  const filterAB = Object.assign({}, userFilter);
  Object.keys(adminAppliedPreFilter).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(userFilter, key)
          && Object.prototype.hasOwnProperty.call(adminAppliedPreFilter, key)) {
      const userFilterSubset = userFilter[key].selectedValues.filter(
        x => adminAppliedPreFilter[key].selectedValues.includes(x),
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

function isFilterOptionToBeHidden(option, filtersApplied, fieldName) {
  console.log('should it be hidden? ', option);
  if (option.count > 0) {
    return false;
  }
  try {
    if (filtersApplied[fieldName].selectedValues.includes(option.key)) {
      return false;
    }
  } catch(err) {
    return true;
  }
}

/**
   * This function updates the counts in the initial set of tab options
   * calculated from unfiltered data.
   * It is used to retain field options in the rendering if
   * they are still checked but their counts are zero.
   */
export const updateCountsInInitialTabsOptions = (initialTabsOptions, processedTabsOptions, filtersApplied) => {
  const updatedTabsOptions = JSON.parse(JSON.stringify(initialTabsOptions));
  const initialFields = Object.keys(initialTabsOptions);
  for (let i = 0; i < initialFields.length; i += 1) {
    const fieldName = initialFields[i];
    const initialFieldOptions = initialTabsOptions[fieldName].histogram.map(x => x.key);
    let processedFieldOptions = [];
    if (Object.prototype.hasOwnProperty.call(processedTabsOptions, fieldName)) {
      processedFieldOptions = processedTabsOptions[fieldName].histogram.map(x => x.key);
    }

    for (let j = 0; j < initialFieldOptions.length; j += 1) {
      const optionName = initialFieldOptions[j];
      let newCount;
      if (processedFieldOptions.includes(optionName)) {
        newCount = processedTabsOptions[fieldName].histogram.filter(
          x => x.key === optionName,
        )[0].count;
      } else {
        newCount = 0;
      }
      for (let k = 0; k < updatedTabsOptions[fieldName].histogram.length; k += 1) {
        const option = updatedTabsOptions[fieldName].histogram[k];
        if (option.key === optionName) {
          updatedTabsOptions[fieldName].histogram[k].count = newCount;
          if (isFilterOptionToBeHidden(updatedTabsOptions[fieldName].histogram[k], filtersApplied)) {
            console.log('removing ', updatedTabsOptions[fieldName].histogram[k]);
            updatedTabsOptions[fieldName].histogram.splice(k, 1);
          }
        }
      }
    }
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
  const sortedTabsOptions = Object.assign({}, tabsOptions);
  for (let x = 0; x < fields.length; x += 1) {
    let field = fields[x];

    const optionsForThisField = sortedTabsOptions[field].histogram;
    optionsForThisField.sort(sortCountThenAlpha);
    sortedTabsOptions[field].histogram = optionsForThisField;

    }
  return sortedTabsOptions;
}