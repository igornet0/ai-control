/**
 * Модальное окно редактора формул BI: 3 зоны (источники → редактор → конструктор/справка).
 * Расширяемость: FORMULA_FUNCTION_REGISTRY, кастомные вставки через options.extendTemplates.
 */
import { getDashboardSchema } from '../../../../services/dashboardSqliteSchemaService.js';
import { svgCross } from '../../icons/dashboardCreaterIcons.js';
import { formatFormulaError } from './errors.js';
import { runSingleFormulaOnDashboard } from './runDashboard.js';
import { resolvePreviewExecutionContext } from './formulaInference.js';
import {
    formulaForScalarPreview,
    validateEditorFormula,
} from './editorFormulaValidate.js';

/** @typedef {{ id: string, label: string, template: string, description?: string }} FormulaFnTemplate */

/** Реестр функций для UI (можно дополнять извне). */
export const FORMULA_FUNCTION_REGISTRY = [
    {
        id: 'sum',
        label: 'SUM',
        template: 'SUM([TABLE.FIELD])',
        description: 'Сумма по колонке',
    },
    {
        id: 'sum_for',
        label: 'SUM FOR',
        template: 'SUM([TABLE.FIELD]) FOR [TABLE.FIELD]',
        description: 'Сумма по группам: уникальные значения поля FOR и SUM в каждой группе',
    },
    {
        id: 'sum_where',
        label: 'SUM WHERE',
        template: 'SUM([TABLE.FIELD] WHERE [TABLE.FIELD] = 0)',
        description: 'Сумма с условием WHERE (AND с фильтрами дашборда)',
    },
    {
        id: 'sum_where_in',
        label: 'SUM IN',
        template: 'SUM([TABLE.FIELD] WHERE [TABLE.FIELD] IN (0, 1))',
        description: 'Сумма с IN (…)',
    },
    {
        id: 'sum_where_like',
        label: 'SUM LIKE',
        template: 'SUM([TABLE.FIELD] WHERE [TABLE.FIELD] LIKE "%text%")',
        description: 'Сумма с LIKE ( * → % )',
    },
    {
        id: 'sum_where_or',
        label: 'SUM OR',
        template: 'SUM([TABLE.FIELD] WHERE [TABLE.A] = 1 OR [TABLE.B] = 2)',
        description: 'Сумма с OR (AND сильнее OR; скобки разрешены)',
    },
    {
        id: 'avg',
        label: 'AVG',
        template: 'AVG([TABLE.FIELD])',
        description: 'Среднее',
    },
    {
        id: 'count',
        label: 'COUNT',
        template: 'COUNT([TABLE.FIELD])',
        description: 'Число строк / непустых значений',
    },
    {
        id: 'count_star',
        label: 'COUNT(*)',
        template: 'COUNT(*)',
        description: 'Число строк после фильтров',
    },
    {
        id: 'min',
        label: 'MIN',
        template: 'MIN([TABLE.FIELD])',
        description: 'Минимум (число или дата)',
    },
    {
        id: 'max',
        label: 'MAX',
        template: 'MAX([TABLE.FIELD])',
        description: 'Максимум (число или дата)',
    },
    {
        id: 'count_distinct',
        label: 'COUNT_DISTINCT',
        template: 'COUNT_DISTINCT([TABLE.FIELD])',
        description: 'Число уникальных значений',
    },
    {
        id: 'if',
        label: 'IF',
        template: 'IF([TABLE.FIELD]="value", RGB(34, 197, 94), None)',
        description: 'Условие: IF(условие, тогда, иначе). Можно вкладывать IF',
    },
    {
        id: 'rgb',
        label: 'RGB',
        template: 'RGB(150, 34, 35)',
        description: 'Цвет RGB(r, g, b) → #hex',
    },
    {
        id: 'match',
        label: 'MATCH',
        template:
            'MATCH [TABLE.FIELD] {\n  CASE "paid" { RGB(34, 197, 94) }\n  CASE "failed" { RGB(248, 113, 113) }\n  ELSE { None }\n}',
        description: 'Сопоставление значений: MATCH поле { CASE "x" { … } }',
    },
    {
        id: 'model_var',
        label: '@variable',
        template: '@sum_amount_sum',
        description: 'Скалярная переменная модели. Меняется локально кнопкой «Переменная модели»',
    },
];

