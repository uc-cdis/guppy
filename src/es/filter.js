import { esFieldNumericTextTypeMapping, NumericTextTypeTypeEnum } from './const';

const getNumericTextType = (
  esContext,
  field,
) => esFieldNumericTextTypeMapping[esContext.fieldTypes[field]];

// FIXME: "is not"
const getFilterItemForString = (field, value) => ({
  term: {
    [field]: value,
  },
});
const getFilterItemForNumbers = (op, field, value) => {
  const rangeOperator = {
    '>': 'gt',
    '>=': 'gte',
    '<': 'lt',
    '<=': 'lte',
  };
  if (op in rangeOperator) {
    return {
      range: {
        [field]: { [rangeOperator[op]]: value },
      },
    };
  }
  if (op === '=') {
    return {
      term: {
        [field]: value,
      },
    };
  }
  throw new Error(`Invalid numeric operation ${op}`);
};

export const getFilterObj = (esContext, graphqlFilterObj) => {
  const topLevelOp = Object.keys(graphqlFilterObj)[0];
  let resultFilterObj = {};
  if (topLevelOp === 'AND') {
    resultFilterObj = {
      bool: {
        must: graphqlFilterObj[topLevelOp].map(filterItem => getFilterObj(esContext, filterItem)),
      },
    };
  } else if (topLevelOp === 'OR') {
    resultFilterObj = {
      bool: {
        should: graphqlFilterObj[topLevelOp].map(filterItem => getFilterObj(esContext, filterItem)),
      },
    };
  } else {
    const field = graphqlFilterObj[topLevelOp][0];
    const value = graphqlFilterObj[topLevelOp][1];
    const numericOrTextType = getNumericTextType(esContext, field);
    if (numericOrTextType === NumericTextTypeTypeEnum.ES_TEXT_TYPE) {
      resultFilterObj = getFilterItemForString(field, value);
    } else if (numericOrTextType === NumericTextTypeTypeEnum.ES_NUMERIC_TYPE) {
      resultFilterObj = getFilterItemForNumbers(topLevelOp, field, value);
    } else {
      throw new Error(`Invalid es field type ${numericOrTextType}`);
    }
  }
  return resultFilterObj;
};

const filterData = async (esContext, filter, offset = 0, size) => {
  const queryBody = { from: offset };
  if (typeof filter !== 'undefined') {
    queryBody.query = getFilterObj(esContext, filter);
  }
  if (typeof size !== 'undefined') {
    queryBody.size = size;
  }
  const result = await esContext.queryHandler(queryBody);
  return result;
};

export const getCount = async (esContext, filter) => {
  const result = await filterData(esContext, filter, 0, 0);
  console.log('======getCount========= ', result);
  return result.hits.total;
};

export const getData = async (esContext, fields, filter, sort, offset = 0, size) => {
  const queryBody = {
    from: offset,
  };
  if (typeof filter !== 'undefined') {
    queryBody.query = getFilterObj(esContext, filter);
  }
  if (typeof sort !== 'undefined' && sort.length > 0) {
    queryBody.sort = sort;
  }
  if (typeof size !== 'undefined') {
    queryBody.size = size;
  }
  if (fields && fields.length > 0) {
    queryBody._source = fields;
  }
  const result = await esContext.queryHandler(queryBody);
  const parsedResults = result.hits.hits.map(item => item._source);
  console.log(JSON.stringify(parsedResults, null, 4));
  return parsedResults;
};
