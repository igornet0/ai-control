import api from './api';

/**
 * Сервис для работы с пользовательскими заметками к задачам
 */

/**
 * Получить заметку пользователя к задаче
 * @param {number} taskId - ID задачи
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object|null>} Заметка или null если не найдена
 */
export const getUserNoteForTask = async (taskId, userId) => {
  try {
    const response = await api.get(`/api/tasks/${taskId}/notes/${userId}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null; // Заметка не найдена
    }
    console.error('Error fetching user note:', error);
    throw error;
  }
};

/**
 * Создать или обновить заметку пользователя к задаче
 * @param {number} taskId - ID задачи
 * @param {string} noteText - Текст заметки
 * @returns {Promise<Object>} Созданная/обновленная заметка
 */
export const createOrUpdateUserNote = async (taskId, noteText) => {
  try {
    const response = await api.post(`/api/tasks/${taskId}/notes`, {
      note_text: noteText
    });
    return response.data;
  } catch (error) {
    console.error('Error creating/updating user note:', error);
    throw error;
  }
};

/**
 * Обновить заметку пользователя к задаче
 * @param {number} taskId - ID задачи
 * @param {string} noteText - Новый текст заметки
 * @returns {Promise<Object>} Обновленная заметка
 */
export const updateUserNote = async (taskId, noteText) => {
  try {
    const response = await api.put(`/api/tasks/${taskId}/notes`, {
      note_text: noteText
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user note:', error);
    throw error;
  }
};

/**
 * Удалить заметку пользователя к задаче
 * @param {number} taskId - ID задачи
 * @returns {Promise<Object>} Результат удаления
 */
export const deleteUserNote = async (taskId) => {
  try {
    const response = await api.delete(`/api/tasks/${taskId}/notes`);
    return response.data;
  } catch (error) {
    console.error('Error deleting user note:', error);
    throw error;
  }
};

/**
 * Получить заметку текущего пользователя к задаче
 * @param {number} taskId - ID задачи
 * @param {Object} user - Объект текущего пользователя
 * @returns {Promise<Object|null>} Заметка или null если не найдена
 */
export const getCurrentUserNoteForTask = async (taskId, user) => {
  if (!user?.id) {
    throw new Error('User is required');
  }
  return getUserNoteForTask(taskId, user.id);
};

export default {
  getUserNoteForTask,
  createOrUpdateUserNote,
  updateUserNote,
  deleteUserNote,
  getCurrentUserNoteForTask,
};
