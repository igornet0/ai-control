import React, { useState, useEffect, Fragment } from 'react';
import { documentService } from '../../services/documentService';
import TableFieldColumnsEditor from './TableFieldColumnsEditor';
import { copyDefaultTableColumns } from './documentTableColumns';
import { normalizeStructureFieldsForSave, validateStructureFields } from './structureFieldUtils';
import { buildSheetContentFromFields, buildDefaultValuesFromFields, buildPayloadFromSpreadsheetModel } from './buildTemplatePayload';
import SpreadsheetTemplatePanel from './SpreadsheetTemplatePanel';
import { createEmptySpreadsheetWorkbook } from './spreadsheetGridUtils';
import { IconClose } from './DocumentIcons';
import DocumentProjectPicker from './DocumentProjectPicker';
import DepartmentPicker from './DepartmentPicker';
import styles from './DocumentsApp.module.css';
import ct from './CreateTemplateModal.module.css';

const FIELD_TYPES = [
  { value: 'string', label: 'Строка' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'table', label: 'Таблица' },
  { value: 'boolean', label: 'Да/Нет' },
];

/** Внутренний ключ единственного поля-таблицы (без ввода пользователя) — см. buildPayloadFromSpreadsheetModel */
const SPREADSHEET_FIELD_NAME = 'Данные';

