import rs from 'jsrsasign';
import config from '../config';
import log from '../logger';
import headerParser from './headerParser';

export const firstLetterUpperCase = (str) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * transfer '/programs/DEV/projects/test' to 'DEV-test'
 */
export const transferSlashStyleToDashStyle = (str) => {
  const reg = /^\/programs\/(.*)\/projects\/(.*)$/;
  const matchResult = str.match(reg);
  if (!matchResult) return null;
  if (matchResult.length !== 3 || matchResult[0] !== str) return null;
  const programName = matchResult[1];
  const projectName = matchResult[2];
  return `${programName}-${projectName}`;
};

export const addTwoFilters = (filter1, filter2) => {
  if (!filter1 && !filter2) return {};
  if (!filter1) return filter2;
  if (!filter2) return filter1;
  const appliedFilter = {
    AND: [
      filter1,
      filter2,
    ],
  };
  return appliedFilter;
};

export const isWhitelisted = (key) => {
  const lowerCasedWhitelist = config.encryptWhitelist.map((w) => {
    if (typeof w === 'string') {
      return w.toLowerCase();
    }
    return w;
  });
  const lowerCasedKey = (typeof key === 'string') ? key.toLowerCase() : key;
  return lowerCasedWhitelist.includes(lowerCasedKey);
};

export const loadPublicKey = () => {
  const publicKeyText = config.publicKey;

  if (!publicKeyText || publicKeyText.length === 0) {
    return null;
  }

  try {
    const publicKey = rs.KEYUTIL.getKey(publicKeyText);
    return publicKey;
  } catch (err) {
    log.error('[KEY LOAD] error when loading the public key', err);
    return null;
  }
};

export const validSignature = (req) => {
  let isValid = false;
  try {
    const signature = headerParser.parseSignature(req);

    const { publicKey } = req.app.locals;

    // --- Build SignaturePayload equivalent ---
    const method = req.method.toUpperCase();
    const path = req.path;
    const gen3Service = req.headers['gen3-service'];

    const headerStr = `Gen3-Service: ${gen3Service}`;
    const payloadStr = `${method} ${path}\n${headerStr}`;

    // --- Signature check ---
    const signature_new = new rs.KJUR.crypto.Signature({ alg: "SHA256withRSA" });
    signature_new.init(publicKey);
    signature_new.updateString(payloadStr);

    isValid = signature_new.verify(signature);
  } catch (err) {
    log.error('[SIGNATURE CHECK] error when checking the signature of the payload', err);
    return false;
  }
  log.info('The signature has been decoded: ', isValid);
  return isValid;
};


/**
 * Convert from fields of graphql query produced by graphql library to list of querying fields
 * This list will be put to _source fields of the ES query
 * @param parsedInfo: parsing information from graphql library
 * @returns: list of selected fields.
 */
export const fromFieldsToSource = (parsedInfo) => {
  let stack = Object.values(parsedInfo.fieldsByTypeName[firstLetterUpperCase(parsedInfo.name)]);
  const levels = { 0: stack.length };
  const fields = [];
  let curNodeName = '';
  let currentLevel = 0;

  while (stack.length > 0) {
    if (levels[currentLevel] === 0) {
      currentLevel -= 1;
      const lastPeriod = curNodeName.lastIndexOf('.');
      curNodeName = curNodeName.slice(0, (lastPeriod !== -1) ? lastPeriod : 0);
    } else {
      const cur = stack.pop();
      const newTypeName = cur.name;
      const fieldName = [curNodeName, newTypeName].filter((s) => s.length > 0).join('.');
      if (newTypeName in cur.fieldsByTypeName) {
        const children = Object.values(cur.fieldsByTypeName[newTypeName]);
        curNodeName = fieldName;
        levels[currentLevel] -= 1;
        currentLevel += 1;
        levels[currentLevel] = children.length;
        stack = stack.concat(children);
      } else {
        fields.push(fieldName);
        levels[currentLevel] -= 1;
      }
    }
  }
  return fields;
};

export const buildNestedField = (key, value) => {
  let builtObj = {};
  if (value.type === 'nested') {
    const nestedProps = [];
    Object.keys(value.properties).forEach((propsKey) => {
      nestedProps.push(buildNestedField(propsKey, value.properties[propsKey]));
    });
    builtObj = {
      name: key,
      type: value.type,
      nestedProps,
    };
  } else {
    builtObj = {
      name: key,
      type: value.type,
    };
  }
  return builtObj;
};

/**
 * This function takes a nested field object and parses names of each field
 * by concatenating `.` to parent and child field names recursively.
 * The returned object is a nested array, which will be deeply flattened later.
 * @param field: a nested field object (with `nestedProps`)
 */
export const processNestedFieldNames = (field) => {
  const resultArray = [];
  field.nestedProps.forEach((prop) => {
    if (prop.nestedProps) {
      const newField = { ...prop };
      newField.name = `${field.name}.${prop.name}`;
      resultArray.push(processNestedFieldNames(newField));
    } else {
      resultArray.push(`${field.name}.${prop.name}`);
    }
  });
  return resultArray;
};

export const buildNestedFieldMapping = (field, parent) => {
  if (!field.nestedProps) {
    return (parent) ? `${parent}.${field.name}` : field.name;
  }
  const newParent = (parent) ? `${parent}.${field.name}` : field.name;
  const resultArray = field.nestedProps.map((nestedFields) => buildNestedFieldMapping(
    nestedFields,
    newParent,
  ));
  return resultArray;
};

export const filterFieldMapping = (fieldArray) => (parent, args) => {
  const { searchInput } = args;
  const regEx = new RegExp(searchInput);
  log.debug('utils [filterFieldMapping] searchInput', searchInput);
  const resultArray = fieldArray.filter((field) => regEx.test(field));
  return resultArray;
};