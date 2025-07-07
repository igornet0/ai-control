import React from 'react';
import { Line } from 'react-chartjs-2';

const BalanceChart = ({ chartData, chartOptions, chartRef }) => {
  return (
    <div className="h-80">
      <Line 
        ref={chartRef}
        data={chartData} 
        options={chartOptions} 
      />
    </div>
  );
};

export default BalanceChart;