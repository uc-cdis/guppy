import express from 'express';
import cors from 'cors';
import _ from 'lodash';
import { ApolloServer } from 'apollo-server-express';
import ESConnector from './data';
import getResolver from './resolvers';
import getSchema from './schema';
import config from './config';

const app = express();
app.use(cors());

let schema, resolvers;
const esConnector = new ESConnector(config.esConfig, () => {
  startServer();
});

const startServer = () => {
  schema = getSchema(config.esConfig, esConnector);
  resolvers = getResolver(config.esConfig, esConnector);
  const server = new ApolloServer({
    typeDefs: schema,
    resolvers: resolvers,
  });
  
  server.applyMiddleware({ app, path: config.path });
  app.listen(config.port, () => {
      console.log(`Example app listening on port ${config.port}!`);
  })
}