const DEBOUNCE_MS = 140;

/**
 * @param {string} [schemaType]
 * @returns {'number'|'string'|'date'}
 */
export function mapSchemaTypeToBucket(schemaType) {
    const s = String(schemaType || '').toLowerCase();
    if (
        s.includes('int') ||
        s.includes('real') ||
        s.includes('flo') ||
        s.includes('double') ||
        s.includes('num') ||
        s === 'number' ||
        s === 'integer'
    ) {
        return 'number';
    }
    if (s.includes('date') || s.includes('time') || s === 'timestamp') {
        return 'date';
    }
    return 'string';
}

/**
 * Находит `$[…]` / `[…]` вокруг позиции курсора (для выделения плейсхолдера поля).
 * @param {string} text
 * @param {number} pos
 * @returns {{ start: number, end: number, text: string } | null}
 */
export function findBracketFieldSpanAt(text, pos) {
    const s = String(text ?? '');
    const n = s.length;
    let i = Math.max(0, Math.min(Number(pos) || 0, n));
    // Клик сразу после «]» — считаем, что попали в этот токен
    if (i > 0 && s[i - 1] === ']') {
        i -= 1;
    }
    let open = -1;
    for (let j = i; j >= 0; j -= 1) {
        if (s[j] === ']' && j < i) break;
        if (s[j] === '[') {
            open = j;
            break;
        }
    }
    if (open < 0) return null;
    let start = open;
    if (open > 0 && s[open - 1] === '$') start = open - 1;
    let close = -1;
    for (let j = open + 1; j < n; j += 1) {
        if (s[j] === '[') break;
        if (s[j] === ']') {
            close = j;
            break;
        }
    }
    if (close < 0) return null;
    if (pos < start || pos > close + 1) return null;
    return { start, end: close + 1, text: s.slice(start, close + 1) };
}

/**
 * Первый плейсхолдер шаблона `[TABLE.…]` / `$[TABLE.…]` начиная с from.
 * @param {string} text
 * @param {number} [from]
 * @returns {{ start: number, end: number, text: string } | null}
 */
export function findNextTableFieldPlaceholder(text, from = 0) {
    const s = String(text ?? '');
    const startAt = Math.max(0, Number(from) || 0);
    const re = /\$?\[[^\]]*TABLE\.[^\]]*\]/g;
    re.lastIndex = startAt;
    const m = re.exec(s);
    if (!m) {
        // wrap from start if none after cursor
        if (startAt > 0) return findNextTableFieldPlaceholder(s, 0);
        return null;
    }
    return { start: m.index, end: m.index + m[0].length, text: m[0] };
}

/**
 * @param {HTMLTextAreaElement} ta
 * @param {string} snippet
 */
function insertAtCursor(ta, snippet) {
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const v = ta.value;
    ta.value = `${v.slice(0, start)}${snippet}${v.slice(end)}`;
    const pos = start + snippet.length;
    try {
        ta.setSelectionRange(pos, pos);
    } catch {
        /* ignore */
    }
    ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Вставка ссылки на поле: заменяет выделенный `[…]` / `$[…]` или плейсхолдер TABLE.*.
 * @param {HTMLTextAreaElement} ta
 * @param {string} ref — например `[orders.amount]`
 */
export function insertOrReplaceFieldRef(ta, ref) {
    if (!ta) return;
    const snippet = String(ref ?? '');
    if (!snippet) return;
    const v = ta.value;
    let start = ta.selectionStart ?? v.length;
    let end = ta.selectionEnd ?? v.length;

    if (start !== end) {
        const selected = v.slice(start, end);
        if (/^\$?\[[^\]]+\]$/.test(selected.trim())) {
            insertAtCursor(ta, snippet);
            return;
        }
    }

    const atCursor = findBracketFieldSpanAt(v, start);
    if (atCursor) {
        try {
            ta.setSelectionRange(atCursor.start, atCursor.end);
        } catch {
            /* ignore */
        }
        insertAtCursor(ta, snippet);
        return;
    }

    const placeholder = findNextTableFieldPlaceholder(v, start);
    if (placeholder) {
        try {
            ta.setSelectionRange(placeholder.start, placeholder.end);
        } catch {
            /* ignore */
        }
        insertAtCursor(ta, snippet);
        return;
    }

    insertAtCursor(ta, snippet);
}

