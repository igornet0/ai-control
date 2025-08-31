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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#0F1717] rounded-xl border border-gray-700 p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-100">
            Настройка карточек
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-3">
            Выберите карточки для отображения на странице {layoutType === "overview" ? "Обзор" : "Статистика"}:
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Показано: {visibleCount} из {availableCards.length} карточек
          </p>
        </div>

        <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
          {availableCards.map(card => (
            <div key={card.id} className="flex items-center justify-between p-3 bg-[#16251C] rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-100">
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
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Показать все
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            disabled={visibleCount === 0}
          >
            Сохранить
          </button>
        </div>

        {visibleCount === 0 && (
          <p className="text-xs text-red-400 mt-2 text-center">
            Необходимо выбрать хотя бы одну карточку
          </p>
        )}
      </div>
    </div>
  );
};

export default CardVisibilitySettings;
