import { gql } from 'apollo-server-express';
import log from './logger';
import { firstLetterUpperCase } from './utils/utils';

const esgqlTypeMapping = {
  text: 'String',
  keyword: 'String',
  integer: 'Int',
  long: 'Float',
  short: 'Int',
  byte: 'Int',
  double: 'Float',
  float: 'Float',
  half_float: 'Float',
  scaled_float: 'Float',
  array: 'Object',
  nested: 'Object',
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
  if (esFieldType === 'nested') {
    return `[Nested${firstLetterUpperCase(field)}]`;
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

const getFieldGQLTypeMapForProperties = (esInstance, esIndex, properties) => {
  const result = Object.keys(properties).map((field) => {
    const esFieldType = (properties[field].esType)
      ? properties[field].esType : properties[field].type;
    const gqlType = getGQLType(esInstance, esIndex, field, esFieldType);

    return {
      field, type: gqlType, esType: esFieldType, properties: properties[field].properties,
    };
  });
  return result;
};

const getFieldGQLTypeMapForOneIndex = (esInstance, esIndex) => {
  const fieldESTypeMap = esInstance.getESFieldTypeMappingByIndex(esIndex);
  return getFieldGQLTypeMapForProperties(esInstance, esIndex, fieldESTypeMap);
};

const getArgsByField = (fieldType, props) => {
  const keys = Object.keys(props);
  const baseProps = [];
  keys.forEach((k) => {
    if (props[k].type !== 'nested') baseProps.push({ field: k, type: esgqlTypeMapping[props[k].type] });
  });
  return `(${baseProps.map((entry) => `${entry.field}: [${entry.type}]`).join(',')})`;
};

const getSchemaType = (fieldType) => `${fieldType.field}: ${fieldType.type}`;

const getTypeSchemaForOneIndex = (esInstance, esIndex, esType) => {
  const fieldGQLTypeMap = getFieldGQLTypeMapForOneIndex(esInstance, esIndex);
  const fieldESTypeMap = esInstance.getESFieldTypeMappingByIndex(esIndex);
  const esTypeObjName = firstLetterUpperCase(esType);
  const existingFields = new Set([]);
  const fieldToArgs = {};

  const queueTypes = [];
  Object.keys(fieldESTypeMap).forEach((fieldKey) => {
    const esFieldType = fieldESTypeMap[fieldKey].type;
    if (esFieldType === 'nested' && !existingFields.has(fieldKey)) {
      const { properties } = fieldESTypeMap[fieldKey];
      queueTypes.push({ type: `Nested${firstLetterUpperCase(fieldKey)}`, properties });
      existingFields.add(fieldKey);
    }
  });

  let sTypeSchema = `
    type ${esTypeObjName} {
      ${fieldGQLTypeMap.map((entry) => `${getSchemaType(entry)},`).join('\n')}
      _matched: [MatchedItem]
    }
  `;

  while (queueTypes.length > 0) {
    const t = queueTypes.shift();
    const gqlTypes = getFieldGQLTypeMapForProperties(esInstance, esIndex, t.properties);
    gqlTypes.forEach((entry) => {
      if (entry.esType === 'nested' && !existingFields.has(entry.field)) {
        queueTypes.push({ type: `Nested${firstLetterUpperCase(entry.field)}`, properties: entry.properties });
        existingFields.add(entry.field);
        fieldToArgs[entry.field] = getArgsByField(entry.field, entry.properties);
      }
    });
    sTypeSchema += `
      type ${t.type} {
        ${gqlTypes.map((entry) => `${getSchemaType(entry)},`).join('\n')}
      }
    `;
  }
  return sTypeSchema;
};

const getAggregationType = (entry) => {
  if (entry.aggType !== '') {
    return `${entry.field}: ${entry.aggType},`;
  }
  return '';
};

const getAggregationSchemaForOneIndex = (esInstance, esIndex, esType) => {
  const esTypeObjName = firstLetterUpperCase(esType);
  const fieldGQLTypeMap = getFieldGQLTypeMapForOneIndex(esInstance, esIndex);
  const fieldAggsTypeMap = fieldGQLTypeMap.filter((f) => f.esType !== 'nested').map((entry) => ({
    field: entry.field,
    aggType: getAggsHistogramName(entry.type),
  }));
  const fieldAggsNestedTypeMap = fieldGQLTypeMap.filter((f) => f.esType === 'nested');
  return `type ${esTypeObjName}Aggregation {
    _totalCount: Int
    ${fieldAggsTypeMap.map((entry) => `${getAggregationType(entry)}`).join('\n')}
    ${fieldAggsNestedTypeMap.map((entry) => `${entry.field}: NestedHistogramFor${firstLetterUpperCase(entry.field)}`).join('\n')}
  }`;
};

export const getQuerySchema = (esConfig) => `
    type Query {
      ${esConfig.indices.map((cfg) => getQuerySchemaForType(cfg.type)).join('\n')}
      _aggregation: Aggregation
      _mapping: Mapping
    }
  `;

export const getTypesSchemas = (esConfig, esInstance) => esConfig.indices.map((cfg) => getTypeSchemaForOneIndex(esInstance, cfg.index, cfg.type)).join('\n');

export const getAggregationSchema = (esConfig) => `
    type Aggregation {
      ${esConfig.indices.map((cfg) => `${cfg.type} (
        filter: JSON, 
        filterSelf: Boolean=true, 
        nestedAggFields: JSON,
        """Only used when it's regular level data commons, if set, returns aggregation data within given accessibility"""
        accessibility: Accessibility=all
      ): ${firstLetterUpperCase(cfg.type)}Aggregation`).join('\n')}
    }
  `;

const getAggregationSchemaForOneNestedIndex = (esInstance, esIndex) => {
  const fieldGQLTypeMap = getFieldGQLTypeMapForOneIndex(esInstance, esIndex);
  const fieldAggsNestedTypeMap = fieldGQLTypeMap.filter((f) => f.esType === 'nested');

  let AggsNestedTypeSchema = '';
  while (fieldAggsNestedTypeMap.length > 0) {
    const entry = fieldAggsNestedTypeMap.shift();
    if (entry.field && entry.properties) {
      AggsNestedTypeSchema += `type NestedHistogramFor${firstLetterUpperCase(entry.field)} {${Object.keys(entry.properties).map((propsKey) => {
        const entryType = entry.properties[propsKey].type;
        if (entryType === 'nested') {
          fieldAggsNestedTypeMap.push({
            field: propsKey,
            properties: entry.properties[propsKey].properties,
          });
          return `
      ${propsKey}: NestedHistogramFor${firstLetterUpperCase(propsKey)}`;
        }
        return `
    ${propsKey}: ${getAggsHistogramName(esgqlTypeMapping[entryType])}`;
      })}
}
`;
    }
  }
  log.debug('[SCHEMA] AggsNestedTypeSchema: ', AggsNestedTypeSchema);
  return AggsNestedTypeSchema;
};

export const getAggregationSchemaForEachType = (esConfig, esInstance) => esConfig.indices.map((cfg) => getAggregationSchemaForOneIndex(esInstance, cfg.index, cfg.type)).join('\n');

export const getAggregationSchemaForEachNestedType = (esConfig, esInstance) => esConfig.indices.map((cfg) => getAggregationSchemaForOneNestedIndex(esInstance, cfg.index)).join('\n');

export const getMappingSchema = (esConfig) => `
    type Mapping {
      ${esConfig.indices.map((cfg) => `${cfg.type}: [String]`).join('\n')}
    }
  `;

export const buildSchemaString = (esConfig, esInstance) => {
  const querySchema = getQuerySchema(esConfig);

  const matchedItemSchema = `
    type MatchedItem {
      field: String
      highlights: [String]
    }
  `;

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

  const aggregationSchemasForEachNestedType = getAggregationSchemaForEachNestedType(esConfig,
    esInstance);

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
  ${matchedItemSchema}
  ${querySchema}
  ${accessibilityEnum}
  ${typesSchemas}
  ${aggregationSchema}
  ${aggregationSchemasForEachType}
  ${aggregationSchemasForEachNestedType}
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
