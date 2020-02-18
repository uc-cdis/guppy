import { UserInputError } from 'apollo-server';

/**
 * Transfer graphql sort arg to ES sort object
 * @param {object} graphqlSort
 */
const getESSortBody = (graphqlSort, esInstance, esIndex) => {
  let sortBody;
  if (typeof graphqlSort !== 'undefined') {
    let graphqlSortObj = graphqlSort;
    if (typeof (graphqlSort.length) === 'undefined') {
      graphqlSortObj = Object.keys(graphqlSort).map((field) => ({ [field]: graphqlSort[field] }));
    }
    // check fields and sort methods are valid
    for (let i = 0; i < graphqlSortObj.length; i += 1) {
      if (!graphqlSortObj[i] || Object.keys(graphqlSortObj[i]).length !== 1) {
        throw new UserInputError('Invalid sort argument');
      }
      const field = Object.keys(graphqlSortObj[i])[0];
      if (typeof esInstance.fieldTypes[esIndex][field] === 'undefined') {
        throw new UserInputError('Invalid sort argument');
      }
      const method = graphqlSortObj[i][field];
      if (method !== 'asc' && method !== 'desc') {
        throw new UserInputError('Invalid sort argument');
      }
    }
    sortBody = graphqlSortObj;
  }
  return sortBody;
};

export default getESSortBody;
