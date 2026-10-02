import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatPreviewBytes,
  loadAttachmentPreview,
  revokePreviewState,
} from '../../../services/messagingAttachmentPreview';
import { getAttachmentUrl } from '../../../services/messagingBaseUrl';
import styles from './AttachmentPreviewModal.module.css';

function PreviewTable({ table }) {
  if (table?.message) {
    return <p className={styles.hint}>{table.message}</p>;
  }
  if (!table?.headers?.length) {
    return <p className={styles.hint}>Нет данных для отображения</p>;
  }
  return (
    <div className={styles.tableWrap}>
      {table.truncated && (
        <p className={styles.hint}>
          Показана только часть файла ({table.rows.length} строк)
          {table.totalSizeBytes ? `, размер: ${formatPreviewBytes(table.totalSizeBytes)}` : ''}
          . Скачайте файл для полного просмотра.
        </p>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIdx) => (
            <tr key={`row-${rowIdx}`}>
              {row.map((cell, cellIdx) => (
                <td key={`cell-${rowIdx}-${cellIdx}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AttachmentPreviewModal({ attachment, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!attachment) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setPreview(null);

    loadAttachmentPreview(attachment)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(err.message || 'Не удалось открыть файл');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attachment]);

  useEffect(() => {
    return () => {
      if (preview) revokePreviewState(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (!attachment) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attachment, onClose]);

  if (!attachment) return null;

  const downloadUrl = getAttachmentUrl(attachment.id);
  const title = attachment.original_filename || 'Файл';

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Просмотр: ${title}`}
      >
        <div className={styles.head}>
          <span className={styles.title}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.hint}>Загрузка…</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!loading && !error && preview?.kind === 'pdf' && preview.blobUrl && (
            <iframe
              title={title}
              src={preview.blobUrl}
              className={styles.pdfFrame}
            />
          )}

          {!loading && !error && preview?.kind === 'video' && preview.src && (
            <video
              src={preview.src}
              className={styles.videoFrame}
              controls
              autoPlay
              playsInline
            />
          )}

          {!loading && !error && (preview?.kind === 'csv' || preview?.kind === 'excel') && (
            <PreviewTable table={preview.table} />
          )}

          {!loading && !error && preview?.kind === 'word' && preview.html && (
            <div
              className={styles.docHtml}
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          )}

          {!loading && !error && preview?.kind === 'text' && (
            <pre className={styles.textPreview}>{preview.text}</pre>
          )}

          {!loading && !error && preview?.message && (
            <p className={styles.hint}>{preview.message}</p>
          )}
        </div>

        <div className={styles.footer}>
          <a
            href={downloadUrl}
            download={title}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.download}
          >
            Скачать
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
