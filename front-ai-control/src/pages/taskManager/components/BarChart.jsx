import React, { useState, useEffect } from 'react';
import metricsService from '../../../services/metricsService';

const BarChart = () => {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatusData();
  }, []);

  const loadStatusData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await metricsService.getStatusMetrics();
      setStatusData(response);
    } catch (err) {
      setError('Failed to load status data');
      // Fallback к заглушкам при ошибке
      setStatusData(getFallbackStatusData());
    } finally {
      setLoading(false);
    }
  };

  // Fallback данные при ошибках API
  const getFallbackStatusData = () => ({
    statuses: [
      { status: 'completed', count: 30, percentage: 30 },
      { status: 'in_progress', count: 25, percentage: 25 },
      { status: 'review', count: 20, percentage: 20 },
      { status: 'created', count: 15, percentage: 15 },
      { status: 'on_hold', count: 5, percentage: 5 },
      { status: 'blocked', count: 3, percentage: 3 },
      { status: 'cancelled', count: 2, percentage: 2 }
    ]
  });

  if (loading) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Status Distribution</h3>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Status Distribution</h3>
        <div className="text-center text-red-400 text-sm">
          <p>{error}</p>
          <button 
            onClick={loadStatusData}
            className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!statusData || !statusData.statuses) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Status Distribution</h3>
        <div className="text-center text-gray-400 text-sm">
          No status data available
        </div>
      </div>
    );
  }

  const { statuses } = statusData;
  const maxCount = Math.max(...statuses.map(s => s.count));
  const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1'];

  const getStatusLabel = (status) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusColor = (index) => {
    return colors[index % colors.length];
  };

  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Status Distribution</h3>
        <button
          onClick={loadStatusData}
          className="text-xs text-gray-400 hover:text-white transition-colors"
          title="Refresh status data"
        >
          🔄
        </button>
      </div>
      
      <div className="space-y-3">
        {statuses.map((statusItem, index) => {
          const height = maxCount > 0 ? (statusItem.count / maxCount) * 100 : 0;
          const color = getStatusColor(index);
          
          return (
            <div key={statusItem.status} className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{getStatusLabel(statusItem.status)}</span>
                  <span>{statusItem.count}</span>
                </div>
                <div className="relative">
                  <div 
                    className="rounded transition-all duration-300"
                    style={{ 
                      height: '8px', 
                      width: `${height}%`, 
                      backgroundColor: color,
                      minWidth: '8px'
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Легенда */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {statuses.slice(0, 4).map((statusItem, index) => (
            <div key={statusItem.status} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: getStatusColor(index) }}
              />
              <span className="text-gray-400 truncate">
                {getStatusLabel(statusItem.status)}
              </span>
            </div>
          ))}
        </div>
        {statuses.length > 4 && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            +{statuses.length - 4} more statuses
          </div>
        )}
      </div>

      {/* Общая статистика */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Tasks:</span>
          <span className="text-white font-medium">
            {statuses.reduce((sum, s) => sum + s.count, 0)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Active:</span>
          <span className="text-white font-medium">
            {statuses
              .filter(s => ['in_progress', 'review', 'created'].includes(s.status))
              .reduce((sum, s) => sum + s.count, 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BarChart;