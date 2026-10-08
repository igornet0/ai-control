/** Папки документов: дерево, группы, пути и подписи прав. */

export const FOLDER_GROUPS = [
  { id: 'department', label: 'Отделы', icon: 'building', empty: 'Вы не состоите ни в одном отделе' },
  { id: 'team', label: 'Команды', icon: 'users', empty: 'Вы не состоите ни в одной команде' },
  { id: 'project', label: 'Проекты', icon: 'briefcase', empty: 'Нет доступных проектов' },
  { id: 'mine', label: 'Мои папки', icon: 'folder', empty: 'Создайте свою папку' },
  { id: 'shared', label: 'Доступные мне', icon: 'share', empty: 'С вами пока не делились папками' },
];

export const ACCESS_LEVEL_LABELS = {
  view: 'Просмотр',
  edit: 'Изменение',
  manage: 'Управление',
};

export const ACCESS_LEVEL_HINTS = {
  view: 'Видит папку и открывает документы',
  edit: 'Добавляет и редактирует документы, создаёт вложенные папки',
  manage: 'Переименовывает, удаляет папку и выдаёт доступ',
};

export const SCOPE_ICONS = {
  department: 'building',
  team: 'users',
  project: 'briefcase',
  custom: 'folder',
};

export const SCOPE_LABELS = {
  department: 'Папка отдела',
  team: 'Папка команды',
  project: 'Папка проекта',
  custom: 'Папка',
};

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru', { sensitivity: 'base' });

/**
 * Индекс папок: byId, children (по parent_id, только видимые), корни (видимые папки без видимого родителя).
 */
export function indexFolders(folders) {
  const list = Array.isArray(folders) ? folders : [];
  const byId = new Map(list.map((f) => [f.id, f]));
  const children = new Map();
  const roots = [];
  list.forEach((f) => {
    if (f.parent_id != null && byId.has(f.parent_id)) {
      if (!children.has(f.parent_id)) children.set(f.parent_id, []);
      children.get(f.parent_id).push(f);
    } else {
      roots.push(f);
    }
  });
  children.forEach((arr) => arr.sort(byName));
  roots.sort(byName);
  return { byId, children, roots };
}

/** В какую группу боковой панели попадает корневая папка. */
export function folderGroupId(folder, currentUserId) {
  if (folder.is_system && ['department', 'team', 'project'].includes(folder.scope_type)) {
    return folder.scope_type;
  }
  if (folder.owner_id != null && currentUserId != null && String(folder.owner_id) === String(currentUserId)) {
    return 'mine';
  }
  return 'shared';
}

/** Корневые папки, разложенные по группам FOLDER_GROUPS. */
export function groupRootFolders(folders, currentUserId) {
  const { roots } = indexFolders(folders);
  const groups = Object.fromEntries(FOLDER_GROUPS.map((g) => [g.id, []]));
  roots.forEach((f) => {
    groups[folderGroupId(f, currentUserId)].push(f);
  });
  return groups;
}

/** Цепочка от корня до папки (включительно), только по видимым папкам. */
export function folderPath(folders, folderId) {
  const { byId } = indexFolders(folders);
  const path = [];
  const seen = new Set();
  let current = byId.get(folderId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parent_id != null ? byId.get(current.parent_id) : null;
  }
  return path;
}

/** id всех вложенных папок (без самой папки). */
export function descendantFolderIds(folders, folderId) {
  const { children } = indexFolders(folders);
  const out = new Set();
  const stack = [...(children.get(folderId) || [])];
  while (stack.length) {
    const f = stack.pop();
    if (out.has(f.id)) continue;
    out.add(f.id);
    stack.push(...(children.get(f.id) || []));
  }
  return out;
}

/** Плоский список для выбора папки: [{ folder, depth }] в порядке обхода дерева. */
export function flattenFolderTree(folders, { filter } = {}) {
  const { children, roots } = indexFolders(folders);
  const out = [];
  const walk = (folder, depth) => {
    if (!filter || filter(folder)) out.push({ folder, depth });
    (children.get(folder.id) || []).forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 0));
  return out;
}

/** Сумма документов в папке и всех вложенных. */
export function totalDocumentsCount(folders, folderId) {
  const { byId } = indexFolders(folders);
  let total = byId.get(folderId)?.documents_count || 0;
  descendantFolderIds(folders, folderId).forEach((id) => {
    total += byId.get(id)?.documents_count || 0;
  });
  return total;
}

export function pluralizeDocuments(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} документ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} документа`;
  return `${n} документов`;
}
