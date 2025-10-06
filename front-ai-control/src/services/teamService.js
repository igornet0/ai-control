import api from './api';

export const teamService = {
  // Получить список команд
  async getTeams(params = {}) {
    try {
      console.log('teamService.getTeams called with params:', params);
      const response = await api.get('/api/teams/', { params });
      console.log('teamService.getTeams response:', response);
      return response.data;
    } catch (error) {
      console.error('teamService.getTeams error:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      throw error;
    }
  },

  // Получить команду по ID
  async getTeam(teamId) {
    try {
      const response = await api.get(`/api/teams/${teamId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching team:', error);
      throw error;
    }
  },

  // Создать команду
  async createTeam(teamData) {
    try {
      console.log('Creating team with data:', teamData);
      const response = await api.post('/api/teams/', teamData);
      console.log('Team created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating team:', error);
      throw error;
    }
  },

  // Обновить команду
  async updateTeam(teamId, teamData) {
    try {
      console.log('Updating team with data:', teamData);
      const response = await api.put(`/api/teams/${teamId}`, teamData);
      console.log('Team updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating team:', error);
      throw error;
    }
  },

  // Удалить команду
  async deleteTeam(teamId) {
    try {
      const response = await api.delete(`/api/teams/${teamId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting team:', error);
      throw error;
    }
  },

  // Добавить участника в команду
  async addTeamMember(teamId, memberData) {
    try {
      const response = await api.post(`/api/teams/${teamId}/members`, memberData);
      return response.data;
    } catch (error) {
      console.error('Error adding team member:', error);
      throw error;
    }
  },

  // Удалить участника из команды
  async removeTeamMember(teamId, userId) {
    try {
      const response = await api.delete(`/api/teams/${teamId}/members/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing team member:', error);
      throw error;
    }
  },

  // Поиск пользователей для добавления в команду
  async searchUsers(search) {
    try {
      const response = await api.get('/api/teams/search/users', { params: { search } });
      return response.data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }
};
