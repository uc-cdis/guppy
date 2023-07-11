import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import depthLimit from 'graphql-depth-limit';
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
import headerParser from './utils/headerParser';
import getAuthHelperInstance from './auth/authHelper';
import downloadRouter from './download';
import CodedError from './utils/error';
import { statusRouter, versionRouter } from './endpoints';

const app = express();
app.use(cors());
app.use(helmet());
app.use(bodyParser.json({ limit: '50mb' }));

const startServer = () => {
  // build schema and resolvers by parsing elastic search fields and types,
  const typeDefs = getSchema(config.esConfig, esInstance);
  const resolvers = getResolver(config.esConfig, esInstance);
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const schemaWithMiddleware = applyMiddleware(
    schema,
    ...middlewares,
  );
    // create graphql server instance
  const server = new ApolloServer({
    mocks: false,
    schema: schemaWithMiddleware,
    validationRules: [depthLimit(10)],
    context: async ({ req }) => {
      const jwt = headerParser.parseJWT(req);
      const authHelper = await getAuthHelperInstance(jwt);
      return {
        authHelper,
      };
    },
  });
    // bind graphql server to express app at config.path
  server.applyMiddleware({
    app,
    path: config.path,
  });

  // simple health check endpoint
  // eslint-disable-next-line no-unused-vars
  app.get('/_status', statusRouter, (req, res, err, next) => {
    if (err instanceof CodedError) {
      // deepcode ignore ServerLeak: no important information exists in error
      res.status(err.code).send(err.msg);
    } else {
      // deepcode ignore ServerLeak: no important information exists in error
      res.status(500).send(err);
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.get('/_version', versionRouter);

  // download endpoint for fetching data directly from es
  app.post(
    '/download',
    downloadRouter,
    (err, req, res, next) => { // eslint-disable-line no-unused-vars
      if (err instanceof CodedError) {
        // deepcode ignore ServerLeak: no important information exists in error
        res.status(err.code).send(err.msg);
      } else {
        // deepcode ignore ServerLeak: no important information exists in error
        res.status(500).send(err);
      }
    },
  );

  app.listen(config.port, () => {
    log.info(`[Server] guppy listening on port ${config.port}!`);
  });
};

// need to connect to ES and initialize before setting up a server
esInstance.initialize().then(() => {
  startServer();
});
