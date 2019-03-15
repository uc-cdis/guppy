const histogramQueryStrForEachField = field => (`
  ${field} {
    histogram {
      key
      count
    }
  }`);

const queryGuppyForAggs = (url, fields, gqlFilter) => {
  const query = `query {
    aggs {
      ${fields.map(field => histogramQueryStrForEachField(field))}
    }
  }`;
  const queryBody = { query };
  if (gqlFilter) {
    const queryWithFilter = `query ($filter: JSON) {
      aggs (filter: $filter,  filterSelf: false) {
        ${fields.map(field => histogramQueryStrForEachField(field))}
      }
    }`;
    queryBody.variables = { filter: gqlFilter };
    queryBody.query = queryWithFilter;
  }
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json());
};

export const askGuppyAboutAllFieldsAndOptions = (url, fields) => queryGuppyForAggs(url, fields);

export const getAllFields = filterTabConfigs => filterTabConfigs
  .reduce((acc, cur) => acc.concat(cur.filters.map(item => item.field)), []);

const getGQLFilter = (filterResults) => {
  const facetsList = [];
  Object.keys(filterResults).forEach((field) => {
    const filterValues = filterResults[field];
    if (filterValues.selectedValues) {
      facetsList.push({
        OR: filterValues.selectedValues.map(v => ({
          '=': [field, v],
        })),
      });
    } else if (filterValues.lowerBound && filterValues.upperBound) {
      facetsList.push({
        AND: [
          { '>=': [field, filterValues.lowerBound] },
          { '<=': [field, filterValues.upperBound] },
        ],
      });
    } else {
      throw new Error(`Invalid filter object ${filterValues}`);
    }
  });
  const gqlFilter = {
    AND: facetsList,
  };
  return gqlFilter;
};

export const askGuppyForFilteredData = (url, fields, filterResults) => {
  const filter = getGQLFilter(filterResults);
  return queryGuppyForAggs(url, fields, filter);
};

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
