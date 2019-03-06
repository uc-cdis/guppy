import express from 'express';
import cors from 'cors';
import _ from 'lodash';
import { ApolloServer } from 'apollo-server-express';
import ESConnector from './data';
import getResolver from './resolvers';
import getSchema from './schema';

const app = express();
const port = 3000;
app.use(cors());

const esConfig = {
  host: 'localhost:9200',
  index: 'gen3-dev-subject',
  type: 'subject',
};

let schema, resolvers;
const esConnector = new ESConnector(esConfig, () => {
  startServer();
});

const startServer = () => {
  schema = getSchema(esConfig, esConnector);
  resolvers = getResolver(esConfig, esConnector);
  const server = new ApolloServer({
    typeDefs: schema,
    resolvers: resolvers,
  });
  
  server.applyMiddleware({ app, path: '/graphql' });
  
  app.listen(port, () => {
      console.log(`Example app listening on port ${port}!`);
  });
}

