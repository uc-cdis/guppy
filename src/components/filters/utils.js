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
