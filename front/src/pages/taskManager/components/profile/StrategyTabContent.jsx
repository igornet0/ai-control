import React, { useState, useEffect } from 'react';
import { get_coins, get_coin_time_line, get_agents } from '../../services/strategyService';
import { useNavigate } from 'react-router-dom';

const StrategyTabContent = () => {
  const [step, setStep] = useState(1);
  const [agents, setAgents] = useState([]);
  const [coins, setCoins] = useState([]);
  const [selectedCoins, setSelectedCoins] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [riskModels, setRiskModels] = useState([]);
  const [orderModels, setOrderModels] = useState([]);
  const [selectedRiskModel, setSelectedRiskModel] = useState('');
  const [selectedOrderModel, setSelectedOrderModel] = useState('');
  const [capitalPercent, setCapitalPercent] = useState(100);
  const [maxRiskPercent, setMaxRiskPercent] = useState(2);
  const [strategyName, setStrategyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Загрузка данных
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        const coinsData = await get_coins();
        setCoins(coinsData);
        
        // Загрузка агентов
        const agentsData = await get_agents(strategyStatus="open");
        setAgents(agentsData);
        
        // Загрузка моделей риска
        const riskResponse = await fetch('/api/risk_models');
        const riskData = [];
        setRiskModels(riskData);
        
        // Загрузка моделей ордеров
        const orderResponse = await fetch('/api/order_models');
        const orderData = [];
        setOrderModels(orderData);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Выбор/отмена выбора монеты
  const toggleCoinSelection = (coinId) => {
    setSelectedCoins(prev => 
      prev.includes(coinId)
        ? prev.filter(id => id !== coinId)
        : [...prev, coinId]
    );
  }

  // Выбор/отмена выбора агента
  const toggleAgentSelection = (agentId) => {
    setSelectedAgents(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  // Проверка возможности перехода к следующему шагу
  const canProceed = () => {
    switch(step) {
      case 1: return selectedCoins.length > 0;
      case 2: return selectedAgents.length > 0;
      case 3: return selectedRiskModel && selectedOrderModel;
      case 4: return strategyName.trim() !== '' && capitalPercent > 0;
      default: return false;
    }
  }

  // Создание стратегии
  const handleCreateStrategy = async () => {
    try {
      const response = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: strategyName,
          coins: selectedCoins,
          agents: selectedAgents,
          risk_model: selectedRiskModel,
          order_model: selectedOrderModel,
          capital_percent: capitalPercent,
          max_risk_percent: maxRiskPercent
        })
      });

      if (!response.ok) throw new Error('Ошибка создания стратегии');
      
      const result = await response.json();
      navigate(`/strategy/${result.id}`);
      
    } catch (err) {
      setError(err.message);
    }
  };

  // Рендеринг шага 1: Выбор монет
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-800">Шаг 1: Выберите монеты</h3>
        <button 
          onClick={() => setStep(2)}
          disabled={!canProceed()}
          className={`px-4 py-2 rounded-md font-medium ${
            canProceed() 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Продолжить →
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Изменение (24ч)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {coins.map(coin => (
              <tr 
                key={coin.id} 
                className={`cursor-pointer ${selectedCoins.includes(coin.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => toggleCoinSelection(coin.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <input 
                    type="checkbox" 
                    checked={selectedCoins.includes(coin.id)}
                    onChange={() => toggleCoinSelection(coin.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    {coin.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${coin.price_now?.toLocaleString() || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`${coin.price_change_percentage_24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {coin.price_change_percentage_24h?.toFixed(2) || 'N/A'}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-bold">Выбрано монет:</span> {selectedCoins.length}
        </p>
      </div>
    </div>
  );

  // Рендеринг шага 2: Выбор агентов
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button 
            onClick={() => setStep(1)}
            className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Назад
          </button>
          <h3 className="text-xl font-semibold text-gray-800 inline-block">Шаг 2: Выберите агентов</h3>
        </div>
        <button 
          onClick={() => setStep(3)}
          disabled={!canProceed()}
          className={`px-4 py-2 rounded-md font-medium ${
            canProceed() 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Продолжить →
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип модели</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Точность</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {agents.map(agent => (
              <tr 
                key={agent.id} 
                className={`cursor-pointer ${selectedAgents.includes(agent.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => toggleAgentSelection(agent.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <input 
                    type="checkbox" 
                    checked={selectedAgents.includes(agent.id)}
                    onChange={() => toggleAgentSelection(agent.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agent.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{agent.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {agent.accuracy ? (agent.accuracy * 100).toFixed(2) + '%' : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                     agent.active ? 'bg-green-100 text-green-800' :
                    !agent.active && agent.status != 'train' ? 'bg-red-100 text-red-800' : 
                    agent.status === 'train' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                     {agent.status === 'train' ? 'Обучается' : agent.status === 'open' ? 'Открыт' : 'Закрыт'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-bold">Выбрано агентов:</span> {selectedAgents.length}
        </p>
      </div>
    </div>
  );

  // Рендеринг шага 3: Выбор моделей
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button 
            onClick={() => setStep(2)}
            className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Назад
          </button>
          <h3 className="text-xl font-semibold text-gray-800 inline-block">Шаг 3: Выберите модели</h3>
        </div>
        <button 
          onClick={() => setStep(4)}
          disabled={!canProceed()}
          className={`px-4 py-2 rounded-md font-medium ${
            canProceed() 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Продолжить →
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-50 p-6 rounded-2xl">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Модель управления рисками</h4>
          <div className="space-y-4">
            {riskModels.map(model => (
              <div 
                key={model.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                  selectedRiskModel === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedRiskModel(model.id)}
              >
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full border mr-3 ${
                    selectedRiskModel === model.id
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-400'
                  }`}></div>
                  <div>
                    <h5 className="font-medium text-gray-800">{model.name}</h5>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-gray-50 p-6 rounded-2xl">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Модель исполнения ордеров</h4>
          <div className="space-y-4">
            {orderModels.map(model => (
              <div 
                key={model.id}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                  selectedOrderModel === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedOrderModel(model.id)}
              >
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full border mr-3 ${
                    selectedOrderModel === model.id
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-400'
                  }`}></div>
                  <div>
                    <h5 className="font-medium text-gray-800">{model.name}</h5>
                    <p className="text-sm text-gray-600 mt-1">{model.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded-lg flex justify-between">
        <p className="text-sm text-blue-800">
          <span className="font-bold">Модель рисков:</span> {selectedRiskModel ? riskModels.find(m => m.id === selectedRiskModel)?.name : 'Не выбрана'}
        </p>
        <p className="text-sm text-blue-800">
          <span className="font-bold">Модель ордеров:</span> {selectedOrderModel ? orderModels.find(m => m.id === selectedOrderModel)?.name : 'Не выбрана'}
        </p>
      </div>
    </div>
  );

  // Рендеринг шага 4: Настройка параметров
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <button 
            onClick={() => setStep(3)}
            className="mr-4 px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ← Назад
          </button>
          <h3 className="text-xl font-semibold text-gray-800 inline-block">Шаг 4: Настройка параметров</h3>
        </div>
        <button 
          onClick={handleCreateStrategy}
          disabled={!canProceed()}
          className={`px-4 py-2 rounded-md font-medium ${
            canProceed() 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          Создать стратегию
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-6">Основные параметры</h4>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название стратегии
              </label>
              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Моя торговая стратегия"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Процент капитала для стратегии: <span className="font-bold text-blue-600">{capitalPercent}%</span>
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={capitalPercent}
                onChange={(e) => setCapitalPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1%</span>
                <span>100%</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Максимальный риск на сделку: <span className="font-bold text-blue-600">{maxRiskPercent}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={maxRiskPercent}
                onChange={(e) => setMaxRiskPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.1%</span>
                <span>10%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 p-6 rounded-2xl">
          <h4 className="text-lg font-semibold text-blue-800 mb-4">Сводка стратегии</h4>
          
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg">
              <h5 className="font-medium text-gray-800 mb-2">Выбранные монеты</h5>
              <div className="flex flex-wrap gap-2">
                {agents
                  .filter(coin => selectedCoins.includes(coin.id))
                  .map(coin => (
                    <span key={coin.id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {coin.name}
                    </span>
                  ))}
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg">
              <h5 className="font-medium text-gray-800 mb-2">Выбранные агенты</h5>
              <div className="flex flex-wrap gap-2">
                {agents
                  .filter(agent => selectedAgents.includes(agent.id))
                  .map(agent => (
                    <span key={agent.id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {agent.name}
                    </span>
                  ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg">
                <h5 className="font-medium text-gray-800 mb-1">Модель рисков</h5>
                <p className="text-sm text-gray-600">
                  {selectedRiskModel 
                    ? riskModels.find(m => m.id === selectedRiskModel)?.name 
                    : 'Не выбрана'}
                </p>
              </div>
              
              <div className="p-4 bg-white rounded-lg">
                <h5 className="font-medium text-gray-800 mb-1">Модель ордеров</h5>
                <p className="text-sm text-gray-600">
                  {selectedOrderModel 
                    ? orderModels.find(m => m.id === selectedOrderModel)?.name 
                    : 'Не выбрана'}
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-white rounded-lg">
              <h5 className="font-medium text-gray-800 mb-2">Параметры капитала</h5>
              <div className="flex justify-between">
                <div>
                  <span className="text-sm text-gray-600">Процент капитала</span>
                  <div className="font-bold text-lg text-blue-600">{capitalPercent}%</div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Макс. риск на сделку</span>
                  <div className="font-bold text-lg text-blue-600">{maxRiskPercent}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Обработка состояний загрузки и ошибок
  if (isLoading) {
    return (
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-lg p-6">
        <div className="text-red-500 text-center py-10">
          <p>Ошибка: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Рендеринг текущего шага
  return (
    <div className="lg:col-span-3">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Создание торговой стратегии</h2>
          
          <div className="flex items-center">
            <span className="text-sm text-gray-600 mr-4">Шаг {step} из 3</span>
            <div className="flex">
              {[1, 2, 3, 5].map(num => (
                <div 
                  key={num}
                  className={`w-8 h-8 rounded-full flex items-center justify-center mx-1 ${
                    step === num 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default StrategyTabContent;