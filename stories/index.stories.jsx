import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import ConnectedFilter from '../src/components/ConnectedFilter';
import GuppyWrapper from '../src/components/GuppyWrapper';
import SummaryPieChart from '@gen3/ui-component/dist/components/charts/SummaryPieChart';

const filterConfig = {
  tabs: [{
    title: 'Project',
    filters: [
      { field: 'project', label: 'Project' },
      { field: 'study', label: 'Study' },
    ],
  },
  {
    title: 'Subject',
    filters: [
      { field: 'race', label: 'Race' },
      { field: 'ethnicity', label: 'Ethnicity' },
      { field: 'gender', label: 'Gender' },
      { field: 'vital_status', label: 'Vital_status' },
    ],
  },
  {
    title: 'File',
    filters: [
      { field: 'file_count', label: 'File_count' },
      { field: 'file_type', label: 'File_type' },
      { field: 'file_format', label: 'File_format' },
    ],
  }],
};

const guppyServerPath = 'http://localhost:3000/graphql';

storiesOf('Components', module)
  .add('ConnectedFilter', () => {
    return (
      <ConnectedFilter
        filterConfig={filterConfig}
        guppyServerPath={guppyServerPath}
        onFilterChange={action('filter change')}
      />
    );
  })
  .add('GuppyWrapper', () => {
    return (
      <GuppyWrapper
        filterConfig={filterConfig}
        guppyServerPath={guppyServerPath}
        onFilterChange={action('wrapper receive filter change')}
        onReceiveNewAggsData={action('wraooer receive aggs data')}
      >
        <ConnectedFilter className='test'/>
      </GuppyWrapper>
    )
  });
