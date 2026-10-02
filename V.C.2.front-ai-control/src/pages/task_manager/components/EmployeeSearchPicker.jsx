import React, { useEffect, useRef, useState } from 'react';
import { employeeService } from '../../../services/employeeService';
import { CloseIcon } from './TaskManagerIcons';
import './ProjectSearchPicker.css';

function formatEmployeeLabel(employee) {
  return employee?.name || `Сотрудник #${employee?.id}`;
}

export default function EmployeeSearchPicker({
  value = null,
  onChange,
  disabled = false,
  placeholder = 'Введите имя исполнителя',
  emptyMessage = 'Сотрудники не найдены',
}) {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const pickerRef = useRef(null);

  const showSelected = value?.id && !isEditing;

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const query = search.trim();
        const data = await employeeService.getEmployees(query ? { search: query } : {});
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setEmployees(list.filter((employee) => employee.is_active !== false));
      } catch {
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, dropdownOpen]);

  const handleSelect = (employee) => {
    onChange?.(employee);
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

  return (
    <div className="project-search-picker" ref={pickerRef}>
      {showSelected ? (
        <div className="project-search-picker__selected">
          <div className="project-search-picker__selected-info">
            <span className="project-search-picker__selected-name">
              {formatEmployeeLabel(value)}
            </span>
            {value.department_name && (
              <span className="project-search-picker__selected-desc">
                {value.department_name}
              </span>
            )}
          </div>
          <div className="project-search-picker__selected-actions">
            <button
              type="button"
              className="project-search-picker__change"
              onClick={() => {
                setIsEditing(true);
                setSearch(value.name || '');
                setDropdownOpen(true);
              }}
              disabled={disabled}
            >
              Изменить
            </button>
            <button
              type="button"
              className="project-search-picker__clear"
              onClick={handleClear}
              disabled={disabled}
              aria-label="Убрать исполнителя"
            >
              <CloseIcon size="xs" />
            </button>
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
            className="project-search-picker__input w-full rounded-lg border border-slate-600/50 bg-slate-800/50 backdrop-blur-sm px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:border-slate-500/50"
            placeholder={placeholder}
            autoComplete="off"
            disabled={disabled}
          />
          {dropdownOpen && !disabled && (
            <div className="project-search-picker__dropdown">
              <button
                type="button"
                className="project-search-picker__option project-search-picker__option--muted"
                onClick={() => handleSelect(null)}
              >
                Без исполнителя
              </button>
              {loading ? (
                <p className="project-search-picker__empty">Поиск сотрудников…</p>
              ) : employees.length === 0 ? (
                <p className="project-search-picker__empty">{emptyMessage}</p>
              ) : (
                employees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    className={`project-search-picker__option${employee.id === value?.id ? ' project-search-picker__option--active' : ''}`}
                    onClick={() => handleSelect({
                      id: employee.id,
                      name: employee.name,
                      department_name: employee.department_name,
                      email: employee.email,
                    })}
                  >
                    <span className="project-search-picker__option-name">
                      {formatEmployeeLabel(employee)}
                    </span>
                    {(employee.department_name || employee.email) && (
                      <span className="project-search-picker__option-desc">
                        {[employee.department_name, employee.email].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
