import React, { useState } from 'react';
import styles from '../ProfileTabs.module.css';

export function PanelSection({ sectionId, children }) {
  return children;
}

export default function OrgPanelShell({ title, subtitle, teamRole, tabs, defaultTab, children }) {
  const [activeSection, setActiveSection] = useState(defaultTab || tabs[0]?.id);

  const activeChild = React.Children.toArray(children).find(
    (child) => child.props.sectionId === activeSection
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Сотрудники</span>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {teamRole && <span className={styles.roleTag}>TeamRole: {teamRole}</span>}
        </div>
      </header>

      {tabs.length > 1 && (
        <nav className={styles.segTabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeSection === tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`${styles.segTab} ${activeSection === tab.id ? styles.segTabActive : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      <div>{activeChild}</div>
    </div>
  );
}
