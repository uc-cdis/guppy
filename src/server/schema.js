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
    accessibility: Accessibility=all,
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

export const getQuerySchema = esConfig => `
    type Query {
      ${esConfig.indices.map(cfg => getQuerySchemaForType(cfg.type)).join('\n')}
      _aggregation: Aggregation
      _mapping: Mapping
    }
  `;

export const getTypesSchemas = (esConfig, esInstance) => esConfig.indices.map(cfg => getTypeSchemaForOneIndex(esInstance, cfg.index, cfg.type)).join('\n');

export const getAggregationSchema = esConfig => `
    type Aggregation {
      ${esConfig.indices.map(cfg => `${cfg.type} (
        filter: JSON, 
        filterSelf: Boolean=true, 
        nestedAggFields: JSON,
        """Only used when it's regular level data commons, if set, returns aggregation data within given accessibility"""
        accessibility: Accessibility=all
      ): ${firstLetterUpperCase(cfg.type)}Aggregation`).join('\n')}
    }
  `;

export const getAggregationSchemaForEachType = (esConfig, esInstance) => esConfig.indices.map(cfg => getAggregationSchemaForOneIndex(esInstance, cfg.index, cfg.type)).join('\n');

export const getMappingSchema = esConfig => `
    type Mapping {
      ${esConfig.indices.map(cfg => `${cfg.type}: [String]`).join('\n')}
    }
  `;

export const buildSchemaString = (esConfig, esInstance) => {
  const querySchema = getQuerySchema(esConfig);

  const typesSchemas = getTypesSchemas(esConfig, esInstance);

  const accessibilityEnum = `
    enum Accessibility {
      all
      accessible
      unaccessible
    }
  `;

  const aggregationSchema = getAggregationSchema(esConfig);

  const aggregationSchemasForEachType = getAggregationSchemaForEachType(esConfig, esInstance);

  const textHistogramSchema = `
    type ${EnumAggsHistogramName.HISTOGRAM_FOR_STRING} {
      histogram: [BucketsForNestedStringAgg]
    }
  `;

  const textHistogramBucketSchema = `
    type BucketsForNestedStringAgg {
      key: String
      count: Int
      missingFields: [BucketsForNestedMissingFields]
      termsFields: [BucketsForNestedTermsFields]
    }
  `;

  const nestedMissingFieldsBucketSchema = `
    type BucketsForNestedMissingFields {
      field: String
      count: Int
    }
  `;

  const nestedTermsFieldsBucketSchema = `
    type BucketsForNestedTermsFields {
      field: String
      terms: [BucketsForString]
    }
  `;

  const stringBucketSchema = `
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
      ): [BucketsForNestedNumberAgg],
      asTextHistogram: [BucketsForNestedStringAgg]
    }
  `;

  const numberHistogramBucketSchema = `
    type BucketsForNestedNumberAgg {
      """Lower and higher bounds for this bucket"""
      key: [Float]
      min: Float
      max: Float
      avg: Float
      sum: Float
      count: Int
      missingFields: [BucketsForNestedMissingFields]
      termsFields: [BucketsForNestedTermsFields]
    }
  `;

  const mappingSchema = getMappingSchema(esConfig);

  const schemaStr = `
  scalar JSON
  ${querySchema}
  ${accessibilityEnum}
  ${typesSchemas}
  ${aggregationSchema}
  ${aggregationSchemasForEachType}
  ${textHistogramSchema}
  ${numberHistogramSchema}
  ${textHistogramBucketSchema}
  ${nestedMissingFieldsBucketSchema}
  ${nestedTermsFieldsBucketSchema}
  ${stringBucketSchema}
  ${numberHistogramBucketSchema}
  ${mappingSchema}
`;
  log.info('[schema] graphql schema generated.');
  log.info('[schema] graphql schema', schemaStr);
  return schemaStr;
};

const getSchema = (esConfig, esInstance) => {
  const schemaStr = buildSchemaString(esConfig, esInstance);
  const finalSchema = gql`${schemaStr}`;
  return finalSchema;
};

export default getSchema;
