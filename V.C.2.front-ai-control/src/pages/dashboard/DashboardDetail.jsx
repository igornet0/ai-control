import React, { useState, useEffect, useMemo, useRef } from 'react';
import DashboardImageSelector from './components/DashboardImageSelector';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { buildDashboardSheetPath, flowNavigateState } from '../../services/dashboardSheetNav.js';
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon, 
  CheckIcon, 
  XMarkIcon,
  EyeIcon,
  ChartBarIcon,
  TableCellsIcon,
  DocumentTextIcon,
  DocumentIcon,
  Cog6ToothIcon,
  WrenchScrewdriverIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  UserIcon,
  GlobeAltIcon,
  PhotoIcon,
  CalendarIcon,
  ClockIcon,
  CircleStackIcon,
  LinkIcon,
  ArrowLeftIcon,
  DocumentDuplicateIcon,
  Square2StackIcon,
  UsersIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { dashboardService } from '../../services/dashboardService';
import { sheetService } from '../../services/sheetService';
import { widgetService } from '../../services/widgetService';
import { dataModelService } from '../../services/dataModelService';
import { invalidateDashboardSchema } from '../../services/dashboardSqliteSchemaService';
import {
  formatReconcileSummary,
  reconcileDashboardWidgetModels,
} from '../../services/dashboardModelRemap';
import { flowService } from '../../services/flowService';
import { canEditDashboard } from '../../utils/dashboardUtils';
import { isPlatformAdmin } from '../../utils/isPlatformAdmin';
import { useAuth } from '../../context/AuthContext';
import EmployeeHoverTrigger from '../profile/components/employees/EmployeeHoverTrigger';
import defaultDashboardImage from '../../assets/default_dashboard.png';
import defaultSheetImage from '../../assets/default_sheet.png';
import AuthorizedImage from '../data_models/components/AuthorizedImage';
import { MediaBatchProvider } from '../../hooks/useMediaBatch';
import styles from './DashboardDetail.module.css';
import ShareLinkModal from './components/ShareLinkModal.jsx';
import FlowSessionModal from './components/FlowSessionModal.jsx';
import TemplateAccessModal from './components/TemplateAccessModal.jsx';
import SheetAccessModal from './components/SheetAccessModal.jsx';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import {
  dashboardModelsSupportAutoRefresh,
  getDashboardAutoRefreshEnabled,
  buildLayoutConfigWithAutoRefresh,
} from '../../utils/dashboardAutoRefresh.js';

const getModelCreatorName = (model) =>
  model?.owner_name
  || model?.owner?.name
  || model?.owner?.login
  || model?.owner?.username
  || 'Неизвестно';

const buildPublisherEmployee = (publication) => {
  if (!publication?.published_by && !publication?.publishedBy) return null;
  const publisherId = publication.published_by ?? publication.publishedBy;
  const publisherName =
    publication.publisher_name
    ?? publication.publisherName
    ?? `Пользователь #${publisherId}`;
  return {
    id: publisherId,
    name: publisherName,
  };
};

function formatPublicationDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU');
}

