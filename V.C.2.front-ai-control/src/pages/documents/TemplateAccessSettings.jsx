import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { documentService } from '../../services/documentService';
import { employeeService } from '../../services/employeeService';
import { teamService } from '../../services/teamService';
import DepartmentPicker from './DepartmentPicker';
import { IconChevronDown } from './DocumentIcons';
import styles from './DocumentsApp.module.css';

const ACCESS_MODES = [
  {
    id: 'org',
    label: 'Вся организация',
    hint: 'Шаблон видят все сотрудники. Редактировать могут владелец и те, кому выдано право «Изменение».',
  },
  {
    id: 'department',
    label: 'Отдел',
    hint: 'Базовая видимость по выбранному отделу. Можно добавить отдельные права для людей, отделов и команд.',
  },
  {
    id: 'restricted',
    label: 'Только выбранные',
    hint: 'Шаблон виден только тем, кому явно выдан доступ. Нужен хотя бы один получатель.',
  },
];

const SUBJECT_TYPES = [
  { id: 'user', label: 'Сотрудник' },
  { id: 'department', label: 'Отдел' },
  { id: 'team', label: 'Команда' },
];

const PERMISSION_OPTIONS = [
  { id: 'view', label: 'Просмотр' },
  { id: 'edit', label: 'Изменение' },
];

function emptyGrant() {
  return { subject_type: 'user', subject_id: '', permission: 'view' };
}

