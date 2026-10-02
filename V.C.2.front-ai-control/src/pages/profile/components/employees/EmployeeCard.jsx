import React from 'react';
import EmployeeHoverTrigger from './EmployeeHoverTrigger';

export default function EmployeeCard({ employee, brief = false }) {
  return (
    <EmployeeHoverTrigger employee={employee} className="block w-full">
      <div className="rounded-xl border p-4 backdrop-blur-sm" style={{ borderColor: 'var(--color-border-muted)', background: 'var(--gradient-surface)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{employee.name}</h4>
              {employee.is_online && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  онлайн
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{employee.email}</p>
            {employee.phone && (
              <p className="text-sm text-slate-400">{employee.phone}</p>
            )}
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-200">
            {employee.team_role}
          </span>
        </div>
        {!brief && employee.department_name && (
          <p className="text-xs text-slate-500 mt-2">Отдел: {employee.department_name}</p>
        )}
      </div>
    </EmployeeHoverTrigger>
  );
}
