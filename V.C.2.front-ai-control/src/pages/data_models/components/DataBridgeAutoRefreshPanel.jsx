import React, { useEffect, useState } from 'react';
import { dataModelService } from '../../../services/dataModelService';
import {
  DATABRIDGE_REFRESH_PRESETS,
  buildProcessingConfigWithDatabridgeRefresh,
  dataModelWidgetsUseDatabridge,
  getDatabridgeAutoRefreshEnabled,
  getDatabridgeRefreshIntervalSec,
} from '../../../utils/dataModelDatabridgeAutoRefresh.js';

function Toggle({ checked, disabled, onChange, label, hint }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-gray-200">{label}</div>
        {hint ? <p className="text-xs text-gray-400 mt-1 max-w-md">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
          checked ? 'bg-blue-500 border-blue-400' : 'bg-gray-600 border-gray-500'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-px ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Settings block for DataBridge-backed models: auto-rebuild when platform data changes.
 * Renders nothing if the model has no DataBridge data-source widget.
 */
const DataBridgeAutoRefreshPanel = ({ modelId, model, isOwner, onModelChange }) => {
  const [checking, setChecking] = useState(true);
  const [usesDatabridge, setUsesDatabridge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const enabled = getDatabridgeAutoRefreshEnabled(model);
  const intervalSec = getDatabridgeRefreshIntervalSec(model);

  useEffect(() => {
    if (!modelId) {
      setChecking(false);
      setUsesDatabridge(false);
      return undefined;
    }
    let cancelled = false;
    setChecking(true);
    dataModelService.getDataModelWidgets(modelId)
      .then((widgets) => {
        if (cancelled) return;
        setUsesDatabridge(dataModelWidgetsUseDatabridge(widgets));
      })
      .catch(() => {
        if (!cancelled) setUsesDatabridge(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const savePatch = async (patch) => {
    if (!isOwner || saving || !modelId) return;
    setSaving(true);
    setError(null);
    try {
      const processing_config = buildProcessingConfigWithDatabridgeRefresh(model, patch);
      const updated = await dataModelService.updateDataModel(modelId, { processing_config });
      onModelChange?.({
        ...model,
        ...updated,
        processing_config: updated?.processing_config || processing_config,
        is_owner: true,
        can_edit: true,
        can_manage_access: true,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось сохранить настройку');
    } finally {
      setSaving(false);
    }
  };

  if (checking || !usesDatabridge) {
    return null;
  }

  const intervalOptions = DATABRIDGE_REFRESH_PRESETS.some((p) => p.value === intervalSec)
    ? DATABRIDGE_REFRESH_PRESETS
    : [
      ...DATABRIDGE_REFRESH_PRESETS,
      { value: intervalSec, label: `Каждые ${Math.round(intervalSec / 60)} мин` },
    ].sort((a, b) => a.value - b.value);

  return (
    <div className="p-6 border border-gray-600 rounded-lg space-y-5">
      <div>
        <h3 className="text-lg font-semibold">DataBridge — автообновление</h3>
        <p className="text-xs text-gray-400 mt-1 max-w-xl">
          Модель использует DataBridge как источник. При включении платформа будет
          периодически пересобирать модель, чтобы подтянуть изменения сущностей
          (сотрудники, задачи, документы и т.д.).
        </p>
      </div>

      <Toggle
        checked={enabled}
        disabled={!isOwner || saving}
        onChange={(value) => savePatch({ auto_refresh: value })}
        label="Автообновление модели"
        hint="Если выключено, модель обновляется только при ручной компиляции."
      />

      {enabled && (
        <div className="pt-2 border-t border-gray-700">
          <label className="block text-sm font-medium text-gray-200 mb-2" htmlFor="databridge-refresh-interval">
            Интервал пересборки
          </label>
          <select
            id="databridge-refresh-interval"
            className="w-full max-w-sm rounded-md bg-gray-800 border border-gray-600 text-sm text-gray-100 px-3 py-2"
            value={intervalSec}
            disabled={!isOwner || saving}
            onChange={(e) => savePatch({
              auto_refresh: true,
              refresh_interval_sec: Number(e.target.value),
            })}
          >
            {intervalOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-2 max-w-md">
            Как часто проверять изменения в DataBridge и пересобирать модель.
          </p>
        </div>
      )}

      {!isOwner && (
        <p className="text-sm text-gray-400">
          Изменять автообновление DataBridge может только владелец модели.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

export default DataBridgeAutoRefreshPanel;
