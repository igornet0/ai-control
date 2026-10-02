import React from 'react';
import SheetPageNumber from './SheetPageNumber';
import { getPageDimensions, getSheetPageInlineStyle } from './documentPageLayout';
import styles from './DocumentsApp.module.css';

export default function SheetPage({
  pageLayout = null,
  orientation = 'portrait',
  className = '',
  positioned = false,
  page,
  total,
  pageNumberStyle = null,
  children,
  style: styleProp,
  fixedSize = false,
}) {
  const dims = getPageDimensions(pageLayout, orientation);
  const inlineStyle = {
    ...getSheetPageInlineStyle(pageLayout, orientation),
    ...(fixedSize ? {
      minHeight: `${dims.heightPx}px`,
    } : {}),
    ...styleProp,
  };

  const classes = [
    styles.sheetPage,
    orientation === 'landscape' ? styles.sheetPageLandscape : '',
    positioned ? styles.sheetPagePositioned : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={inlineStyle}
      data-orientation={orientation}
      data-fixed-size={fixedSize ? 'true' : undefined}
    >
      {children}
      {page != null && total != null && (
        <SheetPageNumber page={page} total={total} pageNumberStyle={pageNumberStyle} />
      )}
    </div>
  );
}
