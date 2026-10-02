import React, { useMemo, useState, useRef, useEffect } from 'react';
import { updateTask } from '../../../services/taskService';
import TaskDetails from './TaskDetails';
import { canDeleteTask, canDragTask, canDragTaskToStatus } from '../utils/taskPermissions';
import { IconWithText, MyTasksIcon, SearchInput } from './TaskManagerIcons';

const priorityOrder = { urgent: 1, critical: 2, high: 3, medium: 4, low: 5 };

const statusRu = {
  created: 'Создана',
  in_progress: 'В работе',
  review: 'На проверке',
  completed: 'Завершена',
  cancelled: 'Отменена',
  on_hold: 'На паузе',
  blocked: 'Заблокирована'
};

const priorityRu = {
  urgent: 'Срочно',
  critical: 'Критично',
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий'
};

const typeRu = {
  task: 'Задача',
  bug: 'Ошибка',
  feature: 'Функция',
  story: 'История',
  epic: 'Эпик',
  subtask: 'Подзадача'
};

function TaskCard({ task, currentUser, onTaskUpdate, onCardClick, onDragStart, onDragEnd, draggedTaskId, draggable }) {
  const cardRef = useRef(null);
  const isDragging = draggedTaskId === task.id;

  const handleMouseDown = (e) => {
    if (!draggable) return;
    // Начинаем drag только если зажата левая кнопка мыши
    if (e.button !== 0) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    const handleMouseMove = (moveEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);
      
      // Если переместились больше чем на 5px, начинаем drag
      if ((deltaX > 5 || deltaY > 5) && !hasMoved) {
        hasMoved = true;
                if (onDragStart) {
          onDragStart(task);
        }
      }
    };

    // НЕ добавляем обработчик mouseup здесь - он будет обработан в KanbanBoard
    // Только отслеживаем движение для начала drag
    document.addEventListener('mousemove', handleMouseMove);
    
    // Удаляем обработчик движения при отпускании мыши (но не обрабатываем drop здесь)
    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', cleanup);
    };
    document.addEventListener('mouseup', cleanup);
  };

  const handleClick = (e) => {
    if (!isDragging) {
      onCardClick(task);
    }
  };

  return (
    <div 
      ref={cardRef}
      onMouseDown={handleMouseDown}
      className={`bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 text-sm text-slate-100 ${draggable ? 'cursor-move' : 'cursor-pointer'} hover:bg-slate-700/50 transition-all duration-200 select-none ${isDragging ? 'opacity-0 pointer-events-none scale-95' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-snug break-words">{task.title}</div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
          task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
          task.priority === 'critical' ? 'bg-orange-100 text-orange-800' :
          task.priority === 'high' ? 'bg-yellow-100 text-yellow-800' :
          task.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-800'
        }`}>{priorityRu[task.priority] || task.priority}</span>
      </div>
      <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-slate-700/50 border border-slate-600/50">{statusRu[task.status] || task.status}</span>
        {task.task_type && (
          <span className="px-2 py-0.5 rounded bg-slate-700/50 border border-slate-600/50">{typeRu[task.task_type] || task.task_type}</span>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
        <span>Исполнитель: {task.executor_name || 'Не назначен'}</span>
        <span>Срок: {task.due_date ? new Date(task.due_date).toLocaleDateString('ru-RU') : '—'}</span>
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks = [], currentUser, onTaskUpdate, onDeleteTask }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [ghostElement, setGhostElement] = useState(null);
  const [search, setSearch] = useState('');
  const [myTasksFilter, setMyTasksFilter] = useState(false);
  const dragOverColumnRef = useRef(null);
  
  // Синхронизируем ref с state
  useEffect(() => {
    dragOverColumnRef.current = dragOverColumn;
  }, [dragOverColumn]);

  const columnStatusMap = {
    problem: ['on_hold', 'blocked'],
    inWork: ['in_progress', 'created'],
    review: ['review'],
    done: ['completed', 'cancelled']
  };

  const getStatusForColumn = (columnKey) => {
    const statusMap = {
      problem: 'blocked',
      inWork: 'in_progress',
      review: 'review',
      done: 'completed'
    };
    return statusMap[columnKey];
  };

  const filteredTasks = useMemo(() => {
    let list = tasks;

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      list = list.filter((task) =>
        (task.title || '').toLowerCase().includes(query)
        || (task.executor_name || '').toLowerCase().includes(query),
      );
    }

    if (myTasksFilter && currentUser) {
      list = list.filter((task) => task.executor_id === currentUser.id);
    }

    return list;
  }, [tasks, search, myTasksFilter, currentUser]);

  const columns = useMemo(() => {
    const byPriority = (a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);

    const problem = [];
    const inWork = [];
    const review = [];
    const done = [];

    for (const t of filteredTasks) {
      if (t.status === 'on_hold' || t.status === 'blocked') {
        problem.push(t);
        continue;
      }
      if (t.status === 'in_progress' || t.status === 'created') {
        inWork.push(t);
        continue;
      }
      if (t.status === 'review') {
        review.push(t);
        continue;
      }
      if (t.status === 'completed' || t.status === 'cancelled') {
        done.push(t);
        continue;
      }
    }

    problem.sort(byPriority);
    inWork.sort(byPriority);
    review.sort(byPriority);
    done.sort(byPriority);

    return { problem, inWork, review, done };
  }, [filteredTasks]);

  // Обработка перемещения мыши для drag-and-drop
  useEffect(() => {
    if (!draggedTask) {
      if (ghostElement) {
        document.body.removeChild(ghostElement);
        setGhostElement(null);
      }
      return;
    }

    const handleMouseMove = (e) => {
      if (ghostElement) {
        ghostElement.style.left = e.clientX - 100 + 'px';
        ghostElement.style.top = e.clientY - 50 + 'px';
      }

      // Определяем, над какой колонкой находится курсор
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let foundColumn = null;
      
      for (const el of elements) {
        const columnKey = el.getAttribute('data-column-key');
        if (columnKey) {
          foundColumn = columnKey;
          break;
        }
      }
      
      if (foundColumn && foundColumn !== dragOverColumn) {
                setDragOverColumn(foundColumn);
      }
    };

    const handleMouseUp = async (e) => {
            
      // Временно скрываем призрак, чтобы он не мешал определению колонки
      if (ghostElement) {
        ghostElement.style.display = 'none';
      }
      
      // Определяем, над какой колонкой был отпущен курсор
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
            
      let targetColumn = null;
      
      // Ищем колонку в элементах (проверяем все элементы, не только первый)
      for (const el of elements) {
        const columnKey = el.getAttribute('data-column-key');
        if (columnKey) {
          targetColumn = columnKey;
                    break;
        }
        
        // Также проверяем родительские элементы
        let parent = el.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
          const parentColumnKey = parent.getAttribute('data-column-key');
          if (parentColumnKey) {
            targetColumn = parentColumnKey;
                        break;
          }
          parent = parent.parentElement;
          depth++;
        }
        if (targetColumn) break;
      }

      // Если не нашли через elementsFromPoint, используем dragOverColumn из ref
      if (!targetColumn) {
        const currentDragOver = dragOverColumnRef.current;
        if (currentDragOver) {
          targetColumn = currentDragOver;
                  }
      }

                  
      // Восстанавливаем призрак для удаления
      if (ghostElement) {
        ghostElement.style.display = '';
      }

      if (targetColumn && draggedTask) {
        const newStatus = getStatusForColumn(targetColumn);
        const currentStatuses = columnStatusMap[targetColumn] || [];
        
                                
        if (!currentStatuses.includes(draggedTask.status)) {
          if (!canDragTaskToStatus(draggedTask, currentUser, newStatus)) {
                        alert('Недостаточно прав для изменения статуса задачи таким способом');
          } else {
                                                  
          try {
            const result = await updateTask(draggedTask.id, { status: newStatus });
                                                
            // Ждем немного перед обновлением, чтобы дать серверу время обработать
            await new Promise(resolve => setTimeout(resolve, 200));
            
            if (onTaskUpdate) {
                            await onTaskUpdate();
                          } else {
                          }
          } catch (error) {
            console.error('❌ Error updating task:', error);
            console.error('  Error response:', error.response);
            console.error('  Error data:', error.response?.data);
            alert('Ошибка при обновлении статуса задачи: ' + (error.response?.data?.detail || error.message || 'Неизвестная ошибка'));
          }
          }
        } else {
                                      }
      } else {
                if (!targetColumn) {
                  }
        if (!draggedTask) {
                  }
      }

      // Очистка
      setDraggedTask(null);
      setDragOverColumn(null);
      if (ghostElement) {
        document.body.removeChild(ghostElement);
        setGhostElement(null);
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedTask, ghostElement, dragOverColumn, onTaskUpdate]);

  const handleCardClick = (task) => {
    setSelectedTask(task);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
  };

  const handleDragStart = (task) => {
    if (!canDragTask(task, currentUser)) {
            return;
    }
        setDraggedTask(task);
    
    // Создаем призрак
    const ghost = document.createElement('div');
    ghost.innerHTML = `
      <div style="
        background: rgba(30, 41, 59, 0.95);
        border: 2px solid rgba(59, 130, 246, 0.5);
        border-radius: 8px;
        padding: 12px;
        color: rgb(241, 245, 249);
        font-size: 14px;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
        transform: rotate(2deg) scale(1.05);
        pointer-events: none;
        z-index: 10000;
        min-width: 200px;
      ">
        <div style="font-weight: 500; margin-bottom: 8px;">${task.title}</div>
        <div style="font-size: 10px; color: rgb(148, 163, 184);">${statusRu[task.status] || task.status}</div>
      </div>
    `;
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '10000';
    document.body.appendChild(ghost);
    setGhostElement(ghost);
  };

  const handleDragEnd = () => {
        setDraggedTask(null);
    setDragOverColumn(null);
  };

  const getColumnStyles = (columnKey, color) => {
    const baseStyles = 'card';
    const ringColors = {
      red: 'ring-red-400',
      blue: 'ring-blue-400',
      yellow: 'ring-yellow-400',
      slate: 'ring-slate-400'
    };
    const textColors = {
      red: 'text-red-300',
      blue: 'text-blue-300',
      yellow: 'text-yellow-300',
      slate: 'text-slate-300'
    };
    
    const isDragOver = dragOverColumn === columnKey;
    return {
      container: `${baseStyles} ${isDragOver ? `ring-2 ${ringColors[color]} bg-slate-800/60` : ''}`,
      title: `text-sm font-semibold ${textColors[color]} mb-2`
    };
  };

  const Column = ({ columnKey, title, color, tasks: columnTasks }) => {
    const styles = getColumnStyles(columnKey, color);
    return (
      <div 
        data-column-key={columnKey}
        className={styles.container}
      >
        <h3 className={styles.title}>{title}</h3>
        <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
          {columnTasks.length === 0 ? (
            <div className="text-xs text-slate-500">Нет задач</div>
          ) : (
            columnTasks.map(t => (
              <TaskCard 
                key={t.id} 
                task={t} 
                currentUser={currentUser}
                onTaskUpdate={onTaskUpdate}
                onCardClick={handleCardClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                draggedTaskId={draggedTask?.id}
                draggable={canDragTask(t, currentUser)}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск задач..."
          className="flex-grow md:max-w-sm"
        />

        {currentUser && (
          <label className="flex items-center space-x-2 px-3 py-2 bg-slate-800/60 backdrop-blur-sm rounded-md border border-slate-600 hover:border-slate-500 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={myTasksFilter}
              onChange={(e) => setMyTasksFilter(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <IconWithText icon={MyTasksIcon} className="text-sm text-slate-300 whitespace-nowrap">
              Мои задачи
            </IconWithText>
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Column columnKey="problem" title="С проблемой" color="red" tasks={columns.problem} />
        <Column columnKey="inWork" title="В работе" color="blue" tasks={columns.inWork} />
        <Column columnKey="review" title="На проверке" color="yellow" tasks={columns.review} />
        <Column columnKey="done" title="Готово" color="slate" tasks={columns.done} />
      </div>

      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          currentUser={currentUser}
          onClose={handleCloseModal}
          onTaskUpdate={onTaskUpdate}
          onDelete={onDeleteTask && canDeleteTask(selectedTask, currentUser) ? onDeleteTask : undefined}
        />
      )}
    </>
  );
}
