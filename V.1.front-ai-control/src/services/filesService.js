import api from './api';
import { authFetch } from './http';

/**
 * Service for managing project files and attachments
 * This service handles file operations for projects including favorites
 */

/**
 * List all project files with optional filtering
 * @param {Object} params - Query parameters
 * @param {string} params.search - Search term for filename
 * @param {string} params.sortBy - Sort field (name, type, size, uploaded_at)
 * @param {string} params.sortOrder - Sort order (asc, desc)
 * @param {boolean} params.onlyMy - Show only files uploaded by current user
 * @param {number} params.limit - Maximum number of files to return
 * @returns {Promise<Object>} Object with items array and metadata
 */
export async function listProjectFiles(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.set('search', params.search);
    if (params.sortBy) queryParams.set('sort_by', params.sortBy);
    if (params.sortOrder) queryParams.set('sort_order', params.sortOrder);
    if (params.onlyMy) queryParams.set('only_my', 'true');
    if (params.limit) queryParams.set('limit', params.limit.toString());
    
    const response = await authFetch(`/api/projects/all-attachments?${queryParams.toString()}`);
    return response;
  } catch (error) {
    console.error('Error listing project files:', error);
    throw error;
  }
}

/**
 * Add a file to user's favorites
 * @param {Object} params - File parameters
 * @param {number} params.projectId - Project ID
 * @param {string} params.filename - Filename
 * @returns {Promise<Object>} Success response
 */
export async function addFileToFavorites({ projectId, filename }) {
  try {
    const response = await api.post('/api/files/favorites', {
      project_id: projectId,
      filename: filename
    });
    return response.data;
  } catch (error) {
    console.error('Error adding file to favorites:', error);
    throw error;
  }
}

/**
 * Remove a file from user's favorites
 * @param {Object} params - File parameters
 * @param {number} params.projectId - Project ID
 * @param {string} params.filename - Filename
 * @returns {Promise<Object>} Success response
 */
export async function removeFileFromFavorites({ projectId, filename }) {
  try {
    const response = await api.delete('/api/files/favorites', {
      data: {
        project_id: projectId,
        filename: filename
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error removing file from favorites:', error);
    throw error;
  }
}

/**
 * List user's favorite files
 * @param {Object} params - Query parameters
 * @param {string} params.search - Search term for filename
 * @param {string} params.sortBy - Sort field (name, type, size, added_at)
 * @param {string} params.sortOrder - Sort order (asc, desc)
 * @param {number} params.limit - Maximum number of files to return
 * @returns {Promise<Object>} Object with items array and metadata
 */
export async function listFavoriteFiles(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.search) queryParams.set('search', params.search);
    if (params.sortBy) queryParams.set('sort_by', params.sortBy);
    if (params.sortOrder) queryParams.set('sort_order', params.sortOrder);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    
    const response = await api.get(`/api/files/favorites?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error listing favorite files:', error);
    throw error;
  }
}

/**
 * Download a project file
 * @param {Object} params - File parameters
 * @param {number} params.projectId - Project ID
 * @param {string} params.filename - Filename
 * @returns {Promise<void>}
 */
export async function downloadProjectFile({ projectId, filename }) {
  try {
    const response = await api.get(`/api/projects/${projectId}/attachments/${encodeURIComponent(filename)}`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

/**
 * Upload a file to a project
 * @param {number} projectId - Project ID
 * @param {File} file - File to upload
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Upload response
 */
export async function uploadProjectFile(projectId, file, metadata = {}) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add metadata if provided
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });
    
    const response = await api.post(`/api/projects/${projectId}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Delete a project file
 * @param {number} projectId - Project ID
 * @param {string} filename - Filename
 * @returns {Promise<Object>} Success response
 */
export async function deleteProjectFile(projectId, filename) {
  try {
    const response = await api.delete(`/api/projects/${projectId}/files/${encodeURIComponent(filename)}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

/**
 * Get file metadata
 * @param {number} projectId - Project ID
 * @param {string} filename - Filename
 * @returns {Promise<Object>} File metadata
 */
export async function getFileMetadata(projectId, filename) {
  try {
    const response = await api.get(`/api/projects/${projectId}/files/${encodeURIComponent(filename)}/metadata`);
    return response.data;
  } catch (error) {
    console.error('Error getting file metadata:', error);
    throw error;
  }
}

/**
 * Update file metadata
 * @param {number} projectId - Project ID
 * @param {string} filename - Filename
 * @param {Object} metadata - New metadata
 * @returns {Promise<Object>} Updated file metadata
 */
export async function updateFileMetadata(projectId, filename, metadata) {
  try {
    const response = await api.put(`/api/projects/${projectId}/files/${encodeURIComponent(filename)}/metadata`, metadata);
    return response.data;
  } catch (error) {
    console.error('Error updating file metadata:', error);
    throw error;
  }
}

export default {
  listProjectFiles,
  addFileToFavorites,
  removeFileFromFavorites,
  listFavoriteFiles,
  downloadProjectFile,
  uploadProjectFile,
  deleteProjectFile,
  getFileMetadata,
  updateFileMetadata
};

