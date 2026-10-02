/** @returns {boolean} */
export function isApplePlatform() {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function macScreenCaptureHelp() {
  return (
    'На macOS: Системные настройки → Конфиденциальность и безопасность → ' +
    'Запись экрана → разрешить браузеру.'
  );
}

const CONSTRAINT_SETS = [
  {
    video: {
      cursor: 'motion',
      frameRate: { ideal: 30, max: 60 },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      monitorTypeSurfaces: 'include',
    },
    audio: false,
  },
  {
    video: { cursor: 'motion', frameRate: { ideal: 30 } },
    audio: false,
  },
  { video: { frameRate: { ideal: 30 } }, audio: false },
  { video: true, audio: false },
];

/**
 * Tries progressively simpler constraint sets for cross-browser compat.
 * @returns {Promise<MediaStream>}
 */
export async function getScreenCaptureStream() {
  let lastErr;
  for (const constraints of CONSTRAINT_SETS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (e) {
      if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Waits 2 rAF + 200ms extra on Apple platforms (avoids capture failure race). */
export function settleAfterDisplayCapture() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const delay = isApplePlatform() ? 200 : 0;
        window.setTimeout(resolve, delay);
      });
    });
  });
}
