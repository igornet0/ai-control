import apiClient from './apiClient';

class ApiKeyService {
  async getDeveloperApiInfo() {
    const response = await apiClient.get('/api-keys/developer-info');
    return response.data;
  }

  async listApiKeys(dataModelId = null) {
    const params = dataModelId != null ? { data_model_id: dataModelId } : {};
    const response = await apiClient.get('/api-keys/', { params });
    return response.data;
  }

  async createApiKey(payload) {
    const response = await apiClient.post('/api-keys/', payload);
    return response.data;
  }

  async updateApiKey(keyId, payload) {
    const response = await apiClient.patch(`/api-keys/${keyId}`, payload);
    return response.data;
  }

  async revokeApiKey(keyId) {
    await apiClient.delete(`/api-keys/${keyId}`);
  }

  async configureIngestTable(modelId, tableName, config) {
    const response = await apiClient.post(
      `/api-keys/ingest-config/${modelId}/tables/${tableName}`,
      config
    );
    return response.data;
  }

  async resetIngestTable(modelId, tableName, { purgeSchema = false } = {}) {
    const response = await apiClient.delete(
      `/api-keys/ingest-config/${modelId}/tables/${encodeURIComponent(tableName)}`,
      { params: purgeSchema ? { purge_schema: true } : undefined },
    );
    return response.data;
  }
}

export const apiKeyService = new ApiKeyService();
export default apiKeyService;
