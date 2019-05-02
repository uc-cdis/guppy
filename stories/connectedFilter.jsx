import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import ConnectedFilter from '../src/components/ConnectedFilter';
import './guppyWrapper.css';
import { filterConfig, guppyConfig, fieldMapping } from './conf';
import AccessibleFilter from '../src/components/ConnectedFilter/AccessibleFilter';
import UnaccessibleFilter from '../src/components/ConnectedFilter/UnaccessibleFilter';

storiesOf('ConnectedFilter', module)
  .add('Filter', () => {
    const processFilterAggsData = (aggsData) => {
      return aggsData;
    };
    return (
      <ConnectedFilter
        filterConfig={filterConfig}
        guppyConfig={guppyConfig}
        onFilterChange={action('filter change')}
        fieldMapping={fieldMapping}
        onProcessFilterAggsData={processFilterAggsData}
      />
    );
  })
  .add('Accessible Filter', () => {
    const processFilterAggsData = (aggsData) => {
      return aggsData;
    };
    return (
      <AccessibleFilter
        filterConfig={filterConfig}
        guppyConfig={guppyConfig}
        onFilterChange={action('filter change')}
        fieldMapping={fieldMapping}
        onProcessFilterAggsData={processFilterAggsData}
      />
    );
  })
  .add('Unaccessible Filter', () => {
    const processFilterAggsData = (aggsData) => {
      return aggsData;
    };
    return (
      <UnaccessibleFilter
        filterConfig={filterConfig}
        guppyConfig={guppyConfig}
        onFilterChange={action('filter change')}
        fieldMapping={fieldMapping}
        onProcessFilterAggsData={processFilterAggsData}
      />
    );
  });
