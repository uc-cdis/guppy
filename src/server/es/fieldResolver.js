// eslint-disable-next-line import/prefer-default-export
export class FieldPathResolver {
  constructor(mapping) {
    this.mapping = mapping;
    this.nestedPathMap = null;
  }

  async initialize() {
    if (this.nestedPathMap) return;
    this.nestedPathMap = new Map();

    // Build a map of all fields to their nearest nested parent
    this.buildNestedPathMap(this.mapping, '');
  }

  buildNestedPathMap(obj, parentPath) {
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      if (value.type === 'nested') {
        // Mark this path and all children as belonging to this nested parent
        this.markNestedChildren(value.properties, currentPath, currentPath);
      } else if (value.properties) {
        this.buildNestedPathMap(value.properties, currentPath);
      }
    });
  }

  markNestedChildren(properties, parentPath, nestedRoot) {
    Object.entries(properties).forEach(([key, value]) => {
      const currentPath = `${parentPath}.${key}`;
      this.nestedPathMap.set(currentPath, nestedRoot);

      if (value.properties) {
        this.markNestedChildren(value.properties, currentPath, nestedRoot);
      }
    });
  }

  markNestedChildren(properties, parentPath, nestedRoot) {
    Object.entries(properties).forEach(([key, value]) => {
      const currentPath = `${parentPath}.${key}`;
      this.nestedPathMap.set(currentPath, nestedRoot);

      if (value.properties) {
        this.markNestedChildren(value.properties, currentPath, nestedRoot);
      }
    });
  }

  resolve(field, providedNestedPath) {
    if (providedNestedPath) {
      return {
        fieldName: `${providedNestedPath}.${field}`,
        nestedPath: providedNestedPath,
      };
    }

    const detectedPath = this.nestedPathMap.get(field);
    return {
      fieldName: field,
      nestedPath: detectedPath || null,
    };
  }
}
