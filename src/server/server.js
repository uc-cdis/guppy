import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import esInstance from './es/index';
import getResolver from './resolvers';
import getSchema from './schema';
import config from './config';

const app = express();
app.use(cors());

const startServer = () => {
  const schema = getSchema(config.esConfig, esInstance);
  const resolvers = getResolver(config.esConfig, esInstance);
  const server = new ApolloServer({
    typeDefs: schema,
    resolvers,
  });

  server.applyMiddleware({ app, path: config.path });
  
  app.get('/_status', (req, res) => {
    res.send('hello guppy');
  });

  app.listen(config.port, () => {
    console.log(`Example app listening on port ${config.port}!`);
  });
};

esInstance.initialize().then(() => {
  startServer();
});
