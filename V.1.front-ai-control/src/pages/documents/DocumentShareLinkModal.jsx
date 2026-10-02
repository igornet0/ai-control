import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { documentLinkService } from '../../services/documentLinkService';
import { employeeService } from '../../services/employeeService';
import { messagingService } from '../../services/messagingService';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { getInitials } from '../../utils/getAvatarUrl';
import { buildEntityRef } from '../../services/messagingEntityRefs';
import styles from '../dashboard/components/ShareLinkModal.module.css';

function normalizeEmployees(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function getDirectPeerId(room, currentUserId) {
  if (room?.peer?.id) return room.peer.id;
  if (room?.room_type !== 'direct' || !room?.slug) return null;
  const match = String(room.slug).match(/^direct:(\d+)-(\d+)$/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === currentUserId) return b;
  if (b === currentUserId) return a;
  return null;
}

function getRoomDisplayName(room, currentUser) {
  if (room?.room_type !== 'direct') return room?.name || `Чат #${room?.id ?? '?'}`;
  if (room?.peer?.name) return room.peer.name;
  const parts = String(room?.name || '')
    .split('↔')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 2 && currentUser?.name) {
    return parts.find((part) => part !== currentUser.name) || parts[0];
  }
  return parts[0] || room?.name || `Чат #${room?.id ?? '?'}`;
}

function buildShareInvite(documentTitle) {
  const title = String(documentTitle || 'Документ').trim() || 'Документ';
  return `Приглашает вас к документу «${title}». Откройте по кнопке ниже.`;
}