function DashboardPublicationCard({ publications = [] }) {
  const items = publications.filter(Boolean);
  if (items.length === 0) return null;

  const heading = items.length === 1
    ? 'Опубликован в поток'
    : 'Опубликован в потоки';

  return (
    <div className={styles.publishedInfo}>
      <GlobeAltIcon className={styles.publicationIcon} />
      <div className={styles.publicationDetails}>
        <div className={styles.publicationHeading}>
          <span className={styles.publicationLabel}>{heading}</span>
          {items.length > 1 ? (
            <span className={styles.publicationCount}>{items.length}</span>
          ) : null}
        </div>
        <ul className={styles.publicationFlows}>
          {items.map((publication) => {
            const publisher = buildPublisherEmployee(publication);
            const unsynced = publication.isSynced === false || publication.is_synced === false;
            const flowName = publication.flowName || publication.flow_name || 'Без названия';
            const publishedAt = publication.publishedAt || publication.published_at;
            const key = publication.flow_id ?? publication.flowId ?? flowName;
            return (
              <li key={key} className={styles.publicationFlowRow}>
                <span className={styles.flowName}>{flowName}</span>
                <span className={styles.publicationFlowMeta}>
                  {publisher ? (
                    <EmployeeHoverTrigger employee={publisher} className={styles.publisherTrigger}>
                      <span className={styles.publisherName}>{publisher.name}</span>
                    </EmployeeHoverTrigger>
                  ) : null}
                  {publishedAt ? (
                    <span className={styles.publicationDate}>{formatPublicationDate(publishedAt)}</span>
                  ) : null}
                  {unsynced ? (
                    <span className={styles.publicationUnsynced}>есть изменения</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const DashboardDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [dataCodeScript, setDataCodeScript] = useState('# Initial DataCode script');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState(null);
  const [editingSheetName, setEditingSheetName] = useState('');
  const [editingSheetDescription, setEditingSheetDescription] = useState('');
  const sheetEditBlurTimeoutRef = useRef(null);
  const [isEditingImage, setIsEditingImage] = useState(false);

  const [sheets, setSheets] = useState([]);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [newSheetDescription, setNewSheetDescription] = useState('');
  
  const [dataModels, setDataModels] = useState([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [savingAutoRefresh, setSavingAutoRefresh] = useState(false);
  const [flows, setFlows] = useState([]);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState('');
  const [flowSyncStatusMap, setFlowSyncStatusMap] = useState({});
  const [flowSyncLoading, setFlowSyncLoading] = useState(false);
  
  // Data model management state
  const [showDataModelModal, setShowDataModelModal] = useState(false);
  const [availableDataModels, setAvailableDataModels] = useState([]);
  const [selectedDataModelId, setSelectedDataModelId] = useState('');
  
  // Enhanced data model selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, personal, public
  const [selectedModelIds, setSelectedModelIds] = useState([]);

  // Image selector state
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [showSheetImageSelector, setShowSheetImageSelector] = useState(false);
  const [sheetIdForImage, setSheetIdForImage] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFlowSessionModal, setShowFlowSessionModal] = useState(false);
  const [showTemplateAccess, setShowTemplateAccess] = useState(false);
  const [sheetAccessTarget, setSheetAccessTarget] = useState(null);
  const [togglingTemplate, setTogglingTemplate] = useState(false);
  const [copyingDashboard, setCopyingDashboard] = useState(false);
  const [showCopyDashboardDialog, setShowCopyDashboardDialog] = useState(false);
  const [snapshotPublishedBy, setSnapshotPublishedBy] = useState(null);
  const [snapshotPublication, setSnapshotPublication] = useState(null);
  const [flowPublications, setFlowPublications] = useState([]);

  // Edit permissions state
  const [canEdit, setCanEdit] = useState(false);

  useDocumentTitle([dashboard?.name || dashboardName, 'Панель управления']);
  const isSnapshotView = Boolean(location.state?.fromFlow);
  const activeFlowId = location.state?.flowId ? String(location.state.flowId) : null;
  const canModifyStructure = canEdit && !isSnapshotView;
  const canManageTemplateAccess = Boolean(
    !isSnapshotView &&
      (dashboard?.can_manage_access
        || (user && Number(dashboard?.owner_id ?? dashboard?.user_id) === Number(user.id))
        || user?.is_superuser),
  );
  const canManageSheetAccess = Boolean(canModifyStructure || canManageTemplateAccess);
  const currentUserId = user?.id != null ? Number(user.id) : null;
  const snapshotOwnerId = dashboard?.owner_id != null ? Number(dashboard.owner_id) : null;
  const snapshotPublisherId = snapshotPublishedBy != null ? Number(snapshotPublishedBy) : null;
  const canEditSnapshotImages = Boolean(
    isSnapshotView &&
      currentUserId != null &&
      snapshotOwnerId != null &&
      snapshotPublisherId != null &&
      currentUserId === snapshotOwnerId &&
      currentUserId === snapshotPublisherId,
  );
  const canEditImages = isSnapshotView
    ? canEditSnapshotImages && isEditingImage
    : canEdit && isEditMode;

  const supportsAutoRefresh = dashboardModelsSupportAutoRefresh(dataModels);
  const showAutoRefreshSetting = supportsAutoRefresh;

  const dataSources = [
    { id: '1', name: 'DataCode' },
    { id: '2', name: 'База данных MySQL' },
    { id: '3', name: 'База данных PostgreSQL' },
    { id: '4', name: 'Google Analytics' },
    { id: '5', name: 'Импорт CSV' },
  ];

  const widgetTypes = [
    { id: 'bar_chart', name: 'Столбчатая диаграмма', icon: ChartBarIcon, description: 'Отображение данных в виде столбцов' },
    { id: 'line_chart', name: 'Линейный график', icon: ChartBarIcon, description: 'Отображение трендов во времени' },
    { id: 'pie_chart', name: 'Круговая диаграмма', icon: ChartBarIcon, description: 'Отображение долей в процентах' },
    { id: 'table', name: 'Таблица', icon: TableCellsIcon, description: 'Табличное представление данных с сортировкой' },
    { id: 'rect', name: 'Прямоугольник', icon: DocumentTextIcon, description: 'Простой контейнер для текста' },
    { id: 'container', name: 'Контейнер', icon: DocumentTextIcon, description: 'Группировка нескольких виджетов' },
    { id: 'filter', name: 'Фильтр', icon: Cog6ToothIcon, description: 'Фильтрация данных по условиям' },
  ];

  // Загрузка дашборда и связанных данных
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!id || Number.isNaN(Number(id))) {
        navigate('/dashboard', { replace: true });
        return;
      }

      try {
        setLoading(true);

        if (isSnapshotView && activeFlowId) {
          setIsEditingImage(false);
          const snapshotResponse = await flowService.getFlowDashboardSnapshot(activeFlowId, id);
          const snapshotPayload = snapshotResponse?.payload || {};
          setSnapshotPublishedBy(snapshotResponse?.published_by ?? null);
          let snapshotFlowName = null;
          try {
            const flowData = await flowService.getFlow(activeFlowId);
            snapshotFlowName = flowData?.name || null;
          } catch (flowErr) {
            console.warn('Failed to load flow name for snapshot view:', flowErr);
          }
          setSnapshotPublication({
            flowId: activeFlowId,
            flowName: snapshotFlowName,
            publishedAt: snapshotResponse?.published_at ?? null,
            publishedBy: snapshotResponse?.published_by ?? null,
            publisherName: snapshotResponse?.publisher_name ?? null,
          });
          setFlowPublications([]);
          const snapshotDashboard = snapshotPayload?.dashboard || {};
          const snapshotSheets = Array.isArray(snapshotPayload?.sheets) ? snapshotPayload.sheets : [];
          const snapshotModels = Array.isArray(snapshotPayload?.data_models)
            ? snapshotPayload.data_models
            : [];

          const dashboardData = {
            id: Number(id),
            ...snapshotDashboard,
          };
          setDashboard(dashboardData);
          setDashboardName(snapshotDashboard.name || 'Без названия');
          setDashboardDescription(snapshotDashboard.description || '');
          setAutoRefreshEnabled(getDashboardAutoRefreshEnabled(dashboardData));
          setCanEdit(false);
          setSheets(snapshotSheets);
          setDataModels(snapshotModels);
          return;
        }

        // Загружаем дашборд
        const dashboardData = await dashboardService.getDashboard(id);
        setDashboard(dashboardData);
        setDashboardName(dashboardData.name || '');
        setDashboardDescription(dashboardData.description || '');
        setAutoRefreshEnabled(getDashboardAutoRefreshEnabled(dashboardData));
        setFlowPublications(
          Array.isArray(dashboardData.flow_publications) ? dashboardData.flow_publications : [],
        );

        // Проверяем права на редактирование дашборда
        const hasEditPermissions = canEditDashboard(dashboardData, user);
        setCanEdit(hasEditPermissions);

        setIsEditingImage(false);
        setSnapshotPublishedBy(null);
        setSnapshotPublication(null);
        // Загружаем листы дашборда
        const sheetsData = await sheetService.getDashboardSheets(id);
        setSheets(Array.isArray(sheetsData) ? sheetsData : (sheetsData.sheets || []));

        // Загружаем модели данных, связанные с дашбордом (не критично для отображения дашборда)
        try {
          const dashboardDataModelsData = await dashboardService.getDashboardDataModels(id);
          setDataModels(dashboardDataModelsData || []);
        } catch (error) {
          console.warn('Failed to load dashboard data models:', error);
          setDataModels([]);
        }

        // Загружаем потоки для публикации (если есть права редактирования)
        if (hasEditPermissions) {
          try {
            await loadFlows();
          } catch (error) {
            console.warn('Failed to load flows:', error);
          }
        }
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Ошибка загрузки данных дашборда');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadDashboardData();
    }
  }, [id, user, isSnapshotView, activeFlowId]);

  const openSheetModal = () => {
    setNewSheetName('');
    setNewSheetDescription('');
    setShowSheetModal(true);
  };

  const closeSheetModal = () => {
    setShowSheetModal(false);
  };

  const addSheet = async () => {
    if (!canModifyStructure) {
      alert('В версии из потока нельзя изменять структуру дашборда');
      return;
    }
    if (newSheetName.trim() !== '') {
      try {
        const response = await sheetService.createSheet(id, {
          name: newSheetName.trim(),
          description: newSheetDescription.trim(),
          order_index: sheets.length
        });
        
        // API (DashboardSheetResponse) возвращает лист с полем id; старые варианты sheet_id / sheet.id — для совместимости
        const sheetId = response?.id ?? response?.sheet_id ?? response?.sheet?.id;
        if (sheetId != null && sheetId !== '') {
          let newSheet = response;
          try {
            const fullSheetData = await sheetService.getSheet(sheetId);
            newSheet = fullSheetData?.sheet ?? fullSheetData;
          } catch (fetchErr) {
            console.warn('Не удалось подгрузить лист после создания, используем ответ POST:', fetchErr);
          }
          setSheets([...sheets, newSheet]);
        } else {
          console.error('createSheet: в ответе нет id листа', response);
          alert('Лист создан, но сервер не вернул идентификатор. Обновите страницу.');
        }
        
        setNewSheetName('');
        setNewSheetDescription('');
        setShowSheetModal(false);
        
              } catch (error) {
        console.error('Error creating sheet:', error);
        alert('Ошибка создания листа');
      }
    }
  };

  const openFlowModal = () => {
    setShowFlowModal(true);
  };

  const closeFlowModal = () => {
    setShowFlowModal(false);
    setSelectedFlow('');
  };

  const openFlowManagement = () => {
    navigate('/dashboard/flows');
  };

  const handleBackToWorkspace = () => {
    if (isSnapshotView && activeFlowId) {
      navigate(`/flows/${activeFlowId}`);
      return;
    }
    navigate('/dashboard');
  };

  const loadFlows = async () => {
    try {
      const flowsData = await flowService.getFlows();
      const loadedFlows = flowsData.flows || [];
      setFlows(loadedFlows);
      if (id && loadedFlows.length > 0) {
        setFlowSyncLoading(true);
        const statuses = await Promise.all(
          loadedFlows.map(async (flow) => {
            try {
              const status = await flowService.getFlowDashboardSyncStatus(flow.id, Number(id));
              return [String(flow.id), status];
            } catch {
              return [String(flow.id), null];
            }
          })
        );
        setFlowSyncStatusMap(Object.fromEntries(statuses));
      } else {
        setFlowSyncStatusMap({});
      }
    } catch (error) {
      console.error('Error loading flows:', error);
    } finally {
      setFlowSyncLoading(false);
    }
  };

  // Data model management functions
  const openDataModelModal = async () => {
    if (!canModifyStructure) {
      alert('В версии из потока нельзя изменять привязки моделей');
      return;
    }
    try {
      // Load available data models (user-visible list already includes publics via ACL).
      // Also fetch public endpoint for older backends, then dedupe by id.
      const [userModels, publicModels] = await Promise.all([
        dataModelService.getDataModels().catch(() => ({ data_models: [] })),
        dataModelService.getPublicDataModels().catch(() => ({ data_models: [] }))
      ]);

      const byId = new Map();
      for (const model of [
        ...(userModels.data_models || []),
        ...(publicModels.data_models || []),
      ]) {
        if (!model || model.id == null) continue;
        const id = Number(model.id);
        if (!Number.isFinite(id) || byId.has(id)) continue;
        byId.set(id, model);
      }
      const allModels = Array.from(byId.values());

      // Filter out models that are already linked to this dashboard
      const linkedModelIds = new Set(dataModels.map((model) => Number(model.id)));
      const availableModels = allModels.filter(
        (model) => !linkedModelIds.has(Number(model.id))
      );
      setAvailableDataModels(availableModels);
      
      // Reset enhanced selection state
      setSearchQuery('');
      setFilterType('all');
      setSelectedModelIds([]);
      setSelectedDataModelId('');
      
      setShowDataModelModal(true);
    } catch (error) {
      console.error('Error loading available data models:', error);
      alert('Ошибка загрузки доступных моделей данных');
    }
  };

  const addDataModelToDashboard = async () => {
    if (selectedModelIds.length === 0) {
      alert('Выберите хотя бы одну модель данных');
      return;
    }

    try {
      setSaving(true);
      
      // Add all selected models to dashboard
      for (const modelId of selectedModelIds) {
        await dashboardService.addDataModelToDashboard(id, modelId);
      }
      
      // Reload dashboard data models
      const dashboardDataModelsData = await dashboardService.getDashboardDataModels(id);
      setDataModels(dashboardDataModelsData || []);
      invalidateDashboardSchema(id);
      const remapSummary = await reconcileDashboardWidgetModels(id);
      const remapNote = formatReconcileSummary(remapSummary);

      setShowDataModelModal(false);
      setSelectedModelIds([]);
      alert(
        remapNote
          ? `Добавлено моделей данных: ${selectedModelIds.length}\n${remapNote}`
          : `Добавлено моделей данных: ${selectedModelIds.length}`,
      );
    } catch (error) {
      console.error('Error adding data models to dashboard:', error);
      alert('Ошибка добавления моделей данных к дашборду');
    } finally {
      setSaving(false);
    }
  };

  // Helper functions for enhanced data model selection
  const filteredDataModels = availableDataModels.filter(model => {
    // Search filter
    const matchesSearch = !searchQuery || 
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getModelCreatorName(model).toLowerCase().includes(searchQuery.toLowerCase());
    
    // Type filter (personal/public)
    const matchesType = filterType === 'all' || 
      (filterType === 'personal' && !model.is_public) ||
      (filterType === 'public' && model.is_public);
    
    return matchesSearch && matchesType;
  });

  const handleModelSelection = (modelId) => {
    setSelectedModelIds(prev => 
      prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  const handleSelectAll = () => {
    if (selectedModelIds.length === filteredDataModels.length) {
      setSelectedModelIds([]);
    } else {
      setSelectedModelIds(filteredDataModels.map(model => model.id));
    }
  };

  const removeDataModelFromDashboard = async (dataModelId) => {
    if (!canModifyStructure) {
      alert('В версии из потока нельзя изменять привязки моделей');
      return;
    }
    if (!confirm('Удалить модель данных из дашборда?')) {
      return;
    }

    try {
      setSaving(true);
      await dashboardService.removeDataModelFromDashboard(id, dataModelId);
      
      // Reload dashboard data models
      const dashboardDataModelsData = await dashboardService.getDashboardDataModels(id);
      setDataModels(dashboardDataModelsData || []);
      invalidateDashboardSchema(id);
      const remapSummary = await reconcileDashboardWidgetModels(id);
      const remapNote = formatReconcileSummary(remapSummary);

      alert(remapNote ? `Модель данных удалена из дашборда\n${remapNote}` : 'Модель данных удалена из дашборда');
    } catch (error) {
      console.error('Error removing data model from dashboard:', error);
      alert('Ошибка удаления модели данных из дашборда');
    } finally {
      setSaving(false);
    }
  };

  const openLinkedDataModel = (modelId) => {
    if (!modelId) return;
    navigate(`/data-models/${modelId}`);
  };

  const publishToFlow = async () => {
    if (selectedFlow) {
      try {
        await flowService.publishDashboardToFlow(selectedFlow, {
          dashboard_id: parseInt(id, 10),
        });

        const updatedDashboard = await dashboardService.getDashboard(id);
        setDashboard(updatedDashboard);
        setFlowPublications(
          Array.isArray(updatedDashboard.flow_publications) ? updatedDashboard.flow_publications : [],
        );
        await loadFlows();

        alert('Дашборд успешно опубликован в поток!');
        setShowFlowModal(false);
        setSelectedFlow('');
      } catch (error) {
        console.error('Error publishing to flow:', error);
        alert('Ошибка публикации в поток');
      }
    }
  };

  const deleteSheet = async (sheetId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот лист?')) {
      try {
        await sheetService.deleteSheet(sheetId);
        setSheets(sheets.filter(sheet => sheet.id !== sheetId));
              } catch (error) {
        console.error('Error deleting sheet:', error);
        alert('Ошибка удаления листа');
      }
    }
  };

  const beginSheetEdit = (sheetId, { name, description } = {}) => {
    const sheet = sheets.find((s) => s.id === sheetId);
    if (!sheet) return;
    setEditingSheetId(sheetId);
    setEditingSheetName(name != null ? name : (sheet.name || ''));
    setEditingSheetDescription(
      description != null ? description : (sheet.description || ''),
    );
  };

  const editSheet = async (sheetId) => {
    beginSheetEdit(sheetId);
  };

  const saveSheetEdit = async (sheetId) => {
    if (editingSheetId !== sheetId) return;

    const currentName = editingSheetName;
    const currentDescription = editingSheetDescription;
    const sheet = sheets.find((s) => s.id === sheetId);

    if (!currentName || currentName.trim() === '') {
      alert('Название листа не может быть пустым');
      cancelSheetEdit();
      return;
    }

    const nextName = currentName.trim();
    const nextDescription = (currentDescription || '').trim();
    const prevName = sheet?.name || '';
    const prevDescription = sheet?.description || '';

    if (nextName === prevName && nextDescription === prevDescription) {
      setEditingSheetId(null);
      setEditingSheetName('');
      setEditingSheetDescription('');
      return;
    }

    try {
      await sheetService.updateSheet(sheetId, {
        name: nextName,
        description: nextDescription,
      });

      setSheets((prev) =>
        prev.map((s) =>
          s.id === sheetId ? { ...s, name: nextName, description: nextDescription } : s,
        ),
      );

      setEditingSheetId(null);
      setEditingSheetName('');
      setEditingSheetDescription('');
    } catch (error) {
      console.error('Error updating sheet:', error);
      alert('Ошибка обновления листа');
    }
  };

  const cancelSheetEdit = () => {
    if (sheetEditBlurTimeoutRef.current) {
      clearTimeout(sheetEditBlurTimeoutRef.current);
      sheetEditBlurTimeoutRef.current = null;
    }
    setEditingSheetId(null);
    setEditingSheetName('');
    setEditingSheetDescription('');
  };

  const scheduleSaveSheetEdit = (sheetId) => {
    if (sheetEditBlurTimeoutRef.current) {
      clearTimeout(sheetEditBlurTimeoutRef.current);
    }
    sheetEditBlurTimeoutRef.current = setTimeout(() => {
      sheetEditBlurTimeoutRef.current = null;
      if (editingSheetId === sheetId) {
        saveSheetEdit(sheetId);
      }
    }, 120);
  };

  const cancelScheduledSheetSave = () => {
    if (sheetEditBlurTimeoutRef.current) {
      clearTimeout(sheetEditBlurTimeoutRef.current);
      sheetEditBlurTimeoutRef.current = null;
    }
  };

  const handleDashboardImageClick = () => {
    if (canEditImages) {
      setShowImageSelector(true);
    }
  };

  const handleImageSelect = async (imageUrl) => {
    try {
      if (isSnapshotView && activeFlowId) {
        await flowService.updateFlowDashboardImage(activeFlowId, id, imageUrl);
        setDashboard({ ...dashboard, image_url: imageUrl === null ? null : imageUrl });
        alert('Изображение дашборда в версии потока обновлено!');
      } else {
        if (imageUrl === null) {
          await dashboardService.deleteDashboardImage(id);
          setDashboard({ ...dashboard, image_url: null });
          alert('Изображение дашборда удалено успешно!');
        } else {
          await dashboardService.updateDashboardImage(id, imageUrl);
          setDashboard({ ...dashboard, image_url: imageUrl });
          alert('Изображение дашборда обновлено успешно!');
        }
      }
    } catch (error) {
      console.error('Error updating dashboard image:', error);
      alert('Ошибка обновления изображения дашборда');
    }
  };

  const openSheetImageSelector = (sheetId) => {
    setSheetIdForImage(sheetId);
    setShowSheetImageSelector(true);
  };

  const closeSheetImageSelector = () => {
    setShowSheetImageSelector(false);
    setSheetIdForImage(null);
  };

  const handleSheetImageSelect = async (imageUrl) => {
    const sid = sheetIdForImage;
    if (sid == null) return;
    try {
      setSaving(true);
      const payload = { image_url: imageUrl === null ? null : imageUrl };
      if (isSnapshotView && activeFlowId) {
        await flowService.updateFlowSheetImage(activeFlowId, id, sid, payload.image_url);
      } else {
        await sheetService.updateSheet(sid, payload);
      }
      setSheets((prev) =>
        prev.map((s) => (String(s.id) === String(sid) ? { ...s, image_url: payload.image_url } : s)),
      );
      alert(
        imageUrl === null ? 'Изображение листа удалено.' : 'Изображение листа обновлено.',
      );
    } catch (error) {
      console.error('Error updating sheet image:', error);
      alert('Ошибка сохранения изображения листа');
    } finally {
      setSaving(false);
    }
  };

  const saveChanges = async () => {
    if (!canModifyStructure) {
      alert('В версии из потока нельзя редактировать название и описание');
      return;
    }
    try {
      setSaving(true);
      await dashboardService.updateDashboard(id, {
        name: dashboardName,
        description: dashboardDescription
      });
      setDashboard({ ...dashboard, name: dashboardName, description: dashboardDescription });
      setIsEditMode(false);
      alert('Изменения успешно сохранены!');
    } catch (error) {
      console.error('Error saving dashboard:', error);
      alert('Ошибка сохранения дашборда');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoRefreshToggle = async (nextEnabled) => {
    if (!canModifyStructure || !supportsAutoRefresh) return;
    const prev = autoRefreshEnabled;
    setAutoRefreshEnabled(nextEnabled);
    try {
      setSavingAutoRefresh(true);
      const layout_config = buildLayoutConfigWithAutoRefresh(dashboard, nextEnabled);
      await dashboardService.updateDashboard(id, { layout_config });
      setDashboard((d) => (d ? { ...d, layout_config } : d));
    } catch (error) {
      console.error('Error saving auto-refresh setting:', error);
      setAutoRefreshEnabled(prev);
      alert('Не удалось сохранить настройку автообновления');
    } finally {
      setSavingAutoRefresh(false);
    }
  };

  const handleEditDashboard = () => {
    if (!canModifyStructure) {
      alert('В версии из потока нельзя включать режим редактирования');
      return;
    }
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setDashboardName(dashboard.name || '');
    setDashboardDescription(dashboard.description || '');
    setIsEditMode(false);
  };

  const handleDeleteDashboard = async () => {
    if (!confirm('Вы уверены, что хотите удалить этот дашборд? Это действие нельзя отменить.')) {
      return;
    }

    try {
      setSaving(true);
      await dashboardService.deleteDashboard(id);
      alert('Дашборд успешно удален!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      alert('Ошибка удаления дашборда');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyDashboard = async () => {
    setCopyingDashboard(true);
    try {
      const copied = await dashboardService.copyDashboard(id);
      setShowCopyDashboardDialog(false);
      if (copied?.id) {
        navigate(`/dashboard/${copied.id}`);
      }
    } catch (error) {
      console.error('Error copying dashboard:', error);
      alert(dashboard?.is_template
        ? 'Не удалось создать панель из шаблона'
        : 'Не удалось скопировать панель');
    } finally {
      setCopyingDashboard(false);
    }
  };

  const handleToggleTemplate = async (nextValue) => {
    if (!canManageTemplateAccess || togglingTemplate) return;
    setTogglingTemplate(true);
    try {
      const updated = await dashboardService.updateDashboard(id, { is_template: nextValue });
      setDashboard((prev) => ({ ...prev, ...updated }));
      if (nextValue) setShowTemplateAccess(true);
      else setShowTemplateAccess(false);
    } catch (error) {
      console.error('Error toggling template:', error);
      alert(nextValue ? 'Не удалось сделать шаблоном' : 'Не удалось убрать шаблон');
    } finally {
      setTogglingTemplate(false);
    }
  };

  const mediaBatchItems = useMemo(() => {
    const items = [];
    if (dashboard?.image_url && String(dashboard.image_url).startsWith('/api')) {
      items.push({
        key: `cover:${dashboard.id}`,
        ref: dashboard.image_url,
        preset: 'dashboard_cover',
      });
    }
    for (const sheet of sheets || []) {
      if (sheet?.image_url && String(sheet.image_url).startsWith('/api')) {
        items.push({
          key: `sheet:${sheet.id}`,
          ref: sheet.image_url,
          preset: 'sheet_cover',
        });
      }
    }
    return items;
  }, [dashboard, sheets]);

  if (loading) {
    return (
      <div className={styles.dashboardEditor}>
        <div className={styles.container}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
            <div style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text-secondary)' }}>
              Загрузка дашборда...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MediaBatchProvider items={mediaBatchItems}>
    <div className={styles.dashboardViewer}>
      <div className={styles.container}>
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <button
              type="button"
              className={styles.backButton}
              onClick={handleBackToWorkspace}
              title={isSnapshotView && activeFlowId ? 'Вернуться к потоку' : 'Вернуться к панелям управления'}
            >
              <ArrowLeftIcon className="w-4 h-4" />
              {isSnapshotView && activeFlowId ? 'Назад к потоку' : 'Назад к панелям'}
            </button>
            <div className={styles.headerActions}>
              <div className={styles.quickStats}>
                <span className={styles.statChip}>Листы: {sheets.length}</span>
                <span className={styles.statChip}>Модели: {dataModels.length}</span>
              </div>
              <button
                type="button"
                className={`btn btn-secondary ${styles.shareButton}`}
                onClick={() => setShowCopyDashboardDialog(true)}
                title={dashboard?.is_template ? 'Использовать шаблон' : 'Копировать панель'}
              >
                <DocumentDuplicateIcon className="w-5 h-5" />
                {dashboard?.is_template ? 'Использовать' : 'Копировать'}
              </button>
              {isSnapshotView && activeFlowId && (
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.shareButton}`}
                  onClick={() => setShowFlowSessionModal(true)}
                  title="Создать сессию с участником потока"
                >
                  <UsersIcon className="w-5 h-5" />
                  Сессия
                </button>
              )}
              {canModifyStructure && (
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.shareButton}`}
                  onClick={openFlowModal}
                  title="Опубликовать дашборд в поток"
                >
                  <GlobeAltIcon className="w-5 h-5" />
                  В поток
                </button>
              )}
              {isPlatformAdmin(user) && (
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.shareButton}`}
                  onClick={openFlowManagement}
                  title="Управление потоками"
                >
                  <WrenchScrewdriverIcon className="w-5 h-5" />
                  Потоки
                </button>
              )}
              {canModifyStructure && (
                <button
                  type="button"
                  className={`btn btn-secondary ${styles.shareButton}`}
                  onClick={() => setShowShareModal(true)}
                  title="Создать ссылку на дашборд"
                >
                  <LinkIcon className="w-5 h-5" />
                  Поделиться
                </button>
              )}
            </div>
          </div>
          <div className={styles.headerMain}>
          </div>
        </div>

        {/* Dashboard Info Block */}
        <div className={styles.dashboardInfoBlock}>
          <div className={styles.dashboardImageSection}>
            <div 
              className={`${styles.dashboardImageContainer} ${canEditImages ? styles.editableImage : ''}`}
              onClick={handleDashboardImageClick}
            >
              {dashboard?.image_url && dashboard.image_url.startsWith('/api') ? (
                <AuthorizedImage
                  src={dashboard.image_url}
                  alt={dashboard?.name || 'Дашборд'}
                  className={styles.dashboardImage}
                  preset="dashboard_cover"
                  batchKey={`cover:${dashboard.id}`}
                  onError={(e) => {
                    console.error('Error loading dashboard image:', e);
                  }}
                />
              ) : (
                <img
                  src={dashboard?.image_url || defaultDashboardImage}
                  alt={dashboard?.name || 'Дашборд'}
                  className={styles.dashboardImage}
                  onError={(e) => {
                    e.target.src = defaultDashboardImage;
                  }}
                />
              )}
              {canEditImages && (
                <div className={styles.imageOverlay}>
                  <PhotoIcon className={styles.imageEditIcon} />
                  <span className={styles.imageEditText}>Изменить изображение</span>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.dashboardDetails}>
            <div className={styles.dashboardMainInfo}>
              {isEditMode && canModifyStructure ? (
                <div className={styles.editForm}>
                  <input
                    type="text"
                    value={dashboardName}
                    onChange={(e) => setDashboardName(e.target.value)}
                    className={styles.editInput}
                    placeholder="Название дашборда"
                  />
                  <textarea
                    value={dashboardDescription}
                    onChange={(e) => setDashboardDescription(e.target.value)}
                    className={styles.editTextarea}
                    placeholder="Описание дашборда"
                    rows="3"
                  />
                </div>
              ) : (
                <div className={styles.dashboardTextInfo}>
                  <h2 className={styles.dashboardName}>{dashboard?.name || 'Без названия'}</h2>
                  <p className={styles.dashboardDescription}>
                    {dashboard?.description || 'Без описания'}
                  </p>
                </div>
              )}
            </div>

            <div className={styles.dashboardMetaInfo}>
              <div className={styles.publicationStatus}>
                {isSnapshotView && snapshotPublication ? (
                  <DashboardPublicationCard
                    publications={[{
                      flowName: snapshotPublication.flowName,
                      publishedAt: snapshotPublication.publishedAt,
                      published_by: snapshotPublication.publishedBy ?? snapshotPublication.published_by,
                      publisher_name: snapshotPublication.publisherName ?? snapshotPublication.publisher_name,
                    }]}
                  />
                ) : flowPublications.length > 0 ? (
                  <DashboardPublicationCard publications={flowPublications} />
                ) : (
                  <div className={styles.notPublishedInfo}>
                    <UserIcon className={styles.publicationIcon} />
                    <span className={styles.notPublishedLabel}>Не опубликован</span>
                  </div>
                )}
                {canManageTemplateAccess && (
                  <div className={styles.templateActions}>
                    {dashboard?.is_template ? (
                      <>
                        <span className={styles.templateBadge}>
                          <Square2StackIcon />
                          Шаблон
                        </span>
                        <button
                          type="button"
                          className={styles.templateAccessBtn}
                          onClick={() => setShowTemplateAccess(true)}
                        >
                          <ShieldCheckIcon />
                          Кто видит и правит
                        </button>
                        <button
                          type="button"
                          className={styles.templateToggleBtn}
                          disabled={togglingTemplate}
                          onClick={() => handleToggleTemplate(false)}
                        >
                          Убрать шаблон
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.templateMakeBtn}
                        disabled={togglingTemplate}
                        onClick={() => handleToggleTemplate(true)}
                      >
                        <Square2StackIcon />
                        Сделать шаблоном
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Creation and Modification Dates */}
              <div className={styles.dashboardDates}>
                <div className={styles.dateInfo}>
                  <CalendarIcon className={styles.dateIcon} />
                  <span className={styles.dateLabel}>Создан:</span>
                  <span className={styles.dateValue}>
                    {dashboard?.created ? new Date(dashboard.created).toLocaleDateString('ru-RU') : 'Неизвестно'}
                  </span>
                </div>
                <div className={styles.dateInfo}>
                  <ClockIcon className={styles.dateIcon} />
                  <span className={styles.dateLabel}>Изменен:</span>
                  <span className={styles.dateValue}>
                    {dashboard?.updated ? new Date(dashboard.updated).toLocaleDateString('ru-RU') : 'Неизвестно'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.dashboardActions}>
            {isEditMode && canModifyStructure ? (
              <div className={styles.editActions}>
                <button
                  onClick={handleCancelEdit}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  <XMarkIcon className="w-4 h-4 mr-2" />
                  Отмена
                </button>
                <button
                  onClick={saveChanges}
                  className="btn btn-primary"
                  disabled={saving}
                >
                  <CheckIcon className="w-4 h-4 mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            ) : !isSnapshotView ? (
              <div className={styles.viewActions}>
                <button
                  onClick={handleEditDashboard}
                  className="btn btn-primary"
                  disabled={!canModifyStructure}
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteDashboard}
                  className="btn btn-danger"
                  disabled={!canModifyStructure || saving}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className={styles.viewActions}>
                {canEditSnapshotImages && (
                  <button
                    type="button"
                    className={`btn ${isEditingImage ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => setIsEditingImage((prev) => !prev)}
                    title="Режим редактирования изображений"
                  >
                    <PhotoIcon className="w-4 h-4 mr-2" />
                    {isEditingImage ? 'Готово' : 'Редактировать изображения'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className={styles.mainContent}>
          {/* Sheets Section */}
          <div className={`${styles.sheetsSection} ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Листы</h2>
              {canModifyStructure && (
                <button
                  onClick={openSheetModal}
                  className={`btn btn-primary ${styles.createSheetButton}`}
                >
                  <PlusIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                  Создать лист
                </button>
              )}
            </div>
            
            <div className={styles.sheetsGrid}>
              {sheets.map((sheet) => (
                <div
                  key={sheet.id}
                  className={`card ${styles.sheetCard} ${isEditMode && canModifyStructure ? styles.editMode : ''}`}
                  onClick={() => {
                    // В режиме snapshot открываем лист в read-only.
                    if (!isEditMode) {
                      const path = buildDashboardSheetPath({
                        dashboardId: id,
                        sheetId: sheet.id,
                        flowId: isSnapshotView && activeFlowId ? activeFlowId : null,
                      });
                      navigate(path, {
                        state: isSnapshotView && activeFlowId
                          ? flowNavigateState(activeFlowId)
                          : undefined,
                      });
                    }
                  }}
                >
                  {canModifyStructure && isEditMode && (
                        <div className={styles.sheetActions}>
                          {canManageSheetAccess && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSheetAccessTarget(sheet);
                              }}
                              className={styles.sheetImagePickerButton}
                              title={sheet.access_restricted ? 'Ограниченный доступ к листу' : 'Кто видит лист'}
                              aria-label="Права доступа к листу"
                            >
                              <ShieldCheckIcon />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSheetImageSelector(sheet.id);
                            }}
                            className={styles.sheetImagePickerButton}
                            title="Изображение листа"
                            aria-label="Изображение листа"
                          >
                            <PhotoIcon />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSheet(sheet.id);
                            }}
                            className={`${styles.deleteButton}`}
                            title="Удалить лист"
                          >
                            <TrashIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                          </button>
                        </div>
                      )}
                  <div
                    className={`${styles.sheetImageSection} ${canEditImages ? styles.sheetImageSectionClickable : ''}`}
                    onClick={(e) => {
                      if (canEditImages) {
                        e.stopPropagation();
                        openSheetImageSelector(sheet.id);
                      }
                    }}
                  >
                    {sheet.image_url && String(sheet.image_url).startsWith('/api') ? (
                      <AuthorizedImage
                        src={sheet.image_url}
                        alt={sheet.name}
                        className={styles.sheetImage}
                        preset="sheet_cover"
                        batchKey={`sheet:${sheet.id}`}
                      />
                    ) : (
                      <img
                        src={sheet.image_url || defaultSheetImage}
                        alt={sheet.name}
                        className={styles.sheetImage}
                        onError={(e) => {
                          e.target.src = defaultSheetImage;
                        }}
                      />
                    )}
                  </div>
                  <div className={styles.sheetContent}>
                    <div className={styles.sheetHeader}>
                      <div className={styles.sheetInfo}>
                        {canModifyStructure && isEditMode ? (
                          <div className={styles.sheetEditForm}>
                            <input
                              type="text"
                              value={editingSheetId === sheet.id ? editingSheetName : sheet.name}
                              onChange={(e) => {
                                const value = e.target.value.slice(0, 20);
                                if (editingSheetId === sheet.id) {
                                  setEditingSheetName(value);
                                } else {
                                  beginSheetEdit(sheet.id, {
                                    name: value,
                                    description: sheet.description || '',
                                  });
                                }
                              }}
                              maxLength={20}
                              className={styles.sheetNameInput}
                              placeholder="Название листа"
                              onFocus={cancelScheduledSheetSave}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  cancelScheduledSheetSave();
                                  saveSheetEdit(sheet.id);
                                } else if (e.key === 'Escape') {
                                  cancelSheetEdit();
                                }
                              }}
                              onBlur={() => {
                                if (editingSheetId === sheet.id) {
                                  scheduleSaveSheetEdit(sheet.id);
                                }
                              }}
                            />
                            <textarea
                              value={
                                editingSheetId === sheet.id
                                  ? editingSheetDescription
                                  : (sheet.description || '')
                              }
                              onChange={(e) => {
                                const value = e.target.value.slice(0, 120);
                                if (editingSheetId === sheet.id) {
                                  setEditingSheetDescription(value);
                                } else {
                                  beginSheetEdit(sheet.id, {
                                    name: sheet.name || '',
                                    description: value,
                                  });
                                }
                              }}
                              maxLength={120}
                              rows={2}
                              className={styles.sheetDescriptionInput}
                              placeholder="Описание листа"
                              onFocus={cancelScheduledSheetSave}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  cancelSheetEdit();
                                }
                              }}
                              onBlur={() => {
                                if (editingSheetId === sheet.id) {
                                  scheduleSaveSheetEdit(sheet.id);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <h3 className={`${styles.sheetTitle} ${sheet.name && sheet.name.length > 15 ? styles.sheetTitleLong : ''}`}>
                              {sheet.name}
                            </h3>
                            {sheet.description && (
                              <p className={styles.sheetDescription}>{sheet.description}</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {sheets.length === 0 && (
              <div className={styles.emptyState}>
                <DocumentIcon className={styles.emptyStateIcon} />
                <p>Листы не найдены. Создайте первый лист для начала работы.</p>
              </div>
            )}
          </div>

          {/* Data Models Sidebar */}
          <div className={`${styles.dataModelsSidebar} ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Модели данных</h2>
              {canModifyStructure && (
                <button
                  onClick={openDataModelModal}
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  <PlusIcon style={{ width: '1rem', height: '1rem' }} />
                  Добавить
                </button>
              )}
            </div>

            {showAutoRefreshSetting && (
              <div className={styles.autoRefreshSetting}>
                <label className={styles.autoRefreshLabel} htmlFor="dashboard-auto-refresh">
                  <input
                    id="dashboard-auto-refresh"
                    type="checkbox"
                    checked={autoRefreshEnabled}
                    disabled={!canModifyStructure || savingAutoRefresh || isSnapshotView}
                    onChange={(e) => handleAutoRefreshToggle(e.target.checked)}
                  />
                  <span>
                    Автообновление данных
                  </span>
                </label>
              </div>
            )}
            
            <div className={styles.dataModelsList}>
              {dataModels.map((model) => (
                <div
                  key={model.id}
                  className={`card ${styles.dataModelItem}`}
                  onClick={() => openLinkedDataModel(model.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLinkedDataModel(model.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  title="Открыть модель данных"
                >
                  <div className={styles.dataModelHeader}>
                    <h4 className={styles.dataModelTitle}>{model.name}</h4>
                    {canModifyStructure && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDataModelFromDashboard(model.id);
                        }}
                        className={styles.removeModelButton}
                        disabled={saving}
                        title="Удалить модель из дашборда"
                      >
                        <XMarkIcon style={{ width: '0.875rem', height: '0.875rem' }} />
                      </button>
                    )}
                  </div>
                  <p className={styles.dataModelDescription}>
                    {model.description || 'Без описания'}
                  </p>
                  <div className={styles.dataModelMeta}>
                    <span className={`${styles.statusBadge} ${model.is_active ? styles.active : styles.inactive}`}>
                      {model.is_active ? 'Активна' : 'Неактивна'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {dataModels.length === 0 && (
              <div className={styles.emptyState}>
                <CircleStackIcon className={styles.emptyStateIcon} />
                <p>К дашборду не привязаны модели данных.</p>
                <p className={styles.emptyStateHint}>
                  {canEdit 
                    ? 'Используйте кнопку "Добавить" для привязки моделей данных к дашборду.'
                    : 'Обратитесь к владельцу дашборда для добавления моделей данных.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* <DataCodeEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          code={dataCodeScript}
          setCode={setDataCodeScript}
        /> */}
      </div>

      {/* Модальное окно создания листа */}
      {showSheetModal && (
        <div className={styles.modalOverlay}>
          <div className={`card ${styles.modalContent}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Создать новый лист</h3>
              <button
                onClick={closeSheetModal}
                className={styles.modalCloseButton}
                title="Закрыть"
              >
                <XMarkIcon style={{ width: '1.5rem', height: '1.5rem' }} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <div className={styles.labelWithCounter}>
                  <label className={styles.label}>Название листа</label>
                  <span className={styles.characterCounter}>
                    {newSheetName.length}/20
                  </span>
                </div>
                <input
                  type="text"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value.slice(0, 20))}
                  placeholder="Введите название листа"
                  className={`form-input ${styles.modalInput}`}
                  maxLength={20}
                />
              </div>
              <div className={styles.formGroup}>
                <div className={styles.labelWithCounter}>
                  <label className={styles.label}>Описание</label>
                  <span className={styles.characterCounter}>
                    {newSheetDescription.length}/120
                  </span>
                </div>
                <textarea
                  value={newSheetDescription}
                  onChange={(e) => setNewSheetDescription(e.target.value.slice(0, 120))}
                  placeholder="Введите описание листа"
                  className={`form-input ${styles.modalInput}`}
                  rows="3"
                  maxLength={120}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={closeSheetModal}
                className={`btn btn-secondary ${styles.modalCancelButton}`}
              >
                Отмена
              </button>
              <button
                onClick={addSheet}
                className={`btn btn-primary ${styles.modalConfirmButton}`}
                disabled={!newSheetName.trim()}
              >
                Создать лист
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно публикации в поток */}
      {showFlowModal && (
        <div className={styles.modalOverlay}>
          <div className={`card ${styles.modalContent}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Опубликовать в поток</h3>
              <button
                onClick={closeFlowModal}
                className={styles.modalCloseButton}
                title="Закрыть"
              >
                <XMarkIcon style={{ width: '1.5rem', height: '1.5rem' }} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Выберите поток</label>
                <select
                  value={selectedFlow}
                  onChange={(e) => setSelectedFlow(e.target.value)}
                  className={`form-input ${styles.modalInput}`}
                >
                  <option value="">Выберите поток</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name} ({flow.access_type})
                    </option>
                  ))}
                </select>
                {flowSyncLoading && (
                  <p className={styles.modalHint}>Проверка статуса публикации...</p>
                )}
                {!flowSyncLoading && selectedFlow && flowSyncStatusMap[String(selectedFlow)] && (
                  <p className={styles.modalHint}>
                    {flowSyncStatusMap[String(selectedFlow)].is_synced
                      ? `Опубликовано и синхронно (${new Date(flowSyncStatusMap[String(selectedFlow)].published_at).toLocaleString('ru-RU')})`
                      : 'Рабочая версия изменилась, требуется повторная публикация'}
                  </p>
                )}
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={closeFlowModal}
                className={`btn btn-secondary ${styles.modalCancelButton}`}
              >
                Отмена
              </button>
              <button
                onClick={publishToFlow}
                className={`btn btn-primary ${styles.modalConfirmButton}`}
                disabled={!selectedFlow}
              >
                Опубликовать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления модели данных */}
      {showDataModelModal && (
        <div className={styles.modalOverlay}>
          <div className={`card ${styles.modalContent}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Добавить модель данных</h3>
              <button
                onClick={() => setShowDataModelModal(false)}
                className={styles.modalCloseButton}
                title="Закрыть"
              >
                <XMarkIcon style={{ width: '1.5rem', height: '1.5rem' }} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {/* Search and Filters */}
              <div className={styles.searchAndFilters}>
                <div className={styles.searchContainer}>
                  <div className={styles.searchInputWrapper}>
                    <MagnifyingGlassIcon className={styles.searchIcon} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск по названию или создателю..."
                      className={`form-input ${styles.searchInput}`}
                    />
                  </div>
                </div>
                
                <div className={styles.filtersContainer}>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>
                      <FunnelIcon className={styles.filterIcon} />
                      Тип доступа:
                    </label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className={`form-input ${styles.filterSelect}`}
                    >
                      <option value="all">Все</option>
                      <option value="personal">Личные</option>
                      <option value="public">Публичные</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Models Table */}
              <div className={styles.dataModelsTableContainer}>
                {filteredDataModels.length > 0 ? (
                  <table className={styles.dataModelsTable}>
                    <thead>
                      <tr>
                        <th className={styles.checkboxColumn}>
                          <input
                            type="checkbox"
                            checked={selectedModelIds.length === filteredDataModels.length && filteredDataModels.length > 0}
                            onChange={handleSelectAll}
                            className={styles.checkbox}
                          />
                        </th>
                        <th className={styles.nameColumn}>Название</th>
                        <th className={styles.accessColumn}>Доступ</th>
                        <th className={styles.creatorColumn}>Создатель</th>
                        <th className={styles.statusColumn}>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDataModels.map((model) => {
                        const isSelected = selectedModelIds.includes(model.id);
                        return (
                        <tr
                          key={model.id}
                          className={`${styles.dataModelRow} ${isSelected ? styles.dataModelRowSelected : ''}`}
                          onClick={() => handleModelSelection(model.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleModelSelection(model.id);
                            }
                          }}
                        >
                          <td className={styles.checkboxColumn}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              tabIndex={-1}
                              className={styles.checkbox}
                              aria-hidden="true"
                            />
                          </td>
                          <td className={styles.nameColumn}>
                            <div className={styles.modelName}>
                              <strong>{model.name}</strong>
                              {model.description && (
                                <div className={styles.modelDescription}>
                                  {model.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className={styles.accessColumn}>
                            <div className={styles.accessInfo}>
                              {model.is_public ? (
                                <>
                                  <GlobeAltIcon className={styles.accessIcon} />
                                  <span>Публичная</span>
                                </>
                              ) : (
                                <>
                                  <UserIcon className={styles.accessIcon} />
                                  <span>Личная</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className={styles.creatorColumn}>
                            {getModelCreatorName(model)}
                          </td>
                          <td className={styles.statusColumn}>
                            <span className={`${styles.statusBadge} ${model.is_active ? styles.active : styles.inactive}`}>
                              {model.is_active ? 'Активна' : 'Неактивна'}
                            </span>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className={styles.emptyTableState}>
                    <p>Модели данных не найдены</p>
                    <p className={styles.emptyStateHint}>
                      Попробуйте изменить параметры поиска или фильтры
                    </p>
                  </div>
                )}
              </div>
              
              {selectedModelIds.length > 0 && (
                <div className={styles.selectionSummary}>
                  Выбрано моделей: <strong>{selectedModelIds.length}</strong>
                </div>
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowDataModelModal(false)}
                className={`btn btn-secondary ${styles.modalCancelButton}`}
              >
                Отмена
              </button>
              <button
                onClick={addDataModelToDashboard}
                className={`btn btn-primary ${styles.modalConfirmButton}`}
                disabled={selectedModelIds.length === 0 || saving}
              >
                {saving ? 'Добавление...' : `Добавить (${selectedModelIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Selector Modal */}
      {showImageSelector && (
        <DashboardImageSelector
          dashboardId={id}
          currentImageUrl={dashboard?.image_url}
          onImageSelect={handleImageSelect}
          onClose={() => setShowImageSelector(false)}
        />
      )}

      {showSheetImageSelector && sheetIdForImage != null && (
        <DashboardImageSelector
          dashboardId={id}
          currentImageUrl={sheets.find((s) => String(s.id) === String(sheetIdForImage))?.image_url}
          onImageSelect={handleSheetImageSelect}
          onClose={closeSheetImageSelector}
          title="Изображение листа"
          subtitle="Те же файлы, что и для обложки дашборда: изображения из моделей данных, привязанных к этому дашборду."
          titleId="sheet-image-selector-title"
        />
      )}

      <ShareLinkModal
        dashboardId={id}
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      <FlowSessionModal
        dashboardId={id}
        dashboardName={dashboard?.name}
        flowId={activeFlowId}
        currentUserId={currentUserId}
        open={showFlowSessionModal}
        onClose={() => setShowFlowSessionModal(false)}
      />

      <TemplateAccessModal
        dashboard={dashboard}
        open={showTemplateAccess && Boolean(dashboard?.is_template)}
        onClose={() => setShowTemplateAccess(false)}
        onDashboardChange={(next) => setDashboard((prev) => ({ ...prev, ...next }))}
      />

      <SheetAccessModal
        sheet={sheetAccessTarget}
        open={Boolean(sheetAccessTarget)}
        onClose={() => setSheetAccessTarget(null)}
        onAccessChange={(sheetId, restricted) => {
          setSheets((prev) => prev.map((s) => (
            String(s.id) === String(sheetId)
              ? { ...s, access_restricted: Boolean(restricted) }
              : s
          )));
        }}
      />

      <ConfirmDialog
        open={showCopyDashboardDialog}
        title={dashboard?.is_template ? 'Использовать шаблон?' : 'Скопировать панель?'}
        message={
          dashboard?.is_template
            ? `Создать личную панель из шаблона «${dashboard?.name || ''}».`
            : `Создать копию панели «${dashboard?.name || ''}» у вас в разделе «Мои».`
        }
        confirmLabel={dashboard?.is_template ? 'Использовать' : 'Копировать'}
        cancelLabel="Отмена"
        loading={copyingDashboard}
        onConfirm={handleCopyDashboard}
        onCancel={() => !copyingDashboard && setShowCopyDashboardDialog(false)}
      />

    </div>
    </MediaBatchProvider>
  );
};

export default DashboardDetail;