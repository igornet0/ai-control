import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { publicDashboardLinkApi } from '../../services/publicDashboardLinkApi';
import DashboardCreaterApp from '../dashboard_creater/DashboardCreaterApp';

/** /share/:token — pick first sheet and redirect */
export function ShareDashboardEntryPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sheets = await publicDashboardLinkApi.listSheets(token);
        const arr = Array.isArray(sheets) ? sheets : [];
        if (cancelled) return;
        if (arr.length === 0) {
          setErr('У дашборда нет листов');
          return;
        }
        navigate(`/share/${encodeURIComponent(token)}/sheet/${arr[0].id}`, { replace: true });
      } catch (e) {
        if (!cancelled) {
          const d = e?.response?.data?.detail;
          setErr(typeof d === 'string' ? d : e?.message || 'Ошибка загрузки');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  if (err) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: '48px auto' }}>
        <p>Ссылка недействительна или устарела.</p>
        <p style={{ color: 'var(--color-text-secondary, #666)' }}>{err}</p>
      </div>
    );
  }
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      Открытие дашборда…
    </div>
  );
}

/** /share/:token/sheet/:sheetId */
export default function ShareDashboardSheetPage() {
  const { token } = useParams();
  const [shareContext, setShareContext] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await publicDashboardLinkApi.bootstrap(token);
        if (cancelled) return;
        setShareContext({
          token,
          permission: b.permission,
          sessionType: b.session_type,
          dashboardId: b.dashboard.id,
        });
      } catch (e) {
        if (!cancelled) {
          const d = e?.response?.data?.detail;
          setErr(typeof d === 'string' ? d : e?.message || 'Ошибка');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (err) {
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: '48px auto' }}>
        <p>Не удалось открыть дашборд по ссылке.</p>
        <p style={{ color: 'var(--color-text-secondary, #666)' }}>{err}</p>
      </div>
    );
  }
  if (!shareContext) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Загрузка…</div>;
  }

  return <DashboardCreaterApp user={null} onLogout={() => {}} shareContext={shareContext} />;
}
