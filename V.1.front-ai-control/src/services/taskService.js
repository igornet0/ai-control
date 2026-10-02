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
      const response = await api.get(`/api/tasks/${id}/`);
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
      const response = await api.put(`/api/tasks/${id}/`, taskData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteTask(id) {
    try {
      await api.delete(`/api/tasks/${id}/`);
    } catch (error) {
      throw error;
    }
  },

  async submitTaskForReview(id) {
    try {
      const response = await api.post(`/api/tasks/${id}/submit-review/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async approveTaskReview(id) {
    try {
      const response = await api.post(`/api/tasks/${id}/approve-review/`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async rejectTaskReview(id) {
    try {
      const response = await api.post(`/api/tasks/${id}/reject-review/`);
      return response.data;
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

  async deleteTaskComment(taskId, commentId) {
    await api.delete(`/api/tasks/${taskId}/comments/${commentId}`);
  },

  async updateTaskComment(taskId, commentId, content) {
    const response = await api.put(`/api/tasks/${taskId}/comments/${commentId}`, { content });
    return response.data;
  },

  async setTaskCommentHidden(taskId, commentId, isHidden) {
    const response = await api.patch(`/api/tasks/${taskId}/comments/${commentId}`, {
      is_hidden: isHidden,
    });
    return response.data;
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

  async deleteTaskTimeLog(taskId, logId) {
    await api.delete(`/api/tasks/${taskId}/time-logs/${logId}`);
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
  },

  async getTaskAttachments(taskId) {
    const response = await api.get(`/api/tasks/${taskId}/attachments/`);
    return response.data;
  },

  async uploadTaskAttachments(taskId, fileList) {
    const formData = new FormData();
    Array.from(fileList).forEach((file) => {
      formData.append('files', file);
    });
    const response = await api.post(`/api/tasks/${taskId}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async linkTaskAttachment(taskId, payload) {
    const response = await api.post(`/api/tasks/${taskId}/attachments/link/`, payload);
    return response.data;
  },

  async deleteTaskAttachment(taskId, filename) {
    await api.delete(`/api/tasks/${taskId}/attachments/${encodeURIComponent(filename)}/`);
  },

  async downloadTaskAttachment(taskId, filename, originalFilename) {
    const response = await api.get(
      `/api/tasks/${taskId}/attachments/${encodeURIComponent(filename)}/`,
      { responseType: 'blob' },
    );
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', originalFilename || filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

// Export individual functions for backward compatibility
export const getTasks = () => taskService.getTasks();
export const getTask = (id) => taskService.getTask(id);
export const getTaskComments = (taskId) => taskService.getTaskComments(taskId);
export const addTaskComment = (taskId, commentData) => taskService.addTaskComment(taskId, commentData);
export const deleteTaskComment = (taskId, commentId) => taskService.deleteTaskComment(taskId, commentId);
export const updateTaskComment = (taskId, commentId, content) =>
  taskService.updateTaskComment(taskId, commentId, content);
export const setTaskCommentHidden = (taskId, commentId, isHidden) =>
  taskService.setTaskCommentHidden(taskId, commentId, isHidden);
export const getTaskTimeLogs = (taskId) => taskService.getTaskTimeLogs(taskId);
export const addTaskTimeLog = (taskId, timeLogData) => taskService.addTaskTimeLog(taskId, timeLogData);
export const deleteTaskTimeLog = (taskId, logId) => taskService.deleteTaskTimeLog(taskId, logId);
export const createTask = (taskData) => taskService.createTask(taskData);
export const deleteTask = (taskId) => taskService.deleteTask(taskId);
export const updateTask = (taskId, taskData) => taskService.updateTask(taskId, taskData);
export const submitTaskForReview = (id) => taskService.submitTaskForReview(id);
export const approveTaskReview = (id) => taskService.approveTaskReview(id);
export const rejectTaskReview = (id) => taskService.rejectTaskReview(id);
export const getTaskAttachments = (taskId) => taskService.getTaskAttachments(taskId);
export const uploadTaskAttachments = (taskId, fileList) => taskService.uploadTaskAttachments(taskId, fileList);
export const linkTaskAttachment = (taskId, payload) => taskService.linkTaskAttachment(taskId, payload);
export const deleteTaskAttachment = (taskId, filename) => taskService.deleteTaskAttachment(taskId, filename);
export const downloadTaskAttachment = (taskId, filename, originalFilename) =>
  taskService.downloadTaskAttachment(taskId, filename, originalFilename);
