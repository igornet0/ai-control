import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../../../services/projectService';
import { employeeService } from '../../../../services/employeeService';
import { formatApiError } from '../../../../utils/formatApiError';
import CreateProjectModal from '../../../task_manager/tabs/projects/components/CreateProjectModal';
import { canManageAllTeams, canManageProjects } from './employeePermissions';
import { projectTasksPath } from './taskDeepLinks';

const STATUS_LABELS = {
  planning: 'Планирование',
  active: 'Активный',
  on_hold: 'На паузе',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export default function AdminProjectsSection({ context, departmentId = null }) {
  const navigate = useNavigate();
  const viewAll = context ? canManageAllTeams(context) : true;
  const canCreate = context ? canManageProjects(context) : true;
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept] = useState(departmentId ? String(departmentId) : '');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  const load = async () => {
    setLoading(true);
    try {
      const deptParam = departmentId || (filterDept ? Number(filterDept) : null);
      const params = deptParam ? { department_id: deptParam } : {};
      const [projectsData, depts] = await Promise.all([
        projectService.getProjects(params),
        employeeService.getDepartments(),
      ]);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setDepartments(depts);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [departmentId, filterDept]);

  const handleCreate = async (projectData, files, onProgress) => {
    const created = await projectService.createProject(projectData);
    if (created?.id && files?.length) {
      return projectService.uploadProjectAttachments(created.id, files, onProgress);
    }
    return created;
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Удалить проект «${project.name}»?`)) return;
    try {
      await projectService.deleteProject(project.id);
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Ошибка удаления проекта'));
    }
  };

  if (loading) return <p className="text-slate-400">Загрузка проектов...</p>;

  const effectiveDeptId = departmentId || (filterDept ? Number(filterDept) : null);

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold text-white">
          Проекты ({projects.length})
          {effectiveDeptId && deptMap[effectiveDeptId] ? ` · ${deptMap[effectiveDeptId]}` : ''}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {viewAll && !departmentId && (
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="rounded-lg bg-slate-800/80 border border-slate-600 px-3 py-1.5 text-sm text-white"
            >
              <option value="">Все отделы</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
            >
              + Создать проект
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border-muted)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-400" style={{ borderColor: 'var(--color-border-muted)' }}>
              <th className="p-3">Название</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Команды</th>
              <th className="p-3">Прогресс</th>
              <th className="p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-slate-700/50">
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => navigate(projectTasksPath(project))}
                    className="text-left text-indigo-200 hover:text-white hover:underline font-medium"
                    title="Открыть проект в задачах"
                  >
                    {project.name}
                  </button>
                  {project.description && (
                    <p className="text-slate-500 text-xs truncate max-w-xs">{project.description}</p>
                  )}
                </td>
                <td className="p-3 text-slate-400">
                  {STATUS_LABELS[project.status] || project.status}
                </td>
                <td className="p-3 text-slate-400">
                  {(project.teams || []).map((t) => t.team_name || t.name).filter(Boolean).join(', ') || '—'}
                </td>
                <td className="p-3 text-slate-300">{project.progress ?? 0}%</td>
                <td className="p-3">
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => handleDelete(project)}
                      className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    >
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Проекты не созданы
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateProjectModal
          departmentId={effectiveDeptId}
          onClose={() => setShowCreate(false)}
          onSubmit={async (data, files, onProgress) => {
            try {
              await handleCreate(data, files, onProgress);
              setShowCreate(false);
              await load();
            } catch (err) {
              alert(formatApiError(err, 'Ошибка создания проекта'));
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}
