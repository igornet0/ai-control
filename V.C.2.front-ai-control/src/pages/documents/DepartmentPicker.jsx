import React, { useEffect, useState } from 'react';
import { employeeService } from '../../services/employeeService';
import DepartmentSearchPicker from './DepartmentSearchPicker';
import styles from './DocumentsApp.module.css';

export default function DepartmentPicker({
  value = null,
  onChange,
  disabled = false,
  variant = 'default',
  label = 'Отдел',
  hint = 'Пусто — общий шаблон/документ для всех сотрудников.',
  saving = false,
  buttonPlaceholder = 'Не выбран — нажмите для выбора',
  clearLabel = 'Общий (без отдела)',
}) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    employeeService
      .getDepartments()
      .then((data) => {
        if (!cancelled) setDepartments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const picker = (
    <DepartmentSearchPicker
      departments={departments}
      loading={loading}
      value={value}
      onChange={onChange}
      disabled={disabled || saving}
      variant={variant}
      buttonPlaceholder={buttonPlaceholder}
      clearLabel={clearLabel}
      title={hint || undefined}
    />
  );

  if (variant === 'button') {
    return (
      <div className={styles.docProjectPickerButton}>
        <div className={styles.docProjectPickerButtonRow}>
          <span className={styles.docProjectPickerButtonLabel}>{label}</span>
          {saving && <span className={styles.docProjectPickerSaving}>Сохранение…</span>}
        </div>
        <div className={styles.docProjectPickerButtonControl}>{picker}</div>
      </div>
    );
  }

  return (
    <div className={styles.docProjectPicker}>
      <div className={styles.docProjectPickerLabelRow}>
        <span className={styles.docProjectPickerLabel}>{label}</span>
        {saving && <span className={styles.docProjectPickerSaving}>Сохранение…</span>}
      </div>
      {hint && <p className={styles.docProjectPickerHint}>{hint}</p>}
      {picker}
    </div>
  );
}
