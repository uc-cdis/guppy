import _ from 'lodash';
import { ApolloError, UserInputError } from 'apollo-server';
import { esFieldNumericTextTypeMapping, NumericTextTypeTypeEnum } from './const';
import config from '../config';

const fromPathToNode = (esInstance, esIndex, path) => {
  let node = esInstance.fieldTypes[esIndex];
  if (path !== null && path !== undefined) {
    const nodes = path.split('.');
    nodes.forEach((n) => {
      if (n in node) {
        node = node[n].properties;
      } else {
        throw new UserInputError(`Field ${n} does not exist in ES index`);
      }
    });
  }
  return node;
};

const mergeRangeOperations = (a, b) => {
  const merged = { ...a, ...b };

  Object.keys(merged).forEach((key) => {
    if (typeof merged[key] === 'object' && merged[key] !== null) {
      merged[key] = mergeRangeOperations(a[key], b[key]);
    }
  });

  return merged;
};

const getNumericTextType = (
  esInstance,
  esIndex,
  field,
  path,
) => {
  const node = fromPathToNode(esInstance, esIndex, path);
  if (!esInstance.fieldTypes[esIndex] || !node[field]) {
    throw new UserInputError('Please check your syntax for input "filter" argument');
  }
  const numericTextType = esFieldNumericTextTypeMapping[node[field].type];
  if (typeof numericTextType === 'undefined') {
    throw new ApolloError(`ES type ${node[field].type} not supported.`, 500);
  }
  return numericTextType;
};

const getFilterItemForString = (op, pField, value, path) => {
  const field = (path !== null && path !== undefined) ? `${path}.${pField}` : pField;
  switch (op) {
    case '=':
    case 'eq':
    case 'EQ':
      // special case when missingDataAlias is in using
      if (config.esConfig.aggregationIncludeMissingData
        && value === config.esConfig.missingDataAlias) {
        return {
          bool: {
            must_not: [
              {
                exists: {
                  field,
                },
              },
            ],
          },
        };
      }
      return {
        term: {
          [field]: value,
        },
      };
    case 'in':
    case 'IN':
      // if using missingDataAlias, we need to remove the missingDataAlias from filter values
      // and then add a must_not exists bool func to compensate missingDataAlias
      if (config.esConfig.aggregationIncludeMissingData
        && value.includes(config.esConfig.missingDataAlias)) {
        const newValue = value.filter((element) => element !== config.esConfig.missingDataAlias);
        return {
          bool: {
            should: [
              {
                bool: {
                  must_not: [
                    {
                      exists: {
                        field,
                      },
                    },
                  ],
                },
              },
              {
                terms: {
                  [field]: newValue,
                },
              },
            ],
          },
        };
      }
      // if not using missingDataAlias or filter doesn't contain missingDataAlias
      return {
        terms: {
          [field]: value,
        },
      };
    case '!=':
      return {
        bool: {
          must_not: [
            {
              term: {
                [field]: value,
              },
            },
          ],
        },
      };
    default:
      throw new UserInputError(`Invalid operation "${op}" in filter argument.`);
  }
};

const getFilterItemForNumbers = (op, pField, value, path) => {
  const field = (path !== null && path !== undefined) ? `${path}.${pField}` : pField;
  const rangeOperator = {
    '>': 'gt',
    gt: 'gt',
    GT: 'gt',
    '>=': 'gte',
    gte: 'gte',
    GTE: 'gte',
    '<': 'lt',
    lt: 'lt',
    LT: 'lt',
    '<=': 'lte',
    lte: 'lte',
    LTE: 'lte',
  };
  if (op in rangeOperator) {
    return {
      range: {
        [field]: { [rangeOperator[op]]: value },
      },
    };
  }
  if (op === '=' || op === 'eq' || op === 'EQ') {
    return {
      term: {
        [field]: value,
      },
    };
  }
  if (op === 'IN' || op === 'in') {
    return {
      terms: {
        [field]: value,
      },
    };
  }
  if (op === '!=') {
    return {
      bool: {
        should: [
          {
            range: {
              [field]: { gt: value },
            },
          },
          {
            range: {
              [field]: { lt: value },
            },
          },
        ],
      },
    };
  }
  throw new UserInputError(`Invalid numeric operation "${op}" for field "${field}" in filter argument`);
};

const getESSearchFilterFragment = (esInstance, esIndex, fields, keyword) => {
  let analyzedFields = [`*${config.analyzedTextFieldSuffix}`]; // search all fields by default
  if (typeof fields !== 'undefined') {
    if (typeof fields === 'string') {
      fields = [fields]; // eslint-disable-line no-param-reassign
    }
    // Check fields are valid
    fields.forEach((f) => {
      if (!esInstance.fieldTypes[esIndex]) {
        throw new UserInputError(`es index ${esIndex} doesn't exist`);
      } else if (!esInstance.fieldTypes[esIndex][f]) {
        throw new UserInputError(`invalid field ${f} in "filter" variable`);
      }
    });
    analyzedFields = fields.map((f) => `${f}${config.analyzedTextFieldSuffix}`);
  }
  return {
    multi_match: {
      query: keyword,
      fields: analyzedFields,
    },
  };
};

