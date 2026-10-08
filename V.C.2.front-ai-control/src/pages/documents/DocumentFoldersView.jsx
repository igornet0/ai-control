import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { documentService } from '../../services/documentService';
import EditorOverflowMenu from './EditorOverflowMenu';
import FolderAccessDialog from './FolderAccessDialog';
import { FolderConfirmDialog, FolderNameDialog, FolderPickerDialog, ItemPickerDialog, errorText } from './FolderDialogs';
import { DocIcon } from './DocumentIcons';
import { isSpreadsheetDocument, isSpreadsheetTemplate } from './templateTypeUtils';
import { formatRelativeTime, getDocumentDisplayTitle, matchesSearch } from './documentsPageUtils';
import {
  ACCESS_LEVEL_LABELS,
  FOLDER_GROUPS,
  SCOPE_ICONS,
  SCOPE_LABELS,
  descendantFolderIds,
  folderPath,
  groupRootFolders,
  indexFolders,
  pluralizeDocuments,
  totalDocumentsCount,
} from './documentFolderUtils';
import f from './DocumentFolders.module.css';

const DOC_DRAG_TYPE = 'application/x-ai-control-document';
const COLLAPSED_GROUPS_KEY = 'documents-folders-collapsed-groups';

const SCOPE_MEMBERS = { department: 'отдела', team: 'команды', project: 'проекта' };

const folderIcon = (folder) => SCOPE_ICONS[folder.is_system ? folder.scope_type : 'custom'] || 'folder';

function loadCollapsedGroups() {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveCollapsedGroups(set) {
  try {
    window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...set]));
  } catch {
    // хранилище недоступно — просто не запоминаем
  }
}

function rulesWord(n) {
  if (n % 10 === 1 && n % 100 !== 11) return 'правило';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return 'правила';
  return 'правил';
}

/** Короткое описание того, кто видит папку (строка «Доступ»). */
function accessSummary(folder, rootFolder) {
  const parts = [];
  if (rootFolder?.is_system && SCOPE_MEMBERS[rootFolder.scope_type]) {
    parts.push(`Участники ${SCOPE_MEMBERS[rootFolder.scope_type]} «${rootFolder.name}»`);
  } else if (folder.owner_name) {
    parts.push(`Создатель — ${folder.owner_name}`);
  } else {
    parts.push('Только создатель');
  }
  if (folder.grants_count > 0) {
    parts.push(`ещё ${folder.grants_count} ${rulesWord(folder.grants_count)}`);
  } else if (!rootFolder?.is_system) {
    parts.push('доступ никому не выдан');
  }
  return parts.join(' · ');
}

/**
 * Раздел «Папки»: папки отделов, команд и проектов (создаются автоматически) и свои папки.
 * Широкая область — дерево слева; узкая — переход по плиткам и кнопка «Назад».
 */
