import React from 'react';
import PropTypes from 'prop-types';
import {
  askGuppyForRawData,
  downloadDataFromGuppy,
  askGuppyForTotalCounts,
} from '../Utils/queries';

/**
 * Wrapper that connects to Guppy server, 
 * and pass filter, aggs, and data to children components
 * Input props: 
 *   - filterConfig: configuration for ConnectedFilter component
 *   - guppyConfig: Guppy server config
 *   - onFilterChange: callback that takes filter as argument, will be 
 * called everytime filter changes
 *   - onReceiveNewAggsData: callback that takes aggregation results 
 * as argument, will be called everytime aggregation results updated
 * 
 * This wrapper will pass following data (filters, aggs, configs) to children components via prop: 
 *   - aggsData: the aggregation results, format:
 *         {
 *            [field]: { histogram: [{key: 'v1', count: 42}, {key: 'v2', count: 19}, ...] }, // for text aggregation
 *            [field]: { histogram: [{key: [1, 83], count: 100}] }, // for numeric aggregation 
 *            ...
 *         }
 *   - filter: the filters, format: 
 *         { 
 *            [field]: { selectedValues: ['v1', 'v2', ...] },  // for text filter
 *            [field]: { upperBound: 1, lowerBound: 83 },  // for range filter
 *            ...
 *         }
 *   - filterConfig: configuration for ConnectedFilter component
 *   - rawData: raw data records filtered (with offset, size, and sort applied)
 *   - totalCount: total count of raw data records
 * 
 */
class GuppyWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.filter = {}; // to avoid asynchronizations, we store another filter as private var
    this.state = {
      aggsData: {},
      filter: {},
      allFields: props.tableConfig.map(entry => entry.field),
      rawData: [],
      totalCount: 0,
    }
  }

  componentDidMount() {
    this.getDataFromGuppy(this.state.allFields, undefined, true);
  }

  handleReceiveNewAggsData(aggsData) {
    if (this.props.onReceiveNewAggsData) {
      this.props.onReceiveNewAggsData(aggsData, this.filter);
    }
    this.setState({ aggsData });
  }

  handleFilterChange(filter) {
    if (this.props.onFilterChange) {
      this.props.onFilterChange(filter);
    }
    this.filter = filter;
    this.setState({ filter });
    this.getDataFromGuppy(this.state.allFields, undefined, true);
  }

  getDataFromGuppy(fields, sort, updateDataWhenReceive, offset, size) {
    return askGuppyForRawData(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      fields,
      this.filter,
      sort,
      offset, 
      size, 
    ).then(res => {
      if (!res || !res.data) {
        throw new Error(`Error getting raw ${this.props.guppyConfig.type} data from Guppy server ${this.props.guppyConfig.path}.`);
      }
      const parsedData = res.data[this.props.guppyConfig.type];
      const totalCount = res.data._aggregation[this.props.guppyConfig.type]._totalCount;
      if (updateDataWhenReceive) {
        this.setState({
          rawData: parsedData,
          totalCount,
        });
      }
      return {
        data: parsedData,
        totalCount,
      };
    });
  }

  /**
   * Fetch data from Guppy server.
   * This function will update this.state.rawData and this.state.totalCount
   */
  handleFetchAndUpdateRawData({offset=0, size=20, sort=[]}) {
    return this.getDataFromGuppy(this.state.allFields, sort, true, offset, size);
  }

  /**
   * Download all data from Guppy server and return raw data
   * This function uses current filter argument
   */
  handleDownloadRawData(sort) {
    return downloadDataFromGuppy(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.totalCount,
      {
        fields: this.state.allFields, 
        sort: sort || [],
        filter: this.state.filter,
      },
    );
  }

  /**
   * Download all data from Guppy server and return raw data
   * For only given fields
   * This function uses current filter argument
   */
  handleDownloadRawDataByFields({fields, sort=[]}) {
    let targetFields = fields;
    if (typeof fields === 'undefined') {
      targetFields = this.state.allFields;
    }
    return downloadDataFromGuppy(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.totalCount,
      {
        fields: targetFields, 
        sort,
        filter: this.state.filter,
      },
    );
  }

  /**
   * Get total count from other es type, with filter
   * @param {string} type 
   * @param {object} filter 
   */
  handleAskGuppyForTotalCounts(type, filter) {
    return askGuppyForTotalCounts(this.props.guppyConfig.path, type, filter);
  }

  /**
   * Get raw data from other es type, with filter
   * @param {string} type 
   * @param {object} filter 
   * @param {string[]} fields 
   */
  handleDownloadRawDataByTypeAndFilter(type, filter, fields) {
    return askGuppyForTotalCounts(this.props.guppyConfig.path, type, filter)
      .then(count => {
        return downloadDataFromGuppy(
          this.props.guppyConfig.path,
          type,
          count,
          {
            fields,
            filter,
          },
        );
      });
  }

  render() {
    return (
      <React.Fragment> 
        {
          React.Children.map(this.props.children, child => React.cloneElement(child, {
            // pass data to children
            aggsData: this.state.aggsData,
            filter: this.state.filter,
            filterConfig: this.props.filterConfig,
            rawData: this.state.rawData, // raw data (with current filter applied)
            totalCount: this.state.totalCount, // total count of raw data (with current filter applied)
            fetchAndUpdateRawData: this.handleFetchAndUpdateRawData.bind(this), 
            downloadRawData: this.handleDownloadRawData.bind(this),
            downloadRawDataByFields: this.handleDownloadRawDataByFields.bind(this),

            // a callback function which return total counts for any type, with any filter
            getTotalCountsByTypeAndFilter: this.handleAskGuppyForTotalCounts.bind(this), 
            downloadRawDataByTypeAndFilter: this.handleDownloadRawDataByTypeAndFilter.bind(this),

            // below are just for ConnectedFilter component
            onReceiveNewAggsData: this.handleReceiveNewAggsData.bind(this),
            onFilterChange: this.handleFilterChange.bind(this),
            guppyConfig: this.props.guppyConfig,
          }))
        }
      </React.Fragment>
    );
  }
}

GuppyWrapper.propTypes = {
  guppyConfig: PropTypes.shape({
    path: PropTypes.string,
    type: PropTypes.string,
  }).isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  filterConfig: PropTypes.shape({
    tabs: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string,
      filters: PropTypes.arrayOf(PropTypes.shape({
        field: PropTypes.string,
        label: PropTypes.string,
      })),
    })),
  }).isRequired,
  tableConfig: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string,
    name: PropTypes.string,
  })).isRequired,
  onReceiveNewAggsData: PropTypes.func, 
  onFilterChange: PropTypes.func, 
};

GuppyWrapper.defaultProps = {
  onReceiveNewAggsData: () => {},
  onFilterChange: () => {},
};

export default GuppyWrapper;
