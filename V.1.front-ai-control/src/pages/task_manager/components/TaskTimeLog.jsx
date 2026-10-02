import React, { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { getTaskTimeLogs, addTaskTimeLog, deleteTaskTimeLog } from '../../../services/taskService';
import { ChartIcon, IconWithText, PlayIconSm, TimerIcon } from './TaskManagerIcons';

export default function TaskTimeLog({ taskId, currentUser, canModerate = false, onTimeUpdate }) {
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timeLogs, setTimeLogs] = useState([]);
  const [newLog, setNewLog] = useState({ hours: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (taskId) {
      loadTimeLogs();
    }
  }, [taskId]);

  useEffect(() => {
    let interval;
    if (isTracking && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, startTime]);

  const loadTimeLogs = async () => {
    try {
      setLoading(true);
      const logs = await getTaskTimeLogs(taskId);
      setTimeLogs(logs);
    } catch (error) {
      console.error('Error loading time logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const startTracking = () => {
    setIsTracking(true);
    setStartTime(new Date());
    setElapsedTime(0);
  };

  const stopTracking = async () => {
    if (elapsedTime > 0) {
      const hours = (elapsedTime / 3600).toFixed(2);
      const description = `Автоматически отслежено: ${formatTime(elapsedTime)}`;
      
      try {
        await addTimeLogEntry(hours, description);
      } catch (error) {
        console.error('Error saving tracked time:', error);
      }
    }
    setIsTracking(false);
    setStartTime(null);
    setElapsedTime(0);
  };

  const addTimeLogEntry = async (hoursValue, descriptionValue) => {
    if (!hoursValue || !descriptionValue?.trim()) return;

    try {
      setSubmitting(true);
      const timeLogData = {
        hours: parseFloat(hoursValue),
        description: descriptionValue.trim()
      };

      await addTaskTimeLog(taskId, timeLogData);
      setNewLog({ hours: '', description: '' });
      await loadTimeLogs();
      
      if (onTimeUpdate) {
        onTimeUpdate(timeLogData);
      }
    } catch (error) {
      console.error('Error adding time log:', error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTimeLog = async (e) => {
    e.preventDefault();
    if (!newLog.hours || !newLog.description.trim()) return;
    await addTimeLogEntry(newLog.hours, newLog.description);
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Удалить запись учёта времени?')) return;
    try {
      await deleteTaskTimeLog(taskId, logId);
      await loadTimeLogs();
      if (onTimeUpdate) onTimeUpdate();
    } catch (error) {
      console.error('Error deleting time log:', error);
    }
  };

  const totalHours = timeLogs.reduce((sum, log) => sum + log.hours, 0);

  if (loading) {
    return (
      <div className="bg-slate-800/30 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-slate-700/50">
        <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
          <TimerIcon size="md" />
          <span>Учёт времени</span>
        </h3>
        <div className="text-center text-slate-400 text-sm py-4">
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-slate-700/50">
      <h3 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
        <TimerIcon size="md" />
        <span>Учёт времени</span>
      </h3>

      {/* Трекер времени */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-slate-400 mb-1">Отслеживание времени</div>
            <div className="text-2xl font-mono font-bold text-green-400">
              {formatTime(elapsedTime)}
            </div>
          </div>
          <div className="flex gap-2">
            {!isTracking ? (
              <button
                onClick={startTracking}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <IconWithText icon={PlayIconSm}>Начать</IconWithText>
              </button>
            ) : (
              <button
                onClick={stopTracking}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium transition-all duration-200 shadow-md hover:shadow-lg"
              >
                ⏹ Остановить
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Форма добавления времени вручную */}
      <form onSubmit={handleAddTimeLog} className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
          <input
            type="number"
            step="0.25"
            min="0"
            value={newLog.hours}
            onChange={(e) => setNewLog({ ...newLog, hours: e.target.value })}
            placeholder="Часы"
            className="rounded-lg border border-slate-600/50 bg-slate-800/50 backdrop-blur-sm p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            disabled={submitting}
          />
          <input
            type="text"
            value={newLog.description}
            onChange={(e) => setNewLog({ ...newLog, description: e.target.value })}
            placeholder="Описание работы"
            className="col-span-2 rounded-lg border border-slate-600/50 bg-slate-800/50 backdrop-blur-sm p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={!newLog.hours || !newLog.description.trim() || submitting}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 ${
              newLog.hours && newLog.description.trim() && !submitting
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg'
                : 'bg-slate-700/50 cursor-not-allowed opacity-60'
            }`}
          >
            {submitting ? 'Добавление...' : 'Добавить'}
          </button>
        </div>
      </form>

      {/* Статистика */}
      <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
        <div className="text-sm text-slate-400">Всего часов</div>
        <div className="text-2xl font-bold text-blue-400">{totalHours.toFixed(2)} ч</div>
      </div>

      {/* Список логов */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {timeLogs.length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-6 bg-slate-800/20 rounded-lg border border-slate-700/30">
            <ChartIcon size="2xl" className="mx-auto mb-2 text-slate-500" />
            <p>Пока нет записей учёта времени</p>
          </div>
        ) : (
          timeLogs.map((log) => (
            <div key={log.id} className="border-l-2 border-blue-500/50 pl-4 py-2 bg-slate-800/20 rounded-r-lg hover:bg-slate-800/30 transition-all duration-200">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-xs text-white font-semibold shadow-md">
                    {log.user_name ? log.user_name.split(' ').map(n => n[0]).join('') : 'U'}
                  </div>
                  <span className="text-sm font-medium text-slate-200">
                    {log.user_name || 'Неизвестный пользователь'}
                  </span>
                  <span className="text-sm font-bold text-blue-400">
                    {log.hours} ч
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">
                    {formatDate(log.logged_at)}
                  </span>
                  {canModerate && (
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-red-400"
                      title="Удалить запись"
                      onClick={() => handleDeleteLog(log.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {log.description && (
                <p className="text-sm text-slate-300 ml-10 leading-relaxed">
                  {log.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