/**
 * This function transfer graphql filter arg to ES filter object
 * It first parse graphql filter object recursively from top to down,
 * until reach the bottom level, it translate gql filter unit to ES filter unit.
 * And finally combines all filter units from down to top.
 * @param {string} esInstance
 * @param {string} esIndex
 * @param {object} graphqlFilterObj
 * @param {string[]} aggsField - target agg field, only need for agg queries
 * @param {boolean} filterSelf - whether we want to filter this field or not,
 *                               only need for agg queries
 * @param {object} defaultAuthFilter - once graphqlFilterObj is empty,
 *                this function transfers and returns this auth filter as default
 * @param objPath: path to object
 */
const getFilterObj = (
  esInstance,
  esIndex,
  graphqlFilterObj,
  aggsField,
  filterSelf = true, // eslint-disable-line default-param-last
  defaultAuthFilter,
  objPath = null,
) => {
  if (!graphqlFilterObj
    || typeof Object.keys(graphqlFilterObj)[0] === 'undefined') {
    if (!defaultAuthFilter) {
      return null;
    }
    return getFilterObj(esInstance, esIndex, defaultAuthFilter);
  }
  const topLevelOp = Object.keys(graphqlFilterObj)[0];
  let resultFilterObj = {};
  const topLevelOpLowerCase = topLevelOp.toLowerCase();
  if (topLevelOpLowerCase === 'and' || topLevelOpLowerCase === 'or') {
    const boolConnectOp = topLevelOpLowerCase === 'and' ? 'must' : 'should';
    const boolItemsList = [];

    const filterRange = [];
    graphqlFilterObj[topLevelOp].forEach((filterItem) => {
      const filterObj = getFilterObj(
        esInstance,
        esIndex,
        filterItem,
        aggsField,
        filterSelf,
        defaultAuthFilter,
        objPath,
      );
      if (filterObj) {
        if ('range' in filterObj) {
          filterRange.push(filterObj);
        } else {
          boolItemsList.push(filterObj);
        }
      }
    });

    if (filterRange.length === 1) {
      boolItemsList.push(filterRange[0]);
    }

    if (filterRange.length === 2) {
      boolItemsList.push(mergeRangeOperations(filterRange[0], filterRange[1]));
    }

    if (boolItemsList.length === 0) {
      resultFilterObj = null;
    } else {
      resultFilterObj = {
        bool: {
          [boolConnectOp]: boolItemsList,
        },
      };
    }
  } else if (topLevelOpLowerCase === 'search') {
    if (!('keyword' in graphqlFilterObj[topLevelOp])) { // "keyword" required
      throw new UserInputError('Invalid search filter syntax: missing \'keyword\' field');
    }
    Object.keys(graphqlFilterObj[topLevelOp]).forEach((o) => { // check filter syntax
      if (o !== 'keyword' && o !== 'fields') {
        throw new UserInputError(`Invalid search filter syntax: unrecognized field '${o}'`);
      }
    });
    const targetSearchKeyword = graphqlFilterObj[topLevelOp].keyword;
    if (targetSearchKeyword.length < config.allowedMinimumSearchLen) {
      throw new UserInputError(`Keyword too short (length < ${config.allowedMinimumSearchLen}`);
    }
    const targetSearchFields = graphqlFilterObj[topLevelOp].fields;
    resultFilterObj = getESSearchFilterFragment(
      esInstance,
      esIndex,
      targetSearchFields,
      targetSearchKeyword,
    );
  } else if (topLevelOpLowerCase === 'nested') {
    const { path } = graphqlFilterObj[topLevelOp];
    const filterOpObj = Object.keys(graphqlFilterObj[topLevelOp])
      .filter((key) => key !== 'path')
      .reduce((o, k) => ({ ...o, [k]: graphqlFilterObj[topLevelOp][k] }), {});
    if (_.findKey(filterOpObj, aggsField) && !filterSelf) {
      // if `aggsField` is in the nested filter object AND `filterSelf` flag is false,
      // should not filter the target field itself,
      // instead, only apply an auth filter if exists
      return getFilterObj(esInstance, esIndex, defaultAuthFilter);
    }

    const nestedFilter = getFilterObj(
      esInstance,
      esIndex,
      filterOpObj,
      aggsField,
      filterSelf,
      defaultAuthFilter,
      path,
    );
    if (nestedFilter != null) {
      resultFilterObj = {
        nested: {
          path,
          query: nestedFilter,
        },
      };
    } else {
      resultFilterObj = null;
    }
  } else {
    const field = Object.keys(graphqlFilterObj[topLevelOp])[0];
    if (aggsField === field && !filterSelf) {
      // if `filterSelf` flag is false, should not filter the target field itself,
      // instead, only apply an auth filter if exists
      return getFilterObj(esInstance, esIndex, defaultAuthFilter);
    }
    const value = graphqlFilterObj[topLevelOp][field];
    const numericOrTextType = getNumericTextType(esInstance, esIndex, field, objPath);
    if (numericOrTextType === NumericTextTypeTypeEnum.ES_TEXT_TYPE) {
      resultFilterObj = getFilterItemForString(topLevelOp, field, value, objPath);
    } else if (numericOrTextType === NumericTextTypeTypeEnum.ES_NUMERIC_TYPE) {
      resultFilterObj = getFilterItemForNumbers(topLevelOp, field, value, objPath);
    } else {
      throw new ApolloError(`Invalid es field type ${numericOrTextType}`, 500);
    }
  }
  return resultFilterObj;
};

export default getFilterObj;
