import { useCallback, useEffect, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readStored(key, fallback, min, max) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (!Number.isNaN(parsed)) return clamp(parsed, min, max);
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function usePanelResize({
  leftDefault = 240,
  rightDefault = 320,
  leftMin = 180,
  leftMax = 420,
  rightMin = 260,
  rightMax = 560,
  leftStorageKey = 'datamodel-workspace-left-panel',
  rightStorageKey = 'datamodel-workspace-right-panel',
} = {}) {
  const [leftWidth, setLeftWidth] = useState(() =>
    readStored(leftStorageKey, leftDefault, leftMin, leftMax)
  );
  const [rightWidth, setRightWidth] = useState(() =>
    readStored(rightStorageKey, rightDefault, rightMin, rightMax)
  );
  const [resizing, setResizing] = useState(null);

  const persist = useCallback((key, value) => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const startResizeLeft = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = leftWidth;
      setResizing('left');

      const onMove = (ev) => {
        setLeftWidth(clamp(startW + (ev.clientX - startX), leftMin, leftMax));
      };

      const onUp = () => {
        setResizing(null);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setLeftWidth((w) => {
          persist(leftStorageKey, w);
          return w;
        });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [leftWidth, leftMin, leftMax, leftStorageKey, persist]
  );

  const startResizeRight = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = rightWidth;
      setResizing('right');

      const onMove = (ev) => {
        setRightWidth(clamp(startW + (startX - ev.clientX), rightMin, rightMax));
      };

      const onUp = () => {
        setResizing(null);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setRightWidth((w) => {
          persist(rightStorageKey, w);
          return w;
        });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [rightWidth, rightMin, rightMax, rightStorageKey, persist]
  );

  useEffect(() => {
    if (!resizing) return undefined;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  return {
    leftWidth,
    rightWidth,
    startResizeLeft,
    startResizeRight,
    resizing,
  };
}
