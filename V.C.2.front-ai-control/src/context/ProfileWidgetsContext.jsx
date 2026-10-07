import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { getDefaultProfileWidgetSize, getProfileWidgetTitle, isKnownProfileWidget, isProfileExportBlockedType, sameDashboardPin } from '../services/profileWidgetCatalog';
import {
  createDefaultScreens,
  DEFAULT_PROFILE_SCREEN_ID,
  makeScreenId,
  MAX_PROFILE_SCREENS,
  profileWidgetsService,
} from '../services/profileWidgetsService';
import { showTaskToast } from '../components/shared/taskToast';

export const PROFILE_WIDGETS_CHANGED_EVENT = 'aicontrol:profile-widgets-changed';
const ACTIVE_SCREEN_STORAGE_KEY = 'aicontrol:profile-active-screen';

const ProfileWidgetsContext = createContext(null);

function reindexWidgets(widgets) {
  const byScreen = new Map();
  (widgets || []).forEach((item) => {
    const list = byScreen.get(item.screenId) || [];
    list.push(item);
    byScreen.set(item.screenId, list);
  });

  const next = [];
  byScreen.forEach((list) => {
    list
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .forEach((item, index) => {
        next.push({ ...item, position: index });
      });
  });
  return next;
}

function readStoredActiveScreenId() {
  try {
    return localStorage.getItem(ACTIVE_SCREEN_STORAGE_KEY) || DEFAULT_PROFILE_SCREEN_ID;
  } catch {
    return DEFAULT_PROFILE_SCREEN_ID;
  }
}

