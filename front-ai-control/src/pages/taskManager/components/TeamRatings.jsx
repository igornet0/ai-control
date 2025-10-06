import React from 'react';

export default function TeamRatings({ tasks = [], users = [] }) {
  // Демо данные для показа
  const teamMembers = [
    { id: 1, name: 'Анна Петрова', completed: 8, total: 10, efficiency: 80 },
    { id: 2, name: 'Михаил Сидоров', completed: 5, total: 7, efficiency: 71 },
    { id: 3, name: 'Елена Козлова', completed: 12, total: 15, efficiency: 80 },
    { id: 4, name: 'Алексей Иванов', completed: 3, total: 5, efficiency: 60 }
  ];

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 80) return 'text-slate-300';
    if (efficiency >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getEfficiencyBg = (efficiency) => {
    if (efficiency >= 80) return 'bg-slate-500';
    if (efficiency >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="card animate-fadeIn">
      <div className="card-body">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center">
            <span className="text-xl">👥</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-100">Производительность команды</h3>
        </div>
        
        <div className="space-y-4">
          {teamMembers.map((member, index) => (
            <div 
              key={member.id} 
              className="group p-4 rounded-xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 
                         transition-all duration-300 hover:bg-slate-700/40 hover:border-slate-600/50 
                         hover:transform hover:scale-[1.02]"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 
                                  flex items-center justify-center text-white font-semibold text-sm">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-sm font-medium text-slate-200">{member.name}</span>
                </div>
                <span className={`text-sm font-bold ${getEfficiencyColor(member.efficiency)}`}>
                  {member.efficiency}%
                </span>
              </div>
              
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-slate-400 min-w-[60px]">Прогресс:</span>
                <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${getEfficiencyBg(member.efficiency)}`}
                    style={{ 
                      width: `${member.efficiency}%`,
                      boxShadow: `0 0 10px ${member.efficiency >= 80 ? 'rgba(148, 163, 184, 0.5)' : 
                                                member.efficiency >= 60 ? 'rgba(245, 158, 11, 0.5)' : 
                                                'rgba(239, 68, 68, 0.5)'}`
                    }}
                  ></div>
                </div>
                <span className="text-xs text-slate-300 min-w-[40px]">
                  {member.completed}/{member.total}
                </span>
              </div>
              
              <div className="flex justify-between text-xs text-slate-400">
                <span>Выполнено: {member.completed}</span>
                <span>Всего: {member.total}</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <span className="block text-lg font-bold text-slate-300">
                {teamMembers.reduce((sum, m) => sum + m.completed, 0)}
              </span>
              <span className="text-xs text-slate-400">Завершено</span>
            </div>
            <div>
              <span className="block text-lg font-bold text-slate-100">
                {teamMembers.reduce((sum, m) => sum + m.total, 0)}
              </span>
              <span className="text-xs text-slate-400">Всего задач</span>
            </div>
            <div>
              <span className="block text-lg font-bold text-amber-400">
                {Math.round(teamMembers.reduce((sum, m) => sum + m.efficiency, 0) / teamMembers.length)}%
              </span>
              <span className="text-xs text-slate-400">Средняя эффективность</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}