export default function DocumentFoldersView({
  currentUserId,
  folderId,
  onFolderChange,
  templates,
  myDocuments,
  getKindName,
  searchQuery,
  refreshKey,
  onOpenDocument,
  onDocumentsChanged,
}) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsedGroups);
  const [dialog, setDialog] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const loadFolders = useCallback(async () => {
    try {
      const data = await documentService.getFolders();
      setFolders(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError(errorText(e, 'Не удалось загрузить папки'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDocs = useCallback(async (id) => {
    if (id == null) {
      setDocs([]);
      return;
    }
    setDocsLoading(true);
    try {
      const data = await documentService.getFolderDocuments(id);
      setDocs(Array.isArray(data) ? data : []);
    } catch (e) {
      setDocs([]);
      setError(errorText(e, 'Не удалось загрузить документы папки'));
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders, refreshKey]);

  useEffect(() => {
    loadDocs(folderId);
  }, [folderId, loadDocs, refreshKey]);

  const index = useMemo(() => indexFolders(folders), [folders]);
  const groups = useMemo(() => groupRootFolders(folders, currentUserId), [folders, currentUserId]);
  const current = folderId != null ? index.byId.get(folderId) || null : null;
  const path = useMemo(() => (folderId != null ? folderPath(folders, folderId) : []), [folders, folderId]);

  // Папка исчезла (удалили или забрали доступ) — возвращаемся к списку.
  useEffect(() => {
    if (!loading && folderId != null && !index.byId.has(folderId)) onFolderChange(null);
  }, [loading, folderId, index, onFolderChange]);

  // Раскрываем в дереве путь до выбранной папки.
  useEffect(() => {
    if (path.length < 2) return;
    setExpanded((prev) => {
      const missing = path.slice(0, -1).filter((p) => !prev.has(p.id));
      if (!missing.length) return prev;
      const next = new Set(prev);
      missing.forEach((p) => next.add(p.id));
      return next;
    });
  }, [path]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadFolders(), loadDocs(folderId)]);
    onDocumentsChanged?.();
  }, [loadFolders, loadDocs, folderId, onDocumentsChanged]);

  const docTitle = useCallback(
    (d) => getDocumentDisplayTitle(d, templates, getKindName(d.document_kind_id)),
    [templates, getKindName],
  );

  const moveDocument = useCallback(async (doc, targetFolderId) => {
    setError(null);
    try {
      await documentService.moveDocumentToFolder(doc.id, targetFolderId);
      await refreshAll();
    } catch (e) {
      setError(errorText(e, 'Не удалось переместить документ'));
      throw e;
    }
  }, [refreshAll]);

  // ——— Drag & drop документов на папки ———
  const dropProps = (folder) => (folder.can_edit ? {
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes(DOC_DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTarget !== folder.id) setDropTarget(folder.id);
    },
    onDragLeave: () => setDropTarget((t) => (t === folder.id ? null : t)),
    onDrop: (e) => {
      setDropTarget(null);
      const raw = e.dataTransfer.getData(DOC_DRAG_TYPE);
      if (!raw) return;
      e.preventDefault();
      const doc = docs.find((d) => String(d.id) === raw);
      if (doc && doc.folder_id !== folder.id) moveDocument(doc, folder.id).catch(() => {});
    },
  } : {});

  const toggleExpanded = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleGroup = (id) => setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveCollapsedGroups(next);
    return next;
  });

  // ——— Действия ———
  const createFolder = async (name) => {
    const created = await documentService.createFolder({ name, parent_id: dialog?.parentId ?? null });
    await loadFolders();
    if (created?.id) onFolderChange(created.id);
  };

  const renameFolder = async (name) => {
    await documentService.updateFolder(dialog.folder.id, { name });
    await loadFolders();
  };

  const moveFolder = async (parentId) => {
    await documentService.updateFolder(dialog.folder.id, { parent_id: parentId });
    await loadFolders();
  };

  const deleteFolder = (folder) => {
    const total = totalDocumentsCount(folders, folder.id);
    const nested = descendantFolderIds(folders, folder.id).size;
    setDialog({
      type: 'confirm',
      title: `Удалить папку «${folder.name}»?`,
      message: [
        nested ? `Вложенные папки (${nested}) тоже будут удалены.` : null,
        total
          ? `Документы (${total}) не удаляются — они останутся у авторов в разделе «Документы».`
          : 'Папка пустая.',
      ],
      confirmLabel: 'Удалить папку',
      busyLabel: 'Удаление…',
      danger: true,
      // Ошибку показывает сам диалог
      onConfirm: async () => {
        await documentService.deleteFolder(folder.id);
        if (folderId === folder.id || descendantFolderIds(folders, folder.id).has(folderId)) {
          onFolderChange(folder.parent_id ?? null);
        }
        await loadFolders();
        onDocumentsChanged?.();
      },
    });
  };

  const createDocumentFromTemplate = async (item) => {
    const created = await documentService.createFromTemplate(item.template.id, null, undefined, folderId);
    await refreshAll();
    if (created?.id) onOpenDocument?.(created);
  };

  const addExistingDocument = async (item) => {
    await moveDocument(item.doc, folderId);
  };

  // ——— Поиск ———
  const q = String(searchQuery || '').trim();
  const childFolders = useMemo(() => {
    const list = folderId != null ? (index.children.get(folderId) || []) : [];
    return q ? list.filter((x) => matchesSearch(x.name, q)) : list;
  }, [index, folderId, q]);
  const visibleDocs = useMemo(
    () => (q ? docs.filter((d) => matchesSearch(docTitle(d), getKindName(d.document_kind_id), q)) : docs),
    [docs, q, docTitle, getKindName],
  );
  const searchHits = useMemo(
    () => (q && folderId == null ? folders.filter((x) => matchesSearch(x.name, q)) : []),
    [folders, q, folderId],
  );

  const createMenuItems = (folder) => [
    {
      id: 'doc',
      label: 'Документ по шаблону',
      hint: 'Новый документ или таблица сразу в этой папке',
      icon: <DocIcon name="filePlus" size={16} />,
      onSelect: () => setDialog({ type: 'createDoc' }),
    },
    {
      id: 'existing',
      label: 'Мой документ',
      hint: 'Переместить сюда один из ваших документов',
      icon: <DocIcon name="documentStack" size={16} />,
      onSelect: () => setDialog({ type: 'addExisting' }),
    },
    {
      id: 'folder',
      label: 'Вложенную папку',
      hint: 'Получит тот же доступ, что и эта папка',
      icon: <DocIcon name="folderPlus" size={16} />,
      onSelect: () => setDialog({ type: 'create', parentId: folder.id }),
      separatorBefore: true,
    },
  ];

  // ——— Рендер ———
  const renderTreeNode = (folder, depth) => {
    const kids = index.children.get(folder.id) || [];
    const isOpen = expanded.has(folder.id);
    const active = folder.id === folderId;
    return (
      <li key={folder.id}>
        <div className={f.treeRow} style={{ '--depth': depth }}>
          {kids.length > 0 ? (
            <button
              type="button"
              className={`${f.caret} ${isOpen ? f.caretOpen : ''}`}
              onClick={() => toggleExpanded(folder.id)}
              aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
              aria-expanded={isOpen}
            >
              <DocIcon name="chevronRight" size={12} />
            </button>
          ) : <span className={f.caretSpacer} aria-hidden />}
          <button
            type="button"
            className={`${f.treeItem} ${active ? f.treeItemActive : ''} ${dropTarget === folder.id ? f.treeItemDrop : ''}`}
            onClick={() => onFolderChange(folder.id)}
            aria-current={active ? 'true' : undefined}
            title={folder.name}
            {...dropProps(folder)}
          >
            <span className={f.treeItemIcon} aria-hidden><DocIcon name={depth === 0 ? folderIcon(folder) : 'folder'} size={15} /></span>
            <span className={f.treeItemName}>{folder.name}</span>
            {folder.documents_count > 0 && <span className={f.treeItemCount}>{folder.documents_count}</span>}
          </button>
        </div>
        {isOpen && kids.length > 0 && (
          <ul className={f.treeList}>{kids.map((kid) => renderTreeNode(kid, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const renderTile = (folder) => {
    const total = totalDocumentsCount(folders, folder.id);
    const kids = (index.children.get(folder.id) || []).length;
    const meta = [
      total ? pluralizeDocuments(total) : 'Пусто',
      kids ? `папок: ${kids}` : null,
    ].filter(Boolean).join(' · ');
    return (
      <li key={folder.id}>
        <button
          type="button"
          className={`${f.folderTile} ${dropTarget === folder.id ? f.folderTileDrop : ''}`}
          onClick={() => onFolderChange(folder.id)}
          title={folder.name}
          {...dropProps(folder)}
        >
          <span className={f.folderTileIcon} aria-hidden><DocIcon name={folderIcon(folder)} size={18} /></span>
          <span className={f.folderTileText}>
            <span className={f.folderTileName}>{folder.name}</span>
            <span className={`${f.folderTileMeta} ${total ? f.folderTileMetaFilled : ''}`}>{meta}</span>
          </span>
          <span className={f.folderTileChevron} aria-hidden><DocIcon name="chevronRight" size={14} /></span>
        </button>
      </li>
    );
  };

  const renderOverview = () => (
    <>
      <div className={f.paneHead}>
        <span className={f.headIcon} aria-hidden><DocIcon name="folder" size={20} /></span>
        <div className={f.headText}>
          <h2 className={f.title}>Все папки</h2>
          <p className={f.headMeta}>Папки отделов, команд и проектов создаются сами — откройте нужную или создайте свою</p>
        </div>
        <div className={f.headActions}>
          <button type="button" className={f.primaryBtn} onClick={() => setDialog({ type: 'create', parentId: null })}>
            <DocIcon name="folderPlus" size={16} /> Новая папка
          </button>
        </div>
      </div>
      {q ? (
        <section className={f.block}>
          <h4 className={f.sectionLabel}>Найденные папки</h4>
          {searchHits.length === 0
            ? <div className={f.emptyPane}><p>Папок с «{q}» в названии нет.</p></div>
            : <ul className={f.folderGrid}>{searchHits.map(renderTile)}</ul>}
        </section>
      ) : FOLDER_GROUPS.map((group) => {
        const list = groups[group.id] || [];
        if (!list.length && group.id !== 'mine') return null;
        return (
          <section key={group.id} className={f.block}>
            <h4 className={f.sectionLabel}>
              <DocIcon name={group.icon} size={14} />
              {group.label}
              <span className={f.sectionCount}>{list.length}</span>
            </h4>
            {list.length === 0 ? (
              <div className={f.emptyInline}>
                <span>Свои папки видите только вы и те, кому вы выдадите доступ.</span>
                <button type="button" className={f.linkBtn} onClick={() => setDialog({ type: 'create', parentId: null })}>
                  Создать папку
                </button>
              </div>
            ) : <ul className={f.folderGrid}>{list.map(renderTile)}</ul>}
          </section>
        );
      })}
    </>
  );

  const renderDocRow = (d) => {
    const title = docTitle(d);
    const isTable = isSpreadsheetDocument(d, templates);
    const rel = formatRelativeTime(d.updated || d.created);
    const isAuthor = currentUserId != null && String(d.author_id) === String(currentUserId);
    return (
      <li
        key={d.id}
        className={f.fileRow}
        draggable={Boolean(d.can_edit)}
        onDragStart={(e) => {
          e.dataTransfer.setData(DOC_DRAG_TYPE, String(d.id));
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <button type="button" className={f.fileMain} onClick={() => onOpenDocument?.(d)} title="Открыть">
          <span className={`${f.fileIcon} ${isTable ? f.fileIconTable : ''}`} aria-hidden>
            <DocIcon name={isTable ? 'grid' : 'documentStack'} size={16} />
          </span>
          <span className={f.fileText}>
            <span className={f.fileTitle}>
              {title}
              {d.can_edit === false && <span className={f.fileBadge}>Просмотр</span>}
            </span>
            <span className={f.fileMeta}>
              {[isTable ? 'Таблица' : getKindName(d.document_kind_id), d.number ? `№ ${d.number}` : null].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span className={f.fileAuthor}>{d.author_name || '—'}</span>
          <span className={f.fileDate}>{rel || ''}</span>
        </button>
        <EditorOverflowMenu
          label="Действия с документом"
          items={[
            { id: 'open', label: 'Открыть', onSelect: () => onOpenDocument?.(d) },
            {
              id: 'move',
              label: 'Переместить в папку…',
              onSelect: () => setDialog({ type: 'moveDoc', doc: d }),
              hidden: !d.can_edit,
            },
            {
              id: 'remove',
              label: 'Убрать из папки',
              onSelect: () => setDialog({
                type: 'confirm',
                title: 'Убрать документ из папки?',
                message: isAuthor
                  ? 'Он останется в разделе «Документы» у вас.'
                  : 'Он останется только у автора.',
                confirmLabel: 'Убрать',
                busyLabel: 'Убираю…',
                danger: true,
                onConfirm: () => moveDocument(d, null),
              }),
              hidden: !(isAuthor || current?.can_manage),
              danger: true,
              separatorBefore: true,
            },
          ]}
        />
      </li>
    );
  };

  const renderFolder = () => {
    if (!current) return null;
    const ancestors = path.slice(0, -1);
    const parent = ancestors[ancestors.length - 1] || null;
    const root = path[0] || current;
    const canEdit = current.can_edit;
    const canManage = current.can_manage;
    const total = totalDocumentsCount(folders, current.id);
    const kidsCount = (index.children.get(current.id) || []).length;
    const headMeta = [
      SCOPE_LABELS[current.is_system ? current.scope_type : 'custom'],
      pluralizeDocuments(docsLoading ? (current.documents_count || 0) : docs.length),
      kidsCount ? `папок: ${kidsCount}` : null,
    ].filter(Boolean).join(' · ');
    const manageItems = [
      { id: 'rename', label: 'Переименовать', onSelect: () => setDialog({ type: 'rename', folder: current }), hidden: !canManage || current.is_system },
      { id: 'move', label: 'Переместить…', onSelect: () => setDialog({ type: 'moveFolder', folder: current }), hidden: !canManage || current.is_system },
      {
        id: 'delete',
        label: 'Удалить папку',
        hint: total ? 'Документы останутся у авторов' : undefined,
        onSelect: () => deleteFolder(current),
        hidden: !canManage || current.is_system,
        danger: true,
        separatorBefore: true,
      },
    ];

    return (
      <>
        <div className={f.paneHead}>
          <button
            type="button"
            className={f.backBtn}
            onClick={() => onFolderChange(parent ? parent.id : null)}
            aria-label={parent ? `Назад в «${parent.name}»` : 'Назад ко всем папкам'}
            title={parent ? `Назад в «${parent.name}»` : 'Все папки'}
          >
            <DocIcon name="chevronLeft" size={18} />
          </button>
          <span className={f.headIcon} aria-hidden><DocIcon name={folderIcon(current)} size={20} /></span>
          <div className={f.headText}>
            <nav className={f.crumbs} aria-label="Путь к папке">
              <button type="button" className={f.crumb} onClick={() => onFolderChange(null)}>Все папки</button>
              {ancestors.map((p) => (
                <React.Fragment key={p.id}>
                  <span className={f.crumbSep} aria-hidden>/</span>
                  <button type="button" className={f.crumb} onClick={() => onFolderChange(p.id)}>{p.name}</button>
                </React.Fragment>
              ))}
            </nav>
            <h2 className={f.title}>{current.name}</h2>
            <p className={f.headMeta}>{headMeta}</p>
          </div>
          <div className={f.headActions}>
            {canEdit && (
              <EditorOverflowMenu
                label="Создать в папке"
                items={createMenuItems(current)}
                triggerClassName={f.primaryBtn}
                trigger={(
                  <>
                    <DocIcon name="filePlus" size={16} />
                    Создать
                    <DocIcon name="chevronDown" size={14} />
                  </>
                )}
              />
            )}
            <EditorOverflowMenu label="Действия с папкой" items={manageItems} />
          </div>
        </div>

        <button type="button" className={f.accessBar} onClick={() => setDialog({ type: 'access', folder: current })}>
          <span className={f.accessIcon} aria-hidden><DocIcon name="users" size={16} /></span>
          <span className={f.accessText}>
            <span className={f.accessLabel}>Кто имеет доступ</span>
            <span className={f.accessSummary}>{accessSummary(current, root)}</span>
          </span>
          <span className={f.accessLevel} title="Ваш уровень доступа">Вы: {ACCESS_LEVEL_LABELS[current.access_level]}</span>
          <span className={f.accessAction}>
            {canManage ? 'Настроить' : 'Подробнее'}
            <DocIcon name="chevronRight" size={14} />
          </span>
        </button>

        {childFolders.length > 0 && (
          <section className={f.block}>
            <h4 className={f.sectionLabel}>
              <DocIcon name="folder" size={14} /> Папки
              <span className={f.sectionCount}>{childFolders.length}</span>
            </h4>
            <ul className={f.folderGrid}>{childFolders.map(renderTile)}</ul>
          </section>
        )}

        <section className={f.block}>
          <h4 className={f.sectionLabel}>
            <DocIcon name="documentStack" size={14} /> Документы
            {docs.length > 0 && <span className={f.sectionCount}>{visibleDocs.length}</span>}
          </h4>
          {docsLoading && docs.length === 0 ? (
            <div className={f.emptyPane}><p>Загрузка…</p></div>
          ) : docs.length === 0 ? (
            <div className={f.emptyPane}>
              <span className={f.emptyIcon} aria-hidden><DocIcon name="folder" size={26} /></span>
              <p className={f.emptyTitle}>В папке пока нет документов</p>
              {canEdit ? (
                <>
                  <p>Создайте документ по шаблону или переместите сюда свой — его увидят все, у кого есть доступ к папке.</p>
                  <div className={f.emptyActions}>
                    <button type="button" className={f.primaryBtn} onClick={() => setDialog({ type: 'createDoc' })}>
                      <DocIcon name="filePlus" size={16} /> Документ по шаблону
                    </button>
                    <button type="button" className={f.ghostBtn} onClick={() => setDialog({ type: 'addExisting' })}>
                      Добавить мой документ
                    </button>
                  </div>
                </>
              ) : <p>У вас доступ только на просмотр.</p>}
            </div>
          ) : visibleDocs.length === 0 ? (
            <div className={f.emptyPane}><p>Документов с «{q}» в папке нет.</p></div>
          ) : (
            <div className={f.fileTable}>
              <div className={f.fileHeader} aria-hidden>
                <span>Название</span>
                <span className={f.fileAuthor}>Автор</span>
                <span className={f.fileDate}>Изменён</span>
                <span />
              </div>
              <ul className={f.fileList}>{visibleDocs.map(renderDocRow)}</ul>
            </div>
          )}
        </section>
      </>
    );
  };

  const templateItems = useMemo(() => (templates || []).map((t) => ({
    key: `t-${t.id}`,
    template: t,
    title: t.name || `Шаблон #${t.id}`,
    meta: isSpreadsheetTemplate(t) ? 'Таблица' : 'Документ',
    icon: isSpreadsheetTemplate(t) ? 'templateTable' : 'templateDocument',
  })), [templates]);

  const existingItems = useMemo(() => (myDocuments || [])
    .filter((d) => d.folder_id !== folderId)
    .map((d) => ({
      key: `d-${d.id}`,
      doc: d,
      title: docTitle(d),
      meta: [
        isSpreadsheetDocument(d, templates) ? 'Таблица' : 'Документ',
        d.folder_name ? `сейчас в «${d.folder_name}»` : null,
      ].filter(Boolean).join(' · '),
      icon: isSpreadsheetDocument(d, templates) ? 'grid' : 'documentStack',
    })), [myDocuments, folderId, docTitle, templates]);

  return (
    <div className={f.shell}>
      <div className={f.layout}>
        <nav className={f.tree} aria-label="Дерево папок">
          <button
            type="button"
            className={`${f.treeAll} ${folderId == null ? f.treeItemActive : ''}`}
            onClick={() => onFolderChange(null)}
          >
            <DocIcon name="folder" size={16} /> Все папки
          </button>
          {FOLDER_GROUPS.map((group) => {
            const list = groups[group.id] || [];
            if (!list.length && group.id !== 'mine') return null;
            const collapsed = collapsedGroups.has(group.id);
            return (
              <div key={group.id} className={f.treeGroup}>
                <button
                  type="button"
                  className={f.treeGroupHeader}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!collapsed}
                >
                  <span className={`${f.groupCaret} ${collapsed ? '' : f.caretOpen}`} aria-hidden>
                    <DocIcon name="chevronRight" size={10} />
                  </span>
                  {group.label}
                  <span className={f.treeGroupCount}>{list.length}</span>
                </button>
                {!collapsed && (list.length ? (
                  <ul className={f.treeList}>{list.map((folder) => renderTreeNode(folder, 0))}</ul>
                ) : (
                  <p className={f.treeEmpty}>{group.empty}</p>
                ))}
              </div>
            );
          })}
          <button type="button" className={f.treeCreate} onClick={() => setDialog({ type: 'create', parentId: null })}>
            <DocIcon name="folderPlus" size={16} /> Новая папка
          </button>
        </nav>

        <div className={f.pane}>
          {error && <div className={f.error} role="alert">{error}</div>}
          {loading ? (
            <div className={f.emptyPane}><p>Загрузка папок…</p></div>
          ) : current ? renderFolder() : renderOverview()}
        </div>
      </div>

      {dialog?.type === 'create' && (
        <FolderNameDialog
          title={dialog.parentId != null ? 'Вложенная папка' : 'Новая папка'}
          subtitle={dialog.parentId != null
            ? `Внутри «${index.byId.get(dialog.parentId)?.name || ''}» — с тем же доступом`
            : 'Видна только вам, пока вы не выдадите доступ'}
          confirmLabel="Создать"
          onSubmit={createFolder}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'rename' && (
        <FolderNameDialog
          title="Переименовать папку"
          initialName={dialog.folder.name}
          onSubmit={renameFolder}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'moveFolder' && (
        <FolderPickerDialog
          title="Переместить папку"
          subtitle={dialog.folder.name}
          folders={folders}
          currentFolderId={dialog.folder.parent_id}
          disabledIds={new Set([dialog.folder.id, ...descendantFolderIds(folders, dialog.folder.id)])}
          rootOption={String(dialog.folder.owner_id) === String(currentUserId)
            ? { label: 'Мои папки (верхний уровень)', hint: 'Папка станет корневой', disabledWhenRoot: true }
            : null}
          onPick={moveFolder}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'moveDoc' && (
        <FolderPickerDialog
          title="Переместить документ"
          subtitle={docTitle(dialog.doc)}
          folders={folders}
          currentFolderId={dialog.doc.folder_id}
          onPick={(target) => moveDocument(dialog.doc, target)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'confirm' && (
        <FolderConfirmDialog
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          busyLabel={dialog.busyLabel}
          danger={dialog.danger}
          onConfirm={dialog.onConfirm}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'access' && (
        <FolderAccessDialog
          folder={dialog.folder}
          onClose={() => setDialog(null)}
          onUpdated={() => loadFolders()}
        />
      )}
      {dialog?.type === 'createDoc' && (
        <ItemPickerDialog
          title="Документ по шаблону"
          subtitle={`Будет создан в папке «${current?.name || ''}»`}
          items={templateItems}
          emptyText="Шаблоны не найдены"
          searchPlaceholder="Поиск шаблона…"
          confirmLabel="Создать"
          busyLabel="Создание…"
          onPick={createDocumentFromTemplate}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'addExisting' && (
        <ItemPickerDialog
          title="Добавить мой документ"
          subtitle={`Документ переместится в «${current?.name || ''}»`}
          items={existingItems}
          emptyText="Нет документов, которые можно добавить"
          searchPlaceholder="Поиск документа…"
          confirmLabel="Добавить"
          busyLabel="Добавление…"
          onPick={addExistingDocument}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
