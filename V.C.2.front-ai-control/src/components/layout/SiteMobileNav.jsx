import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import styles from './SiteMobileNav.module.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Панель управления' },
  { to: '/tasks', label: 'Задачи' },
  { to: '/documents', label: 'Документы' },
  { to: '/pricing', label: 'Тарифы' },
  { to: '/support', label: 'Поддержка' },
];

export default function SiteMobileNav({ isAuthenticated, onSignIn }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const overlay =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className={styles.overlay} onClick={() => setOpen(false)} role="presentation">
            <nav
              id="site-mobile-nav"
              className={styles.panel}
              aria-label="Навигация"
              onClick={(event) => event.stopPropagation()}
            >
              {NAV_ITEMS.map((item) =>
                item.external ? (
                  <a
                    key={item.to}
                    href={item.to}
                    className={styles.link}
                    {...(item.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.to} to={item.to} className={styles.link} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                ),
              )}
              {isAuthenticated ? (
                <Link to="/profile" className={styles.link} onClick={() => setOpen(false)}>
                  Профиль
                </Link>
              ) : onSignIn ? (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setOpen(false);
                    onSignIn();
                  }}
                >
                  Войти
                </button>
              ) : (
                <Link to="/signin" className={styles.link} onClick={() => setOpen(false)}>
                  Войти
                </Link>
              )}
            </nav>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.burger}
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={open ? styles.barOpen : undefined} />
        <span className={open ? styles.barOpen : undefined} />
        <span className={open ? styles.barOpen : undefined} />
      </button>
      {overlay}
    </div>
  );
}
