import React from 'react';
import PropTypes from 'prop-types';

class GuppyWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.filter = {};
  }

  handleReceiveNewAggsData(aggsData) {
    console.log('handleReceiveNewAggsData', aggsData);
    if (this.props.onReceiveNewAggsData) {
      this.props.onReceiveNewAggsData(aggsData, this.filter);
    }
  }

  handleFilterChange(filter) {
    console.log('handleFilterChange', filter);
    if (this.props.onFilterChange) {
      this.props.onFilterChange(filter);
    }
    this.filter = filter;
  }

  render() {
    return (
      <React.Fragment> 
        {
          React.Children.map(this.props.children, child => React.cloneElement(child, {
            // TODO: filteredData, filteredOptions, etc.
            ...this.props,
            onReceiveNewAggsData: this.handleReceiveNewAggsData.bind(this),
            onFilterChange: this.handleFilterChange.bind(this),
          }))
        }
      </React.Fragment>
    );
  }
}

GuppyWrapper.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
  filterConfig: PropTypes.shape({
    tabs: PropTypes.arrayOf(PropTypes.shape({
      title: PropTypes.string,
      filters: PropTypes.arrayOf(PropTypes.shape({
        field: PropTypes.string,
        label: PropTypes.string,
      })),
    })),
  }).isRequired,
  onReceiveNewAggsData: PropTypes.func, 
  onFilterChange: PropTypes.func, 
};

GuppyWrapper.defaultProps = {
  onReceiveNewAggsData: () => {},
  onFilterChange: () => {},
};

export default GuppyWrapper;
