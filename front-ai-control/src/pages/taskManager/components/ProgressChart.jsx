import React, { useState, useEffect } from 'react';
import metricsService from '../../../services/metricsService';

const ProgressChart = () => {
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await metricsService.getTaskProgress();
      setProgressData(response);
    } catch (err) {
      setError('Failed to load progress data');
      // Fallback к заглушкам при ошибке
      setProgressData(getFallbackProgressData());
    } finally {
      setLoading(false);
    }
  };

  // Fallback данные при ошибках API
  const getFallbackProgressData = () => ({
    total_tasks: 100,
    completed_tasks: 30,
    in_progress_tasks: 30,
    review_tasks: 20,
    other_tasks: 20,
    completion_percentage: 30,
    progress_percentage: 30,
    review_percentage: 20,
    other_percentage: 20
  });

  if (loading) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Progress</h3>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Progress</h3>
        <div className="text-center text-red-400 text-sm">
          <p>{error}</p>
          <button 
            onClick={loadProgressData}
            className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Progress</h3>
        <div className="text-center text-gray-400 text-sm">
          No progress data available
        </div>
      </div>
    );
  }

  const {
    total_tasks = 0,
    completed_tasks = 0,
    in_progress_tasks = 0,
    review_tasks = 0,
    other_tasks = 0,
    completion_percentage = 0,
    progress_percentage = 0,
    review_percentage = 0,
    other_percentage = 0
  } = progressData;

  const totalPercentage = completion_percentage + progress_percentage + review_percentage + other_percentage;
  const normalizedPercentage = totalPercentage > 0 ? completion_percentage : 0;

  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Progress</h3>
      <div className="flex justify-center items-center mb-4">
        <div className="relative w-24 h-24">
          <svg className="absolute inset-0" viewBox="0 0 36 36">
            {/* Фоновый круг */}
            <circle 
              className="text-gray-200" 
              strokeWidth="4" 
              fill="none" 
              r="16" 
              cx="18" 
              cy="18" 
            />
            {/* Прогресс круг */}
            <circle
              className="text-green-600"
              strokeWidth="4"
              strokeDasharray={`${normalizedPercentage * 1.13} 100`}
              strokeDashoffset="0"
              strokeLinecap="round"
              fill="none"
              r="16"
              cx="18"
              cy="18"
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%'
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
            {Math.round(normalizedPercentage)}%
          </div>
        </div>
      </div>
      
      {/* Статистика */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Tasks:</span>
          <span className="text-white font-medium">{total_tasks}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Completed:</span>
          <span className="text-white font-medium">{completed_tasks}</span>
        </div>
      </div>

      {/* Легенда */}
      <ul className="text-xs text-gray-500 space-y-1">
        <li className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 rounded-full bg-green-600 mr-2"></span>
            <span>Completed</span>
          </div>
          <span>{completion_percentage}%</span>
        </li>
        <li className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-600 mr-2"></span>
            <span>In Progress</span>
          </div>
          <span>{progress_percentage}%</span>
        </li>
        <li className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 rounded-full bg-gray-500 mr-2"></span>
            <span>Review</span>
          </div>
          <span>{review_percentage}%</span>
        </li>
        <li className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
            <span>Other</span>
          </div>
          <span>{other_percentage}%</span>
        </li>
      </ul>

      {/* Кнопка обновления */}
      <button
        onClick={loadProgressData}
        className="w-full mt-3 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors"
        title="Refresh progress data"
      >
        🔄 Refresh
      </button>
    </div>
  );
};

export default ProgressChart;