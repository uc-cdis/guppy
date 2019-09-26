/* eslint-disable global-require,import/no-dynamic-require */
// Tests for Utils/filters.js

import {
  mergeFilters
} from '../Utils/filters';

console.log('\n\n\ninside filters.test.js\n\n\n');

describe('filters', () => {
  const filterA = { project_id: { selectedValues : ['jenkins-jnkns'] } };
  const filterB = { data_format: { selectedValues : ['VCF'] } };

  const filterABExpected = { 
  	project_id: { selectedValues : ['jenkins-jnkns'] },
  	data_format: { selectedValues : ['VCF'] }
  }

  test('merge filters', async () => {
    const filterAB = mergeFilters(config.esConfig);
    expect(removeSpacesNewlinesAndDescriptions(querySchema))
      .toEqual(filterABExpected);
  });
});