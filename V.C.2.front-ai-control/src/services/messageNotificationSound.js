const MESSAGE_SOUND_URL = '/sounds/message.mp3';

let audio = null;
let unlocked = false;

function getAudio() {
  if (!audio) {
    audio = new Audio(MESSAGE_SOUND_URL);
    audio.loop = false;
    audio.preload = 'auto';
    audio.volume = 0.85;
  }
  return audio;
}

/** Unlock one-shot message sound after a user gesture (autoplay policy). */
export function unlockMessageSound() {
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

/** Play notification chime once (not looped). */
export function playMessageSound() {
  if (typeof window === 'undefined') return;
  try {
    const a = getAudio();
    a.loop = false;
    a.muted = false;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      void p.catch(() => {
        const retry = () => {
          unlockMessageSound();
          a.currentTime = 0;
          void a.play().catch(() => {});
          window.removeEventListener('pointerdown', retry);
          window.removeEventListener('keydown', retry);
        };
        window.addEventListener('pointerdown', retry, { once: true });
        window.addEventListener('keydown', retry, { once: true });
      });
    }
  } catch {
    /* ignore */
  }
}
