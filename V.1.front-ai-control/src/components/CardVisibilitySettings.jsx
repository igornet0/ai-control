import React, { useState } from 'react';

const CardVisibilitySettings = ({ 
  availableCards, 
  currentLayout, 
  onUpdateVisibility, 
  onClose,
  layoutType = "overview"
}) => {
  const [visibility, setVisibility] = useState(() => {
    const result = {};
    availableCards.forEach(card => {
      result[card.id] = currentLayout[card.id]?.visible !== false;
    });
    return result;
  });

  const handleVisibilityChange = (cardId, isVisible) => {
    setVisibility(prev => ({
      ...prev,
      [cardId]: isVisible
    }));
  };

  const handleSave = () => {
    onUpdateVisibility(visibility);
    onClose();
  };

  const handleReset = () => {
    const resetVisibility = {};
    availableCards.forEach(card => {
      resetVisibility[card.id] = true;
    });
    setVisibility(resetVisibility);
  };

  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-xl border border-slate-600/50 bg-slate-800/80 p-6 shadow-2xl backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-100">
            Настройка карточек
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-3 text-sm text-slate-300">
            Выберите карточки для отображения на странице {
              layoutType === "overview"
                ? "Обзор"
                : layoutType === "task-widgets"
                  ? "Задачи"
                  : "Статистика"
            }:
          </p>
          <p className="mb-4 text-xs text-slate-400">
            Показано: {visibleCount} из {availableCards.length} карточек
          </p>
        </div>

        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
          {availableCards.map(card => (
            <div
              key={card.id}
              className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 transition-colors hover:bg-slate-700/40"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-100">
                  {card.title}
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={visibility[card.id]}
                  onChange={(e) => handleVisibilityChange(card.id, e.target.checked)}
                />
                <div className="h-6 w-11 rounded-full bg-slate-600 transition-colors peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/60 peer-checked:bg-blue-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-200 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 rounded-lg bg-slate-700 px-4 py-2 text-white transition-colors hover:bg-slate-600"
          >
            Показать все
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={visibleCount === 0}
          >
            Сохранить
          </button>
        </div>

        {visibleCount === 0 && (
          <p className="mt-2 text-center text-xs text-rose-400">
            Необходимо выбрать хотя бы одну карточку
          </p>
        )}
      </div>
    </div>
  );
};

export default CardVisibilitySettings;
