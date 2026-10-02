import React, { useEffect } from 'react';

export default function Notification({ message, type = 'info', onClose, duration = 5000 }) {
  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-slate-500/90 to-slate-600/90',
          border: 'border-slate-400/50',
          text: 'text-white',
          glow: 'shadow-slate-500/25',
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-500/90 to-rose-600/90',
          border: 'border-red-400/50',
          text: 'text-white',
          glow: 'shadow-red-500/25',
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-amber-500/90 to-orange-600/90',
          border: 'border-amber-400/50',
          text: 'text-white',
          glow: 'shadow-amber-500/25',
        };
      case 'info':
      default:
        return {
          bg: 'bg-gradient-to-r from-blue-500/90 to-indigo-600/90',
          border: 'border-blue-400/50',
          text: 'text-white',
          glow: 'shadow-blue-500/25',
        };
    }
  };

  const NotificationIcon = () => {
    const iconClass = 'w-5 h-5';
    switch (type) {
      case 'success':
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'error':
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const styles = getTypeStyles();

  return (
    <div className="fixed top-22 right-6 z-50 max-w-sm transform transition-all duration-500 ease-out animate-slideInRight">
      <div
        className={`${styles.bg} ${styles.border} ${styles.text} ${styles.glow}
                       backdrop-blur-xl border rounded-2xl shadow-2xl p-4
                       hover:scale-105 transition-all duration-300`}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm text-white">
              <NotificationIcon />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-relaxed break-words">{message}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30
                         flex items-center justify-center backdrop-blur-sm
                         transition-all duration-200 hover:scale-110"
            >
              <span className="text-sm font-bold">×</span>
            </button>
          )}
        </div>

        {duration && onClose && (
          <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/40 rounded-full"
              style={{
                width: '100%',
                animation: `notification-shrink ${duration}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
