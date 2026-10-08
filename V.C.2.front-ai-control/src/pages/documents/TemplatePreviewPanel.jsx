import React, { useState, useEffect, useRef, useCallback } from 'react';
import { documentService } from '../../services/documentService';
import SheetEditor, { BLOCK_TYPES, DEFAULT_TABLE_COLUMNS, FIELD_DISPLAY, FONT_OPTIONS, getTextStyleString, getTextStyleFromBlock } from './SheetEditor';
import { canAddFieldBlock } from './sheetEditorFieldUtils';
import {
  SPREADSHEET_BLOCK_TYPE,
  buildSpreadsheetBlock,
  gridWorkbookToFieldValue,
  mergeSpreadsheetSheetWithDataRows,
  normalizeSpreadsheetFieldValue,
  spreadsheetBlockToGridModel,
  workbookSaveFingerprint,
} from './spreadsheetGridUtils';
import { getSpreadsheetPreviewData, getSpreadsheetAllSheetsPreviewData } from './spreadsheetPreview';
import { normalizeSummaryConfig } from './spreadsheetSummary';
import SpreadsheetTemplatePanel from './SpreadsheetTemplatePanel';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import EditorOverflowMenu from './EditorOverflowMenu';
import chrome from './DocumentEditorChrome.module.css';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import { downloadCsvFile, downloadCsvFilesAsZip, downloadJsonFile, rowsToCsv, sanitizeFilename } from './csvUtils';
import { buildTemplateExportJson } from './buildTemplatePayload';
import TemplateImportExportSection from './TemplateImportExportSection';
import { applyTemplateImport, getTableFieldOptions } from './templateImportUtils';
import { IconClose, IconChevronDown } from './DocumentIcons';
import TemplateFinalPreviewModal from './TemplateFinalPreviewModal';
import PageNumberSettingsForm from './PageNumberSettingsForm';
import { normalizePageNumberStyle } from './documentPageNumber';
import { normalizePageLayout } from './documentPageLayout';
import { buildPdfHtmlFromBlocks, exportHtmlDocumentToPdf, openHtmlPrintWindow } from './documentPdfExport';
import DocumentProjectPicker from './DocumentProjectPicker';
import DepartmentPicker from './DepartmentPicker';
import TemplateAccessSettings from './TemplateAccessSettings';
import SheetBlockAddButton from './SheetBlockAddButton';
import { SheetImageBlockPreview } from './SheetImageBlockPreview';
import { getBlockWrapStyle, getImageBlockNumber } from './sheetImageUtils';
import { resolveTitleTemplate, resolveBlockContent, resolveFieldDataPlaceholders } from './documentPlaceholders';
import { useDocumentPlaceholderVars } from './useDocumentPlaceholderVars';
import { renderResolvedTextLines } from './documentSheetPreviewUtils';
import { normalizeSheetFieldBlocks, resolveTableColumns } from './documentTableColumns';
import { formatScalarFieldPreview, isTableFieldBlock, isTableFieldValue } from './tableFieldUtils';
import styles from './DocumentsApp.module.css';

const TEMPLATE_AUTOSAVE_KEY = 'documents-template-preview-autosave';
const TEMPLATE_AUTOSAVE_DEBOUNCE_MS = 1500;

