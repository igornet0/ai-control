const KEYS = {
  audioInputId: 'aicontrol.call.audioInputId',
  videoInputId: 'aicontrol.call.videoInputId',
  audioOutputId: 'aicontrol.call.audioOutputId',
  micGain: 'aicontrol.call.micGain',
  outputVolume: 'aicontrol.call.outputVolume',
};

export const MIC_GAIN_MIN = 0.1;
export const MIC_GAIN_MAX = 2;
export const OUTPUT_VOLUME_MIN = 0;
export const OUTPUT_VOLUME_MAX = 2;

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function loadCallMediaPrefs() {
  if (typeof localStorage === 'undefined') {
    return {
      audioInputId: '',
      videoInputId: '',
      audioOutputId: '',
      micGain: 1,
      outputVolume: 1,
    };
  }
  return {
    audioInputId: localStorage.getItem(KEYS.audioInputId) || '',
    videoInputId: localStorage.getItem(KEYS.videoInputId) || '',
    audioOutputId: localStorage.getItem(KEYS.audioOutputId) || '',
    micGain: clamp(localStorage.getItem(KEYS.micGain), MIC_GAIN_MIN, MIC_GAIN_MAX, 1),
    outputVolume: clamp(
      localStorage.getItem(KEYS.outputVolume),
      OUTPUT_VOLUME_MIN,
      OUTPUT_VOLUME_MAX,
      1
    ),
  };
}

export function saveCallMediaPref(key, value) {
  if (typeof localStorage === 'undefined' || !KEYS[key]) return;
  if (value == null || value === '') {
    localStorage.removeItem(KEYS[key]);
    return;
  }
  localStorage.setItem(KEYS[key], String(value));
}

export async function listCallMediaDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { audioInputs: [], videoInputs: [], audioOutputs: [] };
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  const label = (d, fallback) => d.label || fallback;
  return {
    audioInputs: all
      .filter((d) => d.kind === 'audioinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: label(d, `Микрофон ${i + 1}`) })),
    videoInputs: all
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: label(d, `Камера ${i + 1}`) })),
    audioOutputs: all
      .filter((d) => d.kind === 'audiooutput')
      .map((d, i) => ({ deviceId: d.deviceId, label: label(d, `Динамики ${i + 1}`) })),
  };
}

export function buildAudioConstraints(deviceId) {
  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (deviceId) audio.deviceId = { ideal: deviceId };
  return audio;
}

export function buildVideoConstraints(deviceId) {
  const video = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
  if (deviceId) video.deviceId = { ideal: deviceId };
  // Do not set facingMode: 'user' — on Windows Chrome it throws
  // NotFoundError ("Requested device not found") for regular webcams.
  return video;
}

export function isRecoverableMediaError(err) {
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  return (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'NotReadableError' ||
    name === 'AbortError' ||
    /requested device not found/i.test(msg) ||
    /could not start video source/i.test(msg) ||
    /could not start audio source/i.test(msg)
  );
}

export function mediaErrorMessage(err) {
  const name = String(err?.name || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Нет доступа к камере или микрофону. Разрешите устройства в браузере и повторите звонок.';
  }
  if (isRecoverableMediaError(err)) {
    return 'Камера или микрофон не найдены. Проверьте, что устройства подключены и не заняты другой программой.';
  }
  return err?.message || 'Не удалось получить доступ к камере или микрофону';
}

/**
 * Try several getUserMedia constraint sets so a missing camera does not
 * block the whole call (Chrome fails the entire request if video is absent).
 */
export function callMediaConstraintAttempts(audioInputId = '', videoInputId = '') {
  const attempts = [
    { audio: buildAudioConstraints(audioInputId), video: buildVideoConstraints(videoInputId) },
  ];
  if (audioInputId || videoInputId) {
    attempts.push({ audio: buildAudioConstraints(''), video: buildVideoConstraints('') });
  }
  attempts.push({ audio: buildAudioConstraints(audioInputId || ''), video: true });
  attempts.push({ audio: true, video: true });
  attempts.push({ audio: buildAudioConstraints(audioInputId || ''), video: false });
  if (audioInputId) {
    attempts.push({ audio: true, video: false });
  }
  attempts.push({ audio: false, video: buildVideoConstraints(videoInputId || '') });
  if (videoInputId) {
    attempts.push({ audio: false, video: true });
  }
  return attempts;
}

export async function acquireCallMedia({ audioInputId = '', videoInputId = '' } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Браузер не поддерживает доступ к камере и микрофону');
  }
  let lastError;
  for (const constraints of callMediaConstraintAttempts(audioInputId, videoInputId)) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        throw err;
      }
    }
  }
  throw lastError || new Error('Requested device not found');
}
