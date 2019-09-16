import fetch from 'isomorphic-fetch';


const graphqlEndpoint = '/graphql';
const downloadEndpoint = '/download';

const histogramQueryStrForEachField = field => (`
  ${field} {
    histogram {
      key
      count
    }
  }`);

const queryGuppyForAggs = (path, type, fields, gqlFilter, acc) => {
  let accessibility = acc;
  if (accessibility !== 'all' && accessibility !== 'accessible' && accessibility !== 'unaccessible') {
    accessibility = 'all';
  }

  const query = `query {
    _aggregation {
      ${type} (accessibility: ${accessibility}) {
        ${fields.map(field => histogramQueryStrForEachField(field))}
      }
    }
  }`;
  const queryBody = { query };
  if (gqlFilter) {
    const queryWithFilter = `query ($filter: JSON) {
      _aggregation {
        ${type} (filter: $filter, filterSelf: false, accessibility: ${accessibility}) {
          ${fields.map(field => histogramQueryStrForEachField(field))}
        }
      }
    }`;
    queryBody.variables = { filter: gqlFilter };
    queryBody.query = queryWithFilter;
  }
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json());
};

const nestedHistogramQueryStrForEachField = (mainField, numericAggAsText) => (`
  ${mainField} {
    ${numericAggAsText ? 'asTextHistogram' : 'histogram'} {
      key
      count
      missingFields {
        field
        count
      }
      termsFields {
        field
        terms {
          key
          count
        }
      } 
    }
  }`);

const queryGuppyForNestedAgg = (
  path,
  type,
  mainField,
  numericAggAsText = false,
  termsFields,
  missingFields,
  gqlFilter,
  acc,
) => {
  let accessibility = acc;
  if (accessibility !== 'all' && accessibility !== 'accessible' && accessibility !== 'unaccessible') {
    accessibility = 'all';
  }

  const nestedAggFields = {};
  if (termsFields) {
    nestedAggFields.termsFields = termsFields;
  }
  if (missingFields) {
    nestedAggFields.missingFields = missingFields;
  }

  const query = `query ($nestedAggFields: JSON) {
    _aggregation {
      ${type} (nestedAggFields: $nestedAggFields, accessibility: ${accessibility}) {
        ${nestedHistogramQueryStrForEachField(mainField, numericAggAsText)}
      }
    }
  }`;
  const queryBody = { query };
  queryBody.variables = { nestedAggFields };
  if (gqlFilter) {
    const queryWithFilter = `query ($filter: JSON, $nestedAggFields: JSON) {
      _aggregation {
        ${type} (filter: $filter, filterSelf: false, nestedAggFields: $nestedAggFields, accessibility: ${accessibility}) {
          ${nestedHistogramQueryStrForEachField(mainField, numericAggAsText)}
        }
      }
    }`;
    queryBody.variables = { filter: gqlFilter, nestedAggFields };
    queryBody.query = queryWithFilter;
  }
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json())
    .catch((err) => {
      throw new Error(`Error during queryGuppyForNestedAgg ${err}`);
    });
};

const queryGuppyForRawDataAndTotalCounts = (
  path,
  type,
  fields,
  gqlFilter,
  sort,
  offset = 0,
  size = 20,
  accessibility = 'all',
) => {
  let queryLine = 'query {';
  if (gqlFilter || sort) {
    queryLine = `query (${sort ? '$sort: JSON,' : ''}${gqlFilter ? '$filter: JSON' : ''}) {`;
  }
  let dataTypeLine = `${type} (accessibility: ${accessibility}, offset: ${offset}, first: ${size}) {`;
  if (gqlFilter || sort) {
    dataTypeLine = `${type} (accessibility: ${accessibility}, offset: ${offset}, first: ${size}, ${sort ? 'sort: $sort, ' : ''}${gqlFilter ? 'filter: $filter' : ''}) {`;
  }
  let typeAggsLine = `${type} accessibility: ${accessibility} {`;
  if (gqlFilter) {
    typeAggsLine = `${type} (filter: $filter, accessibility: ${accessibility}) {`;
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
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json())
    .catch((err) => {
      throw new Error(`Error during queryGuppyForRawDataAndTotalCounts ${err}`);
    });
};

export const askGuppyAboutAllFieldsAndOptions = (
  path, type, fields, accessibility,
) => queryGuppyForAggs(path, type, fields, undefined, accessibility);

