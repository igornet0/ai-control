import api from './api';

/** Тарифные планы (только редакция V.1). */
export const billingService = {
  async getMe() {
    const response = await api.get('/api/billing/me');
    return response.data;
  },

  async getPlans() {
    const response = await api.get('/api/billing/plans');
    return response.data;
  },

  /** Витрина тарифов для /pricing — без авторизации. */
  async getPublicPlans() {
    const response = await api.get('/api/billing/public/plans');
    return response.data;
  },

  /** period: 'month' | 'year' */
  async checkout(planId, period = 'month') {
    const response = await api.post('/api/billing/checkout', { plan_id: planId, period });
    return response.data;
  },

  /** Подтверждение оплаты в тестовом режиме (без платёжного шлюза). */
  async confirmTestPayment(paymentId) {
    const response = await api.post(`/api/billing/payments/${paymentId}/confirm`);
    return response.data;
  },

  async getMyPayments() {
    const response = await api.get('/api/billing/payments');
    return response.data?.payments || [];
  },

  /** Оформить тариф: checkout и, в тестовом режиме, сразу подтверждение. */
  async purchase(planId, period = 'month') {
    const { payment, test_mode: testMode } = await this.checkout(planId, period);
    if (!testMode) return { payment, pending: true };
    const result = await this.confirmTestPayment(payment.id);
    return { ...result, pending: false };
  },

  /** Заявка на индивидуальный бизнес-план. */
  async createCustomRequest(data) {
    const response = await api.post('/api/billing/custom-requests', data);
    return response.data;
  },

  async getMyCustomRequests() {
    const response = await api.get('/api/billing/custom-requests');
    return response.data?.items || [];
  },

  // ── Админка ──

  async adminGetPlans() {
    const response = await api.get('/api/billing/admin/plans');
    return response.data;
  },

  async adminCreatePlan(data) {
    const response = await api.post('/api/billing/admin/plans', data);
    return response.data;
  },

  async adminUpdatePlan(id, data) {
    const response = await api.patch(`/api/billing/admin/plans/${id}`, data);
    return response.data;
  },

  async adminDeletePlan(id) {
    await api.delete(`/api/billing/admin/plans/${id}`);
  },

  async adminGetSubscriptions(search) {
    const response = await api.get('/api/billing/admin/subscriptions', {
      params: search ? { search } : {},
    });
    return response.data?.items || [];
  },

  async adminAssignPlan(userId, planId, days) {
    const response = await api.post('/api/billing/admin/assign', {
      user_id: userId,
      plan_id: planId,
      days: days || null,
    });
    return response.data;
  },

  async adminGetPayments() {
    const response = await api.get('/api/billing/admin/payments');
    return response.data?.payments || [];
  },

  async adminGetCustomRequests(status) {
    const response = await api.get('/api/billing/admin/custom-requests', {
      params: status ? { status } : {},
    });
    return response.data?.items || [];
  },

  async adminUpdateCustomRequest(id, data) {
    const response = await api.patch(`/api/billing/admin/custom-requests/${id}`, data);
    return response.data;
  },

  async adminMarkPaid(paymentId) {
    const response = await api.post(`/api/billing/admin/payments/${paymentId}/mark-paid`);
    return response.data;
  },
};

/** Текст ошибки API (в т.ч. 402 plan_limit / plan_feature). */
export function billingErrorMessage(err, fallback = 'Ошибка запроса') {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg).filter(Boolean).join('; ') || fallback;
  if (detail.code === 'plan_limit' && detail.limit != null) {
    return `${detail.message} (${detail.used ?? 0} из ${detail.limit})`;
  }
  return detail.message || fallback;
}
