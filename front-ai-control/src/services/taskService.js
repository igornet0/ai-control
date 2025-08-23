import api from './api';

// Получить все задачи
export const getTasks = async (filters = {}) => {
  try {
    const response = await api.get('/api/tasks/', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
};

// Получить задачу по ID
export const getTaskById = async (taskId) => {
  try {
    const response = await api.get(`/api/tasks/${taskId}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching task:', error);
    throw error;
  }
};

// Создать новую задачу
export const createTask = async (taskData) => {
  try {
    const response = await api.post('/api/tasks/', taskData);
    return response.data;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
};

// Обновить задачу
export const updateTask = async (taskId, taskData) => {
  try {
    const response = await api.put(`/api/tasks/${taskId}/`, taskData);
    return response.data;
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
};

// Удалить задачу
export const deleteTask = async (taskId) => {
  try {
    await api.delete(`/api/tasks/${taskId}/`);
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
};

// Изменить статус задачи
export const updateTaskStatus = async (taskId, status) => {
  try {
    const response = await api.patch(`/api/tasks/${taskId}/status/`, { status });
    return response.data;
  } catch (error) {
    console.error('Error updating task status:', error);
    throw error;
  }
};

// Назначить исполнителя
export const assignTask = async (taskId, executorId) => {
  try {
    const response = await api.patch(`/api/tasks/${taskId}/assign/`, { executor_id: executorId });
    return response.data;
  } catch (error) {
    console.error('Error assigning task:', error);
    throw error;
  }
};

// Получить комментарии к задаче
export const getTaskComments = async (taskId) => {
  try {
    const response = await api.get(`/api/tasks/${taskId}/comments/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching task comments:', error);
    throw error;
  }
};

// Добавить комментарий к задаче
export const addTaskComment = async (taskId, commentData) => {
  try {
    const response = await api.post(`/api/tasks/${taskId}/comments/`, commentData);
    return response.data;
  } catch (error) {
    console.error('Error adding task comment:', error);
    throw error;
  }
};

// Получить статистику задач
export const getTaskStats = async () => {
  try {
    const response = await api.get('/api/tasks/stats/');
    return response.data;
  } catch (error) {
    console.error('Error fetching task stats:', error);
    throw error;
  }
};

// Получить задачи по фильтрам
export const getTasksByFilters = async (filters) => {
  try {
    const response = await api.get('/api/tasks/filter/', { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error fetching filtered tasks:', error);
    throw error;
  }
};
