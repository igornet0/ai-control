import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { SPREADSHEET_BLOCK_TYPE } from './spreadsheetGridUtils';
import { getSpreadsheetPreviewData } from './spreadsheetPreview';
import StructureFieldDefaultInput from './StructureFieldDefaultInput';
import { resolveTableColumns } from './documentTableColumns';
import { formatScalarFieldPreview, isTableFieldBlock, isTableFieldValue } from './tableFieldUtils';
import {
  canAddFieldBlock,
  getFirstFreeFieldName,
  getSelectableFieldsForBlock,
} from './sheetEditorFieldUtils';
import { IconClose, IconChevronLeft, IconChevronRight } from './DocumentIcons';
import SheetBlockAddButton from './SheetBlockAddButton';
import { SheetImageBlockPreview } from './SheetImageBlockPreview';
import { getImageBlockNumber } from './sheetImageUtils';
import styles from './DocumentsApp.module.css';

const BLOCK_TYPES = { text: 'text', field: 'field', page_break: 'page_break', stamp: 'stamp', image: 'image' };

const SHEET_SIDEBAR_KEY = 'documents-sheet-editor-sidebar-open';

function readSheetSidebarPreference() {
  try {
    const v = localStorage.getItem(SHEET_SIDEBAR_KEY);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

function writeSheetSidebarPreference(open) {
  try {
    localStorage.setItem(SHEET_SIDEBAR_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Тип отображения поля: форма (одна строка) или таблица */
const FIELD_DISPLAY = { form: 'form', table: 'table' };

const DEFAULT_TABLE_COLUMNS = [
  { key: '№', label: '№' },
  { key: 'Наименование', label: 'Наименование' },
  { key: 'Кол-во', label: 'Кол-во' },
  { key: 'Цена', label: 'Цена' },
  { key: 'Сумма', label: 'Сумма' },
];

const newBlock = (type, overrides = {}) => ({
  type,
  content: type === 'text' ? '' : type === 'stamp' ? 'М.П.' : undefined,
  field_name: type === 'field' ? '' : undefined,
  displayType: type === 'field' ? FIELD_DISPLAY.form : undefined,
  tableColumns: undefined,
  textStyle: undefined,
  imageWidth: type === 'image' ? 240 : undefined,
  imageHeight: type === 'image' ? 180 : undefined,
  imageAlign: type === 'image' ? 'center' : undefined,
  caption: type === 'image' ? '' : undefined,
  showCaption: type === 'image' ? true : undefined,
  captionAutoNumber: type === 'image' ? true : undefined,
  ...overrides,
});

/** Доступные шрифты для выбора */
const FONT_OPTIONS = [
  { value: '', label: 'По умолчанию' },
  { value: 'system-ui', label: 'Системный' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: '"Times New Roman"', label: 'Times New Roman' },
  { value: 'Georgia', label: 'Georgia' },
  { value: '"Courier New"', label: 'Courier New' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
];

/** Строит объект стилей из block.textStyle для применения к тексту/полю */
function getTextStyleFromBlock(block) {
  const s = block.textStyle || {};
  const style = {};
  if (s.fontFamily) style.fontFamily = s.fontFamily;
  if (s.fontSize) style.fontSize = `${Number(s.fontSize) || 16}px`;
  if (s.color) style.color = s.color;
  if (s.bold) style.fontWeight = 'bold';
  if (s.italic) style.fontStyle = 'italic';
  if (s.underline) style.textDecoration = 'underline';
  if (s.textAlign) style.textAlign = s.textAlign;
  return style;
}

/** Строка inline-стилей для HTML/PDF из block.textStyle */
function getTextStyleString(block) {
  const s = block.textStyle || {};
  const parts = [];
  if (s.fontFamily) parts.push(`font-family: ${s.fontFamily}`);
  if (s.fontSize) parts.push(`font-size: ${Number(s.fontSize) || 16}px`);
  if (s.color) parts.push(`color: ${s.color}`);
  if (s.bold) parts.push('font-weight: bold');
  if (s.italic) parts.push('font-style: italic');
  if (s.underline) parts.push('text-decoration: underline');
  if (s.textAlign) parts.push(`text-align: ${s.textAlign}`);
  return parts.join('; ');
}

function getBlockTypeLabel(block) {
  if (block.type === BLOCK_TYPES.page_break) return 'Разрыв';
  if (block.type === BLOCK_TYPES.stamp) return 'Печать';
  if (block.type === BLOCK_TYPES.image) return 'Изображение';
  if (block.type === BLOCK_TYPES.field) return 'Поле';
  if (block.type === SPREADSHEET_BLOCK_TYPE) return 'Таблица';
  return 'Текст';
}

function getBlockRowTitle(block) {
  if (block.type === BLOCK_TYPES.field) {
    return block.field_name?.trim() ? block.field_name : 'Не выбрано';
  }
  if (block.type === SPREADSHEET_BLOCK_TYPE) {
    return block.field_name?.trim() ? block.field_name : 'Сетка';
  }
  if (block.type === BLOCK_TYPES.text) {
    const text = (block.content || '').replace(/\s+/g, ' ').trim();
    if (!text) return 'Пустой текст';
    return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }
  if (block.type === BLOCK_TYPES.stamp) {
    return block.image ? 'Изображение печати' : (block.content || 'М.П.');
  }
  if (block.type === BLOCK_TYPES.image) {
    return block.caption?.trim() || (block.image ? 'Загружено' : 'Без файла');
  }
  if (block.type === BLOCK_TYPES.page_break) return 'Новая страница';
  return getBlockTypeLabel(block);
}

function getBlockRowMeta(block, availableFields = []) {
  if (block.type === BLOCK_TYPES.field) {
    const meta = availableFields.find((f) => f.name === block.field_name);
    if (meta?.type === 'table') {
      const cols = Array.isArray(block.tableColumns) && block.tableColumns.length > 0
        ? block.tableColumns.length
        : DEFAULT_TABLE_COLUMNS.length;
      return `таблица · ${cols} колонок`;
    }
    return meta ? 'форма' : 'поле заполнения';
  }
  if (block.type === SPREADSHEET_BLOCK_TYPE) return 'сетка шаблона';
  if (block.type === BLOCK_TYPES.page_break) return 'разрыв страницы';
  if (block.type === BLOCK_TYPES.stamp) return block.showCircle === false ? 'без круга' : 'печать';
  if (block.type === BLOCK_TYPES.image) return 'изображение';
  return 'текст';
}

/** Редактор контента листа: текст, поля заполнения, разрывы страниц. */
const SheetEditor = forwardRef(({
  blocks: initialBlocks,
  onBlocksChange,
  availableFields = [],
  fieldValues = {},
  defaultValues = {},
  onDefaultValueChange,
  readOnly = false,
  documentTitle,
  documentTitleStyle,
  toolbarOutside = false,
}, ref) => {
  const [blocks, setBlocks] = useState(() => initialBlocks?.length ? [...initialBlocks] : []);
  const [sidebarOpen, setSidebarOpen] = useState(readSheetSidebarPreference);
  const [activeBlockIndex, setActiveBlockIndex] = useState(null);
  const previewBlockRefs = useRef([]);
  const sidebarBlockRefs = useRef([]);
  const blockListRef = useRef(null);
  const editorRootRef = useRef(null);

  useEffect(() => {
    const list = Array.isArray(initialBlocks) ? initialBlocks : [];
    setBlocks(list.length ? [...list] : []);
  }, [initialBlocks]);

  const updateBlocks = useCallback(
    (next) => {
      setBlocks(next);
      onBlocksChange?.(next);
    },
    [onBlocksChange]
  );

  useEffect(() => {
    if (readOnly || !onBlocksChange) return;
    let changed = false;
    const next = blocks.map((b) => {
      if (b.type !== BLOCK_TYPES.field || !b.field_name) return b;
      const meta = availableFields.find((f) => f.name === b.field_name);
      const wantTable = meta?.type === 'table';
      const wantDisplay = wantTable ? FIELD_DISPLAY.table : FIELD_DISPLAY.form;
      const patch = {};
      if ((b.displayType || FIELD_DISPLAY.form) !== wantDisplay) {
        patch.displayType = wantDisplay;
      }
      if (wantTable && (!Array.isArray(b.tableColumns) || b.tableColumns.length === 0)) {
        const cols = resolveTableColumns(b, meta);
        patch.tableColumns = cols.map((c) => ({ ...c }));
      }
      if (Object.keys(patch).length === 0) return b;
      changed = true;
      return { ...b, ...patch };
    });
    if (changed) updateBlocks(next);
  }, [blocks, availableFields, updateBlocks, readOnly, onBlocksChange]);

  const addBlock = useCallback(
    (type) => {
      const block = newBlock(type);
      if (type === 'field') {
        if (!canAddFieldBlock(availableFields, blocks)) return;
        const name = getFirstFreeFieldName(availableFields, blocks);
        if (!name) return;
        block.field_name = name;
        const meta = availableFields.find((f) => f.name === name);
        if (meta?.type === 'table') {
          block.displayType = FIELD_DISPLAY.table;
          block.tableColumns = resolveTableColumns(block, meta).map((c) => ({ ...c }));
        } else {
          block.displayType = FIELD_DISPLAY.form;
        }
      }
      const next = [...blocks, block];
      updateBlocks(next);
      setActiveBlockIndex(next.length - 1);
    },
    [blocks, availableFields, updateBlocks]
  );

  const showAddFieldButton = canAddFieldBlock(availableFields, blocks);

  useImperativeHandle(ref, () => ({ addBlock }), [addBlock]);

  const removeBlock = useCallback(
    (index) => {
      updateBlocks(blocks.filter((_, i) => i !== index));
      setActiveBlockIndex((prev) => {
        if (prev == null) return prev;
        if (prev === index) return null;
        if (prev > index) return prev - 1;
        return prev;
      });
    },
    [blocks, updateBlocks]
  );

  const moveBlockTo = useCallback(
    (fromIndex, toIndex) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= blocks.length || toIndex >= blocks.length) return;
      const next = [...blocks];
      const [removed] = next.splice(fromIndex, 1);
      const insertAt = fromIndex < toIndex ? toIndex - 1 : toIndex;
      next.splice(insertAt, 0, removed);
      updateBlocks(next);
      setActiveBlockIndex(insertAt);
    },
    [blocks, updateBlocks]
  );

  const updateBlock = useCallback(
    (index, patch) => {
      const next = blocks.map((b, i) => (i === index ? { ...b, ...patch } : b));
      updateBlocks(next);
    },
    [blocks, updateBlocks]
  );

  const handlePreviewDragStart = (e, index) => {
    e.dataTransfer.setData('application/x-sheet-block-index', String(index));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add(styles.sheetPageBlockDragging);
  };

  const handlePreviewDragEnd = (e) => {
    e.currentTarget.classList.remove(styles.sheetPageBlockDragging);
  };

  const handlePreviewDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add(styles.sheetPageBlockDragOver);
  };

  const handlePreviewDragLeave = (e) => {
    const wrap = e.currentTarget;
    if (wrap.classList.contains(styles.sheetPageBlockWrap) && !wrap.contains(e.relatedTarget)) {
      wrap.classList.remove(styles.sheetPageBlockDragOver);
    }
  };

  const handlePreviewDrop = (e, toIndex) => {
    e.preventDefault();
    e.currentTarget.classList.remove(styles.sheetPageBlockDragOver);
    const fromStr = e.dataTransfer.getData('application/x-sheet-block-index');
    if (fromStr === '') return;
    const fromIndex = parseInt(fromStr, 10);
    if (!Number.isNaN(fromIndex) && fromIndex !== toIndex) moveBlockTo(fromIndex, toIndex);
  };

  const handleSidebarDragStart = (e, index) => {
    e.dataTransfer.setData('application/x-sheet-block-index', String(index));
    e.dataTransfer.effectAllowed = 'move';
    const row = e.currentTarget.closest(`.${styles.sheetBlockRow}`);
    if (row) row.classList.add(styles.sheetBlockRowDragging);
  };

  const handleSidebarDragEnd = (e) => {
    const row = e.currentTarget.closest(`.${styles.sheetBlockRow}`);
    if (row) row.classList.remove(styles.sheetBlockRowDragging);
  };

  const handleSidebarDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add(styles.sheetBlockRowDragOver);
  };

  const handleSidebarDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove(styles.sheetBlockRowDragOver);
    }
  };

  const handleSidebarDrop = (e, toIndex) => {
    e.preventDefault();
    e.currentTarget.classList.remove(styles.sheetBlockRowDragOver);
    const fromStr = e.dataTransfer.getData('application/x-sheet-block-index');
    if (fromStr === '') return;
    const fromIndex = parseInt(fromStr, 10);
    if (!Number.isNaN(fromIndex) && fromIndex !== toIndex) moveBlockTo(fromIndex, toIndex);
  };

  const focusBlockPair = useCallback((index) => {
    setActiveBlockIndex(index);
    const el = previewBlockRefs.current[index];
    const rootEl = editorRootRef.current?.closest(`.${styles.editorBody}`);
    if (!el) return;
    if (rootEl && rootEl.scrollHeight > rootEl.clientHeight) {
      const rootRect = rootEl.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      rootEl.scrollTo({
        top: rootEl.scrollTop + (elRect.top - rootRect.top) - 72,
        behavior: 'smooth',
      });
      return;
    }
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  const renderTextStyleControls = (ts, updateTextStyle) => (
    <div className={styles.sheetTextStyleParams}>
      <div className={styles.sheetStampSizeRow}>
        <label>
          Шрифт:
          <select value={ts.fontFamily || ''} onChange={(e) => updateTextStyle({ fontFamily: e.target.value || undefined })} className={styles.sheetStampSelect}>
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value || 'default'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label>
          Размер: <input type="number" min={10} max={72} value={ts.fontSize || 16} onChange={(e) => updateTextStyle({ fontSize: e.target.value ? parseInt(e.target.value, 10) : 16 })} className={styles.sheetStampNumInput} />
        </label>
        <label>
          Цвет: <input type="color" value={ts.color || '#1e293b'} onChange={(e) => updateTextStyle({ color: e.target.value })} className={styles.sheetColorInput} title={ts.color || '#1e293b'} />
          <input type="text" value={ts.color || '#1e293b'} onChange={(e) => updateTextStyle({ color: e.target.value || undefined })} className={styles.sheetColorTextInput} placeholder="#000" />
        </label>
      </div>
      <div className={styles.sheetStampSizeRow}>
        <label className={styles.sheetStampCheckLabel}>
          <input type="checkbox" checked={!!ts.bold} onChange={(e) => updateTextStyle({ bold: e.target.checked })} />
          Жирный
        </label>
        <label className={styles.sheetStampCheckLabel}>
          <input type="checkbox" checked={!!ts.italic} onChange={(e) => updateTextStyle({ italic: e.target.checked })} />
          Курсив
        </label>
        <label className={styles.sheetStampCheckLabel}>
          <input type="checkbox" checked={!!ts.underline} onChange={(e) => updateTextStyle({ underline: e.target.checked })} />
          Подчёркнутый
        </label>
      </div>
      <div className={styles.sheetStampSizeRow}>
        <label>
          Выравнивание:
          <select value={ts.textAlign || 'left'} onChange={(e) => updateTextStyle({ textAlign: e.target.value })} className={styles.sheetStampSelect}>
            <option value="left">Слева</option>
            <option value="center">По центру</option>
            <option value="right">Справа</option>
            <option value="justify">По ширине</option>
          </select>
        </label>
      </div>
    </div>
  );

  const renderBlockRow = (block, index) => (
    <div
      key={index}
      ref={(el) => { sidebarBlockRefs.current[index] = el; }}
      role="button"
      tabIndex={0}
      className={`${styles.sheetBlockRow}${activeBlockIndex === index ? ` ${styles.sheetBlockRowActive}` : ''}`}
      onClick={() => focusBlockPair(index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focusBlockPair(index);
        }
      }}
      onDragOver={handleSidebarDragOver}
      onDragLeave={handleSidebarDragLeave}
      onDrop={(e) => handleSidebarDrop(e, index)}
    >
      <span
        className={styles.sheetBlockDragHandle}
        draggable
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => handleSidebarDragStart(e, index)}
        onDragEnd={handleSidebarDragEnd}
        title="Перетащите для изменения порядка"
        aria-label="Переместить блок"
      >
        ⋮⋮
      </span>
      <span className={styles.sheetBlockRowBadge} data-type={block.type || 'text'}>
        {getBlockTypeLabel(block)}
      </span>
      <div className={styles.sheetBlockRowMain}>
        <span className={styles.sheetBlockRowTitle}>{getBlockRowTitle(block)}</span>
        <span className={styles.sheetBlockRowMeta}>{getBlockRowMeta(block, availableFields)}</span>
      </div>
      {!readOnly && (
        <button
          type="button"
          className={styles.sheetBlockRowDelete}
          onClick={(e) => {
            e.stopPropagation();
            removeBlock(index);
          }}
          title="Удалить"
          aria-label="Удалить блок"
        >
          <IconClose size={14} />
        </button>
      )}
    </div>
  );

  const renderBlockInspector = (block, index) => {
    if (block.type === BLOCK_TYPES.page_break) {
      return (
        <p className={styles.sheetInspectorHint}>
          Разрыв страницы. В документе после этого блока начнётся новая страница.
        </p>
      );
    }
    if (block.type === BLOCK_TYPES.stamp) {
      const handleStampFile = (e) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => updateBlock(index, { image: reader.result, stampWidth: block.stampWidth ?? 120, stampHeight: block.stampHeight ?? 120 });
        reader.readAsDataURL(file);
        e.target.value = '';
      };
      const showCircle = block.showCircle !== false;
      const w = Math.min(300, Math.max(40, Number(block.stampWidth) || 120));
      const h = Math.min(300, Math.max(40, Number(block.stampHeight) || 120));
      const align = block.stampAlign || 'center';
      const offsetX = Number(block.stampOffsetX) || 0;
      const offsetY = Number(block.stampOffsetY) || 0;
      return (
        <div className={styles.sheetStampEditor}>
          <div className={styles.sheetInspectorSection}>
            <span className={styles.sheetInspectorSectionTitle}>Содержимое</span>
            <label className={styles.sheetStampCheckLabel}>
              <input
                type="checkbox"
                checked={showCircle}
                onChange={(e) => updateBlock(index, { showCircle: e.target.checked })}
              />
              Показать круг
            </label>
            <input
              type="text"
              value={block.content || ''}
              onChange={(e) => updateBlock(index, { content: e.target.value })}
              className={styles.sheetStampInput}
              placeholder="М.П. или подпись (если нет изображения)"
            />
            <div className={styles.sheetStampUpload}>
              <label className={styles.sheetStampUploadLabel}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleStampFile}
                  className={styles.sheetStampFileInput}
                />
                {block.image ? 'Заменить изображение' : 'Загрузить изображение'}
              </label>
              {block.image && (
                <button
                  type="button"
                  className={styles.sheetStampRemoveImg}
                  onClick={() => updateBlock(index, { image: null })}
                >
                  Удалить изображение
                </button>
              )}
            </div>
          </div>
          {block.image && (
            <div className={styles.sheetInspectorSection}>
              <span className={styles.sheetInspectorSectionTitle}>Размер и позиция</span>
              <div className={styles.sheetStampSizeRow}>
                <label>
                  Ширина (px): <input type="number" min={40} max={300} value={w} onChange={(e) => updateBlock(index, { stampWidth: e.target.value ? parseInt(e.target.value, 10) : 120 })} className={styles.sheetStampNumInput} />
                </label>
                <label>
                  Высота (px): <input type="number" min={40} max={300} value={h} onChange={(e) => updateBlock(index, { stampHeight: e.target.value ? parseInt(e.target.value, 10) : 120 })} className={styles.sheetStampNumInput} />
                </label>
              </div>
              <div className={styles.sheetStampSizeRow}>
                <label>
                  Выравнивание:
                  <select value={align} onChange={(e) => updateBlock(index, { stampAlign: e.target.value })} className={styles.sheetStampSelect}>
                    <option value="left">Слева</option>
                    <option value="center">По центру</option>
                    <option value="right">Справа</option>
                  </select>
                </label>
                <label>
                  Смещение X (px): <input type="number" value={offsetX} onChange={(e) => updateBlock(index, { stampOffsetX: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })} className={styles.sheetStampNumInput} />
                </label>
                <label>
                  Смещение Y (px): <input type="number" value={offsetY} onChange={(e) => updateBlock(index, { stampOffsetY: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })} className={styles.sheetStampNumInput} />
                </label>
              </div>
              <img src={block.image} alt="Печать" className={styles.sheetStampPreview} />
            </div>
          )}
        </div>
      );
    }
    if (block.type === BLOCK_TYPES.image) {
      const handleImageFile = (e) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => updateBlock(index, {
          image: reader.result,
          imageWidth: block.imageWidth ?? 240,
          imageHeight: block.imageHeight ?? 180,
        });
        reader.readAsDataURL(file);
        e.target.value = '';
      };
      const w = Math.min(600, Math.max(40, Number(block.imageWidth) || 240));
      const h = Math.min(600, Math.max(40, Number(block.imageHeight) || 180));
      const align = block.imageAlign || 'center';
      const offsetX = Number(block.imageOffsetX) || 0;
      const offsetY = Number(block.imageOffsetY) || 0;
      const imageNumber = getImageBlockNumber(block, blocks);
      return (
        <div className={styles.sheetStampEditor}>
          <div className={styles.sheetInspectorSection}>
            <span className={styles.sheetInspectorSectionTitle}>
              Изображение{imageNumber ? ` № ${imageNumber}` : ''}
            </span>
            <div className={styles.sheetStampUpload}>
              <label className={styles.sheetStampUploadLabel}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className={styles.sheetStampFileInput}
                />
                {block.image ? 'Заменить изображение' : 'Загрузить изображение'}
              </label>
              {block.image && (
                <button
                  type="button"
                  className={styles.sheetStampRemoveImg}
                  onClick={() => updateBlock(index, { image: null })}
                >
                  Удалить изображение
                </button>
              )}
            </div>
            <label className={styles.sheetStampCheckLabel}>
              <input
                type="checkbox"
                checked={block.showCaption !== false}
                onChange={(e) => updateBlock(index, { showCaption: e.target.checked })}
              />
              Показать подпись
            </label>
            <label className={styles.sheetStampCheckLabel}>
              <input
                type="checkbox"
                checked={block.captionAutoNumber !== false}
                onChange={(e) => updateBlock(index, { captionAutoNumber: e.target.checked })}
              />
              Автонумерация (Рис. {'{n}.'})
            </label>
            <input
              type="text"
              value={block.caption || ''}
              onChange={(e) => updateBlock(index, { caption: e.target.value })}
              className={styles.sheetStampInput}
              placeholder="Подпись (используйте {n} для номера)"
            />
          </div>
          <div className={styles.sheetInspectorSection}>
            <span className={styles.sheetInspectorSectionTitle}>Размер и позиция</span>
            <div className={styles.sheetStampSizeRow}>
              <label>
                Ширина (px):
                <input type="number" min={40} max={600} value={w} onChange={(e) => updateBlock(index, { imageWidth: e.target.value ? parseInt(e.target.value, 10) : 240 })} className={styles.sheetStampNumInput} />
              </label>
              <label>
                Высота (px):
                <input type="number" min={40} max={600} value={h} onChange={(e) => updateBlock(index, { imageHeight: e.target.value ? parseInt(e.target.value, 10) : 180 })} className={styles.sheetStampNumInput} />
              </label>
              <label>
                Выравнивание:
                <select value={align} onChange={(e) => updateBlock(index, { imageAlign: e.target.value })} className={styles.sheetStampSelect}>
                  <option value="left">Слева</option>
                  <option value="center">По центру</option>
                  <option value="right">Справа</option>
                </select>
              </label>
              <label>
                Смещение X (px):
                <input type="number" value={offsetX} onChange={(e) => updateBlock(index, { imageOffsetX: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })} className={styles.sheetStampNumInput} />
              </label>
              <label>
                Смещение Y (px):
                <input type="number" value={offsetY} onChange={(e) => updateBlock(index, { imageOffsetY: e.target.value === '' ? 0 : parseInt(e.target.value, 10) })} className={styles.sheetStampNumInput} />
              </label>
            </div>
            <SheetImageBlockPreview block={block} imageNumber={imageNumber} styles={styles} />
          </div>
        </div>
      );
    }
    if (block.type === BLOCK_TYPES.field) {
      const fieldMeta = availableFields.find((f) => f.name === block.field_name);
      const isTable = fieldMeta?.type === 'table';
      const columns = Array.isArray(block.tableColumns) && block.tableColumns.length > 0
        ? block.tableColumns
        : DEFAULT_TABLE_COLUMNS;

      const setTableColumns = (next) => updateBlock(index, { tableColumns: next });
      const addColumn = () => setTableColumns([...columns, { key: 'Колонка', label: 'Колонка' }]);
      const removeColumn = (i) => setTableColumns(columns.filter((_, j) => j !== i));
      const updateColumnLabel = (i, value) => {
        const next = columns.map((c, j) => (j !== i ? c : { key: value, label: value }));
        setTableColumns(next);
      };

      const ts = block.textStyle || {};
      const updateTextStyle = (patch) => updateBlock(index, { textStyle: { ...ts, ...patch } });
      const selectableFields = getSelectableFieldsForBlock(
        availableFields,
        blocks,
        index,
        block.field_name,
      );

      return (
        <div className={styles.sheetFieldEditor}>
          <div className={styles.sheetInspectorSection}>
            <span className={styles.sheetInspectorSectionTitle}>Поле</span>
            <select
              value={block.field_name || ''}
              onChange={(e) => {
                const name = e.target.value;
                const meta = availableFields.find((f) => f.name === name);
                const patch = { field_name: name };
                if (meta?.type === 'table') {
                  patch.displayType = FIELD_DISPLAY.table;
                  if (!block.tableColumns?.length) {
                    patch.tableColumns = resolveTableColumns({ ...block, field_name: name }, meta).map((c) => ({ ...c }));
                  }
                } else {
                  patch.displayType = FIELD_DISPLAY.form;
                }
                updateBlock(index, patch);
              }}
              className={styles.sheetFieldSelect}
            >
              <option value="">— Выберите поле —</option>
              {selectableFields.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          {block.field_name && fieldMeta && (
            <div className={styles.sheetInspectorSection}>
              <span className={styles.sheetInspectorSectionTitle}>Значение по умолчанию</span>
              <StructureFieldDefaultInput
                field={{
                  ...fieldMeta,
                  columns: resolveTableColumns(block, fieldMeta),
                  default: Object.prototype.hasOwnProperty.call(defaultValues, block.field_name)
                    ? defaultValues[block.field_name]
                    : fieldMeta.default,
                }}
                onCommit={(value) => onDefaultValueChange?.(block.field_name, value)}
              />
            </div>
          )}
          {isTable && (
            <div className={styles.sheetInspectorSection}>
              <span className={styles.sheetInspectorSectionTitle}>Колонки таблицы</span>
              {block.field_name && (
                <label className={styles.sheetFieldKeepEmptyRows}>
                  <input
                    type="checkbox"
                    checked={block.keepEmptyRows === true}
                    onChange={(e) => updateBlock(index, { keepEmptyRows: e.target.checked })}
                  />
                  Сохранять пустые строки в документе
                </label>
              )}
              <div className={styles.sheetTableColumns}>
                {columns.map((col, i) => (
                  <div key={i} className={styles.sheetTableColumnRow}>
                    <input
                      type="text"
                      className={styles.sheetTableColumnLabel}
                      value={col.label}
                      onChange={(e) => updateColumnLabel(i, e.target.value)}
                      placeholder="Заголовок"
                    />
                    <button type="button" className={styles.sheetTableColumnRemove} onClick={() => removeColumn(i)} title="Удалить колонку">
                      <IconClose size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" className={styles.sheetTableColumnAdd} onClick={addColumn}>
                  + Добавить колонку
                </button>
              </div>
            </div>
          )}
          <div className={styles.sheetInspectorSection}>
            <span className={styles.sheetInspectorSectionTitle}>Оформление</span>
            {renderTextStyleControls(ts, updateTextStyle)}
          </div>
        </div>
      );
    }
    if (block.type === SPREADSHEET_BLOCK_TYPE) {
      const fieldData = block.field_name ? fieldValues[block.field_name] : undefined;
      const { columns, rows, fieldName } = getSpreadsheetPreviewData(block, fieldData);
      return (
        <p className={styles.sheetInspectorHint}>
          Поле: <strong>{fieldName || '—'}</strong> ({columns.length}×{rows.length}).
          Сетка задаётся в конструкторе «Создать шаблон → Таблица»; здесь — только предпросмотр слева.
        </p>
      );
    }
    // text
    const ts = block.textStyle || {};
    const updateTextStyle = (patch) => updateBlock(index, { textStyle: { ...ts, ...patch } });
    return (
      <div className={styles.sheetFieldEditor}>
        <div className={styles.sheetInspectorSection}>
          <span className={styles.sheetInspectorSectionTitle}>Текст</span>
          <textarea
            value={block.content || ''}
            onChange={(e) => updateBlock(index, { content: e.target.value })}
            className={styles.sheetTextArea}
            placeholder="Введите текст..."
            rows={4}
          />
        </div>
        <div className={styles.sheetInspectorSection}>
          <span className={styles.sheetInspectorSectionTitle}>Оформление</span>
          {renderTextStyleControls(ts, updateTextStyle)}
        </div>
      </div>
    );
  };


  useEffect(() => {
    if (activeBlockIndex != null && activeBlockIndex >= blocks.length) {
      setActiveBlockIndex(blocks.length > 0 ? blocks.length - 1 : null);
    }
  }, [blocks.length, activeBlockIndex]);

  useEffect(() => {
    if (activeBlockIndex == null) return;
    const el = sidebarBlockRefs.current[activeBlockIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeBlockIndex]);

  useEffect(() => {
    if (readOnly || !sidebarOpen) return undefined;
    const rootEl = editorRootRef.current?.closest(`.${styles.editorBody}`);
    const updateActive = () => {
      const usingPort = rootEl && rootEl.scrollHeight > rootEl.clientHeight;
      const height = usingPort ? rootEl.clientHeight : window.innerHeight;
      const guide = usingPort
        ? rootEl.getBoundingClientRect().top + height * 0.28
        : height * 0.28;
      let best = -1;
      let bestDist = Infinity;
      previewBlockRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < guide - 40 || rect.top > guide + height) return;
        const dist = Math.abs(rect.top + rect.height * 0.2 - guide);
        if (dist < bestDist) {
          bestDist = dist;
          best = index;
        }
      });
      if (best >= 0) setActiveBlockIndex(best);
    };
    updateActive();
    const target = rootEl && rootEl.scrollHeight > rootEl.clientHeight ? rootEl : window;
    target.addEventListener('scroll', updateActive, { passive: true });
    return () => target.removeEventListener('scroll', updateActive);
  }, [blocks.length, readOnly, sidebarOpen]);

  const renderPageContent = () =>
    blocks.map((block, index) => {
      let content;
      if (block.type === BLOCK_TYPES.page_break) {
        content = (
          <div className={styles.sheetPageBreak} style={{ pageBreakAfter: 'always' }}>
            — Разрыв страницы —
          </div>
        );
      } else if (block.type === SPREADSHEET_BLOCK_TYPE) {
        const fieldData = block.field_name ? fieldValues[block.field_name] : undefined;
        const { columns, rows, fieldName } = getSpreadsheetPreviewData(block, fieldData);
        const fieldTextStyle = getTextStyleFromBlock(block);
        content = (
          <div className={styles.sheetPageField} style={fieldTextStyle}>
            {fieldName ? (
              <span className={styles.sheetPageFieldLabel} style={fieldTextStyle}>{fieldName}</span>
            ) : null}
            <div className={styles.sheetPageFieldValue} style={fieldTextStyle}>
              <table className={styles.printTable}>
                <thead>
                  <tr>
                    {columns.map((col, ci) => (
                      <th key={col.key || ci}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0
                    ? rows.map((row, i) => (
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
      } else if (block.type === BLOCK_TYPES.field) {
        const fieldMetaPreview = availableFields.find((f) => f.name === block.field_name);
        const rawValue = block.field_name ? fieldValues[block.field_name] : null;
        const isTable = isTableFieldBlock(block, availableFields) || isTableFieldValue(rawValue);
        const value = rawValue ?? (isTable ? [] : '_______________');

        const fieldTextStyle = getTextStyleFromBlock(block);
        if (isTable) {
          const rows = Array.isArray(value) ? value : [];
          const columns = resolveTableColumns(block, fieldMetaPreview);
          content = (
            <div className={styles.sheetPageField} style={fieldTextStyle}>
              <span className={styles.sheetPageFieldLabel} style={fieldTextStyle}>{block.field_name || '(поле)'}</span>
              <div className={styles.sheetPageFieldValue} style={fieldTextStyle}>
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
          );
        } else {
          content = (
            <div className={styles.sheetPageField} style={fieldTextStyle}>
              <span className={styles.sheetPageFieldLabel} style={fieldTextStyle}>{block.field_name || '(поле)'}</span>
              <span className={styles.sheetPageFieldValue} style={fieldTextStyle}>{formatScalarFieldPreview(value)}</span>
            </div>
          );
        }
      } else if (block.type === BLOCK_TYPES.stamp) {
        const showCircle = block.showCircle !== false;
        const w = Math.min(300, Math.max(40, Number(block.stampWidth) || 120));
        const h = Math.min(300, Math.max(40, Number(block.stampHeight) || 120));
        const align = block.stampAlign || 'center';
        const offsetX = Number(block.stampOffsetX) || 0;
        const offsetY = Number(block.stampOffsetY) || 0;
        const wrapStyle = {
          justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
          marginTop: offsetY ? `${offsetY}px` : undefined,
          marginLeft: offsetX ? `${offsetX}px` : undefined,
          marginRight: offsetX && align === 'right' ? undefined : offsetX ? undefined : undefined,
        };
        const stampStyle = {
          width: w,
          height: h,
          borderRadius: showCircle ? '50%' : 0,
          border: showCircle ? '2px solid #94a3b8' : 'none',
        };
        content = (
          <div className={styles.sheetPageStampWrap} style={wrapStyle}>
            <div className={styles.sheetPageStamp} style={stampStyle}>
              {block.image ? (
                <img src={block.image} alt="" className={styles.sheetPageStampImg} />
              ) : (
                <span className={styles.sheetPageStampText}>{block.content || 'М.П.'}</span>
              )}
            </div>
          </div>
        );
      } else if (block.type === BLOCK_TYPES.image) {
        content = (
          <SheetImageBlockPreview
            block={block}
            imageNumber={getImageBlockNumber(block, blocks)}
            styles={styles}
          />
        );
      } else {
        content = (
          <div className={styles.sheetPageText} style={getTextStyleFromBlock(block)}>
            {(block.content || '').split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {line || '\u00A0'}
                {i < (block.content || '').split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        );
      }

      if (readOnly) {
        return <React.Fragment key={index}>{content}</React.Fragment>;
      }
      return (
        <div
          key={index}
          ref={(el) => { previewBlockRefs.current[index] = el; }}
          className={`${styles.sheetPageBlockWrap}${activeBlockIndex === index ? ` ${styles.sheetPageBlockWrapActive}` : ''}`}
          draggable
          onDragStart={(e) => handlePreviewDragStart(e, index)}
          onDragEnd={handlePreviewDragEnd}
          onDragOver={handlePreviewDragOver}
          onDragLeave={handlePreviewDragLeave}
          onDrop={(e) => handlePreviewDrop(e, index)}
          onClick={() => setActiveBlockIndex(index)}
        >
          {content}
        </div>
      );
    });

  return (
    <div ref={editorRootRef} className={`${styles.sheetEditor} ${readOnly || !sidebarOpen ? styles.sheetEditorSidebarHidden : ''}`}>
      {!readOnly && (
        <div className={styles.sheetEditorPreviewActions}>
          <button
            type="button"
            className={styles.sheetEditorSidebarToggle}
            onClick={() => {
              setSidebarOpen((prev) => {
                const next = !prev;
                writeSheetSidebarPreference(next);
                return next;
              });
            }}
            aria-expanded={sidebarOpen}
            aria-controls="sheet-editor-sidebar"
            title={sidebarOpen ? 'Скрыть панель блоков' : 'Показать панель блоков'}
          >
            {sidebarOpen ? (
              <>
                <span>Скрыть блоки</span>
                <IconChevronRight size={14} />
              </>
            ) : (
              <>
                <IconChevronLeft size={14} />
                <span>Показать блоки</span>
              </>
            )}
          </button>
        </div>
      )}
      {!readOnly && sidebarOpen && !toolbarOutside && (
        <div className={styles.sheetToolbar}>
          <SheetBlockAddButton blockType="text" onClick={() => addBlock(BLOCK_TYPES.text)} />
          {showAddFieldButton && (
            <SheetBlockAddButton blockType="field" onClick={() => addBlock(BLOCK_TYPES.field)} />
          )}
          <SheetBlockAddButton blockType="page_break" onClick={() => addBlock(BLOCK_TYPES.page_break)} />
          <SheetBlockAddButton blockType="stamp" onClick={() => addBlock(BLOCK_TYPES.stamp)} />
          <SheetBlockAddButton blockType="image" onClick={() => addBlock(BLOCK_TYPES.image)} />
        </div>
      )}
      <div className={styles.sheetEditorPreviewCol}>
        <div className={styles.sheetEditorPreview}>
          <div className={styles.sheetPage}>
            <div className={styles.sheetPageInner}>
              {documentTitle != null && documentTitle !== '' && (
                <div className={styles.sheetPageDocTitle} style={documentTitleStyle ? getTextStyleFromBlock({ textStyle: documentTitleStyle }) : undefined}>
                  {documentTitle}
                </div>
              )}
              {renderPageContent()}
            </div>
          </div>
        </div>
      </div>
      {!readOnly && sidebarOpen && (
        <div id="sheet-editor-sidebar" className={styles.sheetEditorSidebar}>
          <div ref={blockListRef} className={styles.sheetBlockList}>
            {blocks.length === 0 ? (
              <p className={styles.placeholder}>Добавьте блоки: текст, поля, разрывы страниц или печать.</p>
            ) : (
              blocks.map((block, index) => renderBlockRow(block, index))
            )}
          </div>
          {activeBlockIndex != null && blocks[activeBlockIndex] && (
            <div className={styles.sheetBlockInspector}>
              <div className={styles.sheetBlockInspectorHeader}>
                <div className={styles.sheetBlockInspectorHeading}>
                  <span className={styles.sheetBlockRowBadge} data-type={blocks[activeBlockIndex].type || 'text'}>
                    {getBlockTypeLabel(blocks[activeBlockIndex])}
                  </span>
                  <span className={styles.sheetBlockInspectorTitle}>
                    {getBlockRowTitle(blocks[activeBlockIndex])}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.sheetBlockRowDelete}
                  onClick={() => removeBlock(activeBlockIndex)}
                  title="Удалить"
                  aria-label="Удалить блок"
                >
                  <IconClose size={14} />
                </button>
              </div>
              <div className={styles.sheetBlockInspectorBody}>
                {renderBlockInspector(blocks[activeBlockIndex], activeBlockIndex)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SheetEditor.displayName = 'SheetEditor';

export default SheetEditor;
export { BLOCK_TYPES, newBlock, FIELD_DISPLAY, DEFAULT_TABLE_COLUMNS, FONT_OPTIONS, getTextStyleString, getTextStyleFromBlock };
