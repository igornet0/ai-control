import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../../../../services/employeeService';
import { teamService } from '../../../../services/teamService';
import { formatApiError } from '../../../../utils/formatApiError';
import EmployeeCard from './EmployeeCard';
import TeamManageModal from './TeamManageModal';
import AdminProjectsSection from './AdminProjectsSection';
import { canCreateTeams, canEditDepartment, isLeadershipRole } from './employeePermissions';
import { teamTasksPath } from './taskDeepLinks';

export default function DepartmentTeamsView({ context, compact = false }) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageTeamId, setManageTeamId] = useState(null);
  const [showDeptEdit, setShowDeptEdit] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [savingDept, setSavingDept] = useState(false);

  const canEditDept = context?.department_id
    ? canEditDepartment(context, context.department_id)
    : false;
  const canCreate = canCreateTeams(context);

  const loadTeams = useCallback(async () => {
    if (!context?.department_id) {
      const myTeams = await teamService.getTeams();
      setTeams(myTeams);
      return;
    }
    const deptTeams = await teamService.getTeams({ department_id: context.department_id });
    setTeams(deptTeams);
  }, [context?.department_id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = context?.department_id ? { department_id: context.department_id } : {};
        const [emps, depts] = await Promise.all([
          employeeService.getEmployees(params),
          employeeService.getDepartments(),
        ]);
        setEmployees(emps);
        setDepartments(depts);
        await loadTeams();
        const myDept = depts.find((d) => d.id === context?.department_id);
        if (myDept) {
          setDeptForm({ name: myDept.name, description: myDept.description || '' });
        }
      } catch {
        setEmployees([]);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [context?.department_id, loadTeams]);

  const leadership = employees.filter((e) => isLeadershipRole(context, e.team_role));
  const colleagues = employees.filter((e) => !isLeadershipRole(context, e.team_role));

  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!context?.department_id) return;
    setSavingDept(true);
    try {
      await employeeService.updateDepartment(context.department_id, {
        name: deptForm.name,
        description: deptForm.description || null,
      });
      setShowDeptEdit(false);
    } catch (err) {
      alert(formatApiError(err, 'Ошибка сохранения отдела'));
    } finally {
      setSavingDept(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!context?.department_id) return;
    setCreating(true);
    try {
      await teamService.createTeam({
        name: createForm.name,
        description: createForm.description || null,
        department_id: context.department_id,
      });
      setShowCreateTeam(false);
      setCreateForm({ name: '', description: '' });
      await loadTeams();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка создания команды'));
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <p className="text-slate-400">Загрузка...</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {!compact && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Мой отдел</h2>
            <p className="text-slate-400 text-sm">
              {context?.department_name || 'Отдел не назначен'} · команды и проекты
            </p>
          </div>
        )}
        {compact && (
          <p className="text-slate-400 text-sm">
            {context?.department_name || 'Отдел не назначен'}
          </p>
        )}
        {canEditDept && (
          <button
            type="button"
            onClick={() => setShowDeptEdit(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
          >
            Настроить отдел
          </button>
        )}
      </div>

      {leadership.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-3">Начальство</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {leadership.map((emp) => (
              <EmployeeCard key={emp.id} employee={emp} brief />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-white">
            Команды отдела ({teams.length})
          </h3>
          {canCreate && context?.department_id && (
            <button
              type="button"
              onClick={() => setShowCreateTeam(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
            >
              + Создать команду
            </button>
          )}
        </div>
        {teams.length === 0 ? (
          <p className="text-slate-500">Нет команд в этом отделе</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--color-border-muted)', background: 'var(--gradient-surface)' }}
              >
                <button
                  type="button"
                  onClick={() => navigate(teamTasksPath(team))}
                  className="font-semibold text-indigo-200 hover:text-white hover:underline text-left"
                  title="Открыть задачи команды"
                >
                  {team.name}
                </button>
                <p className="text-sm text-slate-400 mt-1">{team.description || 'Без описания'}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Участников: {team.members?.length ?? '—'}
                </p>
                <button
                  type="button"
                  onClick={() => setManageTeamId(team.id)}
                  className="mt-3 text-xs px-3 py-1.5 rounded bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30"
                >
                  Управление участниками
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {context?.department_id && (
        <section>
          <AdminProjectsSection context={context} departmentId={context.department_id} />
        </section>
      )}

      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Коллеги ({colleagues.length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {colleagues.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} />
          ))}
        </div>
      </section>

      {showCreateTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-2xl border p-6"
            style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}
          >
            <h4 className="text-lg font-bold text-white mb-1">Новая команда</h4>
            <p className="text-sm text-slate-400 mb-4">
              Отдел: {context?.department_name || '—'}
            </p>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Название команды"
                className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
              />
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Описание"
                className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
                rows={2}
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateTeam(false)}
                  className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeptEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}>
            <h4 className="text-lg font-bold text-white mb-4">Настройки отдела</h4>
            <form onSubmit={handleSaveDept} className="space-y-3">
              <input
                required
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
                placeholder="Название отдела"
              />
              <textarea
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
                placeholder="Описание"
                rows={3}
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingDept} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">
                  {savingDept ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setShowDeptEdit(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manageTeamId && (
        <TeamManageModal
          teamId={manageTeamId}
          departments={departments}
          departmentId={context?.department_id}
          onClose={() => setManageTeamId(null)}
          onUpdated={loadTeams}
        />
      )}
    </div>
  );
}
