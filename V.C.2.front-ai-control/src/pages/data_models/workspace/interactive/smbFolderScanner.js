const DATA_FILE_EXTENSIONS = new Set(['csv', 'xlsx', 'xls']);
const SKIP_NAMES = new Set(['.DS_Store', '._.DS_Store', 'Thumbs.db', 'desktop.ini']);

export function isDataFileName(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return DATA_FILE_EXTENSIONS.has(ext);
}

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function relativePathFromRoot(rootPath, fullPath) {
  const root = normalizePath(rootPath);
  const full = normalizePath(fullPath);
  if (!root) return full;
  if (full === root) return '';
  if (full.startsWith(`${root}/`)) return full.slice(root.length + 1);
  return full;
}

function shouldSkipEntry(name) {
  if (!name) return true;
  if (SKIP_NAMES.has(name)) return true;
  return name.startsWith('._');
}

/**
 * Recursively list all files under an SMB folder path (relative to share root).
 */
export async function scanSmbFolder(connectionId, rootPath, browseFn, options = {}) {
  const maxFiles = options.maxFiles ?? 5000;
  const normalizedRoot = normalizePath(rootPath);
  const queue = [normalizedRoot];
  const visited = new Set();
  const files = [];

  while (queue.length > 0 && files.length < maxFiles) {
    const dirPath = queue.shift();
    const visitKey = dirPath || '';
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    let result;
    try {
      result = await browseFn(connectionId, dirPath);
    } catch {
      continue;
    }
    if (!result?.success) continue;

    const items = Array.isArray(result.items) ? result.items : [];
    for (const item of items) {
      if (shouldSkipEntry(item?.name)) continue;

      const smbPath = normalizePath(item.path || (dirPath ? `${dirPath}/${item.name}` : item.name));

      if (item.type === 'directory') {
        queue.push(smbPath);
        continue;
      }

      if (item.type !== 'file') continue;

      const relPath = relativePathFromRoot(normalizedRoot, smbPath);
      files.push({
        name: item.name,
        path: relPath,
        relativePath: relPath,
        smbPath,
        size: item.size || 0,
        isSmb: true,
      });
    }
  }

  const dataFilesCount = files.filter((f) => isDataFileName(f.name)).length;
  return {
    files,
    fileCount: files.length,
    dataFilesCount,
  };
}
