import React, { useMemo } from 'react';

export default function BarChart({ tasks = [] }) {
  const priorityStats = useMemo(() => {
    if (!tasks.length) return { urgent: 0, critical: 0, high: 0, medium: 0, low: 0 };
    
    const urgent = tasks.filter(t => t.priority === 'urgent').length;
    const critical = tasks.filter(t => t.priority === 'critical').length;
    const high = tasks.filter(t => t.priority === 'high').length;
    const medium = tasks.filter(t => t.priority === 'medium').length;
    const low = tasks.filter(t => t.priority === 'low').length;
    
    return { urgent, critical, high, medium, low };
  }, [tasks]);

  const maxValue = Math.max(...Object.values(priorityStats));
  const maxHeight = 24; // максимальная высота в rem

  const getBarHeight = (value) => {
    if (maxValue === 0) return 0;
    return (value / maxValue) * maxHeight;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      urgent: 'bg-red-500',
      critical: 'bg-orange-500',
      high: 'bg-yellow-500',
      medium: 'bg-blue-500',
      low: 'bg-gray-400'
    };
    return colors[priority] || 'bg-gray-400';
  };

  const getPriorityGlow = (priority) => {
    const glows = {
      urgent: 'rgba(239, 68, 68, 0.4)',
      critical: 'rgba(249, 115, 22, 0.4)',
      high: 'rgba(234, 179, 8, 0.4)',
      medium: 'rgba(59, 130, 246, 0.4)',
      low: 'rgba(156, 163, 175, 0.4)'
    };
    return glows[priority] || 'rgba(156, 163, 175, 0.4)';
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      urgent: 'Срочно',
      critical: 'Критично',
      high: 'Высокий',
      medium: 'Средний',
      low: 'Низкий'
    };
    return labels[priority] || priority;
  };

  return (
    <div className="card animate-fadeIn">
      <div className="card-body">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-xl">📈</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-100">Распределение приоритетов</h3>
        </div>
        
        <div className="flex items-end justify-center gap-4 h-32 mb-6 p-4 bg-slate-800/30 rounded-xl backdrop-blur-sm border border-slate-700/50">
          {Object.entries(priorityStats).map(([priority, count], index) => (
            <div 
              key={priority} 
              className="flex flex-col items-center gap-2 group cursor-pointer"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="relative">
                <div 
                  className={`w-8 rounded-lg transition-all duration-700 ease-out hover:scale-110 ${getPriorityColor(priority)}`}
                  style={{ 
                    height: `${Math.max(getBarHeight(count), 4)}px`,
                    boxShadow: `0 0 20px ${getPriorityGlow(priority)}`
                  }}
                ></div>
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-600">
                    {count}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-300 text-center capitalize min-w-[3rem]">
                {getPriorityLabel(priority)}
              </span>
              <span className="text-xs text-slate-400">{count}</span>
            </div>
          ))}
        </div>
        
        <div className="space-y-2">
          {Object.entries(priorityStats).map(([priority, count]) => (
            <div key={priority} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getPriorityColor(priority)}`}></div>
                <span className="text-sm text-slate-300 capitalize">{getPriorityLabel(priority)}</span>
              </div>
              <span className="text-sm font-semibold text-slate-100">{count}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="text-center">
            <span className="text-lg font-bold text-slate-100">
              {Object.values(priorityStats).reduce((a, b) => a + b, 0)}
            </span>
            <span className="text-sm text-slate-400 ml-2">всего задач по приоритетам</span>
          </div>
        </div>
      </div>
    </div>
  );
}