import crypto from 'crypto';

// ---------- Mapping walkers (no network) ----------
function descend(node, segment) {
  const props = node.properties || {};
  if (segment in props) {
    return props[segment];
  }
  const fields = node.fields || {};
  if (segment in fields) {
    return fields[segment];
  }
  throw new Error(
    `Path segment '${segment}' not found at node. `
    + `Available properties=[${Object.keys(props).join(', ')}], fields=[${Object.keys(fields).join(', ')}]`,
  );
}

function analyzeFromProps(rootProps, fieldPath) {
  const parts = fieldPath.split('.');
  let cur = { properties: rootProps };
  const nestedPaths = [];
  const curPath = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const seg of parts) {
    cur = descend(cur, seg);
    curPath.push(seg);
    if (cur.type === 'nested') {
      nestedPaths.push(curPath.join('.'));
    }
  }

  return {
    fieldPath,
    nestedPaths,
    leafType: cur.type,
  };
}

// ---------- ES fetch helpers ----------
// eslint-disable-next-line no-unused-vars
async function getRootProps(es, index) {
  const response = await es.indices.getMapping({ index });
  const idx = Object.keys(response.body)[0];
  return response.body[idx].mappings.properties || {};
}

function fieldCaps(es, index, field) {
  const response = es.fieldCaps({ index, fields: field });
  return (response.body.fields && response.body.fields[field]) || {};
}

function stableMappingHash(mappings) {
  const json = JSON.stringify(mappings, Object.keys(mappings).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

// ---------- Registry ----------
export class NestingRegistry {
  constructor(index) {
    this.index = index;
    this.rootProps = null;
    this.mappingHash = null;
    this.byField = new Map();
  }

  static async build(es, index, fields, options = {}) {
    const { includeCaps = true } = options;
    const reg = new NestingRegistry(index);
    await reg._refreshFromEs(es);
    await reg._prime(es, fields, includeCaps);
    return reg;
  }

  async _refreshFromEs(es) {
    const response = await es.indices.getMapping({ index: this.index });
    const idx = Object.keys(response.body)[0];
    this.rootProps = response.body[idx].mappings.properties || {};
    this.mappingHash = stableMappingHash(response.body[idx].mappings);
  }

  async _prime(es, fields, includeCaps) {
    if (!this.rootProps) {
      throw new Error('rootProps not initialized');
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const f of fields) {
      let info = analyzeFromProps(this.rootProps, f);

      if (includeCaps) {
        const caps = fieldCaps(es, this.index, f);
        const searchable = Object.keys(caps).length > 0
          ? Object.values(caps).some((v) => v.searchable === true)
          : null;
        const aggregatable = Object.keys(caps).length > 0
          ? Object.values(caps).some((v) => v.aggregatable === true)
          : null;

        info = {
          ...info,
          searchable,
          aggregatable,
        };
      }

      this.byField.set(f, info);
    }
  }

  async refreshIfMappingChanged(es) {
    const response = await es.indices.getMapping({ index: this.index });
    const idx = Object.keys(response.body)[0];
    const newHash = stableMappingHash(response.body[idx].mappings);

    if (newHash !== this.mappingHash) {
      this.rootProps = response.body[idx].mappings.properties || {};
      this.mappingHash = newHash;
      this.byField.clear();
      return true;
    }

    return false;
  }

  get(field) {
    return this.byField.get(field);
  }

  async ensure(es, field, options = {}) {
    const { includeCaps = true } = options;

    const existing = this.byField.get(field);
    if (existing) {
      return existing;
    }

    if (!this.rootProps) {
      throw new Error('rootProps not initialized');
    }

    let info = analyzeFromProps(this.rootProps, field);

    if (includeCaps) {
      const caps = await fieldCaps(es, this.index, field);
      const searchable = Object.keys(caps).length > 0
        ? Object.values(caps).some((v) => v.searchable === true)
        : null;
      const aggregatable = Object.keys(caps).length > 0
        ? Object.values(caps).some((v) => v.aggregatable === true)
        : null;

      info = {
        ...info,
        searchable,
        aggregatable,
      };
    }

    this.byField.set(field, info);
    return info;
  }

  // ---------- Query helpers using the cache ----------
  static _leaf(kind, field, value = null, rangeOps = {}) {
    switch (kind) {
      case 'term':
        return { term: { [field]: value } };
      case 'terms':
        return { terms: { [field]: Array.isArray(value) ? value : [value] } };
      case 'range': {
        const validOps = ['gt', 'gte', 'lt', 'lte'];
        const rops = {};
        // eslint-disable-next-line no-restricted-syntax
        for (const key of validOps) {
          if (key in rangeOps) {
            rops[key] = rangeOps[key];
          }
        }
        if (Object.keys(rops).length === 0) {
          throw new Error('range requires one of gt/gte/lt/lte');
        }
        return { range: { [field]: rops } };
      }
      case 'exists':
        return { exists: { field } };
      case 'neq':
        return { bool: { must_not: [{ term: { [field]: value } }] } };
      default:
        throw new Error(`Unsupported kind ${kind}`);
    }
  }

  static _wrap(inner, nestedPaths) {
    let wrapped = inner;
    for (let i = nestedPaths.length - 1; i >= 0; i -= 1) {
      wrapped = { nested: { path: nestedPaths[i], query: wrapped } };
    }
    return wrapped;
  }

  clause(field, kind, value = null, options = {}) {
    const { requireExistsForNeq = false, ...rangeOps } = options;
    const info = this.get(field);

    if (!info) {
      throw new Error(`Field '${field}' not found in registry`);
    }

    let inner = NestingRegistry._leaf(kind, field, value, rangeOps);

    if (kind === 'neq' && requireExistsForNeq) {
      inner = {
        bool: {
          must: [{ exists: { field } }],
          must_not: inner.bool.must_not,
        },
      };
    }

    return NestingRegistry._wrap(inner, info.nestedPaths);
  }

  termsAgg(field, options = {}) {
    const { aggName = 'by_field', size = 10, order = null } = options;
    const info = this.get(field);

    if (!info) {
      throw new Error(`Field '${field}' not found in registry`);
    }

    const body = { size: 0, aggs: {} };
    let cursor = body.aggs;

    for (let i = 0; i < info.nestedPaths.length; i += 1) {
      const bucket = `nested_${i}`;
      cursor[bucket] = { nested: { path: info.nestedPaths[i] }, aggs: {} };
      cursor = cursor[bucket].aggs;
    }

    cursor[aggName] = { terms: { field, size } };
    if (order) {
      cursor[aggName].terms.order = order;
    }

    return body;
  }
}

export default NestingRegistry;
