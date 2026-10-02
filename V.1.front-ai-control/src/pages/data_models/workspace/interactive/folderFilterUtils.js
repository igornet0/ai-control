/**
 * Shared file name / extension filtering for folder sources.
 */

const DATA_EXTENSIONS = new Set(['csv', 'xlsx', 'xls']);

export function isDataFileExtension(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return DATA_EXTENSIONS.has(ext);
}

export function matchesPattern(fileName, pattern) {
  const hasRegexChars = /[[\](){}+^$\\]/.test(pattern);
  let regexPattern;

  if (hasRegexChars) {
    regexPattern = pattern;
  } else {
    regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    if (!regexPattern.startsWith('^')) regexPattern = `^${regexPattern}`;
    if (!regexPattern.endsWith('$')) regexPattern = `${regexPattern}$`;
  }

  try {
    return new RegExp(regexPattern, 'i').test(fileName);
  } catch {
    return false;
  }
}

/**
 * Match file name against filter string.
 * Separators: `|` or `;` (OR). Prefix `!` for exclude.
 */
export function matchesFileNameFilter(fileName, fileNameFilter) {
  if (!fileNameFilter || !String(fileNameFilter).trim()) return true;

  try {
    const raw = String(fileNameFilter);
    const patterns = raw.split(/[|;]/).map((p) => p.trim()).filter(Boolean);
    if (!patterns.length) return true;

    const includePatterns = [];
    const excludePatterns = [];

    for (const pattern of patterns) {
      if (pattern.startsWith('!')) {
        excludePatterns.push(pattern.slice(1).trim());
      } else {
        includePatterns.push(pattern);
      }
    }

    for (const excludePattern of excludePatterns) {
      if (matchesPattern(fileName, excludePattern)) return false;
    }

    if (includePatterns.length > 0) {
      return includePatterns.some((pattern) => matchesPattern(fileName, pattern));
    }
    return true;
  } catch {
    return true;
  }
}

export function filterInventoryFiles(files, discovery = {}) {
  const list = Array.isArray(files) ? files : [];
  const includeXLSX = discovery.includeXLSX !== false;
  const includeCSV = discovery.includeCSV !== false;
  const fileNameFilter = discovery.fileNameFilter || '';

  return list.filter((file) => {
    const name = file?.name || '';
    if (!name || name === '.DS_Store') return false;

    const ext = name.split('.').pop()?.toLowerCase() || '';
    const isData = DATA_EXTENSIONS.has(ext);
    if (isData) {
      if ((ext === 'xlsx' || ext === 'xls') && !includeXLSX) return false;
      if (ext === 'csv' && !includeCSV) return false;
    }

    return matchesFileNameFilter(name, fileNameFilter);
  });
}
