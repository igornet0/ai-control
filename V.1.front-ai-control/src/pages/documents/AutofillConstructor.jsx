import React, { useState, useEffect, useMemo } from 'react';
import { documentService } from '../../services/documentService';
import { DocIcon } from './DocumentIcons';
import { isSpreadsheetTemplate } from './templateTypeUtils';
import f from './DocumentFolders.module.css';
import c from './DocumentConstructors.module.css';

const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** param — что спрашиваем у пользователя; describe — как правило выглядит в списке. */
const RULE_TYPES = [
  {
    value: 'constant',
    label: 'Постоянное значение',
    hint: 'Всегда подставляется одно и то же значение.',
    param: { key: 'value', label: 'Значение', kind: 'text', placeholder: 'Например, ООО «Ромашка»' },
    describe: (p) => <>значение <b>«{p.value ?? ''}»</b></>,
  },
  {
    value: 'current_date',
    label: 'Сегодняшняя дата',
    hint: 'Дата создания документа.',
    describe: () => 'сегодняшняя дата',
  },
  {
    value: 'current_datetime',
    label: 'Текущие дата и время',
    hint: 'Дата и время создания документа.',
    describe: () => 'текущие дата и время',
  },
  {
    value: 'date_offset',
    label: 'Дата со сдвигом',
    hint: 'Сегодня плюс или минус несколько дней — например, срок оплаты через 10 дней.',
    param: { key: 'days', label: 'Сдвиг, дней', kind: 'number', placeholder: '+10 или -3' },
    describe: (p) => {
      const d = Number(p.days) || 0;
      return <>сегодня <b>{d >= 0 ? `+${d}` : d} дн.</b></>;
    },
  },
  {
    value: 'next_weekday',
    label: 'Ближайший день недели',
    hint: 'Ближайший выбранный день недели после сегодняшнего.',
    param: { key: 'weekday', label: 'День недели', kind: 'weekday' },
    describe: (p) => <>ближайший <b>{WEEKDAYS[Number(p.weekday) || 0]}</b></>,
  },
  {
    value: 'doc_number',
    label: 'Номер документа',
    hint: 'Порядковый номер документа, можно с префиксом.',
    param: { key: 'prefix', label: 'Префикс', kind: 'text', placeholder: 'Например, ЗК-' },
    describe: (p) => (p.prefix ? <>номер с префиксом <b>«{p.prefix}»</b></> : 'номер документа'),
  },
  {
    value: 'from_previous',
    label: 'Из предыдущего документа',
    hint: 'Значение поля из последнего документа этого вида.',
    param: { key: 'field_name', label: 'Взять из поля', kind: 'field', placeholder: 'Имя поля' },
    describe: (p) => <>из прошлого документа, поле <b>«{p.field_name || '—'}»</b></>,
  },
  {
    value: 'formula',
    label: 'Формула',
    hint: 'Пока подставляет значение по умолчанию.',
    param: { key: 'default', label: 'Значение по умолчанию', kind: 'text' },
    describe: (p) => <>формула, по умолчанию <b>«{p.default ?? ''}»</b></>,
  },
];

const RULE_ICONS = {
  constant: 'tag',
  current_date: 'autofill',
  current_datetime: 'autofill',
  date_offset: 'autofill',
  next_weekday: 'autofill',
  doc_number: 'clipboard',
  from_previous: 'documentStack',
  formula: 'structure',
};

const emptyRule = () => ({ field_name: '', rule_type: 'constant', params: {} });

const rulesWord = (n) => {
  if (n % 10 === 1 && n % 100 !== 11) return 'правило';
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return 'правила';
  return 'правил';
};

function fieldNamesFromStructure(data) {
  const raw = data?.fields;
  const list = Array.isArray(raw) ? raw : (raw?.fields ? raw.fields : []);
  return list.map((x) => String(x?.name ?? '').trim()).filter(Boolean);
}

