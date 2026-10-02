import React, { useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import { bugReportService } from '../../services/bugReportService';
import { formatCallDiagnosticsText } from '../../calls/callDiagnostics';
import styles from './CallBugReportModal.module.css';

export default function CallBugReportModal({
  open,
  onClose,
  collectDiagnostics,
  captureRoot,
}) {
  const [text, setText] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setErr('');
    const diag = collectDiagnostics?.() || {};
    setText(formatCallDiagnosticsText(diag));
  }, [open, collectDiagnostics]);

  if (!open) return null;

  const capturePanel = async () => {
    setErr('');
    const node = captureRoot?.current || document.querySelector('[data-call-panel]');
    if (!node) {
      setErr('Не найден экран звонка для снимка');
      return;
    }
    try {
      const canvas = await html2canvas(node, {
        backgroundColor: '#0f172a',
        scale: 1,
        logging: false,
      });
      setScreenshot(canvas.toDataURL('image/png'));
    } catch (e) {
      setErr(e?.message || 'Не удалось сделать скриншот');
    }
  };

  const onFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshot(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      const diag = collectDiagnostics?.() || {};
      await bugReportService.create({
        title: (diag.error || 'Ошибка видеозвонка').slice(0, 300),
        description: text.trim(),
        page_url: typeof window !== 'undefined' ? window.location.href : '',
        user_agent: diag.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        screenshot_data: screenshot || null,
        severity: 'high',
        meta_data: { source: 'call', partyRoomId: diag.partyRoomId, mediaMode: diag.mediaMode },
      });
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.detail || e?.message || 'Не удалось отправить отчёт');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-label="Сообщить об ошибке">
      <div className={styles.modal}>
        <strong>Сообщить об ошибке</strong>
        {done ? (
          <p className={styles.ok}>Отчёт отправлен. Администратор получит задачу.</p>
        ) : (
          <>
            <textarea
              className={styles.text}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
            />
            <div className={styles.row}>
              <button type="button" className={styles.secondary} onClick={() => void capturePanel()}>
                Скриншот звонка
              </button>
              <label className={styles.file}>
                Прикрепить файл
                <input type="file" accept="image/*" onChange={onFile} />
              </label>
            </div>
            {screenshot ? (
              <img className={styles.preview} src={screenshot} alt="Скриншот" />
            ) : null}
            {err ? <p className={styles.err}>{err}</p> : null}
          </>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Закрыть
          </button>
          {!done && (
            <button type="button" className={styles.primary} disabled={busy} onClick={() => void submit()}>
              {busy ? 'Отправка…' : 'Отправить'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
