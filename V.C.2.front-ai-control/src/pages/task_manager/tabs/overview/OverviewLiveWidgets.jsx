import React from 'react';
import TimePicker from '../../../../components/TimePicker';
import { CloseIcon, IconWithText, LightbulbIcon } from '../../components/TaskManagerIcons';
import TaskDetails from '../../components/TaskDetails';
import {
  ActionIcons,
  OverviewEmpty,
  OverviewWidget,
  ProjectListItem,
  TaskListItem,
  WidgetIcons,
} from './OverviewWidget';
import { formatDateTimeRu, getOverdueWidgetSubtitle, PRIORITY_RANGE_PRESETS, PROJECT_STATUS_CONFIG } from './overviewHelpers';
import ProjectTeamsModal from './ProjectTeamsModal';
import { OverviewAiAnalysisWidget } from './OverviewAiAnalysisWidget';
import { OverviewAiChatWidget } from './OverviewAiChatWidget';

export function OverviewPrioritiesWidget({ model }) {
  const {
    orgWideUser,
    priorityTasks,
    priorityRangePreset,
    priorityDateFrom,
    priorityDateTo,
    applyPriorityRangePreset,
    handlePriorityDateFromChange,
    handlePriorityDateToChange,
    handleOpenTask,
  } = model;

  return (
    <OverviewWidget
      cardId="priorities"
      accent="amber"
      icon={WidgetIcons.priorities}
      title="Мои приоритеты"
      subtitle={orgWideUser ? 'Задачи организации по дедлайну' : 'Ваши задачи по дедлайну'}
      count={priorityTasks.length || undefined}
    >
      <div className="ow-priority-filters">
        <div className="ow-priority-presets">
          {PRIORITY_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`ow-priority-preset ${priorityRangePreset === preset.id ? 'ow-priority-preset--active' : ''}`}
              onClick={() => applyPriorityRangePreset(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="ow-priority-range">
          <input
            type="date"
            className="ow-priority-range__input form-input text-sm"
            value={priorityDateFrom}
            onChange={(e) => handlePriorityDateFromChange(e.target.value)}
            aria-label="Дата начала периода"
          />
          <span className="ow-priority-range__sep">—</span>
          <input
            type="date"
            className="ow-priority-range__input form-input text-sm"
            value={priorityDateTo}
            onChange={(e) => handlePriorityDateToChange(e.target.value)}
            aria-label="Дата окончания периода"
          />
        </div>
      </div>

      {priorityTasks.length === 0 ? (
        <OverviewEmpty iconKey="priorities" text="Нет задач в выбранном периоде" />
      ) : (
        <ul className="ow-list ow-list--with-filters">
          {priorityTasks.map((t) => (
            <TaskListItem key={t.id} task={t} variant="priority" onClick={handleOpenTask} />
          ))}
        </ul>
      )}
    </OverviewWidget>
  );
}

export function OverviewOverdueWidget({ model }) {
  const { overdueTasks, handleOpenTask, user } = model;
  return (
    <OverviewWidget
      cardId="overdue"
      accent="red"
      icon={WidgetIcons.overdue}
      title="Просроченные задачи"
      subtitle={getOverdueWidgetSubtitle(user)}
      count={overdueTasks.length || undefined}
    >
      {overdueTasks.length === 0 ? (
        <OverviewEmpty iconKey="overdueClear" text="Просроченных задач нет" />
      ) : (
        <ul className="ow-list">
          {overdueTasks.map((t) => (
            <TaskListItem key={t.id} task={t} variant="overdue" onClick={handleOpenTask} />
          ))}
        </ul>
      )}
    </OverviewWidget>
  );
}

export function OverviewUpcomingWidget({ model }) {
  const { upcomingTasks, handleOpenTask } = model;
  return (
    <OverviewWidget
      cardId="upcoming"
      accent="blue"
      icon={WidgetIcons.upcoming}
      title="Предстоящие дедлайны"
      subtitle="Завтра и послезавтра"
      count={upcomingTasks.length || undefined}
    >
      {upcomingTasks.length === 0 ? (
        <OverviewEmpty iconKey="upcoming" text="Нет задач на завтра и послезавтра" />
      ) : (
        <ul className="ow-list">
          {upcomingTasks.map((t) => (
            <TaskListItem key={t.id} task={t} variant="upcoming" onClick={handleOpenTask} />
          ))}
        </ul>
      )}
    </OverviewWidget>
  );
}

export function OverviewProjectsWidget({ model, idPrefix = 'ow' }) {
  const {
    orgWideUser,
    visibleProjects,
    filteredProjects,
    projectStatusFilter,
    setProjectStatusFilter,
    handleOpenProject,
  } = model;

  return (
    <OverviewWidget
      cardId="projects"
      accent="purple"
      icon={WidgetIcons.projects}
      title="Статусы проектов"
      subtitle={orgWideUser ? 'Все проекты организации' : 'Ваши проекты и команды'}
      count={filteredProjects.length || undefined}
    >
      {visibleProjects.length > 0 && (
        <div className="ow-project-filters">
          <label className="ow-project-filters__label" htmlFor={`${idPrefix}-project-status-filter`}>
            Статус
          </label>
          <select
            id={`${idPrefix}-project-status-filter`}
            className="ow-project-filters__select form-input text-sm"
            value={projectStatusFilter}
            onChange={(e) => setProjectStatusFilter(e.target.value)}
          >
            <option value="all">Все статусы ({visibleProjects.length})</option>
            {Object.entries(PROJECT_STATUS_CONFIG).map(([status, cfg]) => {
              const count = visibleProjects.filter((p) => p.status === status).length;
              if (count === 0) return null;
              return (
                <option key={status} value={status}>
                  {cfg.label} ({count})
                </option>
              );
            })}
          </select>
        </div>
      )}

      {visibleProjects.length === 0 ? (
        <OverviewEmpty iconKey="projects" text="Нет доступных проектов" />
      ) : filteredProjects.length === 0 ? (
        <OverviewEmpty iconKey="projects" text="Нет проектов с выбранным статусом" />
      ) : (
        <ul className="ow-list ow-list--with-filters ow-project-grid">
          {filteredProjects.map((p) => (
            <ProjectListItem key={p.id} project={p} onClick={handleOpenProject} />
          ))}
        </ul>
      )}
    </OverviewWidget>
  );
}

export function OverviewNotesWidget({ model }) {
  const {
    tasks,
    selectedTaskIdForNote,
    setSelectedTaskIdForNote,
    noteText,
    setNoteText,
    currentNote,
    noteSaving,
    handleSaveNote,
    handleDeleteNote,
  } = model;

  return (
    <OverviewWidget
      cardId="notes"
      accent="green"
      icon={WidgetIcons.notes}
      title="Заметки"
      subtitle="Личные заметки к задачам"
    >
      <div className="ow-notes-form">
        <select
          value={selectedTaskIdForNote}
          onChange={(e) => setSelectedTaskIdForNote(e.target.value)}
          className="form-input"
          disabled={noteSaving}
        >
          <option value="">Выберите задачу</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>

        {selectedTaskIdForNote && (
          <>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              className="form-input"
              placeholder="Напишите заметку..."
              disabled={noteSaving}
            />

            <div className="ow-notes-actions">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={noteSaving || !noteText.trim()}
                className="btn btn-secondary btn-sm"
              >
                {noteSaving ? 'Сохранение...' : (currentNote ? 'Обновить' : 'Сохранить')}
              </button>

              {currentNote && (
                <button
                  type="button"
                  onClick={handleDeleteNote}
                  disabled={noteSaving}
                  className="btn btn-danger btn-sm"
                >
                  Удалить
                </button>
              )}
            </div>

            {currentNote && (
              <div className="ow-notes-meta">
                Последнее обновление: {formatDateTimeRu(currentNote.updated)}
              </div>
            )}
          </>
        )}
      </div>
    </OverviewWidget>
  );
}

export function OverviewChecklistWidget({ model }) {
  const {
    activeTasksCount,
    overviewDataLoading,
    newChecklistItem,
    setNewChecklistItem,
    handleChecklistKeyPress,
    addChecklistItem,
    checklistItems,
    removingItems,
    newlyAddedItems,
    toggleChecklistItem,
    removeChecklistItem,
  } = model;

  return (
    <OverviewWidget
      cardId="checklist"
      accent="emerald"
      icon={WidgetIcons.checklist}
      title="Чек-лист"
      subtitle="Быстрые задачи на день"
      count={activeTasksCount || undefined}
      className={activeTasksCount === 0 ? 'opacity-90' : ''}
    >
      <div className={`checklist-content flex flex-col gap-3 ${activeTasksCount === 0 ? 'empty' : 'filled'}`}>
        <div className="ow-checklist-input-row">
          <input
            type="text"
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
            onKeyPress={handleChecklistKeyPress}
            className="flex-1 form-input text-sm"
            placeholder="Добавить быструю задачу..."
            disabled={overviewDataLoading}
          />
          <button
            type="button"
            onClick={addChecklistItem}
            disabled={!newChecklistItem.trim() || overviewDataLoading}
            className="btn btn-secondary btn-sm whitespace-nowrap"
          >
            Добавить
          </button>
        </div>

        {overviewDataLoading ? (
          <OverviewEmpty iconKey="loading" text="Загрузка чек-листа..." />
        ) : activeTasksCount === 0 ? (
          <OverviewEmpty iconKey="checklist" text="Нет активных задач в чек-листе" />
        ) : (
          <div className="checklist-content__list space-y-2">
            {checklistItems
              .filter((item) => !item.completed || removingItems.has(item.id))
              .map((item) => {
                const isRemoving = removingItems.has(item.id);
                const isNewlyAdded = newlyAddedItems.has(item.id);

                return (
                  <div
                    key={item.id}
                    className={`ow-checklist-item ${isRemoving ? 'ow-checklist-item--removing' : ''} ${isNewlyAdded ? 'ow-checklist-item--new' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="w-4 h-4 accent-emerald-500 rounded"
                      disabled={isRemoving}
                    />
                    <span className="ow-checklist-item__text">{item.text}</span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id, true)}
                      className="ow-checklist-item__remove"
                      title="Удалить задачу"
                      disabled={isRemoving}
                    >
                      <CloseIcon size="sm" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        {activeTasksCount > 0 && (
          <div className="ow-hint">
            <IconWithText icon={LightbulbIcon} className="text-sm text-slate-400">
              Отметьте галочкой, чтобы задача исчезла
            </IconWithText>
          </div>
        )}
      </div>
    </OverviewWidget>
  );
}

export function OverviewScheduleWidget({ model }) {
  const {
    overviewDataLoading,
    scheduleItems,
    scheduleRemoving,
    scheduleAdding,
    updateScheduleItem,
    toggleScheduleComplete,
    removeScheduleItem,
    addScheduleItem,
  } = model;

  return (
    <OverviewWidget
      cardId="time-management"
      accent="cyan"
      icon={WidgetIcons.schedule}
      title="Тайм-менеджмент на сегодня"
      subtitle="Короткие слоты: время + действие"
    >
      {overviewDataLoading ? (
        <OverviewEmpty iconKey="loading" text="Загрузка расписания..." />
      ) : (
        <div className="ow-schedule-list">
          {scheduleItems.map((item, idx) => {
            const isRemoving = scheduleRemoving.has(idx);
            const isAdding = scheduleAdding.has(idx);
            const hasActivity = Boolean(item.activity?.trim());
            const isCompleted = Boolean(item.completed);

            return (
              <div
                key={idx}
                className={`ow-schedule-item ${isRemoving ? 'ow-schedule-item--removing' : ''} ${isAdding ? 'ow-schedule-item--adding' : ''} ${isCompleted ? 'ow-schedule-item--completed' : ''}`}
              >
                <div className={`ow-schedule-row ${hasActivity ? 'ow-schedule-row--with-check' : ''}`}>
                  <div className="ow-schedule-time">
                    <TimePicker
                      value={item.time}
                      onChange={(value) => updateScheduleItem(idx, 'time', value)}
                      disabled={isRemoving || isCompleted}
                      placeholder="09:30"
                    />
                  </div>
                  <input
                    type="text"
                    className="ow-schedule-activity form-input text-sm"
                    placeholder="Деятельность"
                    value={item.activity}
                    onChange={(e) => updateScheduleItem(idx, 'activity', e.target.value)}
                    disabled={isRemoving || isCompleted}
                  />
                  {hasActivity && (
                    <label
                      className="ow-schedule-check"
                      title={isCompleted ? 'Снять отметку' : 'Отметить выполненным'}
                    >
                      <input
                        type="checkbox"
                        checked={isCompleted}
                        onChange={() => toggleScheduleComplete(idx)}
                        disabled={isRemoving}
                        aria-label="Отметить пункт выполненным"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => removeScheduleItem(idx)}
                    className="ow-schedule-remove-btn"
                    disabled={isRemoving}
                    title="Удалить пункт"
                    aria-label="Удалить пункт"
                  >
                    {ActionIcons.trash}
                  </button>
                </div>
              </div>
            );
          })}

          <div className="ow-schedule-add">
            <button
              type="button"
              onClick={addScheduleItem}
              className="ow-schedule-add-btn"
            >
              <span className="ow-schedule-add-btn__icon">{ActionIcons.plus}</span>
              <span>Добавить пункт</span>
            </button>
          </div>
        </div>
      )}
    </OverviewWidget>
  );
}

const OVERVIEW_WIDGETS = {
  priorities: OverviewPrioritiesWidget,
  overdue: OverviewOverdueWidget,
  upcoming: OverviewUpcomingWidget,
  projects: OverviewProjectsWidget,
  notes: OverviewNotesWidget,
  checklist: OverviewChecklistWidget,
  'time-management': OverviewScheduleWidget,
  'ai-analysis': OverviewAiAnalysisWidget,
  'ai-chat': OverviewAiChatWidget,
};

export function renderOverviewLiveWidget(cardId, model, extraProps = {}) {
  const Widget = OVERVIEW_WIDGETS[cardId];
  if (!Widget) return null;
  return <Widget model={model} cardId={cardId} {...extraProps} />;
}

export function OverviewWidgetModals({ model }) {
  const {
    selectedProject,
    selectedTask,
    tasks,
    user,
    handleCloseProject,
    handleOpenTaskFromProject,
    handleCloseTask,
    handleTaskUpdate,
  } = model;

  return (
    <>
      {selectedProject && (
        <ProjectTeamsModal
          project={selectedProject}
          tasks={tasks}
          onClose={handleCloseProject}
          onTaskClick={handleOpenTaskFromProject}
        />
      )}
      {selectedTask && (
        <TaskDetails
          task={selectedTask}
          onClose={handleCloseTask}
          onTaskUpdate={handleTaskUpdate}
          currentUser={user}
        />
      )}
    </>
  );
}
