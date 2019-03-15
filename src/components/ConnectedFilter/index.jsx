import React from 'react';
import PropTypes from 'prop-types';
import FilterGroup from '@gen3/ui-component/dist/components/filters/FilterGroup';
import FilterList from '@gen3/ui-component/dist/components/filters/FilterList';
import {
  askGuppyAboutAllFieldsAndOptions,
  askGuppyForFilteredData,
  getAllFields,
  getFilterGroupConfig,
  getFilterSections,
  excludeSelfFilterFromAggsData,
} from './utils';

class ConnectedFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tabs: [],
      allFields: [],
      initialAggsData: {},
    };
  }

  componentDidMount() {
    const allFields = getAllFields(this.props.filterConfig.tabs);
    askGuppyAboutAllFieldsAndOptions(this.props.guppyServerPath, allFields)
      .then(res => {
        //console.log(res.data.aggs);
        this.setState({allFields});
        this.handleReceiveNewAggsData(res.data.aggs);
        this.saveInitialAggsData(res.data.aggs);
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
    // console.log(tabsOptions);
    const tabs = this.props.filterConfig.tabs.map(({filters}, index) => {
      return (
        <FilterList
          key={index}
          sections={getFilterSections(filters, tabsOptions, this.state.initialAggsData)}
        />
      )
    });
    this.setState({tabs: tabs});
  }

  handleFilterChange(filterResults) {
    askGuppyForFilteredData(this.props.guppyServerPath, this.state.allFields, filterResults)
      .then(res => {
        // console.log(res.data.aggs);
        this.handleReceiveNewAggsData(res.data.aggs, filterResults);
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
      filters: PropTypes.arrayOf(PropTypes.shape({
        field: PropTypes.string,
        label: PropTypes.string,
      })),
    })),
  }).isRequired,
  guppyServerPath: PropTypes.string,
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
