import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../task_manager/components/ProjectSearchPicker.css';

export default function DepartmentSearchPicker({
  departments = [],
  loading = false,
  value = null,
  onChange,
  disabled = false,
  variant = 'default',
  buttonPlaceholder = 'Выбрать отдел',
  emptyMessage = 'Нет доступных отделов',
  searchPlaceholder = 'Поиск по названию отдела…',
  title,
  allowClear = true,
  clearLabel = 'Общий (без отдела)',
}) {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState(null);

  const selectedDepartment = useMemo(
    () => departments.find((dept) => dept.id === value) || null,
    [departments, value]
  );

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...departments].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ru')
    );
    if (!query) return sorted;
    return sorted.filter((dept) => {
      const name = (dept.name || '').toLowerCase();
      return name.includes(query) || String(dept.id).includes(query);
    });
  }, [departments, search]);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const handleClickOutside = (event) => {
      const root = pickerRef.current;
      const panel = document.getElementById('department-search-picker-dropdown');
      if (root && root.contains(event.target)) return;
      if (panel && panel.contains(event.target)) return;
      setDropdownOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  useLayoutEffect(() => {
    if (variant !== 'button' || !dropdownOpen || !triggerRef.current) {
      setDropdownPos(null);
      return;
    }
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 288);
      let left = rect.left;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }
      setDropdownPos({
        top: rect.bottom + 4,
        left,
        width,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [dropdownOpen, variant]);

  useEffect(() => {
    setIsEditing(false);
    setSearch('');
    setDropdownOpen(false);
  }, [value]);

  const handleSelect = (departmentId) => {
    onChange?.(departmentId);
    setSearch('');
    setDropdownOpen(false);
    setIsEditing(false);
  };

  const handleClear = () => {
    onChange?.(null);
    setSearch('');
    setDropdownOpen(false);
    setIsEditing(false);
  };

  const showSelected = selectedDepartment && !isEditing && variant !== 'button';

  const renderDropdown = (floating = false) => (
    <div
      id={floating ? 'department-search-picker-dropdown' : undefined}
      className={`project-search-picker__dropdown project-search-picker__dropdown--panel${floating ? ' project-search-picker__dropdown--floating' : ''}`}
      style={floating && dropdownPos ? {
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        right: 'auto',
      } : undefined}
      role="listbox"
    >
      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setDropdownOpen(true);
        }}
        className="project-search-picker__dropdown-search"
        placeholder={searchPlaceholder}
        autoComplete="off"
        disabled={disabled}
        autoFocus
      />
      <div className="project-search-picker__dropdown-list">
        {allowClear && (
          <button
            type="button"
            className={`project-search-picker__option project-search-picker__option--muted${value == null ? ' project-search-picker__option--active' : ''}`}
            onClick={() => handleSelect(null)}
          >
            {clearLabel}
          </button>
        )}
        {filteredDepartments.length === 0 ? (
          <p className="project-search-picker__empty">Ничего не найдено</p>
        ) : (
          filteredDepartments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              className={`project-search-picker__option${dept.id === value ? ' project-search-picker__option--active' : ''}`}
              onClick={() => handleSelect(dept.id)}
            >
              <span className="project-search-picker__option-name">
                {dept.name || `Отдел #${dept.id}`}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  if (loading) {
    if (variant === 'button') {
      return (
        <button type="button" className="project-search-picker__trigger" disabled>
          Загрузка отделов…
        </button>
      );
    }
    return <p className="text-sm text-slate-400 mt-2">Загрузка отделов…</p>;
  }

  if (!departments.length) {
    if (variant === 'button') {
      return (
        <button type="button" className="project-search-picker__trigger" disabled>
          {emptyMessage}
        </button>
      );
    }
    return <p className="text-sm text-slate-400 mt-2">{emptyMessage}</p>;
  }

  if (variant === 'button') {
    const triggerLabel = selectedDepartment
      ? (selectedDepartment.name || `Отдел #${selectedDepartment.id}`)
      : buttonPlaceholder;

    return (
      <div className="project-search-picker project-search-picker--button" ref={pickerRef}>
        <button
          type="button"
          ref={triggerRef}
          className={`project-search-picker__trigger${selectedDepartment ? ' project-search-picker__trigger--selected' : ''}`}
          onClick={() => {
            if (disabled) return;
            setDropdownOpen((open) => {
              if (!open) setSearch('');
              return !open;
            });
          }}
          disabled={disabled}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
          title={title}
        >
          <span className="project-search-picker__trigger-label">{triggerLabel}</span>
          <span className="project-search-picker__trigger-caret" aria-hidden>▾</span>
        </button>
        {dropdownOpen && !disabled && dropdownPos && typeof document !== 'undefined' && createPortal(
          renderDropdown(true),
          document.body,
        )}
      </div>
    );
  }

  return (
    <div className="project-search-picker" ref={pickerRef}>
      {showSelected ? (
        <div className="project-search-picker__selected">
          <div className="project-search-picker__selected-info">
            <span className="project-search-picker__selected-name">
              {selectedDepartment.name || `Отдел #${selectedDepartment.id}`}
            </span>
          </div>
          <div className="project-search-picker__selected-actions">
            <button
              type="button"
              className="project-search-picker__change"
              onClick={() => setIsEditing(true)}
              disabled={disabled}
            >
              Изменить
            </button>
            {allowClear && (
              <button
                type="button"
                className="project-search-picker__clear"
                onClick={handleClear}
                disabled={disabled}
                aria-label="Убрать отдел"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            className="project-search-picker__input"
            placeholder={searchPlaceholder}
            autoComplete="off"
            disabled={disabled}
          />
          {dropdownOpen && !disabled && renderDropdown(false)}
        </>
      )}
    </div>
  );
}
