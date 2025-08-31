import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeaderTabs from '../taskManager/components/HeaderTabs';
import { getTasks } from '../../services/taskService';
import { projectService } from '../../services/projectService';
import { getCurrentUserNoteForTask, createOrUpdateUserNote, deleteUserNote } from '../../services/notesService';
import TimePicker from '../../components/TimePicker';
import DraggableGrid from '../../components/DraggableGrid';

export default function OverviewPage({ user }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);

  // Добавляем стили для анимации один раз
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInFromLeft {
        0% {
          opacity: 0;
          transform: translateX(-15px) scale(0.95);
        }
        60% {
          opacity: 0.9;
          transform: translateX(-2px) scale(0.99);
        }
        100% {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }
      
      .checklist-content {
        transition: max-height 0.4s ease-out;
        overflow: hidden;
        width: 100%;
      }
      
      .overview-block {
        min-height: 250px;
        max-height: 400px;
        display: flex;
        flex-direction: column;
        width: 100%;
      }
      
      .overview-block .block-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
      }
      
      .checklist-content.empty {
        max-height: 120px;
      }
      
      .checklist-content.filled {
        max-height: 350px;
      }
      
      .schedule-item {
        transition: all 0.4s ease-out;
        transform-origin: top center;
      }
      
      .schedule-item.removing {
        opacity: 0;
        transform: scale(0.95) translateX(10px);
        max-height: 0;
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      
      .schedule-item.adding {
        animation: scheduleSlideIn 0.5s ease-out;
      }
      
      @keyframes scheduleSlideIn {
        0% {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
          max-height: 0;
        }
        50% {
          opacity: 0.7;
          transform: scale(0.98) translateY(-2px);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0);
          max-height: 100px;
        }
      }
    `;
    
    if (!document.head.querySelector('#checklist-animations')) {
      style.id = 'checklist-animations';
      document.head.appendChild(style);
    }

    return () => {
      const existingStyle = document.head.querySelector('#checklist-animations');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);

  const [selectedTaskIdForNote, setSelectedTaskIdForNote] = useState('');
  const [noteText, setNoteText] = useState('');
  const [currentNote, setCurrentNote] = useState(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [scheduleItems, setScheduleItems] = useState([{ time: '', activity: '' }]);
  
  // Состояние для чек-листа
  const [checklistItems, setChecklistItems] = useState([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [removingItems, setRemovingItems] = useState(new Set()); // ID задач в процессе удаления
  const [newlyAddedItems, setNewlyAddedItems] = useState(new Set()); // ID недавно добавленных задач для анимации появления

  // Состояние для анимаций тайм-менеджмента
  const [scheduleRemoving, setScheduleRemoving] = useState(new Set()); // Индексы удаляемых элементов
  const [scheduleAdding, setScheduleAdding] = useState(new Set()); // Индексы новых элементов

  // Вычисляем количество активных задач для анимации блока
  const activeTasksCount = useMemo(() => {
    return checklistItems.filter(item => !item.completed).length;
  }, [checklistItems]);

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

  // Загружаем чек-лист при изменении пользователя
  useEffect(() => {
    loadChecklist();
  }, [user]);

  // Загружаем тайм-менеджмент при изменении пользователя
  useEffect(() => {
    loadSchedule();
  }, [user]);

  // Функции для работы с чек-листом
  const loadChecklist = () => {
    if (!user) return;
    const storageKey = `checklist_${user.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const items = JSON.parse(stored);
        setChecklistItems(items);
      } catch (error) {
        console.error('Error loading checklist:', error);
      }
    }
  };

  const saveChecklist = (items) => {
    if (!user) return;
    const storageKey = `checklist_${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(items));
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    
    const newItem = {
      id: Date.now(),
      text: newChecklistItem.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    const updatedItems = [...checklistItems, newItem];
    setChecklistItems(updatedItems);
    saveChecklist(updatedItems);
    setNewChecklistItem('');
    
    // Добавляем в список новых элементов для анимации появления
    setNewlyAddedItems(prev => new Set([...prev, newItem.id]));
    
    // Убираем из списка новых элементов через время для завершения анимации
    setTimeout(() => {
      setNewlyAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(newItem.id);
        return newSet;
      });
    }, 300);
  };

  const toggleChecklistItem = (itemId) => {
    const updatedItems = checklistItems.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    
    const completedItem = updatedItems.find(item => item.id === itemId);
    if (completedItem && completedItem.completed) {
      // Добавляем ID в состояние удаляемых элементов для анимации
      setRemovingItems(prev => new Set([...prev, itemId]));
      
      // Удаляем через время достаточное для проигрывания анимации
      setTimeout(() => {
        removeChecklistItem(itemId);
      }, 500); // Ускоренная анимация затухания
    } else {
      // Если задача снова стала невыполненной, убираем её из удаляемых
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
    
    setChecklistItems(updatedItems);
    saveChecklist(updatedItems);
  };

  const removeChecklistItem = (itemId, withAnimation = false) => {
    if (withAnimation) {
      // Для ручного удаления через кнопку ✕ - добавляем анимацию
      setRemovingItems(prev => new Set([...prev, itemId]));
      
      // Удаляем после анимации
      setTimeout(() => {
        const updatedItems = checklistItems.filter(item => item.id !== itemId);
        setChecklistItems(updatedItems);
        saveChecklist(updatedItems);
        
        // Убираем ID из состояния удаляемых элементов
        setRemovingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 450);
    } else {
      // Для автоматического удаления после отметки галочкой
      const updatedItems = checklistItems.filter(item => item.id !== itemId);
      setChecklistItems(updatedItems);
      saveChecklist(updatedItems);
      
      // Убираем ID из состояния удаляемых элементов
      setRemovingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleChecklistKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem();
    }
  };

  // Функции для работы с тайм-менеджментом и localStorage
  const loadSchedule = () => {
    if (!user) return;
    const storageKey = `schedule_${user.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const items = JSON.parse(stored);
        setScheduleItems(items.length > 0 ? items : [{ time: '', activity: '' }]);
      } catch (error) {
        console.error('Error loading schedule:', error);
        setScheduleItems([{ time: '', activity: '' }]);
      }
    } else {
      setScheduleItems([{ time: '', activity: '' }]);
    }
  };

  const saveSchedule = (items) => {
    if (!user) return;
    const storageKey = `schedule_${user.id}`;
    localStorage.setItem(storageKey, JSON.stringify(items));
  };

  // Загружаем заметку при выборе задачи
  useEffect(() => {
    const loadNote = async () => {
      if (!selectedTaskIdForNote || !user) {
        setNoteText('');
        setCurrentNote(null);
        return;
      }

      try {
        const note = await getCurrentUserNoteForTask(parseInt(selectedTaskIdForNote), user);
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
    // Показываем проекты, которые создал пользователь (где он является менеджером) 
    // И проекты, где он является участником команды
    return (projects || []).filter(p => {
      const isManager = p.manager_id === user.id || p.manager_username === user.username;
      const isMember = (p.teams || []).some(team => 
        (team.members || []).some(member => 
          member.user_id === user.id && member.is_active
        )
      );
      return isManager || isMember;
    });
  }, [projects, user]);

  // Функции тайм-менеджмента с анимациями и сохранением
  const addScheduleItem = () => {
    const newIndex = scheduleItems.length;
    const newItems = [...scheduleItems, { time: '', activity: '' }];
    setScheduleItems(newItems);
    saveSchedule(newItems);
    
    // Добавляем анимацию появления
    setScheduleAdding(prev => new Set([...prev, newIndex]));
    
    // Убираем анимацию через время
    setTimeout(() => {
      setScheduleAdding(prev => {
        const newSet = new Set(prev);
        newSet.delete(newIndex);
        return newSet;
      });
    }, 500);
  };

  const formatTimeInput = (value) => {
    // Убираем все кроме цифр
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length === 0) return '';
    
    // Валидация первой цифры часов (не больше 2)
    if (numbers.length >= 1) {
      const firstDigit = parseInt(numbers[0]);
      if (firstDigit > 2) {
        return '';
      }
    }
    
    // Валидация часов полностью
    if (numbers.length >= 2) {
      const hours = parseInt(numbers.slice(0, 2));
      if (hours > 23) {
        // Если часы больше 23, корректируем
        return '23';
      }
    }
    
    // Валидация минут
    if (numbers.length >= 3) {
      const hours = numbers.slice(0, 2);
      const firstMinuteDigit = parseInt(numbers[2]);
      
      // Первая цифра минут не должна быть больше 5
      if (firstMinuteDigit > 5) {
        return hours + ':00';
      }
      
      if (numbers.length >= 4) {
        const minutes = parseInt(numbers.slice(2, 4));
        if (minutes > 59) {
          return hours + ':59';
        }
        return hours + ':' + numbers.slice(2, 4);
      } else {
        return hours + ':' + numbers[2];
      }
    }
    
    // Форматируем как HH или H
    return numbers;
  };

  const updateScheduleItem = (idx, key, value) => {
    // TimePicker уже выполняет валидацию времени, поэтому просто используем переданное значение
    const newItems = scheduleItems.map((it, i) => i === idx ? { ...it, [key]: value } : it);
    setScheduleItems(newItems);
    saveSchedule(newItems);
  };

  const removeScheduleItem = (idx) => {
    // Не позволяем удалить последний элемент
    if (scheduleItems.length === 1) {
      const newItems = [{ time: '', activity: '' }];
      setScheduleItems(newItems);
      saveSchedule(newItems);
      return;
    }

    // Добавляем анимацию удаления
    setScheduleRemoving(prev => new Set([...prev, idx]));
    
    // Удаляем элемент после анимации
    setTimeout(() => {
      const newItems = scheduleItems.filter((_, i) => i !== idx);
      setScheduleItems(newItems);
      saveSchedule(newItems);
      
      // Очищаем состояние анимации
      setScheduleRemoving(prev => {
        const newSet = new Set(prev);
        newSet.delete(idx);
        return newSet;
      });
    }, 400);
  };

  // Функции для работы с заметками
  const handleSaveNote = async () => {
    if (!selectedTaskIdForNote || !noteText.trim()) {
      return;
    }

    try {
      setNoteSaving(true);
      const savedNote = await createOrUpdateUserNote(parseInt(selectedTaskIdForNote), noteText.trim());
      setCurrentNote(savedNote);
      console.log('Note saved successfully');
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Ошибка при сохранении заметки');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedTaskIdForNote || !currentNote) {
      return;
    }

    if (!window.confirm('Вы уверены, что хотите удалить заметку?')) {
      return;
    }

    try {
      setNoteSaving(true);
      await deleteUserNote(parseInt(selectedTaskIdForNote));
      setNoteText('');
      setCurrentNote(null);
      console.log('Note deleted successfully');
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Ошибка при удалении заметки');
    } finally {
      setNoteSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0D1414] to-[#16251C] p-6 text-sm text-gray-100">
      <div className="bg-gradient-to-b from-[#0D1414] to-[#16251C] rounded-xl shadow-md p-6">
        <HeaderTabs />
        <div className="mt-6">
          <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-100">Обзор</h1>
            <div className="text-sm text-gray-400 hidden md:flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
              Перетаскивайте за троеточие
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-400">Загрузка...</div>
        ) : (
          <DraggableGrid user={user} enableDragAndDrop={true}>
            {/* Мои приоритеты на сегодня */}
            <div data-card-id="priorities" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 overview-block">
              <h3 className="text-lg font-semibold mb-3">Мои приоритеты на сегодня</h3>
              <div className="block-content">
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
            </div>

            {/* Просроченные задачи */}
            <div data-card-id="overdue" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 overview-block">
              <h3 className="text-lg font-semibold mb-3">Просроченные задачи</h3>
              <div className="block-content">
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
            </div>

            {/* Предстоящие дедлайны */}
            <div data-card-id="upcoming" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 overview-block">
              <h3 className="text-lg font-semibold mb-3">Предстоящие дедлайны</h3>
              <div className="block-content">
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
            </div>

            {/* Статусы проектов */}
            <div data-card-id="projects" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 overview-block">
              <h3 className="text-lg font-semibold mb-3">Статусы проектов</h3>
              <div className="block-content">
              {userProjects.length === 0 ? (
                  <div className="text-gray-400">Нет доступных проектов</div>
              ) : (
                <ul className="space-y-2">
                  {userProjects.map(p => (
                    <li key={p.id} className="p-3 rounded bg-[#16251C]">
                      <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-400">
                          Статус: {p.status === 'planning' ? 'Планирование' : 
                                  p.status === 'active' ? 'Активный' :
                                  p.status === 'on_hold' ? 'На паузе' :
                                  p.status === 'completed' ? 'Завершен' :
                                  p.status === 'cancelled' ? 'Отменен' :
                                  p.status === 'archived' ? 'Архивирован' : p.status} • Команд: {(p.teams || []).length}
                        </div>
                    </li>
                  ))}
                </ul>
              )}
              </div>
            </div>

            {/* Заметки к задачам */}
            <div data-card-id="notes" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 overview-block">
              <h3 className="text-lg font-semibold mb-3">Заметки</h3>
              <div className="block-content flex flex-col gap-3">
                <select 
                  value={selectedTaskIdForNote} 
                  onChange={(e) => setSelectedTaskIdForNote(e.target.value)} 
                  className="bg-[#16251C] border border-gray-700 rounded px-3 py-2"
                  disabled={noteSaving}
                >
                  <option value="">Выберите задачу</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                
                {selectedTaskIdForNote && (
                  <>
                    <textarea 
                      value={noteText} 
                      onChange={(e) => setNoteText(e.target.value)} 
                      rows={4} 
                      className="bg-[#16251C] border border-gray-700 rounded px-3 py-2" 
                      placeholder="Напишите заметку..."
                      disabled={noteSaving}
                    />
                    
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveNote}
                        disabled={noteSaving || !noteText.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded text-sm"
                      >
                        {noteSaving ? 'Сохранение...' : (currentNote ? 'Обновить' : 'Сохранить')}
                      </button>
                      
                      {currentNote && (
                        <button 
                          onClick={handleDeleteNote}
                          disabled={noteSaving}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded text-sm"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    
                    {currentNote && (
                      <div className="text-xs text-gray-400">
                        Последнее обновление: {new Date(currentNote.updated_at).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Чек-лист */}
            <div data-card-id="checklist" className={`bg-[#0F1717] rounded-xl p-4 border border-gray-700 overview-block transition-opacity duration-400 ease-out ${
              activeTasksCount === 0 ? 'opacity-90' : 'opacity-100'
            }`}>
              <h3 className="text-lg font-semibold mb-3">Чек-лист</h3>
              <div className={`block-content flex flex-col gap-3 checklist-content ${
                activeTasksCount === 0 ? 'empty' : 'filled'
              }`}>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={handleChecklistKeyPress}
                    className="flex-1 bg-[#16251C] border border-gray-700 rounded px-3 py-2 text-sm"
                    placeholder="Добавить быструю задачу..."
                  />
                  <button 
                    onClick={addChecklistItem}
                    disabled={!newChecklistItem.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded text-sm whitespace-nowrap transition-colors"
                  >
                    Добавить
                  </button>
                </div>
                
                {activeTasksCount === 0 ? (
                  <div className="text-gray-400 text-sm italic transition-all duration-300 text-center">
                    Нет активных задач в чек-листе
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {checklistItems
                      .filter(item => !item.completed || removingItems.has(item.id))
                      .map(item => {
                        const isRemoving = removingItems.has(item.id);
                        const isCompleted = item.completed;
                        const isNewlyAdded = newlyAddedItems.has(item.id);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`flex items-center gap-3 p-3 bg-[#16251C] rounded border border-gray-700 transition-all duration-500 ease-out transform ${
                              isRemoving 
                                ? 'opacity-0 scale-95 translate-x-4 pointer-events-none' 
                                : isNewlyAdded
                                  ? 'opacity-100 scale-100 translate-x-0 animate-pulse border-green-500 shadow-lg'
                                  : isCompleted 
                                    ? 'opacity-60 line-through' 
                                    : 'opacity-100 hover:border-green-500 hover:shadow-sm'
                            }`}
                            style={{
                              transformOrigin: 'left center',
                              animation: isNewlyAdded ? 'slideInFromLeft 0.3s ease-out' : undefined
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => toggleChecklistItem(item.id)}
                              className="w-4 h-4 accent-green-600 rounded transition-all duration-200"
                              disabled={isRemoving}
                            />
                            <span className={`flex-1 text-sm transition-all duration-300 ${
                              isCompleted ? 'text-gray-500' : 'text-gray-200'
                            }`}>
                              {item.text}
                            </span>
                            <button 
                              onClick={() => removeChecklistItem(item.id, true)}
                              className="text-gray-400 hover:text-red-400 transition-colors opacity-80 hover:opacity-100"
                              title="Удалить задачу"
                              disabled={isRemoving}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
                
                {activeTasksCount > 0 && (
                  <div className="text-xs text-gray-500 text-center transition-opacity duration-300">
                    💡 Отметьте галочкой, чтобы задача исчезла
                  </div>
                )}
              </div>
            </div>

            {/* Тайм-менеджмент на сегодня */}
            <div data-card-id="time-management" className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 overview-block">
              <h3 className="text-lg font-semibold mb-3">Тайм-менеджмент на сегодня</h3>
              <div className="block-content space-y-3">
                {scheduleItems.map((item, idx) => {
                  const isRemoving = scheduleRemoving.has(idx);
                  const isAdding = scheduleAdding.has(idx);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`schedule-item ${isRemoving ? 'removing' : isAdding ? 'adding' : ''}`}
                    >
                      {/* Мобильная версия - вертикальная */}
                      <div className="flex flex-col gap-2 md:hidden">
                        <div className="flex gap-2">
                          <div className="w-32">
                            <TimePicker
                              value={item.time}
                              onChange={(value) => updateScheduleItem(idx, 'time', value)}
                              disabled={isRemoving}
                              placeholder="09:30"
                            />
                          </div>
                          <button 
                            onClick={() => removeScheduleItem(idx)} 
                            className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors flex items-center justify-center"
                            disabled={isRemoving}
                            title="Удалить пункт"
                          >
                            🗑️
                          </button>
                        </div>
                    <input
                          type="text"
                          className="w-full bg-[#16251C] border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400"
                          placeholder="Деятельность"
                          value={item.activity}
                          onChange={(e) => updateScheduleItem(idx, 'activity', e.target.value)}
                          disabled={isRemoving}
                        />
                      </div>

                      {/* Десктопная версия - горизонтальная */}
                      <div className="hidden md:flex md:items-center md:gap-3">
                        <div className="w-36">
                          <TimePicker
                      value={item.time}
                            onChange={(value) => updateScheduleItem(idx, 'time', value)}
                            disabled={isRemoving}
                            placeholder="09:30"
                    />
                        </div>
                    <input
                          type="text"
                          className="flex-1 bg-[#16251C] border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="Деятельность"
                      value={item.activity}
                      onChange={(e) => updateScheduleItem(idx, 'activity', e.target.value)}
                          disabled={isRemoving}
                        />
                        <button 
                          onClick={() => removeScheduleItem(idx)} 
                          className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors flex items-center justify-center w-10 h-10"
                          disabled={isRemoving}
                          title="Удалить пункт"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {/* Кнопка добавления */}
                <div className="pt-2 border-t border-gray-700">
                  <button 
                    onClick={addScheduleItem} 
                    className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded text-white transition-colors flex items-center justify-center gap-2 font-medium"
                    title="Добавить новый пункт"
                  >
                    <span className="text-lg">+</span>
                    <span>Добавить пункт</span>
                  </button>
                  </div>
              </div>
            </div>
          </DraggableGrid>
        )}
      </div>
    </div>
  );
}


