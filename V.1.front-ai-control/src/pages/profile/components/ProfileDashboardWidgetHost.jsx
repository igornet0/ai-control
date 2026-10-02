import React, { useEffect, useMemo, useState } from 'react';
import { useCallSessionOptional } from '../../../context/CallSessionContext';
import { useMessagingAlerts } from '../../../context/MessagingAlertsContext';
import styles from './ProfileDashboardWidgetHost.module.css';

const LEAKED_CSS_ID = 'profile-dashboard-widget-css';

export function removeLeakedDashboardWidgetCss() {
  if (typeof document === 'undefined') return;
  const link = document.getElementById(LEAKED_CSS_ID);
  if (link?.parentNode) {
    link.parentNode.removeChild(link);
  }
}

/**
 * Profile card host: dashboard widget in an isolated iframe.
 * During profile drag/resize, pointer-events are disabled so gestures are not stolen.
 * During an active/incoming call the iframe is unmounted so embeds cannot steal mic/cam/focus.
 */
export default function ProfileDashboardWidgetHost({
  dashboardId,
  sheetId,
  widgetId,
  flowId,
  title,
}) {
  const call = useCallSessionOptional();
  const { incomingCall } = useMessagingAlerts();
  const callActive = Boolean(call?.active) || Boolean(incomingCall?.partyRoomId);
  const [frameFailed, setFrameFailed] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  const src = useMemo(() => {
    const params = new URLSearchParams();
    if (dashboardId != null && dashboardId !== '') params.set('dashboardId', String(dashboardId));
    if (sheetId != null && sheetId !== '') params.set('sheetId', String(sheetId));
    if (widgetId != null && widgetId !== '') params.set('widgetId', String(widgetId));
    if (flowId != null && Number(flowId) > 0) params.set('flow', String(flowId));
    return `/embed/dashboard-widget?${params.toString()}`;
  }, [dashboardId, sheetId, widgetId, flowId]);

  useEffect(() => {
    removeLeakedDashboardWidgetCss();
  }, []);

  useEffect(() => {
    setFrameFailed(false);
    setFrameReady(false);
  }, [src]);

  // Drop ready state when suspending so iframe reloads cleanly after the call.
  useEffect(() => {
    if (callActive) {
      setFrameReady(false);
    }
  }, [callActive]);

  const hasIds = Number(widgetId) > 0
    && Number(dashboardId) > 0
    && Number(sheetId) > 0;

  if (!hasIds) {
    return (
      <div className={styles.host}>
        <div className={styles.state}>{title || 'Виджет недоступен'}</div>
      </div>
    );
  }

  if (frameFailed) {
    return (
      <div className={styles.host}>
        <div className={styles.state}>Не удалось загрузить виджет</div>
      </div>
    );
  }

  if (callActive) {
    return (
      <div className={`${styles.host} ${styles.hostPaused}`}>
        <div className={styles.state}>Виджет приостановлен на время звонка</div>
      </div>
    );
  }

  return (
    <div className={styles.host}>
      {!frameReady && (
        <div className={styles.state}>Загрузка виджета…</div>
      )}
      <iframe
        title={title || `Виджет #${widgetId}`}
        src={src}
        className={`${styles.frame} ${frameReady ? styles.frameReady : styles.frameLoading}`}
        referrerPolicy="same-origin"
        allow="autoplay; fullscreen; encrypted-media"
        onLoad={() => setFrameReady(true)}
        onError={() => setFrameFailed(true)}
      />
    </div>
  );
}
