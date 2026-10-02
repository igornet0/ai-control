import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TABLE_COLUMNS, getTextStyleFromBlock } from './SheetEditor';
import { buildExpandedPreviewPages } from './documentPagination';
import { resolveTableColumns } from './documentTableColumns';
import SheetPreviewThumbRail from './SheetPreviewThumbRail';
import { renderFieldValue, renderPreviewBlock } from './documentSheetPreviewUtils';
import SpreadsheetDocumentGrid from './SpreadsheetDocumentGrid';
import SheetPage from './SheetPage';
import { normalizePageNumberStyle } from './documentPageNumber';
import { getMaxPreviewWidthPx, normalizePageLayout } from './documentPageLayout';
import { isSpreadsheetTemplate } from './templateTypeUtils';
import { useDocumentPlaceholderVars } from './useDocumentPlaceholderVars';
import styles from './DocumentsApp.module.css';

const getFieldsList = (structure) => {
  if (!structure || !structure.fields) return [];
  const raw = structure.fields;
  const list = Array.isArray(raw) ? raw : (raw.fields || []);
  const arr = Array.isArray(list) ? list : [];
  return arr.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export default function DocumentSheetPreview({
  sheetBlocks = null,
  fieldData = {},
  title = '',
  titleStyle = null,
  pageNumberStyle = null,
  pageLayout = null,
  structure = null,
  className = '',
  readOnly = true,
  interactive = false,
  onFieldChange,
  onFieldClick,
  onTitleClick,
  placeholderVars: placeholderVarsProp = null,
  docNumber = null,
  kindName = '',
}) {
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const fieldsList = useMemo(() => getFieldsList(structure), [structure]);
  const loadedPlaceholderVars = useDocumentPlaceholderVars({
    номер: docNumber ?? '—',
    вид: kindName || '',
  });
  const placeholderVars = placeholderVarsProp ?? loadedPlaceholderVars;

  const isTableDocument = useMemo(
    () => isSpreadsheetTemplate({ sheet_content: Array.isArray(sheetBlocks) ? sheetBlocks : [] }),
    [sheetBlocks],
  );

  const layout = useMemo(() => normalizePageLayout(pageLayout), [pageLayout]);
  const previewMaxWidth = useMemo(() => getMaxPreviewWidthPx(layout), [layout]);

  const previewPages = useMemo(() => {
    if (sheetBlocks?.length > 0) {
      return buildExpandedPreviewPages(sheetBlocks, fieldData, { pageLayout: layout, placeholderVars });
    }
    return null;
  }, [sheetBlocks, fieldData, layout, placeholderVars]);

  const totalPreviewPages = previewPages?.length ?? 1;
  const showPageNumbers = normalizePageNumberStyle(pageNumberStyle).enabled && totalPreviewPages > 0;
  const docTitleStyleObj = titleStyle && Object.keys(titleStyle).length > 0
    ? getTextStyleFromBlock({ textStyle: titleStyle })
    : undefined;

  useEffect(() => {
    if (previewPageIndex >= totalPreviewPages) {
      setPreviewPageIndex(Math.max(0, totalPreviewPages - 1));
    }
  }, [previewPageIndex, totalPreviewPages]);

  useEffect(() => {
    setPreviewPageIndex(0);
  }, [sheetBlocks]);

  if (isTableDocument && sheetBlocks?.[0]) {
    const block = sheetBlocks[0];
    const fieldName = block.field_name;
    return (
      <div className={`${styles.sharePreviewWrap} ${styles.sharePreviewTableWrap} ${className}`.trim()}>
        <div className={styles.sharePreviewTableStage}>
          <SpreadsheetDocumentGrid
            block={block}
            value={fieldData[fieldName] ?? {}}
            onChange={readOnly ? undefined : (v) => onFieldChange?.(fieldName, v)}
            readOnly={readOnly}
          />
        </div>
      </div>
    );
  }

  const previewContext = useMemo(
    () => ({
      fieldData,
      fieldsList,
      styles,
      editable: interactive,
      onFieldClick,
      allBlocks: sheetBlocks || [],
      placeholderVars,
    }),
    [fieldData, fieldsList, interactive, onFieldClick, sheetBlocks, placeholderVars],
  );

  const renderStructurePreviewPage = () => (
    <SheetPage
      pageLayout={layout}
      orientation={layout.orientation}
      positioned={showPageNumbers}
      page={1}
      total={1}
      pageNumberStyle={pageNumberStyle}
      fixedSize
    >
      <div className={styles.sheetPageInner}>
        {interactive && onTitleClick ? (
          <button
            type="button"
            className={`${styles.sheetPrintTitle} ${styles.sheetPrintTitleEditable}`}
            style={docTitleStyleObj}
            onClick={onTitleClick}
            title="Нажмите, чтобы изменить заголовок"
          >
            {title}
          </button>
        ) : (
          <div className={styles.sheetPrintTitle} style={docTitleStyleObj}>
            {title}
          </div>
        )}
        {fieldsList.length > 0
          ? fieldsList.map((f) => (
              <div key={f.name} className={styles.sheetPageField}>
                <span className={styles.sheetPageFieldLabel}>{f.name}</span>
                {interactive && onFieldClick ? (
                  <button
                    type="button"
                    className={`${styles.sheetPageFieldValue} ${styles.sheetPageFieldValueEditable}`}
                    onClick={() => onFieldClick({ fieldName: f.name, block: { type: 'field', field_name: f.name, displayType: f.type === 'table' ? 'table' : 'form' }, meta: f })}
                    title="Нажмите, чтобы изменить"
                  >
                    {renderFieldValue(
                      fieldData[f.name],
                      f.type,
                      f.type === 'table' ? resolveTableColumns(null, f) : undefined,
                      styles,
                      placeholderVars,
                    )}
                  </button>
                ) : (
                  <div className={styles.sheetPageFieldValue}>
                    {renderFieldValue(
                      fieldData[f.name],
                      f.type,
                      f.type === 'table' ? resolveTableColumns(null, f) : undefined,
                      styles,
                      placeholderVars,
                    )}
                  </div>
                )}
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
          interactive && onTitleClick ? (
            <button
              type="button"
              className={`${styles.sheetPrintTitle} ${styles.sheetPrintTitleEditable}`}
              style={docTitleStyleObj}
              onClick={onTitleClick}
              title="Нажмите, чтобы изменить заголовок"
            >
              {title}
            </button>
          ) : (
            <div className={styles.sheetPrintTitle} style={docTitleStyleObj}>
              {title}
            </div>
          )
        )}
        {pageEntries.flatMap((entry, index) => {
          const rendered = renderPreviewBlock(entry, index, previewContext);
          return Array.isArray(rendered) ? rendered : [rendered];
        })}
      </div>
    </SheetPage>
  );

  const renderDocumentPreview = () => {
    if (previewPages) {
      const page = previewPages[previewPageIndex] ?? previewPages[0];
      if (!page) return null;
      return (
        <div className={styles.templateFinalPreviewPage}>
          {renderSheetPreviewPage(page.blocks, {
            showTitle: page.showTitle,
            page: previewPageIndex + 1,
            total: totalPreviewPages,
            orientation: page.orientation || layout.orientation,
          })}
        </div>
      );
    }
    return renderStructurePreviewPage();
  };

  const renderThumbnailPage = (page, pageIndex) => (
    renderSheetPreviewPage(page.blocks, {
      showTitle: page.showTitle,
      page: pageIndex + 1,
      total: totalPreviewPages,
      orientation: page.orientation || layout.orientation,
    })
  );

  return (
    <div className={`${styles.sharePreviewWrap} ${className}`.trim()}>
      <div className={`${styles.sharePreviewStage} ${previewPages && previewPages.length > 1 ? styles.sharePreviewStageWithRail : ''}`.trim()}>
        <div
          className={styles.sharePreviewMain}
          style={{ '--editor-preview-max-width': `${previewMaxWidth}px` }}
        >
          <div className={styles.sharePreviewMainPage}>
            {renderDocumentPreview()}
          </div>
        </div>
        {previewPages && previewPages.length > 1 && (
          <SheetPreviewThumbRail
            pages={previewPages}
            currentIndex={previewPageIndex}
            pageLayout={layout}
            defaultOrientation={layout.orientation}
            onSelect={setPreviewPageIndex}
            renderPage={renderThumbnailPage}
          />
        )}
      </div>
    </div>
  );
}
