import api from './api';

export const taskService = {
  async getTasks() {
    try {
      const response = await api.get('/api/tasks/');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTask(id) {
    try {
      const response = await api.get(`/api/tasks/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async createTask(taskData) {
    try {
      const response = await api.post('/api/tasks/', taskData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateTask(id, taskData) {
    try {
      const response = await api.put(`/api/tasks/${id}`, taskData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteTask(id) {
    try {
      await api.delete(`/api/tasks/${id}`);
    } catch (error) {
      throw error;
    }
  },

  async getTaskComments(taskId) {
    try {
      const response = await api.get(`/api/tasks/${taskId}/comments`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async addTaskComment(taskId, commentData) {
    try {
      const response = await api.post(`/api/tasks/${taskId}/comments`, commentData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTaskTimeLogs(taskId) {
    try {
      const response = await api.get(`/api/tasks/${taskId}/time-logs`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async addTaskTimeLog(taskId, timeLogData) {
    try {
      const response = await api.post(`/api/tasks/${taskId}/time-logs`, timeLogData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTaskDependencies(taskId) {
    try {
      const response = await api.get(`/api/tasks/${taskId}/dependencies`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async addTaskDependency(taskId, dependencyData) {
    try {
      const response = await api.post(`/api/tasks/${taskId}/dependencies`, dependencyData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTaskWatchers(taskId) {
    try {
      const response = await api.get(`/api/tasks/${taskId}/watchers`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async addTaskWatcher(taskId, watcherData) {
    try {
      const response = await api.post(`/api/tasks/${taskId}/watchers`, watcherData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTaskLabels(taskId) {
    try {
      const response = await api.get(`/api/tasks/${taskId}/labels`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async addTaskLabel(taskId, labelData) {
    try {
      const response = await api.post(`/api/tasks/${taskId}/labels`, labelData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTaskStats() {
    try {
      const response = await api.get('/api/tasks/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTaskTemplates() {
    try {
      const response = await api.get('/api/tasks/templates');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async createTaskTemplate(templateData) {
    try {
      const response = await api.post('/api/tasks/templates', templateData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async bulkUpdateTasks(taskIds, updateData) {
    try {
      const response = await api.put('/api/tasks/bulk-update', {
        task_ids: taskIds,
        update_data: updateData
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async bulkDeleteTasks(taskIds) {
    try {
      const response = await api.delete('/api/tasks/bulk-delete', {
        data: { task_ids: taskIds }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async exportTasks(format = 'json') {
    try {
      const response = await api.get('/api/tasks/export', {
        params: { format },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async importTasks(fileData) {
    try {
      const formData = new FormData();
      formData.append('file', fileData);
      
      const response = await api.post('/api/tasks/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTasksForDashboard(dashboardId) {
    try {
      const response = await api.get(`/api/dashboards/${dashboardId}/tasks`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTaskProgress(taskId) {
    try {
      const response = await api.get(`/api/tasks/${taskId}/progress`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTeamRatings() {
    try {
      const response = await api.get('/api/tasks/team-ratings');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
