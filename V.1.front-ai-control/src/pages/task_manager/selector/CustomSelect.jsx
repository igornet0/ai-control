import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// Функция для получения иконки приоритета
const getPriorityIcon = (priority) => {
  const icons = {
    urgent: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    critical: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    high: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    ),
    medium: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
    low: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    ),
  };
  return icons[priority] || null;
};

// Функция для получения цвета приоритета
const getPriorityColor = (priority) => {
  const colors = {
    urgent: 'text-red-400',
    critical: 'text-orange-400',
    high: 'text-yellow-400',
    medium: 'text-blue-400',
    low: 'text-slate-400',
  };
  return colors[priority] || 'text-slate-400';
};

// Функция для получения иконки статуса
const getStatusIcon = (status) => {
  const icons = {
    created: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    ),
    in_progress: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
      </svg>
    ),
    review: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
      </svg>
    ),
    completed: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    ),
    cancelled: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    ),
    on_hold: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    blocked: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
      </svg>
    ),
    planning: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
      </svg>
    ),
    active: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
      </svg>
    ),
    archived: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
        <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
  };
  return icons[status] || null;
};

// Функция для получения цвета статуса
const getStatusColor = (status) => {
  const colors = {
    created: 'text-slate-400',
    in_progress: 'text-blue-400',
    review: 'text-yellow-400',
    completed: 'text-green-400',
    cancelled: 'text-red-400',
    on_hold: 'text-orange-400',
    blocked: 'text-purple-400',
    planning: 'text-slate-400',
    active: 'text-blue-400',
    archived: 'text-slate-500',
  };
  return colors[status] || 'text-slate-400';
};

// Функция для получения иконки типа задачи
const getTaskTypeIcon = (taskType) => {
  const icons = {
    task: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    ),
    bug: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    feature: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
    story: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
      </svg>
    ),
    epic: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
      </svg>
    ),
    subtask: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    ),
  };
  return icons[taskType] || null;
};

// Функция для получения цвета типа задачи
const getTaskTypeColor = (taskType) => {
  const colors = {
    task: 'text-blue-400',
    bug: 'text-red-400',
    feature: 'text-purple-400',
    story: 'text-yellow-400',
    epic: 'text-indigo-400',
    subtask: 'text-slate-400',
  };
  return colors[taskType] || 'text-slate-400';
};

