const histogramQueryStrForEachField = field => (`
  ${field} {
    histogram {
      key
      count
    }
  }`);

const queryGuppyForAggs = (path, type, fields, gqlFilter) => {
  const query = `query {
    _aggregation {
      ${type} {
        ${fields.map(field => histogramQueryStrForEachField(field))}
      }
    }
  }`;
  const queryBody = { query };
  if (gqlFilter) {
    const queryWithFilter = `query ($filter: JSON) {
      _aggregation {
        ${type} (filter: $filter,  filterSelf: false) {
          ${fields.map(field => histogramQueryStrForEachField(field))}
        }
      }
    }`;
    queryBody.variables = { filter: gqlFilter };
    queryBody.query = queryWithFilter;
  }
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json());
};

const queryGuppyForRawDataAndTotalCounts = (
  path,
  type,
  fields,
  gqlFilter,
  sort,
  offset = 0,
  size = 20,
) => {
  let queryLine = 'query {';
  if (gqlFilter || sort) {
    queryLine = `query (${sort ? '$sort: JSON,' : ''}${gqlFilter ? '$filter: JSON' : ''}) {`;
  }
  let dataTypeLine = `${type} (offset: ${offset}, size: ${size}) {`;
  if (gqlFilter || sort) {
    dataTypeLine = `${type} (offset: ${offset}, size: ${size}, ${sort ? 'sort: $sort, ' : ''}${gqlFilter ? 'filter: $filter' : ''}) {`;
  }
  let typeAggsLine = `${type} {`;
  if (gqlFilter) {
    typeAggsLine = `${type} (filter: $filter) {`;
  }
  const query = `${queryLine}
    ${dataTypeLine} 
      ${fields.join('\n')}
    }
    _aggregation {
      ${typeAggsLine}
        _totalCount
      }
    }
  }`;
  const queryBody = { query };
  queryBody.variables = {};
  if (gqlFilter) queryBody.variables.filter = gqlFilter;
  if (sort) queryBody.variables.sort = sort;
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json());
};

export const askGuppyAboutAllFieldsAndOptions = (
  path, type, fields,
) => queryGuppyForAggs(path, type, fields);

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

export const askGuppyForAggregationData = (path, type, fields, filterResults) => {
  const filter = getGQLFilter(filterResults);
  return queryGuppyForAggs(path, type, fields, filter);
};

export const askGuppyForRawData = (
  path,
  type,
  fields,
  filterResults,
  sort,
  offset = 0,
  size = 20,
) => {
  const filter = getGQLFilter(filterResults);
  return queryGuppyForRawDataAndTotalCounts(path, type, fields, filter, sort, offset, size);
};

export const getAllFieldsFromFilterConfigs = filterTabConfigs => filterTabConfigs
  .reduce((acc, cur) => acc.concat(cur.filters.map(item => item.field)), []);
