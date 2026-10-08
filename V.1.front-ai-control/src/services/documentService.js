import api from './api';

const PREFIX = '/api/documents';

export const documentService = {
  // DocumentKind
  async getKinds() {
    const response = await api.get(`${PREFIX}/kinds/`);
    return response.data;
  },
  async getKind(id) {
    const response = await api.get(`${PREFIX}/kinds/${id}/`);
    return response.data;
  },
  async createKind(data) {
    const response = await api.post(`${PREFIX}/kinds/`, data);
    return response.data;
  },
  async updateKind(id, data) {
    const response = await api.put(`${PREFIX}/kinds/${id}/`, data);
    return response.data;
  },
  async deleteKind(id) {
    await api.delete(`${PREFIX}/kinds/${id}/`);
  },

  // DocumentStructure
  async getStructureByKindId(kindId) {
    const response = await api.get(`${PREFIX}/kinds/${kindId}/structure/`);
    return response.data;
  },
  async createStructure(data) {
    const response = await api.post(`${PREFIX}/structures/`, data);
    return response.data;
  },
  async updateStructure(id, data) {
    const response = await api.put(`${PREFIX}/structures/${id}/`, data);
    return response.data;
  },
  async deleteStructure(id) {
    await api.delete(`${PREFIX}/structures/${id}/`);
  },

  // DocumentTemplate
  async getTemplates(documentKindId = null, departmentId = null) {
    const params = {};
    if (documentKindId != null) params.document_kind_id = documentKindId;
    if (departmentId != null) params.department_id = departmentId;
    const response = await api.get(`${PREFIX}/templates/`, { params });
    return response.data;
  },
  async getTemplate(id) {
    const response = await api.get(`${PREFIX}/templates/${id}/`);
    return response.data;
  },
  async getTemplateVersion(templateId, version) {
    const response = await api.get(`${PREFIX}/templates/${templateId}/versions/${encodeURIComponent(version)}`);
    return response.data;
  },
  async getTemplateVersions(templateId) {
    const response = await api.get(`${PREFIX}/templates/${templateId}/versions/`);
    return response.data;
  },
  async createTemplate(data) {
    const response = await api.post(`${PREFIX}/templates/`, data);
    return response.data;
  },
  async updateTemplate(id, data) {
    const response = await api.put(`${PREFIX}/templates/${id}/`, data);
    return response.data;
  },
  async deleteTemplate(id) {
    await api.delete(`${PREFIX}/templates/${id}/`);
  },
  async getTemplateAccess(templateId) {
    const response = await api.get(`${PREFIX}/templates/${templateId}/access/`);
    return response.data;
  },
  async updateTemplateAccess(templateId, data) {
    const response = await api.put(`${PREFIX}/templates/${templateId}/access/`, data);
    return response.data;
  },
  async seedDefaultTemplates(force = false) {
    const response = await api.post(`${PREFIX}/templates/seed-defaults/`, undefined, {
      params: force ? { force: true } : {},
    });
    return response.data;
  },
  async seedDefaultTableTemplates(force = false) {
    const response = await api.post(`${PREFIX}/templates/seed-table-defaults/`, undefined, {
      params: force ? { force: true } : {},
    });
    return response.data;
  },

  // DocumentAutoFillRule
  async getRulesByTemplateId(templateId) {
    const response = await api.get(`${PREFIX}/templates/${templateId}/rules/`);
    return response.data;
  },
  async createRule(data) {
    const response = await api.post(`${PREFIX}/rules/`, data);
    return response.data;
  },
  async deleteRule(id) {
    await api.delete(`${PREFIX}/rules/${id}/`);
  },

  // GlobalDocumentDefault
  async getGlobalDefaults() {
    const response = await api.get(`${PREFIX}/defaults/`);
    return response.data;
  },
  async setGlobalDefault(key, data) {
    const response = await api.put(`${PREFIX}/defaults/${encodeURIComponent(key)}/`, data);
    return response.data;
  },
  async createGlobalDefault(data) {
    const response = await api.post(`${PREFIX}/defaults/`, data);
    return response.data;
  },

  // Document
  async getDocuments(documentKindId = null, projectId = null, options = {}) {
    const params = {
      skip: options.skip ?? 0,
      limit: options.limit ?? 100,
    };
    if (documentKindId != null) params.document_kind_id = documentKindId;
    if (projectId != null) params.project_id = projectId;
    if (options.departmentId != null) params.department_id = options.departmentId;
    if (options.linkedOnly) params.linked_only = true;
    if (options.onlyMy) params.only_my = true;
    if (options.search) params.search = options.search;
    if (options.folderId != null) params.folder_id = options.folderId;
    const response = await api.get(`${PREFIX}/`, { params });
    return response.data;
  },
  async getDocument(id) {
    const response = await api.get(`${PREFIX}/${id}/`);
    return response.data;
  },
  async createDocument(data) {
    const response = await api.post(`${PREFIX}/`, data);
    return response.data;
  },
  async createFromTemplate(templateId, projectId = null, departmentId = undefined, folderId = null) {
    const body = {};
    if (projectId != null) body.project_id = projectId;
    if (departmentId !== undefined) body.department_id = departmentId;
    if (folderId != null) body.folder_id = folderId;
    const response = await api.post(
      `${PREFIX}/from-template/${templateId}/`,
      Object.keys(body).length ? body : undefined,
    );
    return response.data;
  },
  async createFromDocument(documentId) {
    const response = await api.post(`${PREFIX}/from-document/${documentId}/`);
    return response.data;
  },
  async updateDocument(id, data) {
    const response = await api.put(`${PREFIX}/${id}/`, data);
    return response.data;
  },
  async deleteDocument(id) {
    await api.delete(`${PREFIX}/${id}/`);
  },
  async moveDocumentToFolder(id, folderId) {
    const response = await api.put(`${PREFIX}/${id}/folder/`, { folder_id: folderId ?? null });
    return response.data;
  },

  // Folders
  async getFolders() {
    const response = await api.get(`${PREFIX}/folders/`);
    return response.data;
  },
  async getFolderMeta() {
    const response = await api.get(`${PREFIX}/folders/meta/`);
    return response.data;
  },
  async createFolder(data) {
    const response = await api.post(`${PREFIX}/folders/`, data);
    return response.data;
  },
  async updateFolder(id, data) {
    const response = await api.patch(`${PREFIX}/folders/${id}/`, data);
    return response.data;
  },
  async deleteFolder(id) {
    await api.delete(`${PREFIX}/folders/${id}/`);
  },
  async getFolderAccess(id) {
    const response = await api.get(`${PREFIX}/folders/${id}/access/`);
    return response.data;
  },
  async updateFolderAccess(id, data) {
    const response = await api.put(`${PREFIX}/folders/${id}/access/`, data);
    return response.data;
  },
  async getFolderDocuments(folderId) {
    const response = await api.get(`${PREFIX}/`, { params: { folder_id: folderId, limit: 500 } });
    return response.data;
  },

  async getProposals(documentId, status = 'submitted') {
    const response = await api.get(`${PREFIX}/${documentId}/proposals/`, {
      params: status ? { status } : {},
    });
    return response.data;
  },

  async acceptProposal(documentId, proposalId) {
    const response = await api.post(`${PREFIX}/${documentId}/proposals/${proposalId}/accept/`);
    return response.data;
  },

  async rejectProposal(documentId, proposalId, reviewComment = null) {
    await api.post(`${PREFIX}/${documentId}/proposals/${proposalId}/reject/`, {
      review_comment: reviewComment,
    });
  },

  async getRevisions(documentId) {
    const response = await api.get(`${PREFIX}/${documentId}/revisions/`);
    return response.data;
  },

  async rollbackRevision(documentId, revisionId) {
    const response = await api.post(`${PREFIX}/${documentId}/revisions/${revisionId}/rollback/`);
    return response.data;
  },

  async dismissRevisionRollback(documentId, revisionId) {
    await api.post(`${PREFIX}/${documentId}/revisions/${revisionId}/dismiss-rollback/`);
  },
};
