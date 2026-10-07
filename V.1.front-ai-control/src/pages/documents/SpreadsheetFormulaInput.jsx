import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  applyFormulaSuggestion,
  extractFormulaNamePrefix,
  matchFormulaSuggestions,
} from './spreadsheetFormulaCatalog';
import { formulaTextSegments } from './spreadsheetFormulaHighlight';
import styles from './DocumentsApp.module.css';
import fh from './FormulaHighlight.module.css';

/** Повторить геометрию и шрифт поля на «зеркале» с цветным текстом. */
function syncMirrorToInput(input, mirror) {
  if (!input || !mirror) return;
  const cs = window.getComputedStyle(input);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  Object.assign(mirror.style, {
    left: `${input.offsetLeft}px`,
    top: `${input.offsetTop}px`,
    width: `${input.offsetWidth}px`,
    height: `${input.offsetHeight}px`,
    font: cs.font,
    letterSpacing: cs.letterSpacing,
    paddingLeft: cs.paddingLeft,
    paddingRight: cs.paddingRight,
    paddingTop: cs.paddingTop,
    paddingBottom: cs.paddingBottom,
    borderTopWidth: cs.borderTopWidth,
    borderRightWidth: cs.borderRightWidth,
    borderBottomWidth: cs.borderBottomWidth,
    borderLeftWidth: cs.borderLeftWidth,
    lineHeight: `${Math.max(0, input.clientHeight - padTop - padBottom)}px`,
  });
  mirror.scrollLeft = input.scrollLeft;
}

/**
 * Поле ввода формулы с подсказками функций при наборе имени после «=».
 */
