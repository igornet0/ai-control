import React from 'react';
import { DEFAULT_TABLE_COLUMNS, getTextStyleFromBlock } from './SheetEditor';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';
import { getSpreadsheetAllSheetsPreviewData } from './spreadsheetPreview';
import { resolveTableColumns } from './documentTableColumns';
import { formatScalarFieldPreview, isTableFieldBlock, isTableFieldValue } from './tableFieldUtils';
import { SheetImageBlockPreview } from './SheetImageBlockPreview';
import { getBlockWrapStyle, getImageBlockNumber } from './sheetImageUtils';
import { resolveBlockContent, resolveFieldValuePlaceholders } from './documentPlaceholders';

export function renderResolvedTextLines(content, placeholderVars, { className, style } = {}) {
  const resolved = resolveBlockContent(content, placeholderVars);
  const lines = resolved.split('\n');
  return (
    <div className={className} style={style}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line || '\u00A0'}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
}

function renderEditableFieldValue({
  styles,
  fieldStyle,
  editable,
  onFieldClick,
  fieldName,
  block,
  meta,
  children,
}) {
  if (!editable || !fieldName || !onFieldClick) {
    return (
      <div className={styles.sheetPageFieldValue} style={fieldStyle}>
        {children}
      </div>
    );
  }
  const activate = () => onFieldClick({ fieldName, block, meta });
  return (
    <button
      type="button"
      className={`${styles.sheetPageFieldValue} ${styles.sheetPageFieldValueEditable}`}
      style={fieldStyle}
      onClick={activate}
      title="Нажмите, чтобы изменить"
    >
      {children}
    </button>
  );
}

export function getFieldValueFromData(fieldData, fieldName) {
  if (!fieldName || !fieldData || typeof fieldData !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(fieldData, fieldName)) return fieldData[fieldName];
  const keyLower = String(fieldName).trim().toLowerCase();
  const found = Object.keys(fieldData).find((k) => String(k).trim().toLowerCase() === keyLower);
  return found !== undefined ? fieldData[found] : undefined;
}

export function renderFieldValue(value, type, tableColumns, styles, placeholderVars = null) {
  const displayValue = placeholderVars ? resolveFieldValuePlaceholders(value, placeholderVars) : value;
  if (displayValue === null || displayValue === undefined) return '';
  const renderAsTable = (type === 'table' || isTableFieldValue(displayValue)) && Array.isArray(displayValue);
  if (renderAsTable) {
    const cols = Array.isArray(tableColumns) && tableColumns.length > 0 ? tableColumns : DEFAULT_TABLE_COLUMNS;
    return (
      <table className={styles.printTable}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayValue.length > 0
            ? displayValue.map((row, i) => (
                <tr key={i}>
                  {cols.map((col, ci) => (
                    <td key={ci}>{String(row[col.key] ?? '—')}</td>
                  ))}
                </tr>
              ))
            : (
                <tr>
                  {cols.map((col, ci) => (
                    <td key={ci}>—</td>
                  ))}
                </tr>
              )}
        </tbody>
      </table>
    );
  }
  if (typeof displayValue === 'object') return JSON.stringify(displayValue, null, 2);
  return String(displayValue);
}

