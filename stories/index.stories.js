import React from 'react';

import { storiesOf } from '@storybook/react';
import ConnectedFilterGroup from '../src/components/filters/filters';

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

storiesOf('FilterGroup', module)
  .add('filter group', () => {
    return (
      <ConnectedFilterGroup
        filterConfig={filterConfig}
        guppyServerPath={guppyServerPath}
      />
    );
  }
  );