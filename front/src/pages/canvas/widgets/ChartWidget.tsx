import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Bar, Line, Pie } from 'react-chartjs-2';


interface ChartWidgetProps {
  widgetId: string;
}

export default function ChartWidget({ widgetId }: ChartWidgetProps) {
  const filters = useSelector((state: RootState) => state.filter.filters);

    const applyFilters = (data: any[]) => {
    if (!filters.length) return data;

    return data.filter(item => {
        return filters.every(filter => {
        if (Array.isArray(filter.value)) {
            return item[filter.field] >= filter.value[0] && item[filter.field] <= filter.value[1];
        }
        return String(item[filter.field]) === String(filter.value);
        });
    });
    };

  const widget = useSelector((state: RootState) =>
    state.dashboard.widgets.find(w => w.id === widgetId)
  );

  const dataSources = useSelector((state: RootState) => state.dataSource.sources);
  const source = dataSources.find(ds => ds.id === widget?.dataSourceId);

  const chartType = widget?.chartType || 'bar';

  if (!widget) return null;

  const buildChartData = (rows: any[]) => {
    if (!rows.length) return sampleData;

    const labels = rows.map((row, idx) => row.label || `Запись ${idx + 1}`);
    const values = rows.map(row => parseFloat(row.value) || 0);

    return {
      labels,
      datasets: [{
        label: widget?.title || 'Загруженные данные',
        data: values,
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
      }],
    };
  };

  const sampleData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [
      {
        label: widget.title || 'Продажи',
        data: [65, 59, 80, 81],
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  const filteredData = source ? applyFilters(source.data) : [];
  const data = source ? buildChartData(filteredData) : sampleData;

  const renderChart = () => {
    if (chartType === 'line') return <Line data={data} />;
    if (chartType === 'pie') return <Pie data={data} />;
    return <Bar data={data} />;
  };

  if (!widget) return null;

  return renderChart();
}