import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { documentService } from '../../services/documentService';
import { employeeService } from '../../services/employeeService';
import { teamService } from '../../services/teamService';
import DepartmentPicker from './DepartmentPicker';
import s from './TemplateAccess.module.css';


const svgProps = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};
const IconGlobe = () => (
  <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
);
const IconBuilding = () => (
  <svg {...svgProps}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" /></svg>
);
const IconLock = () => (
  <svg {...svgProps}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const IconUsers = () => (
  <svg {...svgProps}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 13.6A5.5 5.5 0 0 1 20.5 19" /></svg>
);

const ACCESS_MODES = [
  {
    id: 'org',
    label: 'Вся организация',
    icon: IconGlobe,
    hint: 'Шаблон видят все сотрудники. Изменять могут владелец и те, кому выдано право «Изменение».',
  },
  {
    id: 'department',
    label: 'Отдел',
    icon: IconBuilding,
    hint: 'Шаблон видят сотрудники выбранного отдела и подчинённых отделов, а также те, кому выдан доступ ниже.',
  },
  {
    id: 'restricted',
    label: 'Только выбранные',
    icon: IconLock,
    hint: 'Шаблон виден только тем, кому выдан доступ ниже. Нужен хотя бы один получатель.',
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

const SUBJECT_ICONS = { department: IconBuilding, team: IconUsers };

function emptyGrant(subjectType = 'user') {
  return { subject_type: subjectType, subject_id: '', permission: 'view' };
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';
}

function errorText(e, fallback) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || item).filter(Boolean).join('; ');
  return fallback;
}

/**
 * Окно «Доступ к шаблону»: режим видимости + дополнительные права людям, отделам и командам.
 */
export default function TemplateAccessSettings({ templateId, template, open, onClose, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [accessMode, setAccessMode] = useState('org');
  const [departmentId, setDepartmentId] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [draftGrant, setDraftGrant] = useState(() => emptyGrant());
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const initialRef = useRef(null);
  const dialogRef = useRef(null);

  const canManage = Boolean(template?.can_manage_access);

  const snapshot = (mode, dept, perms) => JSON.stringify({
    mode,
    dept: mode === 'department' ? dept : null,
    perms: perms.map((p) => `${p.subject_type}:${p.subject_id}:${p.permission}`).sort(),
  });

  const loadAccess = useCallback(async () => {
    if (!templateId || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const data = await documentService.getTemplateAccess(templateId);
      const mode = data.access_mode || 'org';
      const dept = data.department_id ?? null;
      const perms = Array.isArray(data.permissions) ? data.permissions : [];
      setAccessMode(mode);
      setDepartmentId(dept);
      setPermissions(perms);
      initialRef.current = snapshot(mode, dept, perms);
    } catch (e) {
      setError(errorText(e, 'Не удалось загрузить права доступа'));
    } finally {
      setLoading(false);
    }
  }, [templateId, canManage]);

  useEffect(() => {
    if (!open || !canManage) return;
    setDraftGrant(emptyGrant());
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

  const dirty = initialRef.current != null
    && snapshot(accessMode, departmentId, permissions) !== initialRef.current;

  const close = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('Закрыть без сохранения изменений доступа?')) return;
    onClose?.();
  }, [saving, dirty, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  const optionsByType = useMemo(() => ({
    user: employees.map((e) => ({ id: e.id, label: e.name || e.email || `ID ${e.id}` })),
    department: departments.map((d) => ({ id: d.id, label: d.name || `Отдел ${d.id}` })),
    team: teams.map((t) => ({ id: t.id, label: t.name || `Команда ${t.id}` })),
  }), [employees, departments, teams]);

  const subjectName = (row) => row.subject_name
    || optionsByType[row.subject_type]?.find((o) => o.id === row.subject_id)?.label
    || `#${row.subject_id}`;

  const handleAddGrant = () => {
    const subjectId = Number(draftGrant.subject_id);
    if (!subjectId || Number.isNaN(subjectId)) {
      setError('Выберите, кому выдать доступ');
      return;
    }
    setPermissions((prev) => [
      ...prev.filter((row) => !(row.subject_type === draftGrant.subject_type && row.subject_id === subjectId)),
      {
        subject_type: draftGrant.subject_type,
        subject_id: subjectId,
        permission: draftGrant.permission,
        subject_name: optionsByType[draftGrant.subject_type]?.find((o) => o.id === subjectId)?.label,
      },
    ]);
    setDraftGrant(emptyGrant(draftGrant.subject_type));
    setError(null);
  };

  const handleSave = async () => {
    if (!templateId) return;
    if (accessMode === 'department' && !departmentId) {
      setError('Выберите отдел для режима «Отдел»');
      return;
    }
    if (accessMode === 'restricted' && permissions.length === 0) {
      setError('Для режима «Только выбранные» добавьте хотя бы одного получателя');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await documentService.updateTemplateAccess(templateId, {
        access_mode: accessMode,
        department_id: accessMode === 'department' ? departmentId : null,
        permissions: permissions.map((row) => ({
          subject_type: row.subject_type,
          subject_id: row.subject_id,
          permission: row.permission,
        })),
      });
      onUpdated?.(updated);
      onClose?.();
    } catch (e) {
      setError(errorText(e, 'Не удалось сохранить права доступа'));
    } finally {
      setSaving(false);
    }
  };

  if (!canManage || !open || typeof document === 'undefined') return null;

  const activeMode = ACCESS_MODES.find((m) => m.id === accessMode) || ACCESS_MODES[0];
  const draftOptions = optionsByType[draftGrant.subject_type] || [];

  return createPortal(
    <div
      className={s.backdrop}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-access-title"
      >
        <div className={s.header}>
          <div>
            <h3 id="template-access-title" className={s.title}>Доступ к шаблону</h3>
            {template?.name && <p className={s.subtitle}>{template.name}</p>}
          </div>
          <button type="button" className={s.closeBtn} onClick={close} aria-label="Закрыть">×</button>
        </div>

        <div className={s.body}>
          {error && <div className={s.error} role="alert">{error}</div>}

          <section className={s.section}>
            <h4 className={s.sectionTitle}>Кто видит шаблон</h4>
            <div className={s.segmented} role="radiogroup" aria-label="Режим доступа">
              {ACCESS_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={accessMode === mode.id}
                  className={`${s.segment} ${accessMode === mode.id ? s.segmentActive : ''}`}
                  onClick={() => setAccessMode(mode.id)}
                  disabled={loading}
                >
                  <mode.icon />
                  {mode.label}
                </button>
              ))}
            </div>
            <p className={s.hint}>{activeMode.hint}</p>
            {accessMode === 'department' && (
              <div className={s.departmentRow}>
                <DepartmentPicker
                  variant="button"
                  value={departmentId}
                  onChange={setDepartmentId}
                  label="Отдел"
                  hint="Сотрудники этого отдела и подчинённых отделов видят шаблон."
                  buttonPlaceholder="Выберите отдел"
                />
              </div>
            )}
          </section>

          <section className={s.section}>
            <h4 className={s.sectionTitle}>
              Дополнительный доступ
              {permissions.length > 0 && <span className={s.count}>{permissions.length}</span>}
            </h4>
            {loading ? (
              <p className={s.muted}>Загрузка…</p>
            ) : permissions.length === 0 ? (
              <p className={s.muted}>Пока никому не выдан отдельный доступ.</p>
            ) : (
              <ul className={s.grantList}>
                {permissions.map((row, index) => (
                  <li key={`${row.subject_type}-${row.subject_id}`} className={s.grantItem}>
                    <span className={s.avatar} aria-hidden>
                      {row.subject_type === 'user'
                        ? initials(subjectName(row))
                        : React.createElement(SUBJECT_ICONS[row.subject_type] || IconUsers)}
                    </span>
                    <span className={s.grantText}>
                      <span className={s.grantName}>{subjectName(row)}</span>
                      <span className={s.grantType}>
                        {SUBJECT_TYPES.find((t) => t.id === row.subject_type)?.label || row.subject_type}
                      </span>
                    </span>
                    <select
                      className={s.permSelect}
                      value={row.permission}
                      onChange={(e) => {
                        const permission = e.target.value;
                        setPermissions((prev) => prev.map((p, i) => (i === index ? { ...p, permission } : p)));
                      }}
                      aria-label={`Права для ${subjectName(row)}`}
                    >
                      {PERMISSION_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={s.removeBtn}
                      onClick={() => setPermissions((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Убрать доступ для ${subjectName(row)}`}
                      title="Убрать доступ"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={s.addRow}>
              <div className={s.typeTabs} role="tablist" aria-label="Кому выдать доступ">
                {SUBJECT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    role="tab"
                    aria-selected={draftGrant.subject_type === type.id}
                    className={`${s.typeTab} ${draftGrant.subject_type === type.id ? s.typeTabActive : ''}`}
                    onClick={() => setDraftGrant(emptyGrant(type.id))}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
              <div className={s.addControls}>
                <select
                  className={s.subjectSelect}
                  value={draftGrant.subject_id}
                  onChange={(e) => setDraftGrant((prev) => ({ ...prev, subject_id: e.target.value }))}
                  aria-label="Получатель доступа"
                >
                  <option value="">
                    {draftGrant.subject_type === 'user' ? 'Выберите сотрудника…'
                      : draftGrant.subject_type === 'department' ? 'Выберите отдел…' : 'Выберите команду…'}
                  </option>
                  {draftOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <select
                  className={s.permSelect}
                  value={draftGrant.permission}
                  onChange={(e) => setDraftGrant((prev) => ({ ...prev, permission: e.target.value }))}
                  aria-label="Уровень доступа"
                >
                  {PERMISSION_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={s.addBtn}
                  onClick={handleAddGrant}
                  disabled={!draftGrant.subject_id}
                >
                  Добавить
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className={s.footer}>
          <span className={s.footerNote}>{dirty ? 'Есть несохранённые изменения' : ''}</span>
          <button type="button" className={s.cancelBtn} onClick={close} disabled={saving}>Отмена</button>
          <button type="button" className={s.saveBtn} onClick={handleSave} disabled={saving || loading || !dirty}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
