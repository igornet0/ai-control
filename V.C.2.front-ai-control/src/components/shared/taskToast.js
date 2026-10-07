const TOAST_STYLE_ID = 'aicontrol-task-toast-styles';

const TOAST_ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  report: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  question: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`,
};

const TOAST_THEMES = {
  success: {
    accent: '#16a34a',
    glow: 'rgba(22, 163, 74, 0.28)',
  },
  error: {
    accent: '#dc2626',
    glow: 'rgba(220, 38, 38, 0.28)',
  },
  report: {
    accent: '#ea580c',
    glow: 'rgba(234, 88, 12, 0.28)',
  },
  question: {
    accent: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.28)',
  },
};

function ensureToastStyles() {
  if (document.getElementById(TOAST_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    .aic-task-toast {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 10050;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      min-width: 280px;
      max-width: min(380px, calc(100vw - 2rem));
      padding: 0.875rem 1rem;
      border-radius: 14px;
      color: #f8fafc;
      background: linear-gradient(145deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.98));
      border: 1px solid rgba(148, 163, 184, 0.28);
      box-shadow:
        0 12px 28px rgba(2, 6, 23, 0.45),
        0 0 0 1px rgba(255, 255, 255, 0.04) inset,
        0 0 24px var(--aic-toast-glow);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transform: translateX(120%);
      opacity: 0;
      transition: transform 0.28s ease, opacity 0.28s ease;
      pointer-events: auto;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .aic-task-toast.is-visible {
      transform: translateX(0);
      opacity: 1;
    }
    .aic-task-toast__icon {
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: var(--aic-toast-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--aic-toast-accent) 28%, transparent);
    }
    .aic-task-toast__icon svg {
      width: 1.05rem;
      height: 1.05rem;
      display: block;
    }
    .aic-task-toast__body {
      flex: 1;
      min-width: 0;
      padding-top: 0.1rem;
    }
    .aic-task-toast__title {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
      line-height: 1.35;
      letter-spacing: 0.01em;
    }
    .aic-task-toast__message {
      margin: 0.2rem 0 0;
      font-size: 0.8rem;
      line-height: 1.4;
      color: rgba(226, 232, 240, 0.85);
      word-break: break-word;
    }
    .aic-task-toast__close {
      flex-shrink: 0;
      width: 1.5rem;
      height: 1.5rem;
      margin: -0.15rem -0.25rem 0 0;
      border: none;
      border-radius: 999px;
      background: rgba(148, 163, 184, 0.18);
      color: rgba(248, 250, 252, 0.9);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, transform 0.15s ease;
    }
    .aic-task-toast__close:hover {
      background: rgba(148, 163, 184, 0.32);
      transform: scale(1.06);
    }
    .aic-task-toast__close svg {
      width: 0.85rem;
      height: 0.85rem;
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showTaskToast({ type, title, message, duration = 3000 }) {
  ensureToastStyles();

  const themeKey = TOAST_THEMES[type] ? type : 'question';
  const theme = TOAST_THEMES[themeKey];
  const icon = TOAST_ICONS[themeKey] || TOAST_ICONS.question;

  const notification = document.createElement('div');
  notification.className = 'aic-task-toast';
  notification.style.setProperty('--aic-toast-accent', theme.accent);
  notification.style.setProperty('--aic-toast-glow', theme.glow);
  notification.setAttribute('role', 'status');
  notification.innerHTML = `
    <div class="aic-task-toast__icon">${icon}</div>
    <div class="aic-task-toast__body">
      <p class="aic-task-toast__title">${escapeHtml(title)}</p>
      ${message ? `<p class="aic-task-toast__message">${escapeHtml(message)}</p>` : ''}
    </div>
    <button type="button" class="aic-task-toast__close" aria-label="Закрыть">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  const removeToast = () => {
    notification.classList.remove('is-visible');
    window.setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 280);
  };

  notification.querySelector('.aic-task-toast__close')?.addEventListener('click', removeToast);
  document.body.appendChild(notification);
  requestAnimationFrame(() => notification.classList.add('is-visible'));
  window.setTimeout(removeToast, Math.max(1200, Number(duration) || 3000));
}
