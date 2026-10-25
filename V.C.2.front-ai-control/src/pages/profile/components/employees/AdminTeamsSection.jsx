import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamService } from '../../../../services/teamService';
import { employeeService } from '../../../../services/employeeService';
import { formatApiError } from '../../../../utils/formatApiError';
import { canManageAllTeams, canCreateTeams } from './employeePermissions';
import TeamManageModal from './TeamManageModal';
import { teamTasksPath } from './taskDeepLinks';
import tabStyles from '../ProfileTabs.module.css';

export { TeamManageModal };

export default function AdminTeamsSection({ context }) {
  const navigate = useNavigate();
  const viewAll = context ? canManageAllTeams(context) : true;
  const canCreateTeamsFlag = context ? canCreateTeams(context) : true;
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageTeamId, setManageTeamId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', department_id: '' });
  const [creating, setCreating] = useState(false);

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  const load = async () => {
    setLoading(true);
    try {
      const [teamsData, depts] = await Promise.all([
        viewAll ? teamService.getTeams({ all: true }) : teamService.getTeams(),
        employeeService.getDepartments(),
      ]);
      setTeams(teamsData);
      setDepartments(depts);
    } catch {
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await teamService.createTeam({
        name: createForm.name,
        description: createForm.description || null,
        department_id: createForm.department_id ? Number(createForm.department_id) : null,
      });
      setShowCreate(false);
      setCreateForm({ name: '', description: '', department_id: '' });
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка создания команды'));
    } finally {
      setCreating(false);
    }
  };

  const openCreate = () => {
    setCreateForm({
      name: '',
      description: '',
      department_id: context?.department_id ? String(context.department_id) : '',
    });
    setShowCreate(true);
  };

  if (loading) return <div className={tabStyles.loader}><span className={tabStyles.spinner} />Загрузка команд...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Команды ({teams.length})</h3>
        {canCreateTeamsFlag && (
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
          >
            + Создать команду
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border-muted)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-400" style={{ borderColor: 'var(--color-border-muted)' }}>
              <th className="p-3">Название</th>
              <th className="p-3">Отдел</th>
              <th className="p-3">Описание</th>
              <th className="p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.id} className="border-b border-slate-700/50">
                <td className="p-3 text-white font-medium">
                  <button
                    type="button"
                    onClick={() => navigate(teamTasksPath(team))}
                    className="text-left text-indigo-200 hover:text-white hover:underline"
                    title="Открыть задачи команды"
                  >
                    {team.name}
                  </button>
                </td>
                <td className="p-3 text-slate-400">{deptMap[team.department_id] || '—'}</td>
                <td className="p-3 text-slate-400 max-w-xs truncate">{team.description || '—'}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => setManageTeamId(team.id)}
                    className="text-xs px-2 py-1 rounded bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30"
                  >
                    Управление
                  </button>
                </td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Команды не созданы</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: 'var(--gradient-surface)', borderColor: 'var(--color-border-muted)' }}>
            <h4 className="text-lg font-bold text-white mb-4">Новая команда</h4>
            <form onSubmit={handleCreate} className="space-y-3">
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
              <select
                value={createForm.department_id}
                onChange={(e) => setCreateForm({ ...createForm, department_id: e.target.value })}
                className="w-full rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-2 text-white"
              >
                <option value="">— отдел —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={creating} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">
                  {creating ? 'Создание...' : 'Создать'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300">
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
          onClose={() => setManageTeamId(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
