/**
 * Elasticsearch Field Path Indexer and Query Builder
 * Indexes all fields with their nesting properties and builds queries/aggs
 */

// eslint-disable-next-line import/prefer-default-export
export class ElasticsearchFieldIndexer {
  constructor(mapping) {
    this.fieldIndex = null;
    this.buildFieldIndex(mapping);
  }

  /**
   * Build a comprehensive field index with nesting information
   */
  buildFieldIndex(mapping) {
    const index = new Map();
    const nestedPaths = new Set();

    /**
     * Traverse mapping and index all fields
     */
    const traverse = (properties, currentPath = '', ancestorNested = []) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const [fieldName, fieldDef] of Object.entries(properties)) {
        const fieldPath = currentPath ? `${currentPath}.${fieldName}` : fieldName;

        // Determine if this field is nested
        const isNested = fieldDef.type === 'nested';

        // Track nested ancestors for this field
        const nestedAncestors = isNested
          ? [...ancestorNested, fieldPath]
          : ancestorNested;

        // Determine field classification
        let classification;
        if (isNested) {
          classification = 'nested';
          nestedPaths.add(fieldPath);
        } else if (ancestorNested.length > 0) {
          classification = 'within_nested';
        } else if (fieldDef.properties) {
          classification = 'object';
        } else {
          classification = 'leaf';
        }

        // Index this field
        index.set(fieldPath, {
          path: fieldPath,
          type: fieldDef.type || 'object',
          classification,
          isNested,
          hasProperties: !!fieldDef.properties,
          nearestNestedParent: ancestorNested[ancestorNested.length - 1] || null,
          allNestedAncestors: [...ancestorNested],
          depth: fieldPath.split('.').length,
          properties: fieldDef.properties || null,
          // Include raw field definition for reference
          fieldDef,
        });

        // Recursively process nested properties
        if (fieldDef.properties) {
          traverse(fieldDef.properties, fieldPath, nestedAncestors);
        }
      }
    };

    if (mapping) {
      traverse(mapping);
    }

    this.fieldIndex = index;
    this.nestedPaths = nestedPaths;

    return index;
  }

  /**
   * Get field information from index
   */
  getFieldInfo(fieldPath) {
    if (!this.fieldIndex) {
      throw new Error('Field index not built. Call buildFieldIndex() first.');
    }

    const info = this.fieldIndex.get(fieldPath);
    if (!info) {
      throw new Error(`Field path not found: ${fieldPath}`);
    }

    return info;
  }

  /**
   * Get all fields matching a pattern
   */
  findFields(pattern) {
    if (!this.fieldIndex) {
      throw new Error('Field index not built. Call buildFieldIndex() first.');
    }

    const regex = new RegExp(pattern);
    const matches = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const [path, info] of this.fieldIndex.entries()) {
      if (regex.test(path)) {
        matches.push(info);
      }
    }

    return matches;
  }

  /**
   * Get all leaf fields (actual queryable fields)
   */
  getLeafFields() {
    if (!this.fieldIndex) {
      throw new Error('Field index not built. Call buildFieldIndex() first.');
    }

    return Array.from(this.fieldIndex.values()).filter(
      (field) => field.classification === 'leaf' || field.classification === 'within_nested',
    );
  }

  /**
   * Build query for a field path
   */
  buildQuery(fieldPath, queryDsl) {
    const fieldInfo = this.getFieldInfo(fieldPath);

    // If field is not within a nested structure, return query as-is
    if (!fieldInfo.nearestNestedParent) {
      return queryDsl;
    }

    // Wrap in nested query
    return {
      nested: {
        path: fieldInfo.nearestNestedParent,
        query: queryDsl,
      },
    };
  }

  /**
   * Build aggregation for a field path
   */
  buildAggregation(fieldPath, aggName, aggType = 'terms', aggOptions = {}) {
    const fieldInfo = this.getFieldInfo(fieldPath);

    const baseAgg = {
      [aggType]: {
        field: fieldPath,
        ...aggOptions,
      },
    };

    // Non-nested field - simple aggregation
    if (!fieldInfo.nearestNestedParent) {
      return {
        [aggName]: baseAgg,
      };
    }

    // Nested field - wrap with nested and reverse_nested
    return {
      [aggName]: {
        nested: {
          path: fieldInfo.nearestNestedParent,
        },
        aggs: {
          [`${aggName}_inner`]: {
            ...baseAgg,
            aggs: {
              [`${aggName}_reverse`]: {
                reverse_nested: {},
                aggs: {
                  parent_count: {
                    value_count: {
                      field: '_index',
                    },
                  },
                },

              },
            },
          },
        },
      },
    };
  }

  /**
   * Build multiple aggregations from field paths
   */
  buildAggregations(fields) {
    const aggs = {};

    fields.forEach((field) => {
      let fieldPath; let aggName; let aggType; let
        aggOptions;

      if (typeof field === 'string') {
        fieldPath = field;
        aggName = field.replace(/\./g, '_');
        aggType = 'terms';
        aggOptions = {};
      } else {
        fieldPath = field.path;
        aggName = field.name || field.path.replace(/\./g, '_');
        aggType = field.type || 'terms';
        aggOptions = field.options || {};
      }

      Object.assign(aggs, this.buildAggregation(fieldPath, aggName, aggType, aggOptions));
    });

    return aggs;
  }

  /**
   * Print field index summary
   */
  printFieldIndex() {
    if (!this.fieldIndex) {
      console.log('Field index not built yet.');
      return;
    }

    console.log('\n========== FIELD INDEX SUMMARY ==========\n');
    console.log(`Total fields: ${this.fieldIndex.size}`);
    console.log(`Nested paths: ${this.nestedPaths.size}`);

    const byClassification = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const field of this.fieldIndex.values()) {
      byClassification[field.classification] = (byClassification[field.classification] || 0) + 1;
    }

    console.log('\nBy classification:');
    Object.entries(byClassification).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\n========== ALL FIELDS ==========\n');
    // eslint-disable-next-line no-restricted-syntax
    for (const [path, info] of this.fieldIndex.entries()) {
      const nestedInfo = info.nearestNestedParent
        ? ` [nested: ${info.nearestNestedParent}]`
        : '';
      console.log(`${path} (${info.classification}${nestedInfo})`);
    }
  }

  /**
   * Get field index as JSON
   */
  getFieldIndexAsJSON() {
    if (!this.fieldIndex) {
      return null;
    }

    const fields = {};
    // eslint-disable-next-line no-restricted-syntax
    for (const [path, info] of this.fieldIndex.entries()) {
      fields[path] = {
        type: info.type,
        classification: info.classification,
        nearestNestedParent: info.nearestNestedParent,
        allNestedAncestors: info.allNestedAncestors,
        depth: info.depth,
      };
    }

    return {
      totalFields: this.fieldIndex.size,
      nestedPaths: Array.from(this.nestedPaths),
      fields,
    };
  }
}
