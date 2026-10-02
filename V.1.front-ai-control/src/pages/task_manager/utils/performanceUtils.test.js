import { describe, expect, it } from 'vitest';
import {
  applyStatsScope,
  calcPerformanceStats,
  canFilterOverdueTasks,
  dedupeTasksById,
  filterTasksForDepartment,
  filterTasksForTeam,
  isTaskCompleted,
  isTaskOverdue,
  taskBelongsToTeam,
} from './performanceUtils';

const tasks = [
  { id: 1, executor_id: 100, project_id: 1 },
  { id: 2, executor_id: 100, project_id: 1 },
  { id: 3, executor_id: 200, project_id: 2 },
  { id: 4, executor_id: 100, team_id: 10 },
  { id: 5, executor_id: 100 },
  { id: 6, executor_id: 200, project_id: 1, team_id: 20 },
];

describe('taskBelongsToTeam', () => {
  it('includes only tasks with an explicit matching team_id', () => {
    expect(taskBelongsToTeam(tasks[3], 10)).toBe(true);
    expect(taskBelongsToTeam(tasks[3], 20)).toBe(false);
    expect(taskBelongsToTeam(tasks[5], 20)).toBe(true);
  });

  it('ignores project and assignee when team_id is missing', () => {
    expect(taskBelongsToTeam(tasks[0], 10)).toBe(false);
    expect(taskBelongsToTeam(tasks[2], 20)).toBe(false);
    expect(taskBelongsToTeam(tasks[4], 10)).toBe(false);
  });

  it('does not attribute a task of another team via project or assignee', () => {
    expect(taskBelongsToTeam(tasks[5], 10)).toBe(false);
    expect(taskBelongsToTeam({ id: 9, executor_id: 100, project_id: 1, team_id: 20 }, 10)).toBe(false);
  });
});

describe('filterTasksForTeam', () => {
  it('keeps only explicit team tasks', () => {
    const teamA = { id: 10, members: [{ user_id: 100, is_active: true }] };
    const teamB = { id: 20, members: [{ user_id: 100, is_active: true }] };

    expect(filterTasksForTeam(tasks, teamA).map((t) => t.id)).toEqual([4]);
    expect(filterTasksForTeam(tasks, teamB).map((t) => t.id)).toEqual([6]);
  });

  it('does not count the same assigned task for two teams of a shared project', () => {
    const shared = [
      { id: 1, executor_id: 100, project_id: 1, team_id: 10 },
      { id: 2, executor_id: 100, project_id: 1, team_id: 11 },
    ];
    expect(filterTasksForTeam(shared, { id: 10 }).map((t) => t.id)).toEqual([1]);
    expect(filterTasksForTeam(shared, { id: 11 }).map((t) => t.id)).toEqual([2]);
  });
});

describe('applyStatsScope', () => {
  it('filters by taskIds when team scope provides them', () => {
    const scoped = applyStatsScope(tasks, { taskIds: [1, 3] });
    expect(scoped.map((t) => t.id)).toEqual([1, 3]);
  });

  it('shows all tasks for departments segment without scope', () => {
    const all = [
      { id: 1, executor_id: 1, project_id: 10 },
      { id: 2, executor_id: 1 },
    ];
    expect(applyStatsScope(all, null, { segment: 'departments' }).map((t) => t.id)).toEqual([1, 2]);
  });

  it('shows only explicit team tasks for teams segment without scope', () => {
    const teams = [{ id: 10, members: [{ user_id: 100, is_active: true }] }];
    const all = [
      { id: 1, executor_id: 100, project_id: 1 },
      { id: 2, executor_id: 100 },
      { id: 3, executor_id: 100, team_id: 10 },
      { id: 4, executor_id: 100, team_id: 99 },
    ];
    expect(
      applyStatsScope(all, null, { segment: 'teams', teams }).map((t) => t.id),
    ).toEqual([3]);
  });

  it('filters widgets and lists by selected team id, not inferred membership', () => {
    const all = [
      { id: 1, executor_id: 100, project_id: 1 },
      { id: 2, executor_id: 100, team_id: 10 },
      { id: 3, executor_id: 100, team_id: 20 },
    ];
    expect(
      applyStatsScope(all, { type: 'team', id: 10, label: 'Ad Ops' }).map((t) => t.id),
    ).toEqual([2]);
  });

  it('filters employee drilldown inside a team by team_id and assignee', () => {
    const all = [
      { id: 1, executor_id: 100, team_id: 10 },
      { id: 2, executor_id: 100, team_id: 20 },
      { id: 3, executor_id: 200, team_id: 10 },
    ];
    expect(
      applyStatsScope(all, { type: 'employee', id: 100, teamId: 10 }).map((t) => t.id),
    ).toEqual([1]);
  });

  it('defaults to project-linked tasks when segment is unknown', () => {
    const all = [
      { id: 1, executor_id: 1, project_id: 10 },
      { id: 2, executor_id: 1 },
    ];
    expect(applyStatsScope(all, null).map((t) => t.id)).toEqual([1]);
  });
});

