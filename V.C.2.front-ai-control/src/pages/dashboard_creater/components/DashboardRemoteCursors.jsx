import React, { useEffect, useState } from 'react';
import { eventBus } from '../src/core/EventBus.js';
import {
  removePresenceCursor,
  upsertPresenceCursor,
} from '../src/presence/dashboardPresence.js';

export default function DashboardRemoteCursors({ engineRef, sheetId }) {
  const [cursors, setCursors] = useState([]);
  const [flashId, setFlashId] = useState(null);

  useEffect(() => {
    let raf = 0;
    const pending = new Map();
    let flashTimer = null;

    const flush = () => {
      raf = 0;
      const engine = engineRef?.current;
      const vc = engine?.viewportController;
      const viewport = vc?.viewport;
      if (!vc || !viewport) {
        setCursors([]);
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const next = [];
      pending.forEach((c) => {
        if (!c?.visible) return;
        if (c.sheetId && sheetId && String(c.sheetId) !== String(sheetId)) return;
        const vp = vc.workspaceToViewport(c.x, c.y);
        if (vp.x < -40 || vp.y < -40 || vp.x > rect.width + 40 || vp.y > rect.height + 40) {
          return;
        }
        next.push({
          clientId: c.clientId,
          name: c.displayName,
          color: c.color,
          x: vp.x,
          y: vp.y,
        });
      });
      setCursors(next);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(flush);
    };

    const onCursor = (data) => {
      if (!data?.clientId) return;
      upsertPresenceCursor(data);
      pending.set(data.clientId, data);
      schedule();
    };
    const onLeave = ({ clientId } = {}) => {
      if (!clientId) return;
      removePresenceCursor(clientId);
      pending.delete(clientId);
      schedule();
    };
    const onViewport = () => schedule();
    const onFocus = ({ clientId } = {}) => {
      if (!clientId) return;
      setFlashId(String(clientId));
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => setFlashId(null), 1200);
      schedule();
    };

    eventBus.on('presence:cursor', onCursor);
    eventBus.on('presence:leave', onLeave);
    eventBus.on('presence:focus', onFocus);
    eventBus.on('viewport:pan', onViewport);
    eventBus.on('viewport:zoom', onViewport);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (flashTimer) clearTimeout(flashTimer);
      eventBus.off('presence:cursor', onCursor);
      eventBus.off('presence:leave', onLeave);
      eventBus.off('presence:focus', onFocus);
      eventBus.off('viewport:pan', onViewport);
      eventBus.off('viewport:zoom', onViewport);
    };
  }, [engineRef, sheetId]);

  if (!cursors.length) return null;

  return (
    <div className="presence-cursors" aria-hidden="true">
      {cursors.map((c) => (
        <div
          key={c.clientId}
          className={`presence-cursor${flashId === c.clientId ? ' presence-cursor--flash' : ''}`}
          style={{ transform: `translate(${c.x}px, ${c.y}px)`, color: c.color }}
        >
          <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
            <path
              d="M1 1.5L16.5 10.2L9.4 12.1L7.2 20.5L1 1.5Z"
              fill="currentColor"
              stroke="#0E0E11"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="presence-cursor-label" style={{ background: c.color }}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  );
}
