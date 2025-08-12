/* eslint-disable no-console */
require('array.prototype.flatmap').shim();

const program = require('commander');
const { readFileSync } = require('fs');
const { resolve } = require('json-schema-faker');

const { Client } = require('@elastic/elasticsearch');
const { chunkArray } = require('./tools');
const { fakerType } = require('./types');

program
  .option('-v, --verbose', 'verbose output')
  .option('-h, --hostname <hostname>', 'elasticsearch hostname', 'http://localhost')
  .option('-p, --port <port>', 'elasticsearch port', '9200')
  .option('-i, --index <index>', 'elasticsearch index')
  .option('-d, --doc_type <doc_type>', 'document type', null)
  .option('-c, --config_index <config_index>', 'array config index')
  .option('-n, --number <number>', 'number of documents to generate', 500)
  .option('-r, --random', 'generate random number of document up to "number"', false);

program.parse(process.argv);

const esHost = `${program.hostname}:${program.port}`;
const esIndex = program.index;
const configIndex = program.config_index || 'gen3-dev-config';

const client = new Client({ node: esHost });

let min;
let max;

if (program.random) {
  min = 1;
  max = program.number;
} else {
  min = program.number;
  max = program.number;
}

const schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
    },
    required: [],
  },
  minItems: min,
  maxItems: max,
};

const arrayFields = [];

const MAX_INT = (2 ** 31) - 1;
const MIN_INT = -1 * (2 ** 31);
const MAX_LONG = (2 ** 63) - 1;
const MIN_LONG = -1 * (2 ** 63);

const getRandomNumber = (
  minValue = 0,
  maxValue = 1,
) => Math.random() * (maxValue - minValue + 1) + minValue;

const getRandomInt = (
  minValue = 0,
  maxValue = 1,
) => {
  min = Math.ceil(minValue);
  max = Math.floor(maxValue);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomString = () => (Math.random() + 1).toString(36).substring(7);

async function run() {
  const mapping = await client.indices.getMapping({ index: esIndex });

  const m = mapping.body[esIndex].mappings;
  if (m !== undefined) {
    Object.entries(m.properties).forEach(([key, value]) => {
      schema.items.properties[key] = fakerType(key, value, arrayFields);
      schema.items.required.push(key);
    });
  }

  let sample = await resolve(schema);

  const fieldValues = JSON.parse(readFileSync('./genData/valueBank.json').toString());
  sample = sample.map((d) => {
    const dCopy = { ...d };
    Object.keys(dCopy).forEach((key) => {
      if (fieldValues[key]) {
        const index = getRandomInt(0, fieldValues[key].length);
        dCopy[key] = fieldValues[key][index];
      } else {
        switch (schema.items.properties[key].rawType) {
          case 'integer':
            dCopy[key] = getRandomInt(MIN_INT, MAX_INT);
            break;
          case 'long':
            dCopy[key] = getRandomInt(MIN_LONG, MAX_LONG);
            break;
          case 'float':
            dCopy[key] = getRandomNumber(MIN_INT, MAX_INT);
            break;
          case 'text':
          case 'keyword':
            dCopy[key] = getRandomString();
            break;
          default:
            break;
        }
      }
    });
    return dCopy;
  });

  const body = sample.flatMap((d) => [{
    index: {
      _index: esIndex,
    },
  }, d]);
  const chunks = chunkArray(body, 100);

  chunks.forEach((c) => {
    client.bulk({ refresh: true, body: c }).then((res) => {
      res.body.items.forEach((item) => console.log(item));
      console.log(`Successfully inserted ${c.length / 2} items`);
    }).catch((res) => {
      if (res.body.errors) {
        const erroredDocuments = [];
        // The items array has the same order of the dataset we just indexed.
        // The presence of the `error` key indicates that the operation
        // that we did for the document has failed.
        res.body.items.forEach((action, i) => {
          const operation = Object.keys(action)[0];
          if (action[operation].error) {
            erroredDocuments.push({
              // If the status is 429 it means that you can retry the document,
              // otherwise it's very likely a mapping error, and you should
              // fix the document before to try it again.
              status: action[operation].status,
              error: action[operation].error,
              operation: res.body[i * 2],
              document: res.body[i * 2 + 1],
            });
          }
        });
        console.log(erroredDocuments);
      }
    });
  });
  const { body: count } = await client.count({ index: esIndex });
  console.log(count);

  if (configIndex) {
    const data = [
      {
        index: {
          _index: configIndex,
          _id: esIndex,
        },
      },
      {
        array: arrayFields,
      },
    ];
    client.bulk({ refresh: true, body: data }).then((res) => {
      res.body.items.forEach((item) => console.log(item));
      console.log('Successfully updated config index');
    });
  }
}

run().catch((error) => {
  console.log(error);
});
