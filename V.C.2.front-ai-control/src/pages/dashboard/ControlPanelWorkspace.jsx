import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/dashboardService';
import { dataModelService } from '../../services/dataModelService';
import { flowService } from '../../services/flowService';
import { isPlatformAdmin } from '../../utils/isPlatformAdmin';
import DashboardSidebar from './DashboardSidebar';
import AuthorizedImage from '../data_models/components/AuthorizedImage';
import { MediaBatchProvider } from '../../hooks/useMediaBatch';
import defaultDashboardImage from '../../assets/default_dashboard.png';
import {
  getRecentItems,
  pushRecentItem,
  removeRecentItem,
  setRecentItems as persistRecentItems,
} from './controlPanelRecent';
import workspaceStyles from './ControlPanelWorkspace.module.css';
import ConfirmDialog from '../task_manager/components/ConfirmDialog';
import {
  ChartBarSquareIcon,
  CircleStackIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

function modelAuthorName(model, user) {
  if (model?.owner_name) return model.owner_name;
  if (user && Number(model?.owner_id) === Number(user.id)) {
    return user.name || user.login || 'Вы';
  }
  return 'Автор неизвестен';
}

function authorInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatModelDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const ControlPanelWorkspace = ({ defaultSection = 'panels', initialFlowId = null }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mainSection, setMainSection] = useState(defaultSection);
  const [panelsFilter, setPanelsFilter] = useState('Мои');
  const [flowsFilter, setFlowsFilter] = useState(initialFlowId ? String(initialFlowId) : null);
  const [modelsFilter, setModelsFilter] = useState('Мои');
  const [recentItems, setRecentItems] = useState(() => getRecentItems());

  const [dashboards, setDashboards] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [flows, setFlows] = useState([]);
  const [flowDashboards, setFlowDashboards] = useState([]);
  const [loadingFlowDashboards, setLoadingFlowDashboards] = useState(false);
  const [dataModels, setDataModels] = useState({ Мои: [], Доступные: [], Публичные: [] });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [modelToDelete, setModelToDelete] = useState(null);
  const [deletingModel, setDeletingModel] = useState(false);
  const [modelToCopy, setModelToCopy] = useState(null);
  const [copyingModel, setCopyingModel] = useState(false);
  const [dashboardToCopy, setDashboardToCopy] = useState(null);
  const [copyingDashboard, setCopyingDashboard] = useState(false);
  const [newDashboard, setNewDashboard] = useState({
    name: '',
    description: '',
    is_template: false,
  });

  const loadDashboards = async () => {
    const [dashboardsData, templatesData, flowsData] = await Promise.all([
      dashboardService.getDashboards(),
      dashboardService.getTemplates(),
      flowService.getFlows().catch(() => ({ flows: [] })),
    ]);
    setDashboards(dashboardsData);
    setTemplates(templatesData);
    setFlows(flowsData.flows || []);
  };

  const loadDataModels = async () => {
    const userId = user?.id != null ? Number(user.id) : null;
    const [visibleRes, publicRes] = await Promise.all([
      dataModelService.getDataModels(),
      dataModelService.getPublicDataModels().catch(() => ({ data_models: [] })),
    ]);

    const visible = visibleRes.data_models || [];
    const publicList = publicRes.data_models || [];
    const mine = visible.filter((model) => userId != null && Number(model.owner_id) === userId);
    const shared = visible.filter(
      (model) =>
        userId != null &&
        Number(model.owner_id) !== userId &&
        !model.is_public,
    );

    setDataModels({
      Мои: mine,
      Доступные: shared,
      Публичные: publicList,
    });
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([loadDashboards(), loadDataModels()]);
    } catch {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  useEffect(() => {
    setMainSection(defaultSection);
  }, [defaultSection]);

  useEffect(() => {
    if (initialFlowId) {
      setMainSection('flows');
      setFlowsFilter(String(initialFlowId));
    }
  }, [initialFlowId]);

  const loadFlowDashboards = useCallback(async (flowId) => {
    if (!flowId) {
      setFlowDashboards([]);
      return;
    }
    setLoadingFlowDashboards(true);
    try {
      const data = await flowService.getFlowDashboards(flowId);
      setFlowDashboards(data.dashboards || []);
    } catch {
      setFlowDashboards([]);
    } finally {
      setLoadingFlowDashboards(false);
    }
  }, []);

  const filteredDashboards = useMemo(() => {
    const userId = user?.id != null ? Number(user.id) : null;
    const isOwnedByUser = (dashboard) => (
      userId != null && Number(dashboard.owner_id ?? dashboard.user_id) === userId
    );

    const templateDashboards = dashboards.filter((d) => d.is_template);
    const mergedTemplates = [...templates];
    const templateIds = new Set(mergedTemplates.map((d) => d.id));
    for (const dashboard of templateDashboards) {
      if (!templateIds.has(dashboard.id)) {
        mergedTemplates.push(dashboard);
        templateIds.add(dashboard.id);
      }
    }

    const map = {
      Мои: dashboards.filter((d) => isOwnedByUser(d)),
      Шаблоны: mergedTemplates,
      Все: dashboards,
    };
    return map;
  }, [dashboards, templates, user?.id]);

  const flowsFilters = useMemo(
    () => flows
      .filter((flow) => flow.is_active)
      .map((flow) => ({
        id: String(flow.id),
        label: flow.name,
        count: flow.dashboards_count ?? 0,
      })),
    [flows],
  );

  const selectedFlow = useMemo(
    () => flows.find((flow) => String(flow.id) === String(flowsFilter)) || null,
    [flows, flowsFilter],
  );

  const panelsFilters = useMemo(
    () => Object.keys(filteredDashboards).map((id) => ({
      id,
      label: id,
      count: filteredDashboards[id]?.length || 0,
    })),
    [filteredDashboards],
  );

  const modelsFilters = useMemo(
    () => Object.keys(dataModels).map((id) => ({
      id,
      label: id,
      count: dataModels[id]?.length || 0,
    })),
    [dataModels],
  );

  useEffect(() => {
    if (mainSection === 'flows' && flowsFilters.length > 0 && !flowsFilter) {
      setFlowsFilter(flowsFilters[0].id);
    }
  }, [mainSection, flowsFilters, flowsFilter]);

  useEffect(() => {
    if (mainSection === 'flows' && flowsFilter) {
      loadFlowDashboards(flowsFilter);
    }
  }, [mainSection, flowsFilter, loadFlowDashboards]);

  useEffect(() => {
    if (loading) return;

    const dashboardIds = new Set(dashboards.map((d) => String(d.id)));
    const dataModelIds = new Set(
      Object.values(dataModels)
        .flat()
        .map((m) => String(m.id)),
    );

    const cleaned = recentItems.filter((item) => {
      if (item.type === 'dashboard') return dashboardIds.has(String(item.id));
      if (item.type === 'data-model') return dataModelIds.has(String(item.id));
      return false;
    });

    const changed = cleaned.length !== recentItems.length;
    if (changed) {
      setRecentItems(persistRecentItems(cleaned));
    }
  }, [dashboards, dataModels, recentItems, loading]);

  useEffect(() => {
    if (!filteredDashboards[panelsFilter]) {
      setPanelsFilter('Мои');
    }
  }, [filteredDashboards, panelsFilter]);

  useEffect(() => {
    if (!dataModels[modelsFilter]) {
      setModelsFilter('Мои');
    }
  }, [dataModels, modelsFilter]);

  const handleMainSectionChange = (sectionId) => {
    setMainSection(sectionId);
    if (sectionId === 'flows' && flowsFilters.length > 0) {
      const nextFlowId = flowsFilter || flowsFilters[0].id;
      setFlowsFilter(nextFlowId);
      navigate(`/flows/${nextFlowId}`);
    } else if (sectionId === 'panels') {
      navigate('/dashboard');
    } else if (sectionId === 'data-models') {
      navigate('/data-models');
    }
  };

  const handleFlowsFilterChange = (flowId) => {
    setFlowsFilter(flowId);
    navigate(`/flows/${flowId}`);
  };
  const currentDashboards = filteredDashboards[panelsFilter] || [];
  const currentFlowDashboards = flowDashboards;
  const currentModels = dataModels[modelsFilter] || [];
  const coverBatchItems = useMemo(() => {
    const list = [...dashboards, ...flowDashboards];
    const seen = new Set();
    const items = [];
    for (const dashboard of list) {
      if (!dashboard?.id || seen.has(dashboard.id)) continue;
      if (!dashboard.image_url || !String(dashboard.image_url).startsWith('/api')) continue;
      seen.add(dashboard.id);
      items.push({
        key: `cover:${dashboard.id}`,
        ref: dashboard.image_url,
        preset: 'dashboard_card',
      });
    }
    return items;
  }, [dashboards, flowDashboards]);

  const openDashboard = (dashboard) => {
    const isFromFlow = mainSection === 'flows' && Boolean(flowsFilter);
    const next = pushRecentItem({
      type: 'dashboard',
      id: dashboard.id,
      name: dashboard.name,
      path: `/dashboard/${dashboard.id}`,
    });
    setRecentItems(next);
    navigate(`/dashboard/${dashboard.id}`, {
      state: isFromFlow
        ? { fromFlow: true, flowId: flowsFilter, readOnlyFlow: true }
        : undefined,
    });
  };

  const openDataModel = (model) => {
    const next = pushRecentItem({
      type: 'data-model',
      id: model.id,
      name: model.name,
      path: `/data-models/${model.id}`,
    });
    setRecentItems(next);
    navigate(`/data-models/${model.id}`);
  };

  const handleRecentClick = (item) => {
    pushRecentItem(item);
    navigate(item.path);
  };

  const handleCreateDashboard = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newDashboard,
        is_public: newDashboard.is_public ?? false,
      };
      await dashboardService.createDashboard(payload);
      const createdAsTemplate = Boolean(newDashboard.is_template);
      setNewDashboard({ name: '', description: '', is_template: false });
      setShowCreateForm(false);
      await loadDashboards();
      setPanelsFilter(createdAsTemplate ? 'Шаблоны' : 'Мои');
    } catch {
      setError('Не удалось создать панель управления');
    }
  };

  const handleDeleteDashboard = async (id) => {
    try {
      await dashboardService.deleteDashboard(id);
      setRecentItems(removeRecentItem('dashboard', id));
      await loadDashboards();
    } catch {
      setError('Не удалось удалить панель управления');
    }
  };

  const handleDeleteModel = (model) => {
    setModelToDelete(model);
  };

  const copyDataModel = async (includeData) => {
    if (!modelToCopy) return;
    setCopyingModel(true);
    try {
      const copied = await dataModelService.copyDataModel(modelToCopy.id, {
        include_data: includeData,
      });
      setModelToCopy(null);
      await loadDataModels();
      setModelsFilter('Мои');
      if (copied?.id) {
        openDataModel(copied);
      }
    } catch {
      setError('Не удалось скопировать модель данных');
    } finally {
      setCopyingModel(false);
    }
  };

  const confirmCopyDashboard = async () => {
    if (!dashboardToCopy) return;
    setCopyingDashboard(true);
    try {
      const copied = await dashboardService.copyDashboard(dashboardToCopy.id);
      setDashboardToCopy(null);
      await loadDashboards();
      setMainSection('panels');
      setPanelsFilter('Мои');
      if (copied?.id) {
        const next = pushRecentItem({
          type: 'dashboard',
          id: copied.id,
          name: copied.name,
          path: `/dashboard/${copied.id}`,
        });
        setRecentItems(next);
        navigate(`/dashboard/${copied.id}`);
      }
    } catch {
      setError(dashboardToCopy.is_template
        ? 'Не удалось создать панель из шаблона'
        : 'Не удалось скопировать панель');
    } finally {
      setCopyingDashboard(false);
    }
  };

  const confirmDeleteModel = async () => {
    if (!modelToDelete) return;
    setDeletingModel(true);
    try {
      await dataModelService.deleteDataModel(modelToDelete.id);
      setRecentItems(removeRecentItem('data-model', modelToDelete.id));
      setModelToDelete(null);
      await loadDataModels();
    } catch {
      setError('Не удалось удалить модель данных');
    } finally {
      setDeletingModel(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <MediaBatchProvider items={coverBatchItems}>
    <div className={workspaceStyles.workspace}>
      <DashboardSidebar
        mainSection={mainSection}
        onMainSectionChange={handleMainSectionChange}
        panelsFilters={panelsFilters}
        panelsFilter={panelsFilter}
        onPanelsFilterChange={setPanelsFilter}
        flowsFilters={flowsFilters}
        flowsFilter={flowsFilter}
        onFlowsFilterChange={handleFlowsFilterChange}
        modelsFilters={modelsFilters}
        modelsFilter={modelsFilter}
        onModelsFilterChange={setModelsFilter}
        recentItems={recentItems}
        onRecentClick={handleRecentClick}
      />

      <main className={workspaceStyles.main}>
        <div className={workspaceStyles.contentPanel}>
          <div key={mainSection} className={workspaceStyles.tabContent}>
            {mainSection === 'panels' ? (
              <>
                <div className={workspaceStyles.pageHeader}>
                  <div>
                    <h1 className={workspaceStyles.pageTitle}>
                      <ChartBarSquareIcon style={{ width: '1.75rem', height: '1.75rem', display: 'inline', marginRight: '0.5rem', verticalAlign: '-0.25rem', color: '#a78bfa' }} />
                      Панели управления
                    </h1>
                    <p className={workspaceStyles.pageSubtitle}>Управление аналитикой и инсайтами</p>
                  </div>
                  <div className={workspaceStyles.headerActions}>
                    {isPlatformAdmin(user) && (
                      <button type="button" onClick={() => navigate('/dashboard/flows')} className="btn btn-secondary">
                        <WrenchScrewdriverIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                        Управление потоками
                      </button>
                    )}
                    <button type="button" onClick={() => setShowCreateForm(true)} className="btn btn-primary">
                      <SparklesIcon style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden />
                      Создать панель
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-gradient-to-r from-red-500/20 to-rose-600/20 border border-red-500/30 text-red-300 p-4 rounded-lg mb-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <span>{error}</span>
                      <button type="button" onClick={() => setError(null)} className="text-red-300 hover:text-red-100">✕</button>
                    </div>
                  </div>
                )}

                {showCreateForm && (
                  <div className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl">
                    <h3 className="text-lg font-semibold mb-4">Создать новую панель управления</h3>
                    <form onSubmit={handleCreateDashboard} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Название
                          <span className="ml-2 text-xs text-gray-400">({newDashboard.name.length}/20)</span>
                        </label>
                        <input
                          type="text"
                          value={newDashboard.name}
                          onChange={(e) => setNewDashboard({ ...newDashboard, name: e.target.value.slice(0, 20) })}
                          className="form-input"
                          placeholder="Название панели управления"
                          maxLength={20}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Описание
                          <span className="ml-2 text-xs text-gray-400">({newDashboard.description.length}/100)</span>
                        </label>
                        <textarea
                          value={newDashboard.description}
                          onChange={(e) => setNewDashboard({ ...newDashboard, description: e.target.value.slice(0, 100) })}
                          className="form-input"
                          placeholder="Описание панели управления"
                          rows="3"
                          maxLength={100}
                        />
                      </div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newDashboard.is_template}
                          onChange={(e) => setNewDashboard({ ...newDashboard, is_template: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">Сделать шаблоном</span>
                      </label>
                      <div className="flex gap-3">
                        <button type="submit" className="btn btn-primary">Создать панель</button>
                        <button type="button" onClick={() => setShowCreateForm(false)} className="btn btn-secondary">Отмена</button>
                      </div>
                    </form>
                  </div>
                )}

                {currentDashboards.length > 0 ? (
                  <div className={workspaceStyles.cardsGrid}>
                    {currentDashboards.map((dashboard) => (
                      <div
                        key={dashboard.id}
                        className={`card ${workspaceStyles.itemCard} hover:scale-105 transition-transform cursor-pointer`}
                        onClick={() => openDashboard(dashboard)}
                      >
                        <div className={workspaceStyles.itemCardBody}>
                        <div className="mb-4">
                          {dashboard.image_url && dashboard.image_url.startsWith('/api') ? (
                            <AuthorizedImage
                              src={dashboard.image_url}
                              alt={dashboard.name}
                              className="w-full h-86 object-cover rounded-lg"
                              preset="dashboard_card"
                              batchKey={`cover:${dashboard.id}`}
                            />
                          ) : (
                            <img
                              src={dashboard.image_url || defaultDashboardImage}
                              alt={dashboard.name}
                              className="w-full h-86 object-cover rounded-lg"
                              onError={(e) => { e.target.src = defaultDashboardImage; }}
                            />
                          )}
                        </div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-semibold text-gradient">{dashboard.name}</h3>
                            <span
                              className={`text-xs px-2 py-1 rounded w-fit ${
                                dashboard.is_template
                                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {dashboard.is_template ? 'Шаблон' : 'Панель'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDashboardToCopy(dashboard);
                              }}
                              className="text-sky-300 hover:text-sky-200 transition-colors"
                              title={dashboard.is_template ? 'Использовать шаблон' : 'Копировать'}
                            >
                              <DocumentDuplicateIcon style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDashboard(dashboard.id);
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Удалить"
                            >
                              <TrashIcon style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 mb-4">
                          {dashboard.description
                            ? (dashboard.description.length > 20
                              ? `${dashboard.description.slice(0, 20)}...`
                              : dashboard.description)
                            : 'Без описания'}
                        </p>
                        <div className="text-xs text-gray-400">
                          Создано: {new Date(dashboard.created).toLocaleDateString()}
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-lg text-slate-400">Панели управления не найдены.</p>
                    <button type="button" onClick={() => setShowCreateForm(true)} className="btn btn-primary mt-4">
                      <SparklesIcon style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden />
                      Создать первую панель
                    </button>
                  </div>
                )}
              </>
            ) : mainSection === 'flows' ? (
              <>
                <div className={workspaceStyles.pageHeader}>
                  <div>
                    <h1 className={workspaceStyles.pageTitle}>
                      <ChartBarSquareIcon style={{ width: '1.75rem', height: '1.75rem', display: 'inline', marginRight: '0.5rem', verticalAlign: '-0.25rem', color: '#34d399' }} />
                      {selectedFlow?.name || 'Потоки'}
                    </h1>
                    <p className={workspaceStyles.pageSubtitle}>
                      {selectedFlow?.description || 'Дашборды, привязанные к выбранному потоку'}
                    </p>
                  </div>
                  <div className={workspaceStyles.headerActions}>
                    {isPlatformAdmin(user) && (
                      <button type="button" onClick={() => navigate('/dashboard/flows')} className="btn btn-secondary">
                        <WrenchScrewdriverIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                        Управление потоками
                      </button>
                    )}
                  </div>
                </div>

                {loadingFlowDashboards ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400 mx-auto mb-4" />
                    <p className="text-slate-400">Загрузка дашбордов потока...</p>
                  </div>
                ) : currentFlowDashboards.length > 0 ? (
                  <div className={workspaceStyles.cardsGrid}>
                    {currentFlowDashboards.map((dashboard) => (
                      <div
                        key={dashboard.id}
                        className={`card ${workspaceStyles.itemCard} hover:scale-105 transition-transform cursor-pointer`}
                        onClick={() => openDashboard(dashboard)}
                      >
                        <div className={workspaceStyles.itemCardBody}>
                          <div className="mb-4">
                            {dashboard.image_url && dashboard.image_url.startsWith('/api') ? (
                              <AuthorizedImage
                                src={dashboard.image_url}
                                alt={dashboard.name}
                                className="w-full h-86 object-cover rounded-lg"
                                preset="dashboard_card"
                                batchKey={`cover:${dashboard.id}`}
                              />
                            ) : (
                              <img
                                src={dashboard.image_url || defaultDashboardImage}
                                alt={dashboard.name}
                                className="w-full h-86 object-cover rounded-lg"
                                onError={(e) => { e.target.src = defaultDashboardImage; }}
                              />
                            )}
                          </div>
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-semibold text-gradient">{dashboard.name}</h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDashboardToCopy(dashboard);
                              }}
                              className="text-sky-300 hover:text-sky-200 transition-colors"
                              title={dashboard.is_template ? 'Использовать шаблон' : 'Копировать'}
                            >
                              <DocumentDuplicateIcon style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden />
                            </button>
                          </div>
                          <p className="text-sm text-gray-300 mb-4">
                            {dashboard.description || 'Без описания'}
                          </p>
                          <div className="text-xs text-gray-400">
                            Создано: {new Date(dashboard.created).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-lg text-slate-400">
                      {flowsFilters.length === 0
                        ? 'Нет доступных потоков.'
                        : 'В этом потоке пока нет привязанных дашбордов.'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={workspaceStyles.pageHeader}>
                  <div>
                    <h1 className={workspaceStyles.pageTitle}>
                      <CircleStackIcon style={{ width: '1.75rem', height: '1.75rem', display: 'inline', marginRight: '0.5rem', verticalAlign: '-0.25rem', color: '#38bdf8' }} />
                      Модели данных
                    </h1>
                    <p className={workspaceStyles.pageSubtitle}>Управление источниками данных для панелей</p>
                  </div>
                  <div className={workspaceStyles.headerActions}>
                    <button type="button" onClick={() => navigate('/data-models/create')} className="btn btn-primary">
                      <PlusIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                      Создать модель
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-gradient-to-r from-red-500/20 to-rose-600/20 border border-red-500/30 text-red-300 p-4 rounded-lg mb-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <span>{error}</span>
                      <button type="button" onClick={() => setError(null)} className="text-red-300 hover:text-red-100">✕</button>
                    </div>
                  </div>
                )}

                {currentModels.length > 0 ? (
                  <div className={workspaceStyles.cardsGrid}>
                    {currentModels.map((model) => {
                      const author = modelAuthorName(model, user);
                      const mine =
                        modelsFilter === 'Мои' &&
                        user?.id != null &&
                        Number(model.owner_id) === Number(user.id);
                      return (
                        <article key={model.id} className={workspaceStyles.modelCard}>
                          <div className={workspaceStyles.modelCardTop}>
                            <span className={workspaceStyles.modelCardIcon} aria-hidden>
                              <CircleStackIcon />
                            </span>
                            <div className={workspaceStyles.modelCardHeadText}>
                              <h3 className={workspaceStyles.modelCardTitle} title={model.name}>
                                {model.name}
                              </h3>
                              <div className={workspaceStyles.modelCardBadges}>
                                <span
                                  className={
                                    model.is_active
                                      ? workspaceStyles.modelBadgeActive
                                      : workspaceStyles.modelBadgeInactive
                                  }
                                >
                                  {model.is_active ? 'Активна' : 'Неактивна'}
                                </span>
                                {model.is_public ? (
                                  <span className={workspaceStyles.modelBadgePublic}>Публичная</span>
                                ) : null}
                              </div>
                            </div>
                            {mine && (
                              <button
                                type="button"
                                onClick={() => handleDeleteModel(model)}
                                className={workspaceStyles.modelIconDanger}
                                title="Удалить"
                                aria-label="Удалить модель"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          </div>

                          <p className={workspaceStyles.modelCardDesc}>
                            {model.description || 'Без описания'}
                          </p>

                          <div className={workspaceStyles.modelCardMeta}>
                            <div className={workspaceStyles.modelAuthor}>
                              <span className={workspaceStyles.modelAuthorAvatar} aria-hidden>
                                {authorInitials(author)}
                              </span>
                              <div className={workspaceStyles.modelAuthorCopy}>
                                <span className={workspaceStyles.modelMetaLabel}>Автор</span>
                                <span className={workspaceStyles.modelAuthorName} title={author}>
                                  {author}
                                </span>
                              </div>
                            </div>
                            <div className={workspaceStyles.modelDate}>
                              <span className={workspaceStyles.modelMetaLabel}>Создана</span>
                              <span>{formatModelDate(model.created)}</span>
                            </div>
                          </div>

                          <div className={workspaceStyles.modelCardActions}>
                            <button
                              type="button"
                              onClick={() => openDataModel(model)}
                              className={workspaceStyles.modelBtnPrimary}
                            >
                              <EyeIcon />
                              Просмотр
                            </button>
                            <button
                              type="button"
                              onClick={() => setModelToCopy(model)}
                              className={workspaceStyles.modelBtnGhost}
                              title="Копировать структуру"
                              aria-label="Копировать структуру"
                            >
                              <DocumentDuplicateIcon />
                            </button>
                            {mine && (
                              <button
                                type="button"
                                onClick={() => navigate(`/data-models/${model.id}/edit`)}
                                className={workspaceStyles.modelBtnGhost}
                                title="Редактировать"
                                aria-label="Редактировать"
                              >
                                <PencilIcon />
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CircleStackIcon style={{ width: '4rem', height: '4rem', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <p className="text-lg text-slate-400">
                      {modelsFilter === 'Доступные'
                        ? 'Нет моделей, к которым вам выдали доступ.'
                        : modelsFilter === 'Публичные'
                          ? 'Публичные модели не найдены.'
                          : 'Модели данных не найдены.'}
                    </p>
                    {modelsFilter === 'Мои' && (
                      <button type="button" onClick={() => navigate('/data-models/create')} className="btn btn-primary mt-4">
                        <PlusIcon style={{ width: '1.25rem', height: '1.25rem' }} />
                        Создать первую модель
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={Boolean(modelToDelete)}
        title="Удалить модель данных?"
        message={`Вы уверены, что хотите удалить модель «${modelToDelete?.name || ''}»? Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        variant="danger"
        loading={deletingModel}
        onConfirm={confirmDeleteModel}
        onCancel={() => !deletingModel && setModelToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(modelToCopy)}
        title="Скопировать модель?"
        message={`Скопировать «${modelToCopy?.name || ''}» в ваши модели. Только структура — виджеты и код без таблиц. Со структурой и данными — плюс скомпилированная SQLite и вложения.`}
        confirmLabel="Со структурой и данными"
        altConfirmLabel="Только структура"
        cancelLabel="Отмена"
        loading={copyingModel}
        onConfirm={() => copyDataModel(true)}
        onAltConfirm={() => copyDataModel(false)}
        onCancel={() => !copyingModel && setModelToCopy(null)}
      />

      <ConfirmDialog
        open={Boolean(dashboardToCopy)}
        title={dashboardToCopy?.is_template ? 'Использовать шаблон?' : 'Скопировать панель?'}
        message={
          dashboardToCopy?.is_template
            ? `Создать личную панель из шаблона «${dashboardToCopy?.name || ''}».`
            : `Создать копию панели «${dashboardToCopy?.name || ''}» у вас в разделе «Мои».`
        }
        confirmLabel={dashboardToCopy?.is_template ? 'Использовать' : 'Копировать'}
        cancelLabel="Отмена"
        loading={copyingDashboard}
        onConfirm={confirmCopyDashboard}
        onCancel={() => !copyingDashboard && setDashboardToCopy(null)}
      />
    </div>
    </MediaBatchProvider>
  );
};

export default ControlPanelWorkspace;