export const getGQLFilter = (filterObj) => {
  const facetsList = [];
  Object.keys(filterObj).forEach((field) => {
    const filterValues = filterObj[field];
    if (filterValues.selectedValues) {
      facetsList.push({
        IN: {
          [field]: filterValues.selectedValues,
        },
      });
    } else if (typeof filterValues.lowerBound !== 'undefined' && typeof filterValues.upperBound !== 'undefined') {
      facetsList.push({
        AND: [
          { '>=': { [field]: filterValues.lowerBound } },
          { '<=': { [field]: filterValues.upperBound } },
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

export const askGuppyForAggregationData = (path, type, fields, filter, accessibility) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForAggs(path, type, fields, gqlFilter, accessibility);
};

export const askGuppyForNestedAggregationData = (
  path,
  type,
  mainField,
  numericAggAsText,
  termsNestedFields,
  missedNestedFields,
  filter,
  accessibility,
) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForNestedAgg(
    path,
    type,
    mainField,
    numericAggAsText,
    termsNestedFields,
    missedNestedFields,
    gqlFilter,
    accessibility,
  );
};

export const askGuppyForRawData = (
  path,
  type,
  fields,
  filter,
  sort,
  offset = 0,
  size = 20,
  accessibility = 'all',
) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForRawDataAndTotalCounts(
    path,
    type,
    fields,
    gqlFilter,
    sort,
    offset,
    size,
    accessibility,
  );
};

export const getAllFieldsFromFilterConfigs = filterTabConfigs => filterTabConfigs
  .reduce((acc, cur) => acc.concat(cur.fields), []);

/**
 * Download all data from guppy using fields, filter, and sort args.
 * If total count is less than 10000 this will use normal graphql endpoint
 * If greater than 10000, use /download endpoint
 */
export const downloadDataFromGuppy = (
  path,
  type,
  totalCount,
  {
    fields,
    filter,
    sort,
    accessibility,
  },
) => {
  const SCROLL_SIZE = 10000;
  if (totalCount > SCROLL_SIZE) {
    const queryBody = { type };
    if (fields) queryBody.fields = fields;
    if (filter) queryBody.filter = getGQLFilter(filter);
    if (sort) queryBody.sort = sort;
    if (typeof accessibility !== 'undefined') queryBody.accessibility = accessibility;
    return fetch(`${path}${downloadEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody),
    }).then(response => response.json());
  }
  return askGuppyForRawData(path, type, fields, filter, sort, 0, totalCount, accessibility)
    .then((res) => {
      if (res && res.data && res.data[type]) {
        return res.data[type];
      }
      throw Error('Error downloading data from Guppy');
    });
};


export const askGuppyForTotalCounts = (
  path,
  type,
  filter,
  accessibility = 'all',
) => {
  const gqlFilter = getGQLFilter(filter);
  const queryLine = `query ${gqlFilter ? '($filter: JSON)' : ''}{`;
  const typeAggsLine = `${type} ${gqlFilter ? '(filter: $filter, ' : '('} accessibility: ${accessibility}) {`;
  const query = `${queryLine}
    _aggregation {
      ${typeAggsLine}
        _totalCount
      }
    }
  }`;
  const queryBody = { query };
  queryBody.variables = {};
  if (gqlFilter) queryBody.variables.filter = gqlFilter;
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json())
    .then(response => response.data._aggregation[type]._totalCount)
    .catch((err) => {
      throw new Error(`Error during download ${err}`);
    });
};

export const getAllFieldsFromGuppy = (
  path,
  type,
) => {
  const query = `{
    _mapping {
      ${type}
    }
  }`;
  const queryBody = { query };
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  }).then(response => response.json())
    .then(response => response.data._mapping[type])
    .catch((err) => {
      throw new Error(`Error when getting fields from guppy: ${err}`);
    });
};

export const getAccessibleResources = async (
  path,
  type,
  accessibleFieldCheckList,
) => {
  const accessiblePromiseList = [];
  const unaccessiblePromiseList = [];
  accessibleFieldCheckList.forEach((accessibleField) => {
    const fetchRequestPromise = (accessible) => {
      const query = `query {
        _aggregation {
          ${type} (accessibility: ${accessible ? 'accessible' : 'unaccessible'}) {
            ${accessibleField} {
              histogram {
                key
                count
              }
            }
          }
        }
      }`;
      const queryBody = { query };

      return fetch(`${path}${graphqlEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      })
        .then(response => response.json())
        .then(
          response => ({
            field: accessibleField,
            list: (response.data._aggregation[type][accessibleField]
              .histogram.map(item => item.key)),
          }),
        )
        .catch((err) => {
          throw new Error(`Error when getting fields from guppy: ${err}`);
        });
    };
    accessiblePromiseList.push(fetchRequestPromise(true));
    unaccessiblePromiseList.push(fetchRequestPromise(false));
  });

  const accessibleFieldObject = {};
  const accessibleFieldResult = await Promise.all(accessiblePromiseList);
  accessibleFieldResult.forEach((res) => {
    accessibleFieldObject[res.field] = res.list;
  });
  const unaccessibleFieldObject = {};
  const unaccessibleFieldResult = await Promise.all(unaccessiblePromiseList);
  unaccessibleFieldResult.forEach((res) => {
    unaccessibleFieldObject[res.field] = res.list;
  });
  return { accessibleFieldObject, unaccessibleFieldObject };
};
