import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { documentService } from '../../services/documentService';
import { projectService } from '../../services/projectService';
import { employeeService } from '../../services/employeeService';
import StructureConstructor from './StructureConstructor';
import AutofillConstructor from './AutofillConstructor';
import GlobalDefaultsScreen from './GlobalDefaultsScreen';
import DocumentEditorPanel from './DocumentEditorPanel';
import TemplatePreviewPanel from './TemplatePreviewPanel';
import CreateTemplateModal from './CreateTemplateModal';
import ResourceCard from './ResourceCard';
import DocumentFoldersView from './DocumentFoldersView';
import { useAuth } from '../../context/AuthContext';
import { useCollapsibleSidebar } from '../../hooks/useCollapsibleSidebar.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import MobileSidebarChrome from '../../components/layout/MobileSidebarChrome.jsx';
import { isSpreadsheetTemplate, isSpreadsheetDocument, getTemplateKind } from './templateTypeUtils';
import {
  matchesSearch,
  getCardAccent,
  countTemplateMeta,
  formatRelativeTime,
  getDocumentDisplayTitle,
  buildFilterEmptyMessage,
} from './documentsPageUtils';
import {
  loadRecentOpened,
  rememberRecentOpened,
  RECENT_KIND_ICONS,
  RECENT_KIND_LABELS,
} from './documentsRecentStorage';
import { getRecentItemAccentStyle, getRecentItemKindClass } from './documentsRecentColors';
import { DocIcon, IconFilterOff } from './DocumentIcons';
import styles from './DocumentsApp.module.css';

