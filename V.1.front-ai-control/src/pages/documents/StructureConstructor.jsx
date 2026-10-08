import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { documentService } from '../../services/documentService';
import TableFieldColumnsEditor from './TableFieldColumnsEditor';
import StructureFieldDefaultInput from './StructureFieldDefaultInput';
import { DocIcon } from './DocumentIcons';
import { copyDefaultTableColumns } from './documentTableColumns';
import { isSpreadsheetTemplate } from './templateTypeUtils';
import {
  normalizeStructureFieldsForSave,
  validateStructureFields,
  mergeFieldsWithTemplateDefaults,
  buildTemplateDefaultValuesFromFields,
} from './structureFieldUtils';
import f from './DocumentFolders.module.css';
import c from './DocumentConstructors.module.css';

const FIELD_TYPES = [
  { value: 'string', label: 'Строка', badge: 'Aa' },
  { value: 'number', label: 'Число', badge: '123' },
  { value: 'date', label: 'Дата', badge: '31' },
  { value: 'table', label: 'Таблица', badge: '▦' },
  { value: 'boolean', label: 'Да/Нет', badge: '✓' },
];

let fieldKeySeq = 0;
const withKey = (field) => ({ ...field, _key: `f${(fieldKeySeq += 1)}` });
const stripKeys = (list) => list.map(({ _key, ...rest }) => rest);

/** Поля из ответа API → в порядке order, с клиентскими ключами для React. */
function prepareFields(rawFields, templateDefaults) {
  const merged = mergeFieldsWithTemplateDefaults(rawFields, templateDefaults);
  return merged
    .map((field, i) => ({ field, i }))
    .sort((a, b) => (Number(a.field.order) || a.i + 1) - (Number(b.field.order) || b.i + 1))
    .map(({ field }, i) => withKey({ ...field, order: i + 1 }));
}

const fieldsFromStructure = (data) => {
  const raw = data?.fields;
  return Array.isArray(raw) ? raw : (raw?.fields ? raw.fields : []);
};

const fieldsWord = (n) => {
  if (n % 10 === 1 && n % 100 !== 11) return 'поле';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return 'поля';
  return 'полей';
};

/**
 * «Структура»: поля вида документа (тип, обязательность, значение по умолчанию, порядок).
 * Слева список видов, справа поля выбранного вида.
 */
