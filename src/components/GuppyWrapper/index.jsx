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
  queryGuppyForRawDataAndTotalCounts,
} from '../Utils/queries';
import { ENUM_ACCESSIBILITY } from '../Utils/const';
import { mergeFilters } from '../Utils/filters';
import { capitalizeFirstLetter } from '../ConnectedFilter/utils';

const getFilterDisplayName = (filter, fieldMapping) => {
  const overrideName = fieldMapping.find((entry) => (entry.field === filter));
  const label = overrideName ? overrideName.name : capitalizeFirstLetter(filter);
  return label;
};

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
    // to avoid asynchronizations, we store another filter as private var
    this.filter = { ...this.props.adminAppliedPreFilters };
    this.adminPreFiltersFrozen = JSON.stringify(this.props.adminAppliedPreFilters).slice();
    this.state = {
      gettingDataFromGuppy: false,
      aggsData: {},
      filter: { ...this.props.adminAppliedPreFilters },
      rawData: [],
      totalCount: 0,
      allFields: [],
      rawDataFields: [],
      accessibleFieldObject: undefined,
      unaccessibleFieldObject: undefined,
      accessibility: ENUM_ACCESSIBILITY.ALL,
      adminAppliedPreFilters: { ...this.props.adminAppliedPreFilters },
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

  handleReceiveNewAggsData(aggsData) {
    if (this.props.onReceiveNewAggsData) {
      this.props.onReceiveNewAggsData(aggsData, this.filter);
    }
    this.setState({ aggsData });
  }

  handleFilterChange(userFilter, accessibility) {
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

  searchInFiltersAndValues(searchString) {
    // First, search in local filters and values that match this search term.
    return new Promise((resolve, reject) => {
      // all we need to do is search over aggsData (?)

      const HIGHLIGHT_START = '<em>';
      const HIGHLIGHT_END = '</em>';
      const matches = {
        filters: [], // format: [highlighted filters]
        values: {}, // format: { [filter]: [{value: string, matched: string, count: number}] }
      };
      if (searchString.trim() === '') {
        resolve(matches);
        return;
      }
      const keyword = searchString.toLowerCase();
      // search over filters; add highlights to filters
      // Find the visible titles of the filters -- search over the filters that are configured
      // and apply the mapping from actual filter name to display name if present
      let visibleFilters = [];
      this.props.filterConfig.tabs.forEach((tab) => {
        visibleFilters = visibleFilters.concat(tab.fields);
        visibleFilters = visibleFilters.concat(tab.searchFields);
      });
      visibleFilters = visibleFilters.map((filter) => getFilterDisplayName(filter, this.props.guppyConfig.fieldMapping));
      for (let i = 0; i < visibleFilters.length; i += 1) {
        const filter = visibleFilters[i];
        const filterLower = filter.toLowerCase();
        const matchIdx = filterLower.indexOf(keyword);
        if (matchIdx >= 0) {
          // add highlight tags where searchString matches
          let highlightedFilter = filter;
          highlightedFilter = filter.slice(0, matchIdx) + HIGHLIGHT_START + filter.slice(matchIdx, matchIdx + keyword.length) + HIGHLIGHT_END + filter.slice(matchIdx + keyword.length);
          matches.filters.push(highlightedFilter);
        }
      }

      // search over local values in aggsData
      const { aggsData } = this.state;
      Object.entries(aggsData).forEach(([filter, { histogram }]) => {
        histogram.forEach(({ count, key }) => {
          const value = key;
          const matchIdx = value.toLowerCase().indexOf(keyword);
          if (matchIdx >= 0) {
            // add highlight tags where searchString matches
            let highlightedValue = value;
            highlightedValue = value.slice(0, matchIdx) + HIGHLIGHT_START + value.slice(matchIdx, matchIdx + keyword.length) + HIGHLIGHT_END + value.slice(matchIdx + keyword.length);
            const filterDisplayName = getFilterDisplayName(filter, this.props.guppyConfig.fieldMapping);
            if (!matches.values[filterDisplayName]) {
              matches.values[filterDisplayName] = [];
            }
            matches.values[filterDisplayName].push({ value, matched: highlightedValue, count });
          }
        });
      });

      // search over searchFields
      const NUM_SEARCH_OPTIONS = 20;
      const allSearchFields = [];
      this.props.filterConfig.tabs.forEach((tab) => {
        allSearchFields.push(...tab.searchFields);
      });
      const filter = {
        search: {
          keyword: searchString,
          fields: allSearchFields,
        },
      };
      queryGuppyForRawDataAndTotalCounts(
        this.props.guppyConfig.path,
        this.props.guppyConfig.type,
        allSearchFields,
        filter,
        undefined,
        0, // offset, FIXME may want to take another look at this
        NUM_SEARCH_OPTIONS,
        'accessible',
      )
        .then((res) => {
          if (!res.data || !res.data[this.props.guppyConfig.type]) {
            resolve([]);
          } else {
            const results = res.data[this.props.guppyConfig.type];
            // Add the results we got from Guppy into matches
            // NOTE @mpingram possibility of race conditions here if this callback
            // modifies matches at the same time as code above?
            if (results) {
              results.forEach((entry) => {
                // eslint-disable-next-line no-underscore-dangle
                if (!entry._matched) {
                  throw new Error(`Failed to find _matched in entry ${entry}`);
                }
                // eslint-disable-next-line no-underscore-dangle
                entry._matched.forEach((match) => {
                  match.highlights.forEach((highlight) => {
                    const { field } = match;
                    const filterDisplayName = getFilterDisplayName(field, this.props.guppyConfig.fieldMapping);
                    if (!matches.values[filterDisplayName]) {
                      matches.values[filterDisplayName] = [];
                    }
                    // FIXME -- figure out how to deal with highlight and count here
                    matches.values[filterDisplayName].push({ value: highlight, matched: highlight, count: 1 });
                  });
                });
              });
              resolve(matches);
            } else {
              reject(new Error(`Could not parse search query results from Guppy: ${JSON.stringify(res, null, 2)}`));
            }
          }
        }).catch((err) => {
          reject(err);
        });
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

            // handle search queries
            searchInFiltersAndValues: this.searchInFiltersAndValues.bind(this),

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
    fieldMapping: PropTypes.arrayOf(PropTypes.shape({
      field: PropTypes.string,
      name: PropTypes.string,
    })),
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
};

GuppyWrapper.defaultProps = {
  onReceiveNewAggsData: () => { },
  onFilterChange: () => { },
  rawDataFields: [],
  accessibleFieldCheckList: undefined,
  adminAppliedPreFilters: {},
};

export default GuppyWrapper;
