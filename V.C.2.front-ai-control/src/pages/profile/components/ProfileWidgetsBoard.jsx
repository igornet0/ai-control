import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useProfileWidgets } from '../../../context/ProfileWidgetsContext';
import ProgressChart from '../../task_manager/components/ProgressChart';
import BarChart from '../../task_manager/components/BarChart';
import TeamRatings from '../../task_manager/components/TeamRatings';
import ProfileDashboardWidgetHost, { removeLeakedDashboardWidgetCss } from './ProfileDashboardWidgetHost';
import { renderOverviewLiveWidget, OverviewWidgetModals } from '../../task_manager/tabs/overview/OverviewLiveWidgets';
import { useOverviewLiveState } from '../../task_manager/tabs/overview/useOverviewLiveState';
import { renderStatisticsLiveWidget } from '../../task_manager/tabs/statistics/StatisticsLiveWidgets';
import { useStatisticsLiveState } from '../../task_manager/tabs/statistics/useStatisticsLiveState';
import { canFilterOverdueTasks } from '../../task_manager/utils/performanceUtils';
import {
  getDefaultProfileWidgetSize,
  getProfileWidgetTitle,
  parseProfileWidgetKey,
  profileWidgetKey,
} from '../../../services/profileWidgetCatalog';
import { buildDashboardSheetPath } from '../../../services/dashboardSheetNav.js';
import { MAX_PROFILE_SCREENS } from '../../../services/profileWidgetsService';
import { getTasks } from '../../../services/taskService';
import DraggableGrid from '../../../components/DraggableGrid';
import '../../task_manager/tabs/overview/overviewWidget.css';
import '../../task_manager/tabs/statistics/statisticsWidget.css';
import styles from './ProfileWidgetsBoard.module.css';

