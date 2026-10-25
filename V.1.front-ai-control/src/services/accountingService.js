import api from './api';

export const accountingService = {
  async getAccess() {
    return (await api.get('/api/accounting/access')).data;
  },
  async getSummary(params = {}) {
    return (await api.get('/api/accounting/summary', { params })).data;
  },
  async getEntries(params = {}) {
    return (await api.get('/api/accounting/entries', { params })).data;
  },
  async createEntry(data) {
    return (await api.post('/api/accounting/entries', data)).data;
  },
  async updateEntry(id, data) {
    return (await api.put(`/api/accounting/entries/${id}`, data)).data;
  },
  async deleteEntry(id) {
    await api.delete(`/api/accounting/entries/${id}`);
  },
  async getEmployees() {
    return (await api.get('/api/accounting/employees')).data;
  },
  async saveContract(userId, data) {
    return (await api.put(`/api/accounting/contracts/${userId}`, data)).data;
  },
  async calcPayroll(data) {
    return (await api.post('/api/accounting/payroll/calc', data)).data;
  },
  async getPayroll(params = {}) {
    return (await api.get('/api/accounting/payroll', { params })).data;
  },
  async createPayroll(data) {
    return (await api.post('/api/accounting/payroll', data)).data;
  },
  async deletePayroll(id) {
    await api.delete(`/api/accounting/payroll/${id}`);
  },
  async getMySalary(year) {
    return (await api.get('/api/accounting/me/salary', { params: { year } })).data;
  },
  /** Скачивает CSV-выгрузку (section: ledger | payroll). */
  async exportCsv(section = 'ledger', params = {}) {
    const response = await api.get('/api/accounting/export', {
      params: { section, ...params },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting_${section}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export function accountingErrorMessage(err, fallback = 'Ошибка запроса') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return fallback;
}

export const fmtMoney = (v) =>
  `${(Number(v) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
