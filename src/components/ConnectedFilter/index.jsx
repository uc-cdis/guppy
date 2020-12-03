/* eslint react/forbid-prop-types: 0 */
import _ from 'lodash';
import React from 'react';
import PropTypes from 'prop-types';
import FilterGroup from '@gen3/ui-component/dist/components/filters/FilterGroup';
import FilterList from '@gen3/ui-component/dist/components/filters/FilterList';
import {
  getFilterSections,
  excludeSelfFilterFromAggsData,
} from './utils';
import { ENUM_ACCESSIBILITY } from '../Utils/const';
import {
  askGuppyAboutAllFieldsAndOptions,
  askGuppyForAggregationData,
  getAllFieldsFromFilterConfigs,
} from '../Utils/queries';
import {
  mergeFilters,
  updateCountsInInitialTabsOptions,
  sortTabsOptions,
  mergeTabOptions,
} from '../Utils/filters';

class ConnectedFilter extends React.Component {
  constructor(props) {
    super(props);

    const filterConfigsFields = getAllFieldsFromFilterConfigs(props.filterConfig.tabs);
    const allFields = props.accessibleFieldCheckList
      ? _.union(filterConfigsFields, props.accessibleFieldCheckList)
      : filterConfigsFields;

    this.initialTabsOptions = {};
    this.state = {
      allFields,
      initialAggsData: {},
      receivedAggsData: {},
      accessibility: ENUM_ACCESSIBILITY.ALL,
      adminAppliedPreFilters: { ...this.props.adminAppliedPreFilters },
      filter: { ...this.props.adminAppliedPreFilters },
      filtersApplied: {},
      filterStatusOverride: {},
    };
    this.filterGroupRef = React.createRef();
    this.adminPreFiltersFrozen = JSON.stringify(this.props.adminAppliedPreFilters).slice();
  }

  componentDidMount() {
    if (this.props.onUpdateAccessLevel) {
      this.props.onUpdateAccessLevel(this.state.accessibility);
    }
    if (this.props.onFilterChange) {
      this.props.onFilterChange(this.state.adminAppliedPreFilters, this.state.accessibility);
    }
    askGuppyAboutAllFieldsAndOptions(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.allFields,
      this.state.accessibility,
      this.state.filter,
    )
      .then((res) => {
        if (!res.data) {
          const msg = `error querying guppy${res.errors && res.errors.length > 0 ? `: ${res.errors[0].message}` : ''}`;
          console.error(msg); // eslint-disable-line no-console
        }
        this.handleReceiveNewAggsData(
          res.data._aggregation[this.props.guppyConfig.type],
          this.state.adminAppliedPreFilters,
        );
        this.saveInitialAggsData(res.data._aggregation[this.props.guppyConfig.type]);
      });
  }

