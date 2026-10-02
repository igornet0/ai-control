import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  copyTextToClipboard,
  matrixToClipboard,
  normalizeMarkdownTables,
  tableElementToMatrix,
} from './markdownTables';
import styles from './MarkdownContent.module.css';

function TableWithCopy({ children }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');

  const copy = useCallback(async (format) => {
    const table = wrapRef.current?.querySelector('table');
    const matrix = tableElementToMatrix(table);
    const text = matrixToClipboard(matrix, format);
    const ok = await copyTextToClipboard(text);
    setStatus(ok ? (format === 'tsv' ? 'TSV скопирован' : format === 'csv' ? 'CSV скопирован' : 'Markdown скопирован') : 'Не удалось скопировать');
    setOpen(false);
    window.setTimeout(() => setStatus(''), 1800);
  }, []);

  return (
    <div className={styles.tableBlock} ref={wrapRef}>
      <div className={styles.tableToolbar}>
        <button
          type="button"
          className={styles.tableCopyBtn}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          title="Копировать таблицу"
        >
          Копировать
        </button>
        {open && (
          <div className={styles.tableCopyMenu} role="menu">
            <button type="button" role="menuitem" onClick={() => copy('tsv')}>
              TSV (Excel / Docs)
            </button>
            <button type="button" role="menuitem" onClick={() => copy('csv')}>
              CSV (модель данных)
            </button>
            <button type="button" role="menuitem" onClick={() => copy('markdown')}>
              Markdown
            </button>
          </div>
        )}
        {status && <span className={styles.tableCopyStatus}>{status}</span>}
      </div>
      <div className={styles.tableScroll}>
        <table>{children}</table>
      </div>
    </div>
  );
}

/**
 * Безопасный рендер Markdown (без raw HTML) + GFM-таблицы.
 */
export default function MarkdownContent({ children, className = '' }) {
  const text = useMemo(
    () => normalizeMarkdownTables(children == null ? '' : String(children)),
    [children],
  );
  if (!text) return null;

  return (
    <div className={`${styles.markdown} ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {linkChildren}
            </a>
          ),
          table: ({ children: tableChildren }) => (
            <TableWithCopy>{tableChildren}</TableWithCopy>
          ),
          // Avoid nested <table> from default renderer when we wrap ourselves
          thead: ({ children: c }) => <thead>{c}</thead>,
          tbody: ({ children: c }) => <tbody>{c}</tbody>,
          tr: ({ children: c }) => <tr>{c}</tr>,
          th: ({ children: c }) => <th>{c}</th>,
          td: ({ children: c }) => <td>{c}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