export function ProfileWidgetsProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [screens, setScreens] = useState(createDefaultScreens);
  const [widgets, setWidgets] = useState([]);
  const [activeScreenId, setActiveScreenIdState] = useState(readStoredActiveScreenId);
  const [loading, setLoading] = useState(true);

  const setActiveScreenId = useCallback((screenId) => {
    setActiveScreenIdState(screenId);
    try {
      localStorage.setItem(ACTIVE_SCREEN_STORAGE_KEY, screenId);
    } catch {
      // ignore storage errors
    }
  }, []);

  const reload = useCallback(async () => {
    if (authLoading) return { screens: createDefaultScreens(), widgets: [] };
    if (!user) {
      setScreens(createDefaultScreens());
      setWidgets([]);
      setLoading(false);
      return { screens: createDefaultScreens(), widgets: [] };
    }
    setLoading(true);
    const next = await profileWidgetsService.getProfileWidgets();
    setScreens(next.screens);
    setWidgets(next.widgets);
    setActiveScreenIdState((current) => {
      if (next.screens.some((screen) => screen.id === current)) return current;
      const fallback = next.screens[0]?.id || DEFAULT_PROFILE_SCREEN_ID;
      try {
        localStorage.setItem(ACTIVE_SCREEN_STORAGE_KEY, fallback);
      } catch {
        // ignore
      }
      return fallback;
    });
    setLoading(false);
    return next;
  }, [user, authLoading]);

  useEffect(() => {
    reload();
  }, [reload]);

  const isPinned = useCallback((source, cardId, meta = null) => {
    if (source === 'dashboard') {
      return widgets.some((item) => sameDashboardPin(item, cardId, meta?.flowId ?? meta?.flow_id));
    }
    return widgets.some((item) => item.source === source && String(item.cardId) === String(cardId));
  }, [widgets]);

  const persist = useCallback(async (nextScreens, nextWidgets, { silent = false } = {}) => {
    const previousScreens = screens;
    const previousWidgets = widgets;
    const normalizedWidgets = reindexWidgets(nextWidgets);
    setScreens(nextScreens);
    setWidgets(normalizedWidgets);
    try {
      const saved = await profileWidgetsService.updateProfileWidgets({
        screens: nextScreens,
        widgets: normalizedWidgets,
      });
      setScreens(saved.screens);
      setWidgets(saved.widgets);
      if (!saved.screens.some((screen) => screen.id === activeScreenId)) {
        setActiveScreenId(saved.screens[0]?.id || DEFAULT_PROFILE_SCREEN_ID);
      }
      window.dispatchEvent(new Event(PROFILE_WIDGETS_CHANGED_EVENT));
      return saved;
    } catch (error) {
      console.error('Error updating profile widgets:', error);
      setScreens(previousScreens);
      setWidgets(previousWidgets);
      if (!silent) {
        const detail = error?.response?.data?.detail;
        const detailText = typeof detail === 'string'
          ? detail
          : (Array.isArray(detail) ? detail.map((d) => d?.msg || JSON.stringify(d)).join('; ') : '');
        showTaskToast({
          type: 'error',
          title: 'Не удалось сохранить виджеты профиля',
          message: detailText || error?.message || 'Попробуйте ещё раз',
        });
      }
      throw error;
    }
  }, [screens, widgets, activeScreenId, setActiveScreenId]);

  const toggleWidget = useCallback(async (source, cardId, meta = null) => {
    if (!user) return false;
    if (source === 'dashboard' && isProfileExportBlockedType(meta?.widgetType ?? meta?.widget_type)) {
      return false;
    }
    if (!isKnownProfileWidget(source, cardId, meta)) return false;

    const title = getProfileWidgetTitle(source, cardId, meta);
    const pinned = isPinned(source, cardId, meta);
    const targetScreenId = screens.some((screen) => screen.id === activeScreenId)
      ? activeScreenId
      : (screens[0]?.id || DEFAULT_PROFILE_SCREEN_ID);

    let nextWidgets;
    if (pinned) {
      nextWidgets = widgets.filter((item) => {
        if (item.source !== source || String(item.cardId) !== String(cardId)) return true;
        if (source === 'dashboard') {
          return !sameDashboardPin(item, cardId, meta?.flowId ?? meta?.flow_id);
        }
        return false;
      });
    } else {
      const defaults = getDefaultProfileWidgetSize(source, cardId);
      const nextItem = {
        source,
        cardId: String(cardId),
        screenId: targetScreenId,
        position: widgets.filter((item) => item.screenId === targetScreenId).length,
        ...defaults,
      };
      if (source === 'dashboard') {
        nextItem.dashboardId = Number(meta?.dashboardId ?? meta?.dashboard_id);
        nextItem.sheetId = Number(meta?.sheetId ?? meta?.sheet_id);
        const flowId = Number(meta?.flowId ?? meta?.flow_id);
        if (Number.isInteger(flowId) && flowId > 0) nextItem.flowId = flowId;
        if (meta?.title) nextItem.title = String(meta.title).slice(0, 120);
        if (meta?.widgetType || meta?.widget_type) {
          nextItem.widgetType = String(meta.widgetType ?? meta.widget_type).slice(0, 64);
        }
      }
      nextWidgets = [...widgets, nextItem];
    }

    await persist(screens, nextWidgets);
    showTaskToast({
      type: 'success',
      title: pinned ? 'Виджет убран из профиля' : 'Виджет добавлен в профиль',
      message: pinned ? title : `${title} → ${screens.find((s) => s.id === targetScreenId)?.name || 'экран'}`,
    });
    return !pinned;
  }, [user, isPinned, widgets, screens, activeScreenId, persist]);

  const removeWidget = useCallback(async (source, cardId, meta = null) => {
    if (!isPinned(source, cardId, meta)) return;
    const nextWidgets = widgets.filter((item) => {
      if (item.source !== source || String(item.cardId) !== String(cardId)) return true;
      if (source === 'dashboard') return !sameDashboardPin(item, cardId, meta?.flowId ?? meta?.flow_id);
      return false;
    });
    await persist(screens, nextWidgets);
  }, [isPinned, widgets, screens, persist]);

  const updateWidgets = useCallback(async (nextWidgets) => {
    await persist(screens, nextWidgets, { silent: true });
  }, [persist, screens]);

  const moveWidget = useCallback(async (source, cardId, targetScreenId, meta = null) => {
    if (!screens.some((screen) => screen.id === targetScreenId)) return;
    const nextWidgets = widgets.map((item) => {
      if (item.source !== source || String(item.cardId) !== String(cardId)) return item;
      if (source === 'dashboard' && !sameDashboardPin(item, cardId, meta?.flowId ?? meta?.flow_id)) {
        return item;
      }
      return {
        ...item,
        screenId: targetScreenId,
        position: widgets.filter((w) => w.screenId === targetScreenId).length,
      };
    });
    await persist(screens, nextWidgets, { silent: true });
    showTaskToast({
      type: 'success',
      title: 'Виджет перемещён',
      message: screens.find((screen) => screen.id === targetScreenId)?.name || 'Другой экран',
    });
  }, [widgets, screens, persist]);

  const createScreen = useCallback(async (name = '') => {
    if (screens.length >= MAX_PROFILE_SCREENS) {
      showTaskToast({
        type: 'error',
        title: 'Достигнут лимит экранов',
        message: `Можно создать не больше ${MAX_PROFILE_SCREENS}`,
      });
      return null;
    }
    const label = String(name || `Экран ${screens.length + 1}`).trim().slice(0, 48) || `Экран ${screens.length + 1}`;
    const screen = {
      id: makeScreenId(label),
      name: label,
      position: screens.length,
    };
    const nextScreens = [...screens, screen].map((item, index) => ({ ...item, position: index }));
    await persist(nextScreens, widgets);
    setActiveScreenId(screen.id);
    return screen;
  }, [screens, widgets, persist, setActiveScreenId]);

  const renameScreen = useCallback(async (screenId, name) => {
    const label = String(name || '').trim().slice(0, 48);
    if (!label) return;
    const nextScreens = screens.map((screen) => (
      screen.id === screenId ? { ...screen, name: label } : screen
    ));
    await persist(nextScreens, widgets, { silent: true });
  }, [screens, widgets, persist]);

  const deleteScreen = useCallback(async (screenId) => {
    if (screens.length <= 1) {
      showTaskToast({
        type: 'error',
        title: 'Нельзя удалить последний экран',
        message: 'Оставьте хотя бы один экран профиля',
      });
      return;
    }
    const fallback = screens.find((screen) => screen.id !== screenId)?.id;
    if (!fallback) return;
    const nextScreens = screens
      .filter((screen) => screen.id !== screenId)
      .map((screen, index) => ({ ...screen, position: index }));
    const nextWidgets = widgets.map((item) => (
      item.screenId === screenId
        ? { ...item, screenId: fallback }
        : item
    ));
    await persist(nextScreens, nextWidgets);
    if (activeScreenId === screenId) {
      setActiveScreenId(fallback);
    }
  }, [screens, widgets, persist, activeScreenId, setActiveScreenId]);

  const activeWidgets = useMemo(
    () => widgets
      .filter((item) => item.screenId === activeScreenId)
      .sort((a, b) => a.position - b.position),
    [widgets, activeScreenId]
  );

  const value = useMemo(() => ({
    screens,
    widgets,
    activeWidgets,
    activeScreenId,
    setActiveScreenId,
    loading,
    isPinned,
    toggleWidget,
    removeWidget,
    updateWidgets,
    moveWidget,
    createScreen,
    renameScreen,
    deleteScreen,
    reload,
  }), [
    screens,
    widgets,
    activeWidgets,
    activeScreenId,
    setActiveScreenId,
    loading,
    isPinned,
    toggleWidget,
    removeWidget,
    updateWidgets,
    moveWidget,
    createScreen,
    renameScreen,
    deleteScreen,
    reload,
  ]);

  return (
    <ProfileWidgetsContext.Provider value={value}>
      {children}
    </ProfileWidgetsContext.Provider>
  );
}

export function useProfileWidgets() {
  return useContext(ProfileWidgetsContext);
}
