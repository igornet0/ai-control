import { describe, expect, it } from 'vitest';
import {
  descendantFolderIds,
  flattenFolderTree,
  folderPath,
  groupRootFolders,
  indexFolders,
  pluralizeDocuments,
  totalDocumentsCount,
} from './documentFolderUtils';

const folders = [
  { id: 1, name: 'Отдел продаж', is_system: true, scope_type: 'department', scope_id: 7, parent_id: null, documents_count: 2 },
  { id: 2, name: 'Backend', is_system: true, scope_type: 'team', scope_id: 3, parent_id: null, documents_count: 0 },
  { id: 3, name: 'Договоры', scope_type: 'department', scope_id: 7, parent_id: 1, owner_id: 5, documents_count: 4 },
  { id: 4, name: '2026', scope_type: 'department', scope_id: 7, parent_id: 3, owner_id: 5, documents_count: 1 },
  { id: 5, name: 'Личное', scope_type: 'custom', parent_id: null, owner_id: 10, documents_count: 0 },
  { id: 6, name: 'От коллеги', scope_type: 'custom', parent_id: null, owner_id: 11, documents_count: 3 },
  // Подпапка, чей родитель пользователю не виден, — показывается как корень.
  { id: 7, name: 'Выданная', scope_type: 'custom', parent_id: 99, owner_id: 11, documents_count: 0 },
];

describe('documentFolderUtils', () => {
  it('строит дерево и корни', () => {
    const { roots, children } = indexFolders(folders);
    expect(roots.map((f) => f.id).sort()).toEqual([1, 2, 5, 6, 7]);
    expect(children.get(1).map((f) => f.id)).toEqual([3]);
  });

  it('раскладывает корни по группам', () => {
    const groups = groupRootFolders(folders, 10);
    expect(groups.department.map((f) => f.id)).toEqual([1]);
    expect(groups.team.map((f) => f.id)).toEqual([2]);
    expect(groups.mine.map((f) => f.id)).toEqual([5]);
    expect(groups.shared.map((f) => f.id).sort()).toEqual([6, 7]);
  });

  it('путь и вложенные папки', () => {
    expect(folderPath(folders, 4).map((f) => f.id)).toEqual([1, 3, 4]);
    expect([...descendantFolderIds(folders, 1)].sort()).toEqual([3, 4]);
    expect(totalDocumentsCount(folders, 1)).toBe(7);
  });

  it('плоский список с глубиной и фильтром', () => {
    const flat = flattenFolderTree(folders, { filter: (f) => f.id !== 2 });
    const entry = flat.find((x) => x.folder.id === 4);
    expect(entry.depth).toBe(2);
    expect(flat.some((x) => x.folder.id === 2)).toBe(false);
  });

  it('склоняет «документ»', () => {
    expect([1, 2, 5, 11, 21, 23].map(pluralizeDocuments)).toEqual([
      '1 документ', '2 документа', '5 документов', '11 документов', '21 документ', '23 документа',
    ]);
  });
});
