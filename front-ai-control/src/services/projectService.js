import api from './api';

export const projectService = {
  // Получить список проектов
  async getProjects(params = {}) {
    try {
      const response = await api.get('/api/projects/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  // Получить проект по ID
  async getProject(projectId) {
    try {
      const response = await api.get(`/api/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching project:', error);
      throw error;
    }
  },

  // Создать проект
  async createProject(projectData) {
    try {
      console.log('Creating project with data:', projectData);
      const response = await api.post('/api/projects/', projectData);
      console.log('Project created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  },

  // Обновить проект
  async updateProject(projectId, projectData) {
    try {
      console.log('Updating project with data:', projectData);
      const response = await api.put(`/api/projects/${projectId}`, projectData);
      console.log('Project updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  },

  // Удалить проект
  async deleteProject(projectId) {
    try {
      const response = await api.delete(`/api/projects/${projectId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  },

  // Добавить команду в проект
  async addTeamToProject(projectId, teamId, role = "development") {
    try {
      const response = await api.post(`/api/projects/${projectId}/teams`, {
        team_id: teamId,
        role: role
      });
      return response.data;
    } catch (error) {
      console.error('Error adding team to project:', error);
      throw error;
    }
  },

  // Удалить команду из проекта
  async removeTeamFromProject(projectId, teamId) {
    try {
      const response = await api.delete(`/api/projects/${projectId}/teams/${teamId}`);
      return response.data;
    } catch (error) {
      console.error('Error removing team from project:', error);
      throw error;
    }
  }
};
