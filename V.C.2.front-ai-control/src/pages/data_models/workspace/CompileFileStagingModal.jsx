import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import styles from './CompileFileStagingModal.module.css';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Modal to attach local files before compile (files are not stored on server).
 */
const CompileFileStagingModal = ({
  isOpen,
  requirements,
  onCancel,
  onConfirm,
  loading = false,
}) => {
  const [assignments, setAssignments] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    const initial = {};
    for (const req of requirements || []) {
      if (req.hasFileInMemory && req.file) {
        initial[req.fileName] = req.file;
      }
    }
    setAssignments(initial);
  }, [isOpen, requirements]);

  const reqs = requirements || [];
  const readyCount = reqs.filter((r) => assignments[r.fileName]).length;
  const missing = reqs.filter((r) => !assignments[r.fileName]);
  const canConfirm = missing.length === 0 && !loading;

  const handlePickFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = (e) => {
      const picked = Array.from(e.target.files || []);
      setAssignments((prev) => {
        const next = { ...prev };
        for (const req of reqs) {
          if (next[req.fileName]) continue;
          const match = picked.find(
            (f) => f.name === req.fileName || f.name.endsWith(`/${req.fileName}`),
          );
          if (match) next[req.fileName] = match;
        }
        for (const f of picked) {
          const base = f.name.split('/').pop();
          if (reqs.some((r) => r.fileName === base) && !next[base]) {
            next[base] = f;
          }
        }
        return next;
      });
    };
    input.click();
  }, [reqs]);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(assignments);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onCancel} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compile-staging-title"
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 id="compile-staging-title" className={styles.title}>
              Файлы для компиляции
            </h2>
            <p className={styles.subtitle}>
              Локальные файлы передаются только на время сборки модели
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onCancel}
            disabled={loading}
            aria-label="Закрыть"
          >
            <XMarkIcon className={styles.closeIcon} />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.infoBanner}>
            <DocumentTextIcon className={styles.infoIcon} aria-hidden />
            <p className={styles.infoText}>
              Файлы не сохраняются на сервере. Убедитесь, что для каждого источника
              выбран соответствующий CSV или Excel.
            </p>
          </div>

          <div className={styles.summary}>
            <span className={styles.summaryLabel}>Готовность</span>
            <span className={readyCount === reqs.length ? styles.summaryOk : styles.summaryPending}>
              {readyCount} из {reqs.length}
            </span>
          </div>

          <ul className={styles.list}>
            {reqs.map((req) => {
              const assigned = assignments[req.fileName];
              const isReady = Boolean(assigned);
              return (
                <li
                  key={req.fileName}
                  className={`${styles.item} ${isReady ? styles.itemReady : styles.itemMissing}`}
                >
                  <div className={styles.itemIconWrap}>
                    <DocumentTextIcon className={styles.itemIcon} aria-hidden />
                  </div>
                  <div className={styles.itemMain}>
                    <span className={styles.fileName} title={req.fileName}>
                      {req.fileName}
                    </span>
                    <span className={styles.widgetLabel}>{req.widgetName}</span>
                    {isReady && assigned.size > 0 && (
                      <span className={styles.fileSize}>{formatFileSize(assigned.size)}</span>
                    )}
                  </div>
                  <span
                    className={`${styles.statusBadge} ${isReady ? styles.statusOk : styles.statusMissing}`}
                  >
                    {isReady ? (
                      <>
                        <CheckCircleIcon className={styles.statusIcon} aria-hidden />
                        Готов
                      </>
                    ) : (
                      <>
                        <ExclamationCircleIcon className={styles.statusIcon} aria-hidden />
                        Не выбран
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            className={styles.pickArea}
            onClick={handlePickFiles}
            disabled={loading}
          >
            <ArrowUpTrayIcon className={styles.pickIcon} aria-hidden />
            <span className={styles.pickTitle}>Выбрать файлы на компьютере</span>
            <span className={styles.pickHint}>CSV, XLSX, XLS — можно выбрать несколько сразу</span>
          </button>
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            Отмена
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {loading ? 'Компиляция…' : 'Скомпилировать'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CompileFileStagingModal;
