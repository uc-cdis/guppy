import flat from 'flat';
import { queryGuppyForRawDataAndTotalCounts } from '../Utils/queries';
// import esInstance from '../../server/es/index';
// import config from '../../server/config';

export const getFilterGroupConfig = (filterConfig) => ({
  tabs: filterConfig.tabs.map((t) => ({
    title: t.title,
    fields: t.filters.map((f) => f.field),
  })),
});

const getSingleFilterOption = (histogramResult, initHistogramRes) => {
  if (!histogramResult || !histogramResult.histogram) {
    throw new Error(`Error parsing field options ${JSON.stringify(histogramResult)}`);
  }
  // if this is for range slider
  if (histogramResult.histogram.length === 1 && (typeof histogramResult.histogram[0].key) !== 'string') {
    const rangeOptions = histogramResult.histogram.map((item) => {
      const minValue = initHistogramRes ? initHistogramRes.histogram[0].key[0] : item.key[0];
      const maxValue = initHistogramRes ? initHistogramRes.histogram[0].key[1] : item.key[1];
      return {
        filterType: 'range',
        min: Math.floor(minValue),
        max: Math.ceil(maxValue),
        lowerBound: item.key[0],
        upperBound: item.key[1],
        count: item.count,
      };
    });
    return rangeOptions;
  }

  const textOptions = histogramResult.histogram.map((item) => ({
    text: item.key,
    filterType: 'singleSelect',
    isArrayType: item.hasOwnProperty('isArrayType') ? item.isArrayType : false,
    count: item.count,
    accessible: item.accessible,
  }));
  return textOptions;
};

const capitalizeFirstLetter = (str) => {
  const res = str.replace(/_|\./gi, ' ');
  return res.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// createSearchFilterLoadOptionsFn creates a handler function that loads the search filter's
// autosuggest options as the user types in the search filter.
const createSearchFilterLoadOptionsFn = (field, guppyConfig) => (searchString, offset) => {
  const NUM_SEARCH_OPTIONS = 20;
  return new Promise((resolve, reject) => {
    // If searchString is empty return just the first NUM_SEARCH_OPTIONS options.
    // This allows the client to show default options in the search filter before
    // the user has started searching.
    let filter = {};
    if (searchString) {
      filter = {
        search: {
          keyword: searchString,
          fields: [field],
        },
      };
    }
    queryGuppyForRawDataAndTotalCounts(
      guppyConfig.path,
      guppyConfig.type,
      [field],
      filter,
      undefined,
      offset,
      NUM_SEARCH_OPTIONS,
      'accessible',
    )
      .then((res) => {
        if (!res.data || !res.data[guppyConfig.type]) {
          resolve({
            options: [],
            hasMore: false,
          });
        } else {
          const results = res.data[guppyConfig.type];
          const totalCount = res.data._aggregation[guppyConfig.type]._totalCount;
          resolve({
            options: results.map((result) => ({ value: result[field], label: result[field] })),
            hasMore: totalCount > offset + results.length,
          });
        }
      }).catch((err) => {
        reject(err);
      });
  });
};

export const checkIsArrayField = (field, arrayFields) => {
  console.log('guppy is now checking whether this is an array field: ', field);
  console.log('guppyConfig: ', guppyConfig);
  let isArrayField = false;
  let keys = Object.keys(arrayFields);
  for(let i = 0; i < keys.length; i += 1) {
    if(this.props.arrayFields[keys[i]].includes(field)) {
      isArrayField = true;
    }
  }
  console.log('106 ay ay isArrayField: ', isArrayField);
  return isArrayField;
}

export const getFilterSections = (
  fields, searchFields, fieldMapping, tabsOptions,
  initialTabsOptions, adminAppliedPreFilters, guppyConfig, arrayFields
) => {
  let searchFieldSections = [];
  console.log('1115 YEEEEEE');

  if (searchFields) {
    // Process searchFields first -- searchFields are special filters that allow the user
    // to search over all options, instead of displaying all options in a list. This allows
    // guppy/portal to support filters that have too many options to be displayed in a list.
    searchFieldSections = searchFields.map((field) => {
      const overrideName = fieldMapping.find((entry) => (entry.field === field));
      const label = overrideName ? overrideName.name : capitalizeFirstLetter(field);

      const tabsOptionsFiltered = { ...tabsOptions[field] };
      if (Object.keys(adminAppliedPreFilters).includes(field)) {
        tabsOptionsFiltered.histogram = tabsOptionsFiltered.histogram.filter(
          (x) => adminAppliedPreFilters[field].selectedValues.includes(x.key),
        );
      }

      // For searchFields, don't pass all options to the component, only the selected ones.
      // This allows selected options to appear below the search box once they are selected.
      let selectedOptions = [];
      if (tabsOptionsFiltered && tabsOptionsFiltered.histogram) {
        selectedOptions = getSingleFilterOption(
          tabsOptionsFiltered,
          initialTabsOptions ? initialTabsOptions[field] : undefined,
        );
      }

      console.log('made it to the search fields block');
      console.log('142 field: ', field);
      console.log('143 label: ', label);
      console.log('144 arrayFields: ', arrayFields);
      let fieldIsArrayField = checkIsArrayField(field, arrayFields);

      
      return {
        title: label,
        options: selectedOptions,
        isSearchFilter: true,
        isArrayField: fieldIsArrayField,
        onSearchFilterLoadOptions: createSearchFilterLoadOptionsFn(field, guppyConfig),
      };
    });
  }

  const sections = fields.map((field) => {
    const overrideName = fieldMapping.find((entry) => (entry.field === field));
    const label = overrideName ? overrideName.name : capitalizeFirstLetter(field);

    const tabsOptionsFiltered = { ...tabsOptions[field] };
    if (Object.keys(adminAppliedPreFilters).includes(field)) {
      tabsOptionsFiltered.histogram = tabsOptionsFiltered.histogram.filter(
        (x) => adminAppliedPreFilters[field].selectedValues.includes(x.key),
      );
    }

    const defaultOptions = getSingleFilterOption(
      tabsOptionsFiltered,
      initialTabsOptions ? initialTabsOptions[field] : undefined,
    );

    let fieldIsArrayField = checkIsArrayField(field, arrayFields);
    console.log('176 field: ', field);
    console.log('177 default options: ', defaultOptions);
    console.log('178 fieldIsArrayField: ', fieldIsArrayField);



    return {
      title: label,
      options: defaultOptions,
    };
  });
  
  console.log('yee default options: ', sections);
  //console.log('yee fields: ', fields);
  //console.log('yee arrayFields: ', arrayFields);
  return searchFieldSections.concat(sections);
};

export const excludeSelfFilterFromAggsData = (receivedAggsData, filterResults) => {
  if (!filterResults) return receivedAggsData;
  const resultAggsData = {};
  const flattenAggsData = flat(receivedAggsData, { safe: true });
  Object.keys(flattenAggsData).forEach((field) => {
    const actualFieldName = field.replace('.histogram', '');
    const histogram = flattenAggsData[`${field}`];
    if (!histogram) return;
    if (actualFieldName in filterResults) {
      let resultHistogram = [];
      if (typeof filterResults[`${actualFieldName}`].selectedValues !== 'undefined') {
        const { selectedValues } = filterResults[`${actualFieldName}`];
        resultHistogram = histogram.filter((bucket) => selectedValues.includes(bucket.key));
      }
      resultAggsData[`${actualFieldName}`] = { histogram: resultHistogram };
    } else {
      resultAggsData[`${actualFieldName}`] = { histogram: flattenAggsData[`${field}`] };
    }
  });
  return resultAggsData;
};
