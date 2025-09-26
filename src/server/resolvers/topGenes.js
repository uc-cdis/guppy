import { makeExecutableSchema } from '@graphql-tools/schema';
import esInstance from '../es/index';

import { geneTypes } from './types';

const typeDefs = `
  ${geneTypes}

  type Query {
    topGene(first: Int = 20, offset: Int = 0): [TopGeneItem!]!
  }
`;

// Utility: pick fields to return for Gene nodes
const geneFields = ['gene_id', 'gene_symbol', 'gene_name']; // adjust for your index mapping

// Helper to fetch top N genes (by a score, count, or other criteria)
async function fetchTopGenes({ first, offset, filter, accessibility }, context) {
  const cfg = esInstance.getESIndexConfigByType('gene');
  const esIndex = cfg.index;

  const { authHelper } = context || {};
  const defaultAuthFilter = authHelper && typeof authHelper.getDefaultFilter === 'function'
    ? await authHelper.getDefaultFilter('all')
    : undefined;

  const res = await esInstance.filterData(
    { esIndex, esType: 'gene' },
    {
      filter: defaultAuthFilter,
      fields: geneFields,
      //sort: [{ _score: 'desc' }], // adjust if you have a better metric
      offset: offset || 0,
      size: first || 20,
    },
  );

  return res.hits.hits.map((h) => ({
    gene_id: h._source.gene_id,
    gene_symbol: h._source.gene_symbol,
    gene_name: h._source.gene_name,
  }));
}

const resolvers = {
  Query: {
    topGene: async (_, { limit }, context) => fetchTopGenes({ limit }, context),
  },
};

export function buildCustomGeneSchema() {
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
}
