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
