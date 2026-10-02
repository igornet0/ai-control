import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  EnvelopeIcon,
  InboxIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { messagingService } from '../../../services/messagingService';
import { useMessagingAlerts } from '../../../context/MessagingAlertsContext';
import ComposeMailModal from './ComposeMailModal';
import styles from './MailPane.module.css';

function mailStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('fail') || s.includes('error')) return styles.badgeFailed;
  if (s.includes('pend') || s.includes('queue')) return styles.badgePending;
  return styles.badgeSent;
}

function previewText(content, max = 72) {
  const t = String(content || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatMailDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MailPane({ user, notify }) {
  const { setUnreadMailCount } = useMessagingAlerts();
  const [folder, setFolder] = useState('inbox');
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const inboxIdsRef = useRef(new Set());

  const items = folder === 'inbox' ? inbox : sent;

  const loadInbox = useCallback(async ({ announceNew = false } = {}) => {
    const data = await messagingService.getInboxMail();
    if (announceNew && inboxIdsRef.current.size > 0) {
      const fresh = data.filter((row) => !row.is_read && !inboxIdsRef.current.has(row.id));
      if (fresh.length > 0) {
        const latest = fresh[0];
        notify?.(
          `Почта: ${latest.subject || 'новое письмо'} от ${latest.from_email}`,
          'info',
          { browser: true, browserTitle: 'Новое письмо' }
        );
      }
    }
    inboxIdsRef.current = new Set(data.map((row) => row.id));
    setInbox(data);
    setUnreadMailCount(data.filter((row) => !row.is_read).length);
    return data;
  }, [notify, setUnreadMailCount]);

  const loadSent = useCallback(async () => {
    const data = await messagingService.getSentMail();
    setSent(data);
    return data;
  }, []);

  const refreshLists = useCallback(async ({ announceNew = false } = {}) => {
    await Promise.all([
      loadInbox({ announceNew }),
      loadSent(),
    ]);
  }, [loadInbox, loadSent]);

  useEffect(() => {
    setLoading(true);
    setError('');
    refreshLists({ announceNew: false })
      .catch((err) => {
        console.error(err);
        const status = err?.response?.status;
        setError(
          status === 401
            ? 'Нет доступа к почте. Обновите страницу или войдите снова.'
            : 'Не удалось загрузить почту'
        );
      })
      .finally(() => setLoading(false));

    const poll = setInterval(() => {
      refreshLists({ announceNew: true }).catch(() => {});
    }, 45000);

    return () => clearInterval(poll);
  }, [refreshLists]);

  useEffect(() => {
    setUnreadMailCount(inbox.filter((row) => !row.is_read).length);
  }, [inbox, setUnreadMailCount]);

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
  }, [folder]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    messagingService.getMailMessage(selectedId, folder)
      .then((msg) => {
        if (!cancelled) setDetail(msg);
        if (!cancelled && folder === 'inbox') {
          setInbox((prev) => prev.map((row) => (
            row.id === selectedId ? { ...row, is_read: true } : row
          )));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedId, folder]);

  const handleSent = async (subject) => {
    notify?.(`Письмо отправлено: ${subject}`, 'success', {
      browser: true,
      browserTitle: 'Почта',
    });
    await refreshLists({ announceNew: false });
    setFolder('sent');
    const data = await loadSent();
    if (data[0]?.id) setSelectedId(data[0].id);
  };

  const unreadCount = inbox.filter((row) => !row.is_read).length;

  return (
    <>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <div>
              <h2>Почта</h2>
              <p>{user?.email || 'корпоративный ящик'}</p>
            </div>
            <button type="button" className={styles.composeBtn} onClick={() => setComposeOpen(true)}>
              <PaperAirplaneIcon />
              Написать
            </button>
          </div>

          <div className={styles.folderTabs} role="tablist" aria-label="Папки почты">
            <button
              type="button"
              role="tab"
              aria-selected={folder === 'inbox'}
              className={folder === 'inbox' ? styles.folderTabActive : styles.folderTab}
              onClick={() => setFolder('inbox')}
            >
              Входящие{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={folder === 'sent'}
              className={folder === 'sent' ? styles.folderTabActive : styles.folderTab}
              onClick={() => setFolder('sent')}
            >
              Отправленные
            </button>
          </div>

          <ul className={styles.mailList}>
            {loading && (
              <li className={styles.empty}>
                <strong>Загрузка…</strong>
              </li>
            )}
            {!loading && error && (
              <li className={styles.empty}>
                <strong>{error}</strong>
              </li>
            )}
            {!loading && !error && items.length === 0 && (
              <li className={styles.empty}>
                <InboxIcon className={styles.emptyIcon} />
                <strong>{folder === 'inbox' ? 'Нет входящих' : 'Нет отправленных'}</strong>
                <p>{folder === 'inbox' ? 'Входящие письма появятся здесь' : 'Нажмите «Написать», чтобы отправить первое письмо'}</p>
              </li>
            )}
            {!loading && !error && items.map((row) => {
              const isInbox = folder === 'inbox';
              const counterpart = isInbox
                ? (row.from_name || row.from_email)
                : row.to_email;
              const timestamp = isInbox ? row.received_at : row.sent_at;
              const isActive = selectedId === row.id;
              const itemClass = [
                styles.mailItem,
                isActive ? styles.mailItemActive : '',
                isInbox && !row.is_read ? styles.mailItemUnread : '',
              ].filter(Boolean).join(' ');

              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={itemClass}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <div className={styles.mailTop}>
                      <span className={styles.mailFrom}>{counterpart}</span>
                      <span>{formatMailDate(timestamp)}</span>
                    </div>
                    <div className={styles.mailSubject}>
                      {isInbox && !row.is_read && <span className={styles.unreadDot} aria-hidden />}
                      {row.subject || '(без темы)'}
                    </div>
                    <div className={styles.mailPreview}>{previewText(row.body)}</div>
                    {!isInbox && (
                      <span className={mailStatusClass(row.status)}>{row.status}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className={styles.detail}>
          {!selectedId && (
            <div className={styles.empty}>
              <EnvelopeIcon className={styles.emptyIcon} />
              <strong>Выберите письмо</strong>
              <p>Список входящих и отправленных — слева</p>
            </div>
          )}
          {selectedId && detailLoading && (
            <div className={styles.empty}>
              <strong>Загрузка письма…</strong>
            </div>
          )}
          {selectedId && detail && !detailLoading && (
            <>
              <div className={styles.detailHead}>
                <h3>{detail.subject || '(без темы)'}</h3>
                <div className={styles.detailMeta}>
                  {detail.from_email && <span>От: {detail.from_name || detail.from_email}</span>}
                  {detail.to_email && <span>Кому: {detail.to_email}</span>}
                  <span>{formatMailDate(detail.timestamp)}</span>
                  {detail.status && (
                    <span className={mailStatusClass(detail.status)}>{detail.status}</span>
                  )}
                </div>
              </div>
              <div className={styles.detailBody}>{detail.body || '—'}</div>
              {detail.attachments?.length > 0 && (
                <div className={styles.attachSection}>
                  <p className={styles.attachTitle}>Вложения</p>
                  <ul className={styles.attachLinks}>
                    {detail.attachments.map((att) => (
                      <li key={att.id}>
                        <a
                          href={messagingService.getMailAttachmentUrl(att.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {att.original_filename} ({Math.round((att.size_bytes || 0) / 1024)} KB)
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <ComposeMailModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={handleSent}
        userEmail={user?.email}
      />
    </>
  );
}
