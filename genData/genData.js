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
  .option('-n, --number <number>', 'number of documents to generate', 500)
  .option('-r, --random', 'generate random number of document up to "number"', false);

program.parse(process.argv);

// console.log(program);

const esHost = `${program.hostname}:${program.port}`;
const esIndex = program.index;

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

const getRandomInt = (maxValue) => Math.floor(Math.random() * Math.floor(maxValue));

async function run() {
  const mapping = await client.indices.getMapping({ index: esIndex });

  let m = mapping.body[esIndex].mappings;

  if (program.doc_type) {
    m = m[program.doc_type];
  }

  if (m !== undefined) {
    Object.entries(m.properties).forEach(([key, value]) => {
      schema.items.properties[key] = fakerType(value);
      schema.items.required.push(key);
    });
  }

  let sample = await resolve(schema);

  const fieldValues = JSON.parse(readFileSync('./genData/valueBank.json').toString());
  Object.entries(fieldValues).forEach(([k, values]) => {
    sample = sample.map((d) => {
      const id = getRandomInt(values.length - 1);
      // eslint-disable-next-line no-param-reassign
      d[k] = fieldValues[k][id]; return d;
    });
  });

  const body = sample.flatMap((d) => [{
    index: {
      _index: esIndex,
      _type: program.doc_type || null,
    },
  }, d]);
  const chunks = chunkArray(body, 100);

  chunks.forEach((c) => {
    client.bulk({ refresh: true, body: c }).then((res) => {
      res.body.items.forEach((item) => console.log(item));
      console.log(`Successfully insert ${c.length} items`);
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
}

run().catch((error) => {
  console.log(error);
});
