function fakerType(key, value, arrayFields) {
  let fieldType;
  const properties = {};
  const required = [];

  switch (value.type) {
    case 'boolean':
      // if a field is an array, say it explicit in the name, since ES does not know
      if (key.includes('array')) {
        fieldType = {
          type: 'array', items: { type: 'boolean', properties, required }, minItems: 0, maxItems: 10,
        };
        arrayFields.push(key);
      } else {
        fieldType = { type: 'boolean' };
      }
      break;
    case 'keyword':
    case 'text':
      if (key.includes('array')) {
        fieldType = {
          type: 'array',
          items: {
            type: 'string', faker: 'name.findName', properties, required,
          },
          minItems: 0,
          maxItems: 10,
        };
        arrayFields.push(key);
      } else {
        fieldType = { type: 'string', faker: 'name.findName' };
      }
      break;
    case 'float':
    case 'double':
      if (key.includes('array')) {
        fieldType = {
          type: 'array', items: { type: 'number', properties, required }, minItems: 0, maxItems: 10,
        };
        arrayFields.push(key);
      } else {
        fieldType = { type: 'number' };
      }
      break;
    case 'long':
    case 'integer':
      if (key.includes('array')) {
        fieldType = {
          type: 'array', items: { type: 'integer', properties, required }, minItems: 0, maxItems: 10,
        };
        arrayFields.push(key);
      } else {
        fieldType = { type: 'integer' };
      }
      break;
    case 'nested':
      Object.entries(value.properties).forEach(([k, v]) => {
        properties[k] = fakerType(k, v);
        required.push(k);
      });
      fieldType = {
        type: 'array', items: { type: 'object', properties, required }, minItems: 0, maxItems: 10,
      };
      if (key.includes('array')) {
        arrayFields.push(key);
      }
      break;
    default:
      // console.log(value);
      break;
  }
  return {
    ...fieldType,
    rawType: value.type,
  };
}

module.exports = {
  fakerType,
};
