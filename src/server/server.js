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
import headerParser from './utils/headerParser';
import { loadPublicKey } from './utils/utils';
import getAuthHelperInstance from './auth/authHelper';
import downloadRouter from './download';
import CodedError from './utils/error';

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

//Load public key
app.locals.publicKey = loadPublicKey();
if (app.locals.publicKey == null) {
  log.error("[PUBLIC KEY] Failed loading public key.");
}

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
  app.get('/_status', (req, res) => {
    res.send('hello guppy');
  });

  // download endpoint for fetching data directly from es
  app.post('/download',
    downloadRouter, (err, req, res, next) => { // eslint-disable-line no-unused-vars
      if (err instanceof CodedError) {
        res.status(err.code).send(err.msg);
      } else {
        res.status(500).send(err);
      }
    });

  app.listen(config.port, () => {
    log.info(`[Server] guppy listening on port ${config.port}!`);
  });
};

// need to connect to ES and initialize before setting up a server
esInstance.initialize().then(() => {
  startServer();
});
