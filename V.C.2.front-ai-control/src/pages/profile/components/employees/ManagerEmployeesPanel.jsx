import React from 'react';
import OrgPanelShell, { PanelSection } from './OrgPanelShell';
import AdminDepartmentsSection from './AdminDepartmentsSection';
import AdminTeamsSection from './AdminTeamsSection';
import DepartmentTeamsView from './DepartmentTeamsView';

import AdminProjectsSection from './AdminProjectsSection';
import InviteToolbar from './InviteToolbar';

const TABS = [
  { id: 'overview', label: 'Мой отдел' },
  { id: 'departments', label: 'Отделы' },
  { id: 'teams', label: 'Команды' },
  { id: 'projects', label: 'Проекты' },
];

export default function ManagerEmployeesPanel({ context }) {
  return (
    <OrgPanelShell
      title="Мой отдел"
      subtitle={context?.department_name || 'Управление командами и настройка отдела'}
      teamRole={context?.team_role}
      tabs={TABS}
      defaultTab="overview"
    >
      <PanelSection sectionId="overview">
        <div className="flex justify-end mb-4">
          <InviteToolbar context={context} />
        </div>
        <DepartmentTeamsView context={context} compact />
      </PanelSection>
      <PanelSection sectionId="departments">
        <AdminDepartmentsSection context={context} />
      </PanelSection>
      <PanelSection sectionId="teams">
        <AdminTeamsSection context={context} />
      </PanelSection>
      <PanelSection sectionId="projects">
        <AdminProjectsSection
          context={context}
          departmentId={context?.department_id || null}
        />
      </PanelSection>
    </OrgPanelShell>
  );
}
