import { connectionService } from '../../../../services/connectionService';

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

/** Resolve a folder entry to a File — local or lazy-loaded from SMB. */
export async function resolveFolderEntryAsFile(entry, connectionId) {
  if (entry?.file instanceof File) return entry.file;

  if (entry?.isSmb && connectionId && entry.smbPath) {
    const result = await connectionService.readConnectionFile(connectionId, entry.smbPath);
    if (!result?.success) {
      throw new Error(result?.error || `Не удалось загрузить файл ${entry.name}`);
    }
    return base64ToFile(
      result.content_base64,
      result.name || entry.name,
      result.mime_type,
    );
  }

  throw new Error(`Файл недоступен: ${entry?.name || 'unknown'}`);
}
