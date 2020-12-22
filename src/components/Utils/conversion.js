const papaparse = require('papaparse');
const flatten = require('flat');

/**
   * This function converts JSON to specified format, JSON by default.
   * @param {JSON} json
   * @param {string} format
   */
export const jsonToFormat = (json, format) => { // eslint-disable-line import/prefer-default-export
  const flattenedJson = flatten(json);
  if (format === 'TSV') {
    const config = { delimiter: '\t' };
    return papaparse.unparse(flattenedJson, config);
  }
  if (format === 'CSV') {
    const config = { delimiter: ',' };
    return papaparse.unparse(flattenedJson, config);
  }
  return json;
};
