import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTasks } from '../../../../services/taskService';
import { projectService } from '../../../../services/projectService';
import { getCurrentUserNoteForTask, createOrUpdateUserNote, deleteUserNote } from '../../../../services/notesService';
import { overviewDataService } from '../../../../services/overviewDataService';
import {
  canViewScopedOverviewTasks,
  isDateInRange,
  isMyTask,
  isOrgWideUser,
  normalizeScheduleItems,
  parseDateInput,
  parseDueDateLocal,
  pickScheduleCompletePhrase,
  getPriorityRangeForPreset,
  PRIORITY_SORT_ORDER,
} from './overviewHelpers';
import { isTaskClosed } from '../../utils/performanceUtils';
import { showTaskToast } from '../../../../components/shared/taskToast';

const LIVE_REFRESH_MS = 30000;

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function useOverviewLiveState(user, { enabled = true, live = false } = {}) {
  const [tasks, setTasks] = useState([]);
  const [dataError, setDataError] = useState('');
  const [loading, setLoading] = useState(Boolean(enabled));
  const [projects, setProjects] = useState([]);
  const [overviewDataLoading, setOverviewDataLoading] = useState(Boolean(enabled));
  const [overviewSaveError, setOverviewSaveError] = useState('');

  const [selectedTaskIdForNote, setSelectedTaskIdForNote] = useState('');
  const [noteText, setNoteText] = useState('');
  const [currentNote, setCurrentNote] = useState(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [scheduleItems, setScheduleItems] = useState([{ time: '', activity: '', completed: false }]);

  const [checklistItems, setChecklistItems] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [removingItems, setRemovingItems] = useState(new Set());
  const [newlyAddedItems, setNewlyAddedItems] = useState(new Set());

  const [scheduleRemoving, setScheduleRemoving] = useState(new Set());
  const [scheduleAdding, setScheduleAdding] = useState(new Set());
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [priorityRangePreset, setPriorityRangePreset] = useState('week');
  const [priorityDateFrom, setPriorityDateFrom] = useState(() => getPriorityRangeForPreset('week').from);
  const [priorityDateTo, setPriorityDateTo] = useState(() => getPriorityRangeForPreset('week').to);
  const [projectStatusFilter, setProjectStatusFilter] = useState('all');

  const overviewDataLoadedRef = useRef(false);
  const orgWideUser = isOrgWideUser(user);

  const activeTasksCount = useMemo(
    () => checklistItems.filter((item) => !item.completed).length,
    [checklistItems]
  );

  const fetchTasksAndProjects = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return;
    try {
      if (!silent) {
        setLoading(true);
        setDataError('');
      }
      const [tasksData, projectsData] = await Promise.all([
        getTasks(),
        projectService.getProjects(),
      ]);
      setTasks(normalizeList(tasksData));
      setProjects(normalizeList(projectsData));
    } catch (error) {
      console.error('Error loading overview data:', error);
      if (!silent) {
        setTasks([]);
        setProjects([]);
        setDataError('Не удалось загрузить задачи и проекты. Проверьте подключение и обновите страницу.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    fetchTasksAndProjects();
    return undefined;
  }, [enabled, user, fetchTasksAndProjects]);

  const migrateLocalStorageToApi = useCallback(async () => {
    if (!user) return null;
    const checklistKey = `checklist_${user.id}`;
    const scheduleKey = `schedule_${user.id}`;
    const storedChecklist = localStorage.getItem(checklistKey);
    const storedSchedule = localStorage.getItem(scheduleKey);

    let checklist = [];
    let schedule = [{ time: '', activity: '', completed: false }];

    if (storedChecklist) {
      try {
        checklist = JSON.parse(storedChecklist);
      } catch {
        checklist = [];
      }
    }
    if (storedSchedule) {
      try {
        const parsed = JSON.parse(storedSchedule);
        schedule = normalizeScheduleItems(parsed.length > 0 ? parsed : null);
      } catch {
        schedule = [{ time: '', activity: '', completed: false }];
      }
    }

    if (checklist.length > 0 || (storedSchedule && schedule.some((s) => s.time || s.activity))) {
      await overviewDataService.saveOverviewData({ checklist, schedule });
      localStorage.removeItem(checklistKey);
      localStorage.removeItem(scheduleKey);
    }

    return { checklist, schedule: normalizeScheduleItems(schedule) };
  }, [user]);

  const loadOverviewWidgetData = useCallback(async ({ silent = false } = {}) => {
    if (!enabled || !user) return;
    if (!silent) {
      setOverviewDataLoading(true);
      setOverviewSaveError('');
    }
    try {
      const data = await overviewDataService.getOverviewData();
      let checklist = Array.isArray(data.checklist) ? data.checklist : [];
      let schedule = normalizeScheduleItems(
        Array.isArray(data.schedule) && data.schedule.length > 0 ? data.schedule : null
      );

      if (checklist.length === 0 && schedule.every((s) => !s.time && !s.activity)) {
        const migrated = await migrateLocalStorageToApi();
        if (migrated) {
          checklist = migrated.checklist;
          schedule = normalizeScheduleItems(migrated.schedule);
        }
      }

      setChecklistItems(checklist);
      setScheduleItems(schedule);
      overviewDataLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading overview widget data:', error);
      const migrated = await migrateLocalStorageToApi().catch(() => null);
      if (migrated) {
        setChecklistItems(migrated.checklist);
        setScheduleItems(normalizeScheduleItems(migrated.schedule));
      }
      if (!silent) {
        setOverviewSaveError('Не удалось загрузить чек-лист и расписание с сервера.');
      }
    } finally {
      if (!silent) setOverviewDataLoading(false);
    }
  }, [enabled, user, migrateLocalStorageToApi]);

  useEffect(() => {
    if (!enabled) {
      setOverviewDataLoading(false);
      return undefined;
    }
    overviewDataLoadedRef.current = false;
    loadOverviewWidgetData();
    return undefined;
  }, [enabled, loadOverviewWidgetData]);

  const refreshLive = useCallback(() => {
    fetchTasksAndProjects({ silent: true });
    loadOverviewWidgetData({ silent: true });
  }, [fetchTasksAndProjects, loadOverviewWidgetData]);

  useEffect(() => {
    if (!enabled || !live) return undefined;

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshLive();
    };
    window.addEventListener('focus', refreshLive);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refreshLive, LIVE_REFRESH_MS);
    return () => {
      window.removeEventListener('focus', refreshLive);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, live, refreshLive]);

  const persistChecklist = useCallback(async (items) => {
    if (!user || !overviewDataLoadedRef.current) return;
    try {
      await overviewDataService.saveOverviewData({ checklist: items });
      setOverviewSaveError('');
    } catch (error) {
      console.error('Error saving checklist:', error);
      setOverviewSaveError('Не удалось сохранить чек-лист.');
    }
  }, [user]);

  const persistSchedule = useCallback(async (items) => {
    if (!user || !overviewDataLoadedRef.current) return;
    try {
      await overviewDataService.saveOverviewData({ schedule: items });
      setOverviewSaveError('');
    } catch (error) {
      console.error('Error saving schedule:', error);
      setOverviewSaveError('Не удалось сохранить расписание.');
    }
  }, [user]);

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;

    const newItem = {
      id: Date.now(),
      text: newChecklistItem.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const updatedItems = [...checklistItems, newItem];
    setChecklistItems(updatedItems);
    persistChecklist(updatedItems);
    setNewChecklistItem('');

    setNewlyAddedItems((prev) => new Set([...prev, newItem.id]));
    setTimeout(() => {
      setNewlyAddedItems((prev) => {
        const next = new Set(prev);
        next.delete(newItem.id);
        return next;
      });
    }, 300);
  };

  const removeChecklistItem = (itemId, withAnimation = false) => {
    const applyRemove = () => {
      setChecklistItems((prev) => {
        const updatedItems = prev.filter((item) => item.id !== itemId);
        persistChecklist(updatedItems);
        return updatedItems;
      });
      setRemovingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    };

    if (withAnimation) {
      setRemovingItems((prev) => new Set([...prev, itemId]));
      setTimeout(applyRemove, 450);
    } else {
      applyRemove();
    }
  };

  const toggleChecklistItem = (itemId) => {
    const updatedItems = checklistItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    const completedItem = updatedItems.find((item) => item.id === itemId);
    if (completedItem?.completed) {
      setRemovingItems((prev) => new Set([...prev, itemId]));
      setTimeout(() => removeChecklistItem(itemId), 500);
    } else {
      setRemovingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }

    setChecklistItems(updatedItems);
    persistChecklist(updatedItems);
  };

  const handleChecklistKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem();
    }
  };

  useEffect(() => {
    const loadNote = async () => {
      if (!selectedTaskIdForNote || !user) {
        setNoteText('');
        setCurrentNote(null);
        return;
      }

      try {
        const note = await getCurrentUserNoteForTask(parseInt(selectedTaskIdForNote, 10), user);
        if (note) {
          setNoteText(note.note_text);
          setCurrentNote(note);
        } else {
          setNoteText('');
          setCurrentNote(null);
        }
      } catch (error) {
        console.error('Error loading note:', error);
        setNoteText('');
        setCurrentNote(null);
      }
    };

    loadNote();
  }, [selectedTaskIdForNote, user]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const applyPriorityRangePreset = useCallback((presetId) => {
    const range = getPriorityRangeForPreset(presetId);
    setPriorityRangePreset(presetId);
    setPriorityDateFrom(range.from);
    setPriorityDateTo(range.to);
  }, []);

  const handlePriorityDateFromChange = (value) => {
    setPriorityRangePreset('custom');
    setPriorityDateFrom(value);
    if (value && priorityDateTo && value > priorityDateTo) {
      setPriorityDateTo(value);
    }
  };

  const handlePriorityDateToChange = (value) => {
    setPriorityRangePreset('custom');
    setPriorityDateTo(value);
    if (value && priorityDateFrom && value < priorityDateFrom) {
      setPriorityDateFrom(value);
    }
  };

  const priorityTasks = useMemo(() => {
    const from = parseDateInput(priorityDateFrom);
    const to = parseDateInput(priorityDateTo);
    if (!from || !to) return [];

    return (tasks || [])
      .filter((t) => {
        if (!t.due_date || isTaskClosed(t.status)) return false;
        const due = parseDueDateLocal(t.due_date);
        if (!due || !isDateInRange(due, from, to)) return false;
        if (!orgWideUser && !isMyTask(t, user)) return false;
        return true;
      })
      .sort((a, b) => {
        const priorityDiff =
          (PRIORITY_SORT_ORDER[a.priority] || 99) - (PRIORITY_SORT_ORDER[b.priority] || 99);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.due_date) - new Date(b.due_date);
      })
      .slice(0, 15);
  }, [tasks, priorityDateFrom, priorityDateTo, orgWideUser, user]);

  const scopedOverviewTasks = canViewScopedOverviewTasks(user);

  const overdueTasks = useMemo(() => (
    (tasks || [])
      .filter((t) => {
        if (!t.due_date || isTaskClosed(t.status)) return false;
        const due = parseDueDateLocal(t.due_date);
        if (!due || !(due < today)) return false;
        if (!scopedOverviewTasks && !isMyTask(t, user)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
  ), [tasks, today, scopedOverviewTasks, user]);

  const upcomingTasks = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const afterTomorrow = new Date(today);
    afterTomorrow.setDate(today.getDate() + 2);

    const isSameDay = (dateA, dateB) =>
      dateA.getFullYear() === dateB.getFullYear()
      && dateA.getMonth() === dateB.getMonth()
      && dateA.getDate() === dateB.getDate();

    return (tasks || [])
      .filter((t) => {
        if (!t.due_date || isTaskClosed(t.status)) return false;
        const due = parseDueDateLocal(t.due_date);
        if (!due) return false;
        if (!(isSameDay(due, tomorrow) || isSameDay(due, afterTomorrow))) return false;
        if (!scopedOverviewTasks && !isMyTask(t, user)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }, [tasks, today, scopedOverviewTasks, user]);

  const visibleProjects = useMemo(() => {
    if (!user) return [];
    if (orgWideUser) return projects || [];
    return (projects || []).filter((p) => {
      const isManager = p.manager_id === user.id || p.manager_username === user.username;
      const isMember = (p.teams || []).some((team) =>
        (team.members || []).some((member) => member.user_id === user.id && member.is_active)
      );
      return isManager || isMember;
    });
  }, [projects, user, orgWideUser]);

  const filteredProjects = useMemo(() => {
    if (projectStatusFilter === 'all') return visibleProjects;
    return visibleProjects.filter((p) => p.status === projectStatusFilter);
  }, [visibleProjects, projectStatusFilter]);

  const handleOpenTask = useCallback((task) => {
    setSelectedTask(task);
  }, []);

  const handleOpenProject = useCallback((project) => {
    setSelectedProject(project);
  }, []);

  const handleCloseProject = useCallback(() => {
    setSelectedProject(null);
  }, []);

  const handleOpenTaskFromProject = useCallback((task) => {
    const fullTask = tasks.find((item) => item.id === task.id) ?? task;
    setSelectedTask(fullTask);
  }, [tasks]);

  const handleCloseTask = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTaskUpdate = useCallback(async () => {
    try {
      const tasksData = await getTasks();
      const normalizedTasks = normalizeList(tasksData);
      setTasks(normalizedTasks);
      setSelectedTask((prev) => {
        if (!prev) return null;
        return normalizedTasks.find((t) => t.id === prev.id) ?? prev;
      });
    } catch (error) {
      console.error('Error refreshing tasks:', error);
    }
  }, []);

  const addScheduleItem = () => {
    const newIndex = scheduleItems.length;
    const newItems = [...scheduleItems, { time: '', activity: '', completed: false }];
    setScheduleItems(newItems);
    persistSchedule(newItems);

    setScheduleAdding((prev) => new Set([...prev, newIndex]));
    setTimeout(() => {
      setScheduleAdding((prev) => {
        const next = new Set(prev);
        next.delete(newIndex);
        return next;
      });
    }, 500);
  };

  const updateScheduleItem = (idx, key, value) => {
    const newItems = scheduleItems.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [key]: value };
      if (key === 'activity' && !String(value).trim()) {
        next.completed = false;
      }
      return next;
    });
    setScheduleItems(newItems);
    persistSchedule(newItems);
  };

  const toggleScheduleComplete = (idx) => {
    const item = scheduleItems[idx];
    if (!item?.activity?.trim()) return;

    const newCompleted = !item.completed;
    const newItems = scheduleItems.map((it, i) =>
      i === idx ? { ...it, completed: newCompleted } : it
    );
    setScheduleItems(newItems);
    persistSchedule(newItems);

    if (newCompleted) {
      showTaskToast({
        type: 'success',
        title: 'Задача выполнена!',
        message: pickScheduleCompletePhrase(),
      });
    }
  };

  const removeScheduleItem = (idx) => {
    if (scheduleItems.length === 1) {
      const newItems = [{ time: '', activity: '', completed: false }];
      setScheduleItems(newItems);
      persistSchedule(newItems);
      return;
    }

    setScheduleRemoving((prev) => new Set([...prev, idx]));
    setTimeout(() => {
      const newItems = scheduleItems.filter((_, i) => i !== idx);
      setScheduleItems(newItems);
      persistSchedule(newItems);
      setScheduleRemoving((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }, 400);
  };

  const handleSaveNote = async () => {
    if (!selectedTaskIdForNote || !noteText.trim()) return;

    try {
      setNoteSaving(true);
      const savedNote = await createOrUpdateUserNote(parseInt(selectedTaskIdForNote, 10), noteText.trim());
      setCurrentNote(savedNote);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Ошибка при сохранении заметки');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedTaskIdForNote || !currentNote) return;
    if (!window.confirm('Вы уверены, что хотите удалить заметку?')) return;

    try {
      setNoteSaving(true);
      await deleteUserNote(parseInt(selectedTaskIdForNote, 10));
      setNoteText('');
      setCurrentNote(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Ошибка при удалении заметки');
    } finally {
      setNoteSaving(false);
    }
  };

  return {
    user,
    orgWideUser,
    tasks,
    projects,
    dataError,
    loading,
    overviewDataLoading,
    overviewSaveError,
    selectedTaskIdForNote,
    setSelectedTaskIdForNote,
    noteText,
    setNoteText,
    currentNote,
    noteSaving,
    scheduleItems,
    checklistItems,
    newChecklistItem,
    setNewChecklistItem,
    removingItems,
    newlyAddedItems,
    scheduleRemoving,
    scheduleAdding,
    selectedTask,
    selectedProject,
    priorityRangePreset,
    priorityDateFrom,
    priorityDateTo,
    projectStatusFilter,
    setProjectStatusFilter,
    activeTasksCount,
    priorityTasks,
    overdueTasks,
    upcomingTasks,
    visibleProjects,
    filteredProjects,
    applyPriorityRangePreset,
    handlePriorityDateFromChange,
    handlePriorityDateToChange,
    handleOpenTask,
    handleOpenProject,
    handleCloseProject,
    handleOpenTaskFromProject,
    handleCloseTask,
    handleTaskUpdate,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    handleChecklistKeyPress,
    addScheduleItem,
    updateScheduleItem,
    toggleScheduleComplete,
    removeScheduleItem,
    handleSaveNote,
    handleDeleteNote,
    reloadTasks: fetchTasksAndProjects,
  };
}
