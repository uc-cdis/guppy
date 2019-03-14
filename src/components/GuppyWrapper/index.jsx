import React from 'react';
import PropTypes from 'prop-types';

class GuppyWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.filter = {};
    this.state = {
      aggsData: {},
      filter: {},
    }
  }

  handleReceiveNewAggsData(aggsData) {
    console.log('handleReceiveNewAggsData', aggsData);
    if (this.props.onReceiveNewAggsData) {
      this.props.onReceiveNewAggsData(aggsData, this.filter);
    }
    this.setState({ aggsData });
  }

  handleFilterChange(filter) {
    console.log('handleFilterChange', filter);
    if (this.props.onFilterChange) {
      this.props.onFilterChange(filter);
    }
    this.filter = filter;
    this.setState({ filter });
  }

  render() {
    return (
      <React.Fragment> 
        {
          React.Children.map(this.props.children, child => React.cloneElement(child, {
            ...this.props,
            onReceiveNewAggsData: this.handleReceiveNewAggsData.bind(this),
            onFilterChange: this.handleFilterChange.bind(this),
            aggsData: this.state.aggsData,
            filter: this.state.filter,
            filterConfig: this.props.filterConfig,
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
