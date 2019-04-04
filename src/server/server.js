import express from 'express';
import cors from 'cors';
import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';
import bodyParser from 'body-parser';
import esInstance from './es/index';
import getResolver from './resolvers';
import getSchema from './schema';
import config from './config';
import log from './logger';
import middlewares from './middlewares';
import headerParser from './middlewares/headerParser';
import downloadRouter from './download';

const app = express();
app.use(cors());

const startServer = () => {
  const typeDefs = getSchema(config.esConfig, esInstance);
  const resolvers = getResolver(config.esConfig, esInstance);
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const schemaWithMiddleware = applyMiddleware(
    schema,
    ...middlewares,
  );
  const server = new ApolloServer({
    mocks: false,
    schema: schemaWithMiddleware,
    context: ({ req }) => ({
      jwt: headerParser.parseJWT(req),
    }),
  });

  server.applyMiddleware({
    app,
    path: config.path,
  });

  app.get('/_status', (req, res) => {
    res.send('hello guppy');
  });

  app.post('/download', bodyParser.json(), downloadRouter);

  app.listen(config.port, () => {
    log.info(`[Server] guppy listening on port ${config.port}!`);
  });
};

esInstance.initialize().then(() => {
  startServer();
});