export function renderPreviewBlock(entry, index, {
  fieldData,
  fieldsList,
  styles,
  editable = false,
  onFieldClick,
  allBlocks = [],
  placeholderVars = {},
}) {
  const getFieldMeta = (fieldName) => fieldsList.find((f) => f.name === fieldName);
  const { block, rowSlice, isTableContinuation, sheetId } = entry;

  if (block.type === SPREADSHEET_BLOCK_TYPE) {
    const rowArr = getFieldValueFromData(fieldData, block.field_name);
    let allSheets = getSpreadsheetAllSheetsPreviewData(block, rowArr);
    if (sheetId) {
      allSheets = allSheets.filter((s) => s.sheetId === sheetId);
    }
    const fieldStyle = getTextStyleFromBlock(block);
    return allSheets.map((sheetData, sheetIdx) => {
      const { columns, rows, sheetName } = sheetData;
      const slicedRows = rowSlice ? rows.slice(rowSlice.start, rowSlice.end) : rows;
      const continuationSuffix = isTableContinuation ? ' (продолжение)' : '';
      const label = allSheets.length > 1
        ? `${block.field_name || ''} — ${sheetName}${continuationSuffix}`
        : `${block.field_name || ''}${continuationSuffix}`;
      return (
        <div key={`${sheetIdx}-${sheetData.sheetId}`} className={styles.sheetPageField} style={fieldStyle}>
          {block.field_name ? (
            <span className={styles.sheetPageFieldLabel} style={fieldStyle}>
              {label}
            </span>
          ) : null}
          {renderEditableFieldValue({
            styles,
            fieldStyle,
            editable: editable && !isTableContinuation,
            onFieldClick,
            fieldName: block.field_name,
            block,
            meta: getFieldMeta(block.field_name),
            children: (
              <table className={styles.printTable}>
                <thead>
                  <tr>
                    {columns.map((col, ci) => (
                      <th key={col.key || ci}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slicedRows.length > 0
                    ? slicedRows.map((row, i) => (
                        <tr key={i}>
                          {columns.map((col, ci) => (
                            <td key={col.key || ci}>{String(row[col.key] ?? '—')}</td>
                          ))}
                        </tr>
                      ))
                    : (
                        <tr>
                          {columns.map((col, ci) => (
                            <td key={col.key || ci}>—</td>
                          ))}
                        </tr>
                      )}
                </tbody>
              </table>
            ),
          })}
        </div>
      );
    });
  }

  if (block.type === 'field') {
    const meta = getFieldMeta(block.field_name);
    const rawValue = getFieldValueFromData(fieldData, block.field_name);
    const isTable = isTableFieldBlock(block, fieldsList) || isTableFieldValue(rawValue);
    let value = rawValue !== undefined && rawValue !== null ? rawValue : (isTable ? [] : '_______________');
    value = resolveFieldValuePlaceholders(value, placeholderVars);
    const fieldStyle = getTextStyleFromBlock(block);
    const continuationSuffix = isTableContinuation ? ' (продолжение)' : '';
    const tableValue = isTable && rowSlice && Array.isArray(value)
      ? value.slice(rowSlice.start, rowSlice.end)
      : value;
    return (
      <div key={index} className={styles.sheetPageField} style={fieldStyle}>
        <span className={styles.sheetPageFieldLabel} style={fieldStyle}>
          {block.field_name || '(поле)'}{isTable ? continuationSuffix : ''}
        </span>
        {renderEditableFieldValue({
          styles,
          fieldStyle,
          editable: editable && !isTableContinuation,
          onFieldClick,
          fieldName: block.field_name,
          block,
          meta: getFieldMeta(block.field_name),
          children: isTable
            ? renderFieldValue(
                tableValue,
                'table',
                resolveTableColumns(block, meta),
                styles,
                placeholderVars,
              )
            : formatScalarFieldPreview(value),
        })}
      </div>
    );
  }

  if (block.type === 'stamp') {
    const showCircle = block.showCircle !== false;
    const w = Math.min(300, Math.max(40, Number(block.stampWidth) || 120));
    const h = Math.min(300, Math.max(40, Number(block.stampHeight) || 120));
    const stampStyle = {
      width: w,
      height: h,
      borderRadius: showCircle ? '50%' : 0,
      border: showCircle ? '2px solid #94a3b8' : 'none',
    };
    return (
      <div
        key={index}
        className={styles.sheetPageStampWrap}
        style={getBlockWrapStyle(block.stampAlign, block.stampOffsetX, block.stampOffsetY)}
      >
        <div className={styles.sheetPageStamp} style={stampStyle}>
          {block.image ? (
            <img src={block.image} alt="" className={styles.sheetPageStampImg} />
          ) : (
            <span className={styles.sheetPageStampText}>
              {resolveBlockContent(block.content || 'М.П.', placeholderVars)}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <SheetImageBlockPreview
        key={index}
        block={block}
        imageNumber={getImageBlockNumber(block, allBlocks)}
        styles={styles}
        placeholderVars={placeholderVars}
      />
    );
  }

  return (
    <React.Fragment key={index}>
      {renderResolvedTextLines(block.content, placeholderVars, {
        className: styles.sheetPageText,
        style: getTextStyleFromBlock(block),
      })}
    </React.Fragment>
  );
}
