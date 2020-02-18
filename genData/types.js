function fakerType(value) {
  let fieldType;
  const properties = {};
  const required = [];
  switch (value.type) {
    case 'boolean':
      fieldType = { type: 'boolean' };
      break;
    case 'keyword':
      fieldType = { type: 'string', faker: 'name.findName' };
      break;
    case 'text':
      fieldType = { type: 'string', faker: 'name.findName' };
      break;
    case 'double':
      fieldType = { type: 'number' };
      break;
    case 'long':
    case 'integer':
      fieldType = { type: 'integer' };
      break;
    case 'nested':
      Object.entries(value.properties).forEach(([key, v]) => {
        properties[key] = fakerType(v);
        required.push(key);
      });
      fieldType = {
        type: 'array', items: { type: 'object', properties, required }, minItems: 10, maxItems: 10,
      };
      break;
    default:
      // console.log(value);
      break;
  }
  return fieldType;
}

module.exports = {
  fakerType,
};
