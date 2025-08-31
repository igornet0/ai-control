import React, { useState, useRef, useEffect } from 'react';

const TimePicker = ({ value, onChange, disabled, placeholder = "09:30" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Закрываем dropdown при клике вне области
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Простая и надежная валидация времени
  const formatTimeInput = (inputValue) => {
    // Убираем все кроме цифр и двоеточия
    let cleaned = inputValue.replace(/[^\d:]/g, '');
    
    // Убираем двоеточие для обработки
    const numbers = cleaned.replace(/:/g, '');
    
    if (numbers.length === 0) return '';
    
    // Ограничиваем до 4 цифр
    const limitedNumbers = numbers.slice(0, 4);
    
    if (limitedNumbers.length <= 2) {
      // Только часы
      const hours = parseInt(limitedNumbers) || 0;
      if (hours > 23) return '23';
      return limitedNumbers;
    } else {
      // Часы и минуты
      const hours = parseInt(limitedNumbers.slice(0, 2)) || 0;
      const minutes = parseInt(limitedNumbers.slice(2)) || 0;
      
      const validHours = Math.min(hours, 23);
      const validMinutes = Math.min(minutes, 59);
      
      return `${validHours.toString().padStart(2, '0')}:${validMinutes.toString().padStart(2, '0')}`;
    }
  };

  const handleInputChange = (e) => {
    const formatted = formatTimeInput(e.target.value);
    onChange(formatted);
  };

  const handleTimeSelect = (timeString) => {
    onChange(timeString);
    setIsOpen(false);
  };

  // Функция для ручного ввода без закрытия dropdown
  const handleManualTimeChange = (timeString) => {
    onChange(timeString);
    // НЕ закрываем dropdown при ручном вводе
  };

  // Генерируем популярные времена
  const quickTimes = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex w-full">
        <input
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 bg-[#16251C] border border-gray-700 rounded-l px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[100px]"
          maxLength={5}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="bg-[#16251C] border border-l-0 border-gray-700 rounded-r px-3 py-2 text-gray-400 hover:text-white hover:bg-[#1e2a1e] transition-colors focus:outline-none"
          title="Выбрать время"
        >
          🕐
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-[#1a251a] border border-gray-600 rounded-lg shadow-2xl z-50 w-80 min-w-max">
          <div className="p-4">
            <div className="text-xs text-gray-400 mb-4 text-center font-medium">Выберите время</div>
            
            {/* Быстрый выбор */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => handleTimeSelect(time)}
                  className={`px-3 py-2 text-sm rounded-md transition-all duration-200 whitespace-nowrap ${
                    value === time 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-[#16251C] text-gray-300 hover:bg-[#1e2a1e] hover:text-white border border-gray-700'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>

            {/* Ручной ввод времени */}
            <div className="border-t border-gray-700 pt-4">
              <div className="text-xs text-gray-400 mb-3">Или введите вручную:</div>
              <div className="flex gap-3 items-center justify-center">
                <div className="flex flex-col items-center gap-1">
                  <label className="text-xs text-gray-500">Часы</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    placeholder="ЧЧ"
                    value={value?.split(':')[0] || ''}
                    className="w-20 bg-[#16251C] border border-gray-700 rounded px-3 py-2 text-sm text-white text-center"
                    onChange={(e) => {
                      const hours = e.target.value.padStart(2, '0');
                      const currentMinutes = value?.split(':')[1] || '00';
                      if (e.target.value && parseInt(e.target.value) <= 23) {
                        handleManualTimeChange(`${hours}:${currentMinutes}`);
                      }
                    }}
                  />
                </div>
                <div className="text-gray-400 text-lg mt-6">:</div>
                <div className="flex flex-col items-center gap-1">
                  <label className="text-xs text-gray-500">Минуты</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="ММ"
                    value={value?.split(':')[1] || ''}
                    className="w-20 bg-[#16251C] border border-gray-700 rounded px-3 py-2 text-sm text-white text-center"
                    onChange={(e) => {
                      const minutes = e.target.value.padStart(2, '0');
                      const currentHours = value?.split(':')[0] || '00';
                      if (e.target.value && parseInt(e.target.value) <= 59) {
                        handleManualTimeChange(`${currentHours}:${minutes}`);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimePicker;
