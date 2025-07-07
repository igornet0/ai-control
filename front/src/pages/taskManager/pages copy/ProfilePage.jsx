import React, { useState, useRef, useEffect } from 'react';
import { 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Chart as ChartJS } from 'chart.js';

import ProfileSidebar from '../components/profile/ProfileSidebar';
import UserGreeting from '../components/profile/UserGreeting';
import ProfileTabContent from '../components/profile/ProfileTabContent';
import FinanceTabContent from '../components/profile/FinanceTabContent';
import FinancialActivity from '../components/profile/FinancialActivity';
import ChatList from '../components/profile/ChatList';
import AgentsTabContent from '../components/profile/AgentsTabContent';
import StrategyTabContent from '../components/profile/StrategyTabContent';
import CoinsTabContent from '../components/profile/CoinsTabContent';
import ModelsTabContent from '../components/profile/ModelsTabContent';
import StrategyTable from '../components/profile/StrategyTable';

// Регистрация компонентов Chart.js
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  Filler
);

const ProfilePage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [assetsData, setAssetsData] = useState(null);
  const chartRef = useRef(null);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  
  // Генерация данных для графика
  // useEffect(() => {
  //   // Данные для графика баланса
  //   const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
  //   // Фактические данные
  //   const actualData = Array(6).fill(null)
  //     .map((_, i) => 10000 - 100 + i * 550)
  //     .concat(Array(6).fill(null));
    
  //   // Прогнозируемые данные
  //   const forecastData = Array(6).fill(null)
  //     .concat(Array(6).fill(null)
  //     .map((_, i) => 13000 + (i + 1) * 1800));
    
  //   // Данные для распределения активов
  //   setAssetsData({
  //     crypto: Math.floor(Math.random() * 80),
  //     cash: Math.floor(Math.random() * 20),
  //   });
    
  //   // Настройка градиента для графика
  //   if (chartRef.current) {
  //     const ctx = chartRef.current.ctx;
  //     const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  //     gradient.addColorStop(0, 'rgba(79, 70, 229, 0.6)');
  //     gradient.addColorStop(1, 'rgba(79, 70, 229, 0.05)');
      
  //     setChartData({
  //       labels,
  //       datasets: [
  //         {
  //           label: 'Actual Balance',
  //           data: actualData,
  //           borderColor: 'rgb(79, 70, 229)',
  //           backgroundColor: gradient,
  //           pointBackgroundColor: 'rgb(79, 70, 229)',
  //           pointBorderColor: '#fff',
  //           pointHoverBackgroundColor: '#fff',
  //           pointHoverBorderColor: 'rgb(79, 70, 229)',
  //           tension: 0.4,
  //           fill: true,
  //         },
  //         {
  //           label: 'Forecast',
  //           data: forecastData,
  //           borderColor: 'rgb(14, 165, 233)',
  //           backgroundColor: 'rgba(14, 165, 233, 0.05)',
  //           borderDash: [5, 5],
  //           pointBackgroundColor: 'rgb(14, 165, 233)',
  //           pointBorderColor: '#fff',
  //           pointHoverBackgroundColor: '#fff',
  //           pointHoverBorderColor: 'rgb(14, 165, 233)',
  //           tension: 0.4,
  //           fill: true,
  //         }
  //       ]
  //     });
  //   }
  // }, [user.balance]);

  // Настройки графика баланса
  // const chartOptions = {
  //   responsive: true,
  //   maintainAspectRatio: false,
  //   plugins: {
  //     legend: {
  //       display: false
  //     },
  //     tooltip: {
  //       backgroundColor: 'rgba(0, 0, 0, 0.8)',
  //       padding: 12,
  //       titleFont: {
  //         size: 14,
  //         weight: 'bold'
  //       },
  //       bodyFont: {
  //         size: 13
  //       },
  //       callbacks: {
  //         label: function(context) {
  //           const datasetLabel = context.dataset.label || '';
  //           const value = context.parsed.y || 0;
  //           let label = `${datasetLabel}: $${value.toFixed(2)}`;
            
  //           if (datasetLabel === 'Forecast') {
  //             const change = ((value - user.balance) / user.balance * 100).toFixed(2);
  //             label += ` (${change}%)`;
  //           }
            
  //           return label;
  //         },
  //         afterLabel: function(context) {
  //           if (context.datasetIndex === 1) {
  //             return 'Projected growth based on current trends';
  //           }
  //           return null;
  //         }
  //       }
  //     }
  //   },
  //   scales: {
  //     x: {
  //       grid: {
  //         display: false
  //       }
  //     },
  //     y: {
  //       grid: {
  //         color: 'rgba(0, 0, 0, 0.05)'
  //       },
  //       ticks: {
  //         callback: function(value) {
  //           return '$' + value;
  //         }
  //       }
  //     }
  //   },
  //   interaction: {
  //     mode: 'index',
  //     intersect: false,
  //   },
  //   hover: {
  //     mode: 'index',
  //     intersect: false
  //   }
  // };

  // Данные для круговой диаграммы активов

  // const assetsChartOptions = {
  //   responsive: true,
  //   maintainAspectRatio: false,
  //   plugins: {
  //     legend: {
  //       position: 'right',
  //       labels: {
  //         boxWidth: 12,
  //         padding: 16,
  //         font: {
  //           size: 12
  //         }
  //       }
  //     },
  //     tooltip: {
  //       callbacks: {
  //         label: function(context) {
  //           const label = context.label || '';
  //           const value = context.parsed || 0;
  //           const percentage = Math.round(value);
  //           return `${label}: ${percentage}%`;
  //         }
  //       }
  //     }
  //   },
  //   cutout: '70%',
  // };

  // Данные для финансовой активности
  const financialActivity = [
    { type: 'EXPENSE', amount: 1240, description: 'Buy BTC', date: 'TODAY, 15:30' },
    { type: 'INCOME', amount: 500, description: 'Sell ETH', date: 'TODAY, 00:00' },
    { type: 'TRANSFER', amount: 100, description: 'Add balance', date: 'YESTERDAY, 00:00' },
    { type: 'INCOME', amount: 1870, description: 'Sell XMR', date: 'JUN 02, 16:15' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <ProfileSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={onLogout} 
      />

      <div className="flex-1 p-8 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {activeTab === 'profile' && (
              <UserGreeting user={user} />
            )}
          
          {activeTab === 'profile' && <ProfileTabContent user={user} />}
          
          {activeTab === 'finance' && (
            <FinanceTabContent 
              user={user}
            />
          )}

           {activeTab === 'agents' && <AgentsTabContent />}
           {activeTab === 'models' && <ModelsTabContent />}
           {activeTab === 'strategy' && <StrategyTabContent />}
           {activeTab === 'strategys' && <StrategyTable />}
           {activeTab === 'coins' && <CoinsTabContent />}

           {(activeTab === 'finance' || activeTab === 'coins') && (
              <>
                <FinancialActivity activities={financialActivity} />
                <ChatList />
              </>
            )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;