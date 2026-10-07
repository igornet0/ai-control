import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { documentService } from '../../services/documentService';
import { DEFAULT_TABLE_COLUMNS, FIELD_DISPLAY, getTextStyleString, getTextStyleFromBlock } from './SheetEditor';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';
import { getSpreadsheetPreviewData, getSpreadsheetAllSheetsPreviewData } from './spreadsheetPreview';
import { isSpreadsheetTemplate } from './templateTypeUtils';
import { resolveTableColumns } from './documentTableColumns';
import {
  buildKeepEmptyRowsByFieldName,
  normalizeTableFieldValueForDocumentSave,
} from './tableFieldUtils';
import SpreadsheetDocumentGrid from './SpreadsheetDocumentGrid';
import EditableTable from './EditableTable';
import { rowsToCsv, sanitizeFilename, downloadCsvFile, downloadCsvFilesAsZip } from './csvUtils';
import { buildExpandedPreviewPages, isTableBlock } from './documentPagination';
import SheetPreviewPager from './SheetPreviewPager';
import { IconClose, IconChevronLeft, IconChevronRight } from './DocumentIcons';
import SheetPage from './SheetPage';
import { normalizePageNumberStyle } from './documentPageNumber';
import { getMaxPreviewWidthPx, normalizePageLayout } from './documentPageLayout';
import { buildPdfHtmlFromBlocks, buildPdfHtmlFromFields, exportHtmlDocumentToPdf, openHtmlPrintWindow } from './documentPdfExport';
import { SheetImageBlockPreview } from './SheetImageBlockPreview';
import { getBlockWrapStyle, getImageBlockNumber } from './sheetImageUtils';
import DocumentProjectPicker from './DocumentProjectPicker';
import DepartmentPicker from './DepartmentPicker';
import DocumentShareLinkModal from './DocumentShareLinkModal';
import DocumentProposalReviewPanel from './DocumentProposalReviewPanel';
import DocumentRevisionRollbackPanel from './DocumentRevisionRollbackPanel';
import DocumentAiAssistant from './DocumentAiAssistant';
import { countAvailableRollbacks } from './documentRevisionUtils';
import { resolveTitleTemplate, resolveBlockContent, resolveFieldValuePlaceholders } from './documentPlaceholders';
import { useDocumentPlaceholderVars } from './useDocumentPlaceholderVars';
import { renderResolvedTextLines } from './documentSheetPreviewUtils';
import UnsavedChangesDialog from './UnsavedChangesDialog';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import styles from './DocumentsApp.module.css';

