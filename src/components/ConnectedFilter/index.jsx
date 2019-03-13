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
} from './utils';

class ConnectedFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tabs: [],
      allFields: [],
    };
  }

  componentDidMount() {
    const allFields = getAllFields(this.props.filterConfig.tabs);
    askGuppyAboutAllFieldsAndOptions(this.props.guppyServerPath, allFields)
      .then(res => {
        //console.log(res.data.aggs);
        this.setState({allFields});
        this.handleReceiveNewAggsData(res.data.aggs);
      });
  }

  handleReceiveNewAggsData(aggsData) {
    this.updateTabs(aggsData);
    if (this.props.onReceiveNewAggsData) {
      this.props.onReceiveNewAggsData(aggsData);
    }
  }

  updateTabs(tabsOptions) {
    // console.log(tabsOptions);
    const tabs = this.props.filterConfig.tabs.map(({filters}, index) => {
      return (
        <FilterList
          key={index}
          sections={getFilterSections(filters, tabsOptions)}
        />
      )
    });
    this.setState({tabs: tabs});
  }

  handleFilterChange(filterResults) {
    askGuppyForFilteredData(this.props.guppyServerPath, this.state.allFields, filterResults)
      .then(res => {
        // console.log(res.data.aggs);
        this.handleReceiveNewAggsData(res.data.aggs);
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
};

ConnectedFilter.defaultProps = {
  onFilterChange: () => {},
  onReceiveNewAggsData: () => {},
  hideZero: true,
};

export default ConnectedFilter;
