import { GraphQLError } from 'graphql';

/**
 * Transfer graphql sort arg to ES sort object
 * e.g.: input graphql sort arg
 * [{ gender: 'asc' }, { 'visits.visit_label': 'asc' }]
 * output ES sort object
 * [
 *     {
 *      gender: {
 *         order: 'asc',
 *       },
 *     },
 *     {
 *       'visits.visit_label': {
 *         nested: {
 *           path: 'visits',
 *         },
 *         order: 'asc',
 *       },
 *     }
 * ]
 * @param {object} graphqlSort
 * @returns a ES sort object
 */
const getESSortBody = (graphqlSort, esInstance, esIndex) => {
  const sortBody = [];
  if (typeof graphqlSort !== 'undefined') {
    let graphqlSortObj = graphqlSort;
    if (typeof (graphqlSort.length) === 'undefined') {
      graphqlSortObj = Object.keys(graphqlSort).map((field) => ({ [field]: graphqlSort[field] }));
    }
    // check fields and sort methods are valid
    for (let i = 0; i < graphqlSortObj.length; i += 1) {
      if (!graphqlSortObj[i] || Object.keys(graphqlSortObj[i]).length !== 1) {
        throw new GraphQLError('Invalid sort argument', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        });
      }
      const field = Object.keys(graphqlSortObj[i])[0];
      const method = graphqlSortObj[i][field];
      if (method !== 'asc' && method !== 'desc') {
        throw new GraphQLError('Invalid sort argument', {
          extensions: {
            code: 'BAD_USER_INPUT',
          },
        });
      }
      if (!field.includes('.')) {
        // non-nested field name, normal check logic
        if (typeof esInstance.fieldTypes[esIndex][field] === 'undefined') {
          throw new GraphQLError('Invalid sort argument', {
            extensions: {
              code: 'BAD_USER_INPUT',
            },
          });
        } else {
          sortBody.push({
            [field]: {
              order: method,
            },
          });
        }
      } else {
        // nested field name, check for each parts of name
        let nestedFieldNameArray = field.split('.');
        let fieldTypesToCheck = esInstance.fieldTypes[esIndex];
        while (nestedFieldNameArray.length > 0) {
          const FieldNameToCheck = nestedFieldNameArray.shift();
          if (fieldTypesToCheck && fieldTypesToCheck[FieldNameToCheck]) {
            fieldTypesToCheck = fieldTypesToCheck[FieldNameToCheck].properties;
          } else {
            throw new GraphQLError('Invalid sort argument', {
              extensions: {
                code: 'BAD_USER_INPUT',
              },
            });
          }
        }
        // if we got here, everything looks good
        nestedFieldNameArray = field.split('.');
        const nestedPath = nestedFieldNameArray.slice(0, nestedFieldNameArray.length - 1).join('.');
        sortBody.push({
          [field]: {
            order: method,
            nested: {
              path: nestedPath,
            },
          },
        });
      }
    }
  }
  return sortBody;
};

export default getESSortBody;
