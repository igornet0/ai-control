import React, { useState, useEffect } from 'react';
import { employeeService } from '../../../../services/employeeService';
import { teamService } from '../../../../services/teamService';
import EmployeeCard from './EmployeeCard';
import InviteToolbar from './InviteToolbar';
import { isLeadershipRole } from './employeePermissions';

export default function ColleaguesView({ context }) {
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [emps, myTeams] = await Promise.all([
          employeeService.getEmployees(),
          teamService.getTeams(),
        ]);
        setEmployees(emps);
        setTeams(myTeams);
      } catch {
        setEmployees([]);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const leadership = employees.filter((e) => isLeadershipRole(context, e.team_role));
  const colleagues = employees.filter((e) => !isLeadershipRole(context, e.team_role));

  if (loading) return <p className="text-slate-400">Загрузка...</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Мои коллеги</h2>
          <p className="text-slate-400 text-sm">
            {context?.department_name ? `Отдел: ${context.department_name}` : 'Просмотр без редактирования'}
          </p>
        </div>
        <InviteToolbar context={context} />
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
        <h3 className="text-lg font-semibold text-white mb-3">Мои команды ({teams.length})</h3>
        <div className="flex flex-wrap gap-2">
          {teams.map((t) => (
            <span key={t.id} className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-sm">
              {t.name}
            </span>
          ))}
          {teams.length === 0 && <span className="text-slate-500">Нет команд</span>}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Коллеги</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {colleagues.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} />
          ))}
        </div>
      </section>
    </div>
  );
}
