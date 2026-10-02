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

  // Правильная валидация времени - форматируем только законченный ввод
  const formatTimeInput = (inputValue) => {
    // Убираем все кроме цифр и двоеточия
    let cleaned = inputValue.replace(/[^\d:]/g, '');
    
    // Если уже есть двоеточие, работаем с готовым форматом
    if (cleaned.includes(':')) {
      const parts = cleaned.split(':');
      if (parts.length === 2) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const validHours = Math.min(hours, 23);
        const validMinutes = Math.min(minutes, 59);
        return `${validHours.toString().padStart(2, '0')}:${validMinutes.toString().padStart(2, '0')}`;
      }
    }
    
    // Убираем двоеточие для обработки
    const numbers = cleaned.replace(/:/g, '');
    
    if (numbers.length === 0) return '';
    
    // Ограничиваем строго до 4 цифр
    const limitedNumbers = numbers.slice(0, 4);
    
    if (limitedNumbers.length <= 2) {
      // 1-2 цифры: только часы, возвращаем как есть
      const hours = parseInt(limitedNumbers) || 0;
      if (hours > 23) return '23';
      return limitedNumbers;
    } else if (limitedNumbers.length === 3) {
      // 3 цифры: возвращаем как есть, НЕ форматируем
      // Пользователь может хотеть ввести 4-ю цифру
      return limitedNumbers;
    } else {
      // 4 цифры: форматируем как HH:MM
      const hours = parseInt(limitedNumbers.slice(0, 2));
      const minutes = parseInt(limitedNumbers.slice(2, 4));
      
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
          className="flex-1 form-input text-sm rounded-l rounded-r-none min-w-0 ow-schedule-time-input"
          maxLength={5}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="ow-schedule-time-trigger bg-slate-800/60 backdrop-blur-sm border border-l-0 border-slate-600/50 rounded-r px-2 py-2 text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors focus:outline-none shrink-0"
          title="Выбрать время"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-slate-800/90 backdrop-blur-xl border border-slate-600/50 rounded-lg shadow-2xl z-50 w-80 min-w-max">
          <div className="p-4">
            <div className="text-xs text-slate-400 mb-4 text-center font-medium">Выберите время</div>
            
            {/* Быстрый выбор */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => handleTimeSelect(time)}
                  className={`px-3 py-2 text-sm rounded-md transition-all duration-200 whitespace-nowrap ${
                    value === time 
                      ? 'bg-slate-600 text-slate-100 shadow-md' 
                      : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 hover:text-slate-100 border border-slate-600/50'
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>

            {/* Ручной ввод времени */}
            <div className="border-t border-slate-700/50 pt-4">
              <div className="text-xs text-slate-400 mb-3">Или введите вручную:</div>
              <div className="flex gap-3 items-center justify-center">
                <div className="flex flex-col items-center gap-1">
                  <label className="text-xs text-slate-500">Часы</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    placeholder="ЧЧ"
                    value={value?.split(':')[0] || ''}
                    maxLength="2"
                    className="w-20 bg-slate-800/60 backdrop-blur-sm border border-slate-600/50 rounded px-3 py-2 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                    onInput={(e) => {
                      // Ограничиваем до 2 символов
                      if (e.target.value.length > 2) {
                        e.target.value = e.target.value.slice(0, 2);
                      }
                    }}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      // Проверяем что введено только 1-2 цифры и значение корректное
                      if (inputValue === '' || (inputValue.length <= 2 && parseInt(inputValue) >= 0 && parseInt(inputValue) <= 23)) {
                        const hours = inputValue ? inputValue.padStart(2, '0') : '00';
                        const currentMinutes = value?.split(':')[1] || '00';
                        handleManualTimeChange(`${hours}:${currentMinutes}`);
                      }
                    }}
                  />
                </div>
                <div className="text-slate-400 text-lg mt-6">:</div>
                <div className="flex flex-col items-center gap-1">
                  <label className="text-xs text-slate-500">Минуты</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="ММ"
                    value={value?.split(':')[1] || ''}
                    maxLength="2"
                    className="w-20 bg-slate-800/60 backdrop-blur-sm border border-slate-600/50 rounded px-3 py-2 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                    onInput={(e) => {
                      // Ограничиваем до 2 символов
                      if (e.target.value.length > 2) {
                        e.target.value = e.target.value.slice(0, 2);
                      }
                    }}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      // Проверяем что введено только 1-2 цифры и значение корректное
                      if (inputValue === '' || (inputValue.length <= 2 && parseInt(inputValue) >= 0 && parseInt(inputValue) <= 59)) {
                        const minutes = inputValue ? inputValue.padStart(2, '0') : '00';
                        const currentHours = value?.split(':')[0] || '00';
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
