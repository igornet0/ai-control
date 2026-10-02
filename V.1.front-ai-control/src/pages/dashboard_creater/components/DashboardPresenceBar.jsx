import React, { useMemo, useState } from 'react';
import Avatar from '../../../components/Avatar.jsx';
import { getInitials } from '../../../utils/getAvatarUrl.js';
import { eventBus } from '../src/core/EventBus.js';
import {
  centerViewportOnCursor,
  getPresenceCursor,
  uniqueEmployees,
} from '../src/presence/dashboardPresence.js';

function PresenceAvatar({ peer, size = 28 }) {
  const initials = getInitials(peer.displayName);
  return (
    <span
      className="presence-avatar"
      style={{
        width: size,
        height: size,
        borderColor: peer.color,
        boxShadow: `0 0 0 1px ${peer.color}55`,
      }}
      title={peer.displayName}
    >
      <Avatar
        src={peer.avatar}
        name={peer.displayName}
        preset="avatar_xs"
        size={size}
        fallback={
          <span className="presence-avatar-initials" style={{ background: peer.color }}>
            {initials}
          </span>
        }
      />
    </span>
  );
}

export default function DashboardPresenceBar({ peers, selfClientId, engineRef, sheetId }) {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState('');
  const others = useMemo(() => uniqueEmployees(peers || []), [peers]);

  if (others.length === 0) return null;

  const shown = others.slice(0, 4);
  const extra = others.length - shown.length;

  const followPeer = (peer) => {
    if (!peer || peer.clientId === selfClientId) return;
    const engine = engineRef?.current;
    const result = centerViewportOnCursor(engine, peer.clientId, sheetId);
    if (result.ok) {
      setHint('');
      eventBus.emit('presence:focus', { clientId: peer.clientId });
      return;
    }
    if (result.reason === 'other-sheet') {
      setHint('Участник на другом листе');
    } else if (!getPresenceCursor(peer.clientId)) {
      setHint('Курсор ещё не получен');
    } else {
      setHint('Не удалось перейти к курсору');
    }
  };

  return (
    <div
      className="toolbar-presence"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        setOpen(false);
        setHint('');
      }}
    >
      <button
        type="button"
        className="presence-stack"
        aria-label="Подключённые сотрудники"
        aria-expanded={open}
      >
        {shown.map((p) => (
          <PresenceAvatar key={p.clientId} peer={p} />
        ))}
        {extra > 0 ? <span className="presence-stack-extra">+{extra}</span> : null}
      </button>
      {open ? (
        <div className="presence-popover" role="list">
          {others.map((p) => {
            const isSelf = p.clientId === selfClientId;
            return (
              <button
                key={p.clientId}
                type="button"
                className="presence-popover-row"
                role="listitem"
                disabled={isSelf}
                title={isSelf ? 'Это вы' : 'Перейти к курсору'}
                onClick={() => followPeer(p)}
              >
                <PresenceAvatar peer={p} size={32} />
                <span className="presence-popover-name">
                  {p.displayName}
                  {isSelf ? ' (вы)' : ''}
                </span>
              </button>
            );
          })}
          {hint ? <div className="presence-popover-hint">{hint}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
