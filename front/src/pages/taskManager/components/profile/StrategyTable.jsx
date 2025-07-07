import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS,
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend
} from 'chart.js';
import { FaChartLine, FaInfoCircle, FaCoins, FaShieldAlt } from 'react-icons/fa';

// Регистрация компонентов Chart.js
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend
);

const StrategyTable = ({ strategies, onStrategyClick, onCreateNewStrategy }) => {
  const [isCreating, setIsCreating] = useState(false);
  
  const handleCreateClick = () => {
    setIsCreating(true);
    setTimeout(() => {
      setIsCreating(false);
      onCreateNewStrategy();
    }, 2000);
  };

  const getRiskLevelClass = (riskLevel) => {
    switch (riskLevel.toLowerCase()) {
      case 'низкий':
        return 'bg-green-100 text-green-800';
      case 'средний':
        return 'bg-yellow-100 text-yellow-800';
      case 'высокий':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Инвестиционные стратегии</h2>
        <button
          onClick={handleCreateClick}
          disabled={isCreating}
          className={`flex items-center px-4 py-2 rounded-lg ${
            isCreating 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700'
          } text-white transition`}
        >
          {isCreating ? (
            <>
              <div className="animate-spin h-4 w-4 border-t-2 border-white rounded-full mr-2"></div>
              Создание...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Создать стратегию
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Стратегия</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Доходность</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Риск</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Капитал</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Модель</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Агенты</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Детали</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {strategies.map((strategy) => (
              <tr 
                key={strategy.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onStrategyClick(strategy)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{strategy.name}</div>
                  <div className="text-sm text-gray-500">{strategy.description.substring(0, 40)}...</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`font-medium ${
                    strategy.returns > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {strategy.returns > 0 ? '+' : ''}{strategy.returns}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRiskLevelClass(strategy.riskLevel)}`}>
                    {strategy.riskLevel}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${strategy.initialCapital.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-indigo-600">
                    {strategy.model.name}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {strategy.agents.slice(0, 2).map(agent => (
                      <span 
                        key={agent.id} 
                        className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                      >
                        {agent.name}
                      </span>
                    ))}
                    {strategy.agents.length > 2 && (
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                        +{strategy.agents.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button className="text-indigo-600 hover:text-indigo-900">
                    <FaInfoCircle />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StrategyDetailsModal = ({ strategy, onClose, onAgentClick, onModelClick }) => {
  // Данные для графика доходности
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  const chartData = {
    labels: months.slice(0, strategy.returnsData.length),
    datasets: [
      {
        label: 'Доходность',
        data: strategy.returnsData,
        borderColor: 'rgb(79, 70, 229)',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        pointBackgroundColor: 'rgb(79, 70, 229)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(79, 70, 229)',
        tension: 0.4,
        fill: true,
      }
    ]
  };

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
            return `Доходность: ${context.parsed.y}%`;
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
            return value + '%';
          }
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{strategy.name}</h3>
              <p className="text-gray-600">{strategy.description}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <FaCoins className="text-yellow-500 mr-2" />
                    <p className="text-sm font-medium text-gray-500">Капитал</p>
                  </div>
                  <p className="mt-1 text-lg font-bold">${strategy.initialCapital.toLocaleString()}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <FaChartLine className="text-green-500 mr-2" />
                    <p className="text-sm font-medium text-gray-500">Доходность</p>
                  </div>
                  <p className={`mt-1 text-lg font-bold ${
                    strategy.returns > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {strategy.returns > 0 ? '+' : ''}{strategy.returns}%
                  </p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <FaShieldAlt className="text-blue-500 mr-2" />
                    <p className="text-sm font-medium text-gray-500">Уровень риска</p>
                  </div>
                  <p className="mt-1 text-lg font-bold">{strategy.riskLevel}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-500">Создана</p>
                  <p className="mt-1 text-sm">{new Date(strategy.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-700 mb-3">Используемая модель</h4>
                <div 
                  className="p-3 bg-indigo-50 rounded-lg cursor-pointer hover:bg-indigo-100 transition"
                  onClick={() => onModelClick(strategy.model)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{strategy.model.name}</p>
                      <p className="text-sm text-gray-600">{strategy.model.type}</p>
                    </div>
                    <FaInfoCircle className="text-indigo-600" />
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-700 mb-3">Агенты стратегии</h4>
                <div className="space-y-3">
                  {strategy.agents.map(agent => (
                    <div 
                      key={agent.id} 
                      className="p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition"
                      onClick={() => onAgentClick(agent)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-gray-600">{agent.timeframe} • Точность: {agent.accuracy ? (agent.accuracy * 100).toFixed(1) + '%' : 'N/A'}</p>
                        </div>
                        <FaInfoCircle className="text-blue-600" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-md font-medium text-gray-700 mb-3">Доходность по месяцам</h4>
                <div className="h-64">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg mt-6">
                <h4 className="text-md font-medium text-gray-700 mb-3">Параметры стратегии</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-600">Тип стратегии:</p>
                    <p className="font-medium">{strategy.strategyType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Период ребалансировки:</p>
                    <p className="font-medium">{strategy.rebalancePeriod}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Макс. просадка:</p>
                    <p className="font-medium">{strategy.maxDrawdown}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Целевая доходность:</p>
                    <p className="font-medium">{strategy.targetReturn}%</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">Распределение активов:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(strategy.assetAllocation).map(([asset, percent]) => (
                        <span 
                          key={asset} 
                          className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded"
                        >
                          {asset}: {percent}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StrategyTabContent = () => {
  const [strategies, setStrategies] = useState([
    {
      id: 1,
      name: "Консервативная BTC",
      description: "Стратегия для долгосрочного инвестирования в BTC",
      returns: 35.2,
      riskLevel: "Низкий",
      initialCapital: 10000,
      strategyType: "Долгосрочная",
      rebalancePeriod: "Квартал",
      maxDrawdown: 15,
      targetReturn: 30,
      createdAt: "2023-01-15",
      model: {
        id: 101,
        name: "BTC Price Predictor",
        type: "OrdelModel",
        accuracy: 0.92
      },
      agents: [
        {
          id: 201,
          name: "BTC Daily Trader",
          timeframe: "1 день",
          accuracy: 0.85,
          status: "active"
        },
        {
          id: 202,
          name: "BTC Weekly Analyzer",
          timeframe: "1 неделя",
          accuracy: 0.78,
          status: "active"
        }
      ],
      assetAllocation: {
        "BTC": 70,
        "ETH": 20,
        "USDT": 10
      },
      returnsData: [1.2, 2.5, 4.1, 6.3, 8.9, 12.4, 16.2, 20.5, 25.1, 28.7, 32.0, 35.2]
    },
    {
      id: 2,
      name: "Агрессивная DeFi",
      description: "Высокорискованная стратегия для краткосрочной торговли DeFi токенами",
      returns: 68.7,
      riskLevel: "Высокий",
      initialCapital: 5000,
      strategyType: "Краткосрочная",
      rebalancePeriod: "Неделя",
      maxDrawdown: 40,
      targetReturn: 60,
      createdAt: "2023-03-22",
      model: {
        id: 102,
        name: "DeFi Volatility Model",
        type: "RiskModel",
        accuracy: 0.87
      },
      agents: [
        {
          id: 203,
          name: "DeFi Swing Trader",
          timeframe: "4 часа",
          accuracy: 0.82,
          status: "active"
        },
        {
          id: 204,
          name: "Liquidity Hunter",
          timeframe: "1 час",
          accuracy: 0.75,
          status: "active"
        }
      ],
      assetAllocation: {
        "UNI": 40,
        "AAVE": 30,
        "MKR": 20,
        "COMP": 10
      },
      returnsData: [5.3, 12.7, 18.4, 22.1, 15.8, 28.9, 35.6, 42.3, 51.7, 59.2, 64.5, 68.7]
    },
    {
      id: 3,
      name: "Сбалансированный портфель",
      description: "Диверсифицированный портфель с умеренным риском",
      returns: 24.8,
      riskLevel: "Средний",
      initialCapital: 20000,
      strategyType: "Среднесрочная",
      rebalancePeriod: "Месяц",
      maxDrawdown: 25,
      targetReturn: 25,
      createdAt: "2023-02-10",
      model: {
        id: 103,
        name: "Portfolio Balancer",
        type: "RiskModel",
        accuracy: 0.89
      },
      agents: [
        {
          id: 205,
          name: "Portfolio Manager",
          timeframe: "1 день",
          accuracy: 0.88,
          status: "active"
        },
        {
          id: 206,
          name: "Risk Controller",
          timeframe: "1 неделя",
          accuracy: 0.91,
          status: "active"
        }
      ],
      assetAllocation: {
        "BTC": 30,
        "ETH": 25,
        "USDT": 15,
        "SOL": 10,
        "DOT": 10,
        "ADA": 10
      },
      returnsData: [0.8, 1.5, 2.9, 4.2, 6.7, 9.5, 12.8, 16.4, 19.1, 21.6, 23.2, 24.8]
    }
  ]);
  
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNewStrategy = () => {
    const newStrategy = {
      id: strategies.length + 1,
      name: `Новая стратегия ${strategies.length + 1}`,
      description: "Недавно созданная инвестиционная стратегия",
      returns: parseFloat((5 + Math.random() * 30).toFixed(1)),
      riskLevel: ["Низкий", "Средний", "Высокий"][Math.floor(Math.random() * 3)],
      initialCapital: Math.floor(5000 + Math.random() * 15000),
      strategyType: ["Долгосрочная", "Среднесрочная", "Краткосрочная"][Math.floor(Math.random() * 3)],
      rebalancePeriod: ["День", "Неделя", "Месяц", "Квартал"][Math.floor(Math.random() * 4)],
      maxDrawdown: Math.floor(10 + Math.random() * 30),
      targetReturn: Math.floor(20 + Math.random() * 40),
      createdAt: new Date().toISOString().split('T')[0],
      model: {
        id: 100 + strategies.length + 1,
        name: `Модель ${strategies.length + 1}`,
        type: ["OrdelModel", "RiskModel"][Math.floor(Math.random() * 2)],
        accuracy: parseFloat((0.75 + Math.random() * 0.2).toFixed(2))
      },
      agents: [
        {
          id: 200 + strategies.length + 1,
          name: `Агент ${strategies.length + 1}`,
          timeframe: `${Math.floor(1 + Math.random() * 4)} ${["час", "день", "неделя"][Math.floor(Math.random() * 3)]}`,
          accuracy: parseFloat((0.7 + Math.random() * 0.25).toFixed(2)),
          status: "active"
        }
      ],
      assetAllocation: {
        "BTC": Math.floor(20 + Math.random() * 50),
        "ETH": Math.floor(10 + Math.random() * 30),
        "USDT": Math.floor(5 + Math.random() * 15)
      },
      returnsData: Array(12).fill(0).map((_, i) => 
        parseFloat(((i + 1) * (1 + Math.random() * 3)).toFixed(1))
      )
    };
    
    setStrategies([...strategies, newStrategy]);
  };

  return (
    <div className="col-span-3">
      <StrategyTable 
        strategies={strategies} 
        onStrategyClick={setSelectedStrategy}
        onCreateNewStrategy={handleCreateNewStrategy}
      />
      
      {selectedStrategy && (
        <StrategyDetailsModal 
          strategy={selectedStrategy}
          onClose={() => setSelectedStrategy(null)}
          onAgentClick={(agent) => {
            setSelectedStrategy(null);
            setSelectedAgent(agent);
          }}
          onModelClick={(model) => {
            setSelectedStrategy(null);
            setSelectedModel(model);
          }}
        />
      )}
      
      {/* Модальное окно для агента */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedAgent.name}</h3>
                  <p className="text-gray-600">{selectedAgent.timeframe}</p>
                </div>
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Точность</p>
                    <p className="mt-1 font-medium">
                      {selectedAgent.accuracy ? (selectedAgent.accuracy * 100).toFixed(1) + '%' : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Статус</p>
                    <p className="mt-1 font-medium capitalize">
                      {selectedAgent.status === 'active' ? 'Активен' : 'Неактивен'}
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Описание</p>
                  <p className="mt-1">
                    Торговый агент для стратегии "{selectedStrategy?.name || 'неизвестной стратегии'}". 
                    Работает на {selectedAgent.timeframe} таймфрейме.
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <button 
                    onClick={() => setSelectedAgent(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно для модели */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedModel.name}</h3>
                  <p className="text-gray-600">{selectedModel.type}</p>
                </div>
                <button 
                  onClick={() => setSelectedModel(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Точность</p>
                    <p className="mt-1 font-medium">
                      {selectedModel.accuracy ? (selectedModel.accuracy * 100).toFixed(1) + '%' : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Тип</p>
                    <p className="mt-1 font-medium">
                      {selectedModel.type}
                    </p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Описание</p>
                  <p className="mt-1">
                    Модель машинного обучения, используемая в стратегии "{selectedStrategy?.name || 'неизвестной стратегии'}".
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <button 
                    onClick={() => setSelectedModel(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyTabContent;