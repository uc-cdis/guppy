import React from 'react';
import PropTypes from 'prop-types';
import {
  askGuppyForRawData,
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
    this.getDataFromGuppy(undefined, true);
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
    this.getDataFromGuppy(undefined, true);
  }

  getDataFromGuppy(sort, updateDataWhenReceive, offset, size) {
    return askGuppyForRawData(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.allFields,
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
    return this.getDataFromGuppy(sort, true, offset, size);
  }

  /**
   * Fetch data from Guppy server and return raw data
   * This funciton will not update this.state.rawData and this.state.totalCount
   */
  handleFetchRawData({offset=0, size=20, sort=[]}) {
    return this.getDataFromGuppy(sort, false, offset, size);
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
            rawData: this.state.rawData, // raw data (with filter applied)
            totalCount: this.state.totalCount, // total count of raw data
            fetchAndUpdateRawData: this.handleFetchAndUpdateRawData.bind(this),
            fetchRawData: this.handleFetchRawData.bind(this),

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
