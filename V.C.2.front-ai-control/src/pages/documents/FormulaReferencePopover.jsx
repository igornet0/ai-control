import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SPREADSHEET_FORMULA_CATALOG } from './spreadsheetFormulaCatalog';
import s from './FormulaReference.module.css';

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'math', label: 'Математика' },
  { id: 'stat', label: 'Статистика' },
  { id: 'logic', label: 'Логика' },
  { id: 'text', label: 'Текст' },
  { id: 'lookup', label: 'Поиск' },
  { id: 'date', label: 'Даты' },
  { id: 'info', label: 'Проверки' },
];

const BASICS = [
  { code: '=B2*C2', text: 'Формула начинается с «=». Ссылка — буква столбца и номер строки.' },
  { code: '=СУММ(B2:B10)', text: 'Диапазон: от левой верхней до правой нижней ячейки через «:».' },
  { code: '=B2*$E$1', text: '«$» закрепляет столбец или строку — при протягивании ссылка не сдвинется.' },
  { code: "='Лист 2'!B3", text: 'Ссылка на другой лист. Имя с пробелами — в одинарных кавычках.' },
  { code: '=ЕСЛИ(B2>100; "много"; "мало")', text: 'Аргументы через «;» (или «,»). Текст — в двойных кавычках.' },
  { code: '="№ "&A2', text: 'Операторы: + − * / ^ (степень) % & (склеить текст) = <> < > <= >=.' },
];

const ERRORS = [
  ['#DIV/0!', 'деление на ноль'],
  ['#VALUE!', 'текст там, где нужно число'],
  ['#NAME?', 'неизвестная функция или имя'],
  ['#REF!', 'неверная или циклическая ссылка'],
  ['#N/A', 'значение не найдено (ВПР, ПОИСКПОЗ)'],
  ['#ERROR!', 'ошибка в записи формулы'],
];

/** Первый вариант примера («A или B» → «A») с ведущим «=». */
function copyTextFor(example) {
  const first = String(example || '').split(/\s+или\s+/)[0].trim();
  return first.startsWith('=') ? first : `=${first}`;
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ text, label = 'Копировать' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  return (
    <button
      type="button"
      className={`${s.copyBtn} ${copied ? s.copyBtnDone : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (!ok) return;
        setCopied(true);
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), 1500);
      }}
      title={`Скопировать ${text}`}
      aria-label={`Скопировать ${text}`}
    >
      {copied ? 'Скопировано' : label}
    </button>
  );
}

const POPOVER_WIDTH = 460;

/**
 * Кнопка «Справочник» в строке формулы: функции с описанием, примеры и копирование.
 */
export default function FormulaReferenceButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const place = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = rect.bottom + 6;
    const maxHeight = Math.max(240, window.innerHeight - top - 12);
    setPos({ left, top, width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, place]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPREADSHEET_FORMULA_CATALOG.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return [item.name, ...(item.aliases || []), item.description]
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [query, category]);

  const showBasics = !query.trim() && category === 'all';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${s.triggerBtn} ${open ? s.triggerBtnActive : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Справочник формул"
      >
        <span aria-hidden className={s.triggerIcon}>ƒ</span>
        Справочник
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className={s.panel}
          style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}
          role="dialog"
          aria-label="Справочник формул"
          data-formula-bar-dock="1"
        >
          <div className={s.header}>
            <h3 className={s.title}>Справочник формул</h3>
            <button type="button" className={s.closeBtn} onClick={() => setOpen(false)} aria-label="Закрыть справочник">×</button>
          </div>
          <input
            ref={searchRef}
            type="search"
            className={s.search}
            placeholder="Поиск: сумма, ВПР, дата…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Поиск функции"
          />
          <div className={s.categories} role="tablist" aria-label="Категории функций">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={category === cat.id}
                className={`${s.category} ${category === cat.id ? s.categoryActive : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className={s.body}>
            {showBasics && (
              <section className={s.basics} aria-label="Основы">
                <h4 className={s.sectionTitle}>Основы</h4>
                <ul className={s.basicsList}>
                  {BASICS.map((b) => (
                    <li key={b.code} className={s.basicsItem}>
                      <div className={s.exampleRow}>
                        <code className={s.code}>{b.code}</code>
                        <CopyButton text={b.code} />
                      </div>
                      <p className={s.desc}>{b.text}</p>
                    </li>
                  ))}
                </ul>
                <h4 className={s.sectionTitle}>Ошибки</h4>
                <ul className={s.errors}>
                  {ERRORS.map(([code, text]) => (
                    <li key={code}><code className={s.errorCode}>{code}</code> {text}</li>
                  ))}
                </ul>
                <h4 className={s.sectionTitle}>Функции</h4>
              </section>
            )}
            {items.length === 0 ? (
              <p className={s.empty}>Ничего не найдено</p>
            ) : (
              <ul className={s.list}>
                {items.map((item) => {
                  const copyText = copyTextFor(item.example);
                  return (
                    <li key={item.id} className={s.item}>
                      <div className={s.itemHead}>
                        <span className={s.name}>{item.name}</span>
                        {item.aliases?.length > 0 && (
                          <span className={s.aliases}>{item.aliases.join(' · ')}</span>
                        )}
                      </div>
                      <p className={s.desc}>{item.description}</p>
                      <div className={s.exampleRow}>
                        <code className={s.code}>{copyText}</code>
                        <CopyButton text={copyText} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className={s.footer}>Скопируйте пример и вставьте в ячейку или строку формулы (Ctrl+V), затем замените ссылки на свои.</p>
        </div>,
        document.body,
      )}
    </>
  );
}