const getFieldsList = (structure) => {
  if (!structure || !structure.fields) return [];
  const raw = structure.fields;
  const list = Array.isArray(raw) ? raw : (raw.fields || []);
  const arr = Array.isArray(list) ? list : [];
  return arr.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

/** Получить значение поля из fieldData по имени (с поиском по ключу без учёта регистра) */
function getFieldValueForPdf(fieldData, fieldName) {
  if (!fieldName || !fieldData || typeof fieldData !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(fieldData, fieldName)) return fieldData[fieldName];
  const keyLower = String(fieldName).trim().toLowerCase();
  const found = Object.keys(fieldData).find((k) => String(k).trim().toLowerCase() === keyLower);
  return found !== undefined ? fieldData[found] : undefined;
}

function dedupeFieldBlocksByName(blocks) {
  const seen = new Set();
  return blocks.filter((b) => {
    const name = b.field_name;
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

const MOBILE_EDITOR_MQ = '(max-width: 900px)';
const FIELDS_PANEL_STORAGE_KEY = 'documents-editor-fields-panel-open';

function readFieldsPanelPreference() {
  try {
    const v = localStorage.getItem(FIELDS_PANEL_STORAGE_KEY);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

function writeFieldsPanelPreference(open) {
  try {
    localStorage.setItem(FIELDS_PANEL_STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function useMobileEditorLayout() {
  const [isMobile, setIsMobile] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia(MOBILE_EDITOR_MQ).matches : false),
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_EDITOR_MQ);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

const DocumentEditorPanel = ({
  documentId,
  kindName,
  onClose,
  onSaved,
  onDeleted,
  overlayZIndex = 10000,
  initialReviewOpen = false,
  onOpenTemplate,
}) => {
  const [doc, setDoc] = useState(null);
  const [structure, setStructure] = useState(null);
  const [sheetBlocks, setSheetBlocks] = useState(null);
  const [documentTitleTemplate, setDocumentTitleTemplate] = useState(null);
  const [documentTitleStyle, setDocumentTitleStyle] = useState(null);
  const [documentPageNumberStyle, setDocumentPageNumberStyle] = useState(null);
  const [documentPageLayoutStyle, setDocumentPageLayoutStyle] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  /** Заголовок, выставленный из документа/шаблона (не пользователем) — эталон для «есть изменения». */
  const [autoDocumentTitle, setAutoDocumentTitle] = useState('');
  const [fieldData, setFieldData] = useState({});
  const [templateVersions, setTemplateVersions] = useState([]);
  const [sourceTemplate, setSourceTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const renderInPortal = (node) => {
    if (typeof document === 'undefined') return node;
    return createPortal(node, document.body);
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const [departmentId, setDepartmentId] = useState(null);
  const [departmentSaving, setDepartmentSaving] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(initialReviewOpen);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [pendingProposalsCount, setPendingProposalsCount] = useState(0);
  const [availableRollbacksCount, setAvailableRollbacksCount] = useState(0);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [fieldsPanelOpen, setFieldsPanelOpen] = useState(readFieldsPanelPreference);
  const isMobile = useMobileEditorLayout();
  const printRef = useRef(null);
  const previewScrollRef = useRef(null);
  const previewPageRefs = useRef([]);
  const skipScrollSync = useRef(false);
  const fieldsScrollRef = useRef(null);

  useEffect(() => {
    if (!isMobile) setMobilePreviewOpen(false);
  }, [isMobile]);

  useEffect(() => {
    setPreviewPageIndex(0);
  }, [documentId, sheetBlocks]);

  useEffect(() => {
    setReviewOpen(initialReviewOpen);
  }, [documentId, initialReviewOpen]);

  const editFingerprint = useMemo(
    () => JSON.stringify({
      fieldData,
      title: documentTitle === autoDocumentTitle ? null : documentTitle,
    }),
    [fieldData, documentTitle, autoDocumentTitle],
  );
  const {
    markClean,
    requestLeave,
    dialogProps: unsavedDialogProps,
  } = useUnsavedChangesGuard({
    fingerprint: editFingerprint,
    ready: !loading && !!doc,
    // handleSave объявлен ниже; вызывается только по клику в диалоге.
    onSave: () => handleSave(),
  });
  const requestClose = useCallback(() => requestLeave(() => onClose?.()), [requestLeave, onClose]);

  const refreshAvailableRollbacks = useCallback(async () => {
    try {
      const revisions = await documentService.getRevisions(documentId);
      setAvailableRollbacksCount(countAvailableRollbacks(revisions, fieldData, documentTitle));
    } catch {
      setAvailableRollbacksCount(0);
    }
  }, [documentId, fieldData, documentTitle]);

  useEffect(() => {
    refreshAvailableRollbacks();
  }, [refreshAvailableRollbacks]);

  useEffect(() => {
    if (availableRollbacksCount === 0) setRollbackOpen(false);
  }, [availableRollbacksCount]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSheetBlocks(null);
    documentService
      .getDocument(documentId)
      .then(async (data) => {
        if (cancelled) return;
        setDoc(data);
        setFieldData(data.field_data || {});
        setProjectId(data.project_id ?? null);
        setDepartmentId(data.department_id ?? null);
        setPendingProposalsCount(data.pending_proposals_count ?? 0);
        if (!data.template_id) {
          setDocumentTitleTemplate(null);
          setDocumentTitleStyle(null);
          setSourceTemplate(null);
        }
        if (data.document_kind_id) {
          const s = await documentService.getStructureByKindId(data.document_kind_id);
          if (!cancelled) setStructure(s);
        } else {
          setStructure(null);
        }
        if (data.template_id) {
          let liveTemplate = null;
          try {
            liveTemplate = await documentService.getTemplate(data.template_id);
          } catch {
            liveTemplate = null;
          }
          if (!cancelled) setSourceTemplate(liveTemplate);
          try {
            const t = data.template_version
              ? await documentService.getTemplateVersion(data.template_id, data.template_version)
              : liveTemplate;
            if (!cancelled && t) {
              if (Array.isArray(t.sheet_content) && t.sheet_content.length > 0) {
                setSheetBlocks(t.sheet_content);
              }
              setDocumentTitleTemplate(t.title_template != null && t.title_template !== '' ? t.title_template : null);
              setDocumentTitleStyle(t.title_style && typeof t.title_style === 'object' ? t.title_style : null);
              setDocumentPageNumberStyle(t.page_number_style && typeof t.page_number_style === 'object' ? t.page_number_style : null);
              setDocumentPageLayoutStyle(t.page_layout_style && typeof t.page_layout_style === 'object' ? t.page_layout_style : null);
            }
          } catch {
            // без шаблона работаем по структуре
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.response?.data?.detail || 'Не удалось загрузить документ');
          setDoc(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [documentId]);

  useEffect(() => {
    if (!doc?.template_id) {
      setTemplateVersions([]);
      return;
    }
    let cancelled = false;
    documentService
      .getTemplateVersions(doc.template_id)
      .then((list) => { if (!cancelled) setTemplateVersions(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setTemplateVersions([]); });
    return () => { cancelled = true; };
  }, [doc?.template_id]);

  const fieldsList = getFieldsList(structure);

  const hasTableFields = useMemo(() => {
    if (sheetBlocks?.length) {
      return sheetBlocks.some(
        (b) => b.field_name
          && (
            b.type === SPREADSHEET_BLOCK_TYPE
            || (b.type === 'field' && (b.displayType || FIELD_DISPLAY.form) === FIELD_DISPLAY.table)
          )
      );
    }
    return fieldsList.some((f) => f.type === 'table');
  }, [sheetBlocks, fieldsList]);

  const isTableDocument = useMemo(
    () => isSpreadsheetTemplate({ sheet_content: Array.isArray(sheetBlocks) ? sheetBlocks : [] }),
    [sheetBlocks],
  );

  const placeholderVars = useDocumentPlaceholderVars({
    номер: doc?.number ?? documentId,
    вид: kindName || '',
  });

  const pageLayout = useMemo(() => normalizePageLayout(documentPageLayoutStyle), [documentPageLayoutStyle]);
  const previewMaxWidth = useMemo(() => getMaxPreviewWidthPx(pageLayout), [pageLayout]);

  const previewPages = useMemo(() => {
    if (sheetBlocks?.length > 0) {
      return buildExpandedPreviewPages(sheetBlocks, fieldData, { pageLayout, placeholderVars });
    }
    return null;
  }, [sheetBlocks, fieldData, pageLayout, placeholderVars]);

  const totalPreviewPages = previewPages?.length ?? 1;
  const showPageNumbers = normalizePageNumberStyle(documentPageNumberStyle).enabled && totalPreviewPages > 0;

  useEffect(() => {
    if (previewPageIndex >= totalPreviewPages) {
      setPreviewPageIndex(Math.max(0, totalPreviewPages - 1));
    }
  }, [previewPageIndex, totalPreviewPages]);

  useEffect(() => {
    if (isTableDocument || !previewPages?.length) return undefined;
    const root = previewScrollRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (skipScrollSync.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const idx = Number(visible[0].target.dataset.pageIndex);
          if (!Number.isNaN(idx)) setPreviewPageIndex(idx);
        }
      },
      { root, threshold: [0.25, 0.5, 0.75], rootMargin: '-8% 0px -8% 0px' },
    );

    previewPageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isTableDocument, previewPages]);

  useEffect(() => {
    fieldsScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [previewPageIndex]);

  const goToPreviewPage = useCallback((page) => {
    const idx = Math.min(totalPreviewPages - 1, Math.max(0, page - 1));
    setPreviewPageIndex(idx);
    skipScrollSync.current = true;
    previewPageRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      skipScrollSync.current = false;
    }, 450);
  }, [totalPreviewPages]);

  const toggleFieldsPanel = useCallback(() => {
    setFieldsPanelOpen((open) => {
      const next = !open;
      writeFieldsPanelPreference(next);
      return next;
    });
  }, []);

  const formBlocksForPage = useMemo(() => {
    if (!sheetBlocks?.length) return [];
    const fieldBlocks = sheetBlocks.filter(
      (b) => b.field_name && (b.type === 'field' || b.type === SPREADSHEET_BLOCK_TYPE),
    );
    if (!previewPages || previewPages.length <= 1) {
      return dedupeFieldBlocksByName(fieldBlocks);
    }
    const currentPage = previewPages[previewPageIndex] || { blocks: [] };
    const fieldNamesOnPage = new Set();
    currentPage.blocks.forEach(({ block }) => {
      if (!block?.field_name) return;
      if (block.type === 'field' || block.type === SPREADSHEET_BLOCK_TYPE) {
        fieldNamesOnPage.add(block.field_name);
      }
    });
    const matched = fieldBlocks.filter((b) => fieldNamesOnPage.has(b.field_name));
    return dedupeFieldBlocksByName(matched);
  }, [sheetBlocks, previewPages, previewPageIndex]);

  const exportAllTablesCsv = useCallback(() => {
    if (!doc) return;
    const base = sanitizeFilename(documentTitle || `document-${doc.id}`);
    let delay = 0;
    const scheduleCsv = (filename, csvText) => {
      setTimeout(() => downloadCsvFile(filename, csvText), delay);
      delay += 200;
    };
    const scheduleZip = (zipName, files) => {
      setTimeout(() => {
        downloadCsvFilesAsZip(zipName, files).catch(() => {});
      }, delay);
      delay += 200;
    };
    if (sheetBlocks?.length) {
      sheetBlocks.forEach((block) => {
        if (!block.field_name) return;
        if (block.type === SPREADSHEET_BLOCK_TYPE) {
          const raw = fieldData[block.field_name];
          const allSheets = getSpreadsheetAllSheetsPreviewData(block, raw);
          const fieldBase = `${base}_${sanitizeFilename(block.field_name)}`;
          if (allSheets.length > 1) {
            scheduleZip(
              `${fieldBase}.zip`,
              allSheets.map((sheetData, i) => ({
                name: `${sanitizeFilename(sheetData.sheetName || `sheet-${i + 1}`)}.csv`,
                content: rowsToCsv(sheetData.rows, sheetData.columns),
              })),
            );
          } else if (allSheets.length === 1) {
            scheduleCsv(
              `${fieldBase}.csv`,
              rowsToCsv(allSheets[0].rows, allSheets[0].columns),
            );
          }
          return;
        }
        if (block.type !== 'field') return;
        const displayType = block.displayType || FIELD_DISPLAY.form;
        if (displayType !== FIELD_DISPLAY.table) return;
        const meta = fieldsList.find((x) => x.name === block.field_name);
        const cols = resolveTableColumns(block, meta);
        const raw = fieldData[block.field_name];
        const rows = Array.isArray(raw) ? raw : [];
        scheduleCsv(`${base}_${sanitizeFilename(block.field_name)}.csv`, rowsToCsv(rows, cols));
      });
    } else {
      fieldsList.forEach((f) => {
        if (f.type !== 'table') return;
        const cols = resolveTableColumns(null, f);
        const raw = fieldData[f.name];
        const rows = Array.isArray(raw) ? raw : [];
        scheduleCsv(`${base}_${sanitizeFilename(f.name)}.csv`, rowsToCsv(rows, cols));
      });
    }
  }, [doc, documentTitle, sheetBlocks, fieldsList, fieldData]);

  useEffect(() => {
    if (!doc) return;
    const computed = resolveTitleTemplate(
      documentTitleTemplate || `${kindName} — № {номер}`,
      placeholderVars,
    ) || `${kindName} — № ${doc?.number ?? documentId}`;
    const nextTitle = (doc.title != null && doc.title !== '') ? doc.title : computed;
    setDocumentTitle(nextTitle);
    setAutoDocumentTitle(nextTitle);
  }, [doc, doc?.title, documentTitleTemplate, kindName, documentId, placeholderVars]);

  const handleVersionChange = useCallback(async (newVersion) => {
    if (!doc?.template_id || !newVersion) return;
    setError(null);
    try {
      const updated = await documentService.updateDocument(documentId, { template_version: newVersion });
      setDoc(updated);
      const t = await documentService.getTemplateVersion(doc.template_id, newVersion);
      if (Array.isArray(t.sheet_content) && t.sheet_content.length > 0) {
        setSheetBlocks(t.sheet_content);
      } else {
        setSheetBlocks(null);
      }
      setDocumentTitleTemplate(t.title_template != null && t.title_template !== '' ? t.title_template : null);
      setDocumentTitleStyle(t.title_style && typeof t.title_style === 'object' ? t.title_style : null);
      setDocumentPageNumberStyle(t.page_number_style && typeof t.page_number_style === 'object' ? t.page_number_style : null);
      setDocumentPageLayoutStyle(t.page_layout_style && typeof t.page_layout_style === 'object' ? t.page_layout_style : null);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сменить версию');
    }
  }, [documentId, doc?.template_id]);

  const handleDelete = useCallback(() => {
    if (!window.confirm('Удалить этот документ? Действие нельзя отменить.')) return;
    setError(null);
    documentService
      .deleteDocument(documentId)
      .then(() => {
        onDeleted?.();
        onClose?.();
      })
      .catch((e) => {
        setError(e.response?.data?.detail || 'Не удалось удалить документ');
      });
  }, [documentId, onDeleted, onClose]);

  const handleProjectChange = useCallback(async (nextProjectId) => {
    setProjectId(nextProjectId);
    setProjectSaving(true);
    setError(null);
    try {
      const updated = await documentService.updateDocument(documentId, {
        project_id: nextProjectId,
      });
      setDoc(updated);
      setProjectId(updated.project_id ?? null);
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось обновить проект');
    } finally {
      setProjectSaving(false);
    }
  }, [documentId, onSaved]);

  const handleDepartmentChange = useCallback(async (nextDepartmentId) => {
    setDepartmentId(nextDepartmentId);
    setDepartmentSaving(true);
    setError(null);
    try {
      const updated = await documentService.updateDocument(documentId, {
        department_id: nextDepartmentId,
      });
      setDoc(updated);
      setDepartmentId(updated.department_id ?? null);
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось обновить отдел');
    } finally {
      setDepartmentSaving(false);
    }
  }, [documentId, onSaved]);

  const handleProposalReviewChanged = useCallback(async () => {
    try {
      const updated = await documentService.getDocument(documentId);
      setDoc(updated);
      setFieldData(updated.field_data || {});
      setDocumentTitle(updated.title || '');
      setAutoDocumentTitle(updated.title || '');
      setPendingProposalsCount(updated.pending_proposals_count ?? 0);
      markClean();
      await refreshAvailableRollbacks();
      onSaved?.();
    } catch {
      // ignore refresh errors
    }
  }, [documentId, onSaved, refreshAvailableRollbacks, markClean]);

  const handleFieldChange = useCallback((fieldName, value) => {
    setFieldData((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const keepEmptyByField = buildKeepEmptyRowsByFieldName(sheetBlocks);
      const processedFieldData = { ...fieldData };
      fieldsList.forEach((f) => {
        if (f.type !== 'table') return;
        const val = processedFieldData[f.name];
        if (!Array.isArray(val)) return;
        const block = sheetBlocks?.find((b) => b.type === 'field' && b.field_name === f.name);
        const cols = resolveTableColumns(block, f);
        processedFieldData[f.name] = normalizeTableFieldValueForDocumentSave(val, cols, {
          keepEmptyRows: keepEmptyByField[f.name] === true,
        });
      });
      await documentService.updateDocument(documentId, { field_data: processedFieldData, title: documentTitle });
      setFieldData(processedFieldData);
      setDoc((prev) => (prev ? { ...prev, title: documentTitle } : null));
      markClean();
      onSaved?.();
      return true;
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const docTitleStyleObj = documentTitleStyle && Object.keys(documentTitleStyle).length > 0 ? getTextStyleFromBlock({ textStyle: documentTitleStyle }) : undefined;

  /** Заголовок на листе (предпросмотр, печать, PDF) — всегда по шаблону, не зависит от редактируемого заголовка вверху */
  const sheetTitle = resolveTitleTemplate(
    documentTitleTemplate || `${kindName} — № {номер}`,
    placeholderVars,
  ) || `${kindName} — № ${doc?.number ?? documentId}`;

  const handlePrint = useCallback(() => {
    const title = sheetTitle;
    const layout = normalizePageLayout(documentPageLayoutStyle);
    const fullHtml = sheetBlocks?.length > 0
      ? buildPdfHtmlFromBlocks(sheetBlocks, fieldData, title, documentTitleStyle || undefined, layout, placeholderVars)
      : buildPdfHtmlFromFields(fieldsList, fieldData, title, layout);
    openHtmlPrintWindow(fullHtml);
  }, [fieldsList, fieldData, sheetBlocks, sheetTitle, documentTitleStyle, documentPageLayoutStyle, placeholderVars]);

  const handleExportPdf = useCallback(() => {
    const title = sheetTitle;
    const layout = normalizePageLayout(documentPageLayoutStyle);
    const fullHtml = sheetBlocks?.length > 0
      ? buildPdfHtmlFromBlocks(sheetBlocks, fieldData, title, documentTitleStyle || undefined, layout, placeholderVars)
      : buildPdfHtmlFromFields(fieldsList, fieldData, title, layout);
    const filename = `document-${documentId}-${Date.now()}.pdf`;
    exportHtmlDocumentToPdf(fullHtml, { filename, pageLayout: layout }).catch(() => {});
  }, [documentId, fieldsList, fieldData, sheetBlocks, sheetTitle, documentTitleStyle, documentPageLayoutStyle, placeholderVars]);

  if (loading) {
    return renderInPortal(
      <div className={styles.editorOverlay} style={{ zIndex: overlayZIndex }}>
        <div className={styles.editorPanel}>
          <p className={styles.placeholder}>Загрузка документа…</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return renderInPortal(
      <div
        className={styles.editorOverlay}
        style={{ zIndex: overlayZIndex }}
        onClick={(e) => e.target === e.currentTarget && onClose?.()}
      >
        <div className={styles.editorPanel} onClick={(e) => e.stopPropagation()}>
          <p className={styles.placeholder}>Документ не найден.</p>
          <button type="button" className={styles.primaryButton} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  const renderFieldValue = (value, type, tableColumns) => {
    const displayValue = resolveFieldValuePlaceholders(value, placeholderVars);
    if (displayValue === null || displayValue === undefined) return '';
    if (type === 'table' && Array.isArray(displayValue)) {
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
  };

  const getFieldMeta = (fieldName) => fieldsList.find((f) => f.name === fieldName);

  const renderFormBySheet = () => (
    <div className={styles.editorFields}>
      {formBlocksForPage.map((block) => {
          const fieldName = block.field_name;
          const meta = getFieldMeta(fieldName);
          if (block.type === SPREADSHEET_BLOCK_TYPE) {
            const val = fieldData[fieldName];
            return (
              <div key={fieldName} className={styles.editorField}>
                <SpreadsheetDocumentGrid
                  block={block}
                  value={val ?? {}}
                  onChange={(rows) => handleFieldChange(fieldName, rows)}
                />
              </div>
            );
          }
          const displayType = block.displayType || FIELD_DISPLAY.form;
          const isTable = displayType === FIELD_DISPLAY.table;
          const val = fieldData[fieldName];
          return (
            <div key={fieldName} className={styles.editorField}>
              <label className={styles.editorFieldLabel}>
                {fieldName}{meta?.required ? ' *' : ''}
              </label>
              {isTable ? (
                <EditableTable
                  columns={resolveTableColumns(block, meta)}
                  value={Array.isArray(val) ? val : []}
                  onChange={(rows) => handleFieldChange(fieldName, rows)}
                  csvBaseFilename={`document-${doc.id}-${fieldName}`}
                />
              ) : meta?.type === 'date' ? (
                <input
                  type="date"
                  className={styles.fieldInput}
                  value={typeof val === 'string' && val?.length <= 10 ? val : ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                />
              ) : meta?.type === 'number' ? (
                <input
                  type="number"
                  className={styles.fieldInput}
                  value={val ?? ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className={styles.fieldInput}
                  value={val ?? ''}
                  onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                />
              )}
            </div>
          );
        })}
    </div>
  );

  const renderPreviewBlock = (entry, index) => {
    const { block, rowSlice, isTableContinuation, sheetId } = entry;
    if (block.type === SPREADSHEET_BLOCK_TYPE) {
      const rowArr = getFieldValueForPdf(fieldData, block.field_name);
      let allSheets = getSpreadsheetAllSheetsPreviewData(block, rowArr);
      if (sheetId) {
        allSheets = allSheets.filter((s) => s.sheetId === sheetId);
      }
      const fieldStyle = getTextStyleFromBlock(block);
      return allSheets.map((sheetData, sheetIdx) => {
        const { columns, rows, sheetName } = sheetData;
        const slicedRows = rowSlice ? rows.slice(rowSlice.start, rowSlice.end) : rows;
        const continuationSuffix = isTableContinuation ? ' (продолжение)' : '';
        const label = `${sheetName || block.field_name || 'Таблица'}${continuationSuffix}`;
        return (
          <div key={`${sheetIdx}-${sheetData.sheetId}`} className={styles.sheetPageField} style={fieldStyle}>
            <span className={styles.sheetPageFieldLabel} style={fieldStyle}>
              {label}
            </span>
            <div className={styles.sheetPageFieldValue} style={fieldStyle}>
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
            </div>
          </div>
        );
      });
    }
    if (block.type === 'field') {
      const displayType = block.displayType || FIELD_DISPLAY.form;
      const isTable = displayType === FIELD_DISPLAY.table;
      const rawValue = getFieldValueForPdf(fieldData, block.field_name);
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
          <div className={styles.sheetPageFieldValue} style={fieldStyle}>
            {isTable
              ? renderFieldValue(tableValue, 'table', resolveTableColumns(block, getFieldMeta(block.field_name)))
              : value}
          </div>
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
          imageNumber={getImageBlockNumber(block, sheetBlocks)}
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
  };

  const renderStructurePreviewPage = () => (
    <SheetPage
      pageLayout={pageLayout}
      orientation={pageLayout.orientation}
      positioned={showPageNumbers}
      page={1}
      total={1}
      pageNumberStyle={documentPageNumberStyle}
      fixedSize
    >
      <div className={styles.sheetPageInner}>
        <div className={styles.sheetPrintTitle} style={docTitleStyleObj}>
          {sheetTitle}
        </div>
        {fieldsList.length > 0
          ? fieldsList.map((f) => (
              <div key={f.name} className={styles.sheetPageField}>
                <span className={styles.sheetPageFieldLabel}>{f.name}</span>
                <div className={styles.sheetPageFieldValue}>
                  {renderFieldValue(fieldData[f.name], f.type, f.type === 'table' ? resolveTableColumns(null, f) : undefined)}
                </div>
              </div>
            ))
          : Object.entries(fieldData).map(([key, value]) => (
              <div key={key} className={styles.sheetPageField}>
                <span className={styles.sheetPageFieldLabel}>{key}</span>
                <div className={styles.sheetPageFieldValue}>
                  {renderFieldValue(value, 'string')}
                </div>
              </div>
            ))}
      </div>
    </SheetPage>
  );

  const renderSheetPreviewPage = (pageEntries, {
    showTitle = true,
    page = 1,
    total = 1,
    orientation = pageLayout.orientation,
  } = {}) => (
    <SheetPage
      pageLayout={pageLayout}
      orientation={orientation}
      positioned={showPageNumbers}
      page={page}
      total={total}
      pageNumberStyle={documentPageNumberStyle}
      fixedSize
    >
      <div className={styles.sheetPageInner}>
        {showTitle && (
          <div className={styles.sheetPrintTitle} style={docTitleStyleObj}>
            {sheetTitle}
          </div>
        )}
        {pageEntries.flatMap((entry, index) => {
          const rendered = renderPreviewBlock(entry, index);
          return Array.isArray(rendered) ? rendered : [rendered];
        })}
      </div>
    </SheetPage>
  );

  const renderDocumentPreview = () => {
    if (previewPages) {
      return (
        <div className={styles.editorPreviewStack}>
          {previewPages.map((page, i) => (
            <div
              key={i}
              ref={(el) => {
                previewPageRefs.current[i] = el;
              }}
              data-page-index={i}
              className={styles.templateFinalPreviewPage}
            >
              {renderSheetPreviewPage(page.blocks, {
                showTitle: page.showTitle,
                page: i + 1,
                total: totalPreviewPages,
                orientation: page.orientation || pageLayout.orientation,
              })}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className={styles.editorPreviewStack}>
        {renderStructurePreviewPage()}
      </div>
    );
  };

  const renderPreviewPager = () => {
    if (!previewPages) return null;
    return (
      <SheetPreviewPager
        current={previewPageIndex + 1}
        total={totalPreviewPages}
        onChange={goToPreviewPage}
      />
    );
  };

  const renderPreviewPane = () => (
    <div
      className={styles.editorPreviewColumn}
      style={{ '--editor-preview-max-width': `${previewMaxWidth}px` }}
    >
      <div ref={previewScrollRef} className={styles.editorPreviewSheetScroll}>
        {renderDocumentPreview()}
      </div>
      <div className={styles.editorPreviewPagerDock}>
        {renderPreviewPager()}
      </div>
    </div>
  );

  const fieldsSectionTitle = isTableDocument
    ? 'Данные таблицы'
    : previewPages && previewPages.length > 1
      ? `Поля документа — стр. ${previewPageIndex + 1}`
      : 'Поля документа';

  return renderInPortal(
    <div
      className={`${styles.editorOverlay} ${isTableDocument ? styles.editorOverlayTable : ''}`}
      style={{ zIndex: overlayZIndex }}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={`${styles.editorPanel} ${isTableDocument ? styles.editorPanelAlmostFullscreen : styles.editorPanelWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.editorHeader}>
          <div className={styles.editorHeaderMain}>
            <input
              type="text"
              className={`${styles.editorTitle} ${styles.editorTitleInput}`}
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder={isTableDocument ? `Таблица — № ${doc?.number ?? ''}` : `${kindName} — № ${doc?.number ?? ''}`}
              aria-label={isTableDocument ? 'Заголовок таблицы' : 'Заголовок документа'}
            />
            <span className={styles.editorTitleHint}>Можно изменить</span>
            {doc?.template_id && (
              sourceTemplate && onOpenTemplate ? (
                <button
                  type="button"
                  className={`${styles.editorTemplateVersion} ${styles.editorTemplateVersionLink}`}
                  onClick={() => requestLeave(() => onOpenTemplate(sourceTemplate))}
                  title={sourceTemplate.name ? `Открыть шаблон «${sourceTemplate.name}»` : 'Открыть шаблон'}
                >
                  {doc.template_version ? `Шаблон v${doc.template_version}` : 'Открыть шаблон'}
                </button>
              ) : (
                <span className={styles.editorTemplateVersion}>
                  {doc.template_version ? `Шаблон v${doc.template_version}` : 'Шаблон недоступен'}
                </span>
              )
            )}
          </div>
          <div className={styles.editorProjectBlock}>
            <DocumentProjectPicker
              variant="button"
              value={projectId}
              onChange={handleProjectChange}
              saving={projectSaving}
              label="Проект"
              hint="Документ можно привязать к проекту. Изменения сохраняются сразу."
              buttonPlaceholder="Не выбран — нажмите для выбора"
            />
            <DepartmentPicker
              variant="button"
              value={departmentId}
              onChange={handleDepartmentChange}
              saving={departmentSaving}
              label="Отдел"
              hint="Пусто — общий документ. Указанный отдел ограничит видимость."
              buttonPlaceholder="Не выбран — нажмите для выбора"
            />
          </div>
          <div className={styles.editorHeaderSaveCluster}>
            <button
              type="button"
              className={`${styles.primaryButton} ${styles.editorSaveBtn}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
        {error && <div className={styles.error} role="alert">{error}</div>}
        {pendingProposalsCount > 0 && (
          <div className={styles.proposalBadgeRow}>
            <span className={styles.proposalBadge}>
              Есть предложения: {pendingProposalsCount}
            </span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setReviewOpen((v) => !v)}
            >
              {reviewOpen ? 'Скрыть review' : 'Просмотреть предложения'}
            </button>
          </div>
        )}
        {reviewOpen && (
          <DocumentProposalReviewPanel
            documentId={documentId}
            currentFieldData={fieldData}
            currentTitle={documentTitle}
            sheetBlocks={sheetBlocks}
            onAccepted={handleProposalReviewChanged}
            onRejected={handleProposalReviewChanged}
          />
        )}
        {rollbackOpen && availableRollbacksCount > 0 && (
          <DocumentRevisionRollbackPanel
            documentId={documentId}
            currentFieldData={fieldData}
            currentTitle={documentTitle}
            onRolledBack={handleProposalReviewChanged}
          />
        )}
        <div className={styles.editorActions}>
          <div className={styles.editorToolbarMeta}>
            {doc?.template_id && templateVersions.length > 0 ? (
              <label className={styles.editorVersionLabel}>
                Версия шаблона:
                <select
                  className={styles.editorVersionSelect}
                  value={doc.template_version ?? templateVersions.find((v) => v.is_current)?.version ?? templateVersions[0]?.version ?? ''}
                  onChange={(e) => handleVersionChange(e.target.value)}
                  aria-label="Версия шаблона"
                >
                  {templateVersions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version}{v.is_current ? ' (текущая)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className={styles.editorToolbarMetaSpacer} aria-hidden />
            )}
            <div className={styles.editorToolbarMetaEnd}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setShareModalOpen(true)}
                title="Поделиться ссылкой"
              >
                Поделиться
              </button>
              <button type="button" className={styles.dangerButton} onClick={handleDelete} title="Удалить документ">
                Удалить
              </button>
              <button type="button" className={styles.editorCloseBtn} onClick={requestClose} aria-label="Закрыть">
                <IconClose size={18} />
              </button>
            </div>
          </div>
          <div className={styles.editorActionsButtons}>
            <button type="button" className={styles.secondaryButton} onClick={handlePrint}>
              Печать
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleExportPdf}>
              Экспорт в PDF
            </button>
            {hasTableFields && (
              <button type="button" className={styles.secondaryButton} onClick={exportAllTablesCsv}>
                Экспорт в CSV
              </button>
            )}
            {availableRollbacksCount > 0 && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setRollbackOpen((open) => !open)}
                aria-expanded={rollbackOpen}
              >
                {rollbackOpen
                  ? 'Скрыть откаты'
                  : `Откат (${availableRollbacksCount})`}
              </button>
            )}
          </div>
        </div>
        <div
          className={`${styles.editorBody} ${isTableDocument ? styles.editorBodyTableOnly : styles.editorBodySplit}${!isTableDocument && !fieldsPanelOpen ? ` ${styles.editorBodySplitFieldsHidden}` : ''}`}
        >
          {!isTableDocument && (
            <div className={`${styles.editorSection} ${styles.editorSectionPreview}`}>
              <div className={styles.editorSectionHeader}>
                <h3 className={styles.editorSectionTitle}>
                  {previewPages && previewPages.length > 1
                    ? `Предпросмотр — стр. ${previewPageIndex + 1}`
                    : 'Предпросмотр страницы'}
                </h3>
                <button
                  type="button"
                  className={styles.editorFieldsToggle}
                  onClick={toggleFieldsPanel}
                  aria-expanded={fieldsPanelOpen}
                  title={fieldsPanelOpen ? 'Скрыть панель полей' : 'Показать панель полей'}
                >
                  {fieldsPanelOpen ? (
                    <>
                      <IconChevronRight size={14} aria-hidden />
                      <span>Скрыть поля</span>
                    </>
                  ) : (
                    <>
                      <IconChevronLeft size={14} aria-hidden />
                      <span>Показать поля</span>
                    </>
                  )}
                </button>
              </div>
              {renderPreviewPane()}
            </div>
          )}
          {(isTableDocument || fieldsPanelOpen) && (
          <div ref={fieldsScrollRef} className={`${styles.editorSection} ${styles.editorSectionFields}`}>
            {!isTableDocument && isMobile && (
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.editorMobilePreviewBtn}`}
                onClick={() => setMobilePreviewOpen(true)}
              >
                Предпросмотр листа
              </button>
            )}
            <h3 className={styles.editorSectionTitle}>{fieldsSectionTitle}</h3>
            {sheetBlocks?.length > 0 ? (
              renderFormBySheet()
            ) : fieldsList.length === 0 ? (
              <div className={styles.editorFieldsGeneric}>
                {Object.entries(fieldData).map(([key, value]) => (
                  <div key={key} className={styles.editorField}>
                    <label className={styles.editorFieldLabel}>{key}</label>
                    {typeof value === 'object' && value !== null && !Array.isArray(value) ? (
                      <textarea
                        className={styles.editorTextarea}
                        value={JSON.stringify(value, null, 2)}
                        onChange={(e) => {
                          try {
                            handleFieldChange(key, JSON.parse(e.target.value || '{}'));
                          } catch {
                            handleFieldChange(key, e.target.value);
                          }
                        }}
                        rows={3}
                      />
                    ) : Array.isArray(value) ? (
                      <textarea
                        className={styles.editorTextarea}
                        value={JSON.stringify(value, null, 2)}
                        onChange={(e) => {
                          try {
                            handleFieldChange(key, JSON.parse(e.target.value || '[]'));
                          } catch {
                            handleFieldChange(key, e.target.value);
                          }
                        }}
                        rows={4}
                      />
                    ) : (
                      <input
                        type="text"
                        className={styles.fieldInput}
                        value={value ?? ''}
                        onChange={(e) => handleFieldChange(key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.editorFields}>
                {fieldsList.map((f) => {
                  const val = fieldData[f.name];
                  const isTable = f.type === 'table';
                  return (
                    <div key={f.name} className={styles.editorField}>
                      <label className={styles.editorFieldLabel}>{f.name}{f.required ? ' *' : ''}</label>
                      {isTable ? (
                        <EditableTable
                          columns={resolveTableColumns(null, f)}
                          value={Array.isArray(val) ? val : []}
                          onChange={(rows) => handleFieldChange(f.name, rows)}
                          csvBaseFilename={`document-${doc.id}-${f.name}`}
                        />
                      ) : f.type === 'date' ? (
                        <input
                          type="date"
                          className={styles.fieldInput}
                          value={typeof val === 'string' && val.length <= 10 ? val : ''}
                          onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        />
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          className={styles.fieldInput}
                          value={val ?? ''}
                          onChange={(e) => handleFieldChange(f.name, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
        {!isTableDocument && mobilePreviewOpen && (
          <div
            className={styles.editorMobilePreviewOverlay}
            role="dialog"
            aria-modal="true"
            aria-label="Предпросмотр документа"
            onClick={() => setMobilePreviewOpen(false)}
          >
            <div className={styles.editorMobilePreviewHeader}>
              <h3 className={styles.editorMobilePreviewTitle}>Предпросмотр листа</h3>
              <button
                type="button"
                className={styles.editorCloseBtn}
                onClick={() => setMobilePreviewOpen(false)}
                aria-label="Закрыть предпросмотр"
              >
                <IconClose size={18} />
              </button>
            </div>
            <div className={styles.editorMobilePreviewScroll} onClick={(e) => e.stopPropagation()}>
              {renderPreviewPane()}
            </div>
          </div>
        )}
        {/* Скрытая область для печати / PDF */}
        <div ref={printRef} className={styles.printContent} aria-hidden="true">
          {sheetBlocks?.length > 0 ? (
            <div className={styles.sheetPrintTitle} style={docTitleStyleObj}>{sheetTitle}</div>
          ) : null}
          {sheetBlocks?.length > 0 ? null : fieldsList.length > 0
            ? fieldsList.map((f) => (
                <div key={f.name} className={styles.printField}>
                  <div className={styles.printFieldLabel}>{f.name}</div>
                  <div className={styles.printFieldValue}>
                    {renderFieldValue(fieldData[f.name], f.type)}
                  </div>
                </div>
              ))
            : Object.entries(fieldData).map(([key, value]) => (
                <div key={key} className={styles.printField}>
                  <div className={styles.printFieldLabel}>{key}</div>
                  <div className={styles.printFieldValue}>
                    {renderFieldValue(value, 'string')}
                  </div>
                </div>
              ))}
        </div>
      </div>
      <DocumentAiAssistant
        documentId={documentId}
        documentTitle={documentTitle}
        kindName={kindName}
        number={doc?.number || ''}
        templateId={doc?.template_id ?? null}
        templateVersion={doc?.template_version ?? null}
        fieldsList={fieldsList}
        fieldData={fieldData}
        sheetBlocks={sheetBlocks}
        isTableDocument={isTableDocument}
        placeholderVars={placeholderVars}
        onApplyFieldData={setFieldData}
        onApplyTitle={setDocumentTitle}
        onSave={handleSave}
      />
      <DocumentShareLinkModal
        documentId={documentId}
        documentTitle={documentTitle}
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
      <UnsavedChangesDialog
        {...unsavedDialogProps}
        entityLabel={isTableDocument ? 'таблице' : 'документе'}
        entityName={documentTitle}
        zIndex={overlayZIndex + 60}
      />
    </div>
  );
};

export default DocumentEditorPanel;
