import React, { useState } from 'react';

export function PanelSection({ sectionId, children }) {
  return children;
}

export default function OrgPanelShell({ title, subtitle, teamRole, tabs, defaultTab, children }) {
  const [activeSection, setActiveSection] = useState(defaultTab || tabs[0]?.id);

  const activeChild = React.Children.toArray(children).find(
    (child) => child.props.sectionId === activeSection
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        {teamRole && <p className="text-indigo-300 text-xs mt-1">TeamRole: {teamRole}</p>}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b pb-1" style={{ borderColor: 'var(--color-border-muted)' }}>
        {tabs.map((tab) => (
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

      {activeChild}
    </div>
  );
}
