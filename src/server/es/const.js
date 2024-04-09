export const AGGS_QUERY_NAME = 'numeric_aggs';
export const AGGS_NESTED_QUERY_NAME = 'numeric_nested_aggs';
export const AGGS_GLOBAL_STATS_NAME = 'numeric_aggs_stats';
export const AGGS_ITEM_STATS_NAME = 'numeric_item_aggs_stats';

export const NumericTextTypeTypeEnum = {
  ES_NUMERIC_TYPE: 1,
  ES_TEXT_TYPE: 2,
};

export const esFieldNumericTextTypeMapping = {
  keyword: NumericTextTypeTypeEnum.ES_TEXT_TYPE,
  integer: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
  long: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
  short: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
  byte: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
  double: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
  float: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
  half_float: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
  scaled_float: NumericTextTypeTypeEnum.ES_NUMERIC_TYPE,
};

export const SCROLL_PAGE_SIZE = 100;