function toSharePath(fullOrPath) {
  const raw = String(fullOrPath || '').trim();
  if (!raw) return '';
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return new URL(raw).pathname + new URL(raw).search;
    }
  } catch {
    // keep as-is
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

/**
 * @param {{
 *   documentId: number | string,
 *   documentTitle?: string,
 *   open: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function DocumentShareLinkModal({ documentId, documentTitle = '', open, onClose }) {
  const { user } = useAuth();
  const [permission, setPermission] = useState('read');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sendTab, setSendTab] = useState('employee'); // employee | chat
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!open) {
      setPermission('read');
      setBusy(false);
      setSending(false);
      setCreatedUrl('');
      setError('');
      setSuccess('');
      setSendTab('employee');
      setSearch('');
      setEmployees([]);
      setRooms([]);
      setSelectedEmployeeId(null);
      setSelectedRoomId(null);
    }
  }, [open]);

  const loadTargets = useCallback(async () => {
    if (!open) return;
    setLoadingTargets(true);
    try {
      const [empData, roomData] = await Promise.all([
        employeeService.getChatDirectory({
          search: search.trim() || undefined,
        }).catch(() => []),
        messagingService.getRooms().catch(() => []),
      ]);
      setEmployees(normalizeEmployees(empData));
      setRooms(Array.isArray(roomData) ? roomData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTargets(false);
    }
  }, [open, search]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      void loadTargets();
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, search, loadTargets]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (Number(employee.id) === Number(user?.id)) return false;
      if (!query) return true;
      const haystack = [employee.name, employee.email, employee.team_role, employee.login]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, search, user?.id]);

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (room.room_type === 'notification') return false;
      const label = getRoomDisplayName(room, user).toLowerCase();
      if (!query) return true;
      return label.includes(query) || String(room.name || '').toLowerCase().includes(query);
    });
  }, [rooms, search, user]);

  const ensureShareUrl = async () => {
    if (createdUrl) return createdUrl;
    const row = await documentLinkService.createLink(documentId, {
      permission,
      expires_at: null,
      label: null,
    });
    const url = `${origin}/documents/share/${encodeURIComponent(row.token)}`;
    setCreatedUrl(url);
    return url;
  };

  const handleCreate = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const row = await documentLinkService.createLink(documentId, {
        permission,
        expires_at: null,
        label: null,
      });
      const url = `${origin}/documents/share/${encodeURIComponent(row.token)}`;
      setCreatedUrl(url);
      setSuccess('Ссылка создана');
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Ошибка создания ссылки');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!createdUrl) return;
    void navigator.clipboard?.writeText(createdUrl);
    setSuccess('Ссылка скопирована');
  };

  const sendToRoom = async (roomId, fullUrl) => {
    const sharePath = toSharePath(fullUrl);
    const content = buildShareInvite(documentTitle);
    const entityRef = buildEntityRef(
      'document',
      documentId,
      'Открыть документ',
      { url: sharePath },
    );
    await messagingService.sendMessage(roomId, content, null, [], [entityRef]);
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const url = await ensureShareUrl();
      if (sendTab === 'employee') {
        if (!selectedEmployeeId) {
          setError('Выберите сотрудника');
          return;
        }
        const existing = rooms.find(
          (room) =>
            room.room_type === 'direct'
            && Number(getDirectPeerId(room, user?.id)) === Number(selectedEmployeeId),
        );
        const room = existing || (await messagingService.createDirectRoom(selectedEmployeeId));
        await sendToRoom(room.id, url);
        setSuccess('Ссылка отправлена сотруднику в чат');
      } else {
        if (!selectedRoomId) {
          setError('Выберите чат');
          return;
        }
        await sendToRoom(selectedRoomId, url);
        setSuccess('Ссылка отправлена в чат');
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.detail || e.message || 'Не удалось отправить ссылку');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const canSend = sendTab === 'employee' ? Boolean(selectedEmployeeId) : Boolean(selectedRoomId);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Ссылка на документ</h2>
          <p className={styles.subtitle}>
            Доступ только для авторизованных пользователей с валидной ссылкой.
            Можно скопировать ссылку или сразу отправить её сотруднику / в чат.
          </p>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Права</span>
          <select
            className={`form-select ${styles.select}`}
            value={permission}
            onChange={(e) => {
              setPermission(e.target.value);
              setCreatedUrl('');
              setSuccess('');
            }}
            disabled={busy || sending}
          >
            <option value="read">Только просмотр</option>
            <option value="edit">Предложение изменений</option>
          </select>
        </label>

        {error && <p className={styles.error}>{error}</p>}
        {success && !error && <p className={styles.success}>{success}</p>}

        {createdUrl && (
          <div className={styles.result}>
            <div className={styles.resultLabel}>Ссылка:</div>
            <code className={styles.code}>{createdUrl}</code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              Копировать
            </button>
          </div>
        )}

        <div className={styles.sendSection}>
          <div className={styles.label}>Отправить ссылку</div>
          <div className={styles.tabBar} role="tablist" aria-label="Куда отправить">
            <button
              type="button"
              role="tab"
              aria-selected={sendTab === 'employee'}
              className={`${styles.tab} ${sendTab === 'employee' ? styles.tabActive : ''}`}
              onClick={() => {
                setSendTab('employee');
                setSelectedRoomId(null);
              }}
            >
              Сотрудник
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sendTab === 'chat'}
              className={`${styles.tab} ${sendTab === 'chat' ? styles.tabActive : ''}`}
              onClick={() => {
                setSendTab('chat');
                setSelectedEmployeeId(null);
              }}
            >
              Чат
            </button>
          </div>

          <input
            type="search"
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={sendTab === 'employee' ? 'Поиск сотрудника…' : 'Поиск чата…'}
            disabled={busy || sending}
          />

          <div className={styles.userList}>
            {loadingTargets && (
              <div className={styles.userEmpty}>Загрузка…</div>
            )}
            {!loadingTargets && sendTab === 'employee' && filteredEmployees.length === 0 && (
              <div className={styles.userEmpty}>Сотрудники не найдены</div>
            )}
            {!loadingTargets && sendTab === 'chat' && filteredRooms.length === 0 && (
              <div className={styles.userEmpty}>Чаты не найдены</div>
            )}

            {!loadingTargets && sendTab === 'employee' && filteredEmployees.map((employee) => {
              const active = Number(selectedEmployeeId) === Number(employee.id);
              return (
                <button
                  key={employee.id}
                  type="button"
                  className={`${styles.userRow} ${active ? styles.userRowActive : ''}`}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                >
                  <span className={styles.userAvatar}>
                    <Avatar src={employee.avatar} name={employee.name} preset="avatar_sm" size={32} />
                  </span>
                  <span className={styles.userMeta}>
                    <span className={styles.userName}>{employee.name || employee.login || `User #${employee.id}`}</span>
                    <span className={styles.userSub}>
                      {[employee.email, employee.team_role].filter(Boolean).join(' · ') || 'Сотрудник'}
                    </span>
                  </span>
                </button>
              );
            })}

            {!loadingTargets && sendTab === 'chat' && filteredRooms.map((room) => {
              const active = Number(selectedRoomId) === Number(room.id);
              const label = getRoomDisplayName(room, user);
              const kind = room.room_type === 'direct' ? 'Личный чат' : 'Группа';
              return (
                <button
                  key={room.id}
                  type="button"
                  className={`${styles.userRow} ${active ? styles.userRowActive : ''}`}
                  onClick={() => setSelectedRoomId(room.id)}
                >
                  <span className={styles.userAvatar}>{getInitials(label)}</span>
                  <span className={styles.userMeta}>
                    <span className={styles.userName}>{label}</span>
                    <span className={styles.userSub}>{kind}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy || sending}>
            Закрыть
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleCreate} disabled={busy || sending}>
            {busy ? 'Создание…' : createdUrl ? 'Создать ещё' : 'Создать ссылку'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSend()}
            disabled={busy || sending || !canSend}
          >
            {sending ? 'Отправка…' : createdUrl ? 'Отправить' : 'Создать и отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}
