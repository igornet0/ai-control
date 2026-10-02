import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export function base64ToFile(base64, fileName, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, {
    type: mimeType || 'application/octet-stream',
    lastModified: Date.now(),
  });
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file);
  });
}

function readArrayBufferFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseRawRowsFromFile(file, settings = {}) {
  if (!file || !(file instanceof File)) {
    throw new Error('Файл недоступен для чтения');
  }

  const fileName = file.name || settings.selectedFile?.name || settings.sourcePath || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'csv') {
    const text = await readTextFile(file);
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data || []),
        error: reject,
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await readArrayBufferFile(file);
    const workbook = XLSX.read(new Uint8Array(buffer), {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false,
    });
    const sheetNames = workbook.SheetNames || [];
    if (!sheetNames.length) return [];
    const sheetName = settings.excelSheet || sheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return [];
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  }

  return [];
}

/**
 * Load raw sheet rows for transpose / column recompute.
 * Tries local File, SMB re-download, then model file blob.
 */
export async function loadFileRawRows(settings, deps = {}) {
  const { modelId, connectionService, dataModelService } = deps;
  const fileName = settings?.selectedFile?.name || settings?.sourcePath || '';
  if (!fileName) return [];

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (!['csv', 'xlsx', 'xls'].includes(ext)) return [];

  const localFile = settings?.selectedFile?.file;
  if (localFile instanceof File) {
    return parseRawRowsFromFile(localFile, settings);
  }

  if (settings.fileDeliveryMode === 'smb' && settings.smbConnectionId) {
    const smbPath = settings.smbSharePath || settings.selectedFile?.smbPath;
    if (smbPath && connectionService?.readConnectionFile) {
      const result = await connectionService.readConnectionFile(settings.smbConnectionId, smbPath);
      if (result?.success && result.content_base64) {
        const file = base64ToFile(
          result.content_base64,
          result.name || fileName,
          result.mime_type,
        );
        return parseRawRowsFromFile(file, settings);
      }
    }
  }

  if (modelId && dataModelService?.getModelFileBlob) {
    const uploaded = settings.selectedFile?.uploadedFile;
    if (uploaded) {
      const blob = await dataModelService.getModelFileBlob(modelId, uploaded);
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      return parseRawRowsFromFile(file, settings);
    }
  }

  return [];
}
