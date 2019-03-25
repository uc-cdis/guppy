
export const getFilterGroupConfig = filterConfig => ({
  tabs: filterConfig.tabs.map(t => ({
    title: t.title,
    fields: t.filters.map(f => f.field),
  })),
});

const getSingleFilterOption = (histogramResult, initHistogramRes) => {
  if (!histogramResult || !histogramResult.histogram || histogramResult.histogram.length === 0) {
    throw new Error(`Error parsing field options ${JSON.stringify(histogramResult)}`);
  }
  if (histogramResult.histogram.length === 1 && (typeof histogramResult.histogram[0].key) !== 'string') {
    const rangeOptions = histogramResult.histogram.map((item) => {
      const minValue = initHistogramRes ? initHistogramRes.histogram[0].key[0] : item.key[0];
      const maxValue = initHistogramRes ? initHistogramRes.histogram[0].key[1] : item.key[1];
      return {
        filterType: 'range',
        min: minValue,
        max: maxValue,
        lowerBound: item.key[0],
        upperBound: item.key[1],
        count: item.count,
      };
    });
    // console.log('getSingleFilterOption: number options: ', rangeOptions);
    return rangeOptions;
  }

  const textOptions = histogramResult.histogram.map(item => ({
    text: item.key,
    filterType: 'singleSelect',
    count: item.count,
  }));
    // console.log('getSingleFilterOption: text options: ', textOptions);
  return textOptions;
};

export const getFilterSections = (filters, tabsOptions, initialTabsOptions) => {
  console.log('getFilterSections tabsOptions: ', tabsOptions);
  const sections = filters.map(({ field, label }) => ({
    title: label,
    options: getSingleFilterOption(
      tabsOptions[field],
      initialTabsOptions ? initialTabsOptions[field] : undefined,
    ),
  }));
  // console.log('getFilterSections: ', sections);
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
        resultHistogram = histogram.filter(bucket => selectedValues.includes(bucket.key));
      }
      resultAggsData[field] = { histogram: resultHistogram };
    } else {
      resultAggsData[field] = receivedAggsData[field];
    }
  });
  return resultAggsData;
};
