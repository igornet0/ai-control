import React from 'react';
import { copyDefaultTableColumns } from './documentTableColumns';
import { COLUMN_DATA_TYPES, normalizeColumnDataType } from './spreadsheetGridUtils';
import styles from './DocumentsApp.module.css';

const TableFieldColumnsEditor = ({
  columns,
  onChange,
  wrapClassName,
  removeBtnClassName,
  addBtnClassName,
}) => {
  const cols = Array.isArray(columns) && columns.length > 0 ? columns : copyDefaultTableColumns();

  const setCols = (next) => {
    onChange(next);
  };

  const updateCol = (index, key, value) => {
    const next = cols.map((c, i) => (i === index ? { ...c, [key]: value } : c));
    setCols(next);
  };

  const addCol = () => {
    setCols([...cols, { key: `col_${cols.length + 1}`, label: `Колонка ${cols.length + 1}`, dataType: 'string' }]);
  };

  const removeCol = (index) => {
    if (cols.length <= 1) return;
    setCols(cols.filter((_, i) => i !== index));
  };

  const wrapCls = wrapClassName || styles.tableColumnsWrap;
  const removeCls = removeBtnClassName || styles.removeFieldBtn;
  const addCls = addBtnClassName || styles.secondaryButton;

  return (
    <div className={wrapCls}>
      <div className={styles.tableColumnsTitle}>Колонки таблицы (ключ — для CSV и данных)</div>
      <table className={styles.tableColumnsTable}>
        <thead>
          <tr>
            <th>Ключ</th>
            <th>Подпись</th>
            <th>Тип</th>
            <th className={styles.tableColumnsActionTh}>Удалить</th>
          </tr>
        </thead>
        <tbody>
          {cols.map((c, i) => (
            <tr key={i}>
              <td>
                <input
                  type="text"
                  className={styles.fieldInput}
                  value={c.key ?? ''}
                  onChange={(e) => updateCol(i, 'key', e.target.value)}
                  placeholder="name"
                  aria-label={`Ключ колонки ${i + 1}`}
                />
              </td>
              <td>
                <input
                  type="text"
                  className={styles.fieldInput}
                  value={c.label ?? ''}
                  onChange={(e) => updateCol(i, 'label', e.target.value)}
                  placeholder="Название"
                  aria-label={`Подпись колонки ${i + 1}`}
                />
              </td>
              <td>
                <select
                  className={styles.fieldInput}
                  value={normalizeColumnDataType(c.dataType)}
                  onChange={(e) => updateCol(i, 'dataType', e.target.value)}
                  aria-label={`Тип колонки ${i + 1}`}
                >
                  {COLUMN_DATA_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  className={removeCls}
                  onClick={() => removeCol(i)}
                  disabled={cols.length <= 1}
                  title={cols.length <= 1 ? 'Нужна хотя бы одна колонка' : 'Удалить колонку'}
                  aria-label={`Удалить колонку ${i + 1}`}
                >
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className={addCls} onClick={addCol}>
        + Колонка
      </button>
    </div>
  );
};

export default TableFieldColumnsEditor;
