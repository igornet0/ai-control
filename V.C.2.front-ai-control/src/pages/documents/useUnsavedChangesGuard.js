import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * После загрузки редакторы ещё нормализуют данные (displayType полей, колонки таблиц,
 * заголовок по шаблону) — снимок «чистого» состояния берём, когда это уляжется.
 */
const BASELINE_SETTLE_MS = 400;

/**
 * Отслеживает несохранённые изменения и перехватывает закрытие редактора.
 *
 * @param {object} opts
 * @param {string} opts.fingerprint — сериализованное редактируемое состояние
 * @param {boolean} opts.ready — данные загружены, можно брать исходный снимок
 * @param {boolean} [opts.enabled=true] — false для режима «только просмотр»
 * @param {() => Promise<boolean>} opts.onSave — сохранить; true при успехе
 */
export function useUnsavedChangesGuard({ fingerprint, ready, enabled = true, onSave }) {
  const [baseline, setBaseline] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const pendingActionRef = useRef(null);
  const settleTimerRef = useRef(null);

  const scheduleBaseline = useCallback(() => {
    window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      setBaseline(fingerprintRef.current);
    }, BASELINE_SETTLE_MS);
  }, []);

  useEffect(() => {
    if (!ready) {
      setBaseline(null);
      return undefined;
    }
    scheduleBaseline();
    return () => window.clearTimeout(settleTimerRef.current);
  }, [ready, scheduleBaseline]);

  const isDirty = enabled && baseline !== null && fingerprint !== baseline;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  /** Вызывать после успешного сохранения или перезагрузки данных с сервера. */
  const markClean = useCallback(() => {
    setBaseline(fingerprintRef.current);
    // Ответ сервера может ещё раз нормализовать состояние — переснимаем после него.
    scheduleBaseline();
  }, [scheduleBaseline]);

  // Закрытие вкладки / перезагрузка страницы: браузер покажет свой стандартный вопрос.
  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  /** Выполнить action (закрыть, перейти) — с вопросом, если есть несохранённые изменения. */
  const requestLeave = useCallback((action) => {
    if (!isDirtyRef.current) {
      action?.();
      return;
    }
    pendingActionRef.current = action;
    setSaveError(null);
    setDialogOpen(true);
  }, []);

  const finishLeave = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setDialogOpen(false);
    action?.();
  }, []);

  const handleCancel = useCallback(() => {
    if (saving) return;
    pendingActionRef.current = null;
    setDialogOpen(false);
  }, [saving]);

  const handleDiscard = useCallback(() => {
    if (saving) return;
    finishLeave();
  }, [saving, finishLeave]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    let ok = false;
    try {
      ok = await onSaveRef.current?.();
    } catch {
      ok = false;
    }
    setSaving(false);
    if (ok) {
      finishLeave();
    } else {
      setSaveError('Не удалось сохранить изменения. Попробуйте ещё раз или закройте без сохранения.');
    }
  }, [saving, finishLeave]);

  return {
    isDirty,
    markClean,
    requestLeave,
    dialogProps: {
      open: dialogOpen,
      saving,
      error: saveError,
      onCancel: handleCancel,
      onDiscard: handleDiscard,
      onSave: handleSave,
    },
  };
}
