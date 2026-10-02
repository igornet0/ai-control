import React, { useMemo } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import {
  DB_TYPE_DEFAULTS,
  DB_TYPES,
  isSqlDatabaseType,
  normalizeDatabaseSettings,
  normalizeDbType,
} from '../interactive/databaseSourceDataCodeSync.js';
import styles from '../PropertiesPanel.module.css';
import DataCodeOpenButton from './DataCodeOpenButton.jsx';

const DB_TYPE_OPTIONS = DB_TYPES.map((value) => ({
  value,
  label: DB_TYPE_DEFAULTS[value]?.label || value,
}));

const DatabaseSourceSettings = ({
  settings,
  onFieldChange,
  onSettingsChange,
  onOpenDataCodeEditor,
  codeModified = false,
  onRegenerateCode,
}) => {
  const normalized = useMemo(() => normalizeDatabaseSettings(settings || {}), [settings]);
  const dbType = normalized.dbType;
  const mode = normalized.dbConnectionMode === 'url' ? 'url' : 'fields';
  const isSqlite = dbType === 'sqlite';
  const isMongo = dbType === 'mongodb';
  const isSql = isSqlDatabaseType(dbType);
  const isPostgres = dbType === 'postgresql';

  const handleDbTypeChange = (nextTypeRaw) => {
    const nextType = normalizeDbType(nextTypeRaw);
    const defaults = DB_TYPE_DEFAULTS[nextType] || DB_TYPE_DEFAULTS.postgresql;
    const next = {
      ...normalized,
      dbType: nextType,
      dbPort: defaults.port,
    };
    if (nextType !== 'mongodb') {
      next.dbCollection = '';
    }
    if (nextType !== 'postgresql') {
      next.dbSchema = '';
    }
    if (nextType === 'sqlite' && mode === 'fields' && !next.dbPath && !next.database) {
      next.dbPath = './app.db';
    }
    onSettingsChange(next);
  };

  const handleModeChange = (nextMode) => {
    onFieldChange('dbConnectionMode', nextMode);
  };

  const canOpenDataCode = Boolean(
    (mode === 'url' && (normalized.dbUrl || isSqlite))
    || (mode === 'fields' && (
      isSqlite
        ? (normalized.dbPath || normalized.database)
        : normalized.dbHost
    ))
    || (isMongo && normalized.database)
    || (isSql && (normalized.query || normalized.dbTable)),
  );

  return (
    <div className={styles.databaseSettings}>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Тип БД</label>
        <select
          className={styles.select}
          value={dbType}
          onChange={(e) => handleDbTypeChange(e.target.value)}
        >
          {DB_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Режим подключения</label>
        <div className={styles.dbModeToggle}>
          <button
            type="button"
            className={`${styles.dbModeButton} ${mode === 'url' ? styles.dbModeButtonActive : ''}`}
            onClick={() => handleModeChange('url')}
          >
            URL / URI
          </button>
          <button
            type="button"
            className={`${styles.dbModeButton} ${mode === 'fields' ? styles.dbModeButtonActive : ''}`}
            onClick={() => handleModeChange('fields')}
          >
            Отдельные поля
          </button>
        </div>
        <div className={styles.infoText}>
          Как в DataCode: полный URL либо host/port/database/credentials
        </div>
      </div>

      {mode === 'url' ? (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            {isSqlite ? 'URL SQLite' : 'URL / URI'}
          </label>
          <input
            type="text"
            className={styles.input}
            value={normalized.dbUrl || ''}
            onChange={(e) => onFieldChange('dbUrl', e.target.value)}
            placeholder={
              dbType === 'postgresql' ? 'postgres://user:pass@localhost:5432/dbname'
                : dbType === 'mysql' ? 'mysql://user:pass@localhost:3306/dbname'
                  : dbType === 'mongodb' ? 'mongodb://localhost:27017'
                    : dbType === 'mssql' ? 'mssql://sa:Password@localhost:1433/master'
                      : 'sqlite:///:memory: или sqlite:///./app.db'
            }
          />
        </div>
      ) : (
        <>
          {isSqlite ? (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Путь к файлу (path)</label>
              <input
                type="text"
                className={styles.input}
                value={normalized.dbPath || ''}
                onChange={(e) => onFieldChange('dbPath', e.target.value)}
                placeholder="./app.db или оставьте пустым для :memory: через URL"
              />
              <div className={styles.infoText}>
                Альтернатива: укажите database как путь к файлу
              </div>
              <label className={styles.label} style={{ marginTop: '0.5rem' }}>
                Database (альтернатива path)
              </label>
              <input
                type="text"
                className={styles.input}
                value={normalized.database || ''}
                onChange={(e) => onFieldChange('database', e.target.value)}
                placeholder="./app.db"
              />
            </div>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Host</label>
                <input
                  type="text"
                  className={styles.input}
                  value={normalized.dbHost || ''}
                  onChange={(e) => onFieldChange('dbHost', e.target.value)}
                  placeholder="localhost"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Port</label>
                <input
                  type="number"
                  className={styles.input}
                  value={normalized.dbPort ?? ''}
                  onChange={(e) => onFieldChange(
                    'dbPort',
                    e.target.value === '' ? null : Number(e.target.value),
                  )}
                  placeholder={String(DB_TYPE_DEFAULTS[dbType]?.port || '')}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  {isMongo ? 'Database *' : 'Database'}
                </label>
                <input
                  type="text"
                  className={styles.input}
                  value={normalized.database || ''}
                  onChange={(e) => onFieldChange('database', e.target.value)}
                  placeholder={isMongo ? 'обязательно' : 'имя базы'}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Username</label>
                <input
                  type="text"
                  className={styles.input}
                  value={normalized.dbUsername || ''}
                  onChange={(e) => onFieldChange('dbUsername', e.target.value)}
                  placeholder="user"
                  autoComplete="off"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Password</label>
                <input
                  type="password"
                  className={styles.input}
                  value={normalized.dbPassword || ''}
                  onChange={(e) => onFieldChange('dbPassword', e.target.value)}
                  placeholder="password"
                  autoComplete="new-password"
                />
              </div>
              {isPostgres && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Schema</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={normalized.dbSchema || ''}
                    onChange={(e) => onFieldChange('dbSchema', e.target.value)}
                    placeholder="public"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {isMongo && mode === 'url' && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Database *</label>
          <input
            type="text"
            className={styles.input}
            value={normalized.database || ''}
            onChange={(e) => onFieldChange('database', e.target.value)}
            placeholder="обязательно для MongoDB"
          />
        </div>
      )}

      {isMongo && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Collection</label>
          <input
            type="text"
            className={styles.input}
            value={normalized.dbCollection || ''}
            onChange={(e) => onFieldChange('dbCollection', e.target.value)}
            placeholder="users"
          />
          <div className={styles.infoText}>
            Используется в datasource и в get_table
          </div>
        </div>
      )}

      {isSql && (
        <>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Таблица</label>
            <input
              type="text"
              className={styles.input}
              value={normalized.dbTable || ''}
              onChange={(e) => onFieldChange('dbTable', e.target.value)}
              placeholder="users"
            />
            <div className={styles.infoText}>
              Если SQL пуст — будет SELECT * FROM &lt;таблица&gt;
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>SQL (get_table)</label>
            <textarea
              className={styles.textarea}
              value={normalized.query || ''}
              onChange={(e) => onFieldChange('query', e.target.value)}
              placeholder="SELECT * FROM users ORDER BY id"
              rows={3}
            />
          </div>
        </>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Timeout (сек)</label>
        <input
          type="number"
          className={styles.input}
          value={normalized.dbTimeout ?? ''}
          onChange={(e) => onFieldChange(
            'dbTimeout',
            e.target.value === '' ? null : Number(e.target.value),
          )}
          placeholder="10"
          min={0}
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.exportGlobal !== false}
            onChange={(e) => onFieldChange('exportGlobal', e.target.checked)}
          />
          <span>Экспортировать (global)</span>
        </label>
        <div className={styles.infoText}>
          Добавляет global к переменной результата get_table
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <DataCodeOpenButton
          onClick={() => onOpenDataCodeEditor?.()}
          disabled={!canOpenDataCode}
          modified={codeModified}
          onRegenerate={onRegenerateCode}
          title={canOpenDataCode
            ? 'Открыть редактор DataCode с datasource/connect/get_table'
            : 'Сначала заполните параметры подключения'}
        />
      </div>
    </div>
  );
};

export default DatabaseSourceSettings;