  /**
   * This function contains partial rendering logic for filter components.
   * It transfers aggregation data (`this.state.receivedAggsData`) to items inside filters.
   * But before that, the function first calls `this.props.onProcessFilterAggsData`, which is
   * a callback function passed by `ConnectedFilter`'s parent component, so that the parent
   * component could do some pre-processing modification about filter.
   */
  getFilterTabs() {
    if (this.props.hidden) return null;
    let processedTabsOptions = this.props.onProcessFilterAggsData(this.state.receivedAggsData);
    if (Object.keys(this.initialTabsOptions).length === 0) {
      this.initialTabsOptions = processedTabsOptions;
    }

    processedTabsOptions = updateCountsInInitialTabsOptions(
      this.initialTabsOptions,
      processedTabsOptions,
      this.state.filtersApplied,
      // for tiered access filters
      this.props.tierAccessLimit ? this.props.accessibleFieldCheckList : [],
    );
    if (Object.keys(this.state.filtersApplied).length) {
      // if has applied filters, sort tab options as selected/unselected separately
      const selectedTabsOptions = {};
      const unselectedTabsOptions = {};
      Object.keys(processedTabsOptions).forEach((opt) => {
        if (!processedTabsOptions[`${opt}`].histogram.length) {
          if (!unselectedTabsOptions[`${opt}`]) {
            unselectedTabsOptions[`${opt}`] = {};
          }
          unselectedTabsOptions[`${opt}`].histogram = [];
          return;
        }
        processedTabsOptions[`${opt}`].histogram.forEach((entry) => {
          if (this.state.filtersApplied[`${opt}`]
          && this.state.filtersApplied[`${opt}`].selectedValues
          && this.state.filtersApplied[`${opt}`].selectedValues.includes(entry.key)) {
            if (!selectedTabsOptions[`${opt}`]) {
              selectedTabsOptions[`${opt}`] = {};
            }
            if (!selectedTabsOptions[`${opt}`].histogram) {
              selectedTabsOptions[`${opt}`].histogram = [];
            }
            selectedTabsOptions[`${opt}`].histogram.push({ key: entry.key, count: entry.count });
          } else {
            if (!unselectedTabsOptions[`${opt}`]) {
              unselectedTabsOptions[`${opt}`] = {};
            }
            if (typeof (entry.key) !== 'string') { // if it is a range filter, just copy and return
              unselectedTabsOptions[`${opt}`].histogram = processedTabsOptions[`${opt}`].histogram;
              return;
            }
            if (!unselectedTabsOptions[`${opt}`].histogram) {
              unselectedTabsOptions[`${opt}`].histogram = [];
            }
            unselectedTabsOptions[`${opt}`].histogram.push({ key: entry.key, count: entry.count });
          }
        });
      });

      // For search filters: If there are any search filters present, include
      // the selected options in the `selectedTabsOptions` array.
      // ------
      let allSearchFields = [];
      this.props.filterConfig.tabs.forEach((tab) => {
        allSearchFields = allSearchFields.concat(tab.searchFields);
      });
      allSearchFields.forEach((field) => {
        if (this.state.filtersApplied[`${field}`]) {
          const { selectedValues } = this.state.filtersApplied[`${field}`];
          if (selectedValues) {
            this.state.filtersApplied[`${field}`].selectedValues.forEach((val) => {
              if (!selectedTabsOptions[`${field}`]) {
                selectedTabsOptions[`${field}`] = {};
              }
              if (!selectedTabsOptions[`${field}`].histogram) {
                selectedTabsOptions[`${field}`].histogram = [];
              }
              selectedTabsOptions[`${field}`].histogram.push({ key: val });
            });
          }
        }
      });
      // -------
      processedTabsOptions = mergeTabOptions(sortTabsOptions(selectedTabsOptions),
        sortTabsOptions(unselectedTabsOptions));
    } else {
      processedTabsOptions = sortTabsOptions(processedTabsOptions);
    }

    if (!processedTabsOptions || Object.keys(processedTabsOptions).length === 0) return null;
    const { fieldMapping } = this.props;
    const tabs = this.props.filterConfig.tabs.map(({ fields, searchFields }, index) => (
      <FilterList
        key={index}
        sections={
          getFilterSections(fields, searchFields, fieldMapping, processedTabsOptions,
            this.state.initialAggsData, this.state.adminAppliedPreFilters, this.props.guppyConfig)
        }
        tierAccessLimit={this.props.tierAccessLimit}
        lockedTooltipMessage={this.props.lockedTooltipMessage}
        disabledTooltipMessage={this.props.disabledTooltipMessage}
      />
    ));
    return tabs;
  }

  setFilter(filter) {
    if (this.filterGroupRef.current) {
      this.filterGroupRef.current.resetFilter();
    }
    this.handleFilterChange(filter);
  }

  scrollToFilter(filter) {
    if (this.filterGroupRef.current) {
      // find the tabIndex and sectionIndex of the filter
      let tabIndex;
      let sectionIndex;
      this.props.filterConfig.tabs.forEach(({ fields, searchFields }, tabIdx) => {
        let filters = [];
        if (searchFields) {
          filters = searchFields.concat(fields);
        } else {
          filters = fields;
        }
        if (filters.indexOf(filter) !== -1) {
          tabIndex = tabIdx;
          sectionIndex = filters.indexOf(filter);
        }
      });
      this.filterGroupRef.current.scrollToSection(tabIndex, sectionIndex);
    }
  }

  selectValue(filter, value) {
    const newFilterStatus = { ...this.state.filtersApplied };
    if (!newFilterStatus[filter]) {
      newFilterStatus[filter] = { selectedValues: [] };
    }
    const valueAlreadySelected = newFilterStatus[filter].selectedValues.includes(value);
    if (valueAlreadySelected) {
      return;
    }
    newFilterStatus[filter].selectedValues.push(value);
    // Trigger a filter change, as though user selected a filter. This will refresh
    // the aggregations from Guppy.
    this.handleFilterChange(newFilterStatus);
    // Manually select the new value in FilterGroup -- this is required in order
    // for the value to appear to be selected in FilterGroup.
    if (this.filterGroupRef.current) {
      // find the tabIndex and sectionIndex of the filter
      let tabIndex;
      let sectionIndex;
      this.props.filterConfig.tabs.forEach(({ fields, searchFields }, tabIdx) => {
        // sectionIndex
        let filters = [];
        if (searchFields) {
          filters = searchFields.concat(fields);
        } else {
          filters = fields;
        }
        if (filters.indexOf(filter) !== -1) {
          tabIndex = tabIdx;
          sectionIndex = filters.indexOf(filter);
        }
      });
      this.filterGroupRef.current.handleSelect(tabIndex, sectionIndex, value);
    }
  }

