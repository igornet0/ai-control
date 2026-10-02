/** Нумерация и подписи для блоков изображений в шаблоне. */

export function buildImageNumberMap(blocks) {
  const map = new WeakMap();
  let n = 0;
  (blocks || []).forEach((block) => {
    if (block?.type === 'image') {
      n += 1;
      map.set(block, n);
    }
  });
  return map;
}

export function getImageBlockNumber(block, blocks) {
  let n = 0;
  for (const item of blocks || []) {
    if (item?.type === 'image') {
      n += 1;
      if (item === block) return n;
    }
  }
  return 0;
}

import { resolveDocumentPlaceholders } from './documentPlaceholders';

export function formatImageCaption(block, imageNumber, placeholderVars = null) {
  if (block?.showCaption === false) return '';
  const template = String(block?.caption || '').trim();
  const fallback = block?.captionAutoNumber !== false ? 'Рис. {n}.' : '';
  const source = template || fallback;
  if (!source) return '';
  let result = source.replace(/\{n\}/g, String(imageNumber));
  if (placeholderVars) {
    result = resolveDocumentPlaceholders(result, placeholderVars);
  }
  return result;
}

export function getBlockAlignFlex(align) {
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
}

export function getBlockWrapStyle(align = 'center', offsetX = 0, offsetY = 0) {
  const ox = Number(offsetX) || 0;
  const oy = Number(offsetY) || 0;
  return {
    justifyContent: getBlockAlignFlex(align),
    marginTop: oy ? `${oy}px` : undefined,
    marginLeft: align !== 'right' && ox ? `${ox}px` : undefined,
    marginRight: align === 'right' && ox ? `${ox}px` : undefined,
  };
}

export function clampImageSize(value, fallback = 180, max = 600) {
  return Math.min(max, Math.max(40, Number(value) || fallback));
}
