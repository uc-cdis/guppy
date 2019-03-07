export const getESFieldsTypes = async (esClient, esConfig) => esClient.indices.getMapping({
  index: esConfig.index,
  type: esConfig.type,
}).then((resp) => {
  console.log('mapping: ', JSON.stringify(resp, null, 5));
  const mappingObj = resp[esConfig.index].mappings[esConfig.type].properties;
  const fieldTypes = Object.keys(mappingObj).reduce((acc, field) => {
    const esType = mappingObj[field].type;
    acc[field] = esType;
    return acc;
  }, {});
  console.log('fieldTypes', JSON.stringify(fieldTypes, null, 5));
  return fieldTypes;
}, (err) => {
  console.trace(err.message);
});

export const query = (esClient, esConfig) => async (queryBody) => {
  console.log('_query: ', JSON.stringify(queryBody, null, 4));
  return esClient.search({
    index: esConfig.index,
    type: esConfig.type,
    body: queryBody,
  }).then(resp => resp, (err) => {
    console.trace(err.message);
  });
};
