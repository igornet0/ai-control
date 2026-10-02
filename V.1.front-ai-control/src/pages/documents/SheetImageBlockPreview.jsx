import React from 'react';
import {
  clampImageSize,
  formatImageCaption,
  getBlockWrapStyle,
} from './sheetImageUtils';

export function SheetImageBlockPreview({ block, imageNumber, styles, placeholderVars = null }) {
  const w = clampImageSize(block.imageWidth, 240);
  const h = clampImageSize(block.imageHeight, 180);
  const caption = formatImageCaption(block, imageNumber, placeholderVars);
  const wrapStyle = getBlockWrapStyle(block.imageAlign, block.imageOffsetX, block.imageOffsetY);

  return (
    <div className={styles.sheetPageImageWrap} style={wrapStyle}>
      <div className={styles.sheetPageImageBlock}>
        <div className={styles.sheetPageImageFrame} style={{ width: w, height: h }}>
          {block.image ? (
            <img src={block.image} alt="" className={styles.sheetPageImageImg} />
          ) : (
            <span className={styles.sheetPageImagePlaceholder}>Изображение</span>
          )}
        </div>
        {caption ? <div className={styles.sheetPageImageCaption}>{caption}</div> : null}
      </div>
    </div>
  );
}