const CreateTemplateModal = ({ open, onClose, onCreated, initialCreateMode = null }) => {
  const [name, setName] = useState('');
  const [createMode, setCreateMode] = useState('document');
  const [spreadsheetModel, setSpreadsheetModel] = useState(() => createEmptySpreadsheetWorkbook(1, 8, 14));
  const [fields, setFields] = useState([]);
  const [defaultProjectId, setDefaultProjectId] = useState(null);
  const [departmentId, setDepartmentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setCreateMode(initialCreateMode === 'spreadsheet' ? 'spreadsheet' : 'document');
    setSpreadsheetModel(createEmptySpreadsheetWorkbook(1, 8, 14));
    setFields([]);
    setDefaultProjectId(null);
    setDepartmentId(null);
    setError(null);
  }, [open, initialCreateMode]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      setError('Введите название');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (createMode === 'spreadsheet') {
        const { fieldsPayload, sheetContent, defaultValues, titleTemplate } = buildPayloadFromSpreadsheetModel(
          trimmedName,
          SPREADSHEET_FIELD_NAME,
          spreadsheetModel
        );
        const kind = await documentService.createKind({ name: trimmedName });
        await documentService.createStructure({
          document_kind_id: kind.id,
          fields: { fields: fieldsPayload },
        });
        const template = await documentService.createTemplate({
          name: trimmedName,
          document_kind_id: kind.id,
          sheet_content: sheetContent,
          default_values: defaultValues,
          title_template: titleTemplate,
          default_project_id: defaultProjectId,
          department_id: departmentId,
        });
        onCreated?.(template);
        onClose?.();
        return;
      }

      const normalized = normalizeStructureFieldsForSave(fields);
      const validationError = validateStructureFields(normalized);
      if (validationError) {
        setError(validationError);
        setSaving(false);
        return;
      }
      const fieldsPayload = normalized.map((f, i) => ({
        name: (f.name || '').trim() || `Поле ${i + 1}`,
        type: f.type || 'string',
        required: !!f.required,
        order: f.order ?? i + 1,
        ...(f.type === 'table' && Array.isArray(f.columns) ? { columns: f.columns } : {}),
      })).filter((f) => f.name);

      const kind = await documentService.createKind({ name: trimmedName });
      await documentService.createStructure({
        document_kind_id: kind.id,
        fields: { fields: fieldsPayload },
      });
      const sheetContent = buildSheetContentFromFields(fieldsPayload);
      const defaultValues = buildDefaultValuesFromFields(fieldsPayload);
      const template = await documentService.createTemplate({
        name: trimmedName,
        document_kind_id: kind.id,
        sheet_content: sheetContent,
        default_values: defaultValues,
        title_template: `${trimmedName} — № {номер}`,
        default_project_id: defaultProjectId,
        department_id: departmentId,
      });
      onCreated?.(template);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось создать шаблон');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={[ct.overlay, createMode === 'spreadsheet' ? ct.overlaySpreadsheet : ''].filter(Boolean).join(' ')}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="presentation"
    >
      <div
        className={[ct.panel, createMode === 'spreadsheet' ? ct.panelSpreadsheet : ''].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-template-heading"
        aria-describedby="create-template-desc"
      >
        <div className={ct.header}>
          <div className={ct.headerText}>
            <h2 id="create-template-heading" className={ct.title}>
              Создать шаблон
            </h2>
          </div>
          <button type="button" className={ct.closeBtn} onClick={onClose} aria-label="Закрыть">
            <IconClose size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className={[
            ct.body,
            createMode === 'spreadsheet' ? ct.bodySpreadsheet : ct.bodyDocument,
          ].filter(Boolean).join(' ')}
        >
          {error && <div className={ct.error} role="alert">{error}</div>}

          <div className={ct.section}>
            <label className={ct.sectionLabel} htmlFor="create-template-name">
              Название
            </label>
            <input
              id="create-template-name"
              type="text"
              className={ct.nameInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Заказ клиента"
              autoFocus
            />
          </div>

          <DocumentProjectPicker
            variant="button"
            value={defaultProjectId}
            onChange={setDefaultProjectId}
            label="Проект по умолчанию"
            hint="Все документы, созданные по этому шаблону, будут автоматически привязаны к выбранному проекту."
            buttonPlaceholder="Не выбран — нажмите для выбора"
          />

          <DepartmentPicker
            variant="button"
            value={departmentId}
            onChange={setDepartmentId}
            label="Отдел"
            hint="Пусто — общий шаблон для всех. Указанный отдел ограничит видимость."
            buttonPlaceholder="Не выбран — нажмите для выбора"
          />

          <div className={ct.modeWrap}>
            <span className={ct.sectionLabel} id="create-mode-label">Тип шаблона</span>
            <div className={ct.modeSegment} role="group" aria-labelledby="create-mode-label">
              <button
                type="button"
                className={`${ct.modeBtn} ${createMode === 'document' ? ct.modeBtnActive : ''}`}
                onClick={() => setCreateMode('document')}
              >
                Документ
              </button>
              <button
                type="button"
                className={`${ct.modeBtn} ${createMode === 'spreadsheet' ? ct.modeBtnActive : ''}`}
                onClick={() => setCreateMode('spreadsheet')}
              >
                Таблица
              </button>
            </div>
          </div>

          {createMode === 'spreadsheet' ? (
            <div className={ct.spreadsheetMain}>
              <SpreadsheetTemplatePanel model={spreadsheetModel} onChange={setSpreadsheetModel} />
            </div>
          ) : (
            <div className={ct.structureCard}>
              <div className={ct.structureCardHeader}>
                <div>
                  <p className={ct.structureCardTitle}>Поля документа</p>
                  <p className={ct.structureCardHint}>
                    Поля документа необходимы для заполнения документа после создания документа на основе шаблона.
                  </p>
                </div>
                <button type="button" className={ct.addFieldBtn} onClick={addField}>
                  + Добавить поле
                </button>
              </div>
              {fields.length > 0 ? (
                <div className={ct.fieldsTableScroll}>
                  <table className={`${styles.fieldsTable} ${ct.fieldsTable}`}>
                    <thead>
                      <tr>
                        <th className={ct.colName}>Поле</th>
                        <th className={ct.colType}>Тип</th>
                        <th className={ct.colRequired}>Обяз.</th>
                        <th className={ct.colOrder}>№</th>
                        <th className={ct.colAction} aria-label="Действия" />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f, i) => (
                        <Fragment key={i}>
                          <tr>
                            <td className={ct.colName}>
                              <input
                                type="text"
                                value={f.name || ''}
                                onChange={(e) => updateField(i, 'name', e.target.value)}
                                placeholder="Имя поля"
                                className={`${styles.fieldInput} ${ct.cellControl}`}
                              />
                            </td>
                            <td className={ct.colType}>
                              <select
                                value={f.type || 'string'}
                                onChange={(e) => handleFieldTypeChange(i, e.target.value)}
                                className={`${styles.fieldSelect} ${ct.cellControl}`}
                              >
                                {FIELD_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className={ct.colRequired}>
                              <input
                                type="checkbox"
                                className={ct.checkbox}
                                checked={!!f.required}
                                onChange={(e) => updateField(i, 'required', e.target.checked)}
                                title="Обязательное"
                                aria-label={`Поле ${f.name || i + 1} обязательное`}
                              />
                            </td>
                            <td className={ct.colOrder}>
                              <input
                                type="number"
                                min={1}
                                value={f.order ?? i + 1}
                                onChange={(e) => updateField(i, 'order', e.target.value)}
                                className={`${styles.fieldOrder} ${ct.cellOrder}`}
                              />
                            </td>
                            <td className={ct.colAction}>
                              <button
                                type="button"
                                className={styles.removeFieldBtn}
                                onClick={() => removeField(i)}
                                title="Удалить поле"
                                aria-label={`Удалить поле ${f.name || i + 1}`}
                              >
                                Удалить
                              </button>
                            </td>
                          </tr>
                          {f.type === 'table' && (
                            <tr className={styles.structureTableColumnsRow}>
                              <td colSpan={5} className={ct.structureColumnsCell}>
                                <TableFieldColumnsEditor
                                  columns={f.columns}
                                  onChange={(cols) => setFieldColumns(i, cols)}
                                  wrapClassName={`${styles.tableColumnsWrap} ${ct.tableColumnsScroll}`}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={ct.emptyState}>
                  <p className={ct.emptyStateText}>
                    Пока нет полей — нажмите <strong>«Добавить поле»</strong> выше или задайте их позже
                    во вкладке <strong>«Структура документа»</strong>.
                  </p>
                  <button type="button" className={ct.addFieldBtn} onClick={addField}>
                    + Добавить поле
                  </button>
                </div>
              )}
            </div>
          )}

          <div className={ct.footer}>
            <button type="button" className={ct.secondaryBtn} onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className={ct.primaryBtn} disabled={saving}>
              {saving ? 'Создание…' : 'Создать шаблон'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTemplateModal;
