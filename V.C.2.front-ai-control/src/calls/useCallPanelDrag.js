import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'aicontrol.call.panelPos';
const DRAG_THRESHOLD_PX = 4;

function loadStoredPos() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function persistPos(pos) {
  if (typeof sessionStorage === 'undefined' || !pos) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore quota errors */
  }
}

function defaultPos(panelWidth, panelHeight) {
  const margin = 16;
  return {
    x: Math.max(margin, window.innerWidth - panelWidth - margin),
    y: Math.max(margin, window.innerHeight - panelHeight - margin),
  };
}

/**
 * Drag positioning for docked / minimized call panel.
 * @param {{ enabled: boolean, panelRef: React.RefObject<HTMLElement>, panelWidth: number, panelHeight: number }} opts
 */
export function useCallPanelDrag({ enabled, panelRef, panelWidth, panelHeight }) {
  const [pos, setPos] = useState(() => loadStoredPos());
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const movedRef = useRef(false);

  const clampPos = useCallback(
    (x, y, w = panelWidth, h = panelHeight) => {
      const margin = 8;
      const maxX = Math.max(margin, window.innerWidth - w - margin);
      const maxY = Math.max(margin, window.innerHeight - h - margin);
      return {
        x: Math.min(Math.max(margin, x), maxX),
        y: Math.min(Math.max(margin, y), maxY),
      };
    },
    [panelWidth, panelHeight]
  );

  const resolvePos = useCallback(() => {
    if (pos) return pos;
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) return clampPos(rect.left, rect.top, rect.width, rect.height);
    return clampPos(defaultPos(panelWidth, panelHeight).x, defaultPos(panelWidth, panelHeight).y);
  }, [pos, panelRef, clampPos, panelWidth, panelHeight]);

  const startDrag = useCallback(
    (e) => {
      if (!enabled || e.button !== 0) return;
      if (e.target?.closest?.('button')) return;
      e.preventDefault();
      const current = resolvePos();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: current.x,
        originY: current.y,
      };
      movedRef.current = false;
      setDragging(true);
    },
    [enabled, resolvePos]
  );

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        movedRef.current = true;
      }
      setPos(clampPos(drag.originX + dx, drag.originY + dy));
    };

    const onUp = () => {
      setDragging(false);
      dragRef.current = null;
      setPos((current) => {
        if (!current) return current;
        const next = clampPos(current.x, current.y);
        persistPos(next);
        return next;
      });
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
  }, [dragging, clampPos]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onResize = () => {
      setPos((current) => {
        if (!current) return current;
        return clampPos(current.x, current.y);
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [enabled, clampPos]);

  const consumeDragClick = useCallback(() => {
    if (movedRef.current) {
      movedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const panelStyle =
    enabled && pos
      ? { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto', bottom: 'auto' }
      : undefined;

  return {
    pos,
    panelStyle,
    dragging,
    startDrag,
    consumeDragClick,
  };
}
