import React, { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { formatUnreadCount } from '../../../services/browserNotifications';
import { useCollapsibleSidebar } from '../../../hooks/useCollapsibleSidebar.js';
import MobileSidebarChrome from '../../../components/layout/MobileSidebarChrome.jsx';
import styles from './ProfileSidebar.module.css';
import { isPlatformAdmin } from '../../../utils/isPlatformAdmin';
import { accountingService } from '../../../services/accountingService';

const iconClass = 'w-4 h-4 shrink-0';

const icons = {
  profile: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  finance: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  employees: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  email: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  strategys: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  admin: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  logout: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v3.75M15.75 9l-3-3m0 0l-3 3m3-3h8.25M8.25 21h8.25A2.25 2.25 0 0018.75 18.75V15M8.25 21H5.25A2.25 2.25 0 013 18.75V15m0-2.25V5.25" />
    </svg>
  ),
  accounting: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
    </svg>
  ),
  privacy: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
};

const navItems = [
  { key: 'profile', label: 'Профиль' },
  { key: 'finance', label: 'Финансы' },
  { key: 'employees', label: 'Сотрудники' },
  { key: 'email', label: 'Почта' },
  { key: 'strategys', label: 'Стратегия' },
];
const privacyItem = { key: 'privacy', label: 'Конфиденциальность' };

const ProfileSidebar = ({
  activeTab,
  setActiveTab,
  onLogout,
  user,
  badges = {},
}) => {
  const { collapsed, toggle, mobileOpen, closeMobile, openMobile } = useCollapsibleSidebar(
    'profile-sidebar-collapsed',
  );
  const isAdmin = isPlatformAdmin(user);
  const [canAccounting, setCanAccounting] = useState(false);
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    accountingService
      .getAccess()
      .then((r) => !cancelled && setCanAccounting(Boolean(r?.can_access)))
      .catch(() => !cancelled && setCanAccounting(false));
    return () => {
      cancelled = true;
    };
  }, [user]);
  const allNavItems = [
    ...navItems,
    ...(isAdmin ? [{ key: 'admin', label: 'Админ панель' }] : []),
    ...(isAdmin || canAccounting ? [{ key: 'accounting', label: 'Бухгалтерия' }] : []),
    privacyItem,
  ];

  const selectTab = (key) => {
    setActiveTab(key);
    closeMobile();
  };

  return (
    <>
      <MobileSidebarChrome open={mobileOpen} onOpen={openMobile} onClose={closeMobile} label="Разделы профиля" />
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
        data-app-sidebar
        data-open={mobileOpen ? 'true' : 'false'}
      >
      <div className={styles.sidebarBrand}>
        <span className={styles.sidebarBrandIcon} aria-hidden>
          {icons.profile}
        </span>
        <div className={styles.sidebarBrandText}>
          <h2 className={styles.sidebarTitle}>Профиль</h2>
        </div>
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={toggle}
          aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
          title={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      <nav className={styles.sidebarNav} aria-label="Разделы профиля">
        <ul className={styles.tabList}>
          {allNavItems.map(({ key, label }) => {
            const isActive = activeTab === key;
            const badge = formatUnreadCount(badges[key]);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => selectTab(key)}
                  className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
                >
                  <span className={styles.tabButtonIcon} aria-hidden>
                    {icons[key]}
                  </span>
                  <span className={styles.tabButtonLabel}>{label}</span>
                  {badge ? <span className={styles.tabBadge}>{badge}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={onLogout}
          title={collapsed ? 'Выйти' : undefined}
        >
          <span className={styles.tabButtonIcon} aria-hidden>
            {icons.logout}
          </span>
          <span className={styles.logoutLabel}>Выйти</span>
        </button>
      </div>
    </aside>
    </>
  );
};

export default ProfileSidebar;