const NAV_SECTIONS = [
  {
    label: 'Шаблоны',
    items: [
      {
        id: 'template_docs',
        label: 'Документы',
        icon: 'templateDocument',
        title: 'Шаблоны листовых документов',
        breadcrumb: 'Шаблоны документов',
        subtitle: 'Листы с полями, таблицами и текстовыми блоками',
      },
      {
        id: 'template_tables',
        label: 'Таблицы',
        icon: 'templateTable',
        title: 'Шаблоны таблиц',
        breadcrumb: 'Шаблоны таблиц',
        subtitle: 'Сетки с колонками и стартовыми данными',
      },
    ],
  },
  {
    label: 'Данные',
    items: [
      {
        id: 'folders',
        label: 'Папки',
        icon: 'folder',
        title: 'Папки',
        breadcrumb: 'Папки',
      },
      {
        id: 'documents',
        label: 'Документы',
        icon: 'documentStack',
        title: 'Документы',
        breadcrumb: 'Документы',
        subtitle: 'Экземпляры, созданные по шаблонам',
      },
      {
        id: 'table_records',
        label: 'Таблицы',
        icon: 'grid',
        title: 'Сохранённые таблицы',
        breadcrumb: 'Таблицы',
        subtitle: 'Записи по шаблонам-сеткам',
      },
    ],
  },
  {
    label: 'Настройка',
    items: [
      {
        id: 'structure',
        label: 'Структура',
        icon: 'structure',
        title: 'Конструктор структуры документа',
        breadcrumb: 'Структура',
      },
      {
        id: 'autofill',
        label: 'Автозаполнение',
        icon: 'autofill',
        title: 'Конструктор логики автозаполнения',
        breadcrumb: 'Автозаполнение',
      },
      {
        id: 'defaults',
        label: 'Параметры',
        icon: 'settings',
        title: 'Глобальные параметры по умолчанию',
        breadcrumb: 'Параметры',
        subtitle: 'Общие настройки модуля',
      },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
const SEARCH_TABS = new Set(['template_docs', 'template_tables', 'documents', 'table_records', 'folders']);
const SIDEBAR_COLLAPSED_KEY = 'documents-sidebar-collapsed';

const DocumentsApp = () => {
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('template_docs');
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [foldersRefreshKey, setFoldersRefreshKey] = useState(0);
  const [editingDocKindId, setEditingDocKindId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [kinds, setKinds] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [previewTemplateId, setPreviewTemplateId] = useState(null);
  const [previewVariant, setPreviewVariant] = useState('document');
  const [structurePreselectedKindId, setStructurePreselectedKindId] = useState(null);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(null);
  const [creatingFromDoc, setCreatingFromDoc] = useState(null);
  const [documentFilterKindId, setDocumentFilterKindId] = useState('');
  const [documentFilterProjectId, setDocumentFilterProjectId] = useState('');
  const [documentFilterDepartmentId, setDocumentFilterDepartmentId] = useState('');
  const [templateFilterDepartmentId, setTemplateFilterDepartmentId] = useState('');
  const [documentFilterDateFrom, setDocumentFilterDateFrom] = useState('');
  const [documentFilterDateTo, setDocumentFilterDateTo] = useState('');
  const [documentFilterPendingOnly, setDocumentFilterPendingOnly] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [createTemplateMode, setCreateTemplateMode] = useState(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [seedingTableDefaults, setSeedingTableDefaults] = useState(false);
  const {
    collapsed: sidebarCollapsed,
    toggle: toggleSidebar,
    mobileOpen,
    closeMobile,
    openMobile,
  } = useCollapsibleSidebar(SIDEBAR_COLLAPSED_KEY);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [initialReviewOpen, setInitialReviewOpen] = useState(false);
  const [recentItems, setRecentItems] = useState(() => loadRecentOpened());
  const prevUrlDocTrackedRef = useRef(null);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await documentService.getTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Не удалось загрузить шаблоны');
      setTemplates([]);
    }
  }, []);

  const loadKinds = useCallback(async () => {
    try {
      const data = await documentService.getKinds();
      setKinds(Array.isArray(data) ? data : []);
    } catch (e) {
      setKinds([]);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await documentService.getDocuments();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Не удалось загрузить документы');
      setDocuments([]);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const data = await projectService.getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const data = await employeeService.getDepartments();
      setDepartments(Array.isArray(data) ? data : []);
    } catch {
      setDepartments([]);
    }
  }, []);

  useEffect(() => {
    setError(null);
    setLoading(true);
    Promise.all([loadTemplates(), loadKinds(), loadDocuments(), loadProjects(), loadDepartments()])
      .finally(() => setLoading(false));
  }, [loadTemplates, loadKinds, loadDocuments, loadProjects, loadDepartments]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const docId = params.get('document');
    const templateId = params.get('template');
    const review = params.get('review');
    if (docId) {
      const parsed = Number(docId);
      if (!Number.isNaN(parsed)) {
        setActiveTab('documents');
        setEditingDocumentId(parsed);
        setSelectedDocId(parsed);
        setInitialReviewOpen(review === '1');
      }
    }
    if (templateId) {
      const parsed = Number(templateId);
      if (!Number.isNaN(parsed)) {
        setPreviewTemplateId(parsed);
      }
    }
  }, [location.search]);

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  const getKindName = useCallback((kindId) => {
    const k = kinds.find((x) => x.id === kindId);
    return k ? k.name : `Вид ${kindId}`;
  }, [kinds]);

  const syncRecentItems = useCallback(() => {
    setRecentItems(loadRecentOpened());
  }, []);

  const trackRecentOpen = useCallback((entry) => {
    if (!entry?.kind || entry.id == null) return;
    rememberRecentOpened(entry);
    syncRecentItems();
  }, [syncRecentItems]);

  const openTemplatePreview = useCallback((t) => {
    if (!t?.id) return;
    setPreviewTemplateId(t.id);
    setPreviewVariant(getTemplateKind(t));
    trackRecentOpen({
      kind: isSpreadsheetTemplate(t) ? 'template_table' : 'template_document',
      id: t.id,
      title: t.name || `Шаблон #${t.id}`,
    });
  }, [trackRecentOpen]);

  const openDocumentEditor = useCallback((d, { keepTab = false } = {}) => {
    if (!d?.id) return;
    const isTable = isSpreadsheetDocument(d, templates);
    if (!keepTab) setActiveTab(isTable ? 'table_records' : 'documents');
    setEditingDocumentId(d.id);
    setEditingDocKindId(d.document_kind_id ?? null);
    setSelectedDocId(d.id);
    trackRecentOpen({
      kind: isTable ? 'table_record' : 'document',
      id: d.id,
      title: getDocumentDisplayTitle(d, templates, getKindName(d.document_kind_id)),
      documentKindId: d.document_kind_id,
    });
  }, [templates, getKindName, trackRecentOpen]);

  useEffect(() => {
    if (!editingDocumentId || documents.length === 0) return;
    if (prevUrlDocTrackedRef.current === editingDocumentId) return;
    prevUrlDocTrackedRef.current = editingDocumentId;
    const d = documents.find((doc) => String(doc.id) === String(editingDocumentId));
    if (!d) return;
    const isTable = isSpreadsheetDocument(d, templates);
    trackRecentOpen({
      kind: isTable ? 'table_record' : 'document',
      id: d.id,
      title: getDocumentDisplayTitle(d, templates, getKindName(d.document_kind_id)),
      documentKindId: d.document_kind_id,
    });
  }, [editingDocumentId, documents, templates, getKindName, trackRecentOpen]);

  const resolvedRecentItems = useMemo(() => recentItems.map((item) => {
    if (item.kind === 'template_document' || item.kind === 'template_table') {
      const t = templates.find((x) => String(x.id) === String(item.id));
      return {
        ...item,
        title: t?.name || item.title,
        missing: !t,
      };
    }
    const d = documents.find((x) => String(x.id) === String(item.id));
    return {
      ...item,
      title: d
        ? getDocumentDisplayTitle(d, templates, getKindName(d.document_kind_id))
        : item.title,
      documentKindId: d?.document_kind_id ?? item.documentKindId,
      missing: !d,
    };
  }), [recentItems, templates, documents, getKindName]);

  const openRecentItem = useCallback((item) => {
    if (!item || item.missing) return;
    if (item.kind === 'template_document' || item.kind === 'template_table') {
      const t = templates.find((x) => String(x.id) === String(item.id));
      if (!t) return;
      setActiveTab(item.kind === 'template_table' ? 'template_tables' : 'template_docs');
      openTemplatePreview(t);
      return;
    }
    const d = documents.find((x) => String(x.id) === String(item.id));
    if (!d) return;
    openDocumentEditor(d);
  }, [templates, documents, openTemplatePreview, openDocumentEditor]);

  const handleCreateFromTemplate = async (templateId) => {
    setCreatingFromTemplate(templateId);
    setError(null);
    try {
      await documentService.createFromTemplate(templateId);
      await loadDocuments();
      const t = templates.find((x) => String(x.id) === String(templateId));
      if (t && isSpreadsheetTemplate(t)) {
        setActiveTab('table_records');
      } else {
        setActiveTab('documents');
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось создать документ по шаблону');
    } finally {
      setCreatingFromTemplate(null);
    }
  };

  const handleSeedDefaultTemplates = async () => {
    setSeedingDefaults(true);
    setError(null);
    try {
      await documentService.seedDefaultTemplates();
      await Promise.all([loadTemplates(), loadKinds()]);
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.message || 'Не удалось инициализировать шаблоны');
    } finally {
      setSeedingDefaults(false);
    }
  };

  const handleSeedDefaultTableTemplates = async () => {
    setSeedingTableDefaults(true);
    setError(null);
    try {
      await documentService.seedDefaultTableTemplates();
      await Promise.all([loadTemplates(), loadKinds()]);
    } catch (e) {
      setError(e.response?.data?.detail || e.response?.data?.message || 'Не удалось инициализировать шаблоны таблиц');
    } finally {
      setSeedingTableDefaults(false);
    }
  };

  const handleCreateFromDocument = async (docId = null) => {
    const id = docId ?? selectedDocId;
    if (!id) return;
    setCreatingFromDoc(id);
    setError(null);
    try {
      await documentService.createFromDocument(id);
      await loadDocuments();
      setSelectedDocId(null);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось создать документ на основании');
    } finally {
      setCreatingFromDoc(null);
    }
  };

  const documentTemplates = useMemo(
    () => (templates || []).filter((t) => !isSpreadsheetTemplate(t)),
    [templates]
  );
  const tableTemplates = useMemo(
    () => (templates || []).filter((t) => isSpreadsheetTemplate(t)),
    [templates]
  );

  const kindsWithTemplates = useMemo(() => {
    const kindIds = new Set((templates || []).map((t) => t.document_kind_id));
    const list = (kinds || []).filter((k) => kindIds.has(k.id));
    if (structurePreselectedKindId) {
      const preselectId = String(structurePreselectedKindId);
      const hasPreselect = list.some((k) => String(k.id) === preselectId);
      if (!hasPreselect) {
        const preselectKind = (kinds || []).find((k) => String(k.id) === preselectId);
        if (preselectKind) return [preselectKind, ...list];
      }
    }
    return list;
  }, [kinds, templates, structurePreselectedKindId]);

  const dateFilteredDocuments = useMemo(() => {
    let list = documents;
    if (documentFilterDateFrom) {
      const from = new Date(documentFilterDateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((d) => {
        const created = d.created ? new Date(d.created) : null;
        return created && created >= from;
      });
    }
    if (documentFilterDateTo) {
      const to = new Date(documentFilterDateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((d) => {
        const created = d.created ? new Date(d.created) : null;
        return created && created <= to;
      });
    }
    return list;
  }, [documents, documentFilterDateFrom, documentFilterDateTo]);

  const getProjectLabel = (projectId, projectName) => {
    if (projectName) return projectName;
    if (!projectId) return null;
    const project = projects.find((item) => item.id === projectId);
    return project?.name || `Проект #${projectId}`;
  };

  const getDepartmentLabel = (departmentId, departmentName) => {
    if (departmentName) return departmentName;
    if (!departmentId) return null;
    const dept = departments.find((item) => item.id === departmentId);
    return dept?.name || `Отдел #${departmentId}`;
  };

  const filteredDocuments = useMemo(() => {
    let list = dateFilteredDocuments;
    if (documentFilterKindId !== '' && documentFilterKindId != null) {
      const kindId = Number(documentFilterKindId);
      if (!Number.isNaN(kindId)) list = list.filter((d) => d.document_kind_id === kindId);
    }
    if (documentFilterProjectId !== '' && documentFilterProjectId != null) {
      if (documentFilterProjectId === 'none') {
        list = list.filter((d) => !d.project_id);
      } else {
        const projectId = Number(documentFilterProjectId);
        if (!Number.isNaN(projectId)) list = list.filter((d) => d.project_id === projectId);
      }
    }
    if (documentFilterDepartmentId !== '' && documentFilterDepartmentId != null) {
      if (documentFilterDepartmentId === 'none') {
        list = list.filter((d) => !d.department_id);
      } else {
        const deptId = Number(documentFilterDepartmentId);
        if (!Number.isNaN(deptId)) list = list.filter((d) => d.department_id === deptId);
      }
    }
    if (documentFilterPendingOnly) {
      list = list.filter((d) => (d.pending_proposals_count ?? 0) > 0);
    }
    return list;
  }, [dateFilteredDocuments, documentFilterKindId, documentFilterProjectId, documentFilterDepartmentId, documentFilterPendingOnly]);

  const filterTemplatesByDepartment = useCallback((list) => {
    if (templateFilterDepartmentId === '' || templateFilterDepartmentId == null) return list;
    if (templateFilterDepartmentId === 'none') {
      return list.filter((t) => !t.department_id);
    }
    const deptId = Number(templateFilterDepartmentId);
    if (Number.isNaN(deptId)) return list;
    return list.filter((t) => t.department_id === deptId);
  }, [templateFilterDepartmentId]);

  const listDocuments = useMemo(
    () => filteredDocuments.filter((d) => !isSpreadsheetDocument(d, templates)),
    [filteredDocuments, templates]
  );
  const listTableRecords = useMemo(
    () => filteredDocuments.filter((d) => isSpreadsheetDocument(d, templates)),
    [filteredDocuments, templates]
  );

  const documentsForKindFilter = useMemo(
    () => dateFilteredDocuments.filter((d) => !isSpreadsheetDocument(d, templates)),
    [dateFilteredDocuments, templates]
  );
  const tableRecordsForKindFilter = useMemo(
    () => dateFilteredDocuments.filter((d) => isSpreadsheetDocument(d, templates)),
    [dateFilteredDocuments, templates]
  );

  const kindIdsInList = (list) => new Set((list || []).map((d) => d.document_kind_id));

  const kindsForDocumentFilter = useMemo(() => {
    const ids = kindIdsInList(documentsForKindFilter);
    return (kinds || []).filter((k) => ids.has(k.id));
  }, [kinds, documentsForKindFilter]);

  const kindsForTableFilter = useMemo(() => {
    const ids = kindIdsInList(tableRecordsForKindFilter);
    return (kinds || []).filter((k) => ids.has(k.id));
  }, [kinds, tableRecordsForKindFilter]);

  const pendingProposalsCountForTab = useMemo(() => {
    const base = activeTab === 'table_records' ? tableRecordsForKindFilter : documentsForKindFilter;
    let list = base;
    if (documentFilterKindId !== '' && documentFilterKindId != null) {
      const kindId = Number(documentFilterKindId);
      if (!Number.isNaN(kindId)) list = list.filter((d) => d.document_kind_id === kindId);
    }
    if (documentFilterProjectId !== '' && documentFilterProjectId != null) {
      if (documentFilterProjectId === 'none') {
        list = list.filter((d) => !d.project_id);
      } else {
        const projectId = Number(documentFilterProjectId);
        if (!Number.isNaN(projectId)) list = list.filter((d) => d.project_id === projectId);
      }
    }
    if (documentFilterDepartmentId !== '' && documentFilterDepartmentId != null) {
      if (documentFilterDepartmentId === 'none') {
        list = list.filter((d) => !d.department_id);
      } else {
        const deptId = Number(documentFilterDepartmentId);
        if (!Number.isNaN(deptId)) list = list.filter((d) => d.department_id === deptId);
      }
    }
    return list.filter((d) => (d.pending_proposals_count ?? 0) > 0).length;
  }, [
    activeTab,
    documentsForKindFilter,
    tableRecordsForKindFilter,
    documentFilterKindId,
    documentFilterProjectId,
    documentFilterDepartmentId,
  ]);

  const hasActiveDocumentFilters = useMemo(
    () => Boolean(
      documentFilterKindId
      || documentFilterProjectId
      || documentFilterDepartmentId
      || documentFilterDateFrom
      || documentFilterDateTo
      || documentFilterPendingOnly
      || String(searchQuery || '').trim(),
    ),
    [
      documentFilterKindId,
      documentFilterProjectId,
      documentFilterDepartmentId,
      documentFilterDateFrom,
      documentFilterDateTo,
      documentFilterPendingOnly,
      searchQuery,
    ],
  );

  const tabTitleParts = useMemo(() => {
    if (editingDocumentId) {
      const d = documents.find((doc) => String(doc.id) === String(editingDocumentId));
      if (!d) return ['Документы'];
      const isTable = isSpreadsheetDocument(d, templates);
      return [
        getDocumentDisplayTitle(d, templates, getKindName(d.document_kind_id)),
        isTable ? 'Таблицы' : 'Документы',
      ];
    }
    if (previewTemplateId != null) {
      const t = templates.find((x) => String(x.id) === String(previewTemplateId));
      return [
        t?.name || `Шаблон #${previewTemplateId}`,
        t && isSpreadsheetTemplate(t) ? 'Шаблоны таблиц' : 'Шаблоны документов',
      ];
    }
    const navItem = ALL_NAV_ITEMS.find((item) => item.id === activeTab);
    return [navItem?.breadcrumb, 'Документы'];
  }, [editingDocumentId, previewTemplateId, documents, templates, activeTab, getKindName]);
  useDocumentTitle(tabTitleParts);

  const clearDocumentFilters = useCallback(() => {
    setDocumentFilterKindId('');
    setDocumentFilterProjectId('');
    setDocumentFilterDepartmentId('');
    setDocumentFilterDateFrom('');
    setDocumentFilterDateTo('');
    setDocumentFilterPendingOnly(false);
    setSearchQuery('');
  }, []);

  const showCreateTemplate = activeTab === 'template_docs' || activeTab === 'template_tables';
  const isDocumentListTab = activeTab === 'documents' || activeTab === 'table_records';
  const currentDocList = activeTab === 'table_records' ? listTableRecords : listDocuments;
  const currentKindsForFilter = activeTab === 'table_records' ? kindsForTableFilter : kindsForDocumentFilter;
  const emptyDocHint = activeTab === 'table_records'
    ? 'Создайте таблицу по шаблону во вкладке «Шаблоны таблиц» — кнопка «Создать таблицу по шаблону».'
    : 'Создайте документ по шаблону во вкладке «Шаблоны документов».';

  const activeTabConfig = ALL_NAV_ITEMS.find((t) => t.id === activeTab) || ALL_NAV_ITEMS[0];
  const showSearch = SEARCH_TABS.has(activeTab);

  const searchFilteredDocumentTemplates = useMemo(
    () => filterTemplatesByDepartment(documentTemplates).filter((t) => matchesSearch(t.name, getKindName(t.document_kind_id), searchQuery)),
    [documentTemplates, kinds, searchQuery, filterTemplatesByDepartment]
  );
  const searchFilteredTableTemplates = useMemo(
    () => filterTemplatesByDepartment(tableTemplates).filter((t) => matchesSearch(t.name, getKindName(t.document_kind_id), searchQuery)),
    [tableTemplates, kinds, searchQuery, filterTemplatesByDepartment]
  );
  const searchFilteredDocList = useMemo(
    () => currentDocList.filter((d) => {
      const title = getDocumentDisplayTitle(d, templates, getKindName(d.document_kind_id));
      return matchesSearch(title, getKindName(d.document_kind_id), searchQuery);
    }),
    [currentDocList, kinds, templates, searchQuery]
  );

  const pageStats = useMemo(
    () => [
      { label: 'Шаблонов', value: templates.length, icon: 'templateDocument' },
      { label: 'Документов', value: documents.length, icon: 'documentStack' },
      { label: 'Видов', value: kinds.length, icon: 'tag' },
    ],
    [templates.length, documents.length, kinds.length]
  );

  const renderTemplateDepartmentFilter = () => (
    <div className={styles.docFilters}>
      <label className={styles.docFilterLabel}>
        Отдел:
        <select
          className={styles.docFilterSelect}
          value={templateFilterDepartmentId}
          onChange={(e) => setTemplateFilterDepartmentId(e.target.value)}
          aria-label="Фильтр шаблонов по отделу"
        >
          <option value="">Все отделы</option>
          <option value="none">Общие (без отдела)</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>{dept.name}</option>
          ))}
        </select>
      </label>
    </div>
  );

  const templateFilterEmptyMessage = buildFilterEmptyMessage({
    searchQuery,
    departmentId: templateFilterDepartmentId,
    departmentName: getDepartmentLabel(
      templateFilterDepartmentId === 'none' ? null : Number(templateFilterDepartmentId),
    ),
  });

  const documentFilterEmptyMessage = buildFilterEmptyMessage({
    searchQuery,
    departmentId: documentFilterDepartmentId,
    departmentName: getDepartmentLabel(
      documentFilterDepartmentId === 'none' ? null : Number(documentFilterDepartmentId),
    ),
    kindName: documentFilterKindId
      ? getKindName(Number(documentFilterKindId))
      : '',
    projectId: documentFilterProjectId,
    projectName: documentFilterProjectId === 'none'
      ? null
      : getProjectLabel(Number(documentFilterProjectId)),
    dateFrom: documentFilterDateFrom,
    dateTo: documentFilterDateTo,
    pendingOnly: documentFilterPendingOnly,
  });

  const renderLoading = () => (
    <div className={`${styles.emptyState} ${styles.loadingPulse}`}>
      <div className={styles.emptyStateIcon}>
        <DocIcon name="loading" size={48} className={styles.docIconSpin} />
      </div>
      <p className={styles.emptyStateText}>Загрузка…</p>
    </div>
  );

  const selectTab = (id) => {
    setActiveTab(id);
    closeMobile();
  };

  return (
    <>
    <MobileSidebarChrome
      open={mobileOpen}
      onOpen={openMobile}
      onClose={closeMobile}
      label="Разделы документов"
    />
    <div className={styles.container}>
      <aside
        className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}
        data-app-sidebar
        data-open={mobileOpen ? 'true' : 'false'}
      >
        <div className={styles.sidebarBrand}>
          <span className={styles.sidebarBrandIcon} aria-hidden>
            <DocIcon name="templateDocument" size={18} />
          </span>
          <div className={styles.sidebarBrandText}>
            <h2 className={styles.sidebarTitle}>Документы</h2>
          </div>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
            title={sidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
          >
            <DocIcon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
          </button>
        </div>
        <nav className={styles.sidebarNav} aria-label="Раздел документов">
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label} className={styles.navSection}>
              {si > 0 && <div className={styles.navSectionDivider} aria-hidden />}
              <span className={styles.navSectionLabel}>{section.label}</span>
              <ul className={styles.tabList}>
                {section.items.map((tab) => (
                  <li key={tab.id}>
                    <button
                      type="button"
                      className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
                      onClick={() => selectTab(tab.id)}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                      title={sidebarCollapsed ? tab.label : undefined}
                    >
                      <span className={styles.tabButtonIcon} aria-hidden>
                        <DocIcon name={tab.icon} size={16} />
                      </span>
                      <span className={styles.tabButtonLabel}>{tab.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.sidebarRecent} aria-label="Недавно открытые">
          {!sidebarCollapsed && (
            <span className={styles.sidebarRecentLabel}>Недавние</span>
          )}
          {resolvedRecentItems.length === 0 ? (
            !sidebarCollapsed && (
              <p className={styles.sidebarRecentEmpty}>Откройте документ или шаблон</p>
            )
          ) : (
            <ul className={styles.recentList}>
              {resolvedRecentItems.map((item) => {
                const iconName = RECENT_KIND_ICONS[item.kind] || 'documentStack';
                const typeLabel = RECENT_KIND_LABELS[item.kind] || '';
                const rel = formatRelativeTime(new Date(item.openedAt).toISOString());
                const tip = `${typeLabel}: ${item.title}${rel ? ` · ${rel}` : ''}`;
                const kindClass = styles[getRecentItemKindClass(item.kind)] || '';
                const accentStyle = item.missing ? undefined : getRecentItemAccentStyle(item.kind, item.documentKindId);
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <button
                      type="button"
                      className={`${styles.recentItem} ${kindClass} ${item.missing ? styles.recentItemMissing : ''}`}
                      style={accentStyle}
                      onClick={() => openRecentItem(item)}
                      disabled={item.missing}
                      title={item.missing ? `${item.title} (удалён)` : tip}
                    >
                      <span className={styles.recentItemIcon} aria-hidden>
                        <DocIcon name={iconName} size={15} />
                      </span>
                      {!sidebarCollapsed && (
                        <span className={styles.recentItemText}>
                          <span className={styles.recentItemTitle}>{item.title}</span>
                          <span className={styles.recentItemMeta}>{typeLabel}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.topToolbar}>
          <div className={styles.toolbarLeft}>
            <p className={styles.breadcrumb}>
              <span>Документы</span>
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbCurrent}>{activeTabConfig.breadcrumb}</span>
            </p>
            <h1 className={styles.pageTitle}>{activeTabConfig.title}</h1>
          </div>
          <div className={styles.toolbarRight}>
            {showSearch && (
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon} aria-hidden>
                  <DocIcon name="search" size={16} />
                </span>
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Поиск по названию…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Поиск"
                />
              </div>
            )}
          </div>
        </div>
        <div className={styles.mainBody}>
          {activeTab === 'defaults' && (
            <div className={styles.statsRow} aria-label="Сводка">
              {pageStats.map((s) => (
                <div key={s.label} className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden>
                    <DocIcon name={s.icon} size={22} />
                  </span>
                  <div>
                    <span className={styles.statValue}>{loading ? '—' : s.value}</span>
                    <span className={styles.statLabel}>{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <div className={styles.error} role="alert">{error}</div>}
          {(activeTabConfig.subtitle || showCreateTemplate) && (
          <header className={styles.header}>
            <div>
              {activeTabConfig.subtitle && (
                <p className={styles.pageSubtitle}>{activeTabConfig.subtitle}</p>
              )}
            </div>
            {showCreateTemplate && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => {
                    setCreateTemplateMode(activeTab === 'template_tables' ? 'spreadsheet' : 'document');
                    setCreateTemplateOpen(true);
                  }}
                >
                  {activeTab === 'template_tables' ? 'Создать шаблон таблицы' : 'Создать шаблон документа'}
                </button>
              </div>
            )}
          </header>
          )}
          <div className={styles.content}>
            <div className={styles.contentPanel}>
            {activeTab === 'template_docs' && (
              <section className={styles.section}>
                {loading ? renderLoading() : documentTemplates.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon} aria-hidden>
                      <DocIcon name="clipboard" size={48} />
                    </div>
                    <h3 className={styles.emptyStateTitle}>Нет шаблонов документов</h3>
                    <p className={styles.emptyStateText}>
                      Создайте лист с полями и текстом или инициализируйте типовые шаблоны. Шаблоны только с таблицей-сеткой показаны во вкладке «Шаблоны таблиц».
                    </p>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleSeedDefaultTemplates}
                      disabled={seedingDefaults}
                    >
                      {seedingDefaults ? 'Инициализация…' : 'Инициализировать дефолтные документы'}
                    </button>
                  </div>
                ) : (
                <>
                {renderTemplateDepartmentFilter()}
                {searchFilteredDocumentTemplates.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>{templateFilterEmptyMessage}</p>
                  </div>
                ) : (
                <ul className={styles.cardList}>
                  {searchFilteredDocumentTemplates.map((t) => {
                    const kindName = getKindName(t.document_kind_id);
                    const subtitle = kindName !== t.name ? kindName : 'Типовой шаблон';
                    const meta = countTemplateMeta(t);
                    return (
                      <ResourceCard
                        key={t.id}
                        accent={getCardAccent(t.id)}
                        icon="templateDocument"
                        title={t.name}
                        subtitle={subtitle}
                        badge={t.version ? `v${t.version}` : null}
                        meta={meta.label}
                        metaDetail={
                          [
                            t.department_id
                              ? `Отдел: ${getDepartmentLabel(t.department_id, t.department_name)}`
                              : null,
                            t.default_project_id
                              ? `Проект: ${getProjectLabel(t.default_project_id, t.project_name)}`
                              : meta.detail,
                          ].filter(Boolean).join(' · ') || meta.detail
                        }
                        hint="Предпросмотр · клик по карточке"
                        onOpen={() => openTemplatePreview(t)}
                        primaryLabel="Создать документ"
                        primaryAction={() => handleCreateFromTemplate(t.id)}
                        primaryLoading={creatingFromTemplate === t.id}
                        primaryDisabled={!!creatingFromTemplate}
                        ariaLabel={`${t.name}, предпросмотр шаблона`}
                      />
                    );
                  })}
                </ul>
                )}
                </>
                )}
              </section>
            )}

            {activeTab === 'template_tables' && (
              <section className={styles.section}>
                {loading ? renderLoading() : tableTemplates.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon} aria-hidden>
                      <DocIcon name="grid" size={48} />
                    </div>
                    <h3 className={styles.emptyStateTitle}>Нет шаблонов таблиц</h3>
                    <p className={styles.emptyStateText}>
                      Создайте сетку вручную или инициализируйте типовые шаблоны таблиц с колонками и стартовыми данными.
                    </p>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={handleSeedDefaultTableTemplates}
                      disabled={seedingTableDefaults}
                    >
                      {seedingTableDefaults ? 'Инициализация…' : 'Инициализировать дефолтные таблицы'}
                    </button>
                  </div>
                ) : (
                <>
                {renderTemplateDepartmentFilter()}
                {searchFilteredTableTemplates.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>{templateFilterEmptyMessage}</p>
                  </div>
                ) : (
                <ul className={styles.cardList}>
                  {searchFilteredTableTemplates.map((t) => {
                    const kindName = getKindName(t.document_kind_id);
                    const meta = countTemplateMeta(t);
                    return (
                      <ResourceCard
                        key={t.id}
                        accent={getCardAccent(t.id)}
                        icon="templateTable"
                        title={t.name}
                        subtitle={kindName}
                        badge={t.version ? `v${t.version}` : 'Сетка'}
                        meta={meta.label}
                        metaDetail={
                          [
                            t.department_id
                              ? `Отдел: ${getDepartmentLabel(t.department_id, t.department_name)}`
                              : null,
                            t.default_project_id
                              ? `Проект: ${getProjectLabel(t.default_project_id, t.project_name)}`
                              : meta.detail,
                          ].filter(Boolean).join(' · ') || meta.detail
                        }
                        hint="Таблица · предпросмотр сетки"
                        onOpen={() => openTemplatePreview(t)}
                        primaryLabel="Создать таблицу"
                        primaryAction={() => handleCreateFromTemplate(t.id)}
                        primaryLoading={creatingFromTemplate === t.id}
                        primaryDisabled={!!creatingFromTemplate}
                        ariaLabel={`${t.name}, предпросмотр таблицы`}
                      />
                    );
                  })}
                </ul>
                )}
                </>
                )}
              </section>
            )}

            {isDocumentListTab && (
              <section className={styles.section}>
                {loading ? renderLoading() : documents.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon} aria-hidden>
                      <DocIcon name="documentStack" size={48} />
                    </div>
                    <h3 className={styles.emptyStateTitle}>Пока пусто</h3>
                    <p className={styles.emptyStateText}>{emptyDocHint}</p>
                  </div>
                ) : (
                <>
                <div className={styles.docFilters}>
                  <label className={styles.docFilterLabel}>
                    Вид:
                    <select
                      className={styles.docFilterSelect}
                      value={currentKindsForFilter.some((k) => String(k.id) === String(documentFilterKindId)) ? documentFilterKindId : ''}
                      onChange={(e) => setDocumentFilterKindId(e.target.value)}
                      aria-label="Вид"
                    >
                      <option value="">Все виды</option>
                      {currentKindsForFilter.map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.docFilterLabel}>
                    Проект:
                    <select
                      className={styles.docFilterSelect}
                      value={documentFilterProjectId}
                      onChange={(e) => setDocumentFilterProjectId(e.target.value)}
                      aria-label="Фильтр по проекту"
                    >
                      <option value="">Все проекты</option>
                      <option value="none">Без проекта</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>{project.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.docFilterLabel}>
                    Отдел:
                    <select
                      className={styles.docFilterSelect}
                      value={documentFilterDepartmentId}
                      onChange={(e) => setDocumentFilterDepartmentId(e.target.value)}
                      aria-label="Фильтр по отделу"
                    >
                      <option value="">Все отделы</option>
                      <option value="none">Общие (без отдела)</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.docFilterLabel}>
                    Дата от:
                    <input
                      type="date"
                      className={styles.docFilterInput}
                      value={documentFilterDateFrom}
                      onChange={(e) => setDocumentFilterDateFrom(e.target.value)}
                      aria-label="Дата от"
                    />
                  </label>
                  <label className={styles.docFilterLabel}>
                    Дата до:
                    <input
                      type="date"
                      className={styles.docFilterInput}
                      value={documentFilterDateTo}
                      onChange={(e) => setDocumentFilterDateTo(e.target.value)}
                      aria-label="Дата до"
                    />
                  </label>
                  <label className={styles.docFilterLabel}>
                    Изменения:
                    <select
                      className={styles.docFilterSelect}
                      value={documentFilterPendingOnly ? 'pending' : ''}
                      onChange={(e) => setDocumentFilterPendingOnly(e.target.value === 'pending')}
                      aria-label="Фильтр по предложенным изменениям"
                    >
                      <option value="">Все</option>
                      <option value="pending">
                        С предложениями{pendingProposalsCountForTab > 0 ? ` (${pendingProposalsCountForTab})` : ''}
                      </option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.docFiltersClear}
                    onClick={clearDocumentFilters}
                    disabled={!hasActiveDocumentFilters}
                    title="Сбросить все фильтры"
                    aria-label="Сбросить все фильтры"
                  >
                    <IconFilterOff size={16} aria-hidden />
                    <span>Сбросить</span>
                  </button>
                </div>
                {searchFilteredDocList.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyStateText}>{documentFilterEmptyMessage}</p>
                  </div>
                ) : (
                <ul className={styles.cardList}>
                  {searchFilteredDocList.map((d) => {
                    const title = getDocumentDisplayTitle(d, templates, getKindName(d.document_kind_id));
                    const rel = formatRelativeTime(d.updated || d.created);
                    return (
                      <ResourceCard
                        key={d.id}
                        accent={getCardAccent(d.id)}
                        icon={activeTab === 'table_records' ? 'grid' : 'documentStack'}
                        title={title}
                        subtitle={getKindName(d.document_kind_id)}
                        badge={
                          d.pending_proposals_count > 0
                            ? `Предложений: ${d.pending_proposals_count}`
                            : (d.number ? `№ ${d.number}` : null)
                        }
                        meta={rel || (d.created ? new Date(d.created).toLocaleDateString('ru-RU') : '')}
                        metaDetail={
                          [
                            d.department_id
                              ? `Отдел: ${getDepartmentLabel(d.department_id, d.department_name)}`
                              : null,
                            d.folder_name ? `Папка: ${d.folder_name}` : null,
                            d.project_id
                              ? `Проект: ${getProjectLabel(d.project_id, d.project_name)}`
                              : (activeTab === 'table_records' ? 'Таблица' : 'Документ'),
                          ].filter(Boolean).join(' · ')
                        }
                        hint="Открыть редактор"
                        selected={selectedDocId === d.id}
                        onOpen={() => openDocumentEditor(d)}
                        primaryLabel="Создать на основании"
                        primaryAction={() => handleCreateFromDocument(d.id)}
                        primaryLoading={creatingFromDoc === d.id}
                        primaryDisabled={!!creatingFromDoc}
                        ariaLabel={title}
                      />
                    );
                  })}
                </ul>
                )}
                </>
                )}
              </section>
            )}

            {activeTab === 'folders' && (
              <section className={styles.section}>
                <DocumentFoldersView
                  currentUserId={currentUser?.id}
                  folderId={activeFolderId}
                  onFolderChange={setActiveFolderId}
                  templates={templates}
                  myDocuments={documents}
                  getKindName={getKindName}
                  searchQuery={searchQuery}
                  refreshKey={foldersRefreshKey}
                  onOpenDocument={(d) => openDocumentEditor(d, { keepTab: true })}
                  onDocumentsChanged={loadDocuments}
                />
              </section>
            )}

            {activeTab === 'structure' && (
              <section className={styles.section}>
                <StructureConstructor
                  kinds={kindsWithTemplates}
                  templates={templates}
                  initialKindId={structurePreselectedKindId ?? undefined}
                  onPreselectConsumed={() => setStructurePreselectedKindId(null)}
                />
              </section>
            )}
            {activeTab === 'autofill' && (
              <section className={styles.section}>
                <AutofillConstructor templates={templates} kinds={kinds} />
              </section>
            )}
            {activeTab === 'defaults' && (
              <section className={styles.section}>
                <GlobalDefaultsScreen />
              </section>
            )}
            </div>
          </div>
        </div>
      </main>
    </div>
      {editingDocumentId && (
        <DocumentEditorPanel
          documentId={editingDocumentId}
          initialReviewOpen={initialReviewOpen}
          kindName={getKindName(
            documents.find((d) => d.id === editingDocumentId)?.document_kind_id ?? editingDocKindId,
          )}
          onClose={() => {
            setEditingDocumentId(null);
            setInitialReviewOpen(false);
          }}
          onSaved={() => {
            loadDocuments();
            setFoldersRefreshKey((k) => k + 1);
          }}
          onDeleted={() => {
            loadDocuments();
            setFoldersRefreshKey((k) => k + 1);
            setEditingDocumentId(null);
            setInitialReviewOpen(false);
          }}
          onOpenTemplate={(template) => {
            if (!template?.id) return;
            setEditingDocumentId(null);
            setInitialReviewOpen(false);
            openTemplatePreview(template);
          }}
        />
      )}
      {createTemplateOpen && (
        <CreateTemplateModal
          open={createTemplateOpen}
          onClose={() => { setCreateTemplateOpen(false); setCreateTemplateMode(null); }}
          initialCreateMode={createTemplateMode}
          onCreated={(template) => {
            loadTemplates();
            loadKinds();
            if (template?.id) {
              openTemplatePreview(template);
            }
            setCreateTemplateMode(null);
          }}
        />
      )}
      {previewTemplateId != null && (() => {
        const t = templates.find((x) => String(x.id) === String(previewTemplateId));
        return (
          <TemplatePreviewPanel
            templateId={previewTemplateId}
            templateName={t?.name}
            kindId={t?.document_kind_id}
            kindName={t ? getKindName(t.document_kind_id) : ''}
            variant={previewVariant}
            onClose={() => { setPreviewTemplateId(null); setPreviewVariant('document'); }}
            onEditStructure={(kindId) => {
              setStructurePreselectedKindId(String(kindId));
              setActiveTab('structure');
              setPreviewTemplateId(null);
            }}
            onCreateFromTemplate={() => {
              loadDocuments();
              setPreviewTemplateId(null);
            }}
            onDeleteTemplate={() => {
              loadTemplates();
              setPreviewTemplateId(null);
            }}
          />
        );
      })()}
    </>
  );
};

export default DocumentsApp;
