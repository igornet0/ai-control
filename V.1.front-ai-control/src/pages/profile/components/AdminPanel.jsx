import React, { useEffect, useState } from 'react';
import {
  ChartBarIcon,
  CircleStackIcon,
  CpuChipIcon,
  CreditCardIcon,
  LinkIcon,
  PresentationChartBarIcon,
  SparklesIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../../context/AuthContext';
import { adminService } from '../../../services/adminService';
import { isPlatformAdmin } from '../../../utils/isPlatformAdmin';
import { AdminIcon } from './AdminIcons';
import Connections from './Connections';
import UsersTableModal from './UsersTableModal';
import AdminDataBridgePanel from './AdminDataBridgePanel';
import AdminHeroDemoPanel from './AdminHeroDemoPanel';
import AdminAiAgentPanel from './AdminAiAgentPanel';
import AdminAiScenariosPanel from './AdminAiScenariosPanel';
import AdminBillingPanel from './AdminBillingPanel';
import styles from './AdminPanel.module.css';

const STAT_CARDS = [
  {
    key: 'total_users',
    label: 'Пользователи',
    icon: 'users',
    color: 'blue',
    accent: styles.statAccentBlue,
    clickable: true,
    section: 'users',
  },
  {
    key: 'total_dashboards',
    label: 'Дашборды',
    icon: 'dashboards',
    color: 'indigo',
    accent: styles.statAccentIndigo,
  },
  {
    key: 'total_data_models',
    label: 'Модели данных',
    icon: 'dataModels',
    color: 'amber',
    accent: styles.statAccentAmber,
  },
  {
    key: 'total_tasks',
    label: 'Задачи',
    icon: 'tasks',
    color: 'emerald',
    accent: styles.statAccentEmerald,
  },
];

const PERIOD_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

const SECTIONS = [
  { id: 'overview', label: 'Обзор', Icon: ChartBarIcon },
  { id: 'users', label: 'Пользователи', Icon: UsersIcon },
  { id: 'billing', label: 'Тарифы', Icon: CreditCardIcon },
  { id: 'ai-agent', label: 'AI Агент', Icon: SparklesIcon },
  { id: 'ai-scenarios', label: 'Сценарии AI', Icon: CpuChipIcon },
  { id: 'hero-demo', label: 'Демо главной', Icon: PresentationChartBarIcon },
  { id: 'databridge', label: 'DataBridge', Icon: CircleStackIcon },
  { id: 'connections', label: 'Соединения', Icon: LinkIcon },
];

export default function AdminPanel({ activeTab }) {
  const { user: currentUser } = useAuth();
  const [section, setSection] = useState('overview');
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('day');
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);

  useEffect(() => {
    if (activeTab !== 'admin') return;
    if (section !== 'overview') return;
    loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, activeTab, section]);

  useEffect(() => {
    if (activeTab !== 'admin') return;
    if (section === 'users') {
      setIsUsersModalOpen(true);
    } else if (isUsersModalOpen) {
      setIsUsersModalOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, activeTab]);

  const loadStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getStatistics(period);
      setStatistics(data);
    } catch (err) {
      console.error('Error fetching admin statistics:', err);
      setError('Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  const openUsers = () => {
    setSection('users');
    setIsUsersModalOpen(true);
  };

  const closeUsersModal = () => {
    setIsUsersModalOpen(false);
    if (section === 'users') setSection('overview');
  };

  if (activeTab !== 'admin') return null;
  if (!isPlatformAdmin(currentUser)) return null;

  const periodLabel = period === 'day' ? 'день' : period === 'month' ? 'месяц' : 'год';
  const aiConfigUrl = import.meta.env.VITE_AI_CONFIG_PANEL_URL || 'http://localhost:3010';

  const renderOverview = () => {
    if (loading) {
      return (
        <div className={styles.skeleton}>
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonGrid}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.errorBox}>
          <AdminIcon name="error" size="md" />
          <span>{error}</span>
          <button type="button" className={styles.retryBtn} onClick={loadStatistics}>
            Повторить
          </button>
        </div>
      );
    }

    return (
      <div className={styles.panelInner}>
        <div className={styles.periodBar}>
          <p className={styles.periodLabel}>Период статистики регистраций</p>
          <div className={styles.periodGroup} role="group" aria-label="Период">
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.periodBtn} ${period === value ? styles.periodBtnActive : ''}`}
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.regCard}>
            <p className={styles.regEyebrow}>Регистрации</p>
            <p className={styles.regValue}>{statistics?.users_registered || 0}</p>
            <p className={styles.regHint}>За {periodLabel}</p>
          </div>

          <div className={styles.statCards}>
            {STAT_CARDS.map((card) => {
              const Tag = card.clickable ? 'button' : 'div';
              return (
                <Tag
                  key={card.key}
                  type={card.clickable ? 'button' : undefined}
                  className={`${styles.statCard} ${card.clickable ? styles.statCardClickable : ''}`}
                  onClick={card.clickable ? openUsers : undefined}
                >
                  <AdminIcon name={card.icon} boxed boxColor={card.color} />
                  <p className={`${styles.statValue} ${card.accent}`}>
                    {statistics?.[card.key] || 0}
                  </p>
                  <p className={styles.statLabel}>{card.label}</p>
                  {card.clickable ? (
                    <p className={styles.statHint}>Открыть управление →</p>
                  ) : null}
                </Tag>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return renderOverview();
      case 'users':
        return (
          <div className={styles.usersPrompt}>
            <h3 className={styles.usersPromptTitle}>Управление пользователями</h3>
            <p className={styles.usersPromptText}>
              Блокировка, роли, сброс пароля и экспорт списка пользователей платформы.
            </p>
            <button type="button" className={styles.usersPromptBtn} onClick={openUsers}>
              <AdminIcon name="users" size="sm" />
              Открыть таблицу пользователей
            </button>
          </div>
        );
      case 'billing':
        return <AdminBillingPanel />;
      case 'ai-agent':
        return <AdminAiAgentPanel />;
      case 'ai-scenarios':
        return <AdminAiScenariosPanel />;
      case 'hero-demo':
        return <AdminHeroDemoPanel />;
      case 'databridge':
        return <AdminDataBridgePanel />;
      case 'connections':
        return <Connections activeTab={activeTab} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon} aria-hidden>
            <AdminIcon name="chartBar" size="lg" />
          </div>
          <div>
            <p className={styles.eyebrow}>Platform control</p>
            <h2 className={styles.title}>Панель администратора</h2>
            <p className={styles.subtitle}>
              Аналитика, пользователи и настройки платформы — переключайте вкладки ниже.
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <a
            href={aiConfigUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.aiConfigLink}
          >
            AI Config
            <AdminIcon name="externalLink" size="sm" />
          </a>
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Разделы админ-панели">
        {SECTIONS.map(({ id, label, Icon }) => {
          const isActive = section === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => setSection(id)}
            >
              <Icon className={styles.tabIcon} aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className={styles.panel} role="tabpanel" key={section}>
        {renderSection()}
      </div>

      <UsersTableModal
        isOpen={isUsersModalOpen}
        onClose={closeUsersModal}
        currentUser={currentUser}
      />
    </div>
  );
}
