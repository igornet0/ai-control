import axios from 'axios';
import apiClient from './apiClient';
import { getDashboardShareContext } from './shareLinkContext';
import { getApiBaseUrl } from './apiBaseUrl';
import { getAccessToken } from './tokenRefresh';

function apiRoot() {
  return getApiBaseUrl();
}

const shareClientCache = new Map();

function shareHttp(token) {
  if (!shareClientCache.has(token)) {
    const client = axios.create({
      baseURL: `${apiRoot()}/api/public/dashboard-links/${encodeURIComponent(token)}`,
      timeout: 15000,
    });
    client.interceptors.request.use((config) => {
      const jwt = getAccessToken();
      if (jwt) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${jwt}`;
      }
      return config;
    });
    shareClientCache.set(token, client);
  }
  return shareClientCache.get(token);
}

function modelFilesClient() {
  const share = getDashboardShareContext();
  return share?.token ? shareHttp(share.token) : apiClient;
}

/** Max size for data (CSV/…) uploads. Media (video/audio) allows more. */
const MAX_MODEL_DATA_FILE_BYTES = 30 * 1024 * 1024;
const MAX_MODEL_MEDIA_FILE_BYTES = 200 * 1024 * 1024;

export const MODEL_MEDIA_ROLES = new Set(['image', 'video', 'audio', 'pdf', 'media']);

const MEDIA_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.mp4,.webm,.mov,.mkv,.mp3,.wav,.m4a,.aac,.flac,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg';

const MEDIA_EXT_RE =
  /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico|mp4|webm|ogg|ogv|mov|m4v|mkv|mp3|wav|m4a|aac|flac|oga|pdf)$/i;

/** Один POST до лимита медиа (nginx prod: 256m). Чанки — только для очень больших data-файлов. */
const CHUNK_UPLOAD_SIZE = 4 * 1024 * 1024;
const CHUNK_RETRY_ATTEMPTS = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableUploadError(error) {
  if (!error) return false;
  const status = error.response?.status;
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return false;
  }
  const code = error.code;
  return (
    !status ||
    status >= 500 ||
    status === 408 ||
    status === 429 ||
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK'
  );
}

function shouldUseChunkedUpload(file, role) {
  const normalizedRole = String(role || 'data').toLowerCase();
  if (isModelMediaRole(normalizedRole)) return false;
  const inferred = inferMediaUploadRole(file);
  if (inferred !== 'data') return false;
  return file.size > MAX_MODEL_DATA_FILE_BYTES;
}

function buildUploadFormData(file, {
  dataSchema = {},
  relativePath = null,
  widgetId = null,
  role = 'data',
} = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (dataSchema && Object.keys(dataSchema).length > 0) {
    formData.append('data_schema', JSON.stringify(dataSchema));
  }
  if (relativePath) {
    formData.append('relative_path', relativePath);
  }
  if (widgetId !== null && widgetId !== undefined) {
    formData.append('widget_id', String(widgetId));
  }
  if (role) {
    formData.append('role', role);
  }
  return formData;
}

/**
 * @param {{ name?: string, type?: string }|File} file
 * @returns {'image'|'video'|'audio'|'pdf'|'media'}
 */
export function inferMediaUploadRole(file) {
  const type = String(file?.type || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i.test(name)) {
    return 'image';
  }
  if (type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i.test(name)) {
    return 'video';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|oga)$/i.test(name)) {
    return 'audio';
  }
  if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
    return 'pdf';
  }
  return 'media';
}

/**
 * @param {{ name?: string, type?: string }|File} file
 */
export function isAllowedMediaUploadFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
    return true;
  }
  if (type === 'application/pdf') return true;
  return MEDIA_EXT_RE.test(String(file.name || ''));
}

export function isModelMediaRole(role) {
  return MODEL_MEDIA_ROLES.has(String(role || '').toLowerCase());
}

export { MEDIA_ACCEPT };

function normalizeModelFile(file) {
  if (!file) return file;
  const role = file.role || file.file_role || 'data';
  const displayName = file.original_filename || file.filename || file.name;
  const linkId = file.data_model_file_id ?? file.id;
  return {
    ...file,
    role,
    file_role: file.file_role || role,
    filename: displayName,
    original_filename: displayName,
    id: linkId,
    data_model_file_id: linkId,
  };
}

export function resolveModelFileLinkId(file) {
  if (!file) return null;
  return file.data_model_file_id ?? file.id ?? file.file_id ?? null;
}

class DataModelService {
  async getDataModels() {
    const response = await apiClient.get('/data-models/');
    return response.data;
  }

  async getPublicDataModels() {
    const response = await apiClient.get('/data-models/public');
    return response.data;
  }

  async getDataModel(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}`);
    return response.data;
  }

  async createDataModel(modelData) {
    const response = await apiClient.post('/data-models/', modelData);
    return response.data;
  }

  async updateDataModel(modelId, modelData) {
    const response = await apiClient.put(`/data-models/${modelId}`, modelData);
    return response.data;
  }

  async copyDataModel(modelId, payload = {}) {
    const response = await apiClient.post(`/data-models/${modelId}/copy`, payload);
    return response.data;
  }

  async listDataModelAccess(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}/access`);
    return response.data;
  }

  async getDataModelAccessOptions(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}/access/options`);
    return response.data;
  }

  async searchDataModelAccessUsers(modelId, q) {
    const response = await apiClient.get(`/data-models/${modelId}/access/users`, {
      params: { q },
    });
    return response.data;
  }

  async grantDataModelAccess(modelId, payload) {
    const response = await apiClient.post(`/data-models/${modelId}/access`, payload);
    return response.data;
  }

  async updateDataModelAccess(modelId, accessId, payload) {
    const response = await apiClient.patch(`/data-models/${modelId}/access/${accessId}`, payload);
    return response.data;
  }

  async revokeDataModelAccess(modelId, accessId) {
    const response = await apiClient.delete(`/data-models/${modelId}/access/${accessId}`);
    return response.data;
  }

  async deleteDataModel(modelId) {
    const response = await apiClient.delete(`/data-models/${modelId}`);
    return response.data;
  }

  async exportDataModelJson(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}/export-json`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async getModelData(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}/data`);
    return response.data;
  }

  /** Таблицы, колонки и FK из скомпилированной sqlite_db модели. */
  async getModelSqliteSchema(
    modelId,
    executionId = null,
    { includeRowCount = false, layers = null } = {},
  ) {
    const params = {};
    if (executionId) params.execution_id = executionId;
    if (includeRowCount) params.include_row_count = true;
    if (layers) params.layers = Array.isArray(layers) ? layers.join(',') : layers;
    const response = await apiClient.get(`/data-models/${modelId}/sqlite-db/schema`, { params });
    return response.data;
  }

  /** Paginated rows from latest.db (+ optional ingest source labels). */
  async getModelTableRows(modelId, tableName, { limit = 50, offset = 0, includeSource = true } = {}) {
    const response = await apiClient.get(
      `/data-models/${modelId}/tables/${encodeURIComponent(tableName)}/rows`,
      { params: { limit, offset, include_source: includeSource } },
    );
    return response.data;
  }

  async getModelTableIngestHistory(modelId, tableName, { limit = 50 } = {}) {
    const response = await apiClient.get(
      `/data-models/${modelId}/tables/${encodeURIComponent(tableName)}/ingest-history`,
      { params: { limit } },
    );
    return response.data;
  }

  async updateModelTableRow(modelId, tableName, keys, data) {
    const response = await apiClient.patch(
      `/data-models/${modelId}/tables/${encodeURIComponent(tableName)}/rows`,
      { keys, data },
    );
    return response.data;
  }

  async deleteModelTableRows(modelId, tableName, keys) {
    const response = await apiClient.delete(
      `/data-models/${modelId}/tables/${encodeURIComponent(tableName)}/rows`,
      { data: { keys } },
    );
    return response.data;
  }

  /** Unbind DataInput dashboard widgets for this model table (removes DataInput schema card). */
  async deleteDataInputSchemaTable(modelId, tableName) {
    const response = await apiClient.delete(
      `/data-models/${modelId}/schema/layers/data_input/tables/${encodeURIComponent(tableName)}`,
    );
    return response.data;
  }

  async refreshModelData(modelId) {
    const response = await apiClient.post(`/data-models/${modelId}/refresh`);
    return response.data;
  }

  async uploadModelFile(modelId, file, dataSchema = {}, onProgress = null, relativePath = null, widgetId = null, role = 'data') {
    const maxBytes = isModelMediaRole(role) ? MAX_MODEL_MEDIA_FILE_BYTES : MAX_MODEL_DATA_FILE_BYTES;
    if (file.size > maxBytes) {
      throw new Error(`Файл превышает максимальный размер ${maxBytes / (1024 * 1024)} MB`);
    }

    if (shouldUseChunkedUpload(file, role)) {
      return this.uploadModelFileChunked(
        modelId,
        file,
        CHUNK_UPLOAD_SIZE,
        dataSchema,
        onProgress,
        relativePath,
        widgetId,
        role,
      );
    }

    const formData = buildUploadFormData(file, { dataSchema, relativePath, widgetId, role });
    const config = {
      timeout: 600000,
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    };

    const response = await apiClient.post(`/data-models/${modelId}/upload`, formData, config);
    return response.data;
  }

  async uploadModelFileChunked(modelId, file, chunkSize, dataSchema = {}, onProgress = null, relativePath = null, widgetId = null, role = 'data') {
    const totalChunks = Math.ceil(file.size / chunkSize);
    let uploadedBytes = 0;
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const postChunk = async (formData) => {
      let lastError = null;
      for (let attempt = 0; attempt <= CHUNK_RETRY_ATTEMPTS; attempt += 1) {
        try {
          return await apiClient.post(`/data-models/${modelId}/upload-chunk`, formData, {
            timeout: 600000,
          });
        } catch (error) {
          lastError = error;
          if (attempt < CHUNK_RETRY_ATTEMPTS && isRetryableUploadError(error)) {
            await sleep(400 * (attempt + 1));
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    };

    try {
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('originalName', file.name);
        formData.append('originalSize', file.size.toString());
        if (file.type) {
          formData.append('originalType', file.type);
        }
        if (relativePath) {
          formData.append('relativePath', relativePath);
        }
        if (widgetId !== null && widgetId !== undefined) {
          formData.append('widgetId', String(widgetId));
        }
        if (role) {
          formData.append('role', role);
        }
        formData.append('file', chunk, `chunk_${chunkIndex}.bin`);

        await postChunk(formData);

        uploadedBytes += chunk.size;
        if (onProgress) {
          onProgress(Math.round((uploadedBytes * 100) / file.size));
        }
      }

      const finalResponse = await apiClient.post(
        `/data-models/${modelId}/upload-complete`,
        {
          uploadId,
          originalName: file.name,
          originalSize: file.size,
          data_schema: dataSchema,
          relative_path: relativePath,
          widget_id: widgetId,
          role,
        },
        { timeout: 600000 },
      );

      return finalResponse.data;
    } catch (error) {
      try {
        await apiClient.post(
          `/data-models/${modelId}/upload-cancel`,
          { uploadId },
          { timeout: 60000 },
        );
      } catch (cancelError) {
        console.warn('Failed to cancel upload:', cancelError);
      }
      throw error;
    }
  }

  async getModelFiles(modelId) {
    const response = await modelFilesClient().get(`/data-models/${modelId}/files`);
    const files = (response.data.files || []).map(normalizeModelFile);
    return { files };
  }

  async getModelFileBlob(modelId, fileOrId) {
    const fileRef = typeof fileOrId === 'object' ? fileOrId : null;
    const candidateIds = fileRef
      ? [fileRef.data_model_file_id, fileRef.id, fileRef.file_id]
      : [fileOrId];
    const uniqueIds = [...new Set(candidateIds.filter((id) => id != null).map(String))];

    if (uniqueIds.length === 0) {
      throw new Error('Не указан идентификатор файла');
    }

    let lastError = null;
    for (const id of uniqueIds) {
      for (const endpoint of ['content', 'download']) {
        try {
          const response = await modelFilesClient().get(`/data-models/${modelId}/files/${id}/${endpoint}`, {
            responseType: 'blob',
            timeout: 120000,
          });
          if (response.data && response.data.size > 0) {
            return response.data;
          }
        } catch (error) {
          lastError = error;
        }
      }
    }

    throw lastError || new Error('Не удалось загрузить файл');
  }

  async downloadModelFile(modelId, fileOrId) {
        try {
      const blob = await this.getModelFileBlob(modelId, fileOrId);
            return blob;
    } catch (error) {
      console.error('dataModelService.downloadModelFile error:', error);
      throw error;
    }
  }

  // Новые методы для расширенной функциональности

  async updateModelFormulas(modelId, formulas) {
    const response = await apiClient.put(`/data-models/${modelId}/formulas`, { formulas });
    return response.data;
  }

  async testModelFormula(modelId, expression, inputFields = []) {
    const response = await apiClient.post(`/data-models/${modelId}/formulas/test`, {
      expression,
      input_fields: inputFields
    });
    return response.data;
  }

  async updateFileRole(modelId, fileId, role, metaData = {}) {
    const response = await apiClient.put(`/data-models/${modelId}/files/${fileId}/role`, {
      role,
      meta_data: metaData
    });
    return response.data;
  }

  async deleteModelFile(modelId, fileId) {
    const response = await apiClient.delete(`/data-models/${modelId}/files/${fileId}`);
    return response.data;
  }

  async updateModelFilters(modelId, filters) {
    const response = await apiClient.put(`/data-models/${modelId}/filters`, { filters });
    return response.data;
  }

  async updateModelRelationships(modelId, relationships) {
    const response = await apiClient.put(`/data-models/${modelId}/relationships`, { relationships });
    return response.data;
  }

  async updateModelProcessingConfig(modelId, config) {
    const response = await apiClient.put(`/data-models/${modelId}/processing-config`, { config });
    return response.data;
  }

  async getModelFolderStructure(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}/folder-structure`);
    return response.data;
  }

  async createModelFolder(modelId, folderPath) {
    const response = await apiClient.post(`/data-models/${modelId}/folders`, { folder_path: folderPath });
    return response.data;
  }

  async deleteModelFolder(modelId, folderPath) {
    const response = await apiClient.delete(`/data-models/${modelId}/folders`, { 
      data: { folder_path: folderPath } 
    });
    return response.data;
  }

  async getModelImages(modelId) {
    return this.getModelMedia(modelId);
  }

  /** Files usable by the Media widget (image / video / audio / pdf / media). */
  async getModelMedia(modelId) {
    const response = await this.getModelFiles(modelId);
    return response.files.filter((file) => isModelMediaRole(file.role || file.file_role));
  }

  async getModelCode(modelId, widgetId = null) {
    const params = widgetId != null ? { widget_id: widgetId } : {};
    const response = await apiClient.get(`/data-models/${modelId}/code`, { params });
    return response.data;
  }

  async saveModelCode(modelId, codeData, incrementVersion = true, widgetId = null) {
    const body = {
      code_data: codeData,
      increment_version: incrementVersion
    };
    if (widgetId != null) body.widget_id = widgetId;
    const response = await apiClient.post(`/data-models/${modelId}/code`, body);
    return response.data;
  }

  async executeModelCode(modelId, code, files = null) {
    const payload = { code };
    if (files && files.length > 0) payload.files = files;
    const response = await apiClient.post(`/data-models/${modelId}/execute-code`, payload);
    return response.data;
  }

  async compileModel(modelId, body = {}) {
    const response = await apiClient.post(
      `/data-models/${modelId}/compile-model`,
      body,
      {
        timeout: 600000,
      }
    );
    return response.data;
  }

  /** Склеенный Datacode без выполнения (как перед вызовом движка при compile-model). */
  async previewCompileModel(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}/compile-model/preview`);
    return response.data;
  }

  // Data Model Widget methods
  async getDataModelWidgets(modelId) {
    const response = await apiClient.get(`/data-models/${modelId}/widgets`);
    return response.data;
  }

  async getDataModelWidget(modelId, widgetId) {
    const response = await apiClient.get(`/data-models/${modelId}/widgets/${widgetId}`);
    return response.data;
  }

  async createDataModelWidget(modelId, widgetData) {
    const response = await apiClient.post(`/data-models/${modelId}/widgets`, {
      data_model_id: modelId,
      ...widgetData
    });
    return response.data;
  }

  async updateDataModelWidget(modelId, widgetId, widgetData) {
    const response = await apiClient.put(`/data-models/${modelId}/widgets/${widgetId}`, widgetData);
    return response.data;
  }

  async deleteDataModelWidget(modelId, widgetId) {
    const response = await apiClient.delete(`/data-models/${modelId}/widgets/${widgetId}`);
    return response.data;
  }

  async bulkUpdateDataModelWidgets(modelId, widgets) {
        
    try {
      const response = await apiClient.put(`/data-models/${modelId}/widgets/bulk`, {
        widgets: widgets
      });
            return response.data;
    } catch (error) {
      console.error('[dataModelService] Bulk update error:', error);
      if (error.response) {
        console.error('[dataModelService] Error response:', error.response.data);
        console.error('[dataModelService] Error status:', error.response.status);
      }
      throw error;
    }
  }
}

export const dataModelService = new DataModelService();
