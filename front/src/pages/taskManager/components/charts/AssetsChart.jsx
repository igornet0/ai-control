import React from 'react';
import { Doughnut } from 'react-chartjs-2';

const AssetsChart = ({ data, options }) => {
  return (
    <div className="h-64">
      <Doughnut data={data} options={options} />
    </div>
  );
};

export default AssetsChart;