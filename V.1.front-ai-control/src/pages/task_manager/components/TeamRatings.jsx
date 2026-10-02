import React, { useEffect, useMemo, useState } from 'react';
import { employeeService } from '../../../services/employeeService';
import { projectService } from '../../../services/projectService';
import { teamService } from '../../../services/teamService';
import {
  TaskStatsWidget,
  TaskStatsWidgetBody,
  TaskStatsWidgetHeader,
  TaskStatsWidgetListScroll,
  TaskStatsWidgetScroll,
} from './TaskStatsWidget';
import {
  calcPerformanceStats,
  dedupeTasksById,
  filterTasksForDepartment,
  filterTasksForTeam,
  getEfficiencyBg,
  getEfficiencyColor,
  getEmployeeDueTasks,
  getInitials,
  getTaskAssigneeId,
  canSwitchPerformanceSegment,
  isExecutivePerformanceUser,
  isTeamManager,
  resolvePerformanceViewMode,
} from '../utils/performanceUtils';

function PerformanceCard({ title, subtitle, stats, index = 0, onClick, clickable = false, selected = false }) {
  const { total, completed, efficiency } = stats;

  return (
    <div
      className={`group p-4 rounded-xl backdrop-blur-sm border 
                 transition-all duration-300 hover:bg-slate-700/40 hover:border-slate-600/50 
                 ${selected
                   ? 'bg-cyan-500/15 border-cyan-400/50 ring-1 ring-cyan-400/30'
                   : 'bg-slate-800/30 border-slate-700/50'}
                 ${clickable ? 'cursor-pointer hover:transform hover:scale-[1.02]' : ''}`}
      style={{ animationDelay: `${index * 0.1}s` }}
      onClick={onClick}
      onKeyDown={clickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-600 to-slate-700 
                          flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {getInitials(title)}
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-slate-200 block truncate">{title}</span>
            {subtitle && <span className="text-xs text-slate-500 block truncate">{subtitle}</span>}
          </div>
        </div>
        <span className={`text-sm font-bold shrink-0 ${getEfficiencyColor(efficiency)}`}>
          {efficiency}%
        </span>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs text-slate-400 min-w-[60px]">Прогресс:</span>
        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-out ${getEfficiencyBg(efficiency)}`}
            style={{ width: `${efficiency}%` }}
          />
        </div>
        <span className="text-xs text-slate-300 min-w-[40px]">
          {completed}/{total}
        </span>
      </div>

      <div className="flex justify-between text-xs text-slate-400">
        <span>Выполнено: {completed}</span>
        <span>Всего: {total}</span>
      </div>
    </div>
  );
}

function SummaryFooter({ items, taskLists = null }) {
  if (!items.length && !taskLists?.length) return null;

  let totalCompleted;
  let totalTasks;
  let avgEfficiency;

  if (taskLists?.length) {
    const uniqueStats = calcPerformanceStats(dedupeTasksById(taskLists.flat()));
    totalCompleted = uniqueStats.completed;
    totalTasks = uniqueStats.total;
    avgEfficiency = items.length
      ? Math.round(items.reduce((sum, item) => sum + item.stats.efficiency, 0) / items.length)
      : uniqueStats.efficiency;
  } else {
    totalCompleted = items.reduce((sum, item) => sum + item.stats.completed, 0);
    totalTasks = items.reduce((sum, item) => sum + item.stats.total, 0);
    avgEfficiency = items.length
      ? Math.round(items.reduce((sum, item) => sum + item.stats.efficiency, 0) / items.length)
      : 0;
  }

  return (
    <div className="mt-4 shrink-0 border-t border-slate-700/50 pt-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <span className="block text-lg font-bold text-slate-300">{totalCompleted}</span>
          <span className="text-xs text-slate-400">Завершено</span>
        </div>
        <div>
          <span className="block text-lg font-bold text-slate-100">{totalTasks}</span>
          <span className="text-xs text-slate-400">Всего задач</span>
        </div>
        <div>
          <span className="block text-lg font-bold text-amber-400">{avgEfficiency}%</span>
          <span className="text-xs text-slate-400">Средняя эффективность</span>
        </div>
      </div>
    </div>
  );
}

function DepartmentPerformance({
  tasks,
  departments,
  employees,
  loading,
  statsScope,
  onScopeChange,
  allowedDepartmentIds = null,
}) {
  const [drilldownDepartmentId, setDrilldownDepartmentId] = useState(null);

  useEffect(() => {
    if (statsScope?.type === 'department') {
      setDrilldownDepartmentId(statsScope.id);
      return;
    }
    if (!statsScope) {
      setDrilldownDepartmentId(null);
    }
  }, [statsScope?.type, statsScope?.id]);

  const selectedEmployeeId = statsScope?.type === 'employee' ? statsScope.id : null;
  const selectedDepartmentId = statsScope?.type === 'department' ? statsScope.id : null;
  const employeesByDepartment = useMemo(() => {
    const map = new Map();
    (employees || []).forEach((employee) => {
      if (!employee.department_id) return;
      const list = map.get(employee.department_id) || [];
      list.push(employee);
      map.set(employee.department_id, list);
    });
    return map;
  }, [employees]);

  const departmentItems = useMemo(() => {
    const allowed = allowedDepartmentIds ? new Set(allowedDepartmentIds) : null;
    return (departments || [])
      .filter((department) => !allowed || allowed.has(department.id))
      .map((department) => {
        const deptEmployees = employeesByDepartment.get(department.id) || [];
        const userIds = deptEmployees.map((e) => e.id);
        const deptTasks = filterTasksForDepartment(tasks, userIds);
        const stats = calcPerformanceStats(deptTasks);
        return {
          id: department.id,
          title: department.name,
          subtitle: department.manager_name ? `Руководитель: ${department.manager_name}` : null,
          employeeCount: deptEmployees.length,
          deptTasks,
          stats,
        };
      })
      .filter((item) => item.employeeCount > 0 || item.stats.total > 0)
      .sort((a, b) => b.stats.efficiency - a.stats.efficiency || a.title.localeCompare(b.title, 'ru'));
  }, [departments, employeesByDepartment, tasks, allowedDepartmentIds]);

  const selectedDepartment = departmentItems.find((d) => d.id === drilldownDepartmentId);
  const memberItems = useMemo(() => {
    if (!drilldownDepartmentId) return [];
    const deptEmployees = employeesByDepartment.get(drilldownDepartmentId) || [];
    return deptEmployees
      .map((employee) => ({
        id: employee.id,
        title: employee.name,
        subtitle: employee.team_role,
        stats: calcPerformanceStats(filterTasksForDepartment(tasks, [employee.id])),
      }))
      .sort((a, b) => b.stats.efficiency - a.stats.efficiency || a.title.localeCompare(b.title, 'ru'));
  }, [employeesByDepartment, drilldownDepartmentId, tasks]);

  const buildDepartmentScope = (departmentId) => {
    const deptEmployees = employeesByDepartment.get(departmentId) || [];
    const department = departmentItems.find((d) => d.id === departmentId);
    const deptTasks = department?.deptTasks || filterTasksForDepartment(
      tasks,
      deptEmployees.map((e) => e.id),
    );
    return {
      type: 'department',
      id: departmentId,
      label: department?.title || 'Отдел',
      userIds: deptEmployees.map((e) => e.id),
      taskIds: deptTasks.map((task) => task.id),
    };
  };

  const selectDepartment = (departmentId) => {
    if (!departmentId) {
      setDrilldownDepartmentId(null);
      onScopeChange?.(null);
      return;
    }
    setDrilldownDepartmentId(departmentId);
    onScopeChange?.(buildDepartmentScope(departmentId));
  };

  const selectEmployee = (member) => {
    if (!drilldownDepartmentId) return;
    if (selectedEmployeeId === member.id) {
      onScopeChange?.(buildDepartmentScope(drilldownDepartmentId));
      return;
    }
    onScopeChange?.({
      type: 'employee',
      id: member.id,
      label: member.title,
      userIds: [member.id],
    });
  };

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-8">Загрузка данных по отделам…</p>;
  }

  if (selectedDepartment) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <button
          type="button"
          onClick={() => selectDepartment(null)}
          className="mb-4 shrink-0 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ← Назад к отделам
        </button>
        <h4 className="mb-4 shrink-0 text-sm font-medium text-slate-300">
          {selectedDepartment.title}
        </h4>
        {memberItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">В отделе нет сотрудников с задачами</p>
        ) : (
          <>
            <p className="mb-4 shrink-0 text-xs text-slate-500">
              Нажмите на сотрудника — в таблице задач останутся только его задачи
            </p>
            <TaskStatsWidgetListScroll>
              <div className="space-y-4">
                {memberItems.map((member, index) => (
                  <PerformanceCard
                    key={member.id}
                    {...member}
                    index={index}
                    clickable
                    selected={selectedEmployeeId === member.id}
                    onClick={() => selectEmployee(member)}
                  />
                ))}
              </div>
            </TaskStatsWidgetListScroll>
            <SummaryFooter items={memberItems} />
          </>
        )}
      </div>
    );
  }

  if (departmentItems.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Нет данных по отделам</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-xs text-slate-500">
        Нажмите на отдел — статистика в соседних виджетах обновится по этому отделу
      </p>
      <TaskStatsWidgetListScroll>
        <div className="space-y-4">
          {departmentItems.map((department, index) => (
            <PerformanceCard
              key={department.id}
              title={department.title}
              subtitle={department.subtitle || `${department.employeeCount} сотрудников`}
              stats={department.stats}
              index={index}
              clickable
              selected={selectedDepartmentId === department.id}
              onClick={() => selectDepartment(department.id)}
            />
          ))}
        </div>
      </TaskStatsWidgetListScroll>
      <SummaryFooter
        items={departmentItems}
        taskLists={departmentItems.map((item) => item.deptTasks || [])}
      />
    </div>
  );
}

function buildTeamItems(teams, tasks) {
  return (teams || [])
    .map((team) => {
      const activeMembers = (team.members || []).filter((m) => m.is_active !== false);
      const teamTasks = filterTasksForTeam(tasks, team);
      return {
        id: team.id,
        title: team.name,
        subtitle: `${activeMembers.length} участников`,
        memberCount: activeMembers.length,
        members: activeMembers,
        teamTasks,
        stats: calcPerformanceStats(teamTasks),
      };
    })
    .filter((item) => item.memberCount > 0 || item.stats.total > 0)
    .sort((a, b) => b.stats.efficiency - a.stats.efficiency || a.title.localeCompare(b.title, 'ru'));
}

function TeamPerformanceDrilldown({
  tasks,
  teams,
  projects,
  loading,
  statsScope,
  onScopeChange,
  emptyMessage = 'Нет данных по командам',
}) {
  const [drilldownTeamId, setDrilldownTeamId] = useState(null);

  useEffect(() => {
    if (statsScope?.type === 'team') {
      setDrilldownTeamId(statsScope.id);
      return;
    }
    if (!statsScope) {
      setDrilldownTeamId(null);
    }
  }, [statsScope?.type, statsScope?.id]);

  const selectedEmployeeId = statsScope?.type === 'employee' ? statsScope.id : null;
  const selectedTeamId = statsScope?.type === 'team' ? statsScope.id : null;

  const teamItems = useMemo(() => buildTeamItems(teams, tasks), [teams, tasks]);

  const selectedTeam = teamItems.find((team) => team.id === drilldownTeamId);

  const memberItems = useMemo(() => {
    if (!selectedTeam) return [];
    return (selectedTeam.members || [])
      .map((member) => {
        const memberTasks = (selectedTeam.teamTasks || []).filter(
          (task) => getTaskAssigneeId(task) === member.user_id,
        );
        return {
          id: member.user_id,
          title: member.user_name || `Сотрудник #${member.user_id}`,
          subtitle: member.role === 'manager' ? 'Менеджер' : 'Участник',
          stats: calcPerformanceStats(memberTasks),
        };
      })
      .sort((a, b) => b.stats.efficiency - a.stats.efficiency || a.title.localeCompare(b.title, 'ru'));
  }, [selectedTeam]);

  const buildTeamScope = (teamId) => {
    const team = teamItems.find((item) => item.id === teamId);
    const activeMembers = team?.members || [];
    const teamTasks = team?.teamTasks || [];
    return {
      type: 'team',
      id: teamId,
      teamId,
      label: team?.title || 'Команда',
      userIds: activeMembers.map((m) => m.user_id),
      taskIds: teamTasks.map((task) => task.id),
    };
  };

  const selectTeam = (teamId) => {
    if (!teamId) {
      setDrilldownTeamId(null);
      onScopeChange?.(null);
      return;
    }
    setDrilldownTeamId(teamId);
    onScopeChange?.(buildTeamScope(teamId));
  };

  const selectEmployee = (member) => {
    if (!drilldownTeamId) return;
    if (selectedEmployeeId === member.id) {
      onScopeChange?.(buildTeamScope(drilldownTeamId));
      return;
    }
    onScopeChange?.({
      type: 'employee',
      id: member.id,
      teamId: drilldownTeamId,
      label: member.title,
      userIds: [member.id],
      taskIds: (selectedTeam.teamTasks || [])
        .filter((task) => getTaskAssigneeId(task) === member.id)
        .map((task) => task.id),
    });
  };

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-8">Загрузка команд…</p>;
  }

  if (selectedTeam) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <button
          type="button"
          onClick={() => selectTeam(null)}
          className="mb-4 shrink-0 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ← Назад к командам
        </button>
        <h4 className="mb-4 shrink-0 text-sm font-medium text-slate-300">
          {selectedTeam.title}
        </h4>
        {memberItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">В команде нет участников с задачами</p>
        ) : (
          <>
            <p className="mb-4 shrink-0 text-xs text-slate-500">
              Нажмите на сотрудника — в таблице задач останутся только его задачи
            </p>
            <TaskStatsWidgetListScroll>
              <div className="space-y-4">
                {memberItems.map((member, index) => (
                  <PerformanceCard
                    key={member.id}
                    {...member}
                    index={index}
                    clickable
                    selected={selectedEmployeeId === member.id}
                    onClick={() => selectEmployee(member)}
                  />
                ))}
              </div>
            </TaskStatsWidgetListScroll>
            <SummaryFooter items={memberItems} />
          </>
        )}
      </div>
    );
  }

  if (teamItems.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">{emptyMessage}</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-4 shrink-0 text-xs text-slate-500">
        Нажмите на команду — статистика в соседних виджетах обновится по этой команде
      </p>
      <TaskStatsWidgetListScroll>
        <div className="space-y-4">
          {teamItems.map((team, index) => (
            <PerformanceCard
              key={team.id}
              title={team.title}
              subtitle={team.subtitle}
              stats={team.stats}
              index={index}
              clickable
              selected={selectedTeamId === team.id}
              onClick={() => selectTeam(team.id)}
            />
          ))}
        </div>
      </TaskStatsWidgetListScroll>
      <SummaryFooter
        items={teamItems}
        taskLists={teamItems.map((item) => item.teamTasks || [])}
      />
    </div>
  );
}

