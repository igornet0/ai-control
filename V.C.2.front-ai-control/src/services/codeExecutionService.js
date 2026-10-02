import api from './api';
import { getAccessToken } from './tokenRefresh';
import { getApiWsOrigin } from './apiBaseUrl';

/**
 * Code Execution Service client (DataCode via CES).
 * Sync UI still uses /api/datacode/execute; this client is for async job + WS status.
 */
class CodeExecutionService {
  constructor() {
    this.websockets = new Map();
  }

  /**
   * Submit DataCode for execution.
   * @param {Object} params
   * @param {string} [params.code]
   * @param {Array} [params.tabs]
   * @param {string} [params.language='datacode']
   * @param {string} [params.executionId]
   * @param {boolean} [params.wait=false] - block until finished
   * @returns {Promise<Object>}
   */
  async executeCode({
    code,
    tabs,
    language = 'datacode',
    executionId,
    wait = false,
    files,
    timeoutSec,
  }) {
    const payload = {
      language,
      wait: Boolean(wait),
      ...(executionId && { execution_id: executionId }),
      ...(timeoutSec != null && { timeout_sec: timeoutSec }),
      ...(files && { files }),
    };

    if (code) {
      payload.code = code;
    } else if (tabs && tabs.length > 0) {
      payload.tabs = tabs.map((tab) => ({
        name: tab.name,
        content: tab.content,
      }));
    } else {
      throw new Error('Either code or tabs must be provided');
    }

    const response = await api.post('/api/code-execution/execute', payload);
    return response.data;
  }

  /**
   * Same-origin WebSocket for execution events.
   * Token is passed as ?token= for browsers that cannot set WS Authorization.
   */
  connectToExecution(executionId, callbacks = {}) {
    const token = getAccessToken() || '';
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${getApiWsOrigin()}/ws/code-execution/${executionId}${qs}`;

    if (this.websockets.has(executionId)) {
      this.websockets.get(executionId).close();
    }

    const ws = new WebSocket(wsUrl);
    this.websockets.set(executionId, ws);

    ws.onopen = () => {
      if (callbacks.onOpen) callbacks.onOpen();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (callbacks.onMessage) callbacks.onMessage(data);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      this.websockets.delete(executionId);
      if (callbacks.onClose) callbacks.onClose();
    };

    ws.onerror = (error) => {
      if (callbacks.onError) callbacks.onError(error);
    };

    return ws;
  }

  disconnectFromExecution(executionId) {
    if (this.websockets.has(executionId)) {
      this.websockets.get(executionId).close();
      this.websockets.delete(executionId);
    }
  }

  disconnectAll() {
    for (const [, ws] of this.websockets) {
      ws.close();
    }
    this.websockets.clear();
  }

  async getExecutionStatus(executionId) {
    const response = await api.get(`/api/code-execution/status/${executionId}`);
    return response.data;
  }

  async validateCode({ code, tabs, language = 'datacode' }) {
    const payload = { language };

    if (code) {
      payload.code = code;
    } else if (tabs && tabs.length > 0) {
      payload.tabs = tabs.map((tab) => ({
        name: tab.name,
        content: tab.content,
      }));
    } else {
      throw new Error('Either code or tabs must be provided');
    }

    const response = await api.post('/api/code-execution/validate', payload);
    return response.data;
  }

  async getSupportedLanguages() {
    const response = await api.get('/api/code-execution/supported-languages');
    return response.data;
  }

  async checkHealth() {
    const response = await api.get('/api/code-execution/health');
    return response.data;
  }

  static combineTabsCode(tabs) {
    if (!tabs || tabs.length === 0) return '';

    const parts = ['// Combined code from multiple tabs', ''];

    tabs.forEach((tab, index) => {
      if (tab.content && tab.content.trim()) {
        parts.push(`// === ${tab.name || `Tab ${index + 1}`} ===`);
        parts.push(tab.content.trim());
        parts.push('');
      }
    });

    return parts.join('\n');
  }

  static generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

const codeExecutionService = new CodeExecutionService();
export default codeExecutionService;
