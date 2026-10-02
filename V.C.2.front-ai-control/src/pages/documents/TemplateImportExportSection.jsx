import React, { useRef, useState, useEffect } from 'react';
import {
  IconChevronDown,
  IconCsvExport,
  IconJsonExport,
  IconPdf,
  IconPrint,
  IconImport,
} from './DocumentIcons';
import styles from './DocumentsApp.module.css';

function SectionToggle({ id, title, badge, open, onToggle }) {
  return (
    <div className={styles.templateIoCompactPanel}>
      <button
        type="button"
        id={`${id}-toggle`}
        className={`${styles.pageNumberSettingsToggle}${open ? ` ${styles.pageNumberSettingsToggleOpen}` : ''}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
      >
        <span
          className={`${styles.pageNumberSettingsToggleIcon}${open ? ` ${styles.pageNumberSettingsToggleIconOpen}` : ''}`}
          aria-hidden
        >
          <IconChevronDown size={16} />
        </span>
        <span className={styles.pageNumberSettingsToggleTitle}>{title}</span>
        {badge ? <span className={styles.pageNumberSettingsBadge}>{badge}</span> : null}
      </button>
    </div>
  );
}

function ToolbarButton({ className, icon: Icon, children, ...props }) {
  return (
    <button type="button" className={`${className} ${styles.editorActionButton}`} {...props}>
      {Icon && <Icon size={16} className={styles.editorActionButtonIcon} />}
      <span>{children}</span>
    </button>
  );
}

export default function TemplateImportExportSection({
  isTableTemplate,
  canImport,
  tableFieldOptions,
  onExportPrint,
  onExportPdf,
  onExportJson,
  onExportCsv,
  showCsvExport,
  onImportApply,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState('auto');
  const [importMode, setImportMode] = useState('merge');
  const [importSheetContent, setImportSheetContent] = useState(false);
  const [targetField, setTargetField] = useState('');
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!targetField && tableFieldOptions.length > 0) {
      setTargetField(tableFieldOptions[0].key);
    }
  }, [tableFieldOptions, targetField]);

  const showFieldPicker = !isTableTemplate && tableFieldOptions.length > 1;

  const handleExportToggle = () => {
    setExportOpen((v) => {
      const next = !v;
      if (next) setImportOpen(false);
      return next;
    });
  };

  const handleImportToggle = () => {
    setImportOpen((v) => {
      const next = !v;
      if (next) setExportOpen(false);
      return next;
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result ?? ''));
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv')) setImportFormat('csv');
      else if (name.endsWith('.json')) setImportFormat('json');
      else setImportFormat('auto');
      setImportStatus(null);
    };
    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Не удалось прочитать файл' });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleApplyImport = () => {
    setImportStatus(null);
    if (!importText.trim()) {
      setImportStatus({ type: 'error', message: 'Вставьте JSON или CSV либо выберите файл' });
      return;
    }
    const fieldName = targetField || tableFieldOptions[0]?.key || '';
    if (importSheetContent && !window.confirm('Импортировать разметку листа из JSON? Текущая вёрстка будет заменена.')) {
      return;
    }
    const result = onImportApply({
      text: importText,
      format: importFormat,
      mode: importMode,
      targetFieldName: fieldName,
      importSheetContent,
    });
    if (result?.ok) {
      setImportStatus({ type: 'ok', message: result.message || 'Импорт выполнен' });
      setImportText('');
    } else {
      setImportStatus({ type: 'error', message: result?.error || 'Не удалось импортировать данные' });
    }
  };

  const exportBody = (
    <>
      <div className={`${styles.editorActions} ${styles.editorActionsRow} ${styles.templateIoActions}`}>
        <ToolbarButton className={styles.secondaryButton} icon={IconPrint} onClick={onExportPrint}>
          Печать
        </ToolbarButton>
        <ToolbarButton className={styles.secondaryButton} icon={IconPdf} onClick={onExportPdf}>
          Экспорт в PDF
        </ToolbarButton>
        <ToolbarButton className={styles.secondaryButton} icon={IconJsonExport} onClick={onExportJson}>
          Экспорт в JSON
        </ToolbarButton>
        {showCsvExport && (
          <ToolbarButton className={styles.secondaryButton} icon={IconCsvExport} onClick={onExportCsv}>
            Экспорт в CSV
          </ToolbarButton>
        )}
      </div>
      <p className={styles.templateIoHint}>
        JSON содержит полный снимок шаблона: разметку, значения по умолчанию и настройки оформления.
      </p>
    </>
  );

  const importBody = (
    <>
      <p className={styles.templateIoHint}>
        Вставьте JSON шаблона, объект с полями (<code>default_values</code>) или CSV со строками таблицы.
        Полный экспорт (<code>aicontrol.template</code>) автоматически подставляет разметку листа и значения полей.
        Колонки CSV сопоставляются с колонками шаблона по названию или ключу.
      </p>
      <textarea
        className={styles.templateIoTextarea}
        value={importText}
        onChange={(e) => {
          setImportText(e.target.value);
          setImportStatus(null);
        }}
        placeholder={isTableTemplate
          ? 'JSON шаблона или CSV с данными таблицы…'
          : 'JSON с полями документа или CSV для табличного поля…'}
        rows={6}
        spellCheck={false}
      />
      <div className={styles.templateIoMeta}>
        <label className={styles.templateIoLabel}>
          Формат
          <select
            className={styles.templateIoSelect}
            value={importFormat}
            onChange={(e) => setImportFormat(e.target.value)}
          >
            <option value="auto">Авто</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </label>
        <label className={styles.templateIoLabel}>
          Режим
          <select
            className={styles.templateIoSelect}
            value={importMode}
            onChange={(e) => setImportMode(e.target.value)}
          >
            <option value="merge">Дополнить поля</option>
            <option value="replace">Заменить поля из файла</option>
          </select>
        </label>
        {showFieldPicker && (
          <label className={styles.templateIoLabel}>
            Поле таблицы
            <select
              className={styles.templateIoSelect}
              value={targetField}
              onChange={(e) => setTargetField(e.target.value)}
            >
              {tableFieldOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
        {!isTableTemplate && (
          <label className={styles.templateIoCheckbox}>
            <input
              type="checkbox"
              checked={importSheetContent}
              onChange={(e) => setImportSheetContent(e.target.checked)}
            />
            <span>Импортировать разметку листа (JSON)</span>
          </label>
        )}
      </div>
      <div className={styles.templateIoFooter}>
        <button
          type="button"
          className={styles.tableToolbarButton}
          onClick={() => fileInputRef.current?.click()}
        >
          Выбрать файл
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className={styles.tableCsvFileInput}
          onChange={handleFileChange}
          aria-label="Выбрать JSON или CSV"
        />
        <button
          type="button"
          className={`${styles.tableToolbarButton} ${styles.templateIoApplyBtn}`}
          onClick={handleApplyImport}
        >
          <IconImport size={16} className={styles.editorActionButtonIcon} />
          Применить импорт
        </button>
      </div>
      {importStatus && (
        <p
          className={importStatus.type === 'ok' ? styles.templateIoStatusOk : styles.templateIoStatusError}
          role="status"
        >
          {importStatus.message}
        </p>
      )}
    </>
  );

  return (
    <div className={styles.templateIoInlineHost}>
      <div className={styles.templateIoInlineToggles}>
        <SectionToggle
          id="template-export-section"
          title="Экспорт"
          badge="PDF · JSON"
          open={exportOpen}
          onToggle={handleExportToggle}
        />
        {canImport && (
          <SectionToggle
            id="template-import-section"
            title="Импорт"
            badge="JSON · CSV"
            open={importOpen}
            onToggle={handleImportToggle}
          />
        )}
      </div>
      {exportOpen && (
        <div
          id="template-export-section"
          className={styles.templateIoInlineExpand}
          role="region"
          aria-labelledby="template-export-section-toggle"
        >
          <div className={styles.templateIoPanelBody}>
            {exportBody}
          </div>
        </div>
      )}
      {importOpen && (
        <div
          id="template-import-section"
          className={styles.templateIoInlineExpand}
          role="region"
          aria-labelledby="template-import-section-toggle"
        >
          <div className={styles.templateIoPanelBody}>
            {importBody}
          </div>
        </div>
      )}
    </div>
  );
}
