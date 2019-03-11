import React from 'react';
import PropTypes from 'prop-types';
import FilterGroup from '@gen3/ui-component/dist/components/filters/FilterGroup';
import FilterList from '@gen3/ui-component/dist/components/filters/FilterList';
import {
  askGuppyAboutAllFieldsAndOptions,
  askGuppyForFilteredData,
  getAllFields,
} from './utils';

class ConnectedFilterGroup extends React.Component {
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
        this.initializeTabs(res.data.aggs);
      });
  }

  handleSelect() {
    console.log('select');
  }

  handleDrag() {
    console.log('drag');
  }

  getSingleFilterOption(histogramResult) {
    if (!histogramResult || !histogramResult.histogram || histogramResult.histogram.length === 0) {
      throw new Error('Error parsing field options');
    }
    if (histogramResult.histogram.length === 1 && (typeof histogramResult.histogram[0].key) !== 'string') {
      const rangeOptions = histogramResult.histogram.map(item => ({
        filterType: 'range',
        min: item.key[0],
        max: item.key[1],
        count: item.count, // TODO: add count
      }));
      //console.log('getSingleFilterOption: number options: ', rangeOptions);
      return rangeOptions;
    }
    else {
      const textOptions = histogramResult.histogram.map(item => ({
        text: item.key,
        filterType: 'singleSelect',
        count: item.count, // TODO: add count
      }));
      //console.log('getSingleFilterOption: text options: ', textOptions);
      return textOptions;
    }
  }

  getFilterSections(filters, tabsOptions) {
    const sections = filters.map(({field, label}) => {
      return {
        title: label,
        options: this.getSingleFilterOption(tabsOptions[field]),
      };
    });
    //console.log('getFilterSections: ', sections);
    return sections;
  }

  initializeTabs(tabsOptions) {
    const tabs = this.props.filterConfig.tabs.map(({filters}, index) => {
      return (
        <FilterList
          key={index}
          sections={this.getFilterSections(filters, tabsOptions)}
        />
      )
    });
    this.setState({tabs: tabs});
  }

  getFilterGroupConfig(filterConfig) {
    return {
      tabs: filterConfig.tabs.map(t => {
        return {
          title: t.title,
          fields: t.filters.map(f => f.field),
        };
      }),
    }
  }

  handleFilterChange(filterResults) {
    askGuppyForFilteredData(this.props.guppyServerPath, this.state.allFields, filterResults)

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
        tabs={this.state.tabs} // read from guppy using graphql
        filterConfig={this.getFilterGroupConfig(this.props.filterConfig)}
        onFilterChange={(e) => this.handleFilterChange(e)}
      />
    );
  }
}

ConnectedFilterGroup.propTypes = {
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
};

ConnectedFilterGroup.defaultProps = {
  onFilterChange: () => {},
};

export default ConnectedFilterGroup;
