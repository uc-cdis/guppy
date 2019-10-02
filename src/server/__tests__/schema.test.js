// eslint-disable-next-line
import nock from 'nock'; // must import this to enable mock data by nock 
import {
  getQuerySchema,
  getTypesSchemas,
  getAggregationSchema,
  getAggregationSchemaForEachType,
  getMappingSchema,
} from '../schema';
import esInstance from '../es/index';
import config from '../config';
import setupMockDataEndpoint from '../__mocks__/mockDataFromES';

jest.mock('../config');
jest.mock('../logger');

setupMockDataEndpoint();

const removeSpacesAndNewlines = str => str.replace(/[\n\s]/g, '');

const removeDescriptions = str => str.replace(/"""[^"]+"""/g, '');

const removeSpacesNewlinesAndDescriptions = str => removeDescriptions(removeSpacesAndNewlines(str));

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
      ): [Subject]
      file (
        offset: Int, 
        first: Int,
        filter: JSON,
        sort: JSON,
        accessibility: Accessibility=all,
      ): [File]
      _aggregation: Aggregation
      _mapping: Mapping
    }`;
  test('could create query schemas', async () => {
    const querySchema = getQuerySchema(config.esConfig);
    expect(removeSpacesNewlinesAndDescriptions(querySchema))
      .toEqual(removeSpacesAndNewlines(expectedQuerySchemas));
  });

  const expectedTypesSchemas = `
    type Subject {
      gen3_resource_path: String,
      gender: String,
      file_count: Int,
      name: String,
      some_array_integer_field: [Int],
      some_array_string_field: [String],
      whatever_lab_result_value: Float,
    }
    type File {
      gen3_resource_path: String,
      file_id: String,
      file_size: Float,
      subject_id: String,
    }`;
  test('could create type schemas', async () => {
    await esInstance.initialize();
    const typeSchema = getTypesSchemas(config.esConfig, esInstance);
    expect(removeSpacesNewlinesAndDescriptions(typeSchema))
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
    expect(removeSpacesNewlinesAndDescriptions(aggSchema))
      .toEqual(removeSpacesAndNewlines(expectedAggregationSchema));
  });

  const expectedIndividualAggsSchemas = `
    type SubjectAggregation {
      _totalCount: Int
      gen3_resource_path: HistogramForString,
      gender: HistogramForString,
      file_count: HistogramForNumber,
      name: HistogramForString,
      some_array_integer_field: HistogramForNumber,
      some_array_string_field: HistogramForString,
      whatever_lab_result_value: HistogramForNumber,
    }
    type FileAggregation {
      _totalCount: Int
      gen3_resource_path: HistogramForString,
      file_id: HistogramForString,
      file_size: HistogramForNumber,
      subject_id: HistogramForString,
    }`;
  test('could create aggregation schemas for each type', async () => {
    await esInstance.initialize();
    const aggSchemas = getAggregationSchemaForEachType(config.esConfig, esInstance);
    expect(removeSpacesNewlinesAndDescriptions(aggSchemas))
      .toEqual(removeSpacesAndNewlines(expectedIndividualAggsSchemas));
  });

  const expectedMappingSchema = `
    type Mapping {
      subject: [String]
      file: [String]
    }`;
  test('could create mapping schema', async () => {
    const mappingSchema = getMappingSchema(config.esConfig);
    expect(removeSpacesNewlinesAndDescriptions(mappingSchema))
      .toEqual(removeSpacesAndNewlines(expectedMappingSchema));
  });
});