const StructureConstructor = ({ kinds, templates = [], initialKindId, onPreselectConsumed }) => {
  const [selectedKindId, setSelectedKindId] = useState(initialKindId || '');
  const [structure, setStructure] = useState(null);
  const [fields, setFields] = useState([]);
  const [kindTemplates, setKindTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const baselineRef = useRef(null);
  const focusNewRef = useRef(false);

  useEffect(() => {
    if (initialKindId && initialKindId !== selectedKindId) {
      setSelectedKindId(initialKindId);
      onPreselectConsumed?.();
    }
  }, [initialKindId]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyLoaded = useCallback((data, tplList, templateDefaults) => {
    focusNewRef.current = false;
    setStructure(data);
    setKindTemplates(tplList);
    const prepared = prepareFields(fieldsFromStructure(data), templateDefaults);
    setFields(prepared);
    baselineRef.current = JSON.stringify(stripKeys(prepared));
  }, []);

  useEffect(() => {
    baselineRef.current = null;
    setError(null);
    if (!selectedKindId) {
      setStructure(null);
      setKindTemplates([]);
      setFields([]);
      return;
    }
    setLoading(true);
    Promise.all([
      documentService.getStructureByKindId(selectedKindId),
      documentService.getTemplates(parseInt(selectedKindId, 10)),
    ])
      .then(([data, tpls]) => {
        const tplList = Array.isArray(tpls) ? tpls : [];
        applyLoaded(data, tplList, tplList[0]?.default_values ?? {});
      })
      .catch(() => {
        setStructure(null);
        setKindTemplates([]);
        setFields([]);
        baselineRef.current = JSON.stringify([]);
      })
      .finally(() => setLoading(false));
  }, [selectedKindId, applyLoaded]);

  const dirty = baselineRef.current != null && JSON.stringify(stripKeys(fields)) !== baselineRef.current;

  const selectKind = (id) => {
    if (String(id) === String(selectedKindId)) return;
    if (dirty && !window.confirm('Структура не сохранена. Перейти без сохранения?')) return;
    setSelectedKindId(id === '' ? '' : String(id));
  };

  const addField = () => {
    focusNewRef.current = true;
    setFields((prev) => [...prev, withKey({ name: '', type: 'string', required: false, order: prev.length + 1 })]);
  };

  const updateField = (index, key, value) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const handleFieldTypeChange = (index, newType) => {
    setFields((prev) => {
      const next = [...prev];
      const cur = { ...next[index], type: newType };
      if (newType === 'table' && (!cur.columns || !cur.columns.length)) {
        cur.columns = copyDefaultTableColumns();
      }
      next[index] = cur;
      return next;
    });
  };

  const moveField = (index, delta) => {
    setFields((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((field, i) => ({ ...field, order: i + 1 }));
    });
  };

  const revertChanges = () => {
    if (baselineRef.current == null) return;
    setError(null);
    setFields(JSON.parse(baselineRef.current).map(withKey));
  };

  const removeField = (index) => {
    const name = fields[index]?.name?.trim();
    if (name && !window.confirm(`Удалить поле «${name}»?`)) return;
    setFields((prev) => prev.filter((_, i) => i !== index).map((field, i) => ({ ...field, order: i + 1 })));
  };

  const saveStructure = async () => {
    if (!selectedKindId) return;
    const clean = stripKeys(fields);
    if (clean.some((field) => !String(field.name ?? '').trim())) {
      setError('У каждого поля должно быть имя.');
      return;
    }
    const err = validateStructureFields(clean);
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    setError(null);
    const normalized = normalizeStructureFieldsForSave(clean);
    const payload = { fields: { fields: normalized } };
    try {
      if (structure?.id) {
        await documentService.updateStructure(structure.id, payload);
      } else {
        await documentService.createStructure({
          document_kind_id: parseInt(selectedKindId, 10),
          fields: payload.fields,
        });
      }
      const defaultValues = buildTemplateDefaultValuesFromFields(normalized);
      if (kindTemplates.length > 0) {
        await Promise.all(
          kindTemplates.map((t) => documentService.updateTemplate(t.id, { default_values: defaultValues })),
        );
      }
      const [data, tpls] = await Promise.all([
        documentService.getStructureByKindId(selectedKindId),
        documentService.getTemplates(parseInt(selectedKindId, 10)),
      ]);
      applyLoaded(data, Array.isArray(tpls) ? tpls : [], defaultValues);
    } catch (e) {
      setError(e.response?.data?.detail || 'Не удалось сохранить структуру');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+S — сохранить.
  useEffect(() => {
    if (!selectedKindId) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'ы')) {
        e.preventDefault();
        if (dirty && !saving) saveStructure();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const templatesByKind = useMemo(() => {
    const map = new Map();
    (templates || []).forEach((t) => {
      if (!map.has(t.document_kind_id)) map.set(t.document_kind_id, []);
      map.get(t.document_kind_id).push(t);
    });
    return map;
  }, [templates]);

  const q = query.trim().toLowerCase();
  const visibleKinds = useMemo(
    () => (kinds || []).filter((k) => !q || String(k.name).toLowerCase().includes(q)),
    [kinds, q],
  );
  const selectedKind = (kinds || []).find((k) => String(k.id) === String(selectedKindId)) || null;

  if (!kinds?.length) {
    return (
      <div className={f.emptyPane}>
        <span className={f.emptyIcon} aria-hidden><DocIcon name="structure" size={24} /></span>
        <p className={f.emptyTitle}>Нет видов документов</p>
        <p>Создайте шаблон документа — вместе с ним появится вид, и здесь можно будет настроить его поля.</p>
      </div>
    );
  }

  const kindIsTable = (k) => (templatesByKind.get(k.id) || []).some((t) => isSpreadsheetTemplate(t));
  const kindIcon = (k) => (kindIsTable(k) ? 'templateTable' : 'templateDocument');
  const kindMeta = (k) => {
    const n = (templatesByKind.get(k.id) || []).length;
    if (!n) return 'Без шаблонов';
    const type = kindIsTable(k) ? 'Таблица' : 'Документ';
    return n === 1 ? type : `${type} · шаблонов: ${n}`;
  };

  const renderOverview = () => (
    <>
      <div className={f.paneHead}>
        <span className={f.headIcon} aria-hidden><DocIcon name="structure" size={20} /></span>
        <div className={f.headText}>
          <h2 className={f.title}>Структура документов</h2>
          <p className={f.headMeta}>Выберите вид документа, чтобы настроить его поля: тип, обязательность и значение по умолчанию</p>
        </div>
      </div>
      <ul className={f.folderGrid}>
        {visibleKinds.map((k) => (
          <li key={k.id}>
            <button type="button" className={f.folderTile} onClick={() => selectKind(k.id)} title={k.name}>
              <span className={f.folderTileIcon} aria-hidden><DocIcon name={kindIcon(k)} size={18} /></span>
              <span className={f.folderTileText}>
                <span className={f.folderTileName}>{k.name}</span>
                <span className={f.folderTileMeta}>{kindMeta(k)}</span>
              </span>
              <span className={f.folderTileChevron} aria-hidden><DocIcon name="chevronRight" size={14} /></span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  const renderField = (field, i) => {
    const type = FIELD_TYPES.find((t) => t.value === (field.type || 'string')) || FIELD_TYPES[0];
    return (
      <li key={field._key} className={c.fieldCard}>
        <div className={c.fieldMain}>
          <div className={c.reorder}>
            <button
              type="button"
              className={c.reorderBtn}
              onClick={() => moveField(i, -1)}
              disabled={i === 0}
              aria-label="Поднять поле"
              title="Выше"
            >
              <DocIcon name="chevronUp" size={12} />
            </button>
            <button
              type="button"
              className={c.reorderBtn}
              onClick={() => moveField(i, 1)}
              disabled={i === fields.length - 1}
              aria-label="Опустить поле"
              title="Ниже"
            >
              <DocIcon name="chevronDown" size={12} />
            </button>
          </div>
          <span className={`${c.typeBadge} ${c[`typeBadge_${type.value}`] || ''}`} title={type.label} aria-hidden>
            {type.value === 'table' ? <DocIcon name="grid" size={15} /> : type.badge}
          </span>
          <input
            type="text"
            value={field.name || ''}
            onChange={(e) => updateField(i, 'name', e.target.value)}
            placeholder="Название поля, например «Контрагент»"
            className={`${c.input} ${c.nameInput}`}
            aria-label="Название поля"
            autoFocus={focusNewRef.current && i === fields.length - 1}
          />
          <select
            value={field.type || 'string'}
            onChange={(e) => handleFieldTypeChange(i, e.target.value)}
            className={`${c.select} ${c.typeSelect}`}
            aria-label="Тип поля"
          >
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className={`${c.requiredToggle} ${field.required ? c.requiredOn : ''}`} title="Без значения документ нельзя сохранить">
            <input
              type="checkbox"
              checked={!!field.required}
              onChange={(e) => updateField(i, 'required', e.target.checked)}
            />
            Обязательное
          </label>
          <button
            type="button"
            className={c.iconBtn}
            onClick={() => removeField(i)}
            aria-label={`Удалить поле ${field.name || ''}`.trim()}
            title="Удалить поле"
          >
            <DocIcon name="trash" size={16} />
          </button>
        </div>
        <div className={c.fieldExtra}>
          <span className={c.fieldExtraLabel}>По умолчанию</span>
          <StructureFieldDefaultInput field={field} onCommit={(value) => updateField(i, 'default', value)} />
        </div>
        {field.type === 'table' && (
          <div className={c.columnsPanel}>
            <TableFieldColumnsEditor
              columns={field.columns}
              onChange={(cols) => updateField(i, 'columns', cols)}
            />
          </div>
        )}
      </li>
    );
  };

  const renderKind = () => {
    const tplNote = kindTemplates.length === 1
      ? `Значения по умолчанию подставляются при создании документа по шаблону «${kindTemplates[0].name}».`
      : kindTemplates.length > 1
        ? `Значения по умолчанию подставляются при создании документа по любому из ${kindTemplates.length} шаблонов этого вида.`
        : 'У вида пока нет шаблонов — значения по умолчанию сохранятся и применятся, когда шаблон появится.';
    return (
      <>
        <div className={f.paneHead}>
          <button
            type="button"
            className={f.backBtn}
            onClick={() => selectKind('')}
            aria-label="Ко всем видам документов"
            title="Все виды"
          >
            <DocIcon name="chevronLeft" size={18} />
          </button>
          <span className={f.headIcon} aria-hidden>
            <DocIcon name={selectedKind ? kindIcon(selectedKind) : 'templateDocument'} size={20} />
          </span>
          <div className={f.headText}>
            <nav className={f.crumbs} aria-label="Путь">
              <button type="button" className={f.crumb} onClick={() => selectKind('')}>Все виды</button>
            </nav>
            <h2 className={f.title}>{selectedKind?.name || `Вид #${selectedKindId}`}</h2>
            <p className={f.headMeta}>
              {loading ? 'Загрузка…' : `${fields.length} ${fieldsWord(fields.length)}`}
              {kindTemplates.length > 0 && ` · шаблонов: ${kindTemplates.length}`}
            </p>
          </div>
          <div className={f.headActions}>
            <button
              type="button"
              className={f.primaryBtn}
              onClick={saveStructure}
              disabled={saving || !dirty}
              style={!dirty ? { opacity: 0.55, boxShadow: 'none', cursor: 'default' } : undefined}
              title={dirty ? 'Сохранить (Ctrl+S)' : 'Изменений нет'}
            >
              <DocIcon name="save" size={16} /> Сохранить
            </button>
          </div>
        </div>

        <p className={c.note}>
          <DocIcon name="templateDocument" size={16} />
          <span>{tplNote}</span>
        </p>

        {error && <div className={c.inlineError} role="alert">{error}</div>}

        {loading ? (
          <div className={f.emptyPane}><p>Загрузка полей…</p></div>
        ) : (
          <section>
            <div className={c.sectionRow}>
              <h4 className={f.sectionLabel}>
                Поля
                {fields.length > 0 && <span className={f.sectionCount}>{fields.length}</span>}
              </h4>
            </div>
            {fields.length === 0 ? (
              <div className={f.emptyPane}>
                <span className={f.emptyIcon} aria-hidden><DocIcon name="structure" size={24} /></span>
                <p className={f.emptyTitle}>Полей пока нет</p>
                <p>Добавьте поля, которые нужно заполнять в документах этого вида.</p>
                <div className={f.emptyActions}>
                  <button type="button" className={f.primaryBtn} onClick={addField}>Добавить поле</button>
                </div>
              </div>
            ) : (
              <>
                <ul className={c.fieldList}>{fields.map(renderField)}</ul>
                <button type="button" className={c.addFieldBtn} onClick={addField}>
                  <DocIcon name="filePlus" size={16} /> Добавить поле
                </button>
              </>
            )}
          </section>
        )}

        {dirty && (
          <div className={c.saveBar} role="status">
            <span className={c.saveBarText}>
              Есть несохранённые изменения
              <small>Ctrl+S</small>
            </span>
            <button type="button" className={f.ghostBtn} onClick={revertChanges} disabled={saving}>
              Отменить
            </button>
            <button type="button" className={f.primaryBtn} onClick={saveStructure} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={f.shell}>
      <div className={f.layout}>
        <nav className={f.tree} aria-label="Виды документов">
          {kinds.length > 6 && (
            <div className={c.listSearch}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти вид…"
                aria-label="Найти вид документа"
              />
            </div>
          )}
          <button
            type="button"
            className={`${f.treeAll} ${!selectedKindId ? f.treeItemActive : ''}`}
            onClick={() => selectKind('')}
          >
            <DocIcon name="structure" size={16} /> Все виды
          </button>
          <p className={c.listLabel}>Виды документов</p>
          {visibleKinds.length === 0 ? (
            <p className={c.listEmpty}>Ничего не найдено</p>
          ) : (
            <ul className={f.treeList}>
              {visibleKinds.map((k) => {
                const active = String(k.id) === String(selectedKindId);
                return (
                  <li key={k.id}>
                    <button
                      type="button"
                      className={`${f.treeItem} ${active ? f.treeItemActive : ''}`}
                      onClick={() => selectKind(k.id)}
                      aria-current={active ? 'true' : undefined}
                      title={k.name}
                    >
                      <span className={f.treeItemIcon} aria-hidden><DocIcon name={kindIcon(k)} size={15} /></span>
                      <span className={f.treeItemName}>{k.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
        <div className={f.pane}>
          {selectedKindId ? renderKind() : renderOverview()}
        </div>
      </div>
    </div>
  );
};

export default StructureConstructor;
