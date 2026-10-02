/**
 * Folder inventory fingerprint and structure analysis (local + SMB).
 */

export function buildFolderInventoryFingerprint(folderData) {
  if (!folderData) return '';
  const files = Array.isArray(folderData.files) ? folderData.files : [];
  const parts = [
    folderData.isSmb ? 'smb' : 'local',
    folderData.smbPath || folderData.name || '',
    String(files.length),
    String(folderData.fileCount ?? files.length),
    String(folderData.dataFilesCount ?? ''),
  ];
  const fileSig = files
    .map((f) => {
      const path = f.smbPath || f.relativePath || f.path || f.name || '';
      return `${path}:${f.size ?? 0}`;
    })
    .sort()
    .join('|');
  parts.push(fileSig);
  return parts.join('::');
}

function stripFileRefsFromTreeNode(node) {
  if (!node) return node;
  return {
    ...node,
    files: (node.files || []).map((f) => {
      const { file, ...rest } = f;
      return rest;
    }),
    children: (node.children || []).map(stripFileRefsFromTreeNode),
  };
}

export function stripStructureForCache(structure) {
  if (!structure) return null;
  return {
    root: structure.root,
    tree: stripFileRefsFromTreeNode(structure.tree),
    files: (structure.files || []).map((f) => {
      const { file, ...rest } = f;
      return rest;
    }),
  };
}

function lookupKeyForFileEntry(entry) {
  return entry.smbPath || entry.path || entry.relativePath || entry.name || '';
}

export function enrichStructureFromFolderFiles(structure, folderFiles = []) {
  if (!structure) return null;
  const byPath = new Map();
  for (const f of folderFiles) {
    const key = lookupKeyForFileEntry(f);
    if (key) byPath.set(key, f);
    if (f.path && f.path !== key) byPath.set(f.path, f);
    if (f.relativePath) byPath.set(f.relativePath, f);
  }

  const attach = (fileInfo) => {
    const key = lookupKeyForFileEntry(fileInfo);
    const source = byPath.get(key) || byPath.get(fileInfo.path);
    if (!source) return fileInfo;
    return {
      ...fileInfo,
      file: source.file,
      smbPath: fileInfo.smbPath || source.smbPath,
      isSmb: fileInfo.isSmb ?? source.isSmb,
      size: fileInfo.size ?? source.size,
    };
  };

  return {
    ...structure,
    files: (structure.files || []).map(attach),
    tree: enrichTreeFromFolderFiles(structure.tree, attach),
  };
}

function enrichTreeFromFolderFiles(node, attach) {
  if (!node) return node;
  return {
    ...node,
    files: (node.files || []).map(attach),
    children: (node.children || []).map((child) => enrichTreeFromFolderFiles(child, attach)),
  };
}

export function analyzeFolderStructure(folderData) {
  const structure = {
    root: folderData.name || 'Папка',
    tree: null,
    files: [],
  };

  if (!folderData.files || folderData.files.length === 0) {
    structure.tree = { name: structure.root, type: 'folder', children: [], files: [] };
    return structure;
  }

  const rootNode = {
    name: structure.root,
    type: 'folder',
    path: '',
    children: new Map(),
    files: [],
  };

  folderData.files.forEach((file) => {
    if (file.name === '.DS_Store') return;

    const path = file.relativePath || file.webkitRelativePath || file.path || file.name;
    let parts = path.split('/').filter((p) => p && p !== '.DS_Store');

    if (parts.length > 0 && parts[0] === structure.root) {
      parts = parts.slice(1);
    }

    const isDataFile = file.name.endsWith('.csv')
      || file.name.endsWith('.xlsx')
      || file.name.endsWith('.xls');

    if (isDataFile) {
      structure.files.push({
        name: file.name,
        path,
        parts,
        size: file.size,
        file: file.file,
        smbPath: file.smbPath,
        isSmb: file.isSmb,
      });
    }

    let currentNode = rootNode;
    let currentPath = '';

    if (parts.length > 1) {
      for (let i = 0; i < parts.length - 1; i += 1) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, {
            name: part,
            type: 'folder',
            path: currentPath,
            children: new Map(),
            files: [],
          });
        }
        currentNode = currentNode.children.get(part);
      }
    }

    if (parts.length > 0) {
      const fileName = parts[parts.length - 1];
      currentNode.files.push({
        name: fileName,
        path,
        size: file.size,
        file: file.file,
        smbPath: file.smbPath,
        isSmb: file.isSmb,
        isDataFile,
      });
    } else {
      currentNode.files.push({
        name: file.name,
        path,
        size: file.size,
        file: file.file,
        smbPath: file.smbPath,
        isSmb: file.isSmb,
        isDataFile,
      });
    }
  });

  const convertTreeToArray = (node) => ({
    name: node.name,
    type: node.type,
    path: node.path,
    children: Array.from(node.children.values()).map(convertTreeToArray).sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    }),
    files: node.files.sort((a, b) => a.name.localeCompare(b.name)),
  });

  structure.tree = convertTreeToArray(rootNode);
  return structure;
}

export function getAllFoldersFromStructure(structure) {
  const folders = new Set();

  const collectFolders = (node) => {
    if (node.path) folders.add(node.path);
    if (node.children) node.children.forEach(collectFolders);
  };

  if (structure.tree) collectFolders(structure.tree);
  return Array.from(folders);
}

export function buildStructureCache(folderData) {
  const fingerprint = buildFolderInventoryFingerprint(folderData);
  const structure = analyzeFolderStructure(folderData);
  return {
    fingerprint,
    structure: stripStructureForCache(structure),
  };
}

export function resolveCachedStructure(folderData, cache) {
  if (!cache?.structure || !folderData) return null;
  const fingerprint = buildFolderInventoryFingerprint(folderData);
  const matchesFingerprint =
    cache.fingerprint === fingerprint
    || (folderData.inventoryFingerprint && folderData.inventoryFingerprint === cache.fingerprint);
  if (!matchesFingerprint) return null;
  return enrichStructureFromFolderFiles(cache.structure, folderData.files || []);
}
