import React from 'react';
import FileSaver from 'file-saver';
import Button from '@gen3/ui-component/dist/components/Button';
import PropTypes from 'prop-types';

class DownloadButtonExample extends React.Component {
  constructor(props) {
    super(props);
  }

  downloadData() {
    this.props.downloadRawData().then((res) => {
      if (res) {
        const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'text/json' });
        const fileName = 'download.json';
        FileSaver.saveAs(blob, fileName);
      }
      else {
        throw Error('Error when downloading data');
      }
    });
  }

  render() {
    return (
      <Button
        label={`download ${this.props.totalCount} ${this.props.guppyConfig.type} data`}
        onClick={this.downloadData.bind(this)}
      />
    );
  }
}

DownloadButtonExample.propTypes = {
  downloadRawData: PropTypes.func,
  totalCount: PropTypes.number,
};

export default DownloadButtonExample;
