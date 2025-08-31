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
    <div className="card animate-fadeIn">
      <div className="card-body">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-xl">📊</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-100">Обзор статусов задач</h3>
        </div>
        
        <div className="flex justify-center items-center mb-6">
          <div className="relative w-32 h-32">
            <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 36 36">
              <circle 
                className="stroke-slate-700" 
                strokeWidth="3" 
                fill="none" 
                r="16" 
                cx="18" 
                cy="18" 
              />
              <circle
                className="stroke-emerald-500 transition-all duration-1000 ease-out"
                strokeWidth="3"
                strokeDasharray={`${completedPercentage * 1.01} ${(100 - completedPercentage) * 1.01}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                fill="none"
                r="16"
                cx="18"
                cy="18"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))'
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-100">{completedPercentage}%</span>
              <span className="text-xs text-slate-400">завершено</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 transition-all duration-300 hover:bg-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></div>
              <span className="text-sm text-slate-300">Завершено</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{stats.completed}</span>
              <span className="text-xs text-slate-400">({completedPercentage}%)</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 transition-all duration-300 hover:bg-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
              <span className="text-sm text-slate-300">В работе</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{stats.inProgress}</span>
              <span className="text-xs text-slate-400">({inProgressPercentage}%)</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 transition-all duration-300 hover:bg-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-500/50"></div>
              <span className="text-sm text-slate-300">На проверке</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{stats.review}</span>
              <span className="text-xs text-slate-400">({reviewPercentage}%)</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 transition-all duration-300 hover:bg-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-slate-500 shadow-lg shadow-slate-500/50"></div>
              <span className="text-sm text-slate-300">Другие</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">{stats.other}</span>
              <span className="text-xs text-slate-400">({otherPercentage}%)</span>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="text-center">
            <span className="text-lg font-bold text-slate-100">{stats.total}</span>
            <span className="text-sm text-slate-400 ml-2">всего задач</span>
          </div>
        </div>
      </div>
    </div>
  );
}