describe('calcPerformanceStats', () => {
  it('counts completed/done but not cancelled', () => {
    const stats = calcPerformanceStats([
      { id: 1, status: 'completed' },
      { id: 2, status: 'done' },
      { id: 3, status: 'cancelled' },
      { id: 4, status: 'in_progress' },
    ]);
    expect(stats).toEqual({ total: 4, completed: 2, efficiency: 50 });
  });
});

describe('filterTasksForDepartment', () => {
  it('includes all assignee tasks, with or without project', () => {
    const list = filterTasksForDepartment(
      [
        { id: 1, executor_id: 100, project_id: 1 },
        { id: 2, executor_id: 100 },
        { id: 3, executor_id: 200, project_id: 2 },
      ],
      [100],
    );
    expect(list.map((t) => t.id)).toEqual([1, 2]);
  });
});

describe('dedupeTasksById', () => {
  it('merges duplicate task ids', () => {
    expect(
      dedupeTasksById([
        { id: 1, status: 'completed' },
        { id: 1, status: 'completed' },
        { id: 2, status: 'created' },
      ]).map((t) => t.id),
    ).toEqual([1, 2]);
  });
});

describe('isTaskCompleted', () => {
  it('treats done as completed and excludes cancelled', () => {
    expect(isTaskCompleted('completed')).toBe(true);
    expect(isTaskCompleted('done')).toBe(true);
    expect(isTaskCompleted('cancelled')).toBe(false);
  });
});

describe('isTaskOverdue', () => {
  const now = new Date(2026, 7, 12);

  it('marks open tasks with a past due date as overdue', () => {
    expect(isTaskOverdue({ due_date: '2026-08-11', status: 'in_progress' }, now)).toBe(true);
  });

  it('does not mark tasks due today or later', () => {
    expect(isTaskOverdue({ due_date: '2026-08-12', status: 'in_progress' }, now)).toBe(false);
    expect(isTaskOverdue({ due_date: '2026-08-13', status: 'review' }, now)).toBe(false);
  });

  it('excludes closed tasks', () => {
    expect(isTaskOverdue({ due_date: '2026-08-01', status: 'completed' }, now)).toBe(false);
    expect(isTaskOverdue({ due_date: '2026-08-01', status: 'cancelled' }, now)).toBe(false);
  });
});

describe('canFilterOverdueTasks', () => {
  it('allows CEO and Manager', () => {
    expect(canFilterOverdueTasks({ team_role: 'CEO' })).toBe(true);
    expect(canFilterOverdueTasks({ team_role: 'Manager' })).toBe(true);
    expect(canFilterOverdueTasks({ role: 'admin' })).toBe(true);
  });

  it('denies regular members', () => {
    expect(canFilterOverdueTasks({ team_role: 'Developer' })).toBe(false);
    expect(canFilterOverdueTasks(null)).toBe(false);
  });
});
