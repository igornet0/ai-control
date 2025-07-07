import React, { useState, useEffect } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import BalanceChart from '../charts/BalanceChart';
import AssetsChart from '../charts/AssetsChart';

// const FinanceTabContent = ({ 
//   user, 
//   chartData, 
//   chartOptions, 
//   chartRef,
//   assetsChartData,
//   assetsChartOptions
// }) => {

const FinanceTabContent = ({ 
  user
}) => {
    
  const [assetsData, setAssetsData] = useState(null);

    useEffect(() => {
      setAssetsData({
        crypto: 80,
        cash: 20,
      });
    }, [user.balance]);

  // Настройки графика баланса
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y || 0;
            let label = `${datasetLabel}: $${value.toFixed(2)}`;
            
            if (datasetLabel === 'Forecast') {
              const change = ((value - user.balance) / user.balance * 100).toFixed(2);
              label += ` (${change}%)`;
            }
            
            return label;
          },
          afterLabel: function(context) {
            if (context.datasetIndex === 1) {
              return 'Projected growth based on current trends';
            }
            return null;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: function(value) {
            return '$' + value;
          }
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'index',
      intersect: false
    }
  };

  // Данные для графика
  const getChartData = () => {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Фактические данные
    const actualData = Array(6).fill(null)
      .map((_, i) => 10000 - 100 + i * 550)
      .concat(Array(6).fill(null));
    
    // Прогнозируемые данные
    const forecastData = Array(6).fill(null)
      .concat(Array(6).fill(null)
      .map((_, i) => 13000 + (i + 1) * 1800));
    
    return {
      labels,
      datasets: [
        {
          label: 'Actual Balance',
          data: actualData,
          borderColor: 'rgb(79, 70, 229)',
          backgroundColor: (context) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            
            if (!chartArea) return null;
            
            const gradient = ctx.createLinearGradient(
              0, 
              chartArea.top, 
              0, 
              chartArea.bottom
            );
            gradient.addColorStop(0, 'rgba(79, 70, 229, 0.6)');
            gradient.addColorStop(1, 'rgba(79, 70, 229, 0.05)');
            return gradient;
          },
          pointBackgroundColor: 'rgb(79, 70, 229)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(79, 70, 229)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Forecast',
          data: forecastData,
          borderColor: 'rgb(14, 165, 233)',
          backgroundColor: 'rgba(14, 165, 233, 0.05)',
          borderDash: [5, 5],
          pointBackgroundColor: 'rgb(14, 165, 233)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(14, 165, 233)',
          tension: 0.4,
          fill: true,
        }
      ]
    };
  };

  // Данные для круговой диаграммы активов
  const assetsChartData = {
    labels: ['Crypto', 'Cash'],
    datasets: [
      {
        data: assetsData ? [
          assetsData.crypto,
          assetsData.cash
        ] : [80, 20],
        backgroundColor: [
          'rgba(79, 70, 229, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(107, 114, 128, 0.8)'
        ],
        borderColor: [
          'rgba(79, 70, 229, 1)',
          'rgba(14, 165, 233, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(234, 179, 8, 1)',
          'rgba(107, 114, 128, 1)'
        ],
        borderWidth: 1,
      }
    ]
  };

  const assetsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 16,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = Math.round(value);
            return `${label}: ${percentage}%`;
          }
        }
      }
    },
    cutout: '70%',
  };

  return (
    <div className="lg:col-span-3">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Управление капиталом</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 p-6 rounded-2xl">
            <div className="text-3xl font-bold text-blue-800 mb-2">${user.balance}</div>
            <div className="text-gray-600">Текущий баланс</div>
            </div>
            
            <div className="bg-green-50 p-6 rounded-2xl">
            <div className="text-3xl font-bold text-green-800 mb-2">+$1,240</div>
            <div className="text-gray-600">Доход за месяц</div>
            </div>
            
            <div className="bg-purple-50 p-6 rounded-2xl">
            <div className="text-3xl font-bold text-purple-800 mb-2">+24.7%</div>
            <div className="text-gray-600">Рост за квартал</div>
            </div>
        </div>
        
        <div className="mb-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Статистика баланса</h3>
            <div className="h-80">
            <Line 
                data={getChartData()} 
                options={chartOptions} 
            />
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Распределение активов</h3>
            <div className="h-64">
                <Doughnut 
                data={assetsChartData} 
                options={assetsChartOptions} 
                />
            </div>
            </div>
            
            <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Прогнозируемый рост</h3>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl h-full">
                <div className="flex items-center mb-4">
                <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
                <div className="font-medium">Прогноз на следующий квартал</div>
                </div>
                
                <div className="text-3xl font-bold text-blue-800 mb-2">+18.2%</div>
                <p className="text-gray-600 mb-4">
                На основе текущих рыночных тенденций и стратегии ИИ
                </p>
                
                <div className="flex items-center mb-4">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <div className="font-medium">Прибыль активов</div>
                </div>
                
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span>ВTC</span>
                        <span className="font-medium">+29%</span>
                    </div>
                    <div className="flex justify-between">
                        <span>ETH</span>
                        <span className="font-medium">+24%</span>
                    </div>
                    <div className="flex justify-between">
                        <span>XMR</span>
                        <span className="font-medium">+20%</span>
                    </div>
                </div>
            </div>
            </div>
        </div>
        
        <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Быстрые действия</h3>
            <div className="flex flex-wrap gap-4">
            <button className="flex-1 min-w-[200px] bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg transition">
                Пополнить счет
            </button>
            <button className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg transition">
                Вывести средства
            </button>
            <button className="flex-1 min-w-[200px] bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg transition">
                Инвестировать
            </button>
            <button className="flex-1 min-w-[200px] bg-yellow-600 hover:bg-yellow-700 text-white p-4 rounded-lg transition">
                Торговать
            </button>
            </div>
        </div>
        </div>
    </div>
  );
};

export default FinanceTabContent;

