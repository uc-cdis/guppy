import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import PropTypes from 'prop-types';
import ConnectedFilter from '../src/components/ConnectedFilter';
import GuppyWrapper from '../src/components/GuppyWrapper';
import ReactTable from "react-table";
import "react-table/react-table.css";
import './guppyWrapper.css';

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
      { field: 'whatever_lab_result_value', label: 'Lab Result Value' },
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

const tableConfig = [
  { field: 'project', name: 'Project' },
  { field: 'study', name: 'Study' },
  { field: 'race', name: 'Race' },
  { field: 'ethnicity', name: 'Ethnicity' },
  { field: 'gender', name: 'Gender' },
  { field: 'vital_status', name: 'Vital Status' },
  { field: 'whatever_lab_result_value', name: 'Lab Result Value' },
  { field: 'file_count', name: 'File Count' },
  { field: 'file_type', name: 'File Type' },
  { field: 'file_format', name: 'File Format' },
];

const defaultPageSize = 20;
class ConnectedTableExample extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      pageSize: defaultPageSize,
    };
  }

  fetchData(state, instance) {
    this.setState({ loading: true });
    const offset = state.page * state.pageSize;
    const sort = state.sorted.map(i => {
      return {
        [i.id]: i.desc ? 'desc' : 'asc',
      };
    });
    const size = state.pageSize;
    this.props.fetchAndUpdateRawData({
      offset,
      size,
      sort,
    }).then(res => {
      this.setState({
        loading: false,
        pageSize: size,
      });
    });
  }

  render() {
    const columnsConfig = tableConfig.map(c => ({Header: c.name, accessor: c.field}));
    const totalCount = this.props.totalCount;
    const pageSize = this.state.pageSize;
    const totalPages = Math.floor(totalCount / pageSize) + ((totalCount % pageSize === 0) ? 0 : 1);
    return (
      <ReactTable
        columns={columnsConfig}
        manual // Forces table not to paginate or sort automatically, so we can handle it server-side
        data={this.props.rawData}
        pages={totalPages} // Display the total number of pages
        loading={this.state.loading} // Display the loading overlay when we need it
        onFetchData={this.fetchData.bind(this)} // Request new data when things change
        defaultPageSize={defaultPageSize}
        className={`-striped -highlight ${this.props.className}`}
      />
    );
  }
}

ConnectedTableExample.propTypes = {
  rawData: PropTypes.array,
  className: PropTypes.string,
  fetchAndUpdateRawData: PropTypes.func,
  totalCount: PropTypes.number,
};

const guppyConfig = {
  path: 'http://localhost:3000/graphql',
  type: 'subject',
};
storiesOf('Components', module)
  .add('ConnectedFilter', () => {
    return (
      <ConnectedFilter
        filterConfig={filterConfig}
        guppyConfig={guppyConfig}
        onFilterChange={action('filter change')}
      />
    );
  })
  .add('GuppyWrapper', () => {
    return (
      <div className='guppy-wrapper'>
        <GuppyWrapper
          filterConfig={filterConfig}
          guppyConfig={guppyConfig}
          onFilterChange={action('wrapper receive filter change')}
          onReceiveNewAggsData={action('wrapper receive aggs data')}
        >
          <ConnectedFilter
            className='guppy-wrapper__filter'
            filterConfig={filterConfig}
            guppyConfig={guppyConfig}
          />
          <ConnectedTableExample className='guppy-wrapper__table' />
        </GuppyWrapper>
      </div>
    )
  });
