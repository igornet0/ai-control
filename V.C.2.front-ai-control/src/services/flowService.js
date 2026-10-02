import apiClient from './apiClient';

class FlowService {
  async getFlows() {
    const response = await apiClient.get('/flows/');
    return response.data;
  }

  async getFlow(flowId) {
    const response = await apiClient.get(`/flows/${flowId}`);
    return response.data;
  }

  async createFlow(flowData) {
    const response = await apiClient.post('/flows/', flowData);
    return response.data;
  }

  async updateFlow(flowId, flowData) {
    const response = await apiClient.put(`/flows/${flowId}`, flowData);
    return response.data;
  }

  async deleteFlow(flowId) {
    const response = await apiClient.delete(`/flows/${flowId}`);
    return response.data;
  }

  async getFlowDashboards(flowId) {
    const response = await apiClient.get(`/flows/${flowId}/dashboards`);
    return response.data;
  }

  async publishDashboardToFlow(flowId, data) {
    const response = await apiClient.post(`/flows/${flowId}/publish`, data);
    return response.data;
  }

  async removeDashboardFromFlow(flowId, dashboardId) {
    const response = await apiClient.delete(`/flows/${flowId}/dashboards/${dashboardId}`);
    return response.data;
  }

  async getFlowMembers(flowId) {
    const response = await apiClient.get(`/flows/${flowId}/members`);
    return response.data;
  }

  async getAssignableUsers() {
    const response = await apiClient.get('/flows/assignable-users');
    return response.data;
  }

  async getAssignableOptions() {
    const response = await apiClient.get('/flows/assignable-options');
    return response.data;
  }

  async getFlowDashboardSyncStatus(flowId, dashboardId) {
    const response = await apiClient.get(`/flows/${flowId}/dashboards/${dashboardId}/sync-status`);
    return response.data;
  }

  async getFlowDashboardSnapshot(flowId, dashboardId) {
    const response = await apiClient.get(`/flows/${flowId}/dashboards/${dashboardId}/snapshot`);
    return response.data;
  }

  async updateFlowDashboardImage(flowId, dashboardId, imageUrl) {
    const response = await apiClient.put(`/flows/${flowId}/dashboards/${dashboardId}/image`, {
      image_url: imageUrl ?? null,
    });
    return response.data;
  }

  async updateFlowSheetImage(flowId, dashboardId, sheetId, imageUrl) {
    const response = await apiClient.put(
      `/flows/${flowId}/dashboards/${dashboardId}/sheets/${sheetId}/image`,
      { image_url: imageUrl ?? null },
    );
    return response.data;
  }
}

export const flowService = new FlowService();
