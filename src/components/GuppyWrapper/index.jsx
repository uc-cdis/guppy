/* eslint-disable react/jsx-fragments */
/* eslint react/forbid-prop-types: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import {
  askGuppyForRawData,
  downloadDataFromGuppy,
  askGuppyForTotalCounts,
  getAllFieldsFromGuppy,
  getAccessibleResources,
  askGuppyForSubAggregationData,
} from '../Utils/queries';
import { ENUM_ACCESSIBILITY, FILE_FORMATS } from '../Utils/const';
import { mergeFilters } from '../Utils/filters';

/**
 * Wrapper that connects to Guppy server,
 * and pass filter, aggs, and data to children components
 * Input props:
 *   - filterConfig: configuration for ConnectedFilter component
 *   - guppyConfig: Guppy server config
 *   - onFilterChange: callback that takes filter as argument, will be
 * called every time filter changes
 *   - onReceiveNewAggsData: callback that takes aggregation results
 * as argument, will be called every time aggregation results updated
 *
 * This wrapper will pass following data (filters, aggs, configs) to children components via prop:
 *   - aggsData: the aggregation results, format:
 *         {
 *             // for text aggregation
 *            [field]: { histogram: [{key: 'v1', count: 42}, {key: 'v2', count: 19}, ...] },
 *             // for numeric aggregation
 *            [field]: { histogram: [{key: [1, 83], count: 100}] },
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
    let initialFilter = this.props.adminAppliedPreFilters;
    if (Object.keys(this.props.initialFilterFromURL).length > 0) {
      initialFilter = mergeFilters(
        this.props.initialFilterFromURL,
        this.props.adminAppliedPreFilters,
      );
    }

    // to avoid asynchronizations, we store another filter as private var
    this.filter = { ...initialFilter };
    this.adminPreFiltersFrozen = JSON.stringify(this.props.adminAppliedPreFilters).slice();
    this.state = {
      gettingDataFromGuppy: false,
      aggsData: {},
      filter: { ...initialFilter },
      rawData: [],
      totalCount: 0,
      allFields: [],
      rawDataFields: [],
      accessibleFieldObject: undefined,
      unaccessibleFieldObject: undefined,
      accessibility: ENUM_ACCESSIBILITY.ALL,
      adminAppliedPreFilters: { ...this.props.adminAppliedPreFilters },
      userFilterFromURL: { ...this.props.initialFilterFromURL },
    };
  }

  componentDidMount() {
    getAllFieldsFromGuppy(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
    ).then((fields) => {
      const rawDataFields = (this.props.rawDataFields && this.props.rawDataFields.length > 0)
        ? this.props.rawDataFields : fields;
      this.setState({
        allFields: fields,
        rawDataFields,
      }, () => {
        this.getDataFromGuppy(this.state.rawDataFields, undefined, true);
      });
    });
    if (typeof this.props.accessibleFieldCheckList !== 'undefined') {
      getAccessibleResources(
        this.props.guppyConfig.path,
        this.props.guppyConfig.type,
        this.props.accessibleFieldCheckList,
      ).then(({ accessibleFieldObject, unaccessibleFieldObject }) => {
        this.setState({
          accessibleFieldObject,
          unaccessibleFieldObject,
        });
      });
    }
  }

  handleReceiveNewAggsData(aggsData) {
    if (this.props.onReceiveNewAggsData) {
      this.props.onReceiveNewAggsData(aggsData, this.filter);
    }
    this.setState({ aggsData });
  }

  handleFilterChange(userFilterFromUserInput, accessibility) {
    let userFilter = userFilterFromUserInput;

    // Apply user filters from URL on page load. Empty out state to avoid reapplying used filters.
    if (Object.keys(userFilter).length === 0
      && Object.keys(this.state.userFilterFromURL).length > 0) {
      userFilter = JSON.parse(JSON.stringify(this.state.userFilterFromURL));
      this.setState({ userFilterFromURL: {} });
    }

    this.setState({ adminAppliedPreFilters: JSON.parse(this.adminPreFiltersFrozen) });
    let filter = { ...userFilter };
    if (Object.keys(this.state.adminAppliedPreFilters).length > 0) {
      filter = mergeFilters(userFilter, this.state.adminAppliedPreFilters);
    }
    if (this.props.onFilterChange) {
      this.props.onFilterChange(filter);
    }
    this.filter = filter;
    this.setState({
      filter,
      accessibility,
    }, () => {
      this.getDataFromGuppy(this.state.rawDataFields, undefined, true);
    });
  }

  /**
   * Fetch data from Guppy server.
   * This function will update this.state.rawData and this.state.totalCount
   */
  handleFetchAndUpdateRawData({ offset = 0, size = 20, sort = [] }) {
    return this.getDataFromGuppy(this.state.rawDataFields, sort, true, offset, size);
  }

  /**
   * Download all data from Guppy server and return raw data
   * This function uses current filter argument
   */
  handleDownloadRawData({ sort, format }) {
    // error handling for misconfigured format types
    if (format && !(format.toUpperCase() in FILE_FORMATS)) {
      // eslint-disable-next-line no-console
      console.error(`Invalid value ${format} found for arg format!`);
    }
    return downloadDataFromGuppy(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.totalCount,
      {
        fields: this.state.rawDataFields,
        sort: sort || [],
        filter: this.state.filter,
        accessibility: this.state.accessibility,
        format,
      },
    );
  }

  /**
   * Download all data from Guppy server and return raw data
   * For only given fields
   * This function uses current filter argument
   */
  handleDownloadRawDataByFields({ fields, sort = [] }) {
    let targetFields = fields;
    if (typeof fields === 'undefined') {
      targetFields = this.state.rawDataFields;
    }
    return downloadDataFromGuppy(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.totalCount,
      {
        fields: targetFields,
        sort,
        filter: this.state.filter,
        accessibility: this.state.accessibility,
      },
    );
  }

  /**
   * Get total count from other es type, with filter
   * @param {string} type
   * @param {object} filter
   */
  handleAskGuppyForTotalCounts(type, filter) {
    return askGuppyForTotalCounts(
      this.props.guppyConfig.path,
      type,
      filter,
      this.state.accessibility,
    );
  }

  /**
   * Get raw data from other es type, with filter
   * @param {string} type
   * @param {object} filter
   * @param {string[]} fields
   */
  handleDownloadRawDataByTypeAndFilter(type, filter, fields) {
    return askGuppyForTotalCounts(
      this.props.guppyConfig.path,
      type,
      filter,
      this.state.accessibility,
    )
      .then((count) => downloadDataFromGuppy(
        this.props.guppyConfig.path,
        type,
        count,
        {
          fields,
          filter,
        },
      ));
  }

  handleAccessLevelUpdate(accessLevel) {
    this.setState({ accessibility: accessLevel });
  }

  /**
   * This function get data with current filter (if any),
   * and update this.state.rawData and this.state.totalCount
   * @param {string[]} fields
   * @param {object} sort
   * @param {bool} updateDataWhenReceive
   * @param {number} offset
   * @param {number} size
   */
  getDataFromGuppy(fields, sort, updateDataWhenReceive, offset, size) {
    this.setState({ gettingDataFromGuppy: true });
    if (!fields || fields.length === 0) {
      this.setState({ gettingDataFromGuppy: false });
      return Promise.resolve({ data: [], totalCount: 0 });
    }

    // sub aggregations -- for DAT
    if (this.props.guppyConfig.mainField) {
      const numericAggregation = this.props.guppyConfig.mainFieldIsNumeric;
      return askGuppyForSubAggregationData(
        this.props.guppyConfig.path,
        this.props.guppyConfig.type,
        this.props.guppyConfig.mainField,
        numericAggregation,
        this.props.guppyConfig.aggFields,
        [],
        this.filter,
        this.state.accessibility,
      ).then((res) => {
        if (!res || !res.data) {
          throw new Error(`Error getting raw ${this.props.guppyConfig.type} data from Guppy server ${this.props.guppyConfig.path}.`);
        }
        const data = res.data._aggregation[this.props.guppyConfig.type];
        const field = numericAggregation ? 'asTextHistogram' : 'histogram';
        const parsedData = data[this.props.guppyConfig.mainField][field];
        if (updateDataWhenReceive) {
          this.setState({
            rawData: parsedData,
          });
        }
        this.setState({ gettingDataFromGuppy: false });
        return {
          data: res.data,
        };
      });
    }

    // non-nested aggregation
    return askGuppyForRawData(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      fields,
      this.filter,
      sort,
      undefined,
      offset,
      size,
      this.state.accessibility,
    ).then((res) => {
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
      this.setState({ gettingDataFromGuppy: false });
      return {
        data: parsedData,
        totalCount,
      };
    });
  }

  render() {
    return (
      <>
        {
          React.Children.map(this.props.children, (child) => React.cloneElement(child, {
            // pass data to children
            aggsData: this.state.aggsData,
            aggsDataIsLoading: this.state.gettingDataFromGuppy,
            filter: this.state.filter,
            filterConfig: this.props.filterConfig,
            rawData: this.state.rawData, // raw data (with current filter applied)
            totalCount: this.state.totalCount, // total count of raw data (current filter applied)
            fetchAndUpdateRawData: this.handleFetchAndUpdateRawData.bind(this),
            downloadRawData: this.handleDownloadRawData.bind(this),
            downloadRawDataByFields: this.handleDownloadRawDataByFields.bind(this),
            allFields: this.state.allFields,
            accessibleFieldObject: this.state.accessibleFieldObject,
            unaccessibleFieldObject: this.state.unaccessibleFieldObject,

            // a callback function which return total counts for any type, with any filter
            getTotalCountsByTypeAndFilter: this.handleAskGuppyForTotalCounts.bind(this),
            downloadRawDataByTypeAndFilter: this.handleDownloadRawDataByTypeAndFilter.bind(this),

            // below are just for ConnectedFilter component
            onReceiveNewAggsData: this.handleReceiveNewAggsData.bind(this),
            onFilterChange: this.handleFilterChange.bind(this),
            guppyConfig: this.props.guppyConfig,
            onUpdateAccessLevel: this.handleAccessLevelUpdate.bind(this),
            adminAppliedPreFilters: this.props.adminAppliedPreFilters,
            accessibleFieldCheckList: this.props.accessibleFieldCheckList,
          }))
        }
      </>
    );
  }
}

GuppyWrapper.propTypes = {
  guppyConfig: PropTypes.shape({
    path: PropTypes.string,
    type: PropTypes.string,
    mainField: PropTypes.string,
    mainFieldIsNumeric: PropTypes.bool,
    aggFields: PropTypes.array,
  }).isRequired,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  filterConfig: PropTypes.shape({
    tabs: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string,
      fields: PropTypes.arrayOf(PropTypes.string),
      searchFields: PropTypes.arrayOf(PropTypes.string),
    })),
  }).isRequired,
  rawDataFields: PropTypes.arrayOf(PropTypes.string),
  onReceiveNewAggsData: PropTypes.func,
  onFilterChange: PropTypes.func,
  accessibleFieldCheckList: PropTypes.arrayOf(PropTypes.string),
  adminAppliedPreFilters: PropTypes.object,
  initialFilterFromURL: PropTypes.object,
};

GuppyWrapper.defaultProps = {
  onReceiveNewAggsData: () => {},
  onFilterChange: () => {},
  rawDataFields: [],
  accessibleFieldCheckList: undefined,
  adminAppliedPreFilters: {},
  initialFilterFromURL: {},
};

export default GuppyWrapper;
