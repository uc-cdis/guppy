import { gql } from 'apollo-server-express';
import log from './logger';
import { firstLetterUpperCase } from './utils/utils';

const esgqlTypeMapping = {
  text: 'String',
  keyword: 'String',
  integer: 'Int',
  long: 'Int',
  short: 'Int',
  byte: 'Int',
  double: 'Float',
  float: 'Float',
  half_float: 'Float',
  scaled_float: 'Float',
  array: 'Object',
};
const getGQLType = (esInstance, esIndex, field, esFieldType) => {
  const gqlType = esgqlTypeMapping[esFieldType];
  if (!gqlType) {
    throw new Error(`Invalid type ${esFieldType} for field ${field} in index ${esIndex}`);
  }
  const isArrayField = esInstance.isArrayField(esIndex, field);
  if (isArrayField) {
    return `[${gqlType}]`;
  }
  return gqlType;
};

const EnumAggsHistogramName = {
  HISTOGRAM_FOR_STRING: 'HistogramForString',
  HISTOGRAM_FOR_NUMBER: 'HistogramForNumber',
};
const gqlTypeToAggsHistogramName = {
  String: EnumAggsHistogramName.HISTOGRAM_FOR_STRING,
  Int: EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER,
  Float: EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER,
  '[String]': EnumAggsHistogramName.HISTOGRAM_FOR_STRING,
  '[Int]': EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER,
  '[Float]': EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER,
};

const getAggsHistogramName = (gqlType) => {
  if (!gqlTypeToAggsHistogramName[gqlType]) {
    throw new Error(`Invalid elasticsearch type ${gqlType}`);
  }
  return gqlTypeToAggsHistogramName[gqlType];
};

const getQuerySchemaForType = (esType) => {
  const esTypeObjName = firstLetterUpperCase(esType);
  return `${esType} (
    offset: Int, 
    first: Int,
    filter: JSON,
    sort: JSON,
    ): [${esTypeObjName}]`;
};

const getFieldGQLTypeMapForOneIndex = (esInstance, esIndex) => {
  const fieldESTypeMap = esInstance.getESFieldTypeMappingByIndex(esIndex);
  const fieldGQLTypeMap = Object.keys(fieldESTypeMap).map((field) => {
    const esFieldType = fieldESTypeMap[field];
    const gqlType = getGQLType(esInstance, esIndex, field, esFieldType);
    return { field, type: gqlType };
  });
  return fieldGQLTypeMap;
};

const getTypeSchemaForOneIndex = (esInstance, esIndex, esType) => {
  const fieldGQLTypeMap = getFieldGQLTypeMapForOneIndex(esInstance, esIndex);
  const esTypeObjName = firstLetterUpperCase(esType);
  const typeSchema = `
    type ${esTypeObjName} {
      ${fieldGQLTypeMap.map(entry => `${entry.field}: ${entry.type},`).join('\n')}
    }
  `;
  return typeSchema;
};

const getAggregationSchemaForOneIndex = (esInstance, esIndex, esType) => {
  const esTypeObjName = firstLetterUpperCase(esType);
  const fieldGQLTypeMap = getFieldGQLTypeMapForOneIndex(esInstance, esIndex);
  const fieldAggsTypeMap = fieldGQLTypeMap.map(entry => ({
    field: entry.field,
    aggType: getAggsHistogramName(entry.type),
  }));
  const aggsSchema = `type ${esTypeObjName}Aggregation {
    _totalCount: Int
    ${fieldAggsTypeMap.map(entry => `${entry.field}: ${entry.aggType},`).join('\n')}
  }`;
  return aggsSchema;
};

const getSchema = (esConfig, esInstance) => {
  const querySchema = `
    type Query {
      ${esConfig.indices.map(cfg => getQuerySchemaForType(cfg.type)).join('\n')}
      _aggregation: Aggregation
    }
  `;

  const typesSchemas = esConfig.indices.map(cfg => getTypeSchemaForOneIndex(esInstance, cfg.index, cfg.type)).join('\n');

  const aggregationSchema = `
    type Aggregation {
      ${esConfig.indices.map(cfg => `${cfg.type} (filter: JSON, filterSelf: Boolean=true): ${firstLetterUpperCase(cfg.type)}Aggregation`).join('\n')}
    }
  `;

  const aggregationSchemasForEachType = esConfig.indices.map(cfg => getAggregationSchemaForOneIndex(esInstance, cfg.index, cfg.type)).join('\n');

  const textHistogramSchema = `
    type ${EnumAggsHistogramName.HISTOGRAM_FOR_STRING} {
      histogram: [BucketsForString]
    }
  `;

  const textHistogramBucketSchema = `
    type BucketsForString {
      key: String
      count: Int
    }
  `;

  const numberHistogramSchema = `
    type ${EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER} {
      histogram(
        rangeStart: Int, 
        rangeEnd: Int, 
        rangeStep: Int,
        binCount: Int,
      ): [BucketsForNumber]
    }
  `;

  const numberHistogramBucketSchema = `
    type BucketsForNumber {
      """Lower and higher bounds for this bucket"""
      key: [Float]
      min: Float
      max: Float
      avg: Float
      sum: Float
      count: Int
    }
  `;

  const schemaStr = `
  scalar JSON
  ${querySchema}
  ${typesSchemas}
  ${aggregationSchema}
  ${aggregationSchemasForEachType}
  ${textHistogramSchema}
  ${numberHistogramSchema}
  ${textHistogramBucketSchema}
  ${numberHistogramBucketSchema}
`;
  log.info('[schema] graphql schema generated.');
  log.debug('[schema] graphql schema', schemaStr);

  const finalSchema = gql`${schemaStr}`;
  return finalSchema;
};

export default getSchema;
