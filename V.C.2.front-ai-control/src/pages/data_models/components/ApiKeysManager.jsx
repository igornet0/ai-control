import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { apiKeyService } from '../../../services/apiKeyService';
import { buildDeveloperDocsUrl } from '../workspace/apiIngestSourceUtils.js';

const ACCESS_LEVELS = [
  { value: 'read', label: 'Только чтение', description: 'Статус ingest, без загрузки данных' },
  { value: 'ingest', label: 'Загрузка и стриминг', description: 'Чтение + асинхронная загрузка CSV/JSON (snapshot/stream)' },
];

const ACCESS_LEVEL_LABELS = {
  read: 'Только чтение',
  ingest: 'Загрузка и стриминг',
  model_create: 'Создание моделей',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const CreateApiKeyModal = ({ modelId, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [accessLevel, setAccessLevel] = useState('ingest');
  const [rateLimit, setRateLimit] = useState(15);
  const [allowedTables, setAllowedTables] = useState('');
  const [ingestMode, setIngestMode] = useState('snapshot');
  const [upsertKeys, setUpsertKeys] = useState('');
  const [minInterval, setMinInterval] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleDismiss = () => {
    onClose?.();
  };

  const handleCopy = async () => {
    if (!createdKey?.api_key) return;
    try {
      await navigator.clipboard.writeText(createdKey.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Укажите название ключа');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const tables = allowedTables
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        name: name.trim(),
        scope_type: 'model',
        data_model_id: Number(modelId),
        access_level: accessLevel,
        rate_limit_per_min: Number(rateLimit),
        allowed_tables: tables.length > 0 ? tables : null,
      };

      if (accessLevel === 'ingest') {
        payload.ingest_config = {
          mode: ingestMode,
          min_interval_sec: Number(minInterval),
        };
        if (ingestMode === 'stream') {
          const keys = upsertKeys
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean);
          if (!keys.length) {
            setError('Для stream укажите upsert-ключи');
            setSubmitting(false);
            return;
          }
          payload.ingest_config.upsert_keys = keys;
        }
      }

      const created = await apiKeyService.createApiKey(payload);
      setCreatedKey(created);
      onCreated?.(created);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось создать ключ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={createdKey ? undefined : handleDismiss}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gray-600 bg-gray-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-api-key-title"
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h3 id="create-api-key-title" className="text-lg font-semibold flex items-center gap-2">
            <KeyIcon style={{ width: '1.25rem', height: '1.25rem' }} className="text-blue-400" />
            {createdKey ? 'API-ключ создан' : 'Новый API-ключ'}
          </h3>
          {!createdKey && (
            <button type="button" onClick={handleDismiss} className="text-gray-400 hover:text-gray-200">
              <XMarkIcon style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
          )}
        </div>

        {createdKey ? (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-sm font-medium text-amber-300 mb-1">
                Сохраните ключ — он показывается только один раз
              </p>
              <p className="text-xs text-gray-400 mb-3">
                После закрытия окна полный ключ будет недоступен.
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-xs bg-gray-950 px-3 py-2.5 rounded-lg border border-gray-700 break-all text-gray-100 font-mono leading-relaxed">
                  {createdKey.api_key}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 p-2.5 rounded-lg border border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  title={copied ? 'Скопировано' : 'Скопировать ключ'}
                  aria-label={copied ? 'Скопировано' : 'Скопировать ключ'}
                >
                  {copied ? (
                    <CheckIcon style={{ width: '1.125rem', height: '1.125rem' }} className="text-green-400" />
                  ) : (
                    <ClipboardDocumentIcon style={{ width: '1.125rem', height: '1.125rem' }} />
                  )}
                </button>
              </div>
              {copied && (
                <p className="mt-2 text-xs text-green-400">Ключ скопирован в буфер обмена</p>
              )}
            </div>
            <div className="flex justify-end pt-1">
              <button type="button" onClick={handleDismiss} className="btn btn-primary btn-sm">
                Готово
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                {typeof error === 'string' ? error : JSON.stringify(error)}
              </p>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Название</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Python ingest"
                className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
                maxLength={200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Права доступа</label>
              <div className="space-y-2">
                {ACCESS_LEVELS.map((level) => (
                  <label
                    key={level.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      accessLevel === level.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="access_level"
                      value={level.value}
                      checked={accessLevel === level.value}
                      onChange={() => setAccessLevel(level.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">{level.label}</div>
                      <div className="text-xs text-gray-400">{level.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Лимит запросов/мин</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Таблицы (через запятую)</label>
                <input
                  type="text"
                  value={allowedTables}
                  onChange={(e) => setAllowedTables(e.target.value)}
                  placeholder="sales, orders"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {accessLevel === 'ingest' && (
              <div className="p-4 rounded-lg border border-gray-600 space-y-3">
                <p className="text-sm font-medium">Настройки ingest по умолчанию</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Режим</label>
                    <select
                      value={ingestMode}
                      onChange={(e) => setIngestMode(e.target.value)}
                      className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm"
                    >
                      <option value="stream">stream (delta)</option>
                      <option value="snapshot">snapshot (полная замена)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Мин. интервал (сек)</label>
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      value={minInterval}
                      onChange={(e) => setMinInterval(e.target.value)}
                      className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                {ingestMode === 'stream' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Upsert-ключи (через запятую)</label>
                    <input
                      type="text"
                      value={upsertKeys}
                      onChange={(e) => setUpsertKeys(e.target.value)}
                      placeholder="A или id, code"
                      className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={handleDismiss} className="btn btn-secondary btn-sm">
                Отмена
              </button>
              <button type="submit" disabled={submitting} className="btn btn-primary btn-sm">
                {submitting ? 'Создание…' : 'Создать ключ'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const ApiKeysManager = ({ modelId }) => {
  const [keys, setKeys] = useState([]);
  const [devInfo, setDevInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revokingId, setRevokingId] = useState(null);

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [keysData, info] = await Promise.all([
        apiKeyService.listApiKeys(modelId),
        apiKeyService.getDeveloperApiInfo().catch(() => null),
      ]);
      setKeys(keysData);
      setDevInfo(info);
    } catch (err) {
      setError('Не удалось загрузить API-ключи');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    if (modelId) loadKeys();
  }, [modelId, loadKeys]);

  const handleCreated = () => {
    loadKeys();
  };

  const handleRevoke = async (keyId, keyName) => {
    if (!window.confirm(`Отозвать ключ «${keyName}»?`)) return;
    setRevokingId(keyId);
    try {
      await apiKeyService.revokeApiKey(keyId);
      await loadKeys();
    } catch (err) {
      setError('Не удалось отозвать ключ');
      console.error(err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleToggleActive = async (key) => {
    try {
      await apiKeyService.updateApiKey(key.id, { is_active: !key.is_active });
      await loadKeys();
    } catch (err) {
      setError('Не удалось обновить ключ');
      console.error(err);
    }
  };

  const devBase = devInfo?.base_url || 'http://127.0.0.1:8002';
  const ingestCsvExample = `curl -X POST "${devBase}/api/v1/ingest/tables/TABLE_NAME?mode=snapshot" \\
  -H "X-API-Key: aic_YOUR_KEY" \\
  -H "Content-Type: text/csv" \\
  --data-binary @data.csv`;

  const ingestJsonExample = `curl -X POST "${devBase}/api/v1/ingest/tables/TABLE_NAME?mode=snapshot" \\
  -H "X-API-Key: aic_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '[{"id": 1, "name": "example"}]'`;

  const ingestColumnarExample = `curl -X POST "${devBase}/api/v1/ingest/tables/TABLE_NAME?mode=snapshot" \\
  -H "X-API-Key: aic_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"id": [1, 2], "name": ["alpha", "beta"]}'`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <KeyIcon style={{ width: '1.25rem', height: '1.25rem' }} className="text-blue-400" />
            API-ключи
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Управление доступом к Developer API для загрузки и чтения данных
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={loadKeys} className="btn btn-secondary btn-sm" disabled={loading}>
            <ArrowPathIcon style={{ width: '1rem', height: '1rem' }} />
            Обновить
          </button>
          <button type="button" onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <PlusIcon style={{ width: '1rem', height: '1rem' }} />
            Создать ключ
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {devInfo && (
        <div className="p-4 rounded-lg border border-gray-600 bg-gray-800/40 text-sm space-y-2">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <span className="text-gray-400">Developer API: </span>
              <a href={devInfo.base_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                {devInfo.base_url}
              </a>
            </span>
            <span>
              <span className="text-gray-400">Документация Developer API: </span>
              <a href={buildDeveloperDocsUrl(devInfo)} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                {devInfo.docs_url}
              </a>
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Ingest принимается сразу (ответ с request_id), запись в latest.db выполняется асинхронно.
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">Пример CSV (curl)</summary>
            <pre className="mt-2 p-3 bg-gray-900 rounded overflow-x-auto text-gray-300">{ingestCsvExample}</pre>
          </details>
          <details className="text-xs mt-2">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">Пример JSON — строки (curl)</summary>
            <pre className="mt-2 p-3 bg-gray-900 rounded overflow-x-auto text-gray-300">{ingestJsonExample}</pre>
          </details>
          <details className="text-xs mt-2">
            <summary className="cursor-pointer text-gray-400 hover:text-gray-300">Пример JSON — макет колонок (curl)</summary>
            <pre className="mt-2 p-3 bg-gray-900 rounded overflow-x-auto text-gray-300">{ingestColumnarExample}</pre>
          </details>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
          Загрузка ключей…
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-600 rounded-lg">
          <KeyIcon style={{ width: '2.5rem', height: '2.5rem' }} className="mx-auto text-gray-500 mb-3" />
          <p className="text-gray-400 mb-3">Нет API-ключей для этой модели</p>
          <button type="button" onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <PlusIcon style={{ width: '1rem', height: '1rem' }} />
            Создать первый ключ
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-600">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Название</th>
                <th className="px-4 py-3 font-medium">Префикс</th>
                <th className="px-4 py-3 font-medium">Права</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Запросы</th>
                <th className="px-4 py-3 font-medium">Последнее использование</th>
                <th className="px-4 py-3 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-gray-700/60 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{key.key_prefix}…</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300">
                      {ACCESS_LEVEL_LABELS[key.access_level] || key.access_level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(key)}
                      className={`px-2 py-0.5 rounded text-xs ${
                        key.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {key.is_active ? 'Активен' : 'Отозван'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{key.requests_count ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(key.last_used_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {key.is_active && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(key.id, key.name)}
                        disabled={revokingId === key.id}
                        className="btn btn-danger btn-sm"
                        title="Отозвать ключ"
                      >
                        <TrashIcon style={{ width: '0.875rem', height: '0.875rem' }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateApiKeyModal
          modelId={modelId}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default ApiKeysManager;
