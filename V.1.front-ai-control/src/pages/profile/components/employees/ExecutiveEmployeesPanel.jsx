import React from 'react';
import OrgPanelShell, { PanelSection } from './OrgPanelShell';
import AdminDepartmentsSection from './AdminDepartmentsSection';
import AdminTeamsSection from './AdminTeamsSection';
import AdminProjectsSection from './AdminProjectsSection';
import OrgTreeView from './OrgTreeView';
import ExecutiveOrgEmployeesSection from './ExecutiveOrgEmployeesSection';

const TABS = [
  { id: 'employees', label: 'Сотрудники' },
  { id: 'departments', label: 'Отделы' },
  { id: 'teams', label: 'Команды' },
  { id: 'projects', label: 'Проекты' },
  { id: 'structure', label: 'Структура' },
];

export default function ExecutiveEmployeesPanel({ context }) {
  return (
    <OrgPanelShell
      title="Организация"
      subtitle="Управление отделами, командами и назначениями (без изменения TeamRole и блокировки пользователей)"
      teamRole={context?.team_role}
      tabs={TABS}
      defaultTab="structure"
    >
      <PanelSection sectionId="employees">
        <ExecutiveOrgEmployeesSection context={context} />
      </PanelSection>
      <PanelSection sectionId="departments">
        <AdminDepartmentsSection context={context} />
      </PanelSection>
      <PanelSection sectionId="teams">
        <AdminTeamsSection context={context} />
      </PanelSection>
      <PanelSection sectionId="projects">
        <AdminProjectsSection context={context} />
      </PanelSection>
      <PanelSection sectionId="structure">
        <OrgTreeView />
      </PanelSection>
    </OrgPanelShell>
  );
}
