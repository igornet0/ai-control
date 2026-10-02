const RINGTONE_URL = '/sounds/ringtone.mp3';

let audio = null;
let unlocked = false;
let playing = false;

function getAudio() {
  if (!audio) {
    audio = new Audio(RINGTONE_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.9;
  }
  return audio;
}

/** Call once after a user gesture so later incoming rings are allowed to autoplay. */
export function unlockCallRingtone() {
  if (unlocked || typeof window === 'undefined') return;
  try {
    const a = getAudio();
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      void p
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
          unlocked = true;
        })
        .catch(() => {
          a.muted = false;
        });
    } else {
      a.muted = false;
      unlocked = true;
    }
  } catch {
    /* ignore */
  }
}

export function isCallRingtonePlaying() {
  return playing;
}

export function startCallRingtone() {
  if (typeof window === 'undefined') return;
  try {
    const a = getAudio();
    a.loop = true;
    a.muted = false;
    a.currentTime = 0;
    const p = a.play();
    playing = true;
    if (p && typeof p.catch === 'function') {
      void p.catch(() => {
        // Autoplay blocked — unlock on next gesture then retry once.
        const retry = () => {
          unlockCallRingtone();
          void a.play().then(() => {
            playing = true;
          }).catch(() => {
            playing = false;
          });
          window.removeEventListener('pointerdown', retry);
          window.removeEventListener('keydown', retry);
        };
        window.addEventListener('pointerdown', retry, { once: true });
        window.addEventListener('keydown', retry, { once: true });
        playing = false;
      });
    }
  } catch {
    playing = false;
  }
}

export function stopCallRingtone() {
  playing = false;
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* ignore */
  }
}
