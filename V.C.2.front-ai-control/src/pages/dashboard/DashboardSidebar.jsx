import React from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  IconControlPanelWorkspace,
  IconDataModels,
  IconFlows,
  IconPanels,
} from './ControlPanelIcons';
import { useCollapsibleSidebar } from '../../hooks/useCollapsibleSidebar.js';
import MobileSidebarChrome from '../../components/layout/MobileSidebarChrome.jsx';
import styles from './DashboardSidebar.module.css';

const SIDEBAR_COLLAPSED_KEY = 'control-panel-sidebar-collapsed';

const MAIN_SECTIONS = [
  { id: 'panels', label: 'Панели', icon: IconPanels },
  { id: 'flows', label: 'Потоки', icon: IconFlows },
  { id: 'data-models', label: 'Модели данных', icon: IconDataModels },
];

export default function DashboardSidebar({
  mainSection,
  onMainSectionChange,
  panelsFilters = [],
  panelsFilter,
  onPanelsFilterChange,
  flowsFilters = [],
  flowsFilter,
  onFlowsFilterChange,
  modelsFilters = [],
  modelsFilter,
  onModelsFilterChange,
  recentItems = [],
  onRecentClick,
}) {
  const { collapsed, toggle, mobileOpen, closeMobile, openMobile } = useCollapsibleSidebar(
    SIDEBAR_COLLAPSED_KEY,
  );

  const selectSection = (id) => {
    onMainSectionChange?.(id);
    closeMobile();
  };

  const subFilters = mainSection === 'panels'
    ? panelsFilters
    : mainSection === 'flows'
      ? flowsFilters
      : modelsFilters;
  const activeSubFilter = mainSection === 'panels'
    ? panelsFilter
    : mainSection === 'flows'
      ? flowsFilter
      : modelsFilter;
  const onSubFilterChange = mainSection === 'panels'
    ? onPanelsFilterChange
    : mainSection === 'flows'
      ? onFlowsFilterChange
      : onModelsFilterChange;

  return (
    <>
      <MobileSidebarChrome open={mobileOpen} onOpen={openMobile} onClose={closeMobile} label="Разделы панелей" />
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
        data-app-sidebar
        data-open={mobileOpen ? 'true' : 'false'}
      >
      <div className={styles.brand}>
        <span className={styles.brandIcon} aria-hidden>
          <IconControlPanelWorkspace size={18} />
        </span>
        <div className={styles.brandText}>
          <h2 className={styles.brandTitle}>Панели</h2>
        </div>
        <button
          type="button"
          className={styles.toggle}
          onClick={toggle}
          aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
        >
          {collapsed ? (
            <ChevronRightIcon style={{ width: '1rem', height: '1rem' }} />
          ) : (
            <ChevronLeftIcon style={{ width: '1rem', height: '1rem' }} />
          )}
        </button>
      </div>

      <nav className={styles.nav} aria-label="Разделы панели управления">
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Разделы</span>
          <ul className={styles.tabList}>
            {MAIN_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = mainSection === section.id;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
                    onClick={() => selectSection(section.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? section.label : undefined}
                  >
                    <span className={styles.tabButtonIcon} aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span className={styles.tabButtonLabel}>{section.label}</span>
                  </button>
                  {isActive && subFilters.length > 0 && (
                    <ul className={styles.subList}>
                      {subFilters.map((filter) => (
                        <li key={filter.id}>
                          <button
                            type="button"
                            className={`${styles.subButton} ${
                              activeSubFilter === filter.id ? styles.subButtonActive : ''
                            }`}
                            onClick={() => onSubFilterChange?.(filter.id)}
                          >
                            <span className={styles.tabButtonLabel}>
                              {filter.label} ({filter.count})
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {recentItems.length > 0 && (
        <div className={styles.recentSection}>
          <span className={styles.sectionLabel}>Недавние</span>
          <ul className={styles.tabList}>
            {recentItems.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <button
                  type="button"
                  className={styles.recentButton}
                  onClick={() => {
                    onRecentClick?.(item);
                    closeMobile();
                  }}
                  title={item.name}
                >
                  <ClockIcon style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
                  <span className={styles.recentLabel}>{item.name}</span>
                  <span className={styles.recentMeta}>
                    {item.type === 'dashboard' ? 'Панель' : 'Модель'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
    </>
  );
}
