import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import './ProjectSearchPicker.css';

export function findProjectIdForTask(projects, taskId) {
  if (taskId == null || !Array.isArray(projects)) return null;
  const normalizedTaskId = Number(taskId);
  for (const project of projects) {
    if ((project.tasks || []).some((task) => Number(task.id) === normalizedTaskId)) {
      return project.id;
    }
  }
  return null;
}

export default function ProjectSearchPicker({
  projects = [],
  loading = false,
  value = null,
  onChange,
  disabled = false,
  variant = 'default',
  buttonPlaceholder = 'Выбрать проект',
  emptyMessage = 'Нет доступных проектов',
  searchPlaceholder = 'Поиск по названию, описанию или ID…',
  title,
  /** variant="button": поле на всю ширину в стиле CustomSelect */
  fullWidth = false,
}) {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === value) || null,
    [projects, value]
  );

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...projects].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'ru')
    );
    if (!query) return sorted;
    return sorted.filter((project) => {
      const name = (project.name || '').toLowerCase();
      const description = (project.description || '').toLowerCase();
      return (
        name.includes(query) ||
        description.includes(query) ||
        String(project.id).includes(query)
      );
    });
  }, [projects, search]);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const handleClickOutside = (event) => {
      const root = pickerRef.current;
      const panel = document.getElementById('project-search-picker-dropdown');
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

  const handleSelect = (projectId) => {
    onChange(projectId);
    setSearch('');
    setDropdownOpen(false);
    setIsEditing(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
    setDropdownOpen(false);
    setIsEditing(false);
  };

  const showSelected = selectedProject && !isEditing && variant !== 'button';

  const renderDropdown = (floating = false) => (
    <div
      id={floating ? 'project-search-picker-dropdown' : undefined}
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
        <button
          type="button"
          className="project-search-picker__option project-search-picker__option--muted"
          onClick={() => handleSelect(null)}
        >
          Без проекта
        </button>
        {filteredProjects.length === 0 ? (
          <p className="project-search-picker__empty">Ничего не найдено</p>
        ) : (
          filteredProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-search-picker__option${project.id === value ? ' project-search-picker__option--active' : ''}`}
              onClick={() => handleSelect(project.id)}
            >
              <span className="project-search-picker__option-name">
                {project.name || `Проект #${project.id}`}
              </span>
              {project.description && (
                <span className="project-search-picker__option-desc">
                  {project.description}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );

  if (loading) {
    if (variant === 'button') {
      return (
        <div className={`project-search-picker--button${fullWidth ? ' project-search-picker--field' : ''}`}>
          <button type="button" className="project-search-picker__trigger" disabled>
            Загрузка проектов…
          </button>
        </div>
      );
    }
    return <p className="text-sm text-slate-400 mt-2">Загрузка проектов…</p>;
  }

  if (!projects.length) {
    if (variant === 'button') {
      return (
        <div className={`project-search-picker--button${fullWidth ? ' project-search-picker--field' : ''}`}>
          <button type="button" className="project-search-picker__trigger" disabled>
            {emptyMessage}
          </button>
        </div>
      );
    }
    return <p className="text-sm text-slate-400 mt-2">{emptyMessage}</p>;
  }

  if (variant === 'button') {
    const triggerLabel = selectedProject
      ? (selectedProject.name || `Проект #${selectedProject.id}`)
      : buttonPlaceholder;

    return (
      <div
        className={`project-search-picker project-search-picker--button${fullWidth ? ' project-search-picker--field' : ''}`}
        ref={pickerRef}
      >
        <button
          type="button"
          ref={triggerRef}
          className={`project-search-picker__trigger${selectedProject ? ' project-search-picker__trigger--selected' : ''}`}
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
          {fullWidth ? (
            <svg className="project-search-picker__trigger-caret" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <span className="project-search-picker__trigger-caret" aria-hidden>▾</span>
          )}
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
              {selectedProject.name || `Проект #${selectedProject.id}`}
            </span>
            {selectedProject.description && (
              <span className="project-search-picker__selected-desc">
                {selectedProject.description}
              </span>
            )}
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
            <button
              type="button"
              className="project-search-picker__clear"
              onClick={handleClear}
              disabled={disabled}
              aria-label="Убрать проект"
            >
              <XMarkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
            className="project-search-picker__input"
            placeholder={searchPlaceholder}
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
                Без проекта
              </button>
              {filteredProjects.length === 0 ? (
                <p className="project-search-picker__empty">Ничего не найдено</p>
              ) : (
                filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="project-search-picker__option"
                    onClick={() => handleSelect(project.id)}
                  >
                    <span className="project-search-picker__option-name">
                      {project.name || `Проект #${project.id}`}
                    </span>
                    {project.description && (
                      <span className="project-search-picker__option-desc">
                        {project.description}
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
