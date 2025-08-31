import api from './api';

/**
 * Service for code execution functionality
 */
class CodeExecutionService {
  constructor() {
    this.baseURL = 'http://localhost:8000';
    this.websockets = new Map(); // Store active WebSocket connections
  }

  /**
   * Submit code for execution
   * @param {Object} params - Execution parameters
   * @param {string} [params.code] - Direct code to execute
   * @param {Array} [params.tabs] - Array of tab objects with name and content
   * @param {string} [params.language='python'] - Programming language
   * @param {string} [params.executionId] - Optional custom execution ID
   * @returns {Promise<Object>} Execution response with execution_id and websocket_url
   */
  async executeCode({ code, tabs, language = 'python', executionId }) {
    try {
      const payload = {
        language,
        ...(executionId && { execution_id: executionId })
      };

      // Add either direct code or tabs
      if (code) {
        payload.code = code;
      } else if (tabs && tabs.length > 0) {
        payload.tabs = tabs.map(tab => ({
          name: tab.name,
          content: tab.content
        }));
      } else {
        throw new Error('Either code or tabs must be provided');
      }

      const response = await api.post('/api/code-execution/execute', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Connect to WebSocket for real-time execution updates
   * @param {string} executionId - Execution ID to subscribe to
   * @param {Object} callbacks - Event callbacks
   * @param {Function} callbacks.onMessage - Called for each message
   * @param {Function} [callbacks.onOpen] - Called when connection opens
   * @param {Function} [callbacks.onClose] - Called when connection closes
   * @param {Function} [callbacks.onError] - Called on error
   * @returns {WebSocket} WebSocket instance
   */
  connectToExecution(executionId, callbacks = {}) {
    const wsUrl = `ws://localhost:8000/ws/code-execution/${executionId}`;
    
    // Close existing connection if any
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
      } catch (error) {
        // Handle parsing error silently
      }
    };

    ws.onclose = () => {
      if (callbacks.onClose) callbacks.onClose();
    };

    ws.onerror = (error) => {
      if (callbacks.onError) callbacks.onError(error);
    };

    return ws;
  }

  /**
   * Disconnect from a specific execution WebSocket
   * @param {string} executionId - Execution ID to disconnect from
   */
  disconnectFromExecution(executionId) {
    if (this.websockets.has(executionId)) {
      this.websockets.get(executionId).close();
      this.websockets.delete(executionId);
    }
  }

  /**
   * Disconnect from all WebSocket connections
   */
  disconnectAll() {
    for (const [executionId, ws] of this.websockets) {
      ws.close();
    }
    this.websockets.clear();
  }

  /**
   * Get execution status (basic endpoint, real-time updates via WebSocket)
   * @param {string} executionId - Execution ID
   * @returns {Promise<Object>} Status information
   */
  async getExecutionStatus(executionId) {
    try {
      const response = await api.get(`/api/code-execution/status/${executionId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate code syntax without executing
   * @param {Object} params - Validation parameters
   * @param {string} [params.code] - Direct code to validate
   * @param {Array} [params.tabs] - Array of tab objects
   * @param {string} [params.language='python'] - Programming language
   * @returns {Promise<Object>} Validation result
   */
  async validateCode({ code, tabs, language = 'python' }) {
    try {
      const payload = { language };

      if (code) {
        payload.code = code;
      } else if (tabs && tabs.length > 0) {
        payload.tabs = tabs.map(tab => ({
          name: tab.name,
          content: tab.content
        }));
      } else {
        throw new Error('Either code or tabs must be provided');
      }

      const response = await api.post('/api/code-execution/validate', payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get supported programming languages
   * @returns {Promise<Object>} List of supported languages
   */
  async getSupportedLanguages() {
    try {
      const response = await api.get('/api/code-execution/supported-languages');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check service health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await api.get('/api/code-execution/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Utility method to combine tabs into a single code string
   * @param {Array} tabs - Array of tab objects
   * @returns {string} Combined code
   */
  static combineTabsCode(tabs) {
    if (!tabs || tabs.length === 0) return '';

    const parts = ['// Combined code from multiple tabs', ''];
    
    tabs.forEach((tab, index) => {
      if (tab.content && tab.content.trim()) {
        parts.push(`// === ${tab.name || `Tab ${index + 1}`} ===`);
        parts.push(tab.content.trim());
        parts.push(''); // Empty line between tabs
      }
    });

    return parts.join('\n');
  }

  /**
   * Generate a unique execution ID
   * @returns {string} UUID-like string
   */
  static generateExecutionId() {
    return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Create and export singleton instance
const codeExecutionService = new CodeExecutionService();
export default codeExecutionService;
