import React from 'react';
import { TaskNavIcon } from './TaskNavIcons';
import { useCollapsibleSidebar } from '../../../hooks/useCollapsibleSidebar.js';
import MobileSidebarChrome from '../../../components/layout/MobileSidebarChrome.jsx';
import styles from './TaskSidebar.module.css';

const SIDEBAR_COLLAPSED_KEY = 'task-manager-sidebar-collapsed';

const NAV_SECTIONS = [
  {
    label: 'Работа',
    items: [
      { id: 'Задачи', label: 'Задачи', icon: 'tasks' },
      { id: 'Обзор', label: 'Обзор', icon: 'overview' },
    ],
  },
  {
    label: 'Аналитика',
    items: [{ id: 'Статистика', label: 'Статистика', icon: 'statistics' }],
  },
  {
    label: 'Организация',
    items: [
      { id: 'Проекты', label: 'Проекты', icon: 'projects' },
      { id: 'Команды', label: 'Команды', icon: 'teams' },
    ],
  },
  {
    label: 'Файлы',
    items: [{ id: 'Файлы', label: 'Файлы', icon: 'files' }],
  },
];

export default function TaskSidebar({ activeTab, onTabChange }) {
  const { collapsed, toggle, mobileOpen, closeMobile, openMobile } = useCollapsibleSidebar(
    SIDEBAR_COLLAPSED_KEY,
  );

  const selectTab = (id) => {
    onTabChange?.(id);
    closeMobile();
  };

  return (
    <>
      <MobileSidebarChrome open={mobileOpen} onOpen={openMobile} onClose={closeMobile} label="Разделы задач" />
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
        data-app-sidebar
        data-open={mobileOpen ? 'true' : 'false'}
      >
      <div className={styles.brand}>
        <span className={styles.brandIcon} aria-hidden>
          <TaskNavIcon name="workspace" size={18} />
        </span>
        <div className={styles.brandText}>
          <h2 className={styles.brandTitle}>Задачи</h2>
        </div>
        <button
          type="button"
          className={styles.toggle}
          onClick={toggle}
          aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
          title={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
        >
          <TaskNavIcon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={16} />
        </button>
      </div>

      <nav className={styles.nav} aria-label="Разделы задачника">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.label} className={styles.section}>
            {sectionIndex > 0 && <div className={styles.sectionDivider} aria-hidden />}
            <span className={styles.sectionLabel}>{section.label}</span>
            <ul className={styles.tabList}>
              {section.items.map((tab) => (
                <li key={tab.id}>
                  <button
                    type="button"
                    className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ''}`}
                    onClick={() => selectTab(tab.id)}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    title={collapsed ? tab.label : undefined}
                  >
                    <span className={styles.tabButtonIcon} aria-hidden>
                      <TaskNavIcon name={tab.icon} size={16} />
                    </span>
                    <span className={styles.tabButtonLabel}>{tab.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
    </>
  );
}