function TeamPerformance({ tasks, teams, projects, user, loading, statsScope, onScopeChange }) {
  const managedTeams = useMemo(
    () => (teams || []).filter((team) => isTeamManager(team, user?.id)),
    [teams, user?.id]
  );

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-8">Загрузка команд…</p>;
  }

  if (managedTeams.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        Нет команд, где вы назначены руководителем
      </p>
    );
  }

  return (
    <TeamPerformanceDrilldown
      tasks={tasks}
      teams={managedTeams}
      projects={projects}
      loading={false}
      statsScope={statsScope}
      onScopeChange={onScopeChange}
      emptyMessage="Нет команд, где вы назначены руководителем"
    />
  );
}

function EmployeeDueTasks({ tasks, user }) {
  const dueTasks = useMemo(
    () => getEmployeeDueTasks(tasks, user?.id),
    [tasks, user?.id]
  );

  if (!user) {
    return <p className="text-sm text-slate-400 text-center py-8">Войдите в систему</p>;
  }

  if (dueTasks.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        Нет задач с установленным сроком
      </p>
    );
  }

  const overdueCount = dueTasks.filter((t) => t.isOverdue).length;

  return (
    <>
      {overdueCount > 0 && (
        <p className="text-xs text-red-400 mb-4">
          Просрочено: {overdueCount}
        </p>
      )}
      <div className="space-y-3">
        {dueTasks.map((task, index) => (
          <div
            key={task.id}
            className={`p-3 rounded-xl border transition-all duration-200 ${
              task.isOverdue
                ? 'bg-red-500/10 border-red-500/40'
                : 'bg-slate-800/30 border-slate-700/50'
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${task.isOverdue ? 'text-red-300' : 'text-slate-200'}`}>
                  {task.title || `Задача #${task.id}`}
                </p>
                <p className={`text-xs mt-1 ${task.isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                  Срок: {new Date(task.due_date).toLocaleDateString('ru-RU')}
                  {task.isOverdue && ' · просрочено'}
                </p>
              </div>
              <span className="text-xs text-slate-500 shrink-0 capitalize">
                {task.status?.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PerformanceSegmentToggle({ value, onChange, className = '' }) {
  return (
    <div
      className={`flex rounded-lg border border-slate-600/50 bg-slate-800/70 p-0.5 ${className}`.trim()}
      role="tablist"
      aria-label="Разрез производительности"
    >
      {[
        { id: 'departments', label: 'Отделы' },
        { id: 'teams', label: 'Команды' },
      ].map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-cyan-500/20 text-cyan-200 shadow-sm ring-1 ring-cyan-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function getWidgetTitle(viewMode) {
  if (viewMode === 'employee') return 'Мои задачи в срок';
  return 'Производительность';
}

export default function TeamRatings({
  tasks = [],
  user,
  statsScope,
  onScopeChange,
  onPerformanceContextChange,
}) {
  const [context, setContext] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ceoSegment, setCeoSegment] = useState('departments');

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadMeta = async () => {
      setLoading(true);
      try {
        const ctx = await employeeService.getContext();
        if (cancelled) return;
        setContext(ctx);

        const teamsData = await teamService.getTeams({ include_members: true });
        if (cancelled) return;
        setTeams(teamsData || []);

        const projectsData = await projectService.getProjects().catch(() => []);
        if (cancelled) return;
        setProjects(projectsData || []);

        const mode = resolvePerformanceViewMode(ctx, teamsData, user.id);
        const canSwitch = canSwitchPerformanceSegment(user, ctx);
        if (mode === 'departments' || canSwitch) {
          const [depts, emps] = await Promise.all([
            employeeService.getDepartments(),
            employeeService.getEmployees(),
          ]);
          if (cancelled) return;
          setDepartments(depts || []);
          setEmployees(emps || []);
        } else if (mode === 'teams') {
          const emps = await employeeService.getEmployees();
          if (cancelled) return;
          setEmployees(emps || []);
        }
      } catch (error) {
        console.error('TeamRatings: failed to load context', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const viewMode = useMemo(
    () => resolvePerformanceViewMode(context, teams, user?.id),
    [context, teams, user?.id]
  );

  const isExecutive = useMemo(
    () => isExecutivePerformanceUser(user, context),
    [user, context]
  );

  const canSwitchSegment = useMemo(
    () => canSwitchPerformanceSegment(user, context),
    [user, context]
  );

  const activeSegment = canSwitchSegment ? ceoSegment : viewMode;

  const allowedDepartmentIds = useMemo(() => {
    if (activeSegment !== 'departments') return null;
    if (isExecutive) return null;
    const tier = context?.tier;
    if (tier === 'platform_admin') return null;
    return context?.managed_department_ids?.length ? context.managed_department_ids : null;
  }, [context, activeSegment, isExecutive]);

  const selectedDepartmentId = statsScope?.type === 'department' ? statsScope.id : null;
  const selectedTeamId = statsScope?.type === 'team' ? statsScope.id : null;

  const handleSegmentChange = (segment) => {
    setCeoSegment(segment);
    onScopeChange?.(null);
  };

  useEffect(() => {
    onPerformanceContextChange?.({
      segment: activeSegment,
      teams: activeSegment === 'teams' ? teams : [],
      projects: activeSegment === 'teams' ? projects : [],
    });
  }, [activeSegment, teams, projects, onPerformanceContextChange]);

  const useContainedScroll = activeSegment === 'departments' || activeSegment === 'teams';

  return (
    <TaskStatsWidget>
      <TaskStatsWidgetBody>
        <TaskStatsWidgetHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-100 truncate">
                {getWidgetTitle(viewMode)}
              </h3>
            </div>
            {canSwitchSegment && (
              <PerformanceSegmentToggle
                value={ceoSegment}
                onChange={handleSegmentChange}
                className="w-full"
              />
            )}
          </div>
        </TaskStatsWidgetHeader>

        <TaskStatsWidgetScroll contained={useContainedScroll}>
          {activeSegment === 'departments' && (
            <DepartmentPerformance
              tasks={tasks}
              departments={departments}
              employees={employees}
              loading={loading}
              statsScope={statsScope}
              onScopeChange={onScopeChange}
              allowedDepartmentIds={allowedDepartmentIds}
            />
          )}

          {activeSegment === 'teams' && canSwitchSegment && (
            <TeamPerformanceDrilldown
              tasks={tasks}
              teams={teams}
              projects={projects}
              loading={loading}
              statsScope={statsScope}
              onScopeChange={onScopeChange}
            />
          )}

          {activeSegment === 'teams' && !canSwitchSegment && (
            <TeamPerformance
              tasks={tasks}
              teams={teams}
              projects={projects}
              user={user}
              loading={loading}
              statsScope={statsScope}
              onScopeChange={onScopeChange}
            />
          )}

          {activeSegment === 'employee' && (
            <EmployeeDueTasks tasks={tasks} user={user} />
          )}
        </TaskStatsWidgetScroll>
      </TaskStatsWidgetBody>
    </TaskStatsWidget>
  );
}
