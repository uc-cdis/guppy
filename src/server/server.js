import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import depthLimit from 'graphql-depth-limit';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { applyMiddleware } from 'graphql-middleware';
import bodyParser from 'body-parser';
import { stitchSchemas } from '@graphql-tools/stitch';
import { RenameTypes, RenameRootFields } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
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
import { buildCustomGeneSchema } from './resolvers/topGenes';

function buildIndexSchema({ typeDefs, resolvers }) {
  return makeExecutableSchema({ typeDefs, resolvers });
}

// set the prefix for each index schema
function prefixForIndex(cfg) {
  // e.g., 'file' -> 'File', 'case_centric' -> 'CaseCentric'
  return cfg.type.replace(/(^|[_-])(\w)/g, (_, __, c) => c.toUpperCase());
}

// Create subschemas with transforms
function buildSubschema(schema, prefix) {
  const skipTypes = new Set(['Query', 'Mutation', 'Subscription', 'JSON', 'Date', 'DateTime']);

  return {
    schema,
    transforms: [
      new RenameTypes((name) => (skipTypes.has(name) ? name : `${prefix}_${name}`)),
      // Optional: namespace root fields
      new RenameRootFields((operation, name) => `${prefix}_${name}`),
    ],
  };
}

// 4) Stitch them all together
function stitchIndexSchemas(indexSchemas) {
  return stitchSchemas({
    subschemas: [
      ...indexSchemas.map(({ schema, prefix }) => buildSubschema(schema, prefix)),
      { schema: buildCustomGeneSchema(), prefix: 'Gene' },
    // Optionally define top-level glue types/unions/interfaces or shared scalars here
    ],
  });
}

let server;
const app = express();
app.use(cors());
app.use(helmet());
app.use(bodyParser.json({ limit: '50mb' }));

const startServer = async () => {
  // build schema and resolvers by parsing elastic search fields and types,
  // Build one executable schema per index and stitch them with namespacing
  const perIndex = config.esConfig.indices.map((cfg) => {
    const singleIndexConfig = { ...config.esConfig, indices: [cfg] };
    const typeDefs = getSchema(singleIndexConfig, esInstance);
    const resolvers = getResolver(singleIndexConfig, esInstance);
    const schema = buildIndexSchema({ typeDefs, resolvers });
    const prefix = prefixForIndex(cfg);
    return { schema, prefix };
  });

  const stitchedSchema = stitchIndexSchemas(perIndex);

  /// /  const typeDefs = getSchema(config.esConfig, esInstance);
  /// /  const resolvers = getResolver(config.esConfig, esInstance);
  /// const schema = makeExecutableSchema({ typeDefs, resolvers });
  const schemaWithMiddleware = applyMiddleware(stitchedSchema, ...middlewares);
  // create graphql server instance
  server = new ApolloServer({
    mocks: false,
    schema: schemaWithMiddleware,
    validationRules: [depthLimit(10)],
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const jwt = headerParser.parseJWT(req);
        const authHelper = await getAuthHelperInstance(jwt);
        return {
          authHelper,
        };
      },
      // bind graphql server to express app at config.path
      path: config.path,
    }),
  );
  log.info(`[Server] guppy listening on port ${config.port}!`);
};

const initializeAndStartServer = async () => {
  await esInstance.initialize();
  await startServer();
};

const refreshRouter = async (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (config.allowRefresh === false) {
      const disabledRefresh = new CodedError(404, '[Refresh] guppy _refresh functionality is not enabled');
      throw disabledRefresh;
    } else {
      log.debug('[Refresh] ', JSON.stringify(req.body, null, 4));
      const jwt = headerParser.parseJWT(req);
      if (!jwt) {
        const noJwtError = new CodedError(401, '[Refresh] no JWT user token provided to _refresh function');
        throw noJwtError;
      }
      const authHelper = await getAuthHelperInstance(jwt);
      if (authHelper._canRefresh === undefined || authHelper._canRefresh === false) {
        const noPermsUser = new CodedError(401, '[Refresh] User cannot refresh Guppy without a valid token that has admin_access method on guppy service for resource path /guppy_admin');
        throw noPermsUser;
      }
      await server.stop();
      await initializeAndStartServer();
    }
    res.send('[Refresh] guppy refreshed successfully');
  } catch (err) {
    log.error(err);
    next(err);
  }
  return 0;
};

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

app.get('/_version', versionRouter);

// download endpoint for fetching data directly from es
// eslint-disable-next-line no-unused-vars
app.post('/download', downloadRouter, (err, req, res, next) => {
  if (err instanceof CodedError) {
    // deepcode ignore ServerLeak: no important information exists in error
    res.status(err.code).send(err.msg);
  } else {
    // deepcode ignore ServerLeak: no important information exists in error
    res.status(500).send(err);
  }
});

// eslint-disable-next-line no-unused-vars
app.post('/_refresh', refreshRouter, (err, req, res, next) => {
  if (err instanceof CodedError) {
    res.status(err.code).send(err.msg);
  } else {
    res.status(500).send(err);
  }
});

// need to connect to ES and initialize before setting up a server
app.listen(config.port, async () => {
  await initializeAndStartServer();
});
