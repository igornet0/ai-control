import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  FolderIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { documentService } from '../../../services/documentService';
import { taskService } from '../../../services/taskService';
import { dashboardService } from '../../../services/dashboardService';
import { sheetService } from '../../../services/sheetService';
import { projectService } from '../../../services/projectService';
import { dataModelService } from '../../../services/dataModelService';
import {
  buildEntityRef,
  dashboardDisplayTitle,
  dataModelDisplayTitle,
  documentDisplayTitle,
  projectDisplayTitle,
  sheetDisplayTitle,
  taskDisplayTitle,
  templateDisplayTitle,
} from '../../../services/messagingEntityRefs';
import styles from './EntityAttachPicker.module.css';

const TABS = [
  { id: 'document', label: 'Документы', Icon: DocumentTextIcon },
  { id: 'template', label: 'Шаблоны', Icon: DocumentDuplicateIcon },
  { id: 'task', label: 'Задачи', Icon: ClipboardDocumentListIcon },
  { id: 'project', label: 'Проекты', Icon: FolderIcon },
  { id: 'dashboard', label: 'Дашборды', Icon: ChartBarIcon },
  { id: 'data_model', label: 'Модели', Icon: CubeIcon },
];

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export default function EntityAttachPicker({
  open,
  onClose,
  onSelect,
  selectedKeys = [],
  allowedTabs = null,
  excludeDocumentIds = [],
}) {
  const visibleTabs = useMemo(() => {
    if (!allowedTabs?.length) return TABS;
    const set = new Set(allowedTabs);
    return TABS.filter((t) => set.has(t.id));
  }, [allowedTabs]);
  const [tab, setTab] = useState(() => visibleTabs[0]?.id || 'document');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dataModels, setDataModels] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [expandedDashboardId, setExpandedDashboardId] = useState(null);
  const [sheetsByDashboard, setSheetsByDashboard] = useState({});

  const excludeDocSet = useMemo(
    () => new Set((excludeDocumentIds || []).map((id) => Number(id)).filter(Number.isFinite)),
    [excludeDocumentIds],
  );

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const loadTabData = useCallback(async (activeTab) => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'document') {
        const data = await documentService.getDocuments(null, null, {
          limit: 200,
          search: search.trim() || undefined,
        });
        setDocuments(normalizeList(data));
      } else if (activeTab === 'template') {
        const data = await documentService.getTemplates();
        const list = normalizeList(data);
        const q = search.trim().toLowerCase();
        setTemplates(q
          ? list.filter((t) => templateDisplayTitle(t).toLowerCase().includes(q))
          : list);
      } else if (activeTab === 'task') {
        const data = await taskService.getTasks();
        setTasks(normalizeList(data));
      } else if (activeTab === 'project') {
        const data = await projectService.getProjects();
        setProjects(normalizeList(data));
      } else if (activeTab === 'data_model') {
        const data = await dataModelService.getDataModels();
        const list = normalizeList(data?.data_models ?? data);
        setDataModels(list);
      } else if (activeTab === 'dashboard') {
        const data = await dashboardService.getDashboards();
        setDashboards(normalizeList(data));
      }
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить список');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) return;
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0]?.id || 'document');
    }
  }, [open, tab, visibleTabs]);

  useEffect(() => {
    if (!open) return;
    loadTabData(tab);
  }, [open, tab, loadTabData]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setTab(visibleTabs[0]?.id || 'document');
      setExpandedDashboardId(null);
      setError('');
    }
  }, [open, visibleTabs]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => taskDisplayTitle(t).toLowerCase().includes(q));
  }, [tasks, search]);

  const filteredDashboards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dashboards;
    return dashboards.filter((d) => dashboardDisplayTitle(d).toLowerCase().includes(q));
  }, [dashboards, search]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => projectDisplayTitle(p).toLowerCase().includes(q));
  }, [projects, search]);

  const filteredDataModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dataModels;
    return dataModels.filter((m) => dataModelDisplayTitle(m).toLowerCase().includes(q));
  }, [dataModels, search]);

  const entityKey = (ref) =>
    `${ref.type}:${ref.id}${ref.dashboard_id ? `:${ref.dashboard_id}` : ''}`;

  const toggleRef = (ref) => {
    onSelect?.(ref);
  };

  const loadSheets = async (dashboardId) => {
    if (sheetsByDashboard[dashboardId]) {
      setExpandedDashboardId((prev) => (prev === dashboardId ? null : dashboardId));
      return;
    }
    try {
      const sheets = normalizeList(await sheetService.getDashboardSheets(dashboardId));
      setSheetsByDashboard((prev) => ({ ...prev, [dashboardId]: sheets }));
      setExpandedDashboardId(dashboardId);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить листы дашборда');
    }
  };

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Прикрепить из проекта"
      >
        <div className={styles.head}>
          <h3>Прикрепить из проекта</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.tabs}>
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={styles.searchRow}>
          <MagnifyingGlassIcon />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск…"
            className={styles.searchInput}
          />
          {tab === 'document' && (
            <button type="button" className={styles.searchBtn} onClick={() => loadTabData('document')}>
              Найти
            </button>
          )}
          {tab === 'template' && (
            <button type="button" className={styles.searchBtn} onClick={() => loadTabData('template')}>
              Найти
            </button>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.list}>
          {loading && <p className={styles.hint}>Загрузка…</p>}

          {!loading && tab === 'document' &&
            documents
              .filter((doc) => !excludeDocSet.has(Number(doc.id)))
              .map((doc) => {
              const ref = buildEntityRef('document', doc.id, documentDisplayTitle(doc));
              const key = entityKey(ref);
              const selected = selectedSet.has(key);
              return (
                <button
                  key={doc.id}
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
                  onClick={() => toggleRef(ref)}
                >
                  <DocumentTextIcon />
                  <span className={styles.itemTitle}>{documentDisplayTitle(doc)}</span>
                  {selected && <span className={styles.itemCheck}>✓</span>}
                </button>
              );
            })}

          {!loading && tab === 'template' &&
            templates.map((tpl) => {
              const ref = buildEntityRef('template', tpl.id, templateDisplayTitle(tpl));
              const key = entityKey(ref);
              const selected = selectedSet.has(key);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
                  onClick={() => toggleRef(ref)}
                >
                  <DocumentDuplicateIcon />
                  <span className={styles.itemTitle}>{templateDisplayTitle(tpl)}</span>
                  {selected && <span className={styles.itemCheck}>✓</span>}
                </button>
              );
            })}

          {!loading && tab === 'task' &&
            filteredTasks.map((task) => {
              const ref = buildEntityRef('task', task.id, taskDisplayTitle(task));
              const key = entityKey(ref);
              const selected = selectedSet.has(key);
              return (
                <button
                  key={task.id}
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
                  onClick={() => toggleRef(ref)}
                >
                  <ClipboardDocumentListIcon />
                  <span className={styles.itemTitle}>{taskDisplayTitle(task)}</span>
                  {selected && <span className={styles.itemCheck}>✓</span>}
                </button>
              );
            })}

          {!loading && tab === 'project' &&
            filteredProjects.map((project) => {
              const ref = buildEntityRef('project', project.id, projectDisplayTitle(project));
              const key = entityKey(ref);
              const selected = selectedSet.has(key);
              return (
                <button
                  key={project.id}
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
                  onClick={() => toggleRef(ref)}
                >
                  <FolderIcon />
                  <span className={styles.itemTitle}>{projectDisplayTitle(project)}</span>
                  {selected && <span className={styles.itemCheck}>✓</span>}
                </button>
              );
            })}

          {!loading && tab === 'data_model' &&
            filteredDataModels.map((model) => {
              const ref = buildEntityRef('data_model', model.id, dataModelDisplayTitle(model));
              const key = entityKey(ref);
              const selected = selectedSet.has(key);
              return (
                <button
                  key={model.id}
                  type="button"
                  className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
                  onClick={() => toggleRef(ref)}
                >
                  <CubeIcon />
                  <span className={styles.itemTitle}>{dataModelDisplayTitle(model)}</span>
                  {selected && <span className={styles.itemCheck}>✓</span>}
                </button>
              );
            })}

          {!loading && tab === 'dashboard' &&
            filteredDashboards.map((dashboard) => {
              const ref = buildEntityRef('dashboard', dashboard.id, dashboardDisplayTitle(dashboard));
              const key = entityKey(ref);
              const selected = selectedSet.has(key);
              const expanded = expandedDashboardId === dashboard.id;
              const sheets = sheetsByDashboard[dashboard.id] || [];
              return (
                <div key={dashboard.id} className={styles.dashboardGroup}>
                  <div className={styles.dashboardRow}>
                    <button
                      type="button"
                      className={`${styles.item} ${styles.itemGrow} ${selected ? styles.itemSelected : ''}`}
                      onClick={() => toggleRef(ref)}
                    >
                      <ChartBarIcon />
                      <span className={styles.itemTitle}>{dashboardDisplayTitle(dashboard)}</span>
                      {selected && <span className={styles.itemCheck}>✓</span>}
                    </button>
                    <button
                      type="button"
                      className={styles.sheetsBtn}
                      onClick={() => loadSheets(dashboard.id)}
                      title="Листы дашборда"
                    >
                      {expanded ? '▾' : '▸'} листы
                    </button>
                  </div>
                  {expanded &&
                    sheets.map((sheet) => {
                      const sheetRef = buildEntityRef(
                        'dashboard_sheet',
                        sheet.id,
                        `${dashboardDisplayTitle(dashboard)} · ${sheetDisplayTitle(sheet)}`,
                        { dashboardId: dashboard.id }
                      );
                      const sheetKey = entityKey(sheetRef);
                      const sheetSelected = selectedSet.has(sheetKey);
                      return (
                        <button
                          key={sheet.id}
                          type="button"
                          className={`${styles.item} ${styles.sheetItem} ${
                            sheetSelected ? styles.itemSelected : ''
                          }`}
                          onClick={() => toggleRef(sheetRef)}
                        >
                          <span className={styles.itemTitle}>{sheetDisplayTitle(sheet)}</span>
                          {sheetSelected && <span className={styles.itemCheck}>✓</span>}
                        </button>
                      );
                    })}
                </div>
              );
            })}

          {!loading && tab === 'document' && documents.filter((d) => !excludeDocSet.has(Number(d.id))).length === 0 && (
            <p className={styles.hint}>Документы не найдены</p>
          )}
          {!loading && tab === 'template' && templates.length === 0 && (
            <p className={styles.hint}>Шаблоны не найдены</p>
          )}
          {!loading && tab === 'task' && filteredTasks.length === 0 && (
            <p className={styles.hint}>Задачи не найдены</p>
          )}
          {!loading && tab === 'project' && filteredProjects.length === 0 && (
            <p className={styles.hint}>Проекты не найдены</p>
          )}
          {!loading && tab === 'data_model' && filteredDataModels.length === 0 && (
            <p className={styles.hint}>Модели данных не найдены</p>
          )}
          {!loading && tab === 'dashboard' && filteredDashboards.length === 0 && (
            <p className={styles.hint}>Дашборды не найдены</p>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
