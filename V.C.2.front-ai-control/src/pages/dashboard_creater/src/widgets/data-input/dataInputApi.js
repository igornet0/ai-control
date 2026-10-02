/**
 * HTTP client for data input widget — JSON only, never SQL.
 */
import api from '../../../../../services/api.js';

export async function fetchWidgetFormSchema(widgetId) {
  const res = await api.get(`/api/data/widgets/${widgetId}/schema`);
  return res.data;
}

export async function previewDataInput(widgetId, data) {
  const res = await api.post('/api/data/preview', { widget_id: widgetId, data });
  return res.data;
}

export async function insertDataInput(widgetId, data, schemaHash) {
  // Insert returns after row write; smart compile runs async on the server.
  // Keep a generous timeout only as a safety net (default api client is 10s).
  const res = await api.post(
    '/api/data/insert',
    {
      widget_id: widgetId,
      data,
      schema_hash: schemaHash || undefined,
    },
    { timeout: 30000 },
  );
  return res.data;
}

export async function suggestDataInputPrimaryKey(widgetId, field, currentValue) {
  const res = await api.post('/api/data/suggest-primary-key', {
    widget_id: widgetId,
    field,
    current_value: currentValue != null && String(currentValue).trim() !== ''
      ? String(currentValue)
      : undefined,
  });
  return res.data;
}

export async function checkDataInputPrimaryKey(widgetId, field, value) {
  const res = await api.post('/api/data/check-primary-key', {
    widget_id: widgetId,
    field,
    value: value != null && String(value).trim() !== '' ? value : null,
  });
  return res.data;
}

export async function updateDataInput(widgetId, rowId, data, version) {
  const res = await api.post('/api/data/update', {
    widget_id: widgetId,
    row_id: rowId,
    data,
    version,
  });
  return res.data;
}

export async function deleteDataInput(widgetId, rowId, version) {
  const res = await api.post('/api/data/delete', {
    widget_id: widgetId,
    row_id: rowId,
    version,
  });
  return res.data;
}

export async function uploadDataInputFile(widgetId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/api/data/upload?widget_id=${encodeURIComponent(widgetId)}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function fetchRuntimeConflicts(dashboardId, modelId) {
  const res = await api.get(
    `/api/data/dashboards/${dashboardId}/runtime-conflicts?model_id=${modelId}`,
  );
  return res.data;
}
