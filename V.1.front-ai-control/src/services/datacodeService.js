import api from './api';

/**
 * Service for DataCode execution functionality (sync /api/datacode facade → CES).
 * Prefer this for the standalone editor; async job/WS live in codeExecutionService.
 */
class DataCodeService {
  /**
   * Convert File object to upload format
   * @param {File} file - File object
   * @returns {Promise<Object>} Object with filename and content (text or base64)
   */
  async fileToUploadFormat(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target.result;

          const isText =
            /^[\x00-\x7F]*$/.test(text) ||
            !/[^\x00-\x7F]/.test(text) ||
            text.length === 0;

          if (
            isText &&
            file.type &&
            (file.type.startsWith('text/') ||
              file.name.endsWith('.csv') ||
              file.name.endsWith('.txt') ||
              file.name.endsWith('.json'))
          ) {
            resolve({
              filename: file.name,
              content: text,
            });
          } else {
            const reader2 = new FileReader();
            reader2.onload = (e2) => {
              const arrayBuffer = e2.target.result;
              const base64 = btoa(
                new Uint8Array(arrayBuffer).reduce(
                  (data, byte) => data + String.fromCharCode(byte),
                  ''
                )
              );
              resolve({
                filename: file.name,
                content: `base64:${base64}`,
              });
            };
            reader2.onerror = reject;
            reader2.readAsArrayBuffer(file);
          }
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Execute DataCode script (sync HTTP → CES queue).
   * @param {string} code - DataCode script to execute
   * @param {File[]} [files] - Optional array of File objects to upload before execution
   * @returns {Promise<Object>} Execution response with success, output, error, and data
   */
  async executeCode(code, files = null) {
    try {
      const payload = {
        code: code,
      };

      if (files && files.length > 0) {
        const filesToUpload = await Promise.all(
          files.map((file) => this.fileToUploadFormat(file))
        );
        payload.files = filesToUpload;
      }

      const response = await api.post('/api/datacode/execute', payload);
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Unknown error occurred';
      throw new Error(errorMessage);
    }
  }

  /**
   * Connect to allowlisted SMB via stored connection_id.
   * @param {number|Object} connectionIdOrConfig - connection_id or {connection_id}
   * @returns {Promise<Object>} Connection response
   */
  async connectToSMB(connectionIdOrConfig) {
    const connection_id =
      typeof connectionIdOrConfig === 'number'
        ? connectionIdOrConfig
        : connectionIdOrConfig?.connection_id;
    if (connection_id == null) {
      throw new Error(
        'connection_id is required (raw SMB credentials are not allowed)'
      );
    }
    try {
      const response = await api.post('/api/datacode/smb/connect', {
        connection_id,
      });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Unknown error occurred';
      throw new Error(errorMessage);
    }
  }

  /**
   * Execute DataCode. Raw smb_config is rejected by the API.
   * @param {string} code - DataCode script to execute
   * @returns {Promise<Object>} Execution response
   */
  async connectAndExecute(code) {
    try {
      const response = await api.post('/api/datacode/connect-and-execute', {
        code,
      });
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Unknown error occurred';
      throw new Error(errorMessage);
    }
  }
}

const datacodeService = new DataCodeService();
export default datacodeService;
