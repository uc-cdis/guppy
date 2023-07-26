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

const histogramTypePrefix = 'RegularAccess';

const getGQLType = (esInstance, esIndex, field, esFieldType) => {
  const gqlType = esgqlTypeMapping[esFieldType];
  if (!gqlType) {
    throw new Error(`Invalid type ${esFieldType} for field ${field} in index ${esIndex}`);
  }
  const isArrayField = esInstance.isArrayField(esIndex, field);
  if (isArrayField && esFieldType !== 'nested') {
    return `[${gqlType}]`;
  }
  if (esFieldType === 'nested') {
    if (isArrayField) {
      return `[${field}]`;
    }
    return `${field}`;
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
    format: Format=json,
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
      queueTypes.push({ type: `${fieldKey}`, properties });
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
        queueTypes.push({ type: `${entry.field}`, properties: entry.properties });
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

const getAggregationSchemaForOneIndex = (esInstance, esConfigElement) => {
  const esIndex = esConfigElement.index;
  const esType = esConfigElement.type;
  const includeHistogramPrefix = Object.prototype.hasOwnProperty.call(esConfigElement, 'tier_access_level') && esConfigElement.tier_access_level === 'regular';
  const esTypeObjName = firstLetterUpperCase(esType);
  const fieldGQLTypeMap = getFieldGQLTypeMapForOneIndex(esInstance, esIndex);
  const fieldAggsTypeMap = fieldGQLTypeMap.filter((f) => f.esType !== 'nested').map((entry) => ({
    field: entry.field,
    aggType: (includeHistogramPrefix ? histogramTypePrefix : '') + getAggsHistogramName(entry.type),
  }));
  const fieldAggsNestedTypeMap = fieldGQLTypeMap.filter((f) => f.esType === 'nested');
  return `type ${esTypeObjName}Aggregation {
    _totalCount: Int,
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

/**
 * This is the function for getting schemas for a single nested index.
 * Multi-level nested fields are "flattened" level by level.
 * For each level of nested field a new type in schema is created.
 */
const getAggregationSchemaForOneNestedIndex = (esInstance, esDict) => {
  const esIndex = esDict.index;
  const fieldGQLTypeMap = getFieldGQLTypeMapForOneIndex(esInstance, esIndex);
  const fieldAggsNestedTypeMap = fieldGQLTypeMap.filter((f) => f.esType === 'nested');
  const includeHistogramPrefix = Object.prototype.hasOwnProperty.call(esDict, 'tier_access_level') && esDict.tier_access_level === 'regular';
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
    ${propsKey}: ${(includeHistogramPrefix ? histogramTypePrefix : '') + getAggsHistogramName(esgqlTypeMapping[entryType])}`;
      })}
}`;
    }
  }
  log.debug('[SCHEMA] AggsNestedTypeSchema: ', AggsNestedTypeSchema);
  return AggsNestedTypeSchema;
};

export const getAggregationSchemaForEachType = (esConfig, esInstance) => esConfig.indices.map((cfg) => getAggregationSchemaForOneIndex(esInstance, cfg)).join('\n');

export const getAggregationSchemaForEachNestedType = (esConfig, esInstance) => esConfig.indices.map((cfg) => getAggregationSchemaForOneNestedIndex(esInstance, cfg)).join('\n');

const getNumberHistogramSchema = (isRegularAccess) => `
    type ${(isRegularAccess ? histogramTypePrefix : '') + EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER} {
      _totalCount: Int,
      _cardinalityCount(precision_threshold: Int = 3000): Int,
      histogram(
        rangeStart: Int,
        rangeEnd: Int,
        rangeStep: Int,
        binCount: Int,
      ): [BucketsForNestedNumberAgg],
      asTextHistogram: [BucketsForNestedStringAgg]
    }
  `;

const getTextHistogramSchema = (isRegularAccess) => `
    type ${(isRegularAccess ? histogramTypePrefix : '') + EnumAggsHistogramName.HISTOGRAM_FOR_STRING} {
      _totalCount: Int,
      _cardinalityCount(precision_threshold: Int = 3000): Int,
      histogram: [BucketsForNestedStringAgg],
      asTextHistogram: [BucketsForNestedStringAgg]
    }
  `;

export const getMappingSchema = (esConfig) => `
    type Mapping {
      ${esConfig.indices.map((cfg) => `${cfg.type} (
        searchInput: String
      ): [String]`).join('\n')}
    }
  `;

export const getHistogramSchemas = () => {
  const textHistogramSchema = getTextHistogramSchema(false);

  const regularAccessTextHistogramSchema = getTextHistogramSchema(true);

  const numberHistogramSchema = getNumberHistogramSchema(false);

  const regularAccessNumberHistogramSchema = getNumberHistogramSchema(true);

  const histogramSchemas = [textHistogramSchema, regularAccessTextHistogramSchema, numberHistogramSchema, regularAccessNumberHistogramSchema].join('\n');

  return histogramSchemas;
};

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

  const formatEnum = `
    enum Format {
      json
      tsv
      csv
    }
  `;

  const aggregationSchema = getAggregationSchema(esConfig);

  const aggregationSchemasForEachType = getAggregationSchemaForEachType(esConfig, esInstance);

  const aggregationSchemasForEachNestedType = getAggregationSchemaForEachNestedType(
    esConfig,
    esInstance,
  );

  const histogramSchemas = getHistogramSchemas();

  const textHistogramBucketSchema = `
    type BucketsForNestedStringAgg {
      key: String
      count: Int
      missingFields: [BucketsForNestedMissingFields]
      termsFields: [BucketsForNestedTermsFields]
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

  const nestedMissingFieldsBucketSchema = `
    type BucketsForNestedMissingFields {
      field: String
      count: Int
    }
  `;

  const nestedTermsFieldsBucketSchema = `
    type BucketsForNestedTermsFields {
      field: String
      count: Int
      terms: [BucketsForString]
    }
  `;

  const stringBucketSchema = `
    type BucketsForString {
      key: String
      count: Int
    }
  `;

  const mappingSchema = getMappingSchema(esConfig);

  const schemaStr = `
  scalar JSON
  ${matchedItemSchema}
  ${querySchema}
  ${accessibilityEnum}
  ${formatEnum}
  ${typesSchemas}
  ${aggregationSchema}
  ${aggregationSchemasForEachType}
  ${aggregationSchemasForEachNestedType}
  ${histogramSchemas}
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

export default buildSchemaString;
