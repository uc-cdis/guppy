import fetch from 'isomorphic-fetch';
import { jsonToFormat } from './conversion';

const graphqlEndpoint = '/graphql';
const downloadEndpoint = '/download';
const statusEndpoint = '/_status';
const headers = {
  'Content-Type': 'application/json',
};

const histogramQueryStrForEachField = (field, isAsTextAgg = false) => {
  const splittedFieldArray = field.split('.');
  const splittedField = splittedFieldArray.shift();
  if (splittedFieldArray.length === 0) {
    return (`
    ${splittedField} {
      ${(isAsTextAgg) ? 'asTextHistogram' : 'histogram'} {
        key
        count
      }
    }`);
  }
  return (`
  ${splittedField} {
    ${histogramQueryStrForEachField(splittedFieldArray.join('.'))}
  }`);
};

const queryGuppyForAggs = (path, type, regularAggFields, asTextAggFields, gqlFilter, acc, csrfToken = '') => {
  let accessibility = acc;
  if (accessibility !== 'all' && accessibility !== 'accessible' && accessibility !== 'unaccessible') {
    accessibility = 'all';
  }

  const queryBody = {};
  if (gqlFilter) {
    const queryWithFilter = `query ($filter: JSON) {
      _aggregation {
        ${type} (filter: $filter, filterSelf: false, accessibility: ${accessibility}) {
          ${regularAggFields.map((field) => histogramQueryStrForEachField(field, false))}
          ${asTextAggFields.map((field) => histogramQueryStrForEachField(field, true))}
        }
      }
    }`;
    queryBody.variables = { filter: gqlFilter };
    queryBody.query = queryWithFilter;
  } else {
    queryBody.query = `query {
      _aggregation {
        ${type} (accessibility: ${accessibility}) {
          ${regularAggFields.map((field) => histogramQueryStrForEachField(field, false))}
          ${asTextAggFields.map((field) => histogramQueryStrForEachField(field, true))}
        }
      }
    }`;
  }

  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: csrfToken ? { ...headers, 'x-csrf-token': csrfToken } : headers,
    body: JSON.stringify(queryBody),
  }).then((response) => response.json());
};

