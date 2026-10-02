import { useCallback, useEffect, useState } from 'react';
import { MOBILE_NAV_QUERY, useMediaQuery } from './useMediaQuery.js';

export function useCollapsibleSidebar(storageKey) {
  const isMobile = useMediaQuery(MOBILE_NAV_QUERY);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [isMobile, mobileOpen]);

  const collapsed = isMobile ? !mobileOpen : desktopCollapsed;

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((open) => !open);
      return;
    }
    setDesktopCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [isMobile, storageKey]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);

  return { collapsed, toggle, isMobile, mobileOpen, closeMobile, openMobile };
}
