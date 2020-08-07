import flat from 'flat';
import { queryGuppyForRawDataAndTotalCounts } from '../Utils/queries';

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
    // If searchString is empty return all options
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
          const hasMore = res.data._aggregation[guppyConfig.type]._totalCount !== offset + results.length;
          resolve({
            options: results.map((result) => ({ value: result[field], label: result[field] })),
            hasMore,
          });
        }
      }).catch((err) => {
        console.error(err);
        reject(err);
      });
  });
};

export const getFilterSections = (
  fields, searchFields, fieldMapping, tabsOptions, initialTabsOptions, adminAppliedPreFilters, guppyConfig,
) => {
  // searchFields are all of the fields that use Guppy's search feature to search
  // over a specific field, e.g. file GUID / subject ID.
  let searchFieldSections = [];
  if (searchFields) {
    searchFieldSections = searchFields.map((field) => {
      const overrideName = fieldMapping.find((entry) => (entry.field === field));
      const label = overrideName ? overrideName.name : capitalizeFirstLetter(field);

      const tabsOptionsFiltered = { ...tabsOptions[field] };
      if (Object.keys(adminAppliedPreFilters).includes(field)) {
        tabsOptionsFiltered.histogram = tabsOptionsFiltered.histogram.filter(
          (x) => adminAppliedPreFilters[field].selectedValues.includes(x.key),
        );
      }

      let selectedOptions = [];
      if (tabsOptionsFiltered && tabsOptionsFiltered.histogram) {
        selectedOptions = getSingleFilterOption(
          tabsOptionsFiltered,
          initialTabsOptions ? initialTabsOptions[field] : undefined,
        );
      }

      return {
        title: label,
        options: selectedOptions,
        isSearchFilter: true,
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

    return {
      title: label,
      options: defaultOptions,
    };
  });
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
