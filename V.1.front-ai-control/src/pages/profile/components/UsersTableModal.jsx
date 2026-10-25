import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { TrashIcon, KeyIcon } from '@heroicons/react/24/outline';
import { adminService } from '../../../services/adminService';
import { TEAM_ROLES } from '../../../services/employeeService';
import { buildPasswordResetInviteUrl } from '../../../services/inviteService';
import { formatApiError } from '../../../utils/formatApiError';
import { AdminIcon } from './AdminIcons';
import styles from './UsersTableModal.module.css';

// Системная роль admin (root) назначается только из CLI / при инициализации платформы — здесь только TeamRole.
const isSystemAdmin = (user) => user?.role === 'admin' || user?.is_superuser;

export default function UsersTableModal({ isOpen, onClose, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [resetInviteUrl, setResetInviteUrl] = useState('');
  const [resetInviteUser, setResetInviteUser] = useState(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!isOpen) return undefined;
    loadUsers();
    setResetInviteUrl('');
    setResetInviteUser(null);
    setResetCopied(false);
    setQuery('');
    setStatusFilter('all');

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
    // Intentionally only re-run when modal opens/closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter === 'active' && !user.is_active) return false;
      if (statusFilter === 'blocked' && user.is_active) return false;
      if (!q) return true;
      const hay = `${user.id} ${user.login || ''} ${user.name || ''} ${user.email || ''} ${user.team_role || ''} ${isSystemAdmin(user) ? 'admin' : ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [users, query, statusFilter]);

  const handleCreatePasswordResetInvite = async (user) => {
    if (!user?.is_active) {
      alert('Нельзя создать ссылку для заблокированного пользователя');
      return;
    }
    if (!window.confirm(`Создать ссылку для сброса пароля «${user.name || user.login}»?`)) {
      return;
    }
    setActionLoading(user.id);
    setResetCopied(false);
    try {
      const created = await adminService.createPasswordResetInvite(user.id);
      const url = buildPasswordResetInviteUrl(created.token) || created.invite_url;
      setResetInviteUrl(url);
      setResetInviteUser(user);
    } catch (err) {
      console.error('Error creating password reset invite:', err);
      alert(formatApiError(err, 'Не удалось создать ссылку для сброса пароля'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyResetUrl = async () => {
    if (!resetInviteUrl) return;
    try {
      await navigator.clipboard.writeText(resetInviteUrl);
      setResetCopied(true);
    } catch {
      window.prompt('Скопируйте ссылку', resetInviteUrl);
    }
  };

  const handleBlock = async (userId) => {
    if (!window.confirm('Заблокировать этого пользователя?')) return;
    setActionLoading(userId);
    try {
      await adminService.blockUser(userId);
      await loadUsers();
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('Ошибка при блокировке пользователя');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (userId) => {
    setActionLoading(userId);
    try {
      await adminService.unblockUser(userId);
      await loadUsers();
    } catch (err) {
      console.error('Error unblocking user:', err);
      alert('Ошибка при разблокировке пользователя');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestrict = async (userId, newRole) => {
    const user = users.find((u) => u.id === userId);
    if (!user || (user.team_role || 'Guest') === newRole) return;

    if (currentUser && currentUser.id === userId) {
      alert('Вы не можете изменить свою собственную роль');
      await loadUsers();
      return;
    }

    if (!window.confirm(`Изменить роль «${user.name || user.login}» на «${newRole}»?`)) {
      await loadUsers();
      return;
    }

    setActionLoading(userId);
    try {
      await adminService.restrictUser(userId, { team_role: newRole });
      await loadUsers();
    } catch (err) {
      console.error('Error restricting user:', err);
      alert(err.response?.data?.detail || err.message || 'Ошибка при изменении роли');
      await loadUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Удалить пользователя? Это необратимо.')) return;
    setActionLoading(userId);
    try {
      await adminService.deleteUser(userId);
      await loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Ошибка при удалении пользователя');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      await adminService.exportUsers();
    } catch (err) {
      console.error('Error exporting users:', err);
      alert('Ошибка при экспорте пользователей');
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="users-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <AdminIcon name="users" boxed boxColor="blue" />
            <div className={styles.titleWrap}>
              <h2 id="users-modal-title" className={styles.title}>
                Пользователи
              </h2>
              <p className={styles.subtitle}>
                {loading ? 'Загрузка…' : `${filteredUsers.length} из ${users.length}`}
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleExport}>
              <AdminIcon name="export" size="sm" />
              CSV
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnIcon}`}
              onClick={onClose}
              aria-label="Закрыть"
            >
              <AdminIcon name="close" size="md" />
            </button>
          </div>
        </div>

        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: логин, имя, email, id…"
            autoFocus
          />
          <select
            className={styles.filter}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Фильтр статуса"
          >
            <option value="all">Все статусы</option>
            <option value="active">Активные</option>
            <option value="blocked">Заблокированные</option>
          </select>
        </div>

        <div className={styles.body}>
          {resetInviteUrl ? (
            <div className={styles.banner}>
              <p className={styles.bannerText}>
                Ссылка сброса пароля
                {resetInviteUser ? ` · ${resetInviteUser.name || resetInviteUser.login}` : ''}
              </p>
              <div className={styles.bannerRow}>
                <input readOnly className={styles.bannerInput} value={resetInviteUrl} />
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCopyResetUrl}>
                  {resetCopied ? 'OK' : 'Копировать'}
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost}`}
                  onClick={() => {
                    setResetInviteUrl('');
                    setResetInviteUser(null);
                    setResetCopied(false);
                  }}
                >
                  Скрыть
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className={styles.state}>Загрузка пользователей…</div>
          ) : error ? (
            <div className={`${styles.state} ${styles.error}`}>{error}</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Пользователь</th>
                    <th className={styles.emailCell}>Email</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th className={styles.balanceCol}>Баланс</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.empty}>
                        Ничего не найдено
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const busy = actionLoading === user.id;
                      const isSelf = currentUser && currentUser.id === user.id;
                      return (
                        <tr key={user.id}>
                          <td className={styles.idCell}>{user.id}</td>
                          <td className={styles.userCell}>
                            <span className={styles.userLogin}>{user.login}</span>
                            <span className={styles.userName}>{user.name}</span>
                          </td>
                          <td className={styles.emailCell} title={user.email}>
                            {user.email}
                          </td>
                          <td>
                            <div className={styles.roleCell}>
                              <select
                                className={styles.roleSelect}
                                value={user.team_role || 'Guest'}
                                onChange={(e) => handleRestrict(user.id, e.target.value)}
                                disabled={busy || isSelf}
                                title={isSelf ? 'Нельзя менять свою роль' : ''}
                              >
                                {TEAM_ROLES.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                              {isSystemAdmin(user) ? (
                                <span className={`${styles.badge} ${styles.badgeAdmin}`} title="Root-доступ (назначается только из CLI)">
                                  Админ
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${user.is_active ? styles.badgeOn : styles.badgeOff}`}>
                              {user.is_active ? 'Активен' : 'Блок'}
                            </span>
                          </td>
                          <td className={`${styles.balance} ${styles.balanceCol}`}>
                            {Number(user.balance || 0).toFixed(2)}
                          </td>
                          <td>
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionReset}`}
                                onClick={() => handleCreatePasswordResetInvite(user)}
                                disabled={busy || !user.is_active}
                                title="Сброс пароля"
                              >
                                <KeyIcon className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {user.is_active ? (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.actionLock}`}
                                  onClick={() => handleBlock(user.id)}
                                  disabled={busy}
                                  title="Заблокировать"
                                >
                                  <AdminIcon name="lock" size="sm" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.actionUnlock}`}
                                  onClick={() => handleUnblock(user.id)}
                                  disabled={busy}
                                  title="Разблокировать"
                                >
                                  <AdminIcon name="lockOpen" size="sm" />
                                </button>
                              )}
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionDelete}`}
                                onClick={() => handleDelete(user.id)}
                                disabled={busy}
                                title="Удалить"
                              >
                                <TrashIcon className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
