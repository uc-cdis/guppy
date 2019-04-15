import React from 'react';
import PropTypes from 'prop-types';
import FilterGroup from '@gen3/ui-component/dist/components/filters/FilterGroup';
import FilterList from '@gen3/ui-component/dist/components/filters/FilterList';
import {
  getFilterGroupConfig,
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
      tabs: [],
      allFields: getAllFieldsFromFilterConfigs(this.props.filterConfig.tabs),
      initialAggsData: {},
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
        this.saveInitialAggsData(res.data._aggregation);
      });
  }

  /**
   * Save initial aggregation data, especially for range slider
   * so that we still have min/max values for range slider
   * @param {object} aggsData
   */
  saveInitialAggsData(aggsData) {
    this.setState({ initialAggsData: aggsData });
  }

  handleReceiveNewAggsData(receivedAggsData, filterResults) {
    this.updateTabs(receivedAggsData);
    if (this.props.onReceiveNewAggsData) {
      const resultAggsData = excludeSelfFilterFromAggsData(receivedAggsData, filterResults);
      this.props.onReceiveNewAggsData(resultAggsData);
    }
  }

  updateTabs(tabsOptions) {
    const tabs = this.props.filterConfig.tabs.map(({ filters }, index) => (
      <FilterList
        key={index}
        sections={getFilterSections(filters, tabsOptions, this.state.initialAggsData)}
      />
    ));
    this.setState({ tabs });
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

  render() {
    if (!this.state.tabs || this.state.tabs.length === 0) {
      return null;
    }
    return (
      <FilterGroup
        className={this.props.className}
        tabs={this.state.tabs}
        filterConfig={getFilterGroupConfig(this.props.filterConfig)}
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
      filters: PropTypes.arrayOf(PropTypes.shape({
        field: PropTypes.string,
        label: PropTypes.string,
      })),
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
};

ConnectedFilter.defaultProps = {
  onFilterChange: () => {},
  onReceiveNewAggsData: () => {},
  hideZero: true,
  className: '',
};

export default ConnectedFilter;
