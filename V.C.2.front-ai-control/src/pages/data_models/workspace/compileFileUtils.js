/** Collect compile-time local files from workspace widgets and encode for API. */

import { resolveSourcePathForSettings } from './interactive/fileSourceDataCodeSync.js';

/** SMB share name from a connection object (list items omit connection_config). */
export function getSmbShareNameFromConnection(conn) {
  if (!conn) return '';
  const cfg = conn.connection_config;
  if (cfg && typeof cfg === 'object' && cfg.share_name) {
    return String(cfg.share_name).trim();
  }
  if (conn.share_name) return String(conn.share_name).trim();
  return '';
}

let activeFileParseCount = 0;

export function beginFileParseActivity() {
  activeFileParseCount += 1;
}

export function endFileParseActivity() {
  activeFileParseCount = Math.max(0, activeFileParseCount - 1);
}

/** Wait until PropertiesPanel finishes parsing a newly selected file. */
export async function waitForFileParseIdle({ pollMs = 150, timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (activeFileParseCount > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  if (activeFileParseCount > 0) {
    console.warn('[compileFileUtils] Timed out waiting for file parse to finish');
  }
}

export function isLocalFileSourceWidget(widget) {
  const s = widget?.settings || {};
  return s.sourceType === 'file' && (s.fileDeliveryMode || 'local') === 'local';
}

export function isLocalJsonSourceWidget(widget) {
  const s = widget?.settings || {};
  return s.sourceType === 'json' && (s.jsonSourceType || 'local') === 'local';
}

export function isSmbFileSourceWidget(widget) {
  const s = widget?.settings || {};
  return s.sourceType === 'file' && s.fileDeliveryMode === 'smb';
}

export function isSmbJsonSourceWidget(widget) {
  const s = widget?.settings || {};
  return s.sourceType === 'json' && s.jsonSourceType === 'smb';
}

export function isSmbSourceWidget(widget) {
  const s = widget?.settings || {};
  return (s.sourceType === 'file' || s.sourceType === 'folder' || s.sourceType === 'archive' || s.sourceType === 'json')
    && (s.fileDeliveryMode === 'smb' || s.jsonSourceType === 'smb');
}

export function isLocalFolderSourceWidget(widget) {
  const s = widget?.settings || {};
  return s.sourceType === 'folder' && (s.fileDeliveryMode || 'local') === 'local';
}

export function isLocalArchiveSourceWidget(widget) {
  const s = widget?.settings || {};
  return s.sourceType === 'archive' && (s.fileDeliveryMode || 'local') === 'local';
}

export function isFolderLikeSourceWidget(widget) {
  const s = widget?.settings || {};
  return s.sourceType === 'folder' || s.sourceType === 'archive';
}

function getFolderLikeInventory(settings) {
  if (settings?.sourceType === 'archive') {
    return settings.selectedArchive?.files || [];
  }
  if (settings?.sourceType === 'folder') {
    return settings.selectedFolder?.files || [];
  }
  return [];
}

export function getExpectedFileName(settings) {
  return settings.selectedFile?.name || settings.sourcePath || '';
}

export function collectLocalFileRequirements(widgets) {
  const requirements = [];
  const seen = new Set();

  for (const widget of widgets || []) {
    if (isLocalFileSourceWidget(widget) || isLocalJsonSourceWidget(widget)) {
      const name = isLocalJsonSourceWidget(widget)
        ? (widget.settings?.selectedFile?.name || widget.settings?.sourcePath || '')
        : getExpectedFileName(widget.settings || {});
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const hasFile = widget.settings?.selectedFile?.file instanceof File;
      requirements.push({
        widgetId: widget.id,
        widgetName: widget.settings?.name || widget.id,
        fileName: name,
        hasFileInMemory: hasFile,
        file: hasFile ? widget.settings.selectedFile.file : null,
      });
      continue;
    }

    if (!isLocalFolderSourceWidget(widget) && widget.settings?.sourceType !== 'archive') continue;
    const settings = widget.settings || {};
    const inventory = getFolderLikeInventory(settings);
    const folderConfig = settings.folderConfig;
    const pathsNeeded = new Set();

    if (folderConfig?.groups?.length) {
      for (const group of folderConfig.groups) {
        for (const file of group.files || []) {
          const key = file.path || file.relativePath || file.name || '';
          if (key) pathsNeeded.add(key);
        }
      }
    } else {
      for (const file of inventory) {
        const key = file.relativePath || file.path || file.webkitRelativePath || file.name || '';
        if (key) pathsNeeded.add(key);
      }
    }

    for (const invFile of inventory) {
      const filePath = invFile.relativePath || invFile.path || invFile.webkitRelativePath || invFile.name || '';
      const fileObj = invFile.file;
      if (!(fileObj instanceof File) || !filePath || seen.has(filePath)) continue;
      if (pathsNeeded.size > 0 && !pathsNeeded.has(filePath)) {
        const matched = [...pathsNeeded].some((p) => filePath === p || filePath.endsWith(`/${p}`) || p.endsWith(filePath));
        if (!matched) continue;
      }
      seen.add(filePath);
      requirements.push({
        widgetId: widget.id,
        widgetName: settings.name || widget.id,
        fileName: filePath,
        hasFileInMemory: true,
        file: fileObj,
      });
    }
  }
  return requirements;
}

export function collectSmbConnectionIds(widgets) {
  const ids = new Set();
  for (const widget of widgets || []) {
    if (!isSmbSourceWidget(widget)) continue;
    const cid = widget.settings?.smbConnectionId;
    if (cid != null) ids.add(Number(cid));
  }
  return [...ids].filter((n) => Number.isFinite(n));
}

export function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result;
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      resolve(`base64:${btoa(binary)}`);
    };
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsArrayBuffer(file);
  });
}

export async function buildCompileFilesPayload(requirements, fileAssignments = {}) {
  const files = [];
  const seen = new Set();

  for (const req of requirements || []) {
    const fileName = req.fileName;
    if (!fileName || seen.has(fileName)) continue;
    const file = fileAssignments[fileName] || req.file;
    if (!(file instanceof File)) continue;
    seen.add(fileName);
    const content = await fileToBase64Payload(file);
    files.push({ filename: fileName, content });
  }

  for (const [fileName, file] of Object.entries(fileAssignments || {})) {
    if (seen.has(fileName) || !(file instanceof File)) continue;
    seen.add(fileName);
    const content = await fileToBase64Payload(file);
    files.push({ filename: fileName, content });
  }

  return files;
}

export function buildCompileSmbPayload(widgets) {
  return collectSmbConnectionIds(widgets).map((connection_id) => ({ connection_id }));
}

export function normalizeWidgetSettingsForDelivery(settings) {
  const next = { ...settings };
  if (
    (next.sourceType === 'file' || next.sourceType === 'folder' || next.sourceType === 'archive')
    && !next.fileDeliveryMode
  ) {
    next.fileDeliveryMode = 'local';
  }
  if (next.fileDeliveryMode === 'smb' && next.smbShareName && next.smbSharePath != null) {
    next.sourcePath = resolveSourcePathForSettings(next);
  }
  return next;
}
