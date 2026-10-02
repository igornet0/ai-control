import { FIELD_DISPLAY } from './SheetEditor';
import { copyDefaultTableColumns } from './documentTableColumns';
import { normalizePageNumberStyle } from './documentPageNumber';
import { normalizePageLayout } from './documentPageLayout';
import {
  SPREADSHEET_BLOCK_TYPE,
  buildSpreadsheetBlock,
  gridWorkbookToFieldValue,
  gridModelToTableColumns,
  normalizeColumnDataType,
  isSpreadsheetWorkbookModel,
  getWorkbookActiveSheet,
} from './spreadsheetGridUtils';

/**
 * @param {Array<{ name: string, type: string, required?: boolean, order?: number, columns?: Array<{key: string, label: string}> }>} fieldsPayload
 */
export function buildSheetContentFromFields(fieldsPayload) {
  const sorted = [...fieldsPayload].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted.map((f) => {
    if (f.type === 'table') {
      const tableColumns = Array.isArray(f.columns) && f.columns.length > 0
        ? f.columns.map((c) => ({
          key: c.key,
          label: c.label,
          dataType: normalizeColumnDataType(c.dataType),
          ...(c.defaultValue != null && String(c.defaultValue).trim() !== ''
            ? { defaultValue: String(c.defaultValue) }
            : {}),
        }))
        : copyDefaultTableColumns();
      return {
        type: 'field',
        field_name: f.name,
        displayType: FIELD_DISPLAY.table,
        tableColumns,
      };
    }
    return {
      type: 'field',
      field_name: f.name,
      displayType: FIELD_DISPLAY.form,
    };
  });
}

export function buildDefaultValuesFromFields(fieldsPayload) {
  const out = {};
  fieldsPayload.forEach((f) => {
    if (f.type === 'table') {
      out[f.name] = [];
      return;
    }
    if (f.type === 'boolean') {
      out[f.name] = false;
      return;
    }
    if (f.type === 'number') {
      out[f.name] = '';
      return;
    }
    out[f.name] = '';
  });
  return out;
}

/**
 * Вид «Таблица»: одно поле-таблица + блок spreadsheet на листе.
 * @param {string} templateTitle
 * @param {string} fieldName
 * @param {object} gridModel — state из SpreadsheetTemplatePanel
 */
export function buildPayloadFromSpreadsheetModel(templateTitle, fieldName, gridModel) {
  const fn = (fieldName || '').trim() || 'Данные';
  const activeGrid = isSpreadsheetWorkbookModel(gridModel)
    ? getWorkbookActiveSheet(gridModel) || gridModel.sheets[0]
    : gridModel;
  const tableColumns = gridModelToTableColumns(activeGrid);
  const fieldsPayload = [{
    name: fn,
    type: 'table',
    required: false,
    order: 1,
    columns: tableColumns,
  }];
  const sheetBlock = buildSpreadsheetBlock(fn, gridModel);
  const defaultValues = { [fn]: gridWorkbookToFieldValue(gridModel, sheetBlock) };
  return {
    fieldsPayload,
    sheetContent: [sheetBlock],
    defaultValues,
    titleTemplate: `${templateTitle} — № {номер}`,
  };
}

/**
 * Снимок шаблона для скачивания в JSON (текущее состояние редактора).
 */
export function buildTemplateExportJson({
  template,
  templateId,
  kindId,
  kindName,
  isTableTemplate,
  structure,
  fieldsList,
  sheetBlocks,
  defaultValues,
  tableGridModel,
  titleTemplate,
  titleStyle,
  pageNumberStyle,
  pageLayoutStyle,
}) {
  const nextDefaultValues = (() => {
    if (isTableTemplate && tableGridModel) {
      const b0 = Array.isArray(sheetBlocks) ? sheetBlocks[0] : null;
      if (b0 && b0.type === SPREADSHEET_BLOCK_TYPE && b0.field_name) {
        return { ...defaultValues, [b0.field_name]: gridWorkbookToFieldValue(tableGridModel, b0) };
      }
    }
    return { ...(defaultValues && typeof defaultValues === 'object' ? defaultValues : {}) };
  })();

  const fallbackTitleTemplate = template?.title_template != null && template.title_template !== ''
    ? template.title_template
    : `${template?.name || kindName || 'Документ'} — № {номер}`;

  return {
    export_format: 'aicontrol.template',
    export_version: 1,
    exported_at: new Date().toISOString(),
    variant: isTableTemplate ? 'table' : 'document',
    template: {
      id: templateId ?? template?.id ?? null,
      name: template?.name || kindName || null,
      version: template?.version ?? null,
      document_kind_id: kindId ?? template?.document_kind_id ?? structure?.document_kind_id ?? null,
      document_kind_name: kindName ?? null,
      default_project_id: template?.default_project_id ?? null,
      department_id: template?.department_id ?? null,
    },
    title_template: (titleTemplate ?? fallbackTitleTemplate) || null,
    title_style: Object.keys(titleStyle || {}).length ? titleStyle : (template?.title_style ?? null),
    page_number_style: normalizePageNumberStyle(pageNumberStyle ?? template?.page_number_style),
    page_layout_style: normalizePageLayout(pageLayoutStyle ?? template?.page_layout_style),
    sheet_content: Array.isArray(sheetBlocks) ? sheetBlocks : [],
    default_values: nextDefaultValues,
    structure_fields: Array.isArray(fieldsList) ? fieldsList : [],
    structure: structure
      ? {
        document_kind_id: structure.document_kind_id ?? null,
        fields: structure.fields ?? null,
      }
      : null,
  };
}
