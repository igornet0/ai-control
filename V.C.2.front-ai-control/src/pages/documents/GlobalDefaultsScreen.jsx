import React, { useState, useEffect } from 'react';
import { documentService } from '../../services/documentService';
import styles from './DocumentsApp.module.css';

const GlobalDefaultsScreen = () => {
  const [defaults, setDefaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const loadDefaults = async () => {
    try {
      const data = await documentService.getGlobalDefaults();
      setDefaults(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Не удалось загрузить параметры');
      setDefaults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefaults();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await documentService.createGlobalDefault({
        key: newKey.trim(),
        value: newValue,
        description: newDesc.trim() || undefined,
      });
      await loadDefaults();
      setNewKey('');
      setNewValue('');
      setNewDesc('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось создать параметр');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingKey(item.key);
    setEditValue(item.value ?? '');
    setEditDesc(item.description ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;
    setSaving(true);
    setError(null);
    try {
      await documentService.setGlobalDefault(editingKey, {
        value: editValue,
        description: editDesc,
      });
      await loadDefaults();
      setEditingKey(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.globalDefaultsScreen}>
      <p className={styles.placeholder}>
        Ключи из этого списка подставляются в шаблоны и документы как {'{ключ}'} — например {'{CPP}'} в текстовых блоках, заголовке и значениях по умолчанию полей.
      </p>
      {error && <div className={styles.error}>{error}</div>}
      <form onSubmit={handleCreate} className={styles.defaultsForm}>
        <input
          type="text"
          placeholder="Ключ (например CPP)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className={styles.fieldInput}
        />
        <input
          type="text"
          placeholder="Значение"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className={styles.fieldInput}
        />
        <input
          type="text"
          placeholder="Описание"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          className={styles.fieldInput}
        />
        <button type="submit" className={styles.primaryButton} disabled={saving}>
          {saving ? '…' : 'Добавить'}
        </button>
      </form>
      {loading ? (
        <p className={styles.placeholder}>Загрузка…</p>
      ) : defaults.length === 0 ? (
        <p className={styles.placeholder}>Нет глобальных параметров. Добавьте ключ и значение выше.</p>
      ) : (
        <ul className={styles.defaultsList}>
          {defaults.map((d) => (
            <li key={d.key} className={styles.defaultItem}>
              {editingKey === d.key ? (
                <>
                  <span className={styles.defaultKey}>{d.key}</span>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className={styles.fieldInput}
                    placeholder="Значение"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className={styles.fieldInput}
                    placeholder="Описание"
                  />
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSaveEdit}
                    disabled={saving}
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => setEditingKey(null)}
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <>
                  <span className={styles.defaultKey}>{d.key}</span>
                  <span className={styles.defaultValue}>{d.value ?? ''}</span>
                  {d.description && (
                    <span className={styles.defaultDesc}>{d.description}</span>
                  )}
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => startEdit(d)}
                  >
                    Изменить
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default GlobalDefaultsScreen;
