import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderTabs from '../taskManager/components/HeaderTabs';
import { getTasks } from '../../services/taskService';
import { projectService } from '../../services/projectService';

export default function OverviewPage({ user }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);

  const [selectedTaskIdForNote, setSelectedTaskIdForNote] = useState('');
  const [noteText, setNoteText] = useState('');
  const [scheduleItems, setScheduleItems] = useState([{ time: '', activity: '' }]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [tasksData, projectsData] = await Promise.all([
          getTasks(),
          projectService.getProjects()
        ]);
        setTasks(tasksData || []);
        setProjects(projectsData || []);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const today = new Date();
  const isSameDay = (dateA, dateB) => dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth() && dateA.getDate() === dateB.getDate();

  const prioritiesToday = useMemo(() => {
    const list = (tasks || [])
      .filter(t => {
        if (!t.due_date) return false;
        const due = new Date(t.due_date);
        return isSameDay(due, today) && t.status !== 'completed';
      })
      .sort((a, b) => {
        const order = { urgent: 1, critical: 2, high: 3, medium: 4, low: 5 };
        return (order[a.priority] || 99) - (order[b.priority] || 99);
      })
      .slice(0, 5);
    return list;
  }, [tasks]);

  const overdueTasks = useMemo(() => {
    const now = new Date();
    return (tasks || []).filter(t => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      return due < now && t.status !== 'completed' && t.status !== 'cancelled';
    }).slice(0, 5);
  }, [tasks]);

  const upcomingTasks = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const afterTomorrow = new Date(today);
    afterTomorrow.setDate(today.getDate() + 2);

    const isTomorrow = (d) => isSameDay(d, tomorrow);
    const isAfterTomorrow = (d) => isSameDay(d, afterTomorrow);

    const list = (tasks || []).filter(t => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      return isTomorrow(due) || isAfterTomorrow(due);
    }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

    return list.slice(0, 10);
  }, [tasks]);

  const userProjects = useMemo(() => {
    if (!user) return [];
    return (projects || []).filter(p => {
      const isManager = p.manager_id === user.id || p.manager_username === user.username;
      const isMember = (p.teams || []).some(team => (team.members || []).some(m => m.user_id === user.id));
      return isManager || isMember;
    });
  }, [projects, user]);

  const addScheduleItem = () => setScheduleItems(prev => [...prev, { time: '', activity: '' }]);
  const updateScheduleItem = (idx, key, value) => setScheduleItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  const removeScheduleItem = (idx) => setScheduleItems(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm text-gray-100">
      <div className="bg-gradient-to-b from-[#0D1414] to-[#16251C] rounded-xl shadow-md p-6">
        <HeaderTabs />
        <div className="mt-6">
          <h1 className="text-2xl font-bold text-gray-100">Обзор</h1>
        </div>

        {loading ? (
          <div className="text-gray-400">Загрузка...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Мои приоритеты на сегодня */}
            <div className="bg-[#0F1717] rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Мои приоритеты на сегодня</h3>
              {prioritiesToday.length === 0 ? (
                <div className="text-gray-400">На сегодня приоритетов нет</div>
              ) : (
                <ul className="space-y-2">
                  {prioritiesToday.map(t => (
                    <li key={t.id} className="p-3 rounded bg-[#16251C] flex justify-between items-center">
                      <div>
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-gray-400">Приоритет: {t.priority || '—'}</div>
                      </div>
                      <div className="text-xs text-gray-400">Дедлайн: {t.due_date ? new Date(t.due_date).toLocaleDateString('ru-RU') : '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Просроченные задачи */}
            <div className="bg-[#0F1717] rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Просроченные задачи</h3>
              {overdueTasks.length === 0 ? (
                <div className="text-gray-400">Просроченных задач нет</div>
              ) : (
                <ul className="space-y-2">
                  {overdueTasks.map(t => (
                    <li key={t.id} className="p-3 rounded bg-[#16251C]">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-400">Дедлайн: {t.due_date ? new Date(t.due_date).toLocaleDateString('ru-RU') : '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Предстоящие дедлайны */}
            <div className="bg-[#0F1717] rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Предстоящие дедлайны</h3>
              {upcomingTasks.length === 0 ? (
                <div className="text-gray-400">Нет задач на завтра и послезавтра</div>
              ) : (
                <ul className="space-y-2">
                  {upcomingTasks.map(t => (
                    <li key={t.id} className="p-3 rounded bg-[#16251C] flex justify-between">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-gray-400">{new Date(t.due_date).toLocaleDateString('ru-RU')}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Статусы проектов */}
            <div className="bg-[#0F1717] rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Статусы проектов</h3>
              {userProjects.length === 0 ? (
                <div className="text-gray-400">Нет проектов</div>
              ) : (
                <ul className="space-y-2">
                  {userProjects.map(p => (
                    <li key={p.id} className="p-3 rounded bg-[#16251C]">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-400">Команд: {(p.teams || []).length}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Заметки к задачам */}
            <div className="bg-[#0F1717] rounded-xl p-4 border border-gray-700">
              <h3 className="text-lg font-semibold mb-3">Заметки</h3>
              <div className="flex flex-col gap-3">
                <select value={selectedTaskIdForNote} onChange={(e) => setSelectedTaskIdForNote(e.target.value)} className="bg-[#16251C] border border-gray-700 rounded px-3 py-2">
                  <option value="">Выберите задачу</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} className="bg-[#16251C] border border-gray-700 rounded px-3 py-2" placeholder="Напишите заметку..." />
                <button className="self-start bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">Сохранить (заглушка)</button>
              </div>
            </div>

            {/* Тайм-менеджмент на сегодня */}
            <div className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-3">Тайм-менеджмент на сегодня</h3>
              <div className="space-y-3">
                {scheduleItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <input
                      className="md:col-span-2 bg-[#16251C] border border-gray-700 rounded px-3 py-2"
                      placeholder="Время (например 09:30)"
                      value={item.time}
                      onChange={(e) => updateScheduleItem(idx, 'time', e.target.value)}
                    />
                    <input
                      className="md:col-span-9 bg-[#16251C] border border-gray-700 rounded px-3 py-2"
                      placeholder="Деятельность"
                      value={item.activity}
                      onChange={(e) => updateScheduleItem(idx, 'activity', e.target.value)}
                    />
                    <button onClick={() => removeScheduleItem(idx)} className="md:col-span-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded">Удалить</button>
                  </div>
                ))}
                <button onClick={addScheduleItem} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Добавить пункт</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


