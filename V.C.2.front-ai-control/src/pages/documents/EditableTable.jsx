import React, { useRef } from 'react';
import Papa from 'papaparse';
import { DEFAULT_TABLE_COLUMNS } from './SheetEditor';
import { rowsToCsv, downloadCsvFile, papaResultToFieldRows, sanitizeFilename } from './csvUtils';
import { IconClose } from './DocumentIcons';
import styles from './DocumentsApp.module.css';

/** Редактируемая таблица: колонки из шаблона, строки — массив объектов */
const EditableTable = ({ columns, value, onChange, className, csvBaseFilename, compact = false }) => {
  const rows = Array.isArray(value) ? value : [];
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : DEFAULT_TABLE_COLUMNS;
  const fileInputRef = useRef(null);

  const setRow = (rowIndex, key, val) => {
    const next = rows.map((r, i) => (i !== rowIndex ? r : { ...r, [key]: val }));
    onChange(next);
  };
  const addRow = () => {
    const newRow = {};
    cols.forEach((c) => { newRow[c.key] = ''; });
    onChange([...rows, newRow]);
  };
  const removeRow = (rowIndex) => {
    onChange(rows.filter((_, i) => i !== rowIndex));
  };

  const handleExportCsv = () => {
    const csv = rowsToCsv(rows, cols);
    const base = csvBaseFilename || 'table';
    downloadCsvFile(`${sanitizeFilename(base)}.csv`, csv);
  };

  const handleImportCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      complete: (results) => {
        const next = papaResultToFieldRows(results, cols);
        if (next.length > 0) onChange(next);
        e.target.value = '';
      },
      error: () => {
        e.target.value = '';
      },
    });
  };

  return (
    <div className={className}>
      <div className={compact ? styles.tableToolbarCompact : styles.tableToolbar}>
        {!compact && (
          <>
            <button type="button" className={styles.tableToolbarButton} onClick={handleExportCsv}>
              Скачать CSV
            </button>
            <button
              type="button"
              className={styles.tableToolbarButton}
              onClick={() => fileInputRef.current?.click()}
            >
              Загрузить CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className={styles.tableCsvFileInput}
              onChange={handleImportCsv}
              aria-label="Загрузить CSV в таблицу"
            />
          </>
        )}
        <button type="button" className={styles.tableToolbarButton} onClick={addRow}>
          + Добавить строку
        </button>
      </div>
      <table className={styles.editTable}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i}>{c.label}</th>
            ))}
            <th className={styles.editTableActions} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((col, ci) => (
                <td key={ci}>
                  <input
                    type="text"
                    className={styles.editTableInput}
                    value={row[col.key] ?? ''}
                    onChange={(e) => setRow(i, col.key, e.target.value)}
                  />
                </td>
              ))}
              <td className={styles.editTableActions}>
                <button type="button" className={styles.editTableRemoveRow} onClick={() => removeRow(i)} title="Удалить строку">
                  <IconClose size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EditableTable;
