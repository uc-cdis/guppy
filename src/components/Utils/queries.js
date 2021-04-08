import fetch from 'isomorphic-fetch';
import { jsonToFormat } from './conversion';

const graphqlEndpoint = '/graphql';
const downloadEndpoint = '/download';
const statusEndpoint = '/_status';

const histogramQueryStrForEachField = (field) => {
  const splittedFieldArray = field.split('.');
  const splittedField = splittedFieldArray.shift();
  if (splittedFieldArray.length === 0) {
    return (`
    ${splittedField} {
      histogram {
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

const queryGuppyForAggs = (path, type, fields, gqlFilter, signal) => {
  const query = `query {
    _aggregation {
      ${type} (accessibility: all) {
        ${fields.map((field) => histogramQueryStrForEachField(field))}
      }
    }
  }`;
  const queryBody = { query };
  if (gqlFilter) {
    const queryWithFilter = `query ($filter: JSON) {
      _aggregation {
        ${type} (filter: $filter, filterSelf: false, accessibility: all}) {
          ${fields.map((field) => histogramQueryStrForEachField(field))}
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
    signal,
  }).then((response) => response.json());
};

const queryGuppyForStatus = (path) => fetch(`${path}${statusEndpoint}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
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
  numericAggAsText = false,
  termsFields,
  missingFields,
  gqlFilter,
  acc,
  signal,
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
    signal,
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

export const queryGuppyForRawData = (
  path,
  type,
  fields,
  gqlFilter,
  sort,
  offset = 0,
  size = 20,
  accessibility = 'all',
  signal,
  format,
  withTotalCount = false,
) => {
  let queryLine = 'query {';
  if (gqlFilter || sort || format) {
    queryLine = `query (${sort ? '$sort: JSON,' : ''}${gqlFilter ? '$filter: JSON,' : ''}${format ? '$format: Format' : ''}) {`;
  }
  let dataTypeLine = `${type} (accessibility: ${accessibility}, offset: ${offset}, first: ${size}, format: $format) {`;
  if (gqlFilter || sort || format) {
    dataTypeLine = `${type} (accessibility: ${accessibility}, offset: ${offset}, first: ${size}, ${format ? 'format: $format, ' : ''}, ${sort ? 'sort: $sort, ' : ''}${gqlFilter ? 'filter: $filter,' : ''}) {`;
  }
  let totalCountFragment = '';
  if (withTotalCount) {
    totalCountFragment = `_aggregation {
      ${type} (${gqlFilter ? 'filter: $filter, ' : ''}accessibility: ${accessibility}) {
        _totalCount
      }
    }`;
  }
  const processedFields = fields.map((field) => rawDataQueryStrForEachField(field));
  const query = `${queryLine}
    ${dataTypeLine}
      ${processedFields.join('\n')}
    }
    ${totalCountFragment}
  }`;
  const queryBody = { query };
  queryBody.variables = {};
  if (format) queryBody.variables.format = format;
  if (gqlFilter) queryBody.variables.filter = gqlFilter;
  if (sort) queryBody.variables.sort = sort;
  return fetch(`${path}${graphqlEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
    signal,
  }).then((response) => response.json())
    .catch((err) => {
      throw new Error(`Error during queryGuppyForRawData ${err}`);
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
    } else {
      throw new Error(`Invalid filter object ${filterValues}`);
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

export const askGuppyAboutAllFieldsAndOptions = (path, type, fields, filter) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForAggs(path, type, fields, gqlFilter);
};

// eslint-disable-next-line max-len
export const askGuppyAboutArrayTypes = (path) => queryGuppyForStatus(path).then((res) => res.indices);

export const askGuppyForAggregationData = (path, type, fields, filter, signal) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForAggs(path, type, fields, gqlFilter, signal);
};

export const askGuppyForSubAggregationData = ({
  path,
  type,
  mainField,
  numericAggAsText,
  termsNestedFields,
  missedNestedFields,
  filter,
  accessibility,
  signal,
}) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForSubAgg(
    path,
    type,
    mainField,
    numericAggAsText,
    termsNestedFields,
    missedNestedFields,
    gqlFilter,
    accessibility,
    signal,
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
  signal,
  format,
  withTotalCount,
) => {
  const gqlFilter = getGQLFilter(filter);
  return queryGuppyForRawData(
    path,
    type,
    fields,
    gqlFilter,
    sort,
    offset,
    size,
    accessibility,
    signal,
    format,
    withTotalCount,
  );
};

export const getAllFieldsFromFilterConfigs = (filterTabConfigs) => filterTabConfigs
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
    format,
  },
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody),
    }).then((res) => (JSON_FORMAT ? res.json() : jsonToFormat(res.json(), format)));
  }
  return askGuppyForRawData(path, type, fields, filter, sort, 0, totalCount, accessibility, format)
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
  }).then((response) => response.json())
    .then((response) => response.data._aggregation[type]._totalCount)
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