const LIVE_REFRESH_MS = 30000;

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function useTaskWidgetsLive({ enabled, live }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));

  const fetchTasks = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return;
    try {
      if (!silent) setLoading(true);
      const data = await getTasks();
      setTasks(normalizeList(data));
    } catch (error) {
      console.error('Error loading profile task widgets:', error);
      if (!silent) setTasks([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    fetchTasks();
    return undefined;
  }, [enabled, fetchTasks]);

  useEffect(() => {
    if (!enabled || !live) return undefined;
    const refresh = () => fetchTasks({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, LIVE_REFRESH_MS);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, live, fetchTasks]);

  return { tasks, loading };
}

export default function ProfileWidgetsBoard() {
  const { user } = useAuth();
  const profileWidgets = useProfileWidgets();
  const widgets = profileWidgets?.widgets ?? [];
  const screens = profileWidgets?.screens ?? [];
  const activeScreenId = profileWidgets?.activeScreenId;
  const activeWidgets = profileWidgets?.activeWidgets ?? [];
  const loadingPins = profileWidgets?.loading;
  const removeWidget = profileWidgets?.removeWidget;
  const updateWidgets = profileWidgets?.updateWidgets;
  const moveWidget = profileWidgets?.moveWidget;
  const setActiveScreenId = profileWidgets?.setActiveScreenId;
  const createScreen = profileWidgets?.createScreen;
  const renameScreen = profileWidgets?.renameScreen;
  const deleteScreen = profileWidgets?.deleteScreen;

  const hasOverview = widgets.some((item) => item.source === 'overview');
  const hasStatistics = widgets.some((item) => item.source === 'statistics');
  const hasTaskWidgets = widgets.some((item) => item.source === 'task-widgets');

  const overviewModel = useOverviewLiveState(user, { enabled: hasOverview, live: true });
  const statisticsModel = useStatisticsLiveState({ enabled: hasStatistics, live: true });
  const { tasks, loading: tasksLoading } = useTaskWidgetsLive({ enabled: hasTaskWidgets, live: true });

  const [statsScope, setStatsScope] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [editingScreenId, setEditingScreenId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [creatingScreen, setCreatingScreen] = useState(false);
  const [newScreenName, setNewScreenName] = useState('');
  const [screenFormError, setScreenFormError] = useState('');
  const renameInputRef = useRef(null);
  const createInputRef = useRef(null);

  useEffect(() => {
    removeLeakedDashboardWidgetCss();
  }, []);

  const sortedWidgets = useMemo(
    () => [...activeWidgets].sort((a, b) => a.position - b.position),
    [activeWidgets]
  );

  const moveTargets = useMemo(
    () => screens
      .filter((screen) => screen.id !== activeScreenId)
      .map((screen) => ({ id: screen.id, name: screen.name })),
    [screens, activeScreenId]
  );

  const availableCards = useMemo(
    () => sortedWidgets.map((item) => {
      const defaults = getDefaultProfileWidgetSize(item.source, item.cardId);
      return {
        id: profileWidgetKey(item.source, item.cardId, item),
        title: getProfileWidgetTitle(item.source, item.cardId, item),
        colSpan: item.colSpan ?? defaults.colSpan,
        rowSpan: item.rowSpan ?? defaults.rowSpan,
      };
    }),
    [sortedWidgets]
  );

  const controlledLayout = useMemo(() => {
    const layout = {};
    sortedWidgets.forEach((item, index) => {
      const defaults = getDefaultProfileWidgetSize(item.source, item.cardId);
      layout[profileWidgetKey(item.source, item.cardId, item)] = {
        position: Number.isFinite(item.position) ? item.position : index,
        visible: true,
        col_span: item.colSpan ?? defaults.colSpan,
        row_span: item.rowSpan ?? defaults.rowSpan,
      };
    });
    return layout;
  }, [sortedWidgets]);

  const handlePersistLayout = useCallback(async (nextLayout) => {
    if (!updateWidgets) return;
    const otherScreens = widgets.filter((item) => item.screenId !== activeScreenId);
    const currentScreen = sortedWidgets
      .map((item) => {
        const key = profileWidgetKey(item.source, item.cardId, item);
        const entry = nextLayout[key] || {};
        const defaults = getDefaultProfileWidgetSize(item.source, item.cardId);
        return {
          ...item,
          position: entry.position ?? item.position ?? 0,
          colSpan: entry.col_span ?? item.colSpan ?? defaults.colSpan,
          rowSpan: entry.row_span ?? item.rowSpan ?? defaults.rowSpan,
        };
      })
      .sort((a, b) => a.position - b.position)
      .map((item, index) => ({ ...item, position: index }));
    await updateWidgets([...otherScreens, ...currentScreen]);
  }, [sortedWidgets, widgets, activeScreenId, updateWidgets]);

  const handleRemoveCard = useCallback((key) => {
    const { source, cardId, flowId } = parseProfileWidgetKey(key);
    removeWidget?.(source, cardId, { flowId });
  }, [removeWidget]);

  const handleMoveCard = useCallback((key, targetScreenId) => {
    const { source, cardId, flowId } = parseProfileWidgetKey(key);
    moveWidget?.(source, cardId, targetScreenId, { flowId });
  }, [moveWidget]);

  const handleStartCreateScreen = useCallback(() => {
    if (screens.length >= MAX_PROFILE_SCREENS) return;
    setCreatingScreen(true);
    setNewScreenName('');
    setScreenFormError('');
    setEditingScreenId(null);
  }, [screens.length]);

  const handleCancelCreateScreen = useCallback(() => {
    setCreatingScreen(false);
    setNewScreenName('');
    setScreenFormError('');
  }, []);

  const handleSubmitCreateScreen = useCallback(async (event) => {
    event?.preventDefault?.();
    const name = newScreenName.trim();
    if (!name) {
      setScreenFormError('Введите название экрана');
      createInputRef.current?.focus();
      return;
    }
    setScreenFormError('');
    try {
      await createScreen?.(name);
      setCreatingScreen(false);
      setNewScreenName('');
    } catch {
      setScreenFormError('Не удалось создать экран');
    }
  }, [createScreen, newScreenName]);

  const handleStartRenameScreen = useCallback((screen) => {
    setCreatingScreen(false);
    setEditingScreenId(screen.id);
    setEditingName(screen.name);
    setScreenFormError('');
  }, []);

  const handleCancelRenameScreen = useCallback(() => {
    setEditingScreenId(null);
    setEditingName('');
  }, []);

  const handleSubmitRenameScreen = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!editingScreenId) return;
    const name = editingName.trim();
    if (!name) {
      setScreenFormError('Название не может быть пустым');
      renameInputRef.current?.focus();
      return;
    }
    setScreenFormError('');
    try {
      await renameScreen?.(editingScreenId, name);
      setEditingScreenId(null);
      setEditingName('');
    } catch {
      setScreenFormError('Не удалось переименовать экран');
    }
  }, [editingScreenId, editingName, renameScreen]);

  const handleDeleteScreen = useCallback(async (screen) => {
    if (screens.length <= 1) return;
    const ok = window.confirm(
      `Удалить экран «${screen.name}»? Виджеты перейдут на другой экран.`
    );
    if (!ok) return;
    if (editingScreenId === screen.id) {
      setEditingScreenId(null);
      setEditingName('');
    }
    await deleteScreen?.(screen.id);
  }, [deleteScreen, screens.length, editingScreenId]);

  useEffect(() => {
    if (editingScreenId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingScreenId]);

  useEffect(() => {
    if (creatingScreen && createInputRef.current) {
      createInputRef.current.focus();
      createInputRef.current.select();
    }
  }, [creatingScreen]);

  if (loadingPins) {
    return <div className={styles.loading}>Загрузка виджетов профиля…</div>;
  }

  return (
    <div className={styles.board}>
      <div className={styles.screenBar}>
        <div className={styles.screenTabs} role="tablist" aria-label="Экраны виджетов профиля">
          {screens.map((screen) => {
            const active = screen.id === activeScreenId;
            const count = widgets.filter((item) => item.screenId === screen.id).length;
            const isEditing = editingScreenId === screen.id;
            return (
              <div key={screen.id} className={`${styles.screenTabWrap} ${active ? styles.screenTabWrapActive : ''}`}>
                {isEditing ? (
                  <form className={styles.screenEditForm} onSubmit={handleSubmitRenameScreen}>
                    <input
                      ref={renameInputRef}
                      className={styles.screenNameInput}
                      value={editingName}
                      maxLength={48}
                      aria-label="Название экрана"
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          handleCancelRenameScreen();
                        }
                      }}
                      onBlur={() => {
                        if (!editingName.trim()) {
                          handleCancelRenameScreen();
                          return;
                        }
                        handleSubmitRenameScreen();
                      }}
                    />
                    <button type="submit" className={styles.screenFormOk} title="Сохранить">
                      ✓
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`${styles.screenTab} ${active ? styles.screenTabActive : ''}`}
                    onClick={() => setActiveScreenId?.(screen.id)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleStartRenameScreen(screen);
                    }}
                    title="Двойной клик — переименовать"
                  >
                    <span className={styles.screenTabName}>{screen.name}</span>
                    <span className={styles.screenTabCount}>{count}</span>
                  </button>
                )}
                {screens.length > 1 && !isEditing && (
                  <button
                    type="button"
                    className={styles.screenDelete}
                    onClick={() => handleDeleteScreen(screen)}
                    title="Удалить экран"
                    aria-label={`Удалить экран «${screen.name}»`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {creatingScreen ? (
            <form className={styles.screenCreateForm} onSubmit={handleSubmitCreateScreen}>
              <input
                ref={createInputRef}
                className={styles.screenNameInput}
                value={newScreenName}
                maxLength={48}
                placeholder="Название экрана"
                aria-label="Название нового экрана"
                required
                onChange={(event) => {
                  setNewScreenName(event.target.value);
                  if (screenFormError) setScreenFormError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    handleCancelCreateScreen();
                  }
                }}
              />
              <button type="submit" className={styles.screenFormOk} title="Создать">
                ✓
              </button>
              <button
                type="button"
                className={styles.screenFormCancel}
                onClick={handleCancelCreateScreen}
                title="Отмена"
              >
                ×
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.screenAdd}
              onClick={handleStartCreateScreen}
              disabled={screens.length >= MAX_PROFILE_SCREENS}
              title={screens.length >= MAX_PROFILE_SCREENS ? `Максимум ${MAX_PROFILE_SCREENS} экранов` : 'Добавить экран'}
            >
              + Экран
            </button>
          )}
        </div>
      </div>
      {screenFormError && <p className={styles.screenFormError}>{screenFormError}</p>}

      {sortedWidgets.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M8 9h8M8 13h5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className={styles.emptyTitle}>На этом экране пока нет виджетов</h2>
          <p className={styles.emptyText}>Добавьте виджет или перенесите с другого экрана</p>
          <p className={styles.emptyHint}>
            На страницах Обзор, Задачи и Статистика нажмите кнопку «в профиль» — виджет попадёт на активный экран.
          </p>
          <div className={styles.emptyLinks}>
            <Link to="/tasks?tab=overview" className={styles.emptyLink}>Обзор</Link>
            <Link to="/tasks?tab=tasks" className={styles.emptyLink}>Задачи</Link>
            <Link to="/tasks?tab=statistics" className={styles.emptyLink}>Статистика</Link>
          </div>
        </div>
      ) : (
        <DraggableGrid
          user={user}
          enableDragAndDrop
          enableResize
          layoutType="profile-widgets"
          availableCards={availableCards}
          controlledLayout={controlledLayout}
          onPersistLayout={handlePersistLayout}
          hideVisibilitySettings
          enablePin={false}
          onRemoveCard={handleRemoveCard}
          moveTargets={moveTargets}
          onMoveCard={handleMoveCard}
        >
          {sortedWidgets.map((item) => {
            const key = profileWidgetKey(item.source, item.cardId, item);
            let content = null;
            if (item.source === 'dashboard') {
              content = (
                <ProfileDashboardWidgetHost
                  dashboardId={item.dashboardId}
                  sheetId={item.sheetId}
                  widgetId={Number(item.cardId)}
                  flowId={item.flowId}
                  title={getProfileWidgetTitle(item.source, item.cardId, item)}
                />
              );
            } else if (item.source === 'overview') {
              content = renderOverviewLiveWidget(item.cardId, overviewModel, { idPrefix: 'profile-ow' });
            } else if (item.source === 'statistics') {
              content = renderStatisticsLiveWidget(item.cardId, statisticsModel, { idPrefix: 'profile-stats' });
            } else if (item.cardId === 'progress-chart') {
              content = tasksLoading
                ? <div className={styles.widgetLoading}>Обновление…</div>
                : (
                  <ProgressChart
                    tasks={tasks}
                    onStatusClick={setSelectedStatus}
                    selectedStatus={selectedStatus}
                    canFilterOverdue={canFilterOverdueTasks(user)}
                    overdueOnly={overdueOnly}
                    onOverdueChange={setOverdueOnly}
                  />
                );
            } else if (item.cardId === 'bar-chart') {
              content = tasksLoading
                ? <div className={styles.widgetLoading}>Обновление…</div>
                : (
                  <BarChart
                    tasks={tasks}
                    onPriorityClick={setSelectedPriority}
                    selectedPriority={selectedPriority}
                  />
                );
            } else if (item.cardId === 'team-ratings') {
              content = (
                <TeamRatings
                  tasks={tasks}
                  user={user}
                  statsScope={statsScope}
                  onScopeChange={setStatsScope}
                />
              );
            }

            if (!content) return null;
            const openHref = item.source === 'dashboard'
              && Number(item.dashboardId) > 0
              && Number(item.sheetId) > 0
              ? buildDashboardSheetPath({
                dashboardId: item.dashboardId,
                sheetId: item.sheetId,
                flowId: item.flowId,
              })
              : undefined;
            return (
              <div
                key={key}
                data-card-id={key}
                data-open-href={openHref}
                className={styles.itemContent}
              >
                {content}
              </div>
            );
          })}
        </DraggableGrid>
      )}
      {hasOverview && <OverviewWidgetModals model={overviewModel} />}
    </div>
  );
}
