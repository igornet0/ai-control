import React, { useEffect, useRef, useState } from 'react';
import { supportService } from '../../../services/supportService';
import { formatApiError } from '../../../utils/formatApiError';
import styles from '../Support.module.css';

export default function HelpImageFrame({
  categoryId,
  articleId,
  slot,
  label,
  canEdit,
  revision,
  onChanged,
}) {
  const inputRef = useRef(null);
  const blobUrlRef = useRef(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setImageUrl(null);

      try {
        const blob = await supportService.fetchHelpImageBlob(categoryId, articleId, slot);
        if (cancelled) return;
        if (!blob) {
          setLoading(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setImageUrl(url);
      } catch {
        if (!cancelled) setImageUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [categoryId, articleId, slot, revision]);

  const handleUpload = async (file) => {
    if (!file || !canEdit) return;
    setBusy(true);
    setError('');
    try {
      await supportService.uploadHelpImage(categoryId, articleId, slot, file);
      onChanged?.();
    } catch (err) {
      setError(formatApiError(err, 'Не удалось загрузить изображение'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!canEdit || !imageUrl) return;
    setBusy(true);
    setError('');
    try {
      await supportService.deleteHelpImage(categoryId, articleId, slot);
      onChanged?.();
    } catch (err) {
      setError(formatApiError(err, 'Не удалось удалить изображение'));
    } finally {
      setBusy(false);
    }
  };

  // Regular users: never show empty / loading frames — only a real image.
  if (!canEdit) {
    if (loading || !imageUrl) return null;
    return (
      <figure className={styles.helpFigure}>
        <div className={styles.helpFigureFrame}>
          <img src={imageUrl} alt={label || 'Иллюстрация'} className={styles.helpFigureImg} />
        </div>
        {label ? <figcaption className={styles.helpFigureCaption}>{label}</figcaption> : null}
      </figure>
    );
  }

  // Editors (admin / support): always show framed slot to add or replace.
  return (
    <figure className={styles.helpFigure}>
      <div className={styles.helpFigureFrame}>
        {loading ? (
          <div className={styles.helpFigurePlaceholder}>Загрузка…</div>
        ) : imageUrl ? (
          <img src={imageUrl} alt={label || 'Иллюстрация'} className={styles.helpFigureImg} />
        ) : (
          <div className={styles.helpFigurePlaceholder}>
            {label || 'Изображение'}
            <span className={styles.helpFigureHint}>Рамка для скриншота</span>
          </div>
        )}
      </div>

      <div className={styles.helpFigureActions}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={busy || loading}
          onClick={() => inputRef.current?.click()}
        >
          {imageUrl ? 'Заменить' : 'Добавить'}
        </button>
        {imageUrl ? (
          <button
            type="button"
            className={styles.dangerButton}
            disabled={busy || loading}
            onClick={handleDelete}
          >
            Удалить
          </button>
        ) : null}
      </div>

      {error ? <p className={styles.formError}>{error}</p> : null}
      {label ? <figcaption className={styles.helpFigureCaption}>{label}</figcaption> : null}
    </figure>
  );
}
