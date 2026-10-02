const EMPTY = { files: [], documents: [] };

function storageKey(userId) {
  return `filesFavorites_${userId ?? 'anonymous'}`;
}

export function readFavorites(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { ...EMPTY, files: [], documents: [] };
    const parsed = JSON.parse(raw);
    return {
      files: Array.isArray(parsed.files) ? parsed.files : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch {
    return { files: [], documents: [] };
  }
}

function writeFavorites(userId, favorites) {
  localStorage.setItem(storageKey(userId), JSON.stringify(favorites));
}

export function isFileFavorite(favorites, projectId, filename, taskId = null) {
  return favorites.files.some((entry) => {
    if (taskId != null) {
      return entry.task_id === taskId && entry.filename === filename;
    }
    return entry.task_id == null && entry.project_id === projectId && entry.filename === filename;
  });
}

export function isDocumentFavorite(favorites, documentId) {
  return favorites.documents.some((entry) => entry.document_id === documentId);
}

export function isItemFavorite(favorites, item) {
  if (!item) return false;
  if (item.item_kind === 'document') {
    return isDocumentFavorite(favorites, item.document_id);
  }
  if (item.item_kind === 'task_file') {
    return isFileFavorite(favorites, null, item.stored_filename || item.filename, item.task_id);
  }
  return isFileFavorite(favorites, item.project_id, item.stored_filename || item.filename);
}

export function toggleFileFavorite(userId, projectId, filename, taskId = null) {
  const favorites = readFavorites(userId);
  const index = favorites.files.findIndex((entry) => {
    if (taskId != null) {
      return entry.task_id === taskId && entry.filename === filename;
    }
    return entry.task_id == null && entry.project_id === projectId && entry.filename === filename;
  });
  if (index >= 0) {
    favorites.files.splice(index, 1);
  } else if (taskId != null) {
    favorites.files.push({ task_id: taskId, filename });
  } else {
    favorites.files.push({ project_id: projectId, filename });
  }
  writeFavorites(userId, favorites);
  return favorites;
}

export function toggleDocumentFavorite(userId, documentId) {
  const favorites = readFavorites(userId);
  const index = favorites.documents.findIndex(
    (entry) => entry.document_id === documentId,
  );
  if (index >= 0) {
    favorites.documents.splice(index, 1);
  } else {
    favorites.documents.push({ document_id: documentId });
  }
  writeFavorites(userId, favorites);
  return favorites;
}

export function toggleItemFavorite(userId, item) {
  if (item.item_kind === 'document') {
    return toggleDocumentFavorite(userId, item.document_id);
  }
  if (item.item_kind === 'task_file') {
    return toggleFileFavorite(userId, null, item.stored_filename || item.filename, item.task_id);
  }
  return toggleFileFavorite(userId, item.project_id, item.stored_filename || item.filename);
}
