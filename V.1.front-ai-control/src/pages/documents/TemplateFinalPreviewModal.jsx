import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_TABLE_COLUMNS, getTextStyleFromBlock } from './SheetEditor';
import { buildExpandedPreviewPages } from './documentPagination';
import { resolveTableColumns } from './documentTableColumns';
import SheetPreviewPager from './SheetPreviewPager';
import { renderFieldValue, renderPreviewBlock } from './documentSheetPreviewUtils';
import SpreadsheetDocumentGrid from './SpreadsheetDocumentGrid';
import { isSpreadsheetTemplate } from './templateTypeUtils';
import { IconClose } from './DocumentIcons';
import SheetPage from './SheetPage';
import PageLayoutSettingsForm from './PageLayoutSettingsForm';
import { normalizePageNumberStyle } from './documentPageNumber';
import { getMaxPreviewWidthPx, normalizePageLayout } from './documentPageLayout';
import styles from './DocumentsApp.module.css';

const getFieldsList = (structure) => {
  if (!structure || !structure.fields) return [];
  const raw = structure.fields;
  const list = Array.isArray(raw) ? raw : (raw.fields || []);
  const arr = Array.isArray(list) ? list : [];
  return arr.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export default function TemplateFinalPreviewModal({
  open,
  onClose,
  sheetBlocks = [],
  fieldData = {},
  title = '',
  titleStyle = null,
  pageNumberStyle = null,
  pageLayout = null,
  onPageLayoutChange = null,
  structure = null,
  placeholderVars = {},
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const [layoutSettingsOpen, setLayoutSettingsOpen] = useState(false);
  const scrollRef = useRef(null);
  const pageRefs = useRef([]);
  const skipScrollSync = useRef(false);

  const fieldsList = useMemo(() => getFieldsList(structure), [structure]);
  const layout = useMemo(() => normalizePageLayout(pageLayout), [pageLayout]);
  const previewMaxWidth = useMemo(() => getMaxPreviewWidthPx(layout), [layout]);

  const isTableDocument = useMemo(
    () => isSpreadsheetTemplate({ sheet_content: Array.isArray(sheetBlocks) ? sheetBlocks : [] }),
    [sheetBlocks],
  );

  const previewPages = useMemo(() => {
    if (sheetBlocks?.length > 0) {
      return buildExpandedPreviewPages(sheetBlocks, fieldData, { pageLayout: layout, placeholderVars });
    }
    return null;
  }, [sheetBlocks, fieldData, layout, placeholderVars]);

  const totalPages = previewPages?.length ?? 1;
  const showPageNumbers = normalizePageNumberStyle(pageNumberStyle).enabled && totalPages > 0;

  const docTitleStyleObj = titleStyle && Object.keys(titleStyle).length > 0
    ? getTextStyleFromBlock({ textStyle: titleStyle })
    : undefined;

  const previewContext = useMemo(
    () => ({
      fieldData,
      fieldsList,
      styles,
      editable: false,
      allBlocks: sheetBlocks || [],
      placeholderVars,
    }),
    [fieldData, fieldsList, sheetBlocks, placeholderVars],
  );

  useEffect(() => {
    if (!open) return undefined;
    setPageIndex(0);
    pageRefs.current = [];
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (pageIndex >= totalPages) {
      setPageIndex(Math.max(0, totalPages - 1));
    }
  }, [pageIndex, totalPages]);

  useEffect(() => {
    if (!open || isTableDocument) return undefined;
    const root = scrollRef.current;
    if (!root || !previewPages?.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (skipScrollSync.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const idx = Number(visible[0].target.dataset.pageIndex);
          if (!Number.isNaN(idx)) setPageIndex(idx);
        }
      },
      { root, threshold: [0.25, 0.5, 0.75], rootMargin: '-8% 0px -8% 0px' },
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [open, isTableDocument, previewPages]);

  const goToPage = useCallback((page) => {
    const idx = Math.min(totalPages - 1, Math.max(0, page - 1));
    setPageIndex(idx);
    skipScrollSync.current = true;
    pageRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      skipScrollSync.current = false;
    }, 450);
  }, [totalPages]);

  const renderStructurePreviewPage = (page = 1, total = 1) => (
    <SheetPage
      pageLayout={layout}
      orientation={layout.orientation}
      positioned={showPageNumbers}
      page={page}
      total={total}
      pageNumberStyle={pageNumberStyle}
      fixedSize
    >
      <div className={styles.sheetPageInner}>
        <div className={styles.sheetPrintTitle} style={docTitleStyleObj}>
          {title}
        </div>
        {fieldsList.length > 0
          ? fieldsList.map((f) => (
              <div key={f.name} className={styles.sheetPageField}>
                <span className={styles.sheetPageFieldLabel}>{f.name}</span>
                <div className={styles.sheetPageFieldValue}>
                  {renderFieldValue(
                    fieldData[f.name],
                    f.type,
                    f.type === 'table' ? resolveTableColumns(null, f) : undefined,
                    styles,
                    placeholderVars,
                  )}
                </div>
              </div>
            ))
          : Object.entries(fieldData).map(([key, value]) => (
              <div key={key} className={styles.sheetPageField}>
                <span className={styles.sheetPageFieldLabel}>{key}</span>
                <div className={styles.sheetPageFieldValue}>
                  {renderFieldValue(value, 'string', DEFAULT_TABLE_COLUMNS, styles, placeholderVars)}
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
    orientation = layout.orientation,
  } = {}) => (
    <SheetPage
      pageLayout={layout}
      orientation={orientation}
      positioned={showPageNumbers}
      page={page}
      total={total}
      pageNumberStyle={pageNumberStyle}
      fixedSize
    >
      <div className={styles.sheetPageInner}>
        {showTitle && (
          <div className={styles.sheetPrintTitle} style={docTitleStyleObj}>
            {title}
          </div>
        )}
        {pageEntries.flatMap((entry, index) => {
          const rendered = renderPreviewBlock(entry, index, previewContext);
          return Array.isArray(rendered) ? rendered : [rendered];
        })}
      </div>
    </SheetPage>
  );

  if (!open) return null;

  const renderTablePreview = () => {
    const block = sheetBlocks[0];
    if (!block) return <p className={styles.templateFinalPreviewEmpty}>Нет данных для предпросмотра</p>;
    const fieldName = block.field_name;
    return (
      <div className={styles.sharePreviewTableStage}>
        <SpreadsheetDocumentGrid
          block={block}
          value={fieldData[fieldName] ?? {}}
          readOnly
        />
      </div>
    );
  };

  const renderDocumentPreview = () => {
    if (previewPages) {
      return previewPages.map((page, i) => (
        <div
          key={i}
          ref={(el) => {
            pageRefs.current[i] = el;
          }}
          data-page-index={i}
          className={styles.templateFinalPreviewPage}
        >
          {renderSheetPreviewPage(page.blocks, {
            showTitle: page.showTitle,
            page: i + 1,
            total: previewPages.length,
            orientation: page.orientation || layout.orientation,
          })}
        </div>
      ));
    }
    return (
      <div
        ref={(el) => {
          pageRefs.current[0] = el;
        }}
        data-page-index={0}
        className={styles.templateFinalPreviewPage}
      >
        {renderStructurePreviewPage(1, 1)}
      </div>
    );
  };

  return (
    <div
      className={styles.templateFinalPreviewOverlay}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.templateFinalPreviewModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-final-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.templateFinalPreviewHeader}>
          <h2 id="template-final-preview-title" className={styles.templateFinalPreviewTitle}>
            Итоговый документ
          </h2>
          <div className={styles.templateFinalPreviewHeaderActions}>
            {!isTableDocument && onPageLayoutChange && (
              <div className={styles.templateFinalPreviewLayoutWrap}>
                <button
                  type="button"
                  className={`${styles.pageNumberSettingsToggle} ${styles.templateFinalPreviewLayoutToggle}${layoutSettingsOpen ? ` ${styles.pageNumberSettingsToggleOpen}` : ''}`}
                  onClick={() => setLayoutSettingsOpen((v) => !v)}
                  aria-expanded={layoutSettingsOpen}
                >
                  <span className={styles.pageNumberSettingsToggleTitle}>Размер листа</span>
                  <span className={styles.pageNumberSettingsBadge}>{layout.format}</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className={styles.templateFinalPreviewClose}
              onClick={onClose}
              aria-label="Закрыть предпросмотр"
            >
              <IconClose size={18} />
            </button>
          </div>
        </header>

        {!isTableDocument && layoutSettingsOpen && onPageLayoutChange && (
          <div className={styles.templateFinalPreviewLayoutPanel}>
            <PageLayoutSettingsForm
              value={layout}
              onChange={onPageLayoutChange}
            />
          </div>
        )}

        <div className={styles.templateFinalPreviewBody}>
          {isTableDocument ? (
            <div className={styles.templateFinalPreviewTableWrap}>
              {renderTablePreview()}
            </div>
          ) : (
            <div className={styles.sharePreviewStage}>
              <div
                className={styles.editorPreviewColumn}
                style={{ '--editor-preview-max-width': `${previewMaxWidth}px` }}
              >
                <div ref={scrollRef} className={styles.editorPreviewSheetScroll}>
                  <div className={styles.editorPreviewStack}>
                    {renderDocumentPreview()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {!isTableDocument && totalPages > 0 && (
          <footer className={styles.templateFinalPreviewFooter}>
            <SheetPreviewPager
              current={pageIndex + 1}
              total={totalPages}
              onChange={goToPage}
            />
          </footer>
        )}
      </div>
    </div>
  );
}
