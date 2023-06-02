import React from 'react';
import { action } from '@storybook/addon-actions';
import { filterConfig, guppyConfig, fieldMapping } from './conf';
import ConnectedFilter from '../src/components/ConnectedFilter';
import AccessibleFilter from '../src/components/ConnectedFilter/AccessibleFilter';
import UnaccessibleFilter from '../src/components/ConnectedFilter/UnaccessibleFilter';
import SwitchableFilterExample from './SwitchableFilterExample';
import './guppyWrapper.css';

export default {
  title: 'ConnectedFilter',
};

export const Filter = () => {
  const processFilterAggsData = (aggsData) => aggsData;
  return (
    <ConnectedFilter
      filterConfig={filterConfig}
      guppyConfig={guppyConfig}
      onFilterChange={action('filter change')}
      fieldMapping={fieldMapping}
      onProcessFilterAggsData={processFilterAggsData}
      tierAccessLimit={guppyConfig.tierAccessLimit}
    />
  );
};

export const _AccessibleFilter = () => {
  const processFilterAggsData = (aggsData) => aggsData;
  return (
    <AccessibleFilter
      filterConfig={filterConfig}
      guppyConfig={guppyConfig}
      onFilterChange={action('filter change')}
      fieldMapping={fieldMapping}
      onProcessFilterAggsData={processFilterAggsData}
      tierAccessLimit={guppyConfig.tierAccessLimit}
    />
  );
};

export const _UnaccessibleFilter = () => {
  const processFilterAggsData = (aggsData) => aggsData;
  return (
    <UnaccessibleFilter
      filterConfig={filterConfig}
      guppyConfig={guppyConfig}
      onFilterChange={action('filter change')}
      fieldMapping={fieldMapping}
      onProcessFilterAggsData={processFilterAggsData}
      tierAccessLimit={guppyConfig.tierAccessLimit}
    />
  );
};

export const FilterHiddenNoData = () => {
  const processFilterAggsData = (aggsData) => aggsData;
  return (
    <ConnectedFilter
      filterConfig={filterConfig}
      guppyConfig={guppyConfig}
      onFilterChange={action('filter change')}
      fieldMapping={fieldMapping}
      onProcessFilterAggsData={processFilterAggsData}
      tierAccessLimit={guppyConfig.tierAccessLimit}
      filterValuesToHide={['no data']}
    />
  );
};

FilterHiddenNoData.story = {
  name: 'Filter Hidden "no data"',
};

export const _SwitchableFilterExample = () => <SwitchableFilterExample />;

_SwitchableFilterExample.story = {
  name: 'SwitchableFilterExample',
};
