import React, { useState, useEffect } from 'react';
import metricsService from '../../../services/metricsService';

const TeamRatings = () => {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTeamData();
  }, []);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await metricsService.getTeamRatings();
      setTeamData(response);
    } catch (err) {
      setError('Failed to load team data');
      // Fallback к заглушкам при ошибке
      setTeamData(getFallbackTeamData());
    } finally {
      setLoading(false);
    }
  };

  // Fallback данные при ошибках API
  const getFallbackTeamData = () => ({
    team_members: [
      { 
        id: 1, 
        name: "Alice Brown", 
        avatar: "https://i.pravatar.cc/32?img=1",
        rating: 4.8,
        completed_tasks: 45,
        total_tasks: 50,
        efficiency: 90,
        role: "Senior Developer"
      },
      { 
        id: 2, 
        name: "John Doe", 
        avatar: "https://i.pravatar.cc/32?img=2",
        rating: 4.6,
        completed_tasks: 38,
        total_tasks: 42,
        efficiency: 88,
        role: "Project Manager"
      },
      { 
        id: 3, 
        name: "Emily White", 
        avatar: "https://i.pravatar.cc/32?img=3",
        rating: 4.9,
        completed_tasks: 52,
        total_tasks: 55,
        efficiency: 95,
        role: "UI/UX Designer"
      },
      { 
        id: 4, 
        name: "Mike Johnson", 
        avatar: "https://i.pravatar.cc/32?img=4",
        rating: 4.4,
        completed_tasks: 32,
        total_tasks: 38,
        efficiency: 84,
        role: "QA Engineer"
      },
      { 
        id: 5, 
        name: "Sarah Wilson", 
        avatar: "https://i.pravatar.cc/32?img=5",
        rating: 4.7,
        completed_tasks: 41,
        total_tasks: 45,
        efficiency: 91,
        role: "Backend Developer"
      }
    ],
    team_stats: {
      total_members: 5,
      average_rating: 4.68,
      total_completed_tasks: 208,
      total_tasks: 230,
      overall_efficiency: 89.6
    }
  });

  if (loading) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Team Ratings</h3>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Team Ratings</h3>
        <div className="text-center text-red-400 text-sm">
          <p>{error}</p>
          <button 
            onClick={loadTeamData}
            className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!teamData || !teamData.team_members) {
    return (
      <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
        <h3 className="font-medium mb-4">Team Ratings</h3>
        <div className="text-center text-gray-400 text-sm">
          No team data available
        </div>
      </div>
    );
  }

  const { team_members, team_stats } = teamData;

  const getRatingStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-500">⭐</span>
        ))}
        {hasHalfStar && <span className="text-yellow-500">⭐</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-500">☆</span>
        ))}
      </div>
    );
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 90) return 'text-green-400';
    if (efficiency >= 80) return 'text-yellow-400';
    if (efficiency >= 70) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-[#16251C] p-4 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Team Ratings</h3>
        <button
          onClick={loadTeamData}
          className="text-xs text-gray-400 hover:text-white transition-colors"
          title="Refresh team data"
        >
          🔄
        </button>
      </div>

      {/* Общая статистика команды */}
      {team_stats && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-center">
              <div className="text-green-400 font-bold">{team_stats.average_rating.toFixed(1)}</div>
              <div className="text-gray-400">Avg Rating</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 font-bold">{team_stats.overall_efficiency.toFixed(1)}%</div>
              <div className="text-gray-400">Efficiency</div>
            </div>
          </div>
        </div>
      )}

      {/* Список членов команды */}
      <ul className="space-y-3 max-h-48 overflow-y-auto">
        {team_members.map((member) => (
          <li key={member.id} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <img 
                src={member.avatar} 
                alt={member.name} 
                className="w-8 h-8 rounded-full flex-shrink-0"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=32&background=random`;
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">
                  {member.name}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {member.role}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end space-y-1">
              <div className="text-xs">
                {getRatingStars(member.rating)}
              </div>
              <div className={`text-xs font-medium ${getEfficiencyColor(member.efficiency)}`}>
                {member.efficiency}%
              </div>
              <div className="text-xs text-gray-400">
                {member.completed_tasks}/{member.total_tasks}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Кнопка "Показать всех" если команда большая */}
      {team_members.length > 5 && (
        <div className="mt-3 text-center">
          <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            View All Team Members ({team_stats.total_members})
          </button>
        </div>
      )}

      {/* Фильтры и сортировка */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex space-x-2 text-xs">
          <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors">
            Top Rated
          </button>
          <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors">
            Most Efficient
          </button>
          <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors">
            All
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamRatings;