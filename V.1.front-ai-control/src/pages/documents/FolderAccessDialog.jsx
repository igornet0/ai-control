import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { documentService } from '../../services/documentService';
import { employeeService } from '../../services/employeeService';
import { teamService } from '../../services/teamService';
import { projectService } from '../../services/projectService';
import { DocIcon } from './DocumentIcons';
import { FolderDialogShell, errorText } from './FolderDialogs';
import { ACCESS_LEVEL_HINTS, ACCESS_LEVEL_LABELS } from './documentFolderUtils';
import s from './TemplateAccess.module.css';
import f from './DocumentFolders.module.css';

const SUBJECT_TYPES = [
  { id: 'user', label: 'Сотрудник', placeholder: 'Выберите сотрудника…', icon: null },
  { id: 'department', label: 'Отдел', placeholder: 'Выберите отдел…', icon: 'building' },
  { id: 'team', label: 'Команда', placeholder: 'Выберите команду…', icon: 'users' },
  { id: 'project', label: 'Проект', placeholder: 'Выберите проект…', icon: 'briefcase' },
];

const LEVELS = ['view', 'edit', 'manage'];

const emptyGrant = (subjectType = 'user') => ({ subject_type: subjectType, subject_id: '', role: '', permission: 'view' });

const grantKey = (g) => `${g.subject_type}:${g.subject_id}:${g.role || ''}`;

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';
}

/**
 * «Доступ к папке»: кто получил доступ автоматически (группа, родительские папки)
 * и явные права людям, отделам, командам и проектам — целиком или только для роли в группе.
 */
export default function FolderAccessDialog({ folder, onClose, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [access, setAccess] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [draft, setDraft] = useState(() => emptyGrant());
  const [options, setOptions] = useState({ user: [], department: [], team: [], project: [] });
  const initialRef = useRef(null);

  const canManage = Boolean(access?.can_manage);
  const roles = access?.roles || {};

  const snapshot = (perms) => JSON.stringify(perms.map((p) => `${grantKey(p)}:${p.permission}`).sort());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await documentService.getFolderAccess(folder.id);
      const perms = Array.isArray(data.permissions) ? data.permissions : [];
      setAccess(data);
      setPermissions(perms);
      initialRef.current = snapshot(perms);
    } catch (e) {
      setError(errorText(e, 'Не удалось загрузить доступ к папке'));
    } finally {
      setLoading(false);
    }
  }, [folder.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    const safe = (p) => p.then((x) => (Array.isArray(x) ? x : [])).catch(() => []);
    Promise.all([
      safe(employeeService.getEmployees()),
      safe(employeeService.getDepartments()),
      safe(teamService.getTeams()),
      safe(projectService.getProjects()),
    ]).then(([emps, depts, teams, projects]) => {
      setOptions({
        user: emps.map((e) => ({ id: e.id, label: e.name || e.email || `ID ${e.id}` })),
        department: depts.map((d) => ({ id: d.id, label: d.name || `Отдел ${d.id}` })),
        team: teams.map((t) => ({ id: t.id, label: t.name || `Команда ${t.id}` })),
        project: projects.map((p) => ({ id: p.id, label: p.name || `Проект ${p.id}` })),
      });
    });
  }, [canManage]);

  const dirty = initialRef.current != null && snapshot(permissions) !== initialRef.current;

  const close = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('Закрыть без сохранения изменений доступа?')) return;
    onClose?.();
  }, [saving, dirty, onClose]);

  const subjectName = (row) => row.subject_name
    || options[row.subject_type]?.find((o) => o.id === row.subject_id)?.label
    || `#${row.subject_id}`;

  const roleLabel = (row) => {
    if (!row.role) return row.subject_type === 'user' ? null : 'Все участники';
    return row.role_label || roles[row.subject_type]?.find((r) => r.id === row.role)?.label || row.role;
  };

  const handleAdd = () => {
    const subjectId = Number(draft.subject_id);
    if (!subjectId) {
      setError('Выберите, кому выдать доступ');
      return;
    }
    const row = {
      subject_type: draft.subject_type,
      subject_id: subjectId,
      role: draft.subject_type === 'user' ? null : (draft.role || null),
      permission: draft.permission,
      subject_name: options[draft.subject_type]?.find((o) => o.id === subjectId)?.label,
    };
    setPermissions((prev) => [...prev.filter((p) => grantKey(p) !== grantKey(row)), row]);
    setDraft(emptyGrant(draft.subject_type));
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await documentService.updateFolderAccess(folder.id, {
        permissions: permissions.map((p) => ({
          subject_type: p.subject_type,
          subject_id: p.subject_id,
          role: p.role || null,
          permission: p.permission,
        })),
      });
      onUpdated?.(data);
      onClose?.();
    } catch (e) {
      setError(errorText(e, 'Не удалось сохранить доступ'));
      setSaving(false);
    }
  };

  const draftType = SUBJECT_TYPES.find((t) => t.id === draft.subject_type) || SUBJECT_TYPES[0];
  const draftRoles = roles[draft.subject_type] || [];

  const autoLines = useMemo(() => {
    if (!access) return [];
    const lines = [];
    if (access.implicit_access) lines.push({ icon: 'users', text: access.implicit_access });
    if (access.owner_name) lines.push({ icon: 'folder', text: `Создатель папки — ${access.owner_name}: управление.` });
    if (access.inherited_from?.length) {
      const names = [...access.inherited_from].reverse().map((p) => `«${p.name}»`).join(' → ');
      lines.push({ icon: 'share', text: `Доступ к родительским папкам действует и здесь: ${names}.` });
    }
    return lines;
  }, [access]);

  return (
    <FolderDialogShell
      title="Доступ к папке"
      subtitle={folder.name}
      onClose={close}
      busy={saving}
      labelId="folder-access-title"
      wide
      footer={(
        <>
          <span className={s.footerNote}>
            {canManage
              ? (dirty ? 'Есть несохранённые изменения' : '')
              : `Ваш доступ: ${ACCESS_LEVEL_LABELS[access?.access_level] || '—'}`}
          </span>
          <button type="button" className={s.cancelBtn} onClick={close} disabled={saving}>
            {canManage ? 'Отмена' : 'Закрыть'}
          </button>
          {canManage && (
            <button type="button" className={s.saveBtn} onClick={handleSave} disabled={saving || loading || !dirty}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          )}
        </>
      )}
    >
      {error && <div className={s.error} role="alert">{error}</div>}

      {autoLines.length > 0 && (
        <section className={s.section}>
          <h4 className={s.sectionTitle}>Доступ автоматически</h4>
          <ul className={f.inheritList}>
            {autoLines.map((line) => (
              <li key={line.text}>
                <DocIcon name={line.icon} size={15} />
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={s.section}>
        <h4 className={s.sectionTitle}>
          Выданный доступ
          {permissions.length > 0 && <span className={s.count}>{permissions.length}</span>}
        </h4>
        {loading ? (
          <p className={s.muted}>Загрузка…</p>
        ) : permissions.length === 0 ? (
          <p className={s.muted}>
            {canManage ? 'Пока никому не выдан отдельный доступ.' : 'Отдельный доступ никому не выдан.'}
          </p>
        ) : (
          <ul className={s.grantList}>
            {permissions.map((row, index) => {
              const type = SUBJECT_TYPES.find((t) => t.id === row.subject_type);
              const rLabel = roleLabel(row);
              return (
                <li key={grantKey(row)} className={s.grantItem}>
                  <span className={s.avatar} aria-hidden>
                    {type?.icon ? <DocIcon name={type.icon} size={16} /> : initials(subjectName(row))}
                  </span>
                  <span className={s.grantText}>
                    <span className={s.grantName}>{subjectName(row)}</span>
                    <span className={s.grantType}>
                      {type?.label || row.subject_type}
                      {rLabel && <span className={f.grantRole}> · {rLabel}</span>}
                    </span>
                  </span>
                  {canManage ? (
                    <>
                      <select
                        className={s.permSelect}
                        value={row.permission}
                        onChange={(e) => {
                          const permission = e.target.value;
                          setPermissions((prev) => prev.map((p, i) => (i === index ? { ...p, permission } : p)));
                        }}
                        aria-label={`Права для ${subjectName(row)}`}
                      >
                        {LEVELS.map((lvl) => <option key={lvl} value={lvl}>{ACCESS_LEVEL_LABELS[lvl]}</option>)}
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
                    </>
                  ) : (
                    <span className={s.grantType}>{ACCESS_LEVEL_LABELS[row.permission]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canManage && (
          <div className={s.addRow}>
            <div className={s.typeTabs} role="tablist" aria-label="Кому выдать доступ">
              {SUBJECT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  role="tab"
                  aria-selected={draft.subject_type === type.id}
                  className={`${s.typeTab} ${draft.subject_type === type.id ? s.typeTabActive : ''}`}
                  onClick={() => setDraft(emptyGrant(type.id))}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <div className={s.addControls}>
              <select
                className={s.subjectSelect}
                value={draft.subject_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, subject_id: e.target.value }))}
                aria-label="Получатель доступа"
              >
                <option value="">{draftType.placeholder}</option>
                {(options[draft.subject_type] || []).map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              {draftRoles.length > 0 && (
                <select
                  className={`${s.permSelect} ${f.roleSelect}`}
                  value={draft.role}
                  onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
                  aria-label="Роль в группе"
                  title="Выдать доступ всем участникам группы или только одной роли"
                >
                  <option value="">Все участники</option>
                  {draftRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              )}
              <select
                className={s.permSelect}
                value={draft.permission}
                onChange={(e) => setDraft((prev) => ({ ...prev, permission: e.target.value }))}
                aria-label="Уровень доступа"
                title={ACCESS_LEVEL_HINTS[draft.permission]}
              >
                {LEVELS.map((lvl) => <option key={lvl} value={lvl}>{ACCESS_LEVEL_LABELS[lvl]}</option>)}
              </select>
              <button type="button" className={s.addBtn} onClick={handleAdd} disabled={!draft.subject_id}>
                Добавить
              </button>
            </div>
            <p className={s.hint}>
              Просмотр — видит документы · Изменение — добавляет и редактирует документы · Управление — переименовывает, удаляет и выдаёт доступ.
            </p>
          </div>
        )}
      </section>
    </FolderDialogShell>
  );
}
