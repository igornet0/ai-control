import React, { useState, useEffect } from 'react';
import { get_coins, get_agents } from '../../services/strategyService';
import { get_agent_types, get_available_features, train_new_agent } from '../../services/strategyService';

const TrainAgentModal = ({ isOpen, onClose, onAgentTrained }) => {
  const [newAgentName, setNewAgentName] = useState('');
  const [agentTypes, setAgentTypes] = useState([]);
  const [selectedAgentType, setSelectedAgentType] = useState('');
  const [selectedAgentTimeframe, setSelectedAgentTimeframe] = useState('5m');
  const [coins, setCoins] = useState([]);
  const [selectedCoins, setSelectedCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);

  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [features, setFeatures] = useState([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingError, setTrainingError] = useState(null);
  const [epochs, setEpochs] = useState(100);
  const [batchSize, setBatchSize] = useState(150);
  const [learningRate, setLearningRate] = useState(0.001);
  const [weightDecay, setWeightDecay] = useState(0.0001);
  const [useRandomFeatures, setUseRandomFeatures] = useState(false);

  const Timeframe = [
    {"id":1, "value": '5m'},
    {"id":2, "value": '15m'},
    {"id":3, "value": '30m'},
    {"id":4, "value": '1h'},
    {"id":5, "value": '4h'},
    {"id":6, "value": '1d'},
    {"id":7, "value": '1w'},
    {"id":8, "value": '1M'},
    {"id":9, "value": '1y'}
  ];

  const resetForm = () => {
    setNewAgentName('');
    setSelectedAgentType('');
    setSelectedAgentTimeframe('5m');
    setSelectedCoins([]);
    setFeatures([]);
    setEpochs(100);
    setBatchSize(150); // Исправлено на setBatchSize
    setLearningRate(0.001);
    setWeightDecay(0.0001);
    setTrainingError(null);
    setUseRandomFeatures(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
      const fetchData = async () => {
        try {
          const types = await get_agent_types();
          const features = await get_available_features();
          const coinsData = await get_coins(); // Добавьте эту строку
          
          setAgentTypes(types);
          setAvailableFeatures(features);
          setCoins(coinsData); // Добавьте эту строку
          setFilteredCoins(coinsData);
        } catch (err) {
          console.error('Ошибка при загрузке данных', err);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  const handleAddFeature = () => {
    setFeatures([...features, {
      id: Date.now(),
      feature: '',
      params: {}
    }]);
  };

  const handleRemoveFeature = (id) => {
    setFeatures(features.filter(f => f.id !== id));
  };

  const isAgentNews = selectedAgentType === 'AgentNews';

  const handleAgentTypeChange = (value) => {
    setSelectedAgentType(value);
    // Сбрасываем фичи при выборе AgentNews
    if (value === 'AgentNews') {
      setFeatures([]);
      setUseRandomFeatures(false);
    }
  };

  const handleFeatureChange = (id, featureName) => {
    const selectedFeature = availableFeatures.find(f => f.name === featureName);
    const defaultParams = {};
    
    if (selectedFeature) {
      selectedFeature.arguments.forEach(arg => {
        defaultParams[arg.name] = arg.name === 'period' ? 14 : 'close';
      });
    }
    
    setFeatures(features.map(f => 
      f.id === id ? { ...f, feature: featureName, params: defaultParams } : f
    ));
  };

  const handleParamChange = (id, paramName, value) => {
    setFeatures(features.map(f => 
      f.id === id ? { ...f, params: { ...f.params, [paramName]: value } } : f
    ));
  };

  const handleTrainSubmit = async () => {
    if (!newAgentName || !selectedAgentType) {
      setTrainingError('Заполните обязательные поля');
      return;
    }

    try {
      setIsTraining(true);
      setTrainingError(null);

      const agentData = {
        name: newAgentName,
        type: selectedAgentType,
        timeframe: selectedAgentTimeframe,
        train_data: {       
          epochs: epochs,
          batch_size: batchSize,
          learning_rate: learningRate,
          weight_decay: weightDecay,
        },
        RP_I: useRandomFeatures,
        features: features.map(f => ({
          id: availableFeatures.find(af => af.name === f.feature).id,
          name: f.feature,
          parameters: f.params
        })),
        coins: selectedCoins 
      };
      
      await train_new_agent(agentData);
      const data = await get_agents();
      onAgentTrained(data);
      resetForm();
    } catch (err) {
      console.error('Ошибка при обучении агента', err);
      setTrainingError(err.response.data.detail || 'Ошибка при обучении агента');
    } finally {
      setIsTraining(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">Обучение нового агента</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-grow px-6">
          {trainingError && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {trainingError}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Имя агента *
            </label>
            <input
              type="text"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="Введите уникальное имя агента"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Тип модели *
            </label>
            <select
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={selectedAgentType}
              onChange={(e) => handleAgentTypeChange(e.target.value)}
            >
              <option value="">Выберите тип модели</option>
              {agentTypes.map((type) => (
                <option key={type.id} value={type.name}>{type.name}</option>
              ))}
            </select>
          </div>

          {!isAgentNews && (
             <>
            <div className={`space-y-4 mb-6`}>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Таймфреим модели *
                </label>
                <select
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={selectedAgentTimeframe}
                  onChange={(e) => setSelectedAgentTimeframe(e.target.value)}
                >
                  <option value="">Выберите таймфреим</option>
                  {Timeframe.map((type) => (
                    <option key={type.id} value={type.value}>{type.value}</option>
                  ))}
                </select>
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Кол-во эпох
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={epochs}
                  onChange={(e) => setEpochs(e.target.value)}
                  placeholder="Введите кол-во эпох"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Размер батча
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  placeholder="Введите размер батча"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Темп обучения
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={learningRate}
                  onChange={(e) => setLearningRate(e.target.value)}
                  placeholder="Задайте темп обучения"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Коэффициент регуляризации
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={weightDecay}
                  onChange={(e) => setWeightDecay(e.target.value)}
                  placeholder="Задайте коэффициент регуляризации"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Выберите монеты *
                </label>
                
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Поиск монет..."
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    onChange={(e) => {
                      const searchTerm = e.target.value.toLowerCase();
                      const filtered = coins.filter(coin => 
                        coin.name.toLowerCase().includes(searchTerm)
                      );
                      setFilteredCoins(filtered);
                    }}
                  />
                </div>
                
                <div className="flex justify-between mb-2">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      className="text-xs bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded"
                      onClick={() => setSelectedCoins(coins.map(coin => coin.id))}
                    >
                      Выбрать все
                    </button>
                    <button
                      type="button"
                      className="text-xs bg-gray-500 hover:bg-gray-600 text-white py-1 px-2 rounded"
                      onClick={() => setSelectedCoins([])}
                    >
                      Снять выбор
                    </button>
                  </div>
                  <span className="text-sm text-gray-500">
                    Выбрано: {selectedCoins.length}
                  </span>
                </div>
              </div>
              <div className="border border-gray-200 rounded p-2 max-h-40 overflow-y-auto">
                {filteredCoins.map(coin => (
                  <div key={coin.id} className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id={`coin-${coin.id}`}
                      checked={selectedCoins.includes(coin.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCoins([...selectedCoins, coin.id]);
                        } else {
                          setSelectedCoins(selectedCoins.filter(id => id !== coin.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label 
                      htmlFor={`coin-${coin.id}`} 
                      className="ml-2 text-sm text-gray-700 flex items-center"
                    >
                      <span className="font-medium">{coin.name}</span>
                      {/* <span className="text-gray-500 ml-2">({coin.symbol})</span> */}
                    </label>
                  </div>
                ))}
              </div>
              
              {selectedCoins.length === 0 && (
                <p className="text-red-500 text-sm mt-1">Необходимо выбрать хотя бы одну монету</p>
              )}
            </div>
            </>
          )}

          {isAgentNews && (
             <>
            <div className={`space-y-4 mb-6`}>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Кол-во эпох
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={epochs}
                  onChange={(e) => setEpochs(e.target.value)}
                  placeholder="Введите кол-во эпох"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Размер батча
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value)}
                  placeholder="Введите размер батча"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Темп обучения
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={learningRate}
                  onChange={(e) => setLearningRate(e.target.value)}
                  placeholder="Задайте темп обучения"
                />
              </div>
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Коэффициент регуляризации
                </label>
                <input
                  type="number"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={weightDecay}
                  onChange={(e) => setWeightDecay(e.target.value)}
                  placeholder="Задайте коэффициент регуляризации"
                />
              </div>
            </div>
            </>
          )}
          
          {!isAgentNews && (
          <div className="border-t border-gray-200 pt-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-gray-700">Дополнительные фичи</h4>
              <div className="flex items-center space-x-4">
                {/* Добавляем переключатель Random Features */}
                <label className="flex items-center cursor-pointer">
                  <span className="mr-2 text-sm font-medium text-gray-700">Random features</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={useRandomFeatures}
                      onChange={() => setUseRandomFeatures(!useRandomFeatures)}
                    />
                    <div 
                      className={`block w-10 h-6 rounded-full ${
                        useRandomFeatures ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    ></div>
                    <div 
                      className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                        useRandomFeatures ? 'transform translate-x-4' : ''
                      }`}
                    ></div>
                  </div>
                </label>
              <button
                type="button"
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded flex items-center"
                onClick={handleAddFeature}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Добавить
              </button>
              </div>
              </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto p-1">
              {features.map((feature) => (
                <div key={feature.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="text-md font-medium text-gray-700">Фича</h5>
                    <button
                      type="button"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveFeature(feature.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="block text-gray-700 text-sm mb-2">Выберите фичу</label>

                    <select
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      value={feature.feature}
                      onChange={(e) => handleFeatureChange(feature.id, e.target.value)}
                    >
                      <option value="">Выберите фичу</option>
                      {availableFeatures.map((feat) => (
                        <option key={feat.id} value={feat.name}>
                          {feat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {feature.feature && availableFeatures.some(f => f.name === feature.feature) && (
                    <div className="mt-3">
                      <h6 className="text-sm font-medium text-gray-600 mb-2">Параметры:</h6>
                      {availableFeatures
                        .find(f => f.name === feature.feature)
                        ?.arguments?.map((arg) => (
                          <div key={arg.name} className="mb-2">
                            <label className="block text-gray-700 text-sm mb-1">
                              {arg.name} <span className="text-red-500">*</span>
                            </label>
                            
                            {arg.name === 'column' ? (
                              <select
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={feature.params[arg.name] || ''}
                                onChange={(e) => handleParamChange(feature.id, arg.name, e.target.value)}
                                required
                              >
                                <option value="">Выберите колонку</option>
                                <option value="open">open</option>
                                <option value="close">close</option>
                                <option value="max">max</option>
                                <option value="min">min</option>
                              </select>
                            ) : (
                              <input
                                type={arg.type === 'int' ? 'number' : 'text'}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                value={feature.params[arg.name] || ''}
                                onChange={(e) => handleParamChange(feature.id, arg.name, e.target.value)}
                                placeholder={`Введите ${arg.name}`}
                                required
                                min={1}
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}

              {features.length === 0 && (
                <p className="text-gray-500 text-sm italic text-center py-4">Нет добавленных фич</p>
              )}
            </div>
          </div>

          )}
        </div>
        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
              onClick={onClose}
              disabled={isTraining}
            >
              Отмена
            </button>
            <button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center"
              onClick={handleTrainSubmit}
              disabled={isTraining}
            >
              {isTraining ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Обучение...
                </>
              ) : 'Начать обучение'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainAgentModal;