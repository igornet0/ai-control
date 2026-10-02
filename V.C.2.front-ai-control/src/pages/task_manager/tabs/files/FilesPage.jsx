import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { listProjectFiles, addFileToFavorites, removeFileFromFavorites, downloadProjectFile } from '../../../../services/filesService';
import { downloadTaskAttachment } from '../../../../services/taskService';
import { documentService } from '../../../../services/documentService';
import { projectService } from '../../../../services/projectService';
import DocumentEditorPanel from '../../../documents/DocumentEditorPanel';
import { getDocumentTypeLabel } from '../../../documents/templateTypeUtils';
import { getDocumentDisplayTitle } from '../../../documents/documentsPageUtils';
import { FilesIcon, IconWithText, LightbulbIcon, SearchInput, StarFilledIcon, StarOutlineIcon } from '../../components/TaskManagerIcons';
import {
  isItemFavorite,
  readFavorites,
  toggleItemFavorite,
} from './filesFavoritesStorage';
import '../../components/HeaderTabs.css';

function mapFileRow(file, favorites) {
  const isTaskFile = file.source === 'task';
  const storedFilename = file.filename;
  const displayName = file.original_filename || file.filename;
  const row = {
    item_kind: isTaskFile ? 'task_file' : 'file',
    key: isTaskFile ? `task-${file.task_id}/${storedFilename}` : `file-${file.project_id}/${storedFilename}`,
    project_id: file.project_id,
    project_name: file.project_name,
    task_id: file.task_id ?? null,
    task_title: file.task_title ?? null,
    filename: displayName,
    stored_filename: storedFilename,
    content_type: file.content_type,
    size: file.size,
    uploaded_by: file.uploaded_by,
    uploaded_at: file.uploaded_at,
    document_id: null,
    document_kind_id: null,
  };
  row.is_favorite = Boolean(file.is_favorite) || isItemFavorite(favorites, row);
  return row;
}

function getItemLocationLabel(item) {
  if (item.project_name) return item.project_name;
  if (item.task_title) return `Задача: ${item.task_title}`;
  if (item.task_id) return `Задача #${item.task_id}`;
  return '—';
}

function mapDocumentRow(doc, templates = [], kindName = '', favorites) {
  const title = getDocumentDisplayTitle(doc, templates, kindName);
  const row = {
    item_kind: 'document',
    key: `doc-${doc.id}`,
    project_id: doc.project_id,
    project_name: doc.project_name,
    filename: title,
    content_type: getDocumentTypeLabel(doc, templates),
    size: null,
    uploaded_by: doc.author_name || '—',
    uploaded_at: doc.updated || doc.created,
    document_id: doc.id,
    document_kind_id: doc.document_kind_id,
  };
  row.is_favorite = isItemFavorite(favorites, row);
  return row;
}

function sortItems(items, field, direction) {
  const sorted = [...items];
  const factor = direction === 'asc' ? 1 : -1;
  sorted.sort((a, b) => {
    let av;
    let bv;
    if (field === 'name') {
      av = (a.filename || '').toLowerCase();
      bv = (b.filename || '').toLowerCase();
    } else if (field === 'type') {
      av = (a.content_type || '').toLowerCase();
      bv = (b.content_type || '').toLowerCase();
    } else if (field === 'size') {
      av = a.size || 0;
      bv = b.size || 0;
    } else if (field === 'uploaded_at') {
      av = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
      bv = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
    } else {
      return 0;
    }
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
  return sorted;
}

export default function FilesPage({ user }) {
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: 'name', direction: 'asc' });
  const [tab, setTab] = useState('all');
  const [editingDocument, setEditingDocument] = useState(null);
  const [openingDocumentId, setOpeningDocumentId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectFilters, setProjectFilters] = useState({});
  const [projectFilterSearch, setProjectFilterSearch] = useState('');
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 });
  const menuRef = useRef(null);
  const PROJECT_FILTER_MENU_WIDTH = 320;

  const projectOptions = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => {
      map.set(String(project.id), project.name || `Проект #${project.id}`);
    });
    rawItems.forEach((item) => {
      if (item.project_id == null) return;
      const key = String(item.project_id);
      if (!map.has(key)) {
        map.set(key, item.project_name || `Проект #${key}`);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
  }, [projects, rawItems]);

  const areProjectFiltersActive = useMemo(
    () => projectOptions.some(([key]) => projectFilters[key] === false),
    [projectOptions, projectFilters]
  );

  const filteredItems = useMemo(
    () => rawItems.filter((item) => {
      if (item.project_id == null) return true;
      const key = String(item.project_id);
      if (!(key in projectFilters)) return true;
      return projectFilters[key] !== false;
    }),
    [rawItems, projectFilters]
  );

  const items = useMemo(
    () => sortItems(filteredItems, sortConfig.field, sortConfig.direction),
    [filteredItems, sortConfig.field, sortConfig.direction]
  );

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        field,
        direction: 'asc',
      };
    });
  };

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const data = await projectService.getProjects({ limit: 200 });
      const list = Array.isArray(data) ? data : (data?.items || data?.projects || []);
      setProjects(list);
      setProjectFilters((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        return Object.fromEntries(list.map((project) => [String(project.id), true]));
      });
    } catch (error) {
      console.error('Error loading projects for file filters:', error);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectContextMenu = (event) => {
    event.preventDefault();
    setProjectFilterSearch('');
    const headerRect = event.currentTarget.getBoundingClientRect();
    const menuMaxHeight = 420;
    let x = headerRect.left;
    let y = headerRect.bottom + 6;

    if (x + PROJECT_FILTER_MENU_WIDTH > window.innerWidth - 8) {
      x = Math.max(8, window.innerWidth - PROJECT_FILTER_MENU_WIDTH - 8);
    }
    if (y + menuMaxHeight > window.innerHeight - 8) {
      y = Math.max(8, headerRect.top - menuMaxHeight - 6);
    }

    setContextMenu({ open: true, x, y });
  };

  const closeContextMenu = () => setContextMenu({ open: false, x: 0, y: 0 });

  useEffect(() => {
    if (!contextMenu.open) return undefined;

    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeContextMenu();
      }
    };
    const handleScroll = () => closeContextMenu();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeContextMenu();
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.open]);

  const toggleProjectFilter = (projectId) => {
    setProjectFilters((prev) => ({
      ...prev,
      [projectId]: prev[projectId] === false,
    }));
  };

  const setAllProjectFilters = (checked) => {
    setProjectFilters(Object.fromEntries(projectOptions.map(([key]) => [key, checked])));
  };

  const getProjectFilterLabel = (key) => projectOptions.find(([id]) => id === key)?.[1] || `Проект #${key}`;

  const fetchData = async () => {
    setRawItems([]);
    setLoading(true);
    const favorites = readFavorites(user?.id);
    try {
      const onlyMy = tab === 'my';

      const [filesData, docsData, templatesData, kindsData] = await Promise.all([
        listProjectFiles({
          search: query || undefined,
          sortBy: sortConfig.field === 'type' ? 'type' : sortConfig.field === 'size' ? 'size' : sortConfig.field === 'name' ? 'name' : 'uploaded_at',
          sortOrder: sortConfig.direction,
          onlyMy,
          limit: tab === 'favorites' ? 200 : 50,
        }),
        documentService.getDocuments(null, null, {
          linkedOnly: true,
          onlyMy,
          search: query || undefined,
          limit: tab === 'favorites' ? 200 : 100,
        }),
        documentService.getTemplates(),
        documentService.getKinds(),
      ]);

      const templates = Array.isArray(templatesData) ? templatesData : [];
      const kinds = Array.isArray(kindsData) ? kindsData : [];
      const kindNameById = (id) => kinds.find((k) => String(k.id) === String(id))?.name || '';
      const fileItems = (filesData?.items || []).map((file) => mapFileRow(file, favorites));
      const docItems = (Array.isArray(docsData) ? docsData : []).map((doc) =>
        mapDocumentRow(doc, templates, kindNameById(doc.document_kind_id), favorites),
      );

      let combined = [...fileItems, ...docItems];
      if (tab === 'favorites') {
        combined = combined.filter((item) => item.is_favorite);
      }
      setRawItems(combined);
    } catch (error) {
      console.error('Error fetching files:', error);
      setRawItems([]);
      if (error.message) {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab, user?.id]);

  const onToggleFavorite = async (item) => {
    try {
      toggleItemFavorite(user?.id, item);

      if (item.item_kind === 'file') {
        if (item.is_favorite) {
          await removeFileFromFavorites({
            projectId: item.project_id,
            filename: item.stored_filename || item.filename,
          });
        } else {
          await addFileToFavorites({
            projectId: item.project_id,
            filename: item.stored_filename || item.filename,
          });
        }
      }

      if (tab === 'favorites' && item.is_favorite) {
        setRawItems((prev) => prev.filter((row) => row.key !== item.key));
        return;
      }

      setRawItems((prev) => prev.map((row) => (
        row.key === item.key ? { ...row, is_favorite: !row.is_favorite } : row
      )));
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Ошибка при изменении избранного');
      await fetchData();
    }
  };

  const onDownload = (item) => {
    if (item.item_kind === 'task_file') {
      downloadTaskAttachment(
        item.task_id,
        item.stored_filename || item.filename,
        item.filename,
      );
      return;
    }
    downloadProjectFile({
      projectId: item.project_id,
      filename: item.stored_filename || item.filename,
    });
  };

  const handleOpenDocument = async (item) => {
    if (!item?.document_id) return;
    try {
      setOpeningDocumentId(item.document_id);
      let kindName = 'Документ';
      if (item.document_kind_id) {
        try {
          const kind = await documentService.getKind(item.document_kind_id);
          kindName = kind?.name || kindName;
        } catch {
          // ignore
        }
      }
      setEditingDocument({ id: item.document_id, kindName });
    } catch (error) {
      console.error('Error opening document:', error);
    } finally {
      setOpeningDocumentId(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
          <FilesIcon size="lg" className="text-amber-400" />
          Файлы
        </h1>
      </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="header-tabs flex-1">
            <button type="button" className={`tab-button ${tab==='all'?'active':''}`} onClick={() => setTab('all')}>Все файлы</button>
            <button type="button" className={`tab-button ${tab==='my'?'active':''}`} onClick={() => setTab('my')}>Мои файлы</button>
            <button type="button" className={`tab-button ${tab==='favorites'?'active':''}`} onClick={() => setTab('favorites')}>Избранные файлы</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <SearchInput
            className="flex-1 min-w-[220px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск файлов и документов"
            inputClassName="form-input w-full"
          />
          <button
            type="button"
            onClick={fetchData}
            className="btn btn-primary shrink-0"
          >
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Загрузка...</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-slate-700/50 bg-slate-800/20 backdrop-blur-sm">
            <div className="text-xs text-slate-400 mb-2 px-4 pt-3">
              <IconWithText icon={LightbulbIcon} className="text-sm text-slate-400">
                Файлы проектов, вложения задач и привязанные документы. ПКМ по колонке «Проект» — фильтр. Нажмите на заголовки для сортировки.
              </IconWithText>
              {areProjectFiltersActive && (
                <span className="ml-2 text-cyan-400">
                  Фильтр по проекту активен
                </span>
              )}
              {sortConfig.field && (
                <span className="ml-2 text-blue-400">
                  Сортировка по: <strong>{sortConfig.field}</strong> ({sortConfig.direction === 'asc' ? 'по возрастанию' : 'по убыванию'})
                </span>
              )}
            </div>
            <table className="w-full text-left text-slate-200">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700/60 bg-slate-800/40">
                  <th
                    className="py-3 px-4 font-medium cursor-pointer relative hover:bg-slate-700/30 transition-colors"
                    onContextMenu={handleProjectContextMenu}
                    title="ПКМ — фильтр по проекту"
                  >
                    <div className="flex items-center justify-between gap-2">
                      Проект
                      {areProjectFiltersActive && (
                        <span className="text-cyan-400 text-xs" title="Фильтр активен">▾</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 font-medium cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      Имя
                      <span className="text-blue-400 text-xs">
                        {sortConfig.field === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 font-medium cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      Тип
                      <span className="text-blue-400 text-xs">
                        {sortConfig.field === 'type' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 font-medium cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => handleSort('size')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      Размер
                      <span className="text-blue-400 text-xs">
                        {sortConfig.field === 'size' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="py-3 px-4 font-medium">Создатель</th>
                  <th
                    className="py-3 px-4 font-medium cursor-pointer hover:bg-slate-700/30 transition-colors"
                    onClick={() => handleSort('uploaded_at')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      Дата
                      <span className="text-blue-400 text-xs">
                        {sortConfig.field === 'uploaded_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th className="py-3 px-4 font-medium">Избранное</th>
                  <th className="py-3 px-4 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-10 px-4 text-center text-slate-400">
                      {areProjectFiltersActive && rawItems.length > 0 && 'Нет файлов по выбранным проектам'}
                      {!areProjectFiltersActive && tab === 'favorites' && 'Нет избранных файлов'}
                      {!areProjectFiltersActive && tab === 'my' && 'У вас нет загруженных файлов и привязанных документов'}
                      {!areProjectFiltersActive && tab === 'all' && 'Файлы и документы не найдены'}
                      <div className="mt-2 text-sm">
                        {areProjectFiltersActive && rawItems.length > 0 && 'Измените фильтр по проекту (ПКМ на заголовке «Проект»)'}
                        {!areProjectFiltersActive && tab === 'all' && 'Загрузите файлы в проектах или привяжите документы в разделе «Документы»'}
                        {!areProjectFiltersActive && tab === 'my' && 'Загрузите файлы в проектах или создайте документы с привязкой к проекту'}
                        {!areProjectFiltersActive && tab === 'favorites' && 'Добавьте файлы или документы в избранное, нажав на звёздочку'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.key}
                      className={`border-t border-slate-700/40 hover:bg-slate-800/30 transition-colors${item.item_kind === 'document' ? ' cursor-pointer' : ''}${openingDocumentId === item.document_id ? ' opacity-70' : ''}`}
                      onClick={item.item_kind === 'document' ? () => handleOpenDocument(item) : undefined}
                    >
                      <td className="py-3 px-4">{getItemLocationLabel(item)}</td>
                      <td className="py-3 px-4 break-all">{item.filename}</td>
                      <td className="py-3 px-4">{item.content_type || '—'}</td>
                      <td className="py-3 px-4">{item.size != null ? `${Number(item.size).toLocaleString()} B` : '—'}</td>
                      <td className="py-3 px-4">{item.uploaded_by || '—'}</td>
                      <td className="py-3 px-4">
                        {item.uploaded_at
                          ? new Date(item.uploaded_at).toLocaleString('ru-RU')
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(item);
                          }}
                          className="inline-flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-slate-700/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                          title={item.is_favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                          aria-label={item.is_favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                          aria-pressed={item.is_favorite}
                        >
                          {item.is_favorite ? (
                            <StarFilledIcon size="md" className="text-white" />
                          ) : (
                            <StarOutlineIcon size="md" className="text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {item.item_kind === 'document' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDocument(item);
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            Открыть
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDownload(item)}
                            className="btn btn-primary btn-sm"
                          >
                            Скачать
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {contextMenu.open && typeof document !== 'undefined' && createPortal(
              <div
                ref={menuRef}
                className="fixed z-[10000] w-80 overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="border-b border-slate-700/60 bg-slate-800/60 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">Фильтр по проекту</h4>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Выбрано: {projectOptions.filter(([key]) => projectFilters[key] !== false).length} из {projectOptions.length}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => setAllProjectFilters(true)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-500/10"
                      >
                        Все
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllProjectFilters(false)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-700/60 hover:text-slate-200"
                      >
                        Сброс
                      </button>
                    </div>
                  </div>
                  <input
                    type="search"
                    value={projectFilterSearch}
                    onChange={(event) => setProjectFilterSearch(event.target.value)}
                    placeholder="Поиск проекта…"
                    className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>

                <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                  {projectsLoading ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Загрузка проектов…</p>
                  ) : projectOptions.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Проекты не найдены</p>
                  ) : (
                    projectOptions
                      .filter(([key]) => {
                        const queryText = projectFilterSearch.trim().toLowerCase();
                        if (!queryText) return true;
                        return getProjectFilterLabel(key).toLowerCase().includes(queryText);
                      })
                      .map(([key]) => {
                        const checked = projectFilters[key] !== false;
                        return (
                          <label
                            key={key}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                              checked
                                ? 'bg-slate-700/50 border border-slate-600/40'
                                : 'border border-transparent hover:bg-slate-800/80'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleProjectFilter(key)}
                              className="h-4 w-4 rounded border-slate-500 bg-slate-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500/40 focus:ring-offset-0"
                            />
                            <span className={`text-sm ${checked ? 'text-slate-100' : 'text-slate-400'}`}>
                              {getProjectFilterLabel(key)}
                            </span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>
        )}

      {editingDocument && (
        <DocumentEditorPanel
          documentId={editingDocument.id}
          kindName={editingDocument.kindName}
          onClose={() => setEditingDocument(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}
