import React from 'react';
import PropTypes from 'prop-types';
import {
  askGuppyForRawData,
  downloadDataFromGuppy,
  askGuppyForTotalCounts,
  getAllFieldsFromGuppy,
  getAccessibleResources,
  askGuppyForNestedAggregationData,
} from '../Utils/queries';
import { ENUM_ACCESSIBILITY } from '../Utils/const';

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
    this.filter = {}; // to avoid asynchronizations, we store another filter as private var
    console.log('inside guppywrapper constructor with adminAppliedPreFilters:', this.props.adminAppliedPreFilters);
    this.state = {
      aggsData: {},
      filter: {},
      rawData: [],
      totalCount: 0,
      allFields: [],
      rawDataFields: [],
      accessibleFieldObject: undefined,
      unaccessibleFieldObject: undefined,
      accessibility: ENUM_ACCESSIBILITY.ALL,
      adminAppliedPreFilters: Object.assign({}, this.props.adminAppliedPreFilters),
    };
    this.adminObjectReadOnly = Object.assign({}, this.props.adminAppliedPreFilters);
    Object.freeze(this.adminObjectReadOnly);
    this.adminObjectFrozenString = JSON.stringify(this.adminObjectReadOnly).slice();

  }

  /**
   * This function takes two objects containing filters to be applied
   * and combines them into one filter object in the same format.
   * Note: the admin filter takes precedence. Selected values in the user
   * filter will be discarded if the key collides. This is to avoid
   * the user undoing the admin filter. (Multiple user checkboxes increase the 
   amount of data shown when combined, but an admin filter should always decrease
   or keep constant the amount of dat shown when combined with a user filter).
  * */
  mergeFilters(userFilter, adminAppliedPreFilter) {
    console.log('guppy mergeFilters. userFilter: ', userFilter);
    console.log('guppy mergeFilters. adminAppliedPreFilter: ', adminAppliedPreFilter);
    const filterAB = Object.assign({}, userFilter);
    for (const key in adminAppliedPreFilter) {
      if (Object.prototype.hasOwnProperty.call(userFilter, key)
          && Object.prototype.hasOwnProperty.call(adminAppliedPreFilter, key)) {
        console.log('mergeFilters 72: ', key);
        // The admin filter overrides the user filter to maintain exclusivity.
        filterAB[key].selectedValues = adminAppliedPreFilter[key].allowedValues;
      } else if (Object.prototype.hasOwnProperty.call(adminAppliedPreFilter, key)) {
        filterAB[key] = { 'selectedValues' : adminAppliedPreFilter[key].allowedValues };
      }
    }
    console.log('guppy mergeFilters. filterAB: ', filterAB);
    return filterAB;
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
    console.log('GuppyWrapper line 99 -- getDataFromGuppy: ', fields, ' ', size, ' ', offset);
    if (!fields || fields.length === 0) {
      return Promise.resolve({ data: [], totalCount: 0 });
    }

    // nested aggregation
    if (this.props.guppyConfig.mainField) {
      const numericAggregation = this.props.guppyConfig.mainFieldIsNumeric;
      return askGuppyForNestedAggregationData(
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
      offset,
      size,
      this.state.accessibility,
    ).then((res) => {
      if (!res || !res.data) {
        throw new Error(`Error getting raw ${this.props.guppyConfig.type} data from Guppy server ${this.props.guppyConfig.path}.`);
      }
      const parsedData = res.data[this.props.guppyConfig.type];
      console.log(' DEBUG ME!!! askGuppyForRawData res', res);
      console.log(' and res.data._aggregation', res.data._aggregation);
      console.log(' and this.props.guppyConfig.type', this.props.guppyConfig.type);
      const totalCount = res.data._aggregation[this.props.guppyConfig.type]._totalCount;
      if (updateDataWhenReceive) {
        this.setState({
          rawData: parsedData,
          totalCount,
        });
      }
      console.log('returning from askGuppyForRawData callback in getDataFromGuppy: ', parsedData, ' and ', totalCount);
      return {
        data: parsedData,
        totalCount,
      };
    });
  }

  handleReceiveNewAggsData(aggsData) {
    if (this.props.onReceiveNewAggsData) {
      this.props.onReceiveNewAggsData(aggsData, this.filter);
    }
    this.setState({ aggsData });
  }

  handleFilterChange(userFilter, accessibility) {
    console.log('(204) GUPPY WRAPPER HANDLE FILTER CHANGE! ', JSON.parse(JSON.stringify(this.props.adminAppliedPreFilters)));
    console.log('(205) GUPPY WRAPPER HANDLE FILTER CHANGE! ', JSON.parse(JSON.stringify(this.adminObjectReadOnly)));
    console.log('(206) GUPPY WRAPPER HANDLE FILTER CHANGE! ', this.adminObjectFrozenString);
    console.log('(207) state prefilter before string assign ', this.state.adminAppliedPreFilters);
    this.state.adminAppliedPreFilters = JSON.parse(this.adminObjectFrozenString);
    console.log('(2089) state prefilter after string assign ', this.state.adminAppliedPreFilters);
    console.log('guppy HANDLE FILTER CHANGE 192 filter:', userFilter);
    let filter = Object.assign({}, userFilter);
    if (Object.keys(this.state.adminAppliedPreFilters).length > 0) {
      console.log('guppy HANDLE FILTER CHANGE 194 merging filters');
      filter = this.mergeFilters(userFilter, this.state.adminAppliedPreFilters);
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
  handleDownloadRawData(sort) {
    return downloadDataFromGuppy(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.totalCount,
      {
        fields: this.state.rawDataFields,
        sort: sort || [],
        filter: this.state.filter,
        accessibility: this.state.accessibility,
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
      type, filter,
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
      .then(count => downloadDataFromGuppy(
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

  render() {
    console.log('GUPPY WRAPPER 313 adminAppliedPreFilters: ', 
      JSON.parse(JSON.stringify(this.props.adminAppliedPreFilters
    )));
    console.log('GUPPY WRAPPER 314 adminAppliedPreFilters: ', 
      JSON.parse(JSON.stringify(this.state.adminAppliedPreFilters
    )));
    return (
      <React.Fragment>
        {
          React.Children.map(this.props.children, child => React.cloneElement(child, {
            // pass data to children
            aggsData: this.state.aggsData,
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
    })),
  }).isRequired,
  rawDataFields: PropTypes.arrayOf(PropTypes.string),
  onReceiveNewAggsData: PropTypes.func,
  onFilterChange: PropTypes.func,
  accessibleFieldCheckList: PropTypes.arrayOf(PropTypes.string),
  adminAppliedPreFilters: PropTypes.object,
};

GuppyWrapper.defaultProps = {
  onReceiveNewAggsData: () => {},
  onFilterChange: () => {},
  rawDataFields: [],
  accessibleFieldCheckList: undefined,
  adminAppliedPreFilters: {},
};

export default GuppyWrapper;