function CustomSelect({
  options,
  value,
  onChange,
  showPriorityIcons = false,
  disabled = false,
  menuZIndex = 10000,
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const [openUpward, setOpenUpward] = useState(false);
  const ref = useRef();
  const buttonRef = useRef();
  const menuRef = useRef();

  // Расчет позиции меню при открытии
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const estimatedMenuHeight = Math.min(options.length * 40 + 16, 240);
      
      // Определяем направление открытия
      const shouldOpenUp = spaceBelow < estimatedMenuHeight + 10;
      setOpenUpward(shouldOpenUp);

      // Вычисляем позицию меню
      const top = shouldOpenUp 
        ? rect.top - estimatedMenuHeight - 4  // Открываем вверх
        : rect.bottom + 4;  // Открываем вниз
      
      const left = rect.left;
      const width = rect.width;

      // Проверяем, не выходит ли меню за пределы viewport
      const adjustedLeft = Math.max(8, Math.min(left, viewportWidth - width - 8));
      const adjustedTop = shouldOpenUp 
        ? Math.max(8, top)  // Не выходим за верхний край
        : Math.min(top, viewportHeight - estimatedMenuHeight - 8);  // Не выходим за нижний край

      setMenuPosition({
        top: adjustedTop,
        left: adjustedLeft,
        width: width
      });
    }
  }, [open, options.length]);

  // Закрытие по клику вне компонента и при прокрутке
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        ref.current && 
        !ref.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleScroll = (e) => {
      // Закрываем меню только если скролл происходит вне списка
      const target = e.target;
      // Проверяем, является ли цель скролла частью меню
      if (menuRef.current && target) {
        // Если скролл происходит внутри меню, не закрываем
        if (menuRef.current.contains(target) || target === menuRef.current) {
          return;
        }
        // Если скролл происходит на window или document, закрываем
        if (target === window || target === document || target === document.body || target === document.documentElement) {
          setOpen(false);
        }
      } else {
        // Если цель не определена, закрываем для безопасности
        setOpen(false);
      }
    };

    if (open) {
      // Небольшая задержка, чтобы не закрывалось сразу при открытии
      setTimeout(() => {
        window.addEventListener("click", handleClickOutside);
        // Используем capture phase для перехвата скролла на уровне window
        window.addEventListener("scroll", handleScroll, true);
        // Также слушаем скролл на document
        document.addEventListener("scroll", handleScroll, true);
      }, 0);
    }
    
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  // Обновление позиции при изменении размера окна
  useEffect(() => {
    if (open) {
      const handleResize = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - rect.bottom;
          const estimatedMenuHeight = Math.min(options.length * 40 + 16, 240);
          const shouldOpenUp = spaceBelow < estimatedMenuHeight + 10;
          
          const top = shouldOpenUp 
            ? rect.top - estimatedMenuHeight - 4
            : rect.bottom + 4;
          
          setMenuPosition(prev => ({
            ...prev,
            top: Math.max(8, Math.min(top, viewportHeight - estimatedMenuHeight - 8))
          }));
          setOpenUpward(shouldOpenUp);
        }
      };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [open, options.length]);

  const handleSelect = (val) => {
    const selectedValue = typeof val === 'object' ? val.value : val;
    onChange(selectedValue);
    setOpen(false);
  };

  const handleToggle = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  // Получаем текущую опцию для отображения
  const getSelectedOption = () => {
    if (typeof options[0] === 'object') {
      return options.find(opt => opt.value === value);
    }
    return { value, label: value };
  };

  const selectedOption = getSelectedOption();
  const selectedValue = selectedOption?.value || value;
  const selectedLabel = selectedOption?.label || value;
  
  // Определяем тип значения для показа соответствующей иконки
  const statuses = [
    'created', 'in_progress', 'review', 'completed', 'cancelled', 'on_hold', 'blocked',
    'planning', 'active', 'archived',
  ];
  const priorities = ['urgent', 'critical', 'high', 'medium', 'low'];
  const taskTypes = ['task', 'bug', 'feature', 'story', 'epic', 'subtask'];
  
  const isPriority = showPriorityIcons || (selectedValue && priorities.includes(selectedValue));
  const isStatus = selectedValue && statuses.includes(selectedValue);
  const isTaskType = selectedValue && taskTypes.includes(selectedValue);
  
  // Получаем иконку в зависимости от типа
  const getIcon = () => {
    if (isPriority) return getPriorityIcon(selectedValue);
    if (isStatus) return getStatusIcon(selectedValue);
    if (isTaskType) return getTaskTypeIcon(selectedValue);
    return null;
  };
  
  // Получаем цвет в зависимости от типа
  const getIconColor = () => {
    if (isPriority) return getPriorityColor(selectedValue);
    if (isStatus) return getStatusColor(selectedValue);
    if (isTaskType) return getTaskTypeColor(selectedValue);
    return 'text-slate-400';
  };

  const handleMenuScroll = (e) => {
    // Предотвращаем всплытие события скролла, чтобы меню не закрывалось
    e.stopPropagation();
  };

  const menuContent = open && (
    <ul 
      ref={menuRef}
      onScroll={handleMenuScroll}
      style={{ 
        gap: 0,
        position: 'fixed',
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
        zIndex: menuZIndex,
        maxHeight: '240px',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }} 
      className="rounded-lg bg-slate-800 border border-slate-600 text-white shadow-2xl flex flex-col backdrop-blur-sm"
    >
      {options.map((opt) => {
        const optionValue = typeof opt === 'object' ? opt.value : opt;
        const optionLabel = typeof opt === 'object' ? opt.label : opt;
        
        // Определяем тип опции
        const hasPriority = priorities.includes(optionValue);
        const hasStatus = statuses.includes(optionValue);
        const hasTaskType = taskTypes.includes(optionValue);
        
        // Получаем иконку и цвет
        let optionIcon = null;
        let optionColor = '';
        
        if (hasPriority) {
          optionIcon = getPriorityIcon(optionValue);
          optionColor = getPriorityColor(optionValue);
        } else if (hasStatus) {
          optionIcon = getStatusIcon(optionValue);
          optionColor = getStatusColor(optionValue);
        } else if (hasTaskType) {
          optionIcon = getTaskTypeIcon(optionValue);
          optionColor = getTaskTypeColor(optionValue);
        }
        
        return (
          <li
            key={optionValue}
            onClick={() => handleSelect(opt)}
            className={`cursor-pointer px-4 py-2.5 hover:bg-slate-700 transition-colors duration-150 flex items-center gap-2 ${
              optionValue === value ? "bg-blue-600 hover:bg-blue-700 font-semibold" : ""
            }`}
          >
            {optionIcon && (
              <span className={optionColor}>
                {optionIcon}
              </span>
            )}
            <span>{optionLabel}</span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div className="relative w-full" ref={ref}>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-left text-white flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 hover:border-slate-500 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <span className="flex items-center gap-2">
            {getIcon() && (
              <span className={getIconColor()}>
                {getIcon()}
              </span>
            )}
            <span>{selectedLabel}</span>
          </span>
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
              open ? (openUpward ? "rotate-0" : "rotate-180") : "rotate-0"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
      </div>
      {open && typeof document !== 'undefined' && createPortal(menuContent, document.body)}
    </>
  );
}

export default CustomSelect;