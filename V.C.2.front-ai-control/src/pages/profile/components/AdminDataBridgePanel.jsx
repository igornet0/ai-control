import React, { useEffect, useMemo, useState } from 'react';
import { adminService } from '../../../services/adminService';
import { employeeService, TEAM_ROLES } from '../../../services/employeeService';
import { teamService } from '../../../services/teamService';
import { AdminIcon } from './AdminIcons';
import styles from './AdminDataBridgePanel.module.css';

const POSITION_OPTIONS = TEAM_ROLES.filter((role) => role !== 'Guest');

const ROW_SCOPE_OPTIONS = [
  { value: 'all', label: 'Все (без доп. фильтра)' },
  { value: 'own', label: 'Только свои' },
  { value: 'team', label: 'Команда' },
  { value: 'department', label: 'Отдел' },
  { value: 'deny', label: 'Запретить строки' },
];

const DEFAULT_ACCESS = {
  mode: 'all',
  user_ids: [],
  team_ids: [],
  team_roles: [],
};

const DEFAULT_SUBJECTS = {
  all: false,
  match: 'any',
  user_ids: [],
  team_ids: [],
  team_roles: [],
  department_ids: [],
};

function normalizeAccess(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ACCESS };
  return {
    mode: raw.mode === 'restricted' ? 'restricted' : 'all',
    user_ids: Array.isArray(raw.user_ids) ? raw.user_ids.map(Number).filter((id) => id > 0) : [],
    team_ids: Array.isArray(raw.team_ids) ? raw.team_ids.map(Number).filter((id) => id > 0) : [],
    team_roles: Array.isArray(raw.team_roles) ? raw.team_roles.filter(Boolean) : [],
  };
}

function normalizeSubjects(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SUBJECTS };
  return {
    all: Boolean(raw.all),
    match: raw.match === 'all' ? 'all' : 'any',
    user_ids: Array.isArray(raw.user_ids) ? raw.user_ids.map(Number).filter((id) => id > 0) : [],
    team_ids: Array.isArray(raw.team_ids) ? raw.team_ids.map(Number).filter((id) => id > 0) : [],
    team_roles: Array.isArray(raw.team_roles) ? raw.team_roles.filter(Boolean) : [],
    department_ids: Array.isArray(raw.department_ids)
      ? raw.department_ids.map(Number).filter((id) => id > 0)
      : [],
  };
}

function normalizeEntityRule(raw) {
  const scope = String(raw?.row_scope || 'all').toLowerCase();
  const valid = ROW_SCOPE_OPTIONS.some((o) => o.value === scope) ? scope : 'all';
  return {
    row_scope: valid,
    allowed_fields: Array.isArray(raw?.allowed_fields) ? raw.allowed_fields.map(String) : null,
  };
}

function normalizePolicies(raw, entityNames) {
  if (!Array.isArray(raw)) return [];
  return raw.map((p, idx) => {
    const entities = {};
    const src = p?.entities && typeof p.entities === 'object' ? p.entities : {};
    for (const name of entityNames) {
      entities[name] = normalizeEntityRule(src[name]);
    }
    for (const [name, rule] of Object.entries(src)) {
      if (!entities[name]) entities[name] = normalizeEntityRule(rule);
    }
    const id = String(p?.id || `pol_tmp_${idx}`);
    return {
      id,
      name: String(p?.name || '').trim() || `Политика ${idx + 1}`,
      description: String(p?.description || '').trim(),
      enabled: p?.enabled !== false,
      priority: Number.isFinite(Number(p?.priority)) ? Number(p.priority) : 100,
      builtin: Boolean(p?.builtin) || id.startsWith('builtin_'),
      subjects: normalizeSubjects(p?.subjects),
      entities,
    };
  });
}

function newPolicy(entityNames) {
  const entities = {};
  for (const name of entityNames) {
    entities[name] = { row_scope: 'all', allowed_fields: null };
  }
  return {
    id: `pol_${Date.now().toString(36)}`,
    name: 'Новая политика',
    description: '',
    enabled: true,
    priority: 100,
    builtin: false,
    subjects: { ...DEFAULT_SUBJECTS },
    entities,
  };
}

function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function initials(label) {
  const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function Switch({ checked, onChange, disabled, label }) {
  return (
    <label className={styles.toggle}>
      {label ? <span className={styles.toggleLabel}>{label}</span> : null}
      <span className={styles.switch}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.switchTrack} />
        <span className={styles.switchThumb} />
      </span>
    </label>
  );
}

function SearchablePicker({
  items,
  selectedIds,
  onToggle,
  placeholder,
  disabled,
  emptyLabel = 'Ничего не выбрано',
}) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  const selectedItems = selectedIds
    .map((id) => byId.get(id))
    .filter(Boolean);

  return (
    <div className={styles.picker}>
      <input
        type="search"
        className={styles.pickerSearch}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <div className={styles.chips}>
        {selectedItems.length === 0 ? (
          <span className={styles.chipEmpty}>{emptyLabel}</span>
        ) : (
          selectedItems.map((item) => (
            <span key={item.id} className={styles.chip}>
              <span className={styles.chipText}>{item.label}</span>
              <button
                type="button"
                className={styles.chipRemove}
                disabled={disabled}
                aria-label={`Убрать ${item.label}`}
                onClick={() => onToggle(item.id)}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div className={styles.list} role="listbox" aria-multiselectable="true">
        {filtered.length === 0 ? (
          <div className={styles.listEmpty}>Ничего не найдено</div>
        ) : (
          filtered.map((item) => {
            const active = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                disabled={disabled}
                className={`${styles.listItem} ${active ? styles.listItemActive : ''}`}
                onClick={() => onToggle(item.id)}
              >
                <span className={styles.avatar} aria-hidden>{initials(item.label)}</span>
                <span>{item.label}</span>
                <span className={styles.checkMark} aria-hidden>✓</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function RolePicker({ options, selected, onToggle, disabled }) {
  return (
    <div className={styles.roleGrid}>
      {options.map((role) => {
        const active = selected.includes(role);
        return (
          <button
            key={role}
            type="button"
            disabled={disabled}
            className={`${styles.roleChip} ${active ? styles.roleChipActive : ''}`}
            onClick={() => onToggle(role)}
            aria-pressed={active}
          >
            {role}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Admin section to enable DataBridge, field allowlists, access, and visibility policies.
 */
export default function AdminDataBridgePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [entities, setEntities] = useState([]);
  const [access, setAccess] = useState(DEFAULT_ACCESS);
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [message, setMessage] = useState(null);
  const [expandedPolicyId, setExpandedPolicyId] = useState(null);

  const entityNames = useMemo(() => entities.map((e) => e.name), [entities]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, empList, teamList, deptList] = await Promise.all([
        adminService.getDatabridgeEntities(),
        employeeService.getEmployees().catch(() => []),
        teamService.getTeams().catch(() => []),
        employeeService.getDepartments().catch(() => []),
      ]);
      const nextEntities = data.entities || [];
      setEnabled(Boolean(data.enabled));
      setEntities(nextEntities);
      setAccess(normalizeAccess(data.access));
      setPolicies(
        normalizePolicies(
          data.visibility_policies,
          nextEntities.map((e) => e.name),
        ),
      );
      const fromAdmin = Array.isArray(data.departments) ? data.departments : [];
      const fromEmployees = Array.isArray(deptList)
        ? deptList
        : Array.isArray(deptList?.items)
          ? deptList.items
          : [];
      const deptById = new Map();
      for (const d of [...fromAdmin, ...fromEmployees]) {
        const id = Number(d?.id);
        if (!id || id < 1) continue;
        if (!deptById.has(id)) {
          deptById.set(id, { id, name: d.name || `Отдел ${id}` });
        }
      }
      setDepartments([...deptById.values()].sort((a, b) =>
        String(a.name).localeCompare(String(b.name), 'ru'),
      ));
      setEmployees(Array.isArray(empList) ? empList : []);
      setTeams(
        Array.isArray(teamList)
          ? teamList
          : Array.isArray(teamList?.items)
            ? teamList.items
            : [],
      );
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить настройки DataBridge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const employeeItems = useMemo(
    () => employees
      .filter((e) => e.team_role !== 'Guest')
      .map((e) => ({
        id: e.id,
        label: [e.name, e.email || e.login].filter(Boolean).join(' — ') || `ID ${e.id}`,
      })),
    [employees],
  );

  const teamItems = useMemo(
    () => teams.map((t) => ({ id: t.id, label: t.name || `Команда ${t.id}` })),
    [teams],
  );

  const departmentItems = useMemo(
    () => departments.map((d) => ({
      id: d.id,
      label: d.name || `Отдел ${d.id}`,
    })),
    [departments],
  );

  const updateEntity = (name, patch) => {
    setEntities((prev) => prev.map((e) => (e.name === name ? { ...e, ...patch } : e)));
  };

  const toggleField = (entityName, field) => {
    setEntities((prev) => prev.map((e) => {
      if (e.name !== entityName) return e;
      const all = e.all_fields || [];
      const current = e.allowed_fields == null ? [...all] : [...(e.allowed_fields || [])];
      const next = current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field];
      const allowed = next.length === all.length ? null : next;
      return { ...e, allowed_fields: allowed };
    }));
  };

  const patchAccess = (patch) => {
    setAccess((prev) => ({ ...prev, ...patch }));
  };

  const updatePolicy = (id, patch) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const patchPolicySubjects = (id, patch) => {
    setPolicies((prev) => prev.map((p) => (
      p.id === id ? { ...p, subjects: { ...p.subjects, ...patch } } : p
    )));
  };

  const patchPolicyEntity = (policyId, entityName, patch) => {
    setPolicies((prev) => prev.map((p) => {
      if (p.id !== policyId) return p;
      const current = p.entities[entityName] || { row_scope: 'all', allowed_fields: null };
      return {
        ...p,
        entities: {
          ...p.entities,
          [entityName]: { ...current, ...patch },
        },
      };
    }));
  };

  const togglePolicyField = (policyId, entityName, field, allFields) => {
    setPolicies((prev) => prev.map((p) => {
      if (p.id !== policyId) return p;
      const current = p.entities[entityName] || { row_scope: 'all', allowed_fields: null };
      const selected = current.allowed_fields == null
        ? [...allFields]
        : [...(current.allowed_fields || [])];
      const next = selected.includes(field)
        ? selected.filter((f) => f !== field)
        : [...selected, field];
      const allowed = next.length === allFields.length ? null : next;
      return {
        ...p,
        entities: {
          ...p.entities,
          [entityName]: { ...current, allowed_fields: allowed },
        },
      };
    }));
  };

  const addPolicy = () => {
    const policy = newPolicy(entityNames);
    setPolicies((prev) => [...prev, policy]);
    setExpandedPolicyId(policy.id);
  };

  const removePolicy = (id) => {
    setPolicies((prev) => prev.filter((p) => p.id !== id || p.builtin));
    if (expandedPolicyId === id) setExpandedPolicyId(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        enabled,
        access,
        entities: Object.fromEntries(
          entities.map((e) => [
            e.name,
            {
              enabled: Boolean(e.enabled),
              allowed_fields: e.allowed_fields,
            },
          ]),
        ),
        visibility_policies: policies.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          enabled: Boolean(p.enabled),
          priority: Number(p.priority) || 100,
          builtin: Boolean(p.builtin),
          subjects: p.subjects,
          entities: Object.fromEntries(
            Object.entries(p.entities || {}).map(([name, rule]) => [
              name,
              {
                row_scope: rule.row_scope || 'all',
                allowed_fields: rule.allowed_fields,
              },
            ]),
          ),
        })),
      };
      await adminService.saveDatabridgeConfig(payload);
      setMessage('Настройки DataBridge сохранены');
      await load();
    } catch (err) {
      console.error(err);
      setError('Ошибка сохранения DataBridge');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.loading}>
          <span className={styles.spinner} />
          Загрузка DataBridge…
        </div>
      </div>
    );
  }

  const restricted = access.mode === 'restricted';
  const accessDisabled = !enabled;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
          <div className={styles.headerIcon}>
            <AdminIcon name="dataModels" size="md" />
          </div>
          <div>
            <h3 className={styles.title}>DataBridge</h3>
            <p className={styles.subtitle}>
              Источник данных платформы для моделей. Права доступа — кто может подключить bridge;
              политики видимости — какой объём строк и полей материализуется.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={false}
          label={enabled ? 'Включён' : 'Выключен'}
          onChange={setEnabled}
        />
      </div>

      {error ? (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <AdminIcon name="error" size="sm" />
          {error}
        </div>
      ) : null}
      {message ? (
        <div className={`${styles.alert} ${styles.alertOk}`}>
          <AdminIcon name="success" size="sm" />
          {message}
        </div>
      ) : null}

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Права доступа</h4>
        <p className={styles.sectionHint}>
          Кто может использовать DataBridge как источник. Не путать с видимостью данных ниже.
        </p>

        <div className={styles.radioStack}>
          <label className={`${styles.radioCard} ${access.mode === 'all' ? styles.radioCardActive : ''}`}>
            <input
              type="radio"
              name="databridge-access-mode"
              checked={access.mode === 'all'}
              disabled={accessDisabled}
              onChange={() => patchAccess({ mode: 'all' })}
            />
            <span>
              <span className={styles.radioTitle}>Все сотрудники</span>
              <span className={styles.radioHint}>
                Любой сотрудник (кроме гостей) может выбрать DataBridge в модели данных.
              </span>
            </span>
          </label>
          <label className={`${styles.radioCard} ${restricted ? styles.radioCardActive : ''}`}>
            <input
              type="radio"
              name="databridge-access-mode"
              checked={restricted}
              disabled={accessDisabled}
              onChange={() => patchAccess({ mode: 'restricted' })}
            />
            <span>
              <span className={styles.radioTitle}>Только выбранные</span>
              <span className={styles.radioHint}>
                Доступ по сотруднику, команде или должности (достаточно одного совпадения).
              </span>
            </span>
          </label>
        </div>

        {restricted ? (
          <div className={styles.pickerGrid}>
            <div>
              <p className={styles.pickerColTitle}>Сотрудники</p>
              <SearchablePicker
                items={employeeItems}
                selectedIds={access.user_ids}
                placeholder="Поиск сотрудника…"
                disabled={accessDisabled}
                onToggle={(id) => patchAccess({ user_ids: toggleId(access.user_ids, id) })}
              />
            </div>
            <div>
              <p className={styles.pickerColTitle}>Команды</p>
              <SearchablePicker
                items={teamItems}
                selectedIds={access.team_ids}
                placeholder="Поиск команды…"
                disabled={accessDisabled}
                onToggle={(id) => patchAccess({ team_ids: toggleId(access.team_ids, id) })}
              />
            </div>
            <div>
              <p className={styles.pickerColTitle}>Должности</p>
              <RolePicker
                options={POSITION_OPTIONS}
                selected={access.team_roles}
                disabled={accessDisabled}
                onToggle={(role) => patchAccess({ team_roles: toggleId(access.team_roles, role) })}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h4 className={styles.sectionTitle}>Видимость данных</h4>
            <p className={styles.sectionHint}>
              Встроенные политики можно включать и выключать. Фильтр применяется при
              compile/materialize; несколько активных политик пересекаются.
            </p>
          </div>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={accessDisabled}
            onClick={addPolicy}
          >
            + Своя политика
          </button>
        </div>

        {policies.map((policy) => {
          const open = expandedPolicyId === policy.id;
          const subjects = policy.subjects || DEFAULT_SUBJECTS;
          return (
            <div
              key={policy.id}
              className={`${styles.policyCard} ${policy.enabled ? '' : styles.policyCardOff}`}
            >
              <div className={styles.policyTop}>
                <Switch
                  checked={Boolean(policy.enabled)}
                  disabled={accessDisabled}
                  onChange={(checked) => updatePolicy(policy.id, { enabled: checked })}
                />
                <span className={`${styles.badge} ${policy.enabled ? styles.badgeOn : styles.badgeOff}`}>
                  {policy.enabled ? 'Вкл' : 'Выкл'}
                </span>
                {policy.builtin ? (
                  <span className={`${styles.badge} ${styles.badgeBuiltin}`}>Встроенная</span>
                ) : null}
                <input
                  type="text"
                  className={styles.policyName}
                  value={policy.name}
                  disabled={accessDisabled || policy.builtin}
                  onChange={(e) => updatePolicy(policy.id, { name: e.target.value })}
                />
                <label className={styles.priorityField}>
                  priority
                  <input
                    type="number"
                    value={policy.priority}
                    disabled={accessDisabled}
                    onChange={(e) => updatePolicy(policy.id, {
                      priority: Number(e.target.value) || 0,
                    })}
                  />
                </label>
                <div className={styles.policyActions}>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => setExpandedPolicyId(open ? null : policy.id)}
                  >
                    {open ? 'Свернуть' : 'Настроить'}
                  </button>
                  {!policy.builtin ? (
                    <button
                      type="button"
                      className={`${styles.miniBtn} ${styles.miniBtnDanger}`}
                      disabled={accessDisabled}
                      onClick={() => removePolicy(policy.id)}
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>
              </div>
              {policy.description ? (
                <p className={styles.policyDesc}>{policy.description}</p>
              ) : null}

              {open ? (
                <div className={styles.policyBody}>
                  <div>
                    <p className={styles.pickerColTitle}>Субъекты</p>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={Boolean(subjects.all)}
                        disabled={accessDisabled}
                        onChange={(e) => patchPolicySubjects(policy.id, { all: e.target.checked })}
                      />
                      Все сотрудники (кроме гостей)
                    </label>
                    {!subjects.all ? (
                      <div className={styles.pickerGridFour}>
                        <div>
                          <p className={styles.pickerColTitle}>Сотрудники</p>
                          <SearchablePicker
                            items={employeeItems}
                            selectedIds={subjects.user_ids}
                            placeholder="Поиск…"
                            disabled={accessDisabled}
                            onToggle={(id) => patchPolicySubjects(policy.id, {
                              user_ids: toggleId(subjects.user_ids, id),
                            })}
                          />
                        </div>
                        <div>
                          <p className={styles.pickerColTitle}>Команды</p>
                          <SearchablePicker
                            items={teamItems}
                            selectedIds={subjects.team_ids}
                            placeholder="Поиск…"
                            disabled={accessDisabled}
                            onToggle={(id) => patchPolicySubjects(policy.id, {
                              team_ids: toggleId(subjects.team_ids, id),
                            })}
                          />
                        </div>
                        <div>
                          <p className={styles.pickerColTitle}>Отделы</p>
                          <SearchablePicker
                            items={departmentItems}
                            selectedIds={subjects.department_ids}
                            placeholder="Поиск…"
                            disabled={accessDisabled}
                            onToggle={(id) => patchPolicySubjects(policy.id, {
                              department_ids: toggleId(subjects.department_ids, id),
                            })}
                          />
                        </div>
                        <div>
                          <p className={styles.pickerColTitle}>Должности</p>
                          <RolePicker
                            options={POSITION_OPTIONS}
                            selected={subjects.team_roles}
                            disabled={accessDisabled}
                            onToggle={(role) => patchPolicySubjects(policy.id, {
                              team_roles: toggleId(subjects.team_roles, role),
                            })}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <p className={styles.pickerColTitle}>Правила по сущностям</p>
                    {entities.map((entity) => {
                      const rule = policy.entities[entity.name] || {
                        row_scope: 'all',
                        allowed_fields: null,
                      };
                      const allFields = entity.all_fields || [];
                      const selected = rule.allowed_fields == null
                        ? allFields
                        : (rule.allowed_fields || []);
                      return (
                        <div key={`${policy.id}-${entity.name}`} className={styles.entityRule}>
                          <div className={styles.entityRuleTop}>
                            <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>
                              {entity.label || entity.name}
                            </strong>
                            <select
                              value={rule.row_scope}
                              disabled={accessDisabled || !entity.enabled}
                              onChange={(e) => patchPolicyEntity(policy.id, entity.name, {
                                row_scope: e.target.value,
                              })}
                            >
                              {ROW_SCOPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          {entity.enabled && allFields.length > 0 ? (
                            <div className={styles.fieldChips}>
                              {allFields.map((field) => {
                                const on = selected.includes(field);
                                return (
                                  <label
                                    key={field}
                                    className={`${styles.fieldChip} ${on ? styles.fieldChipOn : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={accessDisabled}
                                      checked={on}
                                      onChange={() => togglePolicyField(
                                        policy.id,
                                        entity.name,
                                        field,
                                        allFields,
                                      )}
                                    />
                                    {field}
                                  </label>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Сущности и глобальные поля</h4>
        <p className={styles.sectionHint}>
          Глобальный потолок колонок для всех пользователей (до политик видимости).
        </p>
        {entities.map((entity) => {
          const allFields = entity.all_fields || [];
          const selected = entity.allowed_fields == null
            ? allFields
            : (entity.allowed_fields || []);
          return (
            <div key={entity.name} className={styles.entityBlock}>
              <label className={styles.checkRow} style={{ marginBottom: entity.enabled && enabled ? '0.65rem' : 0 }}>
                <input
                  type="checkbox"
                  checked={Boolean(entity.enabled)}
                  onChange={(e) => updateEntity(entity.name, { enabled: e.target.checked })}
                  disabled={!enabled}
                />
                <strong style={{ color: 'var(--color-text-primary)' }}>
                  {entity.label || entity.name}
                </strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                  ({entity.name})
                </span>
              </label>
              {entity.enabled && enabled ? (
                <div className={styles.fieldChips}>
                  {allFields.map((field) => {
                    const on = selected.includes(field);
                    return (
                      <label
                        key={field}
                        className={`${styles.fieldChip} ${on ? styles.fieldChipOn : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleField(entity.name, field)}
                        />
                        {field}
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Сохранение…' : 'Сохранить DataBridge'}
        </button>
      </div>
    </div>
  );
}
