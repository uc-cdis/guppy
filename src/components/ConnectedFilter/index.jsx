import React from 'react';
import PropTypes from 'prop-types';
import FilterGroup from '@gen3/ui-component/dist/components/filters/FilterGroup';
import FilterList from '@gen3/ui-component/dist/components/filters/FilterList';
import {
  getFilterSections,
  excludeSelfFilterFromAggsData,
} from './utils';
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
    };
  }

  componentDidMount() {
    askGuppyAboutAllFieldsAndOptions(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.allFields,
    )
      .then((res) => {
        this.handleReceiveNewAggsData(res.data._aggregation[this.props.guppyConfig.type]);
        this.saveInitialAggsData(res.data._aggregation[this.props.guppyConfig.type]);
      });
  }

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

  handleReceiveNewAggsData(receivedAggsData, filterResults) {
    this.setState({ receivedAggsData });
    if (this.props.onReceiveNewAggsData) {
      const resultAggsData = excludeSelfFilterFromAggsData(receivedAggsData, filterResults);
      this.props.onReceiveNewAggsData(resultAggsData);
    }
  }

  handleFilterChange(filterResults) {
    askGuppyForAggregationData(
      this.props.guppyConfig.path,
      this.props.guppyConfig.type,
      this.state.allFields, filterResults,
    )
      .then((res) => {
        this.handleReceiveNewAggsData(
          res.data._aggregation[this.props.guppyConfig.type],
          filterResults,
        );
      });

    if (this.props.onFilterChange) {
      this.props.onFilterChange(filterResults);
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
};

ConnectedFilter.defaultProps = {
  onFilterChange: () => {},
  onReceiveNewAggsData: () => {},
  hideZero: true,
  className: '',
  fieldMapping: [],
  tierAccessLimit: undefined,
  onProcessFilterAggsData: data => (data),
};

export default ConnectedFilter;
