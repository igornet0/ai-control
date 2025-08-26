import React, { useMemo } from 'react';

export default function ProgressChart({ tasks = [] }) {
  const stats = useMemo(() => {
    if (!tasks.length) return { total: 0, completed: 0, inProgress: 0, review: 0, other: 0 };
    
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const other = tasks.length - completed - inProgress - review;
    
    return {
      total: tasks.length,
      completed,
      inProgress,
      review,
      other
    };
  }, [tasks]);

  const completedPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const inProgressPercentage = stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0;
  const reviewPercentage = stats.total > 0 ? Math.round((stats.review / stats.total) * 100) : 0;
  const otherPercentage = stats.total > 0 ? Math.round((stats.other / stats.total) * 100) : 0;

  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <h3 className="font-medium mb-4">Обзор статусов задач</h3>
      <div className="flex justify-center items-center mb-4">
        <div className="relative w-24 h-24">
          <svg className="absolute inset-0" viewBox="0 0 36 36">
            <circle className="text-gray-200" strokeWidth="4" fill="none" r="16" cx="18" cy="18" />
            <circle
              className="text-green-600"
              strokeWidth="4"
              strokeDasharray={`${completedPercentage * 3.6} ${(100 - completedPercentage) * 3.6}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              fill="none"
              r="16"
              cx="18"
              cy="18"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
            {completedPercentage}%
          </div>
        </div>
      </div>
      <ul className="text-xs text-gray-500 space-y-1">
        <li><span className="inline-block w-3 h-3 rounded-full bg-green-600 mr-2" /> Завершено – {completedPercentage}% ({stats.completed})</li>
        <li><span className="inline-block w-3 h-3 rounded-full bg-blue-600 mr-2" /> В работе – {inProgressPercentage}% ({stats.inProgress})</li>
        <li><span className="inline-block w-3 h-3 rounded-full bg-yellow-600 mr-2" /> На проверке – {reviewPercentage}% ({stats.review})</li>
        <li><span className="inline-block w-3 h-3 rounded-full bg-gray-500 mr-2" /> Другие – {otherPercentage}% ({stats.other})</li>
      </ul>
      <div className="mt-3 text-center text-xs text-gray-400">
        Всего: {stats.total} задач
      </div>
    </div>
  );
}