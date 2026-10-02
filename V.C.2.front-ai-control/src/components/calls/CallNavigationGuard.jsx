import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCallSession } from '../../context/CallSessionContext';
import CallLeaveConfirmModal from './CallLeaveConfirmModal';

const PATH_LABELS = {
  '/': 'Главная',
  '/dashboard': 'Панель управления',
  '/tasks': 'Задачи',
  '/documents': 'Документы',
  '/support': 'Поддержка',
  '/profile': 'Профиль',
  '/signin': 'Вход',
  '/signup': 'Регистрация',
  '/data-models': 'Модели данных',
  '/datacode-editor': 'DataCode редактор',
  '/datacode-docs': 'Документация DataCode',
  '/developer-api-docs': 'API документация',
};

function normalizePathname(pathname) {
  if (!pathname) return '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function locationKey(location) {
  return `${normalizePathname(location.pathname)}${location.search || ''}${location.hash || ''}`;
}

function isCallPopoutPath(pathname) {
  const normalized = normalizePathname(pathname);
  return normalized === '/call' || normalized.startsWith('/call/');
}

function labelForPath(pathname) {
  const normalized = normalizePathname(pathname);
  if (PATH_LABELS[normalized]) return PATH_LABELS[normalized];
  if (normalized.startsWith('/dashboard/')) return 'Дашборд';
  if (normalized.startsWith('/documents/')) return 'Документы';
  if (normalized.startsWith('/data-models/')) return 'Модели данных';
  if (normalized.startsWith('/flows/')) return 'Потоки';
  if (normalized.startsWith('/invite/')) return 'Приглашение';
  if (normalized.startsWith('/share/')) return 'Общий доступ';
  return normalized;
}

function shouldBlockNavigation(currentKey, nextKey, nextPathname) {
  if (currentKey === nextKey) return false;
  if (isCallPopoutPath(nextPathname)) return false;
  return true;
}

function parseInternalHref(href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  try {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      key: `${normalizePathname(url.pathname)}${url.search}${url.hash}`,
    };
  } catch {
    return null;
  }
}

export default function CallNavigationGuard() {
  const { active, leave } = useCallSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);

  const currentKey = useMemo(() => locationKey(location), [location]);
  const guardEnabled = active && !isCallPopoutPath(location.pathname);

  const openPending = useCallback((next) => {
    setPending(next);
  }, []);

  useEffect(() => {
    if (!guardEnabled) return undefined;

    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const parsed = parseInternalHref(anchor.getAttribute('href'));
      if (!parsed) return;
      if (!shouldBlockNavigation(currentKey, parsed.key, parsed.pathname)) return;

      event.preventDefault();
      event.stopPropagation();
      openPending({
        to: parsed.key,
        label: labelForPath(parsed.pathname),
        source: 'anchor',
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [guardEnabled, currentKey, openPending]);

  useEffect(() => {
    if (!guardEnabled) return undefined;

    const pushSentinel = () => {
      window.history.pushState({ __callNavGuard: true }, '', window.location.href);
    };
    pushSentinel();

    const onPopState = () => {
      pushSentinel();
      openPending({
        to: null,
        label: 'предыдущую страницу',
        source: 'history-back',
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [guardEnabled, currentKey, openPending]);

  const handleCancel = useCallback(() => {
    setPending(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const target = pending?.to;
    const source = pending?.source;
    setPending(null);
    leave();

    if (source === 'history-back') {
      window.history.go(-2);
      return;
    }

    if (target) {
      navigate(target);
    }
  }, [pending, leave, navigate]);

  return (
    <CallLeaveConfirmModal
      open={Boolean(pending)}
      destinationLabel={pending?.label || ''}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );
}
