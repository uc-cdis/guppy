import { esFieldNumericTextTypeMapping, NumericTextTypeTypeEnum } from './const';

const getNumericTextType = (
  esInstance,
  esIndex,
  esType,
  field,
) => esFieldNumericTextTypeMapping[esInstance.fieldTypes[esIndex][field]];

// FIXME: "is not"
const getFilterItemForString = (op, field, value) => ({
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

export const getFilterObj = (
  esInstance, esIndex, esType, graphqlFilterObj, aggsField, filterSelf = true,
) => {
  const topLevelOp = Object.keys(graphqlFilterObj)[0];
  let resultFilterObj = {};
  if (topLevelOp === 'AND' || topLevelOp === 'OR') {
    const boolConnectOp = topLevelOp === 'AND' ? 'must' : 'should';
    const boolItemsList = [];
    graphqlFilterObj[topLevelOp].forEach((filterItem) => {
      const filterObj = getFilterObj(
        esInstance, esIndex, esType, filterItem, aggsField, filterSelf,
      );
      if (filterObj) {
        boolItemsList.push(filterObj);
      }
    });
    if (boolItemsList.length === 0) {
      resultFilterObj = null;
    } else {
      resultFilterObj = {
        bool: {
          [boolConnectOp]: boolItemsList,
        },
      };
    }
  } else {
    const field = graphqlFilterObj[topLevelOp][0];
    if (aggsField === field && !filterSelf) {
      // if `filterSelf` flag is false, do not filter the target field itself
      return null;
    }
    const value = graphqlFilterObj[topLevelOp][1];
    const numericOrTextType = getNumericTextType(esInstance, esIndex, esType, field);
    if (numericOrTextType === NumericTextTypeTypeEnum.ES_TEXT_TYPE) {
      resultFilterObj = getFilterItemForString(topLevelOp, field, value);
    } else if (numericOrTextType === NumericTextTypeTypeEnum.ES_NUMERIC_TYPE) {
      resultFilterObj = getFilterItemForNumbers(topLevelOp, field, value);
    } else {
      throw new Error(`Invalid es field type ${numericOrTextType}`);
    }
  }
  return resultFilterObj;
};

const filterData = async (
  { esInstance, esIndex, esType },
  {
    filter, fields = [], sort, offset = 0, size,
  }) => {
  const queryBody = { from: offset };
  if (typeof filter !== 'undefined') {
    queryBody.query = getFilterObj(esInstance, esIndex, esType, filter);
  }
  if (typeof sort !== 'undefined') {
    if (sort.length > 0) {
      queryBody.sort = sort;
    } else {
      queryBody.sort = Object.keys(sort).map(field => ({ [field]: sort[field] }));
    }
  }
  if (typeof size !== 'undefined') {
    queryBody.size = size;
  }
  if (fields && fields.length > 0) {
    queryBody._source = fields;
  }
  const result = await esInstance.query(esIndex, esType, queryBody);
  return result;
};

export const getCount = async (esInstance, esIndex, esType, filter) => {
  const result = await filterData({ esInstance, esIndex, esType }, { filter, fields: [] });
  return result.hits.total;
};

export const getData = async (
  {
    esInstance,
    esIndex,
    esType,
  }, {
    fields,
    filter,
    sort,
    offset = 0,
    size,
  }) => {
  const result = await filterData(
    { esInstance, esIndex, esType },
    {
      filter, fields, sort, offset, size,
    },
  );
  return result.hits.hits.map(item => item._source);
};
