import React, { useState, useEffect } from 'react';
import apiHealthCheck from '../utils/apiHealthCheck';
import cacheManager from '../utils/cacheManager';
import logger from '../utils/logger';

const SystemMonitor = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('health');
  const [healthStatus, setHealthStatus] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [logStats, setLogStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    
    try {
      // Загружаем статус здоровья API
      const health = await apiHealthCheck.checkAllEndpoints();
      setHealthStatus(health);
      
      // Загружаем статистику кэша
      const cache = cacheManager.getStats();
      setCacheStats(cache);
      
      // Загружаем статистику логов
      const logs = logger.getStats();
      setLogStats(logs);
      
      // Загружаем последние логи
      const recentLogs = logger.getLogs({ limit: 50 });
      setLogs(recentLogs);
      
    } catch (error) {
      setError('Failed to load system data');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'unhealthy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const exportLogs = (format) => {
    const data = logger.exportLogs(format);
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearCache = () => {
    if (window.confirm('Are you sure you want to clear all cache?')) {
      cacheManager.clear();
      loadData();
    }
  };

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      logger.clear();
      loadData();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#16251C] rounded-lg shadow-xl w-full max-w-6xl h-5/6 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">System Monitor</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-gray-700 px-6 py-2">
          <div className="flex space-x-4">
            {[
              { id: 'health', label: 'API Health', icon: '🔍' },
              { id: 'cache', label: 'Cache', icon: '💾' },
              { id: 'logs', label: 'Logs', icon: '📝' },
              { id: 'performance', label: 'Performance', icon: '⚡' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-green-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-full">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              <span className="ml-2 text-gray-400">Loading system data...</span>
            </div>
          ) : (
            <>
              {/* API Health Tab */}
              {activeTab === 'health' && healthStatus && (
                <div className="space-y-6">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-white">Overall Status</h3>
                      <div className={`text-2xl ${getHealthColor(healthStatus.overall)}`}>
                        {getHealthIcon(healthStatus.overall)} {healthStatus.overall.toUpperCase()}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {healthStatus.timestamp ? new Date(healthStatus.timestamp).toLocaleTimeString() : 'N/A'}
                        </div>
                        <div className="text-gray-400">Last Check</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {healthStatus.details?.filter(d => d.healthy).length || 0}
                        </div>
                        <div className="text-gray-400">Healthy Endpoints</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">
                          {healthStatus.details?.filter(d => !d.healthy).length || 0}
                        </div>
                        <div className="text-gray-400">Failed Endpoints</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Endpoint Details</h3>
                    {healthStatus.details?.map((endpoint, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          endpoint.healthy ? 'bg-green-900 border-green-700' : 'bg-red-900 border-red-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white">{endpoint.name}</div>
                            <div className="text-sm text-gray-300">{endpoint.method} {endpoint.path}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm ${endpoint.healthy ? 'text-green-400' : 'text-red-400'}`}>
                              {endpoint.healthy ? '✅ Healthy' : '❌ Failed'}
                            </div>
                            {endpoint.responseTime && (
                              <div className="text-xs text-gray-400">{endpoint.responseTime}ms</div>
                            )}
                          </div>
                        </div>
                        {!endpoint.healthy && endpoint.error && (
                          <div className="mt-2 text-sm text-red-300">
                            Error: {endpoint.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cache Tab */}
              {activeTab === 'cache' && cacheStats && (
                <div className="space-y-6">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-white">Cache Statistics</h3>
                      <button
                        onClick={clearCache}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                      >
                        Clear Cache
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{cacheStats.totalItems}</div>
                        <div className="text-gray-400">Total Items</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{cacheStats.hitRate}</div>
                        <div className="text-gray-400">Hit Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{cacheStats.totalSize}</div>
                        <div className="text-gray-400">Total Size</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">{cacheStats.maxSize}</div>
                        <div className="text-gray-400">Max Size</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Cache Keys</h3>
                    <div className="bg-gray-800 p-4 rounded-lg max-h-64 overflow-y-auto">
                      {cacheManager.keys().length > 0 ? (
                        <div className="space-y-2">
                          {cacheManager.keys().map((key, index) => (
                            <div key={index} className="text-sm text-gray-300 font-mono bg-gray-700 p-2 rounded">
                              {key}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center py-4">No cached items</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Logs Tab */}
              {activeTab === 'logs' && logStats && (
                <div className="space-y-6">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-white">Log Statistics</h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => exportLogs('json')}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                        >
                          Export JSON
                        </button>
                        <button
                          onClick={() => exportLogs('csv')}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={clearLogs}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                        >
                          Clear Logs
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{logStats.total}</div>
                        <div className="text-gray-400">Total Logs</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{logStats.recentErrors}</div>
                        <div className="text-gray-400">Recent Errors</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{logStats.recentWarnings}</div>
                        <div className="text-gray-400">Recent Warnings</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {Object.keys(logStats.byLevel).length}
                        </div>
                        <div className="text-gray-400">Log Levels</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Recent Logs</h3>
                    <div className="bg-gray-800 p-4 rounded-lg max-h-96 overflow-y-auto">
                      {logs.length > 0 ? (
                        <div className="space-y-2">
                          {logs.map((log, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded border-l-4 ${
                                log.level === 'ERROR' || log.level === 'CRITICAL'
                                  ? 'bg-red-900 border-red-500'
                                  : log.level === 'WARN'
                                  ? 'bg-yellow-900 border-yellow-500'
                                  : 'bg-gray-700 border-gray-500'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-medium ${
                                  log.level === 'ERROR' || log.level === 'CRITICAL'
                                    ? 'text-red-300'
                                    : log.level === 'WARN'
                                    ? 'text-yellow-300'
                                    : 'text-gray-300'
                                }`}>
                                  [{log.level}]
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatDate(log.timestamp)}
                                </span>
                              </div>
                              <div className="text-white text-sm">{log.message}</div>
                              {log.context.type && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Type: {log.context.type}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 text-center py-4">No logs available</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-white mb-4">Performance Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">
                          {performance.now().toFixed(2)}
                        </div>
                        <div className="text-gray-400">Current Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {navigator.hardwareConcurrency || 'N/A'}
                        </div>
                        <div className="text-gray-400">CPU Cores</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">
                          {navigator.deviceMemory || 'N/A'} GB
                        </div>
                        <div className="text-gray-400">Device Memory</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-white mb-4">Browser Info</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">User Agent:</span>
                        <span className="text-white truncate max-w-md">{navigator.userAgent}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Platform:</span>
                        <span className="text-white">{navigator.platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Language:</span>
                        <span className="text-white">{navigator.language}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Online:</span>
                        <span className="text-white">{navigator.onLine ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;
