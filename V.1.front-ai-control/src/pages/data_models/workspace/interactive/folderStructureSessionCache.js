/**
 * In-memory folder structure cache for the current browser session.
 * Survives modal close/reopen when widget settings omit large structureCache payloads.
 */

const cacheByKey = new Map();

function sessionCacheKey(widgetId, folderData) {
  if (widgetId == null || !folderData) return '';
  const mode = folderData.isSmb ? 'smb' : 'local';
  const path = folderData.smbPath || folderData.name || '';
  return `${widgetId}::${mode}::${path}`;
}

export function getFolderSessionStructureCache(widgetId, folderData) {
  const key = sessionCacheKey(widgetId, folderData);
  if (!key) return null;
  return cacheByKey.get(key) || null;
}

export function setFolderSessionStructureCache(widgetId, folderData, cache) {
  const key = sessionCacheKey(widgetId, folderData);
  if (!key || !cache?.fingerprint) return;
  cacheByKey.set(key, cache);
}
