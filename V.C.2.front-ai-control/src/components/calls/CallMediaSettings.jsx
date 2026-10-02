import React from 'react';
import {
  OUTPUT_VOLUME_MAX,
  OUTPUT_VOLUME_MIN,
} from '../../calls/callMediaPrefs';
import styles from './CallOverlay.module.css';

function DeviceSelect({ id, label, value, options, onChange, emptyLabel }) {
  return (
    <label className={styles.settingsField} htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? (
          <option value="">{emptyLabel}</option>
        ) : (
          <>
            <option value="">По умолчанию</option>
            {options.map((d) => (
              <option key={d.deviceId || 'default'} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </>
        )}
      </select>
    </label>
  );
}

function GainSlider({ id, label, value, min, max, onChange }) {
  const percent = Math.round(value * 100);
  return (
    <label className={styles.settingsField} htmlFor={id}>
      <span>
        {label}
        <em>{percent}%</em>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step="0.05"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function CallMediaSettings({
  mediaDevices,
  audioInputId,
  videoInputId,
  audioOutputId,
  outputVolume,
  onAudioInput,
  onVideoInput,
  onAudioOutput,
  onOutputVolume,
}) {
  return (
    <div className={styles.settingsPanel} role="region" aria-label="Настройки устройств">
      <DeviceSelect
        id="call-video-input"
        label="Камера"
        value={videoInputId}
        options={mediaDevices.videoInputs}
        onChange={onVideoInput}
        emptyLabel="Нет камер"
      />
      <DeviceSelect
        id="call-audio-input"
        label="Микрофон"
        value={audioInputId}
        options={mediaDevices.audioInputs}
        onChange={onAudioInput}
        emptyLabel="Нет микрофонов"
      />
      {mediaDevices.audioOutputs.length > 0 && (
        <DeviceSelect
          id="call-audio-output"
          label="Динамики"
          value={audioOutputId}
          options={mediaDevices.audioOutputs}
          onChange={onAudioOutput}
          emptyLabel="Системные"
        />
      )}
      <GainSlider
        id="call-output-volume"
        label="Громкость выхода"
        value={outputVolume}
        min={OUTPUT_VOLUME_MIN}
        max={OUTPUT_VOLUME_MAX}
        onChange={onOutputVolume}
      />
    </div>
  );
}
