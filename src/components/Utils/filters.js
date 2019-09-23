/**
   * This function takes two objects containing filters to be applied
   * and combines them into one filter object in the same format.
   * Note: the admin filter takes precedence. Selected values in the user
   * filter will be discarded if the key collides. This is to avoid
   * the user undoing the admin filter. (Multiple user checkboxes increase the 
   amount of data shown when combined, but an admin filter should always decrease
   or keep constant the amount of dat shown when combined with a user filter).
  * */
  export const mergeFilters = (userFilter, adminAppliedPreFilter) => {
    console.log('guppy mergeFilters. userFilter: ', userFilter);
    console.log('guppy mergeFilters. adminAppliedPreFilter: ', adminAppliedPreFilter);
    const filterAB = Object.assign({}, userFilter);
    for (const key in adminAppliedPreFilter) {
      if (Object.prototype.hasOwnProperty.call(userFilter, key)
          && Object.prototype.hasOwnProperty.call(adminAppliedPreFilter, key)) {
        console.log('mergeFilters 72: ', key);
        // The admin filter overrides the user filter to maintain exclusivity.
        filterAB[key].selectedValues = adminAppliedPreFilter[key].selectedValues;
      } else if (Object.prototype.hasOwnProperty.call(adminAppliedPreFilter, key)) {
        filterAB[key] = { 'selectedValues' : adminAppliedPreFilter[key].selectedValues };
      }
    }
    console.log('guppy mergeFilters. filterAB: ', filterAB);
    return filterAB;
  };