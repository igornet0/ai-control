import React, { useCallback, useEffect, useState } from 'react';
import { getUserStatistics } from '../../../../services/statsService';

const LIVE_REFRESH_MS = 30000;

const defaultStats = {
  completed: { day: 0, week: 0, month: 0, all_time: 0 },
  overdue_in_period: 0,
  teams_count: 0,
  projects_count: 0,
};

export function useStatisticsLiveState({ enabled = true, live = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const json = await getUserStatistics(periodFrom, periodTo);
      setData(json);
    } catch (e) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enabled, periodFrom, periodTo]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    fetchStats();
    return undefined;
    // Initial load and when the hook is enabled. Period changes apply via «Обновить».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !live) return undefined;
    const refresh = () => fetchStats({ silent: true });
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
  }, [enabled, live, fetchStats]);

  const stats = (() => {
    const base = defaultStats;
    if (!data || typeof data !== 'object') return base;
    return {
      ...base,
      ...data,
      completed: { ...base.completed, ...(data.completed || {}) },
    };
  })();

  const completedTotal = stats.completed?.all_time ?? 0;
  const isAllZero =
    (stats.completed?.day ?? 0) === 0 &&
    (stats.completed?.week ?? 0) === 0 &&
    (stats.completed?.month ?? 0) === 0 &&
    completedTotal === 0 &&
    (stats.overdue_in_period ?? 0) === 0 &&
    (stats.teams_count ?? 0) === 0 &&
    (stats.projects_count ?? 0) === 0;

  return {
    stats,
    loading,
    error,
    periodFrom,
    setPeriodFrom,
    periodTo,
    setPeriodTo,
    fetchStats,
    completedTotal,
    isAllZero,
  };
}
