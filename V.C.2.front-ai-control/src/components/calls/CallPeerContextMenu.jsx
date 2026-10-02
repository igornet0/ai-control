import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OUTPUT_VOLUME_MAX, OUTPUT_VOLUME_MIN } from '../../calls/callMediaPrefs';
import styles from './CallOverlay.module.css';

const DEFAULT_PREF = { volume: 1, videoHidden: false };

export function getPeerPref(prefs, peerId) {
  return prefs.get(peerId) || DEFAULT_PREF;
}

export function getEffectivePeerVolume(prefs, peerId, outputVolume) {
  const peerMult = getPeerPref(prefs, peerId).volume;
  return Number(outputVolume) * peerMult;
}

export default function CallPeerContextMenu({
  menu,
  prefs,
  onClose,
  onVolumeChange,
  onToggleVideoHidden,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu, onClose]);

  useEffect(() => {
    if (!menu || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let x = menu.x;
    let y = menu.y;
    if (x + rect.width > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (y + rect.height > window.innerHeight - margin) {
      y = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    if (x !== menu.x || y !== menu.y) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }, [menu]);

  if (!menu || typeof document === 'undefined') return null;

  const pref = getPeerPref(prefs, menu.peerId);
  const volumePct = Math.round(pref.volume * 100);

  return createPortal(
    <div
      ref={menuRef}
      className={styles.peerContextMenu}
      style={{ top: menu.y, left: menu.x }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
      aria-label={`Настройки: ${menu.name}`}
    >
      <div className={styles.peerContextMenuHead}>{menu.name}</div>

      <label className={styles.peerContextMenuField}>
        <span className={styles.peerContextMenuLabel}>Громкость (локально)</span>
        <div className={styles.peerContextMenuSliderRow}>
          <input
            type="range"
            min={OUTPUT_VOLUME_MIN}
            max={OUTPUT_VOLUME_MAX}
            step={0.05}
            value={pref.volume}
            onChange={(e) => onVolumeChange(menu.peerId, Number(e.target.value))}
          />
          <span className={styles.peerContextMenuValue}>{volumePct}%</span>
        </div>
      </label>

      {!menu.isScreenShare && (
        <button
          type="button"
          className={styles.peerContextMenuAction}
          onClick={() => onToggleVideoHidden(menu.peerId)}
        >
          {pref.videoHidden ? 'Показать камеру' : 'Скрыть камеру у себя'}
        </button>
      )}

      {menu.isScreenShare && (
        <button
          type="button"
          className={styles.peerContextMenuAction}
          onClick={() => onToggleVideoHidden(menu.peerId)}
        >
          {pref.videoHidden ? 'Показать экран' : 'Скрыть экран у себя'}
        </button>
      )}

      <button type="button" className={styles.peerContextMenuReset} onClick={() => {
        onVolumeChange(menu.peerId, 1);
        if (pref.videoHidden) onToggleVideoHidden(menu.peerId);
      }}>
        Сбросить
      </button>
    </div>,
    document.body
  );
}
