import express from 'express';
import cors from 'cors';
import _ from 'lodash';
import { ApolloServer, gql } from 'apollo-server-express';
import GraphQLJSON from 'graphql-type-json';
import ESConnector from './data';

const app = express();
const port = 3000;
app.use(cors());

const esConfig = {
  host: 'localhost:9200',
  index: 'gen3-dev-subject',
  type: 'subject',
};
const ESConnectorInstance = new ESConnector(esConfig);

const schema = gql`
  scalar JSON
  type Query {
    subject(
      offset: Int, 
      size: Int,
      filter: JSON,
    ): [Subject]
    aggs(
      filter: JSON
    ): Aggregates
  }

  type Subject {
    id: ID!
    project: String!
    study: String!
    gender: String
    ethnicity: String!
    race: String
    vital_status: String
    file_type: String
    file_format: String
    file_count: Int!
  }

  type Aggregates {
    subject: TotalCount
    gender: HistogramForString
    file_count: HistogramForNumber
  }

  type TotalCount {
    total: Int
  }

  type HistogramForString {
    histogram: [BucketsForString]
  }

  type HistogramForNumber {
    histogram(
      rangeStart: Int, 
      rangeEnd: Int, 
      rangeStep: Int,
      binCount: Int,
    ): [BucketsForNumber]
  }

  type BucketsForString {
    key: String
    count: Int
  }

  type BucketsForNumber {
    _range: [Float]
    min: Int
    max: Int
    avg: Float
    sum: Int
    count: Int
  }
`;

const resolvers = {
  JSON: GraphQLJSON,
  Query: {
    subject: async (parent, args, context, info) => {
      let { offset, size, filter } = args;
      console.log('input filter: ', JSON.stringify(filter, null, 4));
      const data = await ESConnectorInstance.filterData(filter, offset, size);
      return data;
    },
    aggs: async (parent, args, context, info) => {
      let { offset, size, filter } = args;
      return { 
        filter,
        offset,
        size,
      };
    },
  },
  Aggregates: {
    subject: async (parent, args, context, info) => {
      const {filter} = parent;
      const count = await ESConnectorInstance.getTotalCount(filter);
      return {
        total: count
      };
    },
    gender: (parent, args, context, info) => {
      const {filter} = parent;
      return {filter, field: 'gender'};
    },
    file_count: (parent, args, context, info) => {
      const {filter} = parent;
      return {filter, field: 'file_count'};
    },
  },
  HistogramForNumber: {
    histogram: async (parent, args, context, info) => {
      const {filter, field} = parent;
      const {rangeStart, rangeEnd, rangeStep, binCount} = args;
      const result = await ESConnectorInstance.numericAggregation({
        filter, 
        field, 
        rangeStart, 
        rangeEnd, 
        rangeStep, 
        binCount,
      });
      return result;
    },
  },
  HistogramForString: {
    histogram: async (parent, args, context, info) => {
      const {filter, field} = parent;
      const result = await ESConnectorInstance.textAggregation({
        filter, 
        field, 
      });
      return result;
    }
  }
};

const server = new ApolloServer({
  typeDefs: schema,
  resolvers,
});

server.applyMiddleware({ app, path: '/graphql' });

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`);
});