export default function TemplateAccessSettings({ templateId, template, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [accessMode, setAccessMode] = useState('org');
  const [departmentId, setDepartmentId] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [draftGrant, setDraftGrant] = useState(emptyGrant);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);

  const canManage = Boolean(template?.can_manage_access);

  const loadAccess = useCallback(async () => {
    if (!templateId || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const data = await documentService.getTemplateAccess(templateId);
      setAccessMode(data.access_mode || 'org');
      setDepartmentId(data.department_id ?? null);
      setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      onUpdated?.(data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось загрузить права доступа');
    } finally {
      setLoading(false);
    }
  }, [templateId, canManage, onUpdated]);

  useEffect(() => {
    if (!open || !canManage) return;
    loadAccess();
    Promise.all([
      employeeService.getEmployees(),
      employeeService.getDepartments(),
      teamService.getTeams(),
    ]).then(([emps, depts, teamList]) => {
      setEmployees(Array.isArray(emps) ? emps : []);
      setDepartments(Array.isArray(depts) ? depts : []);
      setTeams(Array.isArray(teamList) ? teamList : []);
    }).catch(() => {
      setEmployees([]);
      setDepartments([]);
      setTeams([]);
    });
  }, [open, canManage, loadAccess]);

  useEffect(() => {
    if (!template) return;
    setAccessMode(template.access_mode || 'org');
    setDepartmentId(template.department_id ?? null);
  }, [template?.id, template?.access_mode, template?.department_id]);

  const subjectOptions = useMemo(() => {
    if (draftGrant.subject_type === 'user') {
      return employees.map((e) => ({ id: e.id, label: e.name || e.email || `ID ${e.id}` }));
    }
    if (draftGrant.subject_type === 'department') {
      return departments.map((d) => ({ id: d.id, label: d.name || `Отдел ${d.id}` }));
    }
    return teams.map((t) => ({ id: t.id, label: t.name || `Команда ${t.id}` }));
  }, [draftGrant.subject_type, employees, departments, teams]);

  const handleAddGrant = () => {
    const subjectId = Number(draftGrant.subject_id);
    if (!subjectId || Number.isNaN(subjectId)) {
      setError('Выберите получателя права');
      return;
    }
    setPermissions((prev) => {
      const filtered = prev.filter(
        (row) => !(row.subject_type === draftGrant.subject_type && row.subject_id === subjectId),
      );
      return [
        ...filtered,
        {
          subject_type: draftGrant.subject_type,
          subject_id: subjectId,
          permission: draftGrant.permission,
          subject_name: subjectOptions.find((o) => o.id === subjectId)?.label,
        },
      ];
    });
    setDraftGrant(emptyGrant());
    setError(null);
  };

  const handleRemoveGrant = (index) => {
    setPermissions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!templateId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        access_mode: accessMode,
        department_id: accessMode === 'department' ? departmentId : null,
        permissions: permissions.map((row) => ({
          subject_type: row.subject_type,
          subject_id: row.subject_id,
          permission: row.permission,
        })),
      };
      const updated = await documentService.updateTemplateAccess(templateId, payload);
      setPermissions(Array.isArray(updated.permissions) ? updated.permissions : []);
      setAccessMode(updated.access_mode || accessMode);
      setDepartmentId(updated.department_id ?? null);
      setMessage('Права доступа сохранены');
      onUpdated?.(updated);
    } catch (e) {
      const detail = e.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => item?.msg || item).filter(Boolean).join('; ')
            : 'Не удалось сохранить права доступа'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <div className={styles.templateAccessPanel}>
      <button
        type="button"
        className={`${styles.pageNumberSettingsToggle}${open ? ` ${styles.pageNumberSettingsToggleOpen}` : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className={`${styles.pageNumberSettingsToggleIcon}${open ? ` ${styles.pageNumberSettingsToggleIconOpen}` : ''}`}
          aria-hidden
        >
          <IconChevronDown size={16} />
        </span>
        <span className={styles.pageNumberSettingsToggleTitle}>Права доступа к шаблону</span>
      </button>
      {open && (
        <div className={styles.templateAccessBody}>
          {loading ? <p className={styles.mutedText}>Загрузка…</p> : null}
          {error ? <div className={styles.error} role="alert">{error}</div> : null}
          {message ? <div className={styles.infoMessage} role="status">{message}</div> : null}

          <div className={styles.templateAccessModes}>
            {ACCESS_MODES.map((mode) => (
              <label key={mode.id} className={styles.templateAccessModeCard}>
                <input
                  type="radio"
                  name="template-access-mode"
                  value={mode.id}
                  checked={accessMode === mode.id}
                  onChange={() => setAccessMode(mode.id)}
                />
                <span className={styles.templateAccessModeTitle}>{mode.label}</span>
                <span className={styles.templateAccessModeHint}>{mode.hint}</span>
              </label>
            ))}
          </div>

          {accessMode === 'department' && (
            <DepartmentPicker
              variant="button"
              value={departmentId}
              onChange={setDepartmentId}
              label="Базовый отдел"
              hint="Сотрудники этого отдела (и подчинённых) видят шаблон."
              buttonPlaceholder="Выберите отдел"
            />
          )}

          <div className={styles.templateAccessGrants}>
            <h4 className={styles.templateAccessGrantsTitle}>Дополнительные права</h4>
            <p className={styles.mutedText}>
              Выдайте просмотр или изменение конкретным сотрудникам, отделам или командам.
            </p>
            {permissions.length === 0 ? (
              <p className={styles.mutedText}>Пока нет дополнительных прав.</p>
            ) : (
              <ul className={styles.templateAccessGrantList}>
                {permissions.map((row, index) => (
                  <li key={`${row.subject_type}-${row.subject_id}-${index}`} className={styles.templateAccessGrantItem}>
                    <span>
                      {SUBJECT_TYPES.find((t) => t.id === row.subject_type)?.label || row.subject_type}
                      {': '}
                      <strong>{row.subject_name || `#${row.subject_id}`}</strong>
                      {' — '}
                      {PERMISSION_OPTIONS.find((p) => p.id === row.permission)?.label || row.permission}
                    </span>
                    <button
                      type="button"
                      className={styles.templateAccessGrantRemove}
                      onClick={() => handleRemoveGrant(index)}
                    >
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.templateAccessGrantForm}>
              <select
                className={styles.fieldInput}
                value={draftGrant.subject_type}
                onChange={(e) => setDraftGrant({ ...emptyGrant(), subject_type: e.target.value })}
              >
                {SUBJECT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
              <select
                className={styles.fieldInput}
                value={draftGrant.subject_id}
                onChange={(e) => setDraftGrant((prev) => ({ ...prev, subject_id: e.target.value }))}
              >
                <option value="">Выберите…</option>
                {subjectOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <select
                className={styles.fieldInput}
                value={draftGrant.permission}
                onChange={(e) => setDraftGrant((prev) => ({ ...prev, permission: e.target.value }))}
              >
                {PERMISSION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <button type="button" className={styles.secondaryButton} onClick={handleAddGrant}>
                Добавить
              </button>
            </div>
          </div>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Сохранение…' : 'Сохранить права доступа'}
          </button>
        </div>
      )}
    </div>
  );
}
