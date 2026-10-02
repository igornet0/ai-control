import React, { useEffect, useMemo, useState } from 'react';
import { flowService } from '../../../services/flowService';
import { dashboardLinkService } from '../../../services/dashboardLinkService';
import { messagingService } from '../../../services/messagingService';
import { buildEntityRef } from '../../../services/messagingEntityRefs';
import Avatar from '../../../components/Avatar';
import styles from './ShareLinkModal.module.css';

function toggleId(set, id) {
  const next = new Set(set);
  const key = Number(id);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export default function FlowSessionModal({
  dashboardId,
  dashboardName,
  flowId,
  currentUserId,
  open,
  onClose,
}) {
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [tab, setTab] = useState('users');
  const [query, setQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState(() => new Set());
  const [selectedTeamIds, setSelectedTeamIds] = useState(() => new Set());
  const [selectedDeptIds, setSelectedDeptIds] = useState(() => new Set());
  const [sessionType, setSessionType] = useState('shared');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdUrl, setCreatedUrl] = useState('');
  const [inviteSummary, setInviteSummary] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !flowId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setCreatedUrl('');
    setInviteSummary('');
    setSelectedUserIds(new Set());
    setSelectedTeamIds(new Set());
    setSelectedDeptIds(new Set());
    setQuery('');
    setTab('users');
    flowService
      .getFlowMembers(flowId)
      .then((data) => {
        if (cancelled) return;
        setMembers(Array.isArray(data?.members) ? data.members : []);
        setTeams(Array.isArray(data?.teams) ? data.teams : []);
        setDepartments(Array.isArray(data?.departments) ? data.departments : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.response?.data?.detail || e.message || 'Не удалось загрузить участников');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, flowId]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members || []).filter((m) => {
      if (currentUserId != null && Number(m.id) === Number(currentUserId)) return false;
      if (!q) return true;
      const hay = `${m.name || ''} ${m.login || ''} ${m.email || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, query, currentUserId]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (teams || []).filter((t) => !q || (t.name || '').toLowerCase().includes(q));
  }, [teams, query]);

  const filteredDepartments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (departments || []).filter((d) => !q || (d.name || '').toLowerCase().includes(q));
  }, [departments, query]);

  const inviteeIds = useMemo(() => {
    const ids = new Set();
    selectedUserIds.forEach((id) => ids.add(Number(id)));
    teams.forEach((team) => {
      if (!selectedTeamIds.has(Number(team.id))) return;
      (team.member_ids || []).forEach((id) => ids.add(Number(id)));
    });
    departments.forEach((dept) => {
      if (!selectedDeptIds.has(Number(dept.id))) return;
      (dept.member_ids || []).forEach((id) => ids.add(Number(id)));
    });
    if (currentUserId != null) ids.delete(Number(currentUserId));
    return [...ids].filter((id) => Number.isFinite(id) && id > 0);
  }, [selectedUserIds, selectedTeamIds, selectedDeptIds, teams, departments, currentUserId]);

  if (!open) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const dashTitle = (dashboardName || '').trim() || 'дашборд';

  const handleCreate = async () => {
    if (!inviteeIds.length) {
      setError('Выберите пользователей, команду или отдел');
      return;
    }
    setBusy(true);
    setError('');
    setCreatedUrl('');
    setInviteSummary('');
    try {
      const named = inviteeIds
        .map((id) => members.find((m) => Number(m.id) === Number(id)))
        .filter(Boolean)
        .map((m) => m.name || m.login);
      const label =
        named.length <= 2
          ? `Сессия: ${named.join(', ') || inviteeIds.length}`
          : `Сессия: ${named.slice(0, 2).join(', ')} и ещё ${named.length - 2}`;
      const row = await dashboardLinkService.createLink(dashboardId, {
        permission: 'read',
        session_type: sessionType,
        expires_at: null,
        label,
        flow_id: Number(flowId),
        invite_user_id: inviteeIds[0],
      });
      const sharePath = `/share/${encodeURIComponent(row.token)}`;
      const url = `${origin}${sharePath}`;
      const content = `Приглашает вас на совместный просмотр дашборда «${dashTitle}». Откройте сессию кнопкой ниже.`;
      const entityRef = buildEntityRef('dashboard_share', dashboardId, 'Перейти на дашборд', {
        url: sharePath,
      });
      let invited = 0;
      let failed = 0;
      for (const userId of inviteeIds) {
        try {
          const room = await messagingService.createDirectRoom(userId);
          await messagingService.sendMessage(room.id, content, null, [], [entityRef]);
          invited += 1;
        } catch {
          failed += 1;
        }
      }
      setCreatedUrl(url);
      setInviteSummary(
        failed
          ? `Сессия создана. Приглашения отправлены ${invited} из ${inviteeIds.length} (не удалось: ${failed}).`
          : `Сессия создана. Приглашения отправлены ${invited} участникам в чат.`,
      );
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!createdUrl) return;
    void navigator.clipboard?.writeText(createdUrl);
  };

  const renderUsers = () => {
    if (loading) return <div className={styles.userEmpty}>Загрузка…</div>;
    if (!filteredMembers.length) return <div className={styles.userEmpty}>Нет доступных пользователей</div>;
    return filteredMembers.map((m) => {
      const active = selectedUserIds.has(Number(m.id));
      return (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={active}
          className={`${styles.userRow} ${active ? styles.userRowActive : ''}`}
          onClick={() => setSelectedUserIds((prev) => toggleId(prev, m.id))}
        >
          <span className={styles.userAvatar}>
            <Avatar src={m.avatar} name={m.name || m.login} preset="avatar_sm" size={32} />
          </span>
          <span className={styles.userMeta}>
            <span className={styles.userName}>{m.name || m.login}</span>
            <span className={styles.userSub}>{m.email || m.login}</span>
          </span>
        </button>
      );
    });
  };

  const renderGroups = (items, selected, onToggle, emptyText) => {
    if (loading) return <div className={styles.userEmpty}>Загрузка…</div>;
    if (!items.length) return <div className={styles.userEmpty}>{emptyText}</div>;
    return items.map((item) => {
      const active = selected.has(Number(item.id));
      const count = (item.member_ids || []).filter(
        (id) => currentUserId == null || Number(id) !== Number(currentUserId),
      ).length;
      return (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={active}
          className={`${styles.userRow} ${active ? styles.userRowActive : ''}`}
          onClick={() => onToggle(item.id)}
        >
          <span className={styles.userMeta}>
            <span className={styles.userName}>{item.name}</span>
            <span className={styles.userSub}>{count} участников потока</span>
          </span>
        </button>
      );
    });
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Сессия с участниками потока</h2>
          <p className={styles.subtitle}>
            Выберите пользователей, команду или отдел. Каждому участнику придёт приглашение в чат с кнопкой перехода на дашборд.
          </p>
        </div>

        <div className={styles.tabBar} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            className={`${styles.tab} ${tab === 'users' ? styles.tabActive : ''}`}
            onClick={() => setTab('users')}
          >
            Люди
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'teams'}
            className={`${styles.tab} ${tab === 'teams' ? styles.tabActive : ''}`}
            onClick={() => setTab('teams')}
          >
            Команды
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'departments'}
            className={`${styles.tab} ${tab === 'departments' ? styles.tabActive : ''}`}
            onClick={() => setTab('departments')}
          >
            Отделы
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Поиск</span>
          <input
            className={styles.select}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'users' ? 'Имя, логин или email' : 'Название'}
          />
        </label>

        <div className={styles.userList} role="listbox" aria-multiselectable="true">
          {tab === 'users' && renderUsers()}
          {tab === 'teams' &&
            renderGroups(filteredTeams, selectedTeamIds, (id) => setSelectedTeamIds((prev) => toggleId(prev, id)), 'Нет команд среди участников потока')}
          {tab === 'departments' &&
            renderGroups(
              filteredDepartments,
              selectedDeptIds,
              (id) => setSelectedDeptIds((prev) => toggleId(prev, id)),
              'Нет отделов среди участников потока',
            )}
        </div>

        <p className={styles.inviteCount}>Выбрано участников: {inviteeIds.length}</p>

        <label className={styles.field}>
          <span className={styles.label}>Режим синхронизации</span>
          <select
            className={styles.select}
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
          >
            <option value="shared">Общий (курсоры и фильтры)</option>
            <option value="isolated">Индивидуальный</option>
          </select>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        {(createdUrl || inviteSummary) && (
          <div className={styles.result}>
            {inviteSummary && <div className={styles.resultLabel}>{inviteSummary}</div>}
            {createdUrl && (
              <>
                <code className={styles.code}>{createdUrl}</code>
                <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
                  Копировать ссылку
                </button>
              </>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Закрыть
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={busy || !inviteeIds.length}
          >
            {busy ? 'Создание…' : createdUrl ? 'Создать ещё' : 'Создать сессию'}
          </button>
        </div>
      </div>
    </div>
  );
}
