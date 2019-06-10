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

class ConnectedFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      allFields: getAllFieldsFromFilterConfigs(this.props.filterConfig.tabs),
      initialAggsData: {},
      receivedAggsData: {},
      accessibility: ENUM_ACCESSIBILITY.ALL,
    };
    this.filterGroupRef = React.createRef();
  }

  componentDidMount() {
    if (this.props.onUpdateAccessLevel) {
      this.props.onUpdateAccessLevel(this.state.accessibility);
    }
    if (this.props.onFilterChange) {
      this.props.onFilterChange({}, this.state.accessibility);
    }
    askGuppyAboutAllFieldsAndOptions(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.allFields,
      this.state.accessibility,
    )
      .then((res) => {
        this.handleReceiveNewAggsData(res.data._aggregation[this.props.guppyConfig.type]);
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
    const processedTabsOptions = this.props.onProcessFilterAggsData(this.state.receivedAggsData);
    if (!processedTabsOptions || Object.keys(processedTabsOptions).length === 0) return null;
    const { fieldMapping } = this.props;
    const tabs = this.props.filterConfig.tabs.map(({ fields }, index) => (
      <FilterList
        key={index}
        sections={
          getFilterSections(fields, fieldMapping, processedTabsOptions, this.state.initialAggsData)
        }
        tierAccessLimit={this.props.tierAccessLimit}
      />
    ));
    return tabs;
  }

  setFilter(filter) {
    this.filterGroupRef.current.resetFilter();
    this.handleFilterChange(filter);
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
    askGuppyForAggregationData(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.allFields,
      filterResults,
      this.state.accessibility,
    )
      .then((res) => {
        this.handleReceiveNewAggsData(
          res.data._aggregation[this.props.guppyConfig.type],
          filterResults,
        );
      });

    if (this.props.onFilterChange) {
      this.props.onFilterChange(filterResults, this.state.accessibility);
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
    const filterTabs = this.getFilterTabs();
    if (!filterTabs || filterTabs.length === 0) {
      return null;
    }
    return (
      <FilterGroup
        ref={this.filterGroupRef}
        className={this.props.className}
        tabs={filterTabs}
        filterConfig={this.props.filterConfig}
        onFilterChange={e => this.handleFilterChange(e)}
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
    })),
  }).isRequired,
  guppyConfig: PropTypes.shape({
    path: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
  onFilterChange: PropTypes.func,
  onReceiveNewAggsData: PropTypes.func,
  hideZero: PropTypes.bool,
  className: PropTypes.string,
  fieldMapping: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string,
    name: PropTypes.string,
  })),
  tierAccessLimit: PropTypes.number,
  onProcessFilterAggsData: PropTypes.func,
  onUpdateAccessLevel: PropTypes.func,
};

ConnectedFilter.defaultProps = {
  onFilterChange: () => {},
  onReceiveNewAggsData: () => {},
  hideZero: true,
  className: '',
  fieldMapping: [],
  tierAccessLimit: undefined,
  onProcessFilterAggsData: data => (data),
  onUpdateAccessLevel: () => {},
};

export default ConnectedFilter;
