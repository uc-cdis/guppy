import React from 'react';
import SummaryPieChart from '@gen3/ui-component/dist/components/charts/SummaryPieChart';

const chartData = [
  { name: 'H1N1', value: 4000 },
  { name: 'VN1203', value: 3000 },
  { name: 'HIV', value: 2800 },
  { name: 'HuCoV_EMC', value: 2000 },
  { name: 'SARS_CoV', value: 2708 },
  { name: 'CA04', value: 1890 },
];

class ChartGroup extends React.Component {
  render() {
    return (
      <SummaryPieChart data={chartData} title='pie chart title' showPercentage />
    );
  }
}

export default ChartGroup;
