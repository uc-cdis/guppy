import React from 'react';
import { Table } from 'antd';
import PropTypes from 'prop-types';
import { tableConfig } from './conf';

class ConnectedTableExample extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      pagination: {
        current: 1,
        pageSize: 20,
        total: this.props.totalCount,
      },
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps?.totalCount !== this.props.totalCount) {
      this.setState({
        pagination: {
          current: this.state.pagination.current,
          pageSize: this.state.pagination.pageSize,
          total: this.props.totalCount,
        },
      });
    }
  }

  render() {
    const columnsConfig = tableConfig.map(c => ({
      title: c.name,
      dataIndex: c.field,
      sorter: true,
    }));

    const handleTableChange = (pagination, filters, sorter) => {
      const size = pagination.pageSize;
      this.setState({ loading: true });
      const offset = (pagination.current - 1) * size;
      const sort = sorter?.order ? {
        [sorter.field]: sorter.order === 'descend' ? 'desc' : 'asc',
      } : {};
      this.props.fetchAndUpdateRawData({
        offset,
        size,
        sort,
      }).then((res) => {
        this.setState({
          loading: false,
          pagination: {
            current: pagination.current,
            pageSize: size,
            total: this.props.totalCount,
          },
        });
      });
    };
    return (
      <Table
        className={`connected-table-example ${this.props.className}`}
        columns={columnsConfig}
        dataSource={this.props.rawData || []}
        pagination={this.state.pagination}
        loading={this.state.loading} // Display the loading overlay when we need it
        onChange={handleTableChange} // Request new data when things change
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

export default ConnectedTableExample;
