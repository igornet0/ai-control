import React, { useState, useEffect } from 'react';
import { documentService } from '../../services/documentService';
import styles from './DocumentsApp.module.css';

const RULE_TYPES = [
  { value: 'constant', label: 'Константа', paramKey: 'value', paramLabel: 'Значение' },
  { value: 'current_date', label: 'Текущая дата', paramKey: null },
  { value: 'date_offset', label: 'Смещение даты', paramKey: 'days', paramLabel: 'Дней (+/-)' },
  { value: 'next_weekday', label: 'Следующий будний день', paramKey: 'weekday', paramLabel: 'День (0=Пн)' },
  { value: 'doc_number', label: 'Номер документа', paramKey: 'prefix', paramLabel: 'Префикс' },
  { value: 'from_previous', label: 'Из предыдущего документа', paramKey: 'field_name', paramLabel: 'Имя поля' },
  { value: 'formula', label: 'Формула', paramKey: 'default', paramLabel: 'Значение по умолчанию' },
];

const AutofillConstructor = ({ templates, kinds }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newRule, setNewRule] = useState({
    field_name: '',
    rule_type: 'constant',
    params: {},
  });

  useEffect(() => {
    if (selectedTemplateId) {
      setLoading(true);
      documentService
        .getRulesByTemplateId(selectedTemplateId)
        .then((data) => setRules(Array.isArray(data) ? data : []))
        .catch(() => setRules([]))
        .finally(() => setLoading(false));
    } else {
      setRules([]);
    }
  }, [selectedTemplateId]);

  const currentRuleMeta = RULE_TYPES.find((r) => r.value === newRule.rule_type);
  const paramKey = currentRuleMeta?.paramKey;

  const addRule = async () => {
    if (!selectedTemplateId || !newRule.field_name?.trim()) {
      setError('Укажите шаблон и имя поля');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await documentService.createRule({
        template_id: parseInt(selectedTemplateId, 10),
        field_name: newRule.field_name.trim(),
        rule_type: newRule.rule_type,
        params: newRule.params || {},
      });
      const data = await documentService.getRulesByTemplateId(selectedTemplateId);
      setRules(Array.isArray(data) ? data : []);
      setNewRule({ field_name: '', rule_type: 'constant', params: {} });
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось добавить правило');
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (ruleId) => {
    setSaving(true);
    setError(null);
    try {
      await documentService.deleteRule(ruleId);
      const data = await documentService.getRulesByTemplateId(selectedTemplateId);
      setRules(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить правило');
    } finally {
      setSaving(false);
    }
  };

  const updateNewParam = (key, value) => {
    setNewRule((prev) => ({
      ...prev,
      params: { ...prev.params, [key]: value },
    }));
  };

  if (!templates?.length) {
    return (
      <p className={styles.placeholder}>
        Нет шаблонов. Создайте шаблоны документов или запустите сидер.
      </p>
    );
  }

  return (
    <div className={styles.autofillConstructor}>
      <label className={styles.structureLabel}>
        Шаблон:
        <select
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
          className={styles.structureSelect}
        >
          <option value="">— Выберите шаблон —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {error && <div className={styles.error}>{error}</div>}
      {selectedTemplateId && (
        <>
          <div className={styles.autofillAdd}>
            <input
              type="text"
              placeholder="Имя поля"
              value={newRule.field_name}
              onChange={(e) => setNewRule((p) => ({ ...p, field_name: e.target.value }))}
              className={styles.fieldInput}
            />
            <select
              value={newRule.rule_type}
              onChange={(e) =>
                setNewRule((p) => ({ ...p, rule_type: e.target.value, params: {} }))
              }
              className={styles.fieldSelect}
            >
              {RULE_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {paramKey && (
              <input
                type="text"
                placeholder={currentRuleMeta?.paramLabel || paramKey}
                value={newRule.params?.[paramKey] ?? ''}
                onChange={(e) => updateNewParam(paramKey, e.target.value)}
                className={styles.fieldInput}
              />
            )}
            <button
              type="button"
              className={styles.primaryButton}
              onClick={addRule}
              disabled={saving}
            >
              {saving ? '…' : 'Добавить правило'}
            </button>
          </div>
          {loading ? (
            <p className={styles.placeholder}>Загрузка правил…</p>
          ) : (
            <ul className={styles.rulesList}>
              {rules.map((r) => (
                <li key={r.id} className={styles.ruleItem}>
                  <span className={styles.ruleField}>{r.field_name}</span>
                  <span className={styles.ruleType}>
                    {RULE_TYPES.find((t) => t.value === r.rule_type)?.label ?? r.rule_type}
                  </span>
                  {r.params && Object.keys(r.params).length > 0 && (
                    <span className={styles.ruleParams}>
                      {JSON.stringify(r.params)}
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.removeFieldBtn}
                    onClick={() => removeRule(r.id)}
                    disabled={saving}
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default AutofillConstructor;
