import React, { useEffect, useState } from 'react';
import { projectService } from '../../services/projectService';
import ProjectSearchPicker from '../task_manager/components/ProjectSearchPicker';
import styles from './DocumentsApp.module.css';

export default function DocumentProjectPicker({
  value = null,
  onChange,
  disabled = false,
  variant = 'default',
  label = 'Проект',
  hint = 'Документ можно привязать к проекту. Изменения сохраняются сразу.',
  saving = false,
  buttonPlaceholder = 'Выбрать проект',
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    projectService
      .getProjects()
      .then((data) => {
        if (!cancelled) setProjects(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const picker = (
    <ProjectSearchPicker
      projects={projects}
      loading={loading}
      value={value}
      onChange={onChange}
      disabled={disabled || saving}
      variant={variant}
      buttonPlaceholder={buttonPlaceholder}
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