const queryGuppyForStatus = (path) => fetch(`${path}${statusEndpoint}`, {
  method: 'GET',
  headers,
}).then((response) => response.json());

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
        count
        terms {
          key
          count
        }
      }
    }
  }`);

const queryGuppyForSubAgg = (
  path,
  type,
  mainField,
  termsFields,
  missingFields,
  gqlFilter,
  acc,
  numericAggAsText = false,
  csrfToken = '',
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
    headers: csrfToken ? { ...headers, 'x-csrf-token': csrfToken } : headers,
    body: JSON.stringify(queryBody),
  }).then((response) => response.json())
    .catch((err) => {
      throw new Error(`Error during queryGuppyForSubAgg ${err}`);
    });
};

const rawDataQueryStrForEachField = (field) => {
  const splittedFieldArray = field.split('.');
  const splittedField = splittedFieldArray.shift();
  if (splittedFieldArray.length === 0) {
    return (`
    ${splittedField}
    `);
  }
  return (`
  ${splittedField} {
    ${rawDataQueryStrForEachField(splittedFieldArray.join('.'))}
  }`);
};

export const queryGuppyForRawDataAndTotalCounts = (
  path,
  type,
  fields,
  gqlFilter,
  sort,
  format,
  offset = 0,
  size = 20,
  accessibility = 'all',
  csrfToken = '',
) => {
  let queryLine = 'query {';
  if (gqlFilter || sort || format) {
    queryLine = `query (${sort ? '$sort: JSON,' : ''}${gqlFilter ? '$filter: JSON,' : ''}${format ? '$format: Format' : ''}) {`;
  }
  let dataTypeLine = `${type} (accessibility: ${accessibility}, offset: ${offset}, first: ${size}, format: $format) {`;
  if (gqlFilter || sort || format) {
    dataTypeLine = `${type} (accessibility: ${accessibility}, offset: ${offset}, first: ${size}, ${format ? 'format: $format, ' : ''}, ${sort ? 'sort: $sort, ' : ''}${gqlFilter ? 'filter: $filter,' : ''}) {`;
  }
  let typeAggsLine = `${type} accessibility: ${accessibility} {`;
  if (gqlFilter) {
    typeAggsLine = `${type} (filter: $filter, accessibility: ${accessibility}) {`;
  }
  const processedFields = fields.map((field) => rawDataQueryStrForEachField(field));
  const query = `${queryLine}
    ${dataTypeLine}
      ${processedFields.join('\n')}
    }
    _aggregation {
      ${typeAggsLine}
        _totalCount
      }
    }
  }`;
  const queryBody = { query };
  queryBody.variables = {};
  if (format) queryBody.variables.format = format;
  if (gqlFilter) queryBody.variables.filter = gqlFilter;
  if (sort) queryBody.variables.sort = sort;
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: csrfToken ? { ...headers, 'x-csrf-token': csrfToken } : headers,
    body: JSON.stringify(queryBody),
  }).then((response) => response.json())
    .catch((err) => {
      throw new Error(`Error during queryGuppyForRawDataAndTotalCounts ${err}`);
    });
};

export const getGQLFilter = (filterObj) => {
  const facetsList = [];
  Object.keys(filterObj).forEach((field) => {
    const filterValues = filterObj[field];
    const fieldSplitted = field.split('.');
    const fieldName = fieldSplitted[fieldSplitted.length - 1];
    // The combine mode defaults to OR when not set.
    const combineMode = filterValues.__combineMode ? filterValues.__combineMode : 'OR';

    const hasSelectedValues = filterValues.selectedValues && filterValues.selectedValues.length > 0;
    const hasRangeFilter = typeof filterValues.lowerBound !== 'undefined' && typeof filterValues.upperBound !== 'undefined';

    let facetsPiece = {};
    if (hasSelectedValues && combineMode === 'OR') {
      facetsPiece = {
        IN: {
          [fieldName]: filterValues.selectedValues,
        },
      };
    } else if (hasSelectedValues && combineMode === 'AND') {
      facetsPiece = { AND: [] };
      for (let i = 0; i < filterValues.selectedValues.length; i += 1) {
        facetsPiece.AND.push({
          IN: {
            [fieldName]: [filterValues.selectedValues[i]],
          },
        });
      }
    } else if (hasRangeFilter) {
      facetsPiece = {
        AND: [
          { '>=': { [fieldName]: filterValues.lowerBound } },
          { '<=': { [fieldName]: filterValues.upperBound } },
        ],
      };
    } else if (filterValues.__combineMode && !hasSelectedValues && !hasRangeFilter) {
      // This filter only has a combine setting so far. We can ignore it.
      return;
    } else if (hasSelectedValues) {
      // filter has selected values but we don't know how to process it
      // eslint-disable-next-line no-console
      console.error(filterValues);
      throw new Error('Invalid filter object');
    }
    if (fieldSplitted.length > 1) { // nested field
      fieldSplitted.pop();
      facetsPiece = {
        nested: {
          path: fieldSplitted.join('.'), // parent path
          ...facetsPiece,
        },
      };
    }
    facetsList.push(facetsPiece);
  });
  const gqlFilter = {
    AND: facetsList,
  };
  return gqlFilter;
};

// eslint-disable-next-line max-len
export const askGuppyAboutArrayTypes = (path) => queryGuppyForStatus(path).then((res) => res.indices);

export const askGuppyForAggregationData = (
  path,
  type,
  regularAggFields,
  asTextAggFields,
  filter,
  accessibility,
  csrfToken = '',
) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForAggs(path, type, regularAggFields, asTextAggFields, gqlFilter, accessibility, csrfToken);
};

export const askGuppyForSubAggregationData = (
  path,
  type,
  mainField,
  numericAggAsText,
  termsNestedFields,
  missedNestedFields,
  filter,
  accessibility,
  csrfToken,
) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForSubAgg(
    path,
    type,
    mainField,
    termsNestedFields,
    missedNestedFields,
    gqlFilter,
    accessibility,
    numericAggAsText,
    csrfToken,
  );
};

export const askGuppyForRawData = (
  path,
  type,
  fields,
  filter,
  sort,
  format,
  offset = 0,
  size = 20,
  accessibility = 'all',
  csrfToken = '',
) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForRawDataAndTotalCounts(
    path,
    type,
    fields,
    gqlFilter,
    sort,
    format,
    offset,
    size,
    accessibility,
    csrfToken,
  );
};

export const getAllFieldsFromFilterConfigs = (filterTabConfigs) => filterTabConfigs.reduce((acc, cur) => {
  Object.keys(cur)
    .filter((key) => key === 'fields' || key === 'asTextAggFields')
    .forEach((key) => { acc[key] = acc[key].concat(cur[key], []); });
  return acc;
}, { fields: [], asTextAggFields: [] });

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
    format,
  },
  csrfToken = '',
) => {
  const SCROLL_SIZE = 10000;
  const JSON_FORMAT = (format === 'json' || format === undefined);
  if (totalCount > SCROLL_SIZE) {
    const queryBody = { type };
    if (fields) queryBody.fields = fields;
    if (filter) queryBody.filter = getGQLFilter(filter);
    if (sort) queryBody.sort = sort;
    if (typeof accessibility !== 'undefined') queryBody.accessibility = accessibility;
    return fetch(`${path}${downloadEndpoint}`, {
      method: 'POST',
      headers: csrfToken ? { ...headers, 'x-csrf-token': csrfToken } : headers,
      body: JSON.stringify(queryBody),
    })
      .then((r) => r.json())
      .then((res) => (JSON_FORMAT ? res : jsonToFormat(res, format)));
  }
  return askGuppyForRawData(path, type, fields, filter, sort, format, 0, totalCount, accessibility, csrfToken)
    .then((res) => {
      if (res && res.data && res.data[type]) {
        return JSON_FORMAT ? res.data[type] : jsonToFormat(res.data[type], format);
      }
      throw Error('Error downloading data from Guppy');
    });
};

export const askGuppyForTotalCounts = (
  path,
  type,
  filter,
  accessibility = 'all',
  csrfToken = '',
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
    headers: csrfToken ? { ...headers, 'x-csrf-token': csrfToken } : headers,
    body: JSON.stringify(queryBody),
  }).then((response) => response.json())
    .then((response) => {
      if (response.errors) {
        throw new Error(`Error during download ${response.errors}`);
      }
      return response.data._aggregation[type]._totalCount;
    })
    .catch((err) => {
      throw new Error(`Error during download ${err}`);
    });
};

export const getAllFieldsFromGuppy = (
  path,
  type,
  csrfToken = '',
) => {
  const query = `{
    _mapping {
      ${type}
    }
  }`;
  const queryBody = { query };
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: csrfToken ? { ...headers, 'x-csrf-token': csrfToken } : headers,
    body: JSON.stringify(queryBody),
  }).then((response) => response.json())
    .then((response) => response.data._mapping[type])
    .catch((err) => {
      throw new Error(`Error when getting fields from guppy: ${err}`);
    });
};

export const getAccessibleResources = async (
  path,
  type,
  accessibleFieldCheckList,
  csrfToken = '',
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
        headers: csrfToken ? { ...headers, 'x-csrf-token': csrfToken } : headers,
        body: JSON.stringify(queryBody),
      })
        .then((response) => response.json())
        .then(
          (response) => ({
            field: accessibleField,
            list: (response.data._aggregation[type][accessibleField]
              .histogram.map((item) => item.key)),
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
