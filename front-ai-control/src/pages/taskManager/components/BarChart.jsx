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

  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Priority Distribution</h3>
      <div className="flex items-end gap-2 h-24">
        {Object.entries(priorityStats).map(([priority, count]) => (
          <div key={priority} className="flex flex-col items-center">
            <div 
              className={`w-4 rounded transition-all duration-300 ${getPriorityColor(priority)}`}
              style={{ height: `${getBarHeight(count)}px` }}
            ></div>
            <span className="text-xs text-gray-400 mt-1">{count}</span>
            <span className="text-xs text-gray-500 capitalize">{priority}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-center text-xs text-gray-400">
        Total: {Object.values(priorityStats).reduce((a, b) => a + b, 0)} tasks
      </div>
    </div>
  );
}