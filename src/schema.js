import { gql } from 'apollo-server-express';

const firstLetterUpperCase = str => str.charAt(0).toUpperCase() + str.slice(1);

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
};

const EnumAggsHistogramName = {
  HISTOGRAM_FOR_STRING: 'HistogramForString',
  HISTOGRAM_FOR_NUMBER: 'HistogramForNumber',
};
const gqlTypeToAggsHistogramName = {
  String: EnumAggsHistogramName.HISTOGRAM_FOR_STRING,
  Int: EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER,
  Float: EnumAggsHistogramName.HISTOGRAM_FOR_NUMBER,
};
const getAggsHistogramName = (gqlType) => {
  if (!gqlTypeToAggsHistogramName[gqlType]) {
    throw new Error(`Invalid elasticsearch type ${gqlType}`);
  }
  return gqlTypeToAggsHistogramName[gqlType];
};

const getSchema = (esConfig, esInstance) => {
  const esType = esConfig.type;
  const esTypeObjName = firstLetterUpperCase(esConfig.type);
  const querySchema = `
    type Query {
      ${esType} (
      offset: Int, 
      size: Int,
      filter: JSON,
      sort: JSON,
      ): [${esTypeObjName}]
      aggs(
      filter: JSON
      ): Aggregates
    }
  `;

  const fieldESTypeMap = esInstance.getESFieldTypeMapping();
  const fieldGQLTypeMap = Object.keys(fieldESTypeMap).map((field) => {
    const esFieldType = fieldESTypeMap[field];
    const gqlType = esgqlTypeMapping[esFieldType];
    return { field, type: gqlType };
  });
  console.log('fieldGQLTypeMap', JSON.stringify(fieldGQLTypeMap, null, 4));
  const typeSchema = `
    type ${esTypeObjName} {
      ${fieldGQLTypeMap.map(entry => `${entry.field}: ${entry.type},`).join('\n')}
    }
  `;

  const fieldAggsTypeMap = fieldGQLTypeMap.map(entry => ({
    field: entry.field,
    aggType: getAggsHistogramName(entry.type),
  }));
  const aggregationSchema = `
    type Aggregates {
      ${esType}: TotalCount
      ${fieldAggsTypeMap.map(entry => `${entry.field}: ${entry.aggType},`).join('\n')}
    }
  `;

  const totalCountSchema = `
    type TotalCount {
      total: Int
    }
  `;

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
      _range: [Float]
      min: Int
      max: Int
      avg: Float
      sum: Int
      count: Int
    }
  `;

  const finalSchema = gql`
    scalar JSON
    ${querySchema}
    ${typeSchema}
    ${aggregationSchema}
    ${totalCountSchema}
    ${textHistogramSchema}
    ${numberHistogramSchema}
    ${textHistogramBucketSchema}
    ${numberHistogramBucketSchema}
  `;
  return finalSchema;
};

export default getSchema;
