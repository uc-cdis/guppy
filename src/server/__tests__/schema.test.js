// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock
import {
  getQuerySchema,
  getTypesSchemas,
  getAggregationSchema,
  getAggregationSchemaForEachType,
  getMappingSchema,
  getHistogramSchemas,
} from '../schema';
import esInstance from '../es/index';
import config from '../config';
import setupMockDataEndpoint from '../__mocks__/mockDataFromES';

jest.mock('../config');
jest.mock('../logger');

setupMockDataEndpoint();

const removeSpacesAndNewlines = (str) => str.replace(/[\n\s]/g, '');

const removeDescriptions = (str) => str.replace(/"""[^"]+"""/g, '');

const removeSpacesNewlinesAndDes = (str) => removeDescriptions(removeSpacesAndNewlines(str));

// see /src/server/__mocks__/mockDataFromES.js for mock ES mappings
describe('Schema', () => {
  const expectedQuerySchemas = `
    type Query {
      subject (
        offset: Int,
        first: Int,
        filter: JSON,
        sort: JSON,
        accessibility: Accessibility=all,
        format: Format=json,
      ): [Subject]
      file (
        offset: Int,
        first: Int,
        filter: JSON,
        sort: JSON,
        accessibility: Accessibility=all,
        format: Format=json,
      ): [File]
      _aggregation: Aggregation
      _mapping: Mapping
    }`;
  test('could create query schemas', async () => {
    const querySchema = getQuerySchema(config.esConfig);
    expect(removeSpacesNewlinesAndDes(querySchema))
      .toEqual(removeSpacesAndNewlines(expectedQuerySchemas));
  });

  const expectedTypesSchemas = `
    type Subject {
      gen3_resource_path: String,
      visits:visits,
      gender: String,
      file_count: Int,
      name: String,
      some_array_integer_field: [Int],
      some_array_string_field: [String],
      whatever_lab_result_value: Float,
      _matched:[MatchedItem]
    }
    type visits {
      days_to_visit:Int,
      visit_label:String,
      follow_ups:follow_ups,
    }
    type follow_ups {
      days_to_follow_up:Int,
      follow_up_label:String,
    }
    type File {
      gen3_resource_path: String,
      file_id: String,
      file_size: Float,
      subject_id: String,
      _matched:[MatchedItem]
    }`;
  test('could create type schemas', async () => {
    await esInstance.initialize();
    const typeSchema = getTypesSchemas(config.esConfig, esInstance);
    expect(removeSpacesNewlinesAndDes(typeSchema))
      .toEqual(removeSpacesAndNewlines(expectedTypesSchemas));
  });

  const expectedAggregationSchema = `
    type Aggregation {
      subject (
        filter: JSON,
        filterSelf: Boolean=true,
        nestedAggFields:JSON,
        accessibility: Accessibility=all
      ): SubjectAggregation
      file (
        filter: JSON,
        filterSelf: Boolean=true,
        nestedAggFields:JSON,
        accessibility: Accessibility=all
      ): FileAggregation
    }`;
  test('could create aggregation schemas', async () => {
    const aggSchema = getAggregationSchema(config.esConfig);
    expect(removeSpacesNewlinesAndDes(aggSchema))
      .toEqual(removeSpacesAndNewlines(expectedAggregationSchema));
  });

  const expectedIndividualAggsSchemas = `
    type SubjectAggregation {
      _totalCount: Int,
      gen3_resource_path: HistogramForString,
      gender: HistogramForString,
      file_count: HistogramForNumber,
      name: HistogramForString,
      some_array_integer_field: HistogramForNumber,
      some_array_string_field: HistogramForString,
      whatever_lab_result_value: HistogramForNumber,
      visits:NestedHistogramForVisits
    }
    type FileAggregation {
      _totalCount: Int,
      gen3_resource_path: HistogramForString,
      file_id: HistogramForString,
      file_size: HistogramForNumber,
      subject_id: HistogramForString,
    }`;
  test('could create aggregation schemas for each type', async () => {
    await esInstance.initialize();
    const aggSchemas = getAggregationSchemaForEachType(config.esConfig, esInstance);
    expect(removeSpacesNewlinesAndDes(aggSchemas))
      .toEqual(removeSpacesAndNewlines(expectedIndividualAggsSchemas));
  });

  const expectedMappingSchema = `
    type Mapping {
      subject(searchInput: String): [String]
      file(searchInput: String): [String]
    }`;
  test('could create mapping schema', async () => {
    const mappingSchema = getMappingSchema(config.esConfig);
    expect(removeSpacesNewlinesAndDes(mappingSchema))
      .toEqual(removeSpacesAndNewlines(expectedMappingSchema));
  });

  const expectedHistogramSchemas = `
  type HistogramForString {
    _totalCount: Int,
    _cardinalityCount(precision_threshold:Int=3000): Int,
    histogram: [BucketsForNestedStringAgg],
    asTextHistogram: [BucketsForNestedStringAgg]
  }
  type RegularAccessHistogramForString {
    _totalCount: Int,
    _cardinalityCount(precision_threshold:Int=3000): Int,
    histogram: [BucketsForNestedStringAgg],
    asTextHistogram: [BucketsForNestedStringAgg]
  }
  type HistogramForNumber {
    _totalCount: Int,
    _cardinalityCount(precision_threshold:Int=3000): Int,
    histogram(
      rangeStart: Int,
      rangeEnd: Int,
      rangeStep: Int,
      binCount: Int,
    ): [BucketsForNestedNumberAgg],
    asTextHistogram: [BucketsForNestedStringAgg]
  }
  type RegularAccessHistogramForNumber {
    _totalCount: Int,
    _cardinalityCount(precision_threshold:Int=3000): Int,
    histogram(
      rangeStart: Int,
      rangeEnd: Int,
      rangeStep: Int,
      binCount: Int,
    ): [BucketsForNestedNumberAgg],
    asTextHistogram: [BucketsForNestedStringAgg]
  }`;
  test('could create histogram schemas for each type', async () => {
    await esInstance.initialize();
    const histogramSchemas = getHistogramSchemas();
    expect(removeSpacesNewlinesAndDes(histogramSchemas))
      .toEqual(removeSpacesAndNewlines(expectedHistogramSchemas));
  });
});
