
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
  const res = str.replace(/_/gi, ' ');
  return res.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

export const getFilterSections = (
  fields, fieldMapping, tabsOptions, initialTabsOptions, adminAppliedPreFilters,
) => {
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
  return sections;
};

export const excludeSelfFilterFromAggsData = (receivedAggsData, filterResults) => {
  if (!filterResults) return receivedAggsData;
  const resultAggsData = {};
  Object.keys(receivedAggsData).forEach((field) => {
    const { histogram } = receivedAggsData[field];
    if (!histogram) return;
    if (field in filterResults) {
      let resultHistogram = [];
      if (typeof filterResults[field].selectedValues !== 'undefined') {
        const { selectedValues } = filterResults[field];
        resultHistogram = histogram.filter((bucket) => selectedValues.includes(bucket.key));
      }
      resultAggsData[field] = { histogram: resultHistogram };
    } else {
      resultAggsData[field] = receivedAggsData[field];
    }
  });
  return resultAggsData;
};
