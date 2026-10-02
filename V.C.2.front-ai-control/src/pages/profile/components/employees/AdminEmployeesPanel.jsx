import React, { useState } from 'react';
import AdminEmployeesSection from './AdminEmployeesSection';
import AdminDepartmentsSection from './AdminDepartmentsSection';
import AdminTeamsSection from './AdminTeamsSection';
import AdminProjectsSection from './AdminProjectsSection';
import OrgTreeView from './OrgTreeView';

const TABS = [
  { id: 'employees', label: 'Сотрудники' },
  { id: 'departments', label: 'Отделы' },
  { id: 'teams', label: 'Команды' },
  { id: 'projects', label: 'Проекты' },
  { id: 'structure', label: 'Структура' },
];

export default function AdminEmployeesPanel({ currentUser, context }) {
  const [activeSection, setActiveSection] = useState('employees');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Управление организацией</h2>
        <p className="text-slate-400 text-sm mt-1">
          Полный доступ: сотрудники, отделы, команды и оргструктура
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b pb-1" style={{ borderColor: 'var(--color-border-muted)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeSection === tab.id
                ? 'bg-indigo-600/30 text-white border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'employees' && (
        <AdminEmployeesSection currentUser={currentUser} context={context} />
      )}
      {activeSection === 'departments' && <AdminDepartmentsSection context={context} />}
      {activeSection === 'teams' && <AdminTeamsSection context={context} />}
      {activeSection === 'projects' && <AdminProjectsSection context={context} />}
      {activeSection === 'structure' && <OrgTreeView />}
    </div>
  );
}