  handleReceiveNewAggsData(receivedAggsData, filterResults) {
    this.setState({ receivedAggsData });
    if (this.props.onReceiveNewAggsData) {
      const resultAggsData = excludeSelfFilterFromAggsData(receivedAggsData, filterResults);
      // Also pass parent component the raw aggs data without self filter removed.
      // GuppyWrapper needs this raw data to do fulltext search over fields.
      const unfilteredAggsData = receivedAggsData;
      this.props.onReceiveNewAggsData(resultAggsData, unfilteredAggsData);
    }
  }

  /**
   * Handler function that is called everytime filter changes
   * What this function does:
   * 1. Ask guppy for aggregation data using (processed) filter
   * 2. After get aggregation response, call `handleReceiveNewAggsData` handler
   *    to process new received agg data
   * 3. If there's `onFilterChange` callback function from parent, call it
   * @param {object} filterResults
   */
  handleFilterChange(filterResults) {
    console.log('filterResults', filterResults);
    this.setState({
      adminAppliedPreFilters: JSON.parse(this.adminPreFiltersFrozen),
    });
    const mergedFilterResults = mergeFilters(filterResults, JSON.parse(this.adminPreFiltersFrozen));
    this.setState({ filtersApplied: mergedFilterResults });
    askGuppyForAggregationData(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.allFields,
      mergedFilterResults,
      this.state.accessibility,
    )
      .then((res) => {
        this.handleReceiveNewAggsData(
          res.data._aggregation[this.props.guppyConfig.type],
          mergedFilterResults,
        );
      });

    if (this.props.onFilterChange) {
      this.props.onFilterChange(mergedFilterResults, this.state.accessibility);
    }
  }

  /**
   * Save initial aggregation data, especially for range slider
   * so that we still have min/max values for range slider
   * @param {object} aggsData
   */
  saveInitialAggsData(aggsData) {
    this.setState({ initialAggsData: aggsData });
  }

  render() {
    if (this.props.hidden) return null;
    const filterTabs = this.getFilterTabs();
    if (!filterTabs || filterTabs.length === 0) {
      return null;
    }
    // If there are any search fields, insert them at the top of each tab's fields.
    // Why? We need to have a way to configure which fields are search fields, so
    // `searchFields` and `fields` are separate in this.props.filterConfig, but
    // FilterGroup doesn't distinguish between searchFields and fields, so we need
    // to combine searchFields and fields together when passing a filterConfig down to FilterGroup.
    // For the moment, search fields are always sorted above standard fields.
    const filterConfig = {
      tabs: this.props.filterConfig.tabs.map(({ title, fields, searchFields }) => {
        if (searchFields) {
          return { title, fields: searchFields.concat(fields) };
        }
        return { title, fields };
      }),
    };
    return (
      <FilterGroup
        ref={this.filterGroupRef}
        className={this.props.className}
        tabs={filterTabs}
        filterConfig={filterConfig}
        filterStatusOverride={this.state.filterStatusOverride}
        onFilterChange={(e) => this.handleFilterChange(e)}
        hideZero={this.props.hideZero}
      />
    );
  }
}

ConnectedFilter.propTypes = {
  filterConfig: PropTypes.shape({
    tabs: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string,
      fields: PropTypes.arrayOf(PropTypes.string),
      searchFields: PropTypes.arrayOf(PropTypes.string),
    })),
  }).isRequired,
  guppyConfig: PropTypes.shape({
    path: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
  onFilterChange: PropTypes.func,
  onReceiveNewAggsData: PropTypes.func,
  className: PropTypes.string,
  fieldMapping: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string,
    name: PropTypes.string,
  })),
  tierAccessLimit: PropTypes.number,
  onProcessFilterAggsData: PropTypes.func,
  onUpdateAccessLevel: PropTypes.func,
  adminAppliedPreFilters: PropTypes.object,
  lockedTooltipMessage: PropTypes.string,
  disabledTooltipMessage: PropTypes.string,
  accessibleFieldCheckList: PropTypes.arrayOf(PropTypes.string),
  hideZero: PropTypes.bool,
  hidden: PropTypes.bool,
};

ConnectedFilter.defaultProps = {
  onFilterChange: () => {},
  onReceiveNewAggsData: () => {},
  className: '',
  fieldMapping: [],
  tierAccessLimit: undefined,
  onProcessFilterAggsData: (data) => (data),
  onUpdateAccessLevel: () => {},
  adminAppliedPreFilters: {},
  lockedTooltipMessage: '',
  disabledTooltipMessage: '',
  accessibleFieldCheckList: undefined,
  hideZero: false,
  hidden: false,
};

export default ConnectedFilter;
