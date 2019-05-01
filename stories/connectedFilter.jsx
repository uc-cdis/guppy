import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import ConnectedFilter from '../src/components/ConnectedFilter';
import './guppyWrapper.css';
import { filterConfig, guppyConfig, fieldMapping } from './conf';

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
  });