function readAutosavePreference() {
  try {
    return localStorage.getItem(TEMPLATE_AUTOSAVE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeAutosavePreference(enabled) {
  try {
    localStorage.setItem(TEMPLATE_AUTOSAVE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

const getFieldsList = (structure) => {
  if (!structure || !structure.fields) return [];
  const raw = structure.fields;
  const list = Array.isArray(raw) ? raw : (raw.fields || []);
  const arr = Array.isArray(list) ? list : [];
  return arr.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

/** Плейсхолдер для пустого поля в предпросмотре */
const placeholderForType = (type) => {
  if (type === 'date') return '—';
  if (type === 'number') return '—';
  if (type === 'table') return [];
  return '—';
};

/** Получить значение поля по имени (с поиском по ключу без учёта регистра) */
function getFieldValueForPdf(fieldData, fieldName) {
  if (!fieldName || !fieldData || typeof fieldData !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(fieldData, fieldName)) return fieldData[fieldName];
  const keyLower = String(fieldName).trim().toLowerCase();
  const found = Object.keys(fieldData).find((k) => String(k).trim().toLowerCase() === keyLower);
  return found !== undefined ? fieldData[found] : undefined;
}

const TemplatePreviewPanel = ({
  templateId,
  templateName,
  kindId,
  kindName,
  onClose,
  onEditStructure,
  onCreateFromTemplate,
  onDeleteTemplate,
  /** 'document' — лист с блоками; 'table' — шаблон сетки, другой набор кнопок */
  variant = 'document',
}) => {
  const isTableTemplate = variant === 'table';
  const [template, setTemplate] = useState(null);
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(readAutosavePreference);
  const [autoSaveHint, setAutoSaveHint] = useState(null);
  const [sheetBlocks, setSheetBlocks] = useState([]);
  const [titleTemplate, setTitleTemplate] = useState('');
  const [titleStyle, setTitleStyle] = useState({});
  const [pageNumberStyle, setPageNumberStyle] = useState(() => normalizePageNumberStyle(null));
  const [pageNumberSettingsOpen, setPageNumberSettingsOpen] = useState(false);
  const [pageLayoutStyle, setPageLayoutStyle] = useState(() => normalizePageLayout(null));
  const [titleSettingsExpanded, setTitleSettingsExpanded] = useState(false);
  const [defaultProjectId, setDefaultProjectId] = useState(null);
  const [defaultProjectSaving, setDefaultProjectSaving] = useState(false);
  const [defaultDepartmentId, setDefaultDepartmentId] = useState(null);
  const [defaultDepartmentSaving, setDefaultDepartmentSaving] = useState(false);
  const printRef = useRef(null);
  const sheetEditorRef = useRef(null);
  const [tableGridModel, setTableGridModel] = useState(null);
  const [defaultValues, setDefaultValues] = useState({});
  const [finalPreviewOpen, setFinalPreviewOpen] = useState(false);
  const [importRevision, setImportRevision] = useState(0);

  useEffect(() => {
    if (!template?.id) return;
    const dv = template?.default_values;
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      setDefaultValues({ ...dv });
    } else {
      setDefaultValues({});
    }
  }, [template?.id]);

  useEffect(() => {
    if (!template?.id) return;
    const list = Array.isArray(template?.sheet_content) ? template.sheet_content : [];
    if (list.length > 0) {
      setSheetBlocks(normalizeSheetFieldBlocks(list, getFieldsList(structure)));
    } else {
      setSheetBlocks([]);
    }
  }, [template?.id]);

  useEffect(() => {
    if (!template?.id) return;
    setSheetBlocks((prev) => {
      if (!prev.length) return prev;
      return normalizeSheetFieldBlocks(prev, getFieldsList(structure));
    });
  }, [structure, template?.id]);

  useEffect(() => {
    if (!template) return;
    const defaultTitle = `${template.name || kindName || 'Документ'} — № {номер}`;
    setTitleTemplate(template.title_template != null && template.title_template !== '' ? template.title_template : defaultTitle);
    setTitleStyle(template.title_style && typeof template.title_style === 'object' ? { ...template.title_style } : {});
    setPageNumberStyle(normalizePageNumberStyle(template.page_number_style));
    setPageLayoutStyle(normalizePageLayout(template.page_layout_style));
    setDefaultProjectId(template.default_project_id ?? null);
    setDefaultDepartmentId(template.department_id ?? null);
  }, [template?.id, template?.title_template, template?.title_style, template?.page_number_style, template?.page_layout_style, template?.name, template?.default_project_id, template?.department_id, kindName]);

  // Если у шаблона ещё нет контента листа — заполняем блоки полями из структуры, чтобы лист не был пустым (только листовые шаблоны)
  useEffect(() => {
    if (isTableTemplate) return;
    if (loading || !template || !structure) return;
    const hasSheetContent = Array.isArray(template.sheet_content) && template.sheet_content.length > 0;
    if (hasSheetContent) return;
    const list = getFieldsList(structure);
    if (list.length === 0) return;
    setSheetBlocks((prev) => {
      if (prev.length > 0) return prev;
      return list.map((f) => ({
        type: 'field',
        field_name: f.name,
        displayType: f.type === 'table' ? FIELD_DISPLAY.table : FIELD_DISPLAY.form,
        tableColumns: f.type === 'table'
          ? resolveTableColumns({ field_name: f.name }, f).map((c) => ({ ...c }))
          : undefined,
      }));
    });
  }, [loading, template, structure, isTableTemplate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let t = null;
        if (templateId) {
          t = await documentService.getTemplate(templateId);
          if (cancelled) return;
          setTemplate(t);
        } else if (kindId) {
          setTemplate({ document_kind_id: kindId, name: templateName || kindName });
        }
        const kind = kindId || t?.document_kind_id;
        if (kind) {
          const s = await documentService.getStructureByKindId(kind);
          if (!cancelled) setStructure(s);
        } else {
          setStructure(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.detail || 'Не удалось загрузить шаблон');
          setTemplate(null);
          setStructure(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [templateId, kindId, templateName, kindName]);

  const fieldsList = getFieldsList(structure);
  const canEditTemplate = !templateId || template?.current_user_permission === 'edit';
  const canManageAccess = Boolean(template?.can_manage_access);

  const canAddMoreFieldBlocks = React.useMemo(
    () => canAddFieldBlock(fieldsList, sheetBlocks),
    [fieldsList, sheetBlocks],
  );
  const kind = kindId || template?.document_kind_id;
  const placeholderVars = useDocumentPlaceholderVars({ номер: '—', вид: kindName || '' });
  const title = resolveTitleTemplate(
    titleTemplate || templateName || kindName || 'Шаблон',
    placeholderVars,
  ) || templateName || kindName || 'Шаблон';

  const placeholderData = React.useMemo(() => {
    const data = {};
    fieldsList.forEach((f) => {
      data[f.name] = placeholderForType(f.type);
    });
    Object.keys(defaultValues).forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(defaultValues, k)) {
        data[k] = defaultValues[k];
      }
    });
    return resolveFieldDataPlaceholders(data, placeholderVars);
  }, [fieldsList, defaultValues, placeholderVars]);

  const handleDefaultValueChange = useCallback((fieldName, value) => {
    if (!fieldName) return;
    setDefaultValues((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[fieldName];
      else next[fieldName] = value;
      return next;
    });
  }, []);

  /**
   * Синхронизация сетки с данными, пришедшими с сервера (template + default_values + sheet_content).
   * Без placeholderData в deps: иначе при смене структуры/плейсхолдеров эффект затирает несохранённые правки
   * в предпросмотре (чекбокс заголовка, +строка, B/I, ячейки).
   * Строки шаблона по умолчанию — только из template.default_values для поля блока.
   */
  useEffect(() => {
    if (!isTableTemplate || !template) {
      setTableGridModel(null);
      return;
    }
    const list = Array.isArray(template.sheet_content) ? template.sheet_content : [];
    const b = list[0];
    if (!b || b.type !== SPREADSHEET_BLOCK_TYPE) {
      setTableGridModel(null);
      return;
    }
    const name = b.field_name;
    const dv = template.default_values;
    const fromTemplate = getFieldValueForPdf(dv && typeof dv === 'object' && !Array.isArray(dv) ? dv : {}, name);
    const wb = spreadsheetBlockToGridModel(b);
    if (!wb) {
      setTableGridModel(null);
      return;
    }
    const map = normalizeSpreadsheetFieldValue(fromTemplate, wb.sheets);
    const mergedSheets = wb.sheets.map((sh) => {
      const merged = mergeSpreadsheetSheetWithDataRows(sh, map[sh.id] || []);
      return {
        ...sh,
        rowCount: merged.rowCount,
        colCount: merged.colCount,
        hasHeaderRow: merged.hasHeaderRow,
        cells: merged.cells,
        tableColumns: merged.tableColumns,
        summary: normalizeSummaryConfig(sh.summary, merged.tableColumns),
      };
    });
    setTableGridModel({ sheets: mergedSheets, activeSheetId: wb.activeSheetId });
  }, [isTableTemplate, template?.id, template?.sheet_content, template?.default_values]);

  const handlePrint = useCallback(() => {
    const layout = normalizePageLayout(pageLayoutStyle);
    const previewTitle = `${title} (предпросмотр)`;
    const fullHtml = sheetBlocks.length > 0
      ? buildPdfHtmlFromBlocks(sheetBlocks, placeholderData, previewTitle, titleStyle, layout, placeholderVars)
      : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${printRef.current?.innerHTML ?? ''}</body></html>`;
    openHtmlPrintWindow(fullHtml);
  }, [title, titleStyle, sheetBlocks, placeholderData, pageLayoutStyle, placeholderVars]);

  const handleExportPdf = useCallback(() => {
    const layout = normalizePageLayout(pageLayoutStyle);
    const previewTitle = `${title} (предпросмотр)`;
    const fullHtml = sheetBlocks.length > 0
      ? buildPdfHtmlFromBlocks(sheetBlocks, placeholderData, previewTitle, titleStyle, layout, placeholderVars)
      : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${printRef.current?.innerHTML ?? ''}</body></html>`;
    const filename = `template-${templateId || kind}-${Date.now()}.pdf`;
    exportHtmlDocumentToPdf(fullHtml, { filename, pageLayout: layout }).catch(() => {});
  }, [title, titleStyle, templateId, kind, sheetBlocks, placeholderData, pageLayoutStyle, placeholderVars]);

  const handleExportCsv = useCallback(() => {
    if (!isTableTemplate) return;
    const b = sheetBlocks[0];
    if (!b || b.type !== SPREADSHEET_BLOCK_TYPE) return;
    const fieldData = getFieldValueForPdf(placeholderData, b.field_name);
    const allSheets = getSpreadsheetAllSheetsPreviewData(b, fieldData);
    const base = sanitizeFilename(template?.name || templateName || `template-${templateId || 'export'}`);
    if (allSheets.length > 1) {
      downloadCsvFilesAsZip(
        `${base}.zip`,
        allSheets.map((sheetData, i) => ({
          name: `${sanitizeFilename(sheetData.sheetName || `sheet-${i + 1}`)}.csv`,
          content: rowsToCsv(sheetData.rows, sheetData.columns),
        })),
      ).catch(() => {});
      return;
    }
    if (allSheets.length === 1) {
      downloadCsvFile(`${base}.csv`, rowsToCsv(allSheets[0].rows, allSheets[0].columns));
    }
  }, [isTableTemplate, sheetBlocks, placeholderData, template?.name, templateName, templateId]);

  const handleExportJson = useCallback(() => {
    const payload = buildTemplateExportJson({
      template,
      templateId,
      kindId: kind,
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
    });
    const base = sanitizeFilename(template?.name || templateName || `template-${templateId || kind || 'export'}`);
    downloadJsonFile(`${base}.json`, payload);
  }, [
    template,
    templateId,
    kind,
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
    templateName,
  ]);

  const tableFieldOptions = React.useMemo(
    () => getTableFieldOptions({ isTableTemplate, sheetBlocks, fieldsList }),
    [isTableTemplate, sheetBlocks, fieldsList],
  );

  const handleImportApply = useCallback((options) => {
    const result = applyTemplateImport({
      ...options,
      isTableTemplate,
      fieldsList,
      sheetBlocks,
      defaultValues,
      tableGridModel,
    });
    if (!result.ok) return result;

    const { patch } = result;
    if (patch.defaultValues) {
      setDefaultValues({ ...patch.defaultValues });
    }
    if (patch.sheetBlocks) {
      setSheetBlocks(normalizeSheetFieldBlocks([...patch.sheetBlocks], fieldsList));
    }
    if (patch.tableGridModel) setTableGridModel(patch.tableGridModel);
    if (patch.titleTemplate != null) setTitleTemplate(patch.titleTemplate);
    if (patch.titleStyle) setTitleStyle(patch.titleStyle);
    if (patch.pageNumberStyle) setPageNumberStyle(patch.pageNumberStyle);
    if (patch.pageLayoutStyle) setPageLayoutStyle(patch.pageLayoutStyle);
    setImportRevision((n) => n + 1);
    setSaveMessage(result.message || 'Данные импортированы');
    return result;
  }, [
    isTableTemplate,
    fieldsList,
    sheetBlocks,
    defaultValues,
    tableGridModel,
  ]);

  const handleDefaultProjectChange = async (nextProjectId) => {
    if (!templateId) return;
    setDefaultProjectId(nextProjectId);
    setDefaultProjectSaving(true);
    setError(null);
    try {
      const updated = await documentService.updateTemplate(templateId, {
        default_project_id: nextProjectId,
      });
      setTemplate(updated);
      setDefaultProjectId(updated.default_project_id ?? null);
      setSaveMessage('Проект по умолчанию сохранён');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить проект шаблона');
    } finally {
      setDefaultProjectSaving(false);
    }
  };

  const handleDefaultDepartmentChange = async (nextDepartmentId) => {
    if (!templateId) return;
    setDefaultDepartmentId(nextDepartmentId);
    setDefaultDepartmentSaving(true);
    setError(null);
    try {
      const updated = await documentService.updateTemplate(templateId, {
        department_id: nextDepartmentId,
      });
      setTemplate(updated);
      setDefaultDepartmentId(updated.department_id ?? null);
      setSaveMessage('Отдел шаблона сохранён');
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить отдел шаблона');
    } finally {
      setDefaultDepartmentSaving(false);
    }
  };

  const autosaveFingerprint = React.useMemo(
    () => JSON.stringify({
      // В шаблоне таблицы блок листа пересобирается из сетки при каждой правке — сравниваем саму сетку.
      sheetBlocks: isTableTemplate ? null : sheetBlocks,
      titleTemplate,
      titleStyle,
      pageNumberStyle,
      pageLayoutStyle,
      defaultValues,
      tableGridModel: isTableTemplate ? workbookSaveFingerprint(tableGridModel) : null,
    }),
    [sheetBlocks, titleTemplate, titleStyle, pageNumberStyle, pageLayoutStyle, defaultValues, tableGridModel, isTableTemplate],
  );

  const [propsOpen, setPropsOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const {
    isDirty,
    markClean,
    requestLeave,
    dialogProps: unsavedDialogProps,
  } = useUnsavedChangesGuard({
    fingerprint: autosaveFingerprint,
    ready: !loading && !!template,
    enabled: Boolean(templateId) && canEditTemplate,
    // handleSaveSheet объявлен ниже; вызывается только по клику в диалоге.
    onSave: () => handleSaveSheet(),
  });
  const requestClose = useCallback(() => requestLeave(() => onClose?.()), [requestLeave, onClose]);

  const createFromTemplate = async () => {
    if (!templateId) return;
    setCreating(true);
    setError(null);
    try {
      await documentService.createFromTemplate(templateId);
      onCreateFromTemplate?.();
      onClose?.();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось создать документ');
    } finally {
      setCreating(false);
    }
  };

  // Создание документа и переход к структуре закрывают панель — сначала спрашиваем про несохранённое.
  const handleCreateFromTemplate = () => requestLeave(createFromTemplate);

  /**
   * Отдел шаблона для тех, кто управляет доступом: это режим видимости «Отдел»
   * (пусто — «Вся организация»). Уже выданные отдельные права сохраняются.
   */
  const handleAccessDepartmentChange = async (nextDepartmentId) => {
    if (!templateId) return;
    setDefaultDepartmentId(nextDepartmentId);
    setDefaultDepartmentSaving(true);
    setError(null);
    try {
      const current = await documentService.getTemplateAccess(templateId);
      const currentMode = current?.access_mode || 'org';
      const nextMode = nextDepartmentId ? 'department' : (currentMode === 'restricted' ? 'restricted' : 'org');
      const updated = await documentService.updateTemplateAccess(templateId, {
        access_mode: nextMode,
        department_id: nextMode === 'department' ? nextDepartmentId : null,
        permissions: (Array.isArray(current?.permissions) ? current.permissions : []).map((row) => ({
          subject_type: row.subject_type,
          subject_id: row.subject_id,
          permission: row.permission,
        })),
      });
      setTemplate((prev) => (prev ? { ...prev, ...updated } : prev));
      setDefaultDepartmentId(updated?.department_id ?? null);
      setSaveMessage(nextDepartmentId ? 'Отдел шаблона сохранён — шаблон видит этот отдел' : 'Шаблон снова виден всей организации');
    } catch (e) {
      setDefaultDepartmentId(template?.department_id ?? null);
      setError(e.response?.data?.detail || 'Не удалось сохранить отдел шаблона');
    } finally {
      setDefaultDepartmentSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateId || !onDeleteTemplate) return;
    if (!window.confirm('Удалить шаблон из списка? Версии шаблона останутся в архиве.')) return;
    setDeleting(true);
    setError(null);
    try {
      await documentService.deleteTemplate(templateId);
      onDeleteTemplate();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось удалить шаблон');
    } finally {
      setDeleting(false);
    }
  };

  const handleEditStructure = () => requestLeave(() => {
    if (kind) onEditStructure?.(kind);
    onClose?.();
  });

  const handleSaveSheet = useCallback(async ({ silent = false } = {}) => {
    if (!templateId || !template || savingSheet) return false;
    setError(null);
    if (!silent) setSaveMessage(null);

    const originalTitleTemplate = template.title_template != null && template.title_template !== ''
      ? template.title_template
      : `${template.name || kindName || 'Документ'} — № {номер}`;
    const originalTitleStyle = template.title_style && typeof template.title_style === 'object' ? template.title_style : {};
    const originalPageNumberStyle = normalizePageNumberStyle(template.page_number_style);
    const originalPageLayoutStyle = normalizePageLayout(template.page_layout_style);
    const sheetContentEqual = JSON.stringify(Array.isArray(template.sheet_content) ? template.sheet_content : []) === JSON.stringify(Array.isArray(sheetBlocks) ? sheetBlocks : []);
    const titleTemplateEqual = (titleTemplate || '').trim() === originalTitleTemplate.trim();
    const titleStyleEqual = JSON.stringify(originalTitleStyle) === JSON.stringify(Object.keys(titleStyle).length ? titleStyle : {});
    const pageNumberStyleEqual = JSON.stringify(originalPageNumberStyle) === JSON.stringify(normalizePageNumberStyle(pageNumberStyle));
    const pageLayoutStyleEqual = JSON.stringify(originalPageLayoutStyle) === JSON.stringify(normalizePageLayout(pageLayoutStyle));

    const origDefaults = template?.default_values && typeof template.default_values === 'object' && !Array.isArray(template.default_values) ? template.default_values : {};
    const nextFullDefaultValues = (() => {
      if (isTableTemplate && tableGridModel) {
        const b0 = sheetBlocks[0];
        if (!b0 || b0.type !== SPREADSHEET_BLOCK_TYPE || !b0.field_name) return { ...defaultValues };
        return { ...defaultValues, [b0.field_name]: gridWorkbookToFieldValue(tableGridModel, b0) };
      }
      return { ...defaultValues };
    })();
    const defaultValuesEqual = JSON.stringify(origDefaults) === JSON.stringify(nextFullDefaultValues);

    if (sheetContentEqual && titleTemplateEqual && titleStyleEqual && pageNumberStyleEqual && pageLayoutStyleEqual && defaultValuesEqual) {
      if (!silent) setSaveMessage('Изменений нет. Версия не обновлена.');
      markClean();
      return true;
    }

    setSavingSheet(true);
    try {
      const payload = {
        sheet_content: sheetBlocks,
        title_template: titleTemplate || null,
        title_style: Object.keys(titleStyle).length ? titleStyle : null,
        page_number_style: normalizePageNumberStyle(pageNumberStyle),
        page_layout_style: normalizePageLayout(pageLayoutStyle),
      };
      if (!defaultValuesEqual) {
        payload.default_values = nextFullDefaultValues;
      }
      await documentService.updateTemplate(templateId, payload);
      const t = await documentService.getTemplate(templateId);
      setTemplate(t);
      if (!defaultValuesEqual && t?.default_values && typeof t.default_values === 'object') {
        setDefaultValues({ ...t.default_values });
      }
      if (silent) {
        setAutoSaveHint('Автосохранено');
        window.setTimeout(() => setAutoSaveHint(null), 2000);
      }
      markClean();
      return true;
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить лист');
      return false;
    } finally {
      setSavingSheet(false);
    }
  }, [
    templateId,
    template,
    savingSheet,
    sheetBlocks,
    titleTemplate,
    titleStyle,
    pageNumberStyle,
    pageLayoutStyle,
    defaultValues,
    isTableTemplate,
    tableGridModel,
    kindName,
    markClean,
  ]);

  useEffect(() => {
    if (!autoSaveEnabled || !templateId || loading || !template || !canEditTemplate) return undefined;
    const timer = window.setTimeout(() => {
      handleSaveSheet({ silent: true });
    }, TEMPLATE_AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, templateId, loading, template, autosaveFingerprint, handleSaveSheet, canEditTemplate]);

  const renderFieldValue = (value, type) => {
    if (value === null || value === undefined) return '—';
    if (type === 'table' && Array.isArray(value)) {
      const columns = value.length > 0 ? Object.keys(value[0]) : ['№', 'Наименование', 'Кол-во', 'Цена', 'Сумма'];
      return (
        <table className={styles.printTable}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.length > 0
              ? value.map((row, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={col}>{String(row[col] ?? '—')}</td>
                    ))}
                  </tr>
                ))
              : (
                  <tr>
                    {columns.map((col) => (
                      <td key={col}>—</td>
                    ))}
                  </tr>
                )}
          </tbody>
        </table>
      );
    }
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const documentTitleForm = (metaClassName, style) => (
    <div
      className={[styles.documentTitleField, metaClassName].filter(Boolean).join(' ')}
      style={style}
    >
      <div className={styles.documentTitleFieldMain}>
        <label className={styles.documentTitleFieldLabel} htmlFor="template-title-input">
          Заголовок документа
        </label>
        <input
          id="template-title-input"
          type="text"
          className={`${styles.fieldInput} ${styles.documentTitleFieldInput}`}
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.target.value)}
          placeholder="Заказ клиента — № {номер}"
          title="Используйте {номер}, {вид} и ключи из «Параметров», например {CPP}"
          disabled={!canEditTemplate}
          readOnly={!canEditTemplate}
        />
      </div>
      <div className={styles.documentTitleFieldMeta}>
        <span className={styles.documentTitleFieldHint}>
          {'{номер}'} — номер, {'{вид}'} — вид, {'{CPP}'} и др. — из вкладки «Параметры»
        </span>
        <button
          type="button"
          className={styles.documentTitleFieldToggle}
          onClick={() => setTitleSettingsExpanded((v) => !v)}
          aria-expanded={titleSettingsExpanded}
        >
          {titleSettingsExpanded ? '▲ Скрыть настройки' : '▼ Настройки'}
        </button>
      </div>
      {titleSettingsExpanded && (
        <div className={styles.documentTitleFieldSettings}>
          <div className={styles.sheetStampSizeRow}>
            <label>
              Шрифт:
              <select value={titleStyle.fontFamily || ''} onChange={(e) => setTitleStyle((s) => ({ ...s, fontFamily: e.target.value || undefined }))} className={styles.sheetStampSelect}>
                {FONT_OPTIONS.map((opt) => (
                  <option key={opt.value || 'default'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label>
              Размер: <input type="number" min={10} max={72} value={titleStyle.fontSize ?? 20} onChange={(e) => setTitleStyle((s) => ({ ...s, fontSize: e.target.value ? parseInt(e.target.value, 10) : 20 }))} className={styles.sheetStampNumInput} />
            </label>
            <label>
              Цвет: <input type="color" value={titleStyle.color || '#1e293b'} onChange={(e) => setTitleStyle((s) => ({ ...s, color: e.target.value }))} className={styles.sheetColorInput} title={titleStyle.color || '#1e293b'} />
              <input type="text" value={titleStyle.color || '#1e293b'} onChange={(e) => setTitleStyle((s) => ({ ...s, color: e.target.value || undefined }))} className={styles.sheetColorTextInput} placeholder="#000" />
            </label>
          </div>
          <div className={styles.sheetStampSizeRow}>
            <label className={styles.sheetStampCheckLabel}>
              <input type="checkbox" checked={!!titleStyle.bold} onChange={(e) => setTitleStyle((s) => ({ ...s, bold: e.target.checked }))} />
              Жирный
            </label>
            <label className={styles.sheetStampCheckLabel}>
              <input type="checkbox" checked={!!titleStyle.italic} onChange={(e) => setTitleStyle((s) => ({ ...s, italic: e.target.checked }))} />
              Курсив
            </label>
            <label className={styles.sheetStampCheckLabel}>
              <input type="checkbox" checked={!!titleStyle.underline} onChange={(e) => setTitleStyle((s) => ({ ...s, underline: e.target.checked }))} />
              Подчёркнутый
            </label>
          </div>
          <div className={styles.sheetStampSizeRow}>
            <label>
              Выравнивание:
              <select value={titleStyle.textAlign || 'left'} onChange={(e) => setTitleStyle((s) => ({ ...s, textAlign: e.target.value }))} className={styles.sheetStampSelect}>
                <option value="left">Слева</option>
                <option value="center">По центру</option>
                <option value="right">Справа</option>
                <option value="justify">По ширине</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={styles.editorOverlay}>
        <div className={styles.editorPanel}>
          <p className={styles.placeholder}>Загрузка шаблона…</p>
        </div>
      </div>
    );
  }

  if (!structure && !error) {
    return (
      <div className={styles.editorOverlay}>
        <div className={styles.editorPanel}>
          <p className={styles.placeholder}>Структура шаблона не найдена.</p>
          <button type="button" className={styles.primaryButton} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${styles.editorOverlay} ${isTableTemplate ? styles.editorOverlayTable : ''}`}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={[
          styles.editorPanel,
          styles.editorPanelPreview,
          isTableTemplate && canEditTemplate ? styles.editorPanelAlmostFullscreen : '',
          !canEditTemplate ? styles.editorPanelPreviewViewOnly : '',
        ].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={chrome.header}>
          <div className={chrome.titleBlock}>
            <h2 className={styles.editorTitle}>{title}</h2>
            <div className={chrome.meta}>
              <span>{isTableTemplate ? 'Шаблон таблицы' : 'Шаблон документа'}{template?.version ? ` · v${template.version}` : ''}</span>
              {!canEditTemplate ? (
                <span className={chrome.viewOnlyBadge}>только просмотр</span>
              ) : templateId && (
                <span className={`${chrome.metaDot} ${isDirty ? chrome.dirty : chrome.saved}`} role="status">
                  {savingSheet
                    ? 'Сохранение…'
                    : autoSaveEnabled && autoSaveHint
                      ? autoSaveHint
                      : isDirty
                        ? (autoSaveEnabled ? 'Будет сохранено автоматически' : 'Есть несохранённые изменения')
                        : 'Все изменения сохранены'}
                </span>
              )}
            </div>
          </div>
          <div className={chrome.actions}>
            {templateId && canEditTemplate && (
              <button
                type="button"
                className={`${chrome.ghostBtn} ${propsOpen ? chrome.ghostBtnActive : ''}`}
                onClick={() => setPropsOpen((v) => !v)}
                aria-expanded={propsOpen}
                title="Проект и отдел по умолчанию"
              >
                Свойства
                {(defaultProjectId || defaultDepartmentId) && <span className={chrome.badgeDot} aria-hidden />}
              </button>
            )}
            {templateId && canManageAccess && (
              <button
                type="button"
                className={chrome.ghostBtn}
                onClick={() => setAccessOpen(true)}
                title="Кто видит и может изменять шаблон"
              >
                Доступ
              </button>
            )}
            {templateId && (
              <button
                type="button"
                className={canEditTemplate ? chrome.ghostBtn : `${styles.primaryButton} ${styles.editorSaveBtn}`}
                onClick={handleCreateFromTemplate}
                disabled={creating}
                title={isTableTemplate ? 'Создать таблицу по этому шаблону' : 'Создать документ по этому шаблону'}
              >
                {creating ? 'Создание…' : (isTableTemplate ? 'Создать таблицу' : 'Создать документ')}
              </button>
            )}
            <EditorOverflowMenu
              items={[
                { id: 'final', label: 'Итоговый документ', hint: 'Как будет выглядеть после заполнения', onSelect: () => setFinalPreviewOpen(true) },
                { id: 'structure', label: 'Редактировать структуру', onSelect: handleEditStructure, hidden: !(kind && canEditTemplate) },
                { id: 'print', label: 'Печать', onSelect: handlePrint, separatorBefore: true },
                { id: 'pdf', label: 'Экспорт в PDF', onSelect: handleExportPdf },
                { id: 'json', label: 'Экспорт в JSON', hint: 'Полный снимок шаблона', onSelect: handleExportJson },
                { id: 'csv', label: 'Экспорт в CSV', onSelect: handleExportCsv, hidden: !isTableTemplate },
                { id: 'import', label: 'Импорт JSON / CSV…', onSelect: () => setImportOpen(true), hidden: !canEditTemplate },
                {
                  id: 'autosave',
                  label: 'Автосохранение',
                  hint: 'Через 1,5 с после изменений',
                  checked: autoSaveEnabled,
                  keepOpen: true,
                  separatorBefore: true,
                  hidden: !(templateId && canEditTemplate),
                  onSelect: () => {
                    const next = !autoSaveEnabled;
                    setAutoSaveEnabled(next);
                    writeAutosavePreference(next);
                    if (!next) setAutoSaveHint(null);
                  },
                },
                {
                  id: 'delete',
                  label: deleting ? 'Удаление…' : 'Удалить шаблон',
                  onSelect: handleDeleteTemplate,
                  danger: true,
                  separatorBefore: true,
                  disabled: deleting,
                  hidden: !(templateId && onDeleteTemplate && canEditTemplate),
                },
              ]}
            />
            {templateId && canEditTemplate && (
              <button
                type="button"
                className={`${styles.primaryButton} ${styles.editorSaveBtn} ${!isDirty && !savingSheet ? chrome.saveBtnClean : ''}`}
                onClick={() => handleSaveSheet()}
                disabled={savingSheet}
                title={isDirty ? 'Сохранить изменения шаблона' : 'Изменений нет'}
              >
                {savingSheet ? 'Сохранение…' : 'Сохранить'}
              </button>
            )}
            <button type="button" className={chrome.iconBtn} onClick={requestClose} aria-label="Закрыть" title="Закрыть">
              <IconClose size={18} />
            </button>
          </div>
        </div>
        {propsOpen && templateId && canEditTemplate && (
          <div className={chrome.propsPanel}>
            <div className={chrome.propsField}>
              <DocumentProjectPicker
                variant="button"
                value={defaultProjectId}
                onChange={handleDefaultProjectChange}
                saving={defaultProjectSaving}
                label="Проект по умолчанию"
                hint="Все документы, созданные по этому шаблону, будут автоматически привязаны к выбранному проекту."
                buttonPlaceholder="Не выбран — нажмите для выбора"
              />
            </div>
            <div className={chrome.propsField}>
              <DepartmentPicker
                variant="button"
                value={defaultDepartmentId}
                onChange={canManageAccess ? handleAccessDepartmentChange : handleDefaultDepartmentChange}
                saving={defaultDepartmentSaving}
                label="Отдел"
                hint={canManageAccess
                  ? 'Шаблон увидят сотрудники отдела. Пусто — вся организация. Подробнее — в «Доступ».'
                  : 'Пусто — общий шаблон. Указанный отдел ограничит видимость.'}
                buttonPlaceholder="Не выбран — нажмите для выбора"
              />
            </div>
            {!isTableTemplate && (
              <div className={`${styles.pageNumberSettings} ${chrome.propsSection}`}>
                <button
                  type="button"
                  className={`${styles.pageNumberSettingsToggle}${pageNumberSettingsOpen ? ` ${styles.pageNumberSettingsToggleOpen}` : ''}`}
                  onClick={() => setPageNumberSettingsOpen((v) => !v)}
                  aria-expanded={pageNumberSettingsOpen}
                  aria-controls="template-page-number-settings"
                >
                  <span
                    className={`${styles.pageNumberSettingsToggleIcon}${pageNumberSettingsOpen ? ` ${styles.pageNumberSettingsToggleIconOpen}` : ''}`}
                    aria-hidden
                  >
                    <IconChevronDown size={16} />
                  </span>
                  <span className={styles.pageNumberSettingsToggleTitle}>Нумерация страниц</span>
                  {pageNumberStyle.enabled && (
                    <span className={styles.pageNumberSettingsBadge}>Вкл</span>
                  )}
                </button>
                {pageNumberSettingsOpen && (
                  <div id="template-page-number-settings">
                    <PageNumberSettingsForm
                      value={pageNumberStyle}
                      onChange={setPageNumberStyle}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {importOpen && canEditTemplate && !loading && (template || structure) && (
          <div className={chrome.dockPanel}>
            <div className={chrome.dockPanelHeader}>
              <h3 className={chrome.dockPanelTitle}>Импорт JSON / CSV</h3>
              <button type="button" className={chrome.iconBtn} onClick={() => setImportOpen(false)} aria-label="Закрыть импорт">
                <IconClose size={16} />
              </button>
            </div>
            <TemplateImportExportSection
              importOnly
              isTableTemplate={isTableTemplate}
              canImport={canEditTemplate}
              tableFieldOptions={tableFieldOptions}
              onExportPrint={handlePrint}
              onExportPdf={handleExportPdf}
              onExportJson={handleExportJson}
              onExportCsv={handleExportCsv}
              showCsvExport={isTableTemplate}
              onImportApply={handleImportApply}
            />
          </div>
        )}
        {error && <div className={styles.error} role="alert">{error}</div>}
        {templateId && !canEditTemplate && (
          <div className={styles.infoMessage} role="status">
            У вас доступ только для просмотра этого шаблона. Создать документ можно, изменения сохранить нельзя.
          </div>
        )}
        {saveMessage && <div className={styles.infoMessage} role="status">{saveMessage}</div>}
        {templateId && canEditTemplate && !isTableTemplate && (
          <div className={`${styles.editorActions} ${styles.editorActionsRow} ${styles.sheetToolbar}`} style={{ marginTop: 0 }}>
            <SheetBlockAddButton blockType="text" onClick={() => sheetEditorRef.current?.addBlock(BLOCK_TYPES.text)} />
            {canAddMoreFieldBlocks && (
              <SheetBlockAddButton blockType="field" onClick={() => sheetEditorRef.current?.addBlock(BLOCK_TYPES.field)} />
            )}
            <SheetBlockAddButton blockType="page_break" onClick={() => sheetEditorRef.current?.addBlock(BLOCK_TYPES.page_break)} />
            <SheetBlockAddButton blockType="stamp" onClick={() => sheetEditorRef.current?.addBlock(BLOCK_TYPES.stamp)} />
            <SheetBlockAddButton blockType="image" onClick={() => sheetEditorRef.current?.addBlock(BLOCK_TYPES.image)} />
          </div>
        )}
        {templateId && (
          <TemplateAccessSettings
            templateId={templateId}
            template={template}
            open={accessOpen}
            onClose={() => setAccessOpen(false)}
            onUpdated={(updated) => {
              setTemplate((prev) => (prev ? { ...prev, ...updated } : prev));
              if (updated && Object.prototype.hasOwnProperty.call(updated, 'department_id')) {
                setDefaultDepartmentId(updated.department_id ?? null);
              }
              setSaveMessage('Права доступа сохранены');
            }}
          />
        )}
        <div
          className={[
            styles.editorBody,
            isTableTemplate ? styles.editorBodyTableTemplate : '',
            !canEditTemplate ? styles.editorBodyViewOnly : '',
          ].filter(Boolean).join(' ')}
        >
          {isTableTemplate ? (
            <>
              {tableGridModel ? (
                <div className={styles.tableTemplatePreviewWrap}>
                  <SpreadsheetTemplatePanel
                    key={importRevision}
                    model={tableGridModel}
                    onChange={canEditTemplate ? (model) => {
                      setTableGridModel(model);
                      const b0 = sheetBlocks[0];
                      const fieldName = b0?.field_name || fieldsList.find((f) => f.type === 'table')?.name || 'Данные';
                      setSheetBlocks([buildSpreadsheetBlock(fieldName, model)]);
                    } : undefined}
                  />
                </div>
              ) : (
                <p className={styles.tableTemplateLoading}>Загрузка сетки…</p>
              )}
              {templateId && canEditTemplate && documentTitleForm(styles.tableTemplateMetaSection)}
            </>
          ) : (
            <>
              {templateId && canEditTemplate && documentTitleForm(null)}
              <SheetEditor
                key={importRevision}
                ref={sheetEditorRef}
                blocks={sheetBlocks}
                onBlocksChange={setSheetBlocks}
                availableFields={fieldsList}
                fieldValues={placeholderData}
                defaultValues={defaultValues}
                onDefaultValueChange={handleDefaultValueChange}
                readOnly={!canEditTemplate}
                documentTitle={title}
                documentTitleStyle={titleStyle}
                toolbarOutside
              />
            </>
          )}
        </div>
        <div ref={printRef} className={styles.printContent} aria-hidden="true">
          <div className={styles.sheetPrintTitle}>{title} (предпросмотр)</div>
          {sheetBlocks.length > 0 ? (
            <div className={styles.sheetPageInner}>
              {sheetBlocks.flatMap((block, index) => {
                if (block.type === 'page_break') {
                  return [(
                    <div key={index} className={styles.sheetPageBreak} style={{ pageBreakAfter: 'always' }}>
                      — Разрыв страницы —
                    </div>
                  )];
                }
                if (block.type === SPREADSHEET_BLOCK_TYPE) {
                  const fieldData = block.field_name != null ? placeholderData[block.field_name] : undefined;
                  const allSheets = getSpreadsheetAllSheetsPreviewData(block, fieldData);
                  const fieldStyle = getTextStyleFromBlock(block);
                  return allSheets.map((sheetData, sheetIdx) => (
                    <div key={`${index}-${sheetData.sheetId}`} className={styles.sheetPageField} style={fieldStyle}>
                      <span className={styles.sheetPageFieldLabel} style={fieldStyle}>
                        {sheetData.sheetName || sheetData.fieldName || 'Таблица'}
                      </span>
                      <div className={styles.sheetPageFieldValue} style={fieldStyle}>
                        <table className={styles.printTable}>
                          <thead>
                            <tr>
                              {sheetData.columns.map((col, ci) => (
                                <th key={col.key || ci}>{col.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sheetData.rows.length > 0
                              ? sheetData.rows.map((row, i) => (
                                  <tr key={i}>
                                    {sheetData.columns.map((col, ci) => (
                                      <td key={col.key || ci}>{String(row[col.key] ?? '—')}</td>
                                    ))}
                                  </tr>
                                ))
                              : (
                                  <tr>
                                    {sheetData.columns.map((col, ci) => (
                                      <td key={col.key || ci}>—</td>
                                    ))}
                                  </tr>
                                )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ));
                }
                if (block.type === 'field') {
                  const fieldMeta = fieldsList.find((f) => f.name === block.field_name);
                  const rawValue = block.field_name ? placeholderData[block.field_name] : null;
                  const isTable = isTableFieldBlock(block, fieldsList) || isTableFieldValue(rawValue);
                  const value = rawValue ?? (isTable ? [] : '_______________');
                  const fieldStyle = getTextStyleFromBlock(block);

                  if (isTable) {
                    const rows = Array.isArray(value) ? value : [];
                    const columns = resolveTableColumns(block, fieldMeta);
                    return [(
                      <div key={index} className={styles.sheetPageField} style={fieldStyle}>
                        <span className={styles.sheetPageFieldLabel} style={fieldStyle}>{block.field_name || '(поле)'}</span>
                        <div className={styles.sheetPageFieldValue} style={fieldStyle}>
                          <table className={styles.printTable}>
                            <thead>
                              <tr>
                                {columns.map((col, ci) => (
                                  <th key={ci}>{col.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length > 0
                                ? rows.map((row, i) => (
                                    <tr key={i}>
                                      {columns.map((col, ci) => (
                                        <td key={ci}>{String(row[col.key] ?? '—')}</td>
                                      ))}
                                    </tr>
                                  ))
                                : (
                                    <tr>
                                      {columns.map((col, ci) => (
                                        <td key={ci}>—</td>
                                      ))}
                                    </tr>
                                  )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )];
                  }
                  return [(
                    <div key={index} className={styles.sheetPageField} style={fieldStyle}>
                      <span className={styles.sheetPageFieldLabel} style={fieldStyle}>{block.field_name || '(поле)'}</span>
                      <span className={styles.sheetPageFieldValue} style={fieldStyle}>{formatScalarFieldPreview(value)}</span>
                    </div>
                  )];
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
                  return [(
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
                  )];
                }
                if (block.type === 'image') {
                  return [(
                    <SheetImageBlockPreview
                      key={index}
                      block={block}
                      imageNumber={getImageBlockNumber(block, sheetBlocks)}
                      styles={styles}
                      placeholderVars={placeholderVars}
                    />
                  )];
                }
                return [(
                  <React.Fragment key={index}>
                    {renderResolvedTextLines(block.content, placeholderVars, {
                      className: styles.sheetPageText,
                      style: getTextStyleFromBlock(block),
                    })}
                  </React.Fragment>
                )];
              })}
            </div>
          ) : (
            fieldsList.map((f) => (
              <div key={f.name} className={styles.printField}>
                <div className={styles.printFieldLabel}>{f.name}</div>
                <div className={styles.printFieldValue}>
                  {renderFieldValue(placeholderData[f.name], f.type)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <TemplateFinalPreviewModal
        open={finalPreviewOpen}
        onClose={() => setFinalPreviewOpen(false)}
        sheetBlocks={sheetBlocks}
        fieldData={placeholderData}
        title={title}
        titleStyle={titleStyle}
        pageNumberStyle={pageNumberStyle}
        pageLayout={pageLayoutStyle}
        onPageLayoutChange={setPageLayoutStyle}
        structure={structure}
        placeholderVars={placeholderVars}
      />
      <UnsavedChangesDialog
        {...unsavedDialogProps}
        entityLabel={isTableTemplate ? 'шаблоне таблицы' : 'шаблоне'}
        entityName={template?.name || templateName}
      />
    </div>
  );
};

export default TemplatePreviewPanel;