/**
 * «Автозаполнение»: правила, которыми заполняются поля нового документа по шаблону.
 * Слева шаблоны, справа правила выбранного шаблона и форма добавления.
 */
const AutofillConstructor = ({ templates, kinds }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [rules, setRules] = useState([]);
  const [fieldNames, setFieldNames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newRule, setNewRule] = useState(emptyRule);
  const [query, setQuery] = useState('');

  const selected = (templates || []).find((t) => String(t.id) === String(selectedTemplateId)) || null;

  useEffect(() => {
    setError(null);
    setNewRule(emptyRule());
    if (!selectedTemplateId) {
      setRules([]);
      setFieldNames([]);
      return;
    }
    setLoading(true);
    const kindId = selected?.document_kind_id;
    Promise.all([
      documentService.getRulesByTemplateId(selectedTemplateId).catch(() => []),
      kindId ? documentService.getStructureByKindId(kindId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([data, structure]) => {
        setRules(Array.isArray(data) ? data : []);
        setFieldNames(fieldNamesFromStructure(structure));
      })
      .finally(() => setLoading(false));
  }, [selectedTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = RULE_TYPES.find((r) => r.value === newRule.rule_type) || RULE_TYPES[0];

  const reloadRules = async () => {
    const data = await documentService.getRulesByTemplateId(selectedTemplateId);
    setRules(Array.isArray(data) ? data : []);
  };

  const addRule = async (e) => {
    e?.preventDefault();
    const fieldName = newRule.field_name.trim();
    if (!fieldName) {
      setError('Укажите поле, которое нужно заполнять');
      return;
    }
    const params = { ...newRule.params };
    if (meta.param?.kind === 'number') params[meta.param.key] = Number(params[meta.param.key]) || 0;
    if (meta.param?.kind === 'weekday') params[meta.param.key] = Number(params[meta.param.key]) || 0;
    setSaving(true);
    setError(null);
    try {
      await documentService.createRule({
        template_id: parseInt(selectedTemplateId, 10),
        field_name: fieldName,
        rule_type: newRule.rule_type,
        params,
      });
      await reloadRules();
      setNewRule(emptyRule());
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось добавить правило');
    } finally {
      setSaving(false);
    }
  };

  const removeRule = async (rule) => {
    if (!window.confirm(`Удалить правило для поля «${rule.field_name}»?`)) return;
    setSaving(true);
    setError(null);
    try {
      await documentService.deleteRule(rule.id);
      await reloadRules();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить правило');
    } finally {
      setSaving(false);
    }
  };

  const setParam = (key, value) => setNewRule((prev) => ({ ...prev, params: { ...prev.params, [key]: value } }));

  const kindName = (kindId) => (kinds || []).find((k) => k.id === kindId)?.name || '';

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const list = (templates || []).filter((t) => !q || String(t.name).toLowerCase().includes(q));
    return [
      { id: 'docs', label: 'Шаблоны документов', icon: 'templateDocument', items: list.filter((t) => !isSpreadsheetTemplate(t)) },
      { id: 'tables', label: 'Шаблоны таблиц', icon: 'templateTable', items: list.filter((t) => isSpreadsheetTemplate(t)) },
    ];
  }, [templates, q]);

  if (!templates?.length) {
    return (
      <div className={f.emptyPane}>
        <span className={f.emptyIcon} aria-hidden><DocIcon name="autofill" size={24} /></span>
        <p className={f.emptyTitle}>Нет шаблонов</p>
        <p>Создайте шаблон документа или таблицы — затем здесь можно задать, какие поля заполнять автоматически.</p>
      </div>
    );
  }

  const renderParamInput = () => {
    const param = meta.param;
    if (!param) return null;
    const value = newRule.params?.[param.key] ?? '';
    let control;
    if (param.kind === 'weekday') {
      control = (
        <select className={c.select} value={value === '' ? 0 : value} onChange={(e) => setParam(param.key, e.target.value)}>
          {WEEKDAYS.map((d, i) => <option key={d} value={i}>{WEEKDAYS_SHORT[i]} — {d}</option>)}
        </select>
      );
    } else {
      control = (
        <input
          className={c.input}
          type={param.kind === 'number' ? 'number' : 'text'}
          value={value}
          placeholder={param.placeholder || ''}
          onChange={(e) => setParam(param.key, e.target.value)}
          list={param.kind === 'field' ? 'autofill-field-names' : undefined}
        />
      );
    }
    return (
      <label className={c.formField}>
        <span>{param.label}</span>
        {control}
      </label>
    );
  };

  const renderOverview = () => (
    <>
      <div className={f.paneHead}>
        <span className={f.headIcon} aria-hidden><DocIcon name="autofill" size={20} /></span>
        <div className={f.headText}>
          <h2 className={f.title}>Автозаполнение</h2>
          <p className={f.headMeta}>Выберите шаблон и задайте, какие поля нового документа заполнять автоматически</p>
        </div>
      </div>
      {groups.map((g) => (g.items.length > 0 && (
        <section key={g.id} className={f.block}>
          <h4 className={f.sectionLabel}>
            <DocIcon name={g.icon} size={14} /> {g.label}
            <span className={f.sectionCount}>{g.items.length}</span>
          </h4>
          <ul className={f.folderGrid}>
            {g.items.map((t) => (
              <li key={t.id}>
                <button type="button" className={f.folderTile} onClick={() => setSelectedTemplateId(String(t.id))} title={t.name}>
                  <span className={f.folderTileIcon} aria-hidden><DocIcon name={g.icon} size={18} /></span>
                  <span className={f.folderTileText}>
                    <span className={f.folderTileName}>{t.name}</span>
                    <span className={f.folderTileMeta}>{kindName(t.document_kind_id) || 'Шаблон'}</span>
                  </span>
                  <span className={f.folderTileChevron} aria-hidden><DocIcon name="chevronRight" size={14} /></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )))}
    </>
  );

  const renderTemplate = () => {
    const ruleMeta = (r) => RULE_TYPES.find((t) => t.value === r.rule_type);
    return (
      <>
        <div className={f.paneHead}>
          <button
            type="button"
            className={f.backBtn}
            onClick={() => setSelectedTemplateId('')}
            aria-label="Ко всем шаблонам"
            title="Все шаблоны"
          >
            <DocIcon name="chevronLeft" size={18} />
          </button>
          <span className={f.headIcon} aria-hidden>
            <DocIcon name={selected && isSpreadsheetTemplate(selected) ? 'templateTable' : 'templateDocument'} size={20} />
          </span>
          <div className={f.headText}>
            <nav className={f.crumbs} aria-label="Путь">
              <button type="button" className={f.crumb} onClick={() => setSelectedTemplateId('')}>Все шаблоны</button>
            </nav>
            <h2 className={f.title}>{selected?.name || `Шаблон #${selectedTemplateId}`}</h2>
            <p className={f.headMeta}>
              {loading ? 'Загрузка…' : `${rules.length} ${rulesWord(rules.length)}`}
              {selected && kindName(selected.document_kind_id) ? ` · вид «${kindName(selected.document_kind_id)}»` : ''}
            </p>
          </div>
        </div>

        <p className={c.note}>
          <DocIcon name="autofill" size={16} />
          <span>Правила срабатывают при создании документа по этому шаблону и заполняют поля до того, как вы откроете редактор.</span>
        </p>

        {error && <div className={c.inlineError} role="alert">{error}</div>}

        <section>
          <h4 className={f.sectionLabel}>
            Правила
            {rules.length > 0 && <span className={f.sectionCount}>{rules.length}</span>}
          </h4>
          {loading ? (
            <div className={f.emptyPane}><p>Загрузка правил…</p></div>
          ) : rules.length === 0 ? (
            <div className={f.emptyPane}>
              <span className={f.emptyIcon} aria-hidden><DocIcon name="autofill" size={24} /></span>
              <p className={f.emptyTitle}>Правил пока нет</p>
              <p>Добавьте первое правило ниже — например, «Дата документа» = сегодняшняя дата.</p>
            </div>
          ) : (
            <ul className={c.ruleList}>
              {rules.map((r) => {
                const m = ruleMeta(r);
                return (
                  <li key={r.id} className={c.ruleRow}>
                    <span className={c.ruleIcon} aria-hidden><DocIcon name={RULE_ICONS[r.rule_type] || 'autofill'} size={16} /></span>
                    <span className={c.ruleText}>
                      <span className={c.ruleField}>{r.field_name}</span>
                      <span className={c.ruleDesc}>
                        {m ? m.describe(r.params || {}) : r.rule_type}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={c.iconBtn}
                      onClick={() => removeRule(r)}
                      disabled={saving}
                      aria-label={`Удалить правило для ${r.field_name}`}
                      title="Удалить правило"
                    >
                      <DocIcon name="trash" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form className={c.addCard} onSubmit={addRule}>
          <h4 className={c.addTitle}>Новое правило</h4>
          <div className={c.addGrid}>
            <label className={c.formField}>
              <span>Поле</span>
              <input
                className={c.input}
                value={newRule.field_name}
                onChange={(e) => setNewRule((p) => ({ ...p, field_name: e.target.value }))}
                placeholder={fieldNames.length ? 'Выберите или введите поле' : 'Имя поля'}
                list="autofill-field-names"
              />
            </label>
            <label className={c.formField}>
              <span>Чем заполнить</span>
              <select
                className={c.select}
                value={newRule.rule_type}
                onChange={(e) => setNewRule((p) => ({ ...p, rule_type: e.target.value, params: {} }))}
              >
                {RULE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            {renderParamInput()}
          </div>
          <datalist id="autofill-field-names">
            {fieldNames.map((name) => <option key={name} value={name} />)}
          </datalist>
          <div className={c.addFooter}>
            <p className={c.ruleHint}>{meta.hint}</p>
            <button type="submit" className={f.primaryBtn} disabled={saving || !newRule.field_name.trim()}>
              {saving ? 'Добавление…' : 'Добавить правило'}
            </button>
          </div>
        </form>
      </>
    );
  };

  return (
    <div className={f.shell}>
      <div className={f.layout}>
        <nav className={f.tree} aria-label="Шаблоны">
          {templates.length > 6 && (
            <div className={c.listSearch}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Найти шаблон…"
                aria-label="Найти шаблон"
              />
            </div>
          )}
          <button
            type="button"
            className={`${f.treeAll} ${!selectedTemplateId ? f.treeItemActive : ''}`}
            onClick={() => setSelectedTemplateId('')}
          >
            <DocIcon name="autofill" size={16} /> Все шаблоны
          </button>
          {groups.map((g) => (
            <React.Fragment key={g.id}>
              <p className={c.listLabel}>{g.label}</p>
              {g.items.length === 0 ? (
                <p className={c.listEmpty}>{q ? 'Ничего не найдено' : 'Нет шаблонов'}</p>
              ) : (
                <ul className={f.treeList}>
                  {g.items.map((t) => {
                    const active = String(t.id) === String(selectedTemplateId);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          className={`${f.treeItem} ${active ? f.treeItemActive : ''}`}
                          onClick={() => setSelectedTemplateId(String(t.id))}
                          aria-current={active ? 'true' : undefined}
                          title={t.name}
                        >
                          <span className={f.treeItemIcon} aria-hidden><DocIcon name={g.icon} size={15} /></span>
                          <span className={f.treeItemName}>{t.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </React.Fragment>
          ))}
        </nav>
        <div className={f.pane}>
          {selectedTemplateId ? renderTemplate() : renderOverview()}
        </div>
      </div>
    </div>
  );
};

export default AutofillConstructor;