/**
 * После вставки шаблона выделить первый `[TABLE.…]`.
 * @param {HTMLTextAreaElement} ta
 * @param {number} [from]
 */
function selectFirstTableFieldPlaceholder(ta, from = 0) {
    if (!ta) return;
    const span = findNextTableFieldPlaceholder(ta.value, from);
    if (!span) return;
    try {
        ta.focus();
        ta.setSelectionRange(span.start, span.end);
    } catch {
        /* ignore */
    }
}

function debounce(fn, ms) {
    let t = null;
    return (...args) => {
        if (t) clearTimeout(t);
        t = setTimeout(() => {
            t = null;
            fn(...args);
        }, ms);
    };
}

/**
 * @returns {string}
 */
export function getFormulaEditorModalHTML() {
    const fnButtons = [...FORMULA_FUNCTION_REGISTRY].map(
        (fn) =>
            `<button type="button" class="fe-fn-chip" data-fn-template="${escapeAttr(fn.template)}" title="${escapeAttr(fn.description || fn.label)}">${escapeHtml(fn.label)}</button>`,
    );

    return `
      <div class="formula-modal" role="dialog" aria-modal="true" aria-labelledby="aic-formula-modal-title">
        <header class="formula-modal__head">
          <div class="formula-modal__head-brand">
            <div class="formula-modal__head-text">
              <h2 id="aic-formula-modal-title" class="formula-modal__title"></h2>
              <p class="formula-modal__subtitle">Таблица → поле → формула → проверка → сохранение</p>
            </div>
          </div>
          <div class="formula-modal__head-actions">
            <span id="fe-parse-status" class="formula-modal__status formula-modal__status--idle" role="status">—</span>
            <button type="button" class="btn btn-secondary fe-head-btn" data-act="validate">Проверить</button>
            <button type="button" class="btn btn-primary fe-head-btn" data-act="preview">Предпросмотр</button>
            <button type="button" class="btn btn-secondary fe-head-btn fe-head-btn--save" data-act="save"></button>
            <button type="button" class="btn fe-head-btn" data-act="cancel">Отмена</button>
            <button type="button" class="formula-modal__icon-close" data-act="cancel" title="Закрыть" aria-label="Закрыть">
              <span class="formula-modal__icon-close-inner" data-act="cancel" aria-hidden="true">${svgCross}</span>
            </button>
          </div>
        </header>

        <div class="formula-modal__grid">
          <section class="formula-modal__card formula-modal__sources" aria-label="Источники данных">
            <div class="formula-modal__card-head">
              <span class="formula-modal__card-title">Источники данных</span>
            </div>
            <label class="fe-label" for="fe-table-select">Таблица</label>
            <select id="fe-table-select" class="fe-select"></select>
            <label class="fe-label" for="fe-field-search">Поиск полей</label>
            <input id="fe-field-search" type="search" class="fe-input" placeholder="Начните вводить имя…" autocomplete="off" />
            <div id="fe-field-list" class="fe-field-list"></div>
          </section>

          <section class="formula-modal__card formula-modal__editor" aria-label="Редактор формулы">
            <div class="formula-modal__card-head">
              <span class="formula-modal__card-title">Формула</span>
            </div>
            <label class="fe-label visually-hidden" for="text-formula-input">Выражение</label>
            <textarea id="text-formula-input" class="fe-textarea" rows="16" spellcheck="false" placeholder="SUM([Таблица.Колонка]) FOR [Таблица.Группа]"></textarea>
            <div id="fe-parse-detail" class="fe-parse-detail" hidden></div>
            <div class="fe-preview-block">
              <span class="fe-preview-label">Результат предпросмотра</span>
              <div id="text-formula-test-out" class="fe-preview-out" aria-live="polite"></div>
            </div>
          </section>

          <section class="formula-modal__card formula-modal__helper" aria-label="Конструктор и функции">
            <div class="formula-modal__card-head">
              <span class="formula-modal__card-title">Конструктор</span>
            </div>
            <label class="fe-label" for="fe-builder-agg">Агрегат</label>
            <select id="fe-builder-agg" class="fe-select">
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="COUNT">COUNT</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
              <option value="COUNT_DISTINCT">COUNT_DISTINCT</option>
            </select>
            <label class="fe-label" for="fe-builder-field">Поле</label>
            <select id="fe-builder-field" class="fe-select">
              <option value="">— выберите поле —</option>
            </select>
            <button type="button" class="btn btn-secondary fe-builder-insert" data-act="builder-insert">Вставить в редактор</button>

            <div class="fe-fn-block">
              <span class="fe-fn-block-title">Функции</span>
              <p class="fe-fn-hint">Клик вставляет шаблон и выделяет <code>[TABLE.FIELD]</code>. Клик по <code>[…]</code> в формуле выделяет его — затем выберите поле слева для замены. Префикс <code>$[ ]</code> — без фильтров дашборда. В агрегате: <code>WHERE</code> с <code>= != &gt; &lt; &gt;= &lt;=</code>, <code>IN (…)</code> / <code>NOT IN</code>, <code>LIKE</code> (<code>*</code>→<code>%</code>), <code>AND</code>/<code>OR</code> (AND сильнее; скобки).</p>
              <div class="fe-fn-grid">${fnButtons.join('')}</div>
            </div>
          </section>
        </div>
      </div>
    `;
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.initialFormula
 * @param {string} opts.saveButtonText
 * @param {(formula: string) => void} opts.onSave
 * @param {() => void} [opts.onCancel]
 * @param {object|null} opts.engine
 * @param {{ modelId?: number|string, table?: string, field?: string }|undefined} opts.dataSource
 * @param {FormulaFnTemplate[]} [opts.extraFunctionTemplates]
 * @param {boolean} [opts.allowFieldRef] — разрешить `[table.field]` и `[table.field] WHERE …` без агрегата (таблица / график)
 * @param {boolean} [opts.allowColorExpr] — разрешить IF / RGB / MATCH для окраски
 */
export function wireFormulaEditorModal(backdrop, opts) {
    const {
        title,
        initialFormula,
        saveButtonText,
        onSave,
        onCancel,
        engine,
        dataSource: ds,
        extraFunctionTemplates = [],
        allowFieldRef = false,
        allowColorExpr = false,
    } = opts;

    const modal = backdrop.querySelector('.formula-modal');
    const titleEl = backdrop.querySelector('#aic-formula-modal-title');
    const saveBtn = backdrop.querySelector('[data-act="save"]');
    const statusEl = backdrop.querySelector('#fe-parse-status');
    const parseDetailEl = backdrop.querySelector('#fe-parse-detail');
    const ta = backdrop.querySelector('#text-formula-input');
    const out = backdrop.querySelector('#text-formula-test-out');
    const tableSel = backdrop.querySelector('#fe-table-select');
    const searchInp = backdrop.querySelector('#fe-field-search');
    const fieldListEl = backdrop.querySelector('#fe-field-list');
    const aggSel = backdrop.querySelector('#fe-builder-agg');
    const builderFieldSel = backdrop.querySelector('#fe-builder-field');

    if (titleEl) titleEl.textContent = title;
    if (saveBtn) saveBtn.textContent = saveButtonText;
    if (ta) ta.value = String(initialFormula ?? '');

    for (const fn of extraFunctionTemplates) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fe-fn-chip';
        b.dataset.fnTemplate = fn.template;
        b.title = fn.description || fn.label;
        b.textContent = fn.label;
        backdrop.querySelector('.fe-fn-grid')?.appendChild(b);
    }

    /** @type {{ fields: object[], tables: object[], rawLoaded: boolean }} */
    const state = {
        fields: [],
        tables: [],
        rawLoaded: false,
    };

    const updateParseStatus = () => {
        if (!statusEl || !ta || !parseDetailEl) return;
        const raw = String(ta.value || '').trim();
        if (!raw) {
            statusEl.textContent = 'Введите формулу';
            statusEl.className = 'formula-modal__status formula-modal__status--idle';
            parseDetailEl.hidden = true;
            parseDetailEl.textContent = '';
            ta.classList.remove('fe-textarea--invalid');
            return;
        }
        const v = validateEditorFormula(raw, { allowFieldRef, allowColorExpr });
        if (v.ok) {
            if (v.kind === 'field') {
                statusEl.textContent = 'Ссылка на поле OK';
            } else if (v.kind === 'field_where') {
                statusEl.textContent = 'Поле + WHERE OK';
            } else if (v.kind === 'color') {
                statusEl.textContent = 'Формула цвета OK';
            } else {
                statusEl.textContent = 'Синтаксис OK';
            }
            statusEl.className = 'formula-modal__status formula-modal__status--ok';
            parseDetailEl.hidden = true;
            parseDetailEl.textContent = '';
            ta.classList.remove('fe-textarea--invalid');
        } else {
            statusEl.textContent = 'Ошибка разбора';
            statusEl.className = 'formula-modal__status formula-modal__status--err';
            parseDetailEl.hidden = false;
            parseDetailEl.textContent = v.error || formatFormulaError(new Error('Ошибка'));
            ta.classList.add('fe-textarea--invalid');
        }
    };

    const debouncedParse = debounce(updateParseStatus, DEBOUNCE_MS);

    function filteredFields() {
        const tableFilter = tableSel?.value || '';
        const q = (searchInp?.value || '').trim().toLowerCase();
        let list = state.fields.slice();
        if (tableFilter) {
            list = list.filter((f) => f.tableName === tableFilter);
        }
        if (q) {
            list = list.filter(
                (f) =>
                    String(f.name).toLowerCase().includes(q) ||
                    String(f.tableName).toLowerCase().includes(q),
            );
        }
        return list;
    }

    function renderFieldList() {
        if (!fieldListEl) return;
        const list = filteredFields();
        fieldListEl.innerHTML = '';
        if (!state.rawLoaded) {
            fieldListEl.innerHTML =
                '<div class="fe-field-empty">Загрузка схемы…</div>';
            return;
        }
        if (!list.length) {
            fieldListEl.innerHTML =
                '<div class="fe-field-empty">Нет полей по фильтру</div>';
            return;
        }
        for (const f of list) {
            const ref = `[${f.tableName}.${f.name}]`;
            const bucket = mapSchemaTypeToBucket(f.type);
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'fe-field-row';
            row.draggable = true;
            row.dataset.formulaRef = ref;
            row.title = `${f.modelName || ''}\nТип: ${f.type || '—'}`.trim();
            row.innerHTML = `
              <span class="fe-field-row__name">${escapeHtml(f.name)}</span>
              <span class="fe-field-type fe-field-type--${bucket}">${escapeHtml(f.type || bucket)}</span>
            `;
            row.addEventListener('click', () => insertOrReplaceFieldRef(ta, ref));
            row.addEventListener('dragstart', (ev) => {
                ev.dataTransfer?.setData('text/plain', ref);
                ev.dataTransfer?.setData('application/x-aic-formula-ref', ref);
                ev.dataTransfer.effectAllowed = 'copy';
            });
            fieldListEl.appendChild(row);
        }
    }

    function rebuildBuilderFields() {
        if (!builderFieldSel) return;
        const list = filteredFields();
        const cur = builderFieldSel.value;
        builderFieldSel.innerHTML = '<option value="">— выберите поле —</option>';
        for (const f of list) {
            const opt = document.createElement('option');
            opt.value = `${f.tableName}\t${f.name}`;
            opt.textContent = `${f.tableName}.${f.name}`;
            builderFieldSel.appendChild(opt);
        }
        if (cur && [...builderFieldSel.options].some((o) => o.value === cur)) {
            builderFieldSel.value = cur;
        }
    }

    function onTableOrSearchChange() {
        renderFieldList();
        rebuildBuilderFields();
    }

    async function loadSchema() {
        const dashId = engine?.dashboardId;
        if (!dashId || !fieldListEl) {
            state.rawLoaded = true;
            state.fields = [];
            state.tables = [];
            renderFieldList();
            return;
        }
        try {
            const { fields, tables } = await getDashboardSchema(dashId);
            let tf = fields || [];
            let tt = tables || [];
            if (ds?.modelId != null) {
                tf = tf.filter((f) => String(f.modelId) === String(ds.modelId));
                tt = tt.filter((t) => String(t.modelId) === String(ds.modelId));
            }
            state.fields = tf;
            state.tables = tt;
            state.rawLoaded = true;

            if (tableSel) {
                tableSel.innerHTML = '';
                const optAll = document.createElement('option');
                optAll.value = '';
                optAll.textContent = 'Все таблицы';
                tableSel.appendChild(optAll);
                for (const t of tt) {
                    const o = document.createElement('option');
                    o.value = t.tableName;
                    o.textContent = t.label || t.tableName;
                    tableSel.appendChild(o);
                }
                if (ds?.table && tt.some((x) => x.tableName === ds.table)) {
                    tableSel.value = ds.table;
                }
            }
            onTableOrSearchChange();
        } catch (e) {
            console.warn('formulaEditorModal loadSchema', e);
            state.rawLoaded = true;
            state.fields = [];
            if (fieldListEl) {
                fieldListEl.innerHTML =
                    '<div class="fe-field-empty">Не удалось загрузить схему</div>';
            }
        }
    }

    tableSel?.addEventListener('change', onTableOrSearchChange);
    searchInp?.addEventListener('input', debounce(onTableOrSearchChange, DEBOUNCE_MS));

    ta?.addEventListener('input', debouncedParse);
    ta?.addEventListener('keydown', (e) => {
        if (e.key === '[') {
            const t = /** @type {HTMLTextAreaElement} */ (e.target);
            const start = t.selectionStart ?? 0;
            const end = t.selectionEnd ?? 0;
            if (start === end) {
                const after = t.value.slice(start, start + 1);
                if (after !== '[' && after !== ']') {
                    e.preventDefault();
                    insertAtCursor(t, '[]');
                    try {
                        t.setSelectionRange(start + 1, start + 1);
                    } catch {
                        /* ignore */
                    }
                }
            }
        }
    });

    ta?.addEventListener('click', () => {
        if (!ta) return;
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        // Не перебиваем ручное выделение
        if (start !== end) return;
        const span = findBracketFieldSpanAt(ta.value, start);
        if (!span) return;
        try {
            ta.setSelectionRange(span.start, span.end);
        } catch {
            /* ignore */
        }
    });

    ta?.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    ta?.addEventListener('drop', (e) => {
        e.preventDefault();
        const ref =
            e.dataTransfer?.getData('application/x-aic-formula-ref') ||
            e.dataTransfer?.getData('text/plain');
        if (ref) insertOrReplaceFieldRef(ta, ref);
    });

    backdrop.querySelector('[data-act="validate"]')?.addEventListener('click', () => {
        updateParseStatus();
        if (parseDetailEl && !parseDetailEl.hidden) {
            parseDetailEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    });

    backdrop.querySelector('[data-act="preview"]')?.addEventListener('click', async () => {
        if (!out || !ta) return;
        out.textContent = 'Выполняется…';
        const formula = String(ta.value || '').trim();
        if (!formula) {
            out.textContent = 'Введите формулу.';
            return;
        }
        const validated = validateEditorFormula(formula, { allowFieldRef, allowColorExpr });
        if (!validated.ok) {
            out.textContent = `Ошибка: ${validated.error}`;
            updateParseStatus();
            return;
        }
        if (validated.kind === 'field') {
            out.textContent =
                'Ссылка на поле без агрегата — на виджете значения берутся из строк данных (предпросмотр скаляра недоступен).';
            return;
        }
        if (validated.kind === 'color') {
            out.textContent =
                'Формула цвета (IF / RGB / MATCH) применяется к каждому сектору по значению измерения — скалярный предпросмотр недоступен.';
            return;
        }
        const previewFormula = formulaForScalarPreview(formula, validated);
        if (!previewFormula) {
            out.textContent = 'Предпросмотр для этой формулы недоступен.';
            return;
        }
        if (!engine) {
            out.textContent = 'Ошибка: нет контекста дашборда.';
            return;
        }
        const ctx = resolvePreviewExecutionContext(ds, previewFormula, state.tables, tableSel?.value);
        if (!ctx) {
            out.textContent =
                'Ошибка: укажите таблицу слева или квалифицированные поля в формуле, например SUM([orders.amount]). Для COUNT(*) без полей выберите таблицу в списке «Таблица».';
            return;
        }
        const r = await runSingleFormulaOnDashboard(engine, ctx.modelId, ctx.table, previewFormula);
        if (r.error) {
            out.textContent = `Ошибка: ${r.error}`;
        } else if (validated.kind === 'field_where') {
            out.textContent = `AVG по фильтру WHERE: ${String(r.value ?? '—')}`;
        } else if (validated.kind === 'grouped') {
            out.textContent = `Группы:\n${String(r.value ?? '—')}`;
        } else {
            out.textContent = String(r.value ?? '—');
        }
    });

    const close = () => {
        if (typeof onCancel === 'function') onCancel();
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    };

    backdrop.querySelectorAll('[data-act="cancel"]').forEach((el) => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            close();
        });
    });

    backdrop.querySelector('[data-act="save"]')?.addEventListener('click', () => {
        const formula = String(ta?.value || '').trim();
        if (!formula) return;
        const validated = validateEditorFormula(formula, { allowFieldRef, allowColorExpr });
        if (!validated.ok) {
            updateParseStatus();
            return;
        }
        onSave(formula);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    });

    backdrop.querySelector('[data-act="builder-insert"]')?.addEventListener('click', () => {
        const fn = String(aggSel?.value || 'SUM').toUpperCase();
        const raw = String(builderFieldSel?.value || '');
        if (!raw) {
            const tmpl = fn === 'COUNT' ? 'COUNT(*)' : `${fn}([TABLE.FIELD])`;
            const before = ta?.selectionStart ?? 0;
            insertAtCursor(ta, tmpl);
            selectFirstTableFieldPlaceholder(ta, before);
            return;
        }
        const [tbl, col] = raw.split('\t');
        const ref = `[${tbl}.${col}]`;
        if (fn === 'COUNT' && !col) {
            insertAtCursor(ta, 'COUNT(*)');
            return;
        }
        insertAtCursor(ta, `${fn}(${ref})`);
    });

    backdrop.querySelector('.fe-fn-grid')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fn-template]');
        if (!btn || !ta) return;
        const tmpl = btn.getAttribute('data-fn-template') || '';
        let ins = tmpl;
        const raw = String(builderFieldSel?.value || '');
        if (raw && tmpl.includes('TABLE.FIELD')) {
            const [tbl, col] = raw.split('\t');
            // replace only first TABLE.FIELD occurrence when builder field selected
            ins = tmpl.replace('TABLE.FIELD', `${tbl}.${col}`);
        }
        const before = ta.selectionStart ?? 0;
        insertAtCursor(ta, ins);
        selectFirstTableFieldPlaceholder(ta, before);
    });

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });

    void loadSchema();
    queueMicrotask(() => {
        updateParseStatus();
        ta?.focus();
    });
}
