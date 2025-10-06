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
          icon: '✅',
          glow: 'shadow-slate-500/25'
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-500/90 to-rose-600/90',
          border: 'border-red-400/50',
          text: 'text-white',
          icon: '❌',
          glow: 'shadow-red-500/25'
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-amber-500/90 to-orange-600/90',
          border: 'border-amber-400/50',
          text: 'text-white',
          icon: '⚠️',
          glow: 'shadow-amber-500/25'
        };
      case 'info':
      default:
        return {
          bg: 'bg-gradient-to-r from-blue-500/90 to-indigo-600/90',
          border: 'border-blue-400/50',
          text: 'text-white',
          icon: 'ℹ️',
          glow: 'shadow-blue-500/25'
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div className={`fixed top-6 right-6 z-50 max-w-sm transform transition-all duration-500 ease-out animate-slideInFromRight`}>
      <div className={`${styles.bg} ${styles.border} ${styles.text} ${styles.glow} 
                       backdrop-blur-xl border rounded-2xl shadow-2xl p-4 
                       hover:scale-105 transition-all duration-300`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <span className="text-lg">{styles.icon}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-relaxed break-words">{message}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 
                         flex items-center justify-center backdrop-blur-sm
                         transition-all duration-200 hover:scale-110"
            >
              <span className="text-sm font-bold">×</span>
            </button>
          )}
        </div>
        
        {/* Прогресс-бар автозакрытия */}
        {duration && onClose && (
          <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white/40 rounded-full transition-all ease-linear"
              style={{ 
                animation: `shrink ${duration}ms linear forwards`,
                width: '100%'
              }}
            ></div>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