const SpreadsheetFormulaInput = forwardRef(function SpreadsheetFormulaInput({
  value,
  onChange,
  onKeyDown: onKeyDownProp,
  onFocus,
  onBlur,
  onMouseDown,
  className,
  style,
  spellCheck = false,
  'aria-label': ariaLabel,
  inputMode,
  title,
  invalid,
  errorClassName,
  wrapText = false,
  /** Раскрашивать ссылки формулы (A1, B2:C5…) цветами, как рамки на сетке. */
  highlightRefs = false,
}, ref) {
  const listId = useId();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const mirrorRef = useRef(null);
  const colorize = highlightRefs && !wrapText && String(value ?? '').trimStart().startsWith('=');
  const segments = useMemo(() => (colorize ? formulaTextSegments(value) : null), [colorize, value]);
  const syncMirror = useCallback(() => {
    if (colorize) syncMirrorToInput(inputRef.current, mirrorRef.current);
  }, [colorize]);

  useLayoutEffect(() => {
    syncMirror();
  });

  useEffect(() => {
    if (!colorize || typeof ResizeObserver === 'undefined' || !inputRef.current) return undefined;
    const ro = new ResizeObserver(() => syncMirror());
    ro.observe(inputRef.current);
    return () => ro.disconnect();
  }, [colorize, syncMirror]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [listStyle, setListStyle] = useState(null);

  useImperativeHandle(ref, () => inputRef.current);

  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el || !(el instanceof HTMLTextAreaElement)) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 32)}px`;
  }, []);

  useEffect(() => {
    if (!wrapText) return;
    resizeTextarea();
  }, [value, wrapText, resizeTextarea]);

  const updateListPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setListStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      minWidth: `${Math.max(rect.width, 220)}px`,
      zIndex: 12000,
    });
  }, []);

  const refreshSuggestions = useCallback((nextValue, cursorPos) => {
    const parsed = extractFormulaNamePrefix(nextValue, cursorPos);
    if (!parsed) {
      setOpen(false);
      setSuggestions([]);
      return;
    }
    const matches = matchFormulaSuggestions(parsed.prefix);
    setSuggestions(matches);
    setActiveIndex(0);
    const shouldOpen = matches.length > 0 && parsed.prefix.length >= 1;
    setOpen(shouldOpen);
    if (shouldOpen) updateListPosition();
  }, [updateListPosition]);

  const refreshSuggestionsOnEdit = useCallback((nextValue, cursorPos) => {
    refreshSuggestions(nextValue, cursorPos);
  }, [refreshSuggestions]);

  const commitSuggestion = useCallback((index) => {
    const item = suggestions[index];
    const el = inputRef.current;
    if (!item || !el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const next = applyFormulaSuggestion(value ?? '', start, end, item);
    onChange?.(next.value);
    setOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }, [onChange, suggestions, value]);

  const handleChange = (e) => {
    const next = e.target.value;
    onChange?.(next);
    refreshSuggestionsOnEdit(next, e.target.selectionStart);
  };

  const handleFocus = (e) => {
    onFocus?.(e);
    setOpen(false);
  };

  const handleBlur = (e) => {
    setTimeout(() => setOpen(false), 120);
    onBlur?.(e);
  };

  const handleSelect = (e) => {
    syncMirror();
    if (document.activeElement === e.target) {
      refreshSuggestionsOnEdit(e.target.value, e.target.selectionStart);
    }
  };

  const handleKeyDown = (e) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        commitSuggestion(activeIndex);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }
    }
    onKeyDownProp?.(e);
  };

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
    updateListPosition();
  }, [activeIndex, open, updateListPosition]);

  const baseClass = `${className || ''} ${invalid && errorClassName ? errorClassName : ''} ${wrapText ? styles.spreadsheetCellInputWrap : ''} ${colorize ? fh.coloredInput : ''}`.trim();
  const showList = open && suggestions.length > 0;
  const sharedProps = {
    className: baseClass,
    // Формулу при правке показываем слева направо, как в Excel.
    style: colorize ? { ...style, textAlign: 'left' } : style,
    value: value ?? '',
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onMouseDown,
    onSelect: handleSelect,
    onKeyDown: handleKeyDown,
    onKeyUp: syncMirror,
    onScroll: syncMirror,
    onClick: handleSelect,
    spellCheck,
    title,
    'aria-label': ariaLabel,
    'aria-invalid': invalid ? true : undefined,
    'aria-expanded': showList ? true : undefined,
    'aria-autocomplete': 'list',
    'aria-controls': showList ? listId : undefined,
    role: 'combobox',
  };

  return (
    <div className={`${styles.spreadsheetFormulaInputWrap} ${fh.inputWrap}`}>
      {colorize && (
        <div ref={mirrorRef} className={fh.mirror} aria-hidden>
          {segments.map((seg, i) => (
            seg.color
              ? <span key={i} className={fh.mirrorRef} style={{ color: seg.color }}>{seg.text}</span>
              : <span key={i}>{seg.text}</span>
          ))}
        </div>
      )}
      {wrapText ? (
        <textarea
          ref={inputRef}
          rows={1}
          {...sharedProps}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          inputMode={inputMode}
          {...sharedProps}
        />
      )}
      {showList && (
        <ul
          ref={listRef}
          id={listId}
          className={styles.spreadsheetFormulaSuggest}
          style={listStyle || undefined}
          role="listbox"
        >
          {suggestions.map((item, index) => (
            <li key={item.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex ? 'true' : undefined}
                className={`${styles.spreadsheetFormulaSuggestItem} ${index === activeIndex ? styles.spreadsheetFormulaSuggestItemActive : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitSuggestion(index);
                }}
              >
                <span className={styles.spreadsheetFormulaSuggestName}>{item.name}</span>
                {item.aliases?.length ? (
                  <span className={styles.spreadsheetFormulaSuggestAlias}>
                    {item.aliases.join(', ')}
                  </span>
                ) : null}
                <span className={styles.spreadsheetFormulaSuggestDesc}>{item.description}</span>
                <span className={styles.spreadsheetFormulaSuggestExample}>{item.example}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default SpreadsheetFormulaInput;
