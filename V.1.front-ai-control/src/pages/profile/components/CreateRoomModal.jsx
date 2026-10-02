import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { employeeService } from '../../../services/employeeService';
import { messagingService } from '../../../services/messagingService';
import { getInitials } from '../../../utils/getAvatarUrl';
import styles from './CreateRoomModal.module.css';

function normalizeEmployees(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export default function CreateRoomModal({ open, onClose, onCreated, currentUserId }) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await employeeService.getChatDirectory({
        search: search.trim() || undefined,
      });
      setEmployees(normalizeEmployees(data));
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить сотрудников');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      loadEmployees();
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, loadEmployees, search]);

  useEffect(() => {
    if (!open) {
      setName('');
      setSearch('');
      setSelectedIds(new Set());
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (employee.id === currentUserId) return false;
      if (!query) return true;
      const haystack = [employee.name, employee.email, employee.team_role]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [employees, search, currentUserId]);

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => selectedIds.has(employee.id)),
    [employees, selectedIds]
  );

  const toggleEmployee = (employeeId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Введите название комнаты');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Выберите хотя бы одного сотрудника');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const room = await messagingService.createRoom(trimmedName, [...selectedIds]);
      onCreated?.(room);
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Не удалось создать комнату');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Создать комнату"
      >
        <div className={styles.head}>
          <h3>Новая комната</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть">
            <XMarkIcon />
          </button>
        </div>

        <form className={styles.body} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Название</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Проект Альфа"
              maxLength={120}
              autoFocus
            />
          </label>

          <div className={styles.searchWrap}>
            <MagnifyingGlassIcon />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск сотрудников"
            />
          </div>

          {selectedEmployees.length > 0 && (
            <div className={styles.selectedChips}>
              {selectedEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className={styles.chip}
                  onClick={() => toggleEmployee(employee.id)}
                  title="Убрать"
                >
                  {employee.name}
                  <span>×</span>
                </button>
              ))}
            </div>
          )}

          <div className={styles.list}>
            {loading && <p className={styles.hint}>Загрузка…</p>}
            {!loading && filteredEmployees.length === 0 && (
              <p className={styles.hint}>Сотрудники не найдены</p>
            )}
            {!loading &&
              filteredEmployees.map((employee) => {
                const selected = selectedIds.has(employee.id);
                return (
                  <button
                    key={employee.id}
                    type="button"
                    className={`${styles.item} ${selected ? styles.itemSelected : ''}`}
                    onClick={() => toggleEmployee(employee.id)}
                  >
                    <span className={styles.itemAvatar}>{getInitials(employee.name)}</span>
                    <span className={styles.itemMeta}>
                      <strong>{employee.name}</strong>
                      <small>{employee.email || employee.team_role || '—'}</small>
                    </span>
                    {selected && <span className={styles.itemCheck}>✓</span>}
                  </button>
                );
              })}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              Отмена
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
