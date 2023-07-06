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
  askGuppyAboutArrayTypes,
  askGuppyForAggregationData,
  getAllFieldsFromFilterConfigs,
} from '../Utils/queries';
import {
  mergeFilters,
  updateCountsInInitialTabsOptions,
  sortTabsOptions,
  mergeTabOptions,
  buildFilterStatusForURLFilter,
} from '../Utils/filters';

class ConnectedFilter extends React.Component {
  constructor(props) {
    super(props);

    const filterConfigsFields = getAllFieldsFromFilterConfigs(props.filterConfig.tabs);
    let allFields = props.accessibleFieldCheckList
      ? _.union(filterConfigsFields, props.accessibleFieldCheckList)
      : filterConfigsFields;
    allFields = _.union(allFields, this.props.extraAggsFields);

    this.initialTabsOptions = {};
    let initialFilter = this.props.adminAppliedPreFilters;
    let filterStatusArray = [];
    let filtersApplied = {};
    if (this.props.userFilterFromURL && Object.keys(this.props.userFilterFromURL).length > 0) {
      filterStatusArray = buildFilterStatusForURLFilter(
        this.props.userFilterFromURL,
        this.getTabsWithSearchFields(),
      );
      filtersApplied = this.props.userFilterFromURL;
      initialFilter = mergeFilters(this.props.userFilterFromURL, this.props.adminAppliedPreFilters);
    }

    this.state = {
      allFields,
      initialAggsData: {},
      receivedAggsData: {},
      accessibility: ENUM_ACCESSIBILITY.ALL,
      adminAppliedPreFilters: { ...this.props.adminAppliedPreFilters },
      filter: { ...initialFilter },
      filtersApplied,
      filterStatusArray,
    };
    this.filterGroupRef = React.createRef();
    this.adminPreFiltersFrozen = JSON.stringify(this.props.adminAppliedPreFilters).slice();
    this.arrayFields = [];
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

    askGuppyAboutArrayTypes(this.props.guppyConfig.path).then((res) => {
      this.arrayFields = [];
      const keys = Object.keys(res);

      for (let i = 0; i < keys.length; i += 1) {
        if (res[keys[i]].arrayFields && res[keys[i]].arrayFields.length > 0) {
          this.arrayFields = this.arrayFields.concat(res[keys[i]].arrayFields);
        }
      }
    });
  }

  handleReceiveNewAggsData(receivedAggsData, filterResults) {
    this.setState({ receivedAggsData });
    if (this.props.onReceiveNewAggsData) {
      const resultAggsData = excludeSelfFilterFromAggsData(receivedAggsData, filterResults);
      this.props.onReceiveNewAggsData(resultAggsData);
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
    this.setState({ adminAppliedPreFilters: JSON.parse(this.adminPreFiltersFrozen) });
    const mergedFilterResults = mergeFilters(filterResults, JSON.parse(this.adminPreFiltersFrozen));

    const newFilterStatusArray = buildFilterStatusForURLFilter(
      mergedFilterResults,
      this.getTabsWithSearchFields(),
    );

    this.setState({ filtersApplied: mergedFilterResults, filterStatusArray: newFilterStatusArray });
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

  getTabsWithSearchFields() {
    const newTabs = this.props.filterConfig.tabs.map(({ title, fields, searchFields }) => {
      if (searchFields) {
        return { title, fields: searchFields.concat(fields) };
      }
      return { title, fields };
    });
    return newTabs;
  }

  // eslint-disable-next-line react/no-unused-class-component-methods
  setFilter(filter) {
    if (this.filterGroupRef.current) {
      this.filterGroupRef.current.resetFilter();
    }
    this.handleFilterChange(filter);
  }

  /**
   * This function contains partial rendering logic for filter components.
   * It transfers aggregation data (`this.state.receivedAggsData`) to items inside filters.
   * But before that, the function first calls `this.props.onProcessFilterAggsData`, which is
   * a callback function passed by `ConnectedFilter`'s parent component, so that the parent
   * component could do some pre-processing modification about filter.
   */
  getFilterTabs() {
    const filtersToDisplay = this.state.filtersApplied;
    if (this.props.hidden) return null;
    let processedTabsOptions = this.props.onProcessFilterAggsData(this.state.receivedAggsData);

    // Get filter values
    const allFilterValues = this.props.filterConfig.tabs.reduce(
      (accumulator, tab) => ([...accumulator, ...tab.fields]),
      [],
    );

    if (Object.keys(this.initialTabsOptions).length === 0) {
      this.initialTabsOptions = processedTabsOptions;
    }

    processedTabsOptions = updateCountsInInitialTabsOptions(
      this.initialTabsOptions,
      processedTabsOptions,
      filtersToDisplay,
      // for tiered access filters
      this.props.tierAccessLimit ? this.props.accessibleFieldCheckList : [],
      allFilterValues,
    );

    if (Object.keys(filtersToDisplay).length) {
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
          if (filtersToDisplay[`${opt}`]
          && filtersToDisplay[`${opt}`].selectedValues
          && filtersToDisplay[`${opt}`].selectedValues.includes(entry.key)) {
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
        if (filtersToDisplay[`${field}`]) {
          const { selectedValues } = filtersToDisplay[`${field}`];
          if (selectedValues) {
            filtersToDisplay[`${field}`].selectedValues.forEach((val) => {
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
      processedTabsOptions = mergeTabOptions(
        sortTabsOptions(selectedTabsOptions),
        sortTabsOptions(unselectedTabsOptions),
      );
    } else {
      processedTabsOptions = sortTabsOptions(processedTabsOptions);
    }
    if (!processedTabsOptions || Object.keys(processedTabsOptions).length === 0) return null;
    const { fieldMapping } = this.props;
    const tabs = this.props.filterConfig.tabs.map(({ fields, searchFields }, index) => {
      const sections = getFilterSections(
        fields,
        searchFields,
        fieldMapping,
        processedTabsOptions,
        this.state.initialAggsData,
        this.state.adminAppliedPreFilters,
        this.props.guppyConfig,
        this.arrayFields,
        this.props.filterValuesToHide,
      );
      const filterStatus = this.state.filterStatusArray
        ? this.state.filterStatusArray[index] : null;
      return (
        <FilterList
          key={index}
          sections={sections}
          hideEmptyFilterSection={this.props.hideEmptyFilterSection}
          tierAccessLimit={this.props.tierAccessLimit}
          lockedTooltipMessage={this.props.lockedTooltipMessage}
          disabledTooltipMessage={this.props.disabledTooltipMessage}
          arrayFields={this.arrayFields}
          filterStatusFromParent={filterStatus}
        />
      );
    });
    return tabs;
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
    const filterConfig = {
      tabs: this.getTabsWithSearchFields(),
    };
    return (
      <FilterGroup
        ref={this.filterGroupRef}
        className={this.props.className}
        tabs={filterTabs}
        filterConfig={filterConfig}
        onFilterChange={(e) => this.handleFilterChange(e)}
        hideZero={this.props.hideZero}
        filterStatusFromParent={this.state.filterStatusArray}
        filterResultsFromParent={this.state.filtersApplied}
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
  extraAggsFields: PropTypes.arrayOf(PropTypes.string),
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
  userFilterFromURL: PropTypes.object,
  hideEmptyFilterSection: PropTypes.bool,
  filterValuesToHide: PropTypes.arrayOf(PropTypes.string),
};

ConnectedFilter.defaultProps = {
  extraAggsFields: [],
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
  userFilterFromURL: {},
  hideEmptyFilterSection: false,
  filterValuesToHide: [],
};

export default ConnectedFilter;
