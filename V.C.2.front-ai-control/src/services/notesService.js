import api from './api';

/**
 * Service for managing user notes on tasks
 * This service handles personal notes that users can add to tasks
 */

/**
 * Get the current user's note for a specific task
 * @param {number} taskId - The ID of the task
 * @param {Object} user - The current user object
 * @returns {Promise<Object|null>} The note object or null if no note exists
 */
export async function getCurrentUserNoteForTask(taskId, user) {
  try {
    const response = await api.get(`/api/tasks/${taskId}/notes/user/${user.id}`);
    return response.data;
  } catch (error) {
    // If no note exists, the API might return 404, which is expected
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create or update a user's note for a specific task
 * @param {number} taskId - The ID of the task
 * @param {string} noteText - The note content
 * @returns {Promise<Object>} The saved note object
 */
export async function createOrUpdateUserNote(taskId, noteText) {
  try {
    const response = await api.post(`/api/tasks/${taskId}/notes`, {
      content: noteText,
      is_internal: false // User notes are not internal comments
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete a user's note for a specific task
 * @param {number} taskId - The ID of the task
 * @returns {Promise<void>}
 */
export async function deleteUserNote(taskId) {
  try {
    await api.delete(`/api/tasks/${taskId}/notes/user`);
  } catch (error) {
    throw error;
  }
}

/**
 * Get all notes for a specific task (including all users)
 * @param {number} taskId - The ID of the task
 * @returns {Promise<Array>} Array of note objects
 */
export async function getTaskNotes(taskId) {
  try {
    const response = await api.get(`/api/tasks/${taskId}/notes`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Update an existing note
 * @param {number} noteId - The ID of the note
 * @param {string} noteText - The updated note content
 * @returns {Promise<Object>} The updated note object
 */
export async function updateNote(noteId, noteText) {
  try {
    const response = await api.put(`/api/notes/${noteId}`, {
      content: noteText
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Delete a specific note by ID
 * @param {number} noteId - The ID of the note
 * @returns {Promise<void>}
 */
export async function deleteNote(noteId) {
  try {
    await api.delete(`/api/notes/${noteId}`);
  } catch (error) {
    throw error;
  }
}

export default {
  getCurrentUserNoteForTask,
  createOrUpdateUserNote,
  deleteUserNote,
  getTaskNotes,
  updateNote,
  deleteNote
};

