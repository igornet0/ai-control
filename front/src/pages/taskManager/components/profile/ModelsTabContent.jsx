import React, { useState } from 'react';
import { FaInfoCircle, FaChartLine, FaExclamationTriangle } from 'react-icons/fa';

const ModelsTabContent = () => {
  const [models, setModels] = useState([
    {
      id: 1,
      name: "BTC Price Predictor",
      type: "OrdelModel",
      status: "trained",
      accuracy: 0.92,
      lastTrained: "2023-06-10",
      description: "Predicts Bitcoin price movements based on historical data and market indicators."
    },
    {
      id: 2,
      name: "Portfolio Risk Analyzer",
      type: "RiskModel",
      status: "training",
      accuracy: null,
      lastTrained: "2023-06-14",
      description: "Analyzes portfolio risk exposure and suggests diversification strategies."
    },
    {
      id: 3,
      name: "ETH Volatility Model",
      type: "OrdelModel",
      status: "close",
      accuracy: 0.87,
      lastTrained: "2023-06-12",
      description: "Forecasts Ethereum volatility for short-term trading strategies."
    }
  ]);

  const [selectedModel, setSelectedModel] = useState(null);
  const [isTraining, setIsTraining] = useState(false);

  const handleTrainModel = () => {
    setIsTraining(true);
    
    // Симуляция процесса обучения
    setTimeout(() => {
      const newModel = {
        id: models.length + 1,
        name: `New Model ${models.length + 1}`,
        type: Math.random() > 0.5 ? "OrdelModel" : "RiskModel",
        status: "trained",
        accuracy: parseFloat((0.8 + Math.random() * 0.15).toFixed(2)),
        lastTrained: new Date().toISOString().split('T')[0],
        description: "Newly trained machine learning model for financial predictions."
      };
      
      setModels([...models, newModel]);
      setIsTraining(false);
    }, 2000);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "trained":
        return <FaChartLine className="text-green-500" />;
      case "training":
        return <div className="animate-spin h-4 w-4 border-t-2 border-blue-500 rounded-full"></div>;
      case "close":
        return <FaExclamationTriangle className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="col-span-3">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Machine Learning Models</h2>
          <button
            onClick={handleTrainModel}
            disabled={isTraining}
            className={`flex items-center px-4 py-2 rounded-lg ${
              isTraining 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white transition`}
          >
            {isTraining ? (
              <>
                <div className="animate-spin h-4 w-4 border-t-2 border-white rounded-full mr-2"></div>
                Training...
              </>
            ) : 'Train New Model'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Trained</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.map((model) => (
                <tr 
                  key={model.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedModel(model)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{model.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      model.type === "OrdelModel" 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {model.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap flex items-center">
                    {getStatusIcon(model.status)}
                    <span className="ml-2 capitalize">{model.status}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {model.accuracy ? (
                      <span className="text-indigo-600 font-medium">
                        {(model.accuracy * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {model.lastTrained}
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

      {/* Модальное окно с деталями модели */}
      {selectedModel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Status</p>
                    <div className="flex items-center mt-1">
                      {getStatusIcon(selectedModel.status)}
                      <span className="ml-2 capitalize font-medium">{selectedModel.status}</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Accuracy</p>
                    <p className="mt-1 font-medium">
                      {selectedModel.accuracy 
                        ? `${(selectedModel.accuracy * 100).toFixed(1)}%` 
                        : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-500">Last Trained</p>
                    <p className="mt-1 font-medium">{selectedModel.lastTrained}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="mt-1">{selectedModel.description}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Model Parameters</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-gray-500">Algorithm:</span>
                      <p className="font-medium">XGBoost</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Features:</span>
                      <p className="font-medium">42 input features</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Training Time:</span>
                      <p className="font-medium">2h 15m</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Dataset Size:</span>
                      <p className="font-medium">1.2M records</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    Retrain Model
                  </button>
                  <button className="px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-700">
                    Deploy to Production
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

export default ModelsTabContent;