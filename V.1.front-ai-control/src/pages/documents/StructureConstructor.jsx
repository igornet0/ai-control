import React, { useState, useEffect, Fragment } from 'react';
import { documentService } from '../../services/documentService';
import TableFieldColumnsEditor from './TableFieldColumnsEditor';
import StructureFieldDefaultInput from './StructureFieldDefaultInput';
import { copyDefaultTableColumns } from './documentTableColumns';
import {
  normalizeStructureFieldsForSave,
  validateStructureFields,
  mergeFieldsWithTemplateDefaults,
  buildTemplateDefaultValuesFromFields,
} from './structureFieldUtils';
import styles from './DocumentsApp.module.css';

const FIELD_TYPES = [
  { value: 'string', label: 'Строка' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'table', label: 'Таблица' },
  { value: 'boolean', label: 'Да/Нет' },
];

const StructureConstructor = ({ kinds, initialKindId, onPreselectConsumed }) => {
  const [selectedKindId, setSelectedKindId] = useState(initialKindId || '');
  const [structure, setStructure] = useState(null);
  const [fields, setFields] = useState([]);
  const [kindTemplates, setKindTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialKindId && initialKindId !== selectedKindId) {
      setSelectedKindId(initialKindId);
      onPreselectConsumed?.();
    }
  }, [initialKindId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedKindId) {
      setLoading(true);
      setError(null);
      Promise.all([
        documentService.getStructureByKindId(selectedKindId),
        documentService.getTemplates(parseInt(selectedKindId, 10)),
      ])
        .then(([data, templates]) => {
          setStructure(data);
          const tplList = Array.isArray(templates) ? templates : [];
          setKindTemplates(tplList);
          const raw = data?.fields;
          const list = Array.isArray(raw) ? raw : (raw?.fields ? raw.fields : []);
          const templateDefaults = tplList[0]?.default_values ?? {};
          setFields(mergeFieldsWithTemplateDefaults(list, templateDefaults));
        })
        .catch(() => {
          setStructure(null);
          setKindTemplates([]);
          setFields([]);
        })
        .finally(() => setLoading(false));
    } else {
      setStructure(null);
      setKindTemplates([]);
      setFields([]);
    }
  }, [selectedKindId]);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { name: '', type: 'string', required: false, order: prev.length + 1 },
    ]);
  };

  const updateField = (index, key, value) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      if (key === 'order') next[index].order = parseInt(value, 10) || index + 1;
      return next;
    });
  };

  const handleFieldTypeChange = (index, newType) => {
    setFields((prev) => {
      const next = [...prev];
      const cur = { ...next[index], type: newType };
      if (newType === 'table' && (!cur.columns || !cur.columns.length)) {
        cur.columns = copyDefaultTableColumns();
      }
      next[index] = cur;
      return next;
    });
  };

  const setFieldColumns = (index, columns) => {
    setFields((prev) => {
      const n = [...prev];
      n[index] = { ...n[index], columns };
      return n;
    });
  };

  const removeField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const saveStructure = async () => {
    if (!selectedKindId) return;
    const err = validateStructureFields(fields);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    const normalized = normalizeStructureFieldsForSave(fields);
    const payload = { fields: { fields: normalized } };
    try {
      if (structure?.id) {
        await documentService.updateStructure(structure.id, payload);
      } else {
        await documentService.createStructure({
          document_kind_id: parseInt(selectedKindId, 10),
          fields: payload.fields,
        });
      }
      const defaultValues = buildTemplateDefaultValuesFromFields(normalized);
      if (kindTemplates.length > 0) {
        await Promise.all(
          kindTemplates.map((t) =>
            documentService.updateTemplate(t.id, { default_values: defaultValues })
          )
        );
      }
      const [data, templates] = await Promise.all([
        documentService.getStructureByKindId(selectedKindId),
        documentService.getTemplates(parseInt(selectedKindId, 10)),
      ]);
      setStructure(data);
      const tplList = Array.isArray(templates) ? templates : [];
      setKindTemplates(tplList);
      const raw = data?.fields;
      const list = Array.isArray(raw) ? raw : (raw?.fields ? raw.fields : []);
      setFields(mergeFieldsWithTemplateDefaults(list, defaultValues));
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить структуру');
    } finally {
      setSaving(false);
    }
  };

  if (!kinds?.length) {
    return (
      <p className={styles.placeholder}>
        Нет видов документов. Создайте вид в разделе «Документы» или запустите сидер.
      </p>
    );
  }

  return (
    <div className={styles.structureConstructor}>
      <label className={styles.structureLabel}>
        Вид документа:
        <select
          value={selectedKindId}
          onChange={(e) => setSelectedKindId(e.target.value)}
          className={styles.structureSelect}
        >
          <option value="">— Выберите вид —</option>
          {kinds.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      {error && <div className={styles.error}>{error}</div>}
      {loading && <p className={styles.placeholder}>Загрузка…</p>}
      {selectedKindId && !loading && (
        <>
          <div className={styles.structureToolbar}>
            <button type="button" className={styles.primaryButton} onClick={addField}>
              Добавить поле
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={saveStructure}
              disabled={saving}
            >
              {saving ? 'Сохранение…' : 'Сохранить структуру'}
            </button>
          </div>
          {kindTemplates.length > 0 ? (
            <p className={styles.structureDefaultsHint}>
              Значения по умолчанию подставляются при создании документа из шаблона
              {kindTemplates.length === 1 ? ` «${kindTemplates[0].name}»` : ` (${kindTemplates.length} шабл.)`}.
            </p>
          ) : (
            <p className={styles.structureDefaultsHint}>
              Создайте шаблон для этого вида — значения по умолчанию сохранятся вместе со структурой.
            </p>
          )}
          <div className={styles.fieldsTableWrap}>
            <table className={styles.fieldsTable}>
              <thead>
                <tr>
                  <th>Поле</th>
                  <th>Тип</th>
                  <th>Обязательное</th>
                  <th>По умолчанию</th>
                  <th>Порядок</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <Fragment key={i}>
                    <tr>
                      <td>
                        <input
                          type="text"
                          value={f.name || ''}
                          onChange={(e) => updateField(i, 'name', e.target.value)}
                          placeholder="Имя поля"
                          className={styles.fieldInput}
                        />
                      </td>
                      <td>
                        <select
                          value={f.type || 'string'}
                          onChange={(e) => handleFieldTypeChange(i, e.target.value)}
                          className={styles.fieldSelect}
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!f.required}
                          onChange={(e) => updateField(i, 'required', e.target.checked)}
                        />
                      </td>
                      <td className={styles.fieldDefaultCell}>
                        <StructureFieldDefaultInput
                          field={f}
                          onCommit={(value) => updateField(i, 'default', value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          value={f.order ?? i + 1}
                          onChange={(e) => updateField(i, 'order', e.target.value)}
                          className={styles.fieldOrder}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.removeFieldBtn}
                          onClick={() => removeField(i)}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                    {f.type === 'table' && (
                      <tr className={styles.structureTableColumnsRow}>
                        <td colSpan={6}>
                          <TableFieldColumnsEditor
                            columns={f.columns}
                            onChange={(cols) => setFieldColumns(i, cols)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default StructureConstructor;
