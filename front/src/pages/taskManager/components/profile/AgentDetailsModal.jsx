import React, { useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const AgentDetailsModal = ({ agent, onClose, onDelete, onRetrain }) => {
  const [expandedFeatureId, setExpandedFeatureId] = useState(null);

  const handleDelete = () => {
    if (window.confirm(`Вы уверены, что хотите удалить агента "${agent.name}"?`)) {
      onDelete();
      onClose();
    }
  };

  const handleRetrain = () => {
    onClose();
    onRetrain();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Детали агента: {agent.name}</h3>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Основная информация</h4>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium">{agent.id}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Тип модели:</span>
                  <span className="font-medium">{agent.type}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Версия:</span>
                  <span className="font-medium">{agent.version}</span>
                </li>
                <li className="flex justify-between">
                  <p className="text-gray-500">Статус</p>
                    <div className="flex items-center mt-1">
                      {agent.status === "train" ? (
                        <div className="animate-spin h-4 w-4 border-t-2 border-blue-500 rounded-full mr-2"></div>
                      ) : agent.status === "open" ? (
                        <FaCheckCircle className="text-green-500 mr-2" />
                      ) : (
                        <FaExclamationTriangle className="text-red-500 mr-2" />
                      )}
                      <span className="font-medium capitalize">
                        {agent.status}
                      </span>
                    </div>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Создан:</span>
                  <span className="font-medium">{new Date(agent.created).toLocaleString()}</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Производительность</h4>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600">Точность:</span>
                  <span className="font-medium">
                    {agent.accuracy ? (agent.accuracy * 100).toFixed(2) + '%' : 'N/A'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Последнее обучение:</span>
                  <span className="font-medium">
                    {agent.last_trained ? new Date(agent.last_trained).toLocaleString() : 'N/A'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Время обучения:</span>
                  <span className="font-medium">
                    {agent.training_time ? agent.training_time + ' мин' : 'N/A'}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Количество эпох:</span>
                  <span className="font-medium">{agent.epochs || 'N/A'}</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6">
            <h4 className="text-md font-medium text-gray-700 mb-2">Используемые фичи</h4>
            <div className="space-y-2">
              {agent.features && agent.features.length > 0 ? (
                agent.features.map(feature => (
                  <div 
                    key={feature.id} 
                    className="bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setExpandedFeatureId(expandedFeatureId === feature.id ? null : feature.id)}
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{feature.name}</p>
                      <svg 
                        className={`w-4 h-4 transform transition-transform ${expandedFeatureId === feature.id ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    
                    {expandedFeatureId === feature.id && (
                      <div className="mt-2 pl-4 border-l-2 border-blue-200">
                        {Object.entries(feature.parameters).map(([key, value]) => (
                          <p key={key} className="text-sm text-gray-600">
                            <span className="font-medium">{key}:</span> {value}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">Нет информации о фичах</p>
              )}
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Описание</h4>
            <p className="text-gray-600">
              {agent.description || 'Описание отсутствует'}
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Закрыть
            </button>
            <button 
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Удалить
            </button>

            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Переобучить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentDetailsModal;