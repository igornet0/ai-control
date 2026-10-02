/**
 * Сбор глобальных фильтров с виджетов типа «filter» на листе дашборда.
 */

import { mapSchemaColumnToFieldType } from '../pages/dashboard_creater/src/widgets/data-input/dataInputSchema.js';

/** Шаблон UI (* → %) как в `run_column_distinct` / LIKE в запросе. */
export function patternToSqlLike(pat) {
  let s = String(pat ?? '').trim().replace(/\*/g, '%');
  if (!s) return '';
  if (!s.includes('%')) s += '%';
  return s;
}

function _coerceFilterValue(fieldType, raw) {
  if (raw === '' || raw === undefined || raw === null) return null;
  const t = (fieldType || '').toLowerCase();
  if (t === 'int') {
    const n = parseInt(String(raw), 10);
    return Number.isNaN(n) ? raw : n;
  }
  if (t === 'number') {
    const n = parseFloat(String(raw).replace(',', '.'));
    return Number.isNaN(n) ? raw : n;
  }
  if (t === 'boolean') {
    if (raw === true || raw === false) return raw;
    const s = String(raw).toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
    return raw;
  }
  return raw;
}

/**
 * Границы диапазона с линейного графика (часто epoch ms) → значение для SQL.
 * Для дат в SQLite как TEXT сравнение с числом почти всегда даёт 0 строк — нужна строка ISO.
 * @param {string|undefined} fieldType
 * @param {unknown} raw
 */
function coerceRangeFilterBound(fieldType, raw) {
  if (raw === '' || raw === undefined || raw === null) return null;
  const t = (fieldType || '').toLowerCase();
  const n = Number(raw);
  if (!Number.isFinite(n)) return _coerceFilterValue(fieldType, raw);

  const looksEpochMs = Math.abs(n) > 1e11;
  const looksEpochSec = Number.isFinite(n) && n > 1e8 && n < 1e11;

  const dateLikeType =
    t.includes('date') ||
    t.includes('time') ||
    t === 'timestamp' ||
    ((t === 'string' || t === 'text' || t === 'varchar' || t === 'char') && looksEpochMs);

  if (dateLikeType && looksEpochMs) {
    return new Date(n).toISOString();
  }
  if (dateLikeType && looksEpochSec) {
    return new Date(n * 1000).toISOString();
  }

  return _coerceFilterValue(fieldType, raw);
}

function coerceEpochMsToIso(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) > 1e11) return new Date(n).toISOString();
  if (n > 1e8 && n < 1e11) return new Date(n * 1000).toISOString();
  return n;
}

/**
 * Один и тот же data-model id в JSON/БД может быть number или string — для фильтрации должно совпадать логически.
 */
export function sameDataModelId(a, b) {
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a) === String(b);
}

/**
 * Ключ одного логического поля фильтра (модель + таблица + колонка).
 * Совпадающие ключи в разных виджетах «Фильтр» синхронизируются.
 */
export function filterFieldKey(f) {
  if (f?.modelId == null || f?.table == null || f?.field == null) return null;
  const t = String(f.table).trim();
  const fld = String(f.field).trim();
  if (!t || !fld) return null;
  const mid = Number(f.modelId);
  const midPart =
    Number.isFinite(mid) && String(f.modelId).trim() !== '' ? String(mid) : String(f.modelId).trim();
  return `${midPart}::${t}::${fld}`;
}

/**
 * Синтетический `widgetId` для чипов панели активных фильтров по строкам из `engine.__virtualDashboardFilters`.
 */
export const ACTIVE_FILTERS_BAR_VIRTUAL_WIDGET_ID = '__virtualDashboardFilters__';

function _selectedValuesSignature(sel) {
  return JSON.stringify([...(sel || [])].map((x) => String(x)).sort());
}

function _excludedValuesSignature(sel) {
  return JSON.stringify([...(sel || [])].map((x) => String(x)).sort());
}

function _hasRangeConstraint(f) {
  return (
    f?.rangeMin != null &&
    f?.rangeMax != null &&
    Number.isFinite(Number(f.rangeMin)) &&
    Number.isFinite(Number(f.rangeMax)) &&
    Number(f.rangeMax) >= Number(f.rangeMin)
  );
}

function _filterRowHasActiveConstraint(f) {
  if (!f) return false;
  const selected = Array.isArray(f.selectedValues)
    ? f.selectedValues.filter((x) => x !== '' && x != null)
    : [];
  const excluded = Array.isArray(f.excludedValues)
    ? f.excludedValues.filter((x) => x !== '' && x != null)
    : [];
  const likeActive = Boolean(patternToSqlLike(f.pattern || ''));
  return selected.length > 0 || excluded.length > 0 || likeActive || _hasRangeConstraint(f);
}

function _isVirtualDashboardFilterRow(engine, row) {
  if (!row || !Array.isArray(engine.__virtualDashboardFilters)) return false;
  return engine.__virtualDashboardFilters.some((r) => r === row || (row.id != null && r.id === row.id));
}

/** Черновик (два множества) отличается от применённого selectedValues/excludedValues */
export function isPendingFilterDistinctFromCommitted(pendingInc, pendingExc, fl) {
  if (!pendingInc || !pendingExc) return false;
  const a = _selectedValuesSignature([...pendingInc]);
  const b = _selectedValuesSignature(fl.selectedValues);
  const c = _excludedValuesSignature([...pendingExc]);
  const d = _excludedValuesSignature(fl.excludedValues);
  return a !== b || c !== d;
}

/**
 * Пропагирует pattern и selectedValues на все строки фильтра с тем же filterFieldKey.
 * @param {object} engine — WorkspaceEngine
 * @param {object} sourceRow — элемент из widget.settings.filters (уже с новым состоянием)
 * @param {{ sourceWidgetId?: string }} [options] — источник: при открытом списке того же поля update() у источника не вызывается, чтобы не сбросить выпадашку.
 */
export function syncFilterRowsByField(engine, sourceRow, options = {}) {
  if (!engine?.widgetManager || !sourceRow) return;
  const key = filterFieldKey(sourceRow);
  if (!key) return;

  const srcSel = Array.isArray(sourceRow.selectedValues) ? [...sourceRow.selectedValues] : [];
  const srcExc = Array.isArray(sourceRow.excludedValues) ? [...sourceRow.excludedValues] : [];
  const srcPat = sourceRow.pattern != null ? String(sourceRow.pattern) : '';
  const srcDisp = sourceRow.displayLabel != null ? String(sourceRow.displayLabel) : '';
  const srcRangeMin = sourceRow.rangeMin;
  const srcRangeMax = sourceRow.rangeMax;
  const targetSig = _selectedValuesSignature(srcSel);
  const targetExcSig = _excludedValuesSignature(srcExc);

  const sourceWidgetId = options.sourceWidgetId;
  const sourceIsVirtual = _isVirtualDashboardFilterRow(engine, sourceRow);

  const applyRowState = (f) => {
    if (
      _selectedValuesSignature(f.selectedValues) === targetSig &&
      _excludedValuesSignature(f.excludedValues) === targetExcSig &&
      String(f.pattern ?? '') === srcPat &&
      String(f.displayLabel ?? '') === srcDisp &&
      f.rangeMin === srcRangeMin &&
      f.rangeMax === srcRangeMax
    ) {
      return false;
    }
    f.selectedValues = [...srcSel];
    f.excludedValues = [...srcExc];
    f.pattern = srcPat;
    f.displayLabel = srcDisp;
    f.rangeMin = srcRangeMin;
    f.rangeMax = srcRangeMax;
    return true;
  };

  if (!sourceIsVirtual) {
    engine.widgetManager.getAllWidgets().forEach((w) => {
      if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
      let touched = false;
      w.settings.filters.forEach((f) => {
        if (filterFieldKey(f) !== key) return;
        if (applyRowState(f)) touched = true;
      });
      if (!touched) return;

      /** Не сбрасывать DOM только если открыт список того же логического поля (иначе «сброс всех» не обновляет чекбоксы). */
      let expandedKey = null;
      if (
        sourceWidgetId &&
        w.id === sourceWidgetId &&
        w._expandedFilterId &&
        Array.isArray(w.settings?.filters)
      ) {
        const exRow = w.settings.filters.find((r) => r.id === w._expandedFilterId);
        if (exRow) expandedKey = filterFieldKey(exRow);
      }
      const skipUpdate =
        Boolean(sourceWidgetId) &&
        w.id === sourceWidgetId &&
        expandedKey != null &&
        expandedKey === key;
      if (!skipUpdate && typeof w.update === 'function') w.update();
    });
  }

  if (Array.isArray(engine.__virtualDashboardFilters)) {
    engine.__virtualDashboardFilters.forEach((f) => {
      if (filterFieldKey(f) !== key) return;
      applyRowState(f);
    });
  }
}

/**
 * Сбрасывает все строки фильтра по той же data-model, кроме указанного поля (для выбора «несовместимого» значения).
 * @param {object} engine
 * @param {{ modelId: any, table: string, field: string }} keepRow — строка фильтра, которую не трогаем
 */
export function clearOtherDashboardFiltersSameModel(engine, keepRow) {
  if (!engine?.widgetManager || !keepRow) return;
  const keepKey = filterFieldKey(keepRow);
  if (!keepKey || keepRow.modelId == null) return;

  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    let touched = false;
    w.settings.filters.forEach((f) => {
      if (!sameDataModelId(f.modelId, keepRow.modelId)) return;
      const k = filterFieldKey(f);
      if (!k || k === keepKey) return;
      const hadSel = Array.isArray(f.selectedValues) && f.selectedValues.length > 0;
      const hadExc = Array.isArray(f.excludedValues) && f.excludedValues.length > 0;
      const hadPat = Boolean(patternToSqlLike(f.pattern || ''));
      const hadRange = _hasRangeConstraint(f);
      if (!hadSel && !hadExc && !hadPat && !hadRange) return;
      f.selectedValues = [];
      f.excludedValues = [];
      f.pattern = '';
      f.rangeMin = null;
      f.rangeMax = null;
      touched = true;
    });
    if (touched && typeof w.update === 'function') w.update();
  });
}

/**
 * Клик по значению, помеченному как недоступное в списке distinct (AND с другими полями / текущим выбором).
 * Снимает шаблон и прочие ограничения по модели, оставляя у этого поля только выбранное значение —
 * чтобы оно снова попало в контекст «доступных».
 * @param {object} engine
 * @param {{ modelId: any, table: string, field: string }} keepRow — строка фильтра (mutate)
 * @param {string} value — выбранное значение (как в UI)
 */
export function resetFiltersForStaleDistinctChoice(engine, keepRow, value) {
  if (!engine?.widgetManager || !keepRow) return;
  keepRow.pattern = '';
  keepRow.selectedValues = value != null && value !== '' ? [value] : [];
  keepRow.excludedValues = [];
  clearOtherDashboardFiltersSameModel(engine, keepRow);
}

/**
 * Уникальные логические поля фильтра (filterFieldKey) по модели с ненулевым выбором или LIKE-шаблоном.
 * Как критерий «активности» в gatherActiveFilterFields / панели чипов.
 * @param {object} engine
 * @param {number|string|null|undefined} modelId
 * @returns {number}
 */
export function countActiveFilterFieldKeysForModel(engine, modelId) {
  if (!engine?.widgetManager || modelId == null) return 0;
  const keys = new Set();
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    w.settings.filters.forEach((f) => {
      if (!sameDataModelId(f.modelId, modelId)) return;
      const selected = Array.isArray(f.selectedValues)
        ? f.selectedValues.filter((x) => x !== '' && x != null)
        : [];
      const excluded = Array.isArray(f.excludedValues)
        ? f.excludedValues.filter((x) => x !== '' && x != null)
        : [];
      const likeActive = Boolean(patternToSqlLike(f.pattern || ''));
      if (selected.length === 0 && excluded.length === 0 && !likeActive) return;
      const k = filterFieldKey(f);
      if (k) keys.add(k);
    });
  });
  return keys.size;
}

/**
 * На модели единственное ограничение по фильтрам — и оно относится к тому же логическому полю, что и `fl`.
 * Тогда клик по «недоступному» значению не должен сбрасывать остальные фильтры / шаблон (только добавить в выбор).
 * @param {object} engine
 * @param {{ modelId: any, table: string, field: string }} fl
 */
export function onlyActiveDashboardFilterIsSameField(engine, fl) {
  if (!engine?.widgetManager || fl?.modelId == null) return false;
  const mine = filterFieldKey(fl);
  if (!mine) return false;
  const keys = new Set();
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    w.settings.filters.forEach((f) => {
      if (!sameDataModelId(f.modelId, fl.modelId)) return;
      const selected = Array.isArray(f.selectedValues)
        ? f.selectedValues.filter((x) => x !== '' && x != null)
        : [];
      const excluded = Array.isArray(f.excludedValues)
        ? f.excludedValues.filter((x) => x !== '' && x != null)
        : [];
      const likeActive = Boolean(patternToSqlLike(f.pattern || ''));
      if (selected.length === 0 && excluded.length === 0 && !likeActive) return;
      const k = filterFieldKey(f);
      if (k) keys.add(k);
    });
  });
  return keys.size === 1 && keys.has(mine);
}

/**
 * Первая строка «Фильтр» с данным логическим полем (modelId+table+field).
 * @returns {{ widget: object, row: object } | null}
 */
export function findFirstFilterRowByFieldKey(engine, { modelId, table, field }) {
  const k = filterFieldKey({ modelId, table, field });
  if (!k || !engine?.widgetManager) return null;
  const widgets = engine.widgetManager.getAllWidgets();
  for (let i = 0; i < widgets.length; i += 1) {
    const w = widgets[i];
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) continue;
    for (let j = 0; j < w.settings.filters.length; j += 1) {
      const row = w.settings.filters[j];
      if (filterFieldKey(row) === k) return { widget: w, row };
    }
  }
  const virtualRows = Array.isArray(engine.__virtualDashboardFilters)
    ? engine.__virtualDashboardFilters
    : [];
  for (let i = 0; i < virtualRows.length; i += 1) {
    const row = virtualRows[i];
    if (filterFieldKey(row) === k) return { widget: null, row };
  }
  return null;
}

/**
 * Гарантирует виртуальную строку фильтра для поля (клик с диаграммы/таблицы).
 * Виджет «Фильтр» на листе не изменяется — только `engine.__virtualDashboardFilters`.
 * @returns {{ ok: boolean, created?: boolean, widget?: object | null, row?: object }}
 */
export function ensureDashboardFilterRowExists(engine, dim) {
  if (!engine?.widgetManager || !dim?.table || !dim?.field || dim.modelId == null) {
    return { ok: false, created: false };
  }

  const k = filterFieldKey(dim);
  if (!k) return { ok: false, created: false };

  if (!Array.isArray(engine.__virtualDashboardFilters)) {
    engine.__virtualDashboardFilters = [];
  }

  const existing = engine.__virtualDashboardFilters.find((row) => filterFieldKey(row) === k);
  if (existing) return { ok: true, created: false, widget: null, row: existing };

  const newRow = {
    id: `vf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    modelId: dim.modelId,
    table: dim.table,
    field: dim.field,
    type: dim.type || 'string',
    pattern: '',
    selectedValues: [],
    excludedValues: [],
    displayLabel: dim.displayLabel != null ? String(dim.displayLabel) : '',
  };
  engine.__virtualDashboardFilters.push(newRow);
  return { ok: true, created: true, widget: null, row: newRow };
}

/**
 * Цикл по одному значению: нет в списках → IN; было в IN → NOT IN; было в NOT IN → снято.
 * @param {object} engine
 * @param {object} row — строка filters[]
 * @param {unknown} valueRaw
 */
export function cycleFilterValueIncludeExcludeState(engine, row, valueRaw) {
  const v = String(valueRaw ?? '');
  if (!v) return;
  const sel = new Set(
    (Array.isArray(row.selectedValues) ? row.selectedValues : []).map((x) => String(x)),
  );
  const exc = new Set(
    (Array.isArray(row.excludedValues) ? row.excludedValues : []).map((x) => String(x)),
  );
  if (exc.has(v)) {
    exc.delete(v);
  } else if (sel.has(v)) {
    sel.delete(v);
    exc.add(v);
  } else {
    sel.add(v);
  }
  row.selectedValues = Array.from(sel);
  row.excludedValues = Array.from(exc);
  syncFilterRowsByField(engine, row, {});
}

/**
 * Заменить выбор IN для поля значениями из круговой (staging); убирает их из excluded.
 * @param {object} engine
 * @param {{ modelId: any, table: string, field: string }} dim
 * @param {Set<string>|Iterable<string>} stagedSet
 * @returns {{ ok: boolean }}
 */
export function commitPieSliceIncludeStaging(engine, dim, stagedSet) {
    const ensured = ensureDashboardFilterRowExists(engine, dim);
    if (!ensured.ok || !ensured.row) return { ok: false };
    const arr = [...stagedSet].map((x) => String(x));
    ensured.row.selectedValues = arr;
    const exc = new Set(
        (Array.isArray(ensured.row.excludedValues) ? ensured.row.excludedValues : []).map((x) => String(x)),
    );
    arr.forEach((v) => exc.delete(v));
    ensured.row.excludedValues = Array.from(exc);
    syncFilterRowsByField(engine, ensured.row, {});
    return { ok: true };
}

/**
 * Обычный выбор с диаграммы: фильтр по полю = только это значение (IN из одного).
 * При options.toggle: повторный клик по уже единственному выбранному значению снимает ограничение.
 * @param {object} engine
 * @param {{ modelId: any, table: string, field: string }} dim — то же поле, что привязка измерения столбчатой диаграммы
 * @param {unknown} valueRaw — подпись категории (как в данных)
 * @param {{ toggle?: boolean }} [options]
 * @returns {{ ok: boolean, cleared?: boolean }}
 */
export function setDashboardFilterIncludeOnlyValue(engine, dim, valueRaw, options = {}) {
    const ensured = ensureDashboardFilterRowExists(engine, dim);
    if (!ensured.ok || !ensured.row) return { ok: false };
    const v = String(valueRaw ?? '');
    if (!v) return { ok: false };
    const row = ensured.row;
    const prev = Array.isArray(row.selectedValues) ? row.selectedValues.map((x) => String(x)) : [];
    const excPrev = Array.isArray(row.excludedValues) ? row.excludedValues.map((x) => String(x)) : [];
    const toggle = options.toggle === true;
    if (toggle && prev.length === 1 && prev[0] === v && excPrev.length === 0) {
        row.selectedValues = [];
        row.excludedValues = [];
        syncFilterRowsByField(engine, row, {});
        return { ok: true, cleared: true };
    }
    row.selectedValues = [v];
    const exc = new Set(excPrev);
    exc.delete(v);
    row.excludedValues = Array.from(exc);
    syncFilterRowsByField(engine, row, {});
    return { ok: true };
}

function _cloneFilterDescriptor(f) {
  return {
    id: f.id,
    modelId: f.modelId,
    table: f.table,
    field: f.field,
    type: f.type,
    selectedValues: Array.isArray(f.selectedValues) ? [...f.selectedValues] : [],
    excludedValues: Array.isArray(f.excludedValues) ? [...f.excludedValues] : [],
    pattern: f.pattern != null ? String(f.pattern) : '',
    displayLabel: f.displayLabel != null ? String(f.displayLabel) : '',
    op: f.op,
    value: f.value,
    values: Array.isArray(f.values) ? [...f.values] : f.values,
    rangeMin: f.rangeMin,
    rangeMax: f.rangeMax,
    sourceWidgetId: f.sourceWidgetId,
    brushIso: f.brushIso,
  };
}

/**
 * Уникальные логические поля фильтра (первый экземпляр на filterFieldKey).
 * @param {object} engine
 * @returns {object[]}
 */
export function buildFilterDescriptorsFromEngine(engine) {
  if (!engine?.widgetManager) return [];
  const byKey = new Map();
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    w.settings.filters.forEach((f) => {
      const k = filterFieldKey(f);
      if (!k || byKey.has(k)) return;
      byKey.set(k, _cloneFilterDescriptor(f));
    });
  });
  const virtualRows = Array.isArray(engine.__virtualDashboardFilters)
    ? engine.__virtualDashboardFilters
    : [];
  virtualRows.forEach((f) => {
    const k = filterFieldKey(f);
    if (!k) return;
    const existing = byKey.get(k);
    const virtualActive = _filterRowHasActiveConstraint(f);
    const existingActive = _filterRowHasActiveConstraint(existing);
    if (!existing) {
      byKey.set(k, _cloneFilterDescriptor(f));
      return;
    }
    if (virtualActive && !existingActive) {
      byKey.set(k, _cloneFilterDescriptor(f));
    }
  });
  const out = Array.from(byKey.values());
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'line-chart' || !w.settings?.dashboardBrushX) return;
    const b = w.settings.dashboardBrushX;
    if (b?.modelId == null || !b.table || !b.field) return;
    const xMin = Number(b.xMin);
    const xMax = Number(b.xMax);
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax < xMin) return;
    out.push({
      id: `line_brush_${w.id}`,
      modelId: b.modelId,
      table: b.table,
      field: b.field,
      type: b.fieldType || 'number',
      selectedValues: [],
      excludedValues: [],
      pattern: '',
      displayLabel: b.displayLabel != null ? String(b.displayLabel) : '',
      rangeMin: xMin,
      rangeMax: xMax,
      sourceWidgetId: w.id,
      brushIso: b.useIsoBounds === true,
    });
  });
  return out;
}

/**
 * SQL-условия из дескрипторов полей (как раньше collectDashboardFilters по виджетам).
 * @param {object[]} descriptors
 * @returns {Array<{ modelId: any, table: string, column: string, op: string, value?: any, values?: any[] }>}
 */
export function sqlFiltersFromDescriptors(descriptors) {
  const out = [];
  for (const f of descriptors || []) {
    if (f.modelId == null || !f.table || !f.field) continue;

    if (
      f.rangeMin != null &&
      f.rangeMax != null &&
      Number.isFinite(Number(f.rangeMin)) &&
      Number.isFinite(Number(f.rangeMax)) &&
      Number(f.rangeMax) >= Number(f.rangeMin)
    ) {
      const lo =
        f.brushIso === true ? coerceEpochMsToIso(f.rangeMin) : coerceRangeFilterBound(f.type, f.rangeMin);
      const hi =
        f.brushIso === true ? coerceEpochMsToIso(f.rangeMax) : coerceRangeFilterBound(f.type, f.rangeMax);
      if (lo != null && lo !== '' && hi != null && hi !== '') {
        out.push({
          modelId: f.modelId,
          table: f.table,
          column: f.field,
          op: 'gte',
          value: lo,
        });
        out.push({
          modelId: f.modelId,
          table: f.table,
          column: f.field,
          op: 'lte',
          value: hi,
        });
      }
      continue;
    }

    const selected = Array.isArray(f.selectedValues)
      ? f.selectedValues.filter((x) => x !== '' && x != null)
      : [];
    const excluded = Array.isArray(f.excludedValues)
      ? f.excludedValues.filter((x) => x !== '' && x != null)
      : [];
    if (selected.length > 0) {
      out.push({
        modelId: f.modelId,
        table: f.table,
        column: f.field,
        op: 'in',
        values: selected.map((x) => _coerceFilterValue(f.type, x)),
      });
    }
    if (excluded.length > 0) {
      out.push({
        modelId: f.modelId,
        table: f.table,
        column: f.field,
        op: 'not_in',
        values: excluded.map((x) => _coerceFilterValue(f.type, x)),
      });
    }
    if (selected.length > 0 || excluded.length > 0) {
      continue;
    }

    const likeVal = patternToSqlLike(f.pattern || '');
    if (likeVal) {
      out.push({
        modelId: f.modelId,
        table: f.table,
        column: f.field,
        op: 'like',
        value: likeVal,
      });
      continue;
    }

    const op = f.op || 'eq';
    if (op === 'in') {
      const vals = Array.isArray(f.values)
        ? f.values
        : String(f.value || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      if (!vals.length) continue;
      out.push({
        modelId: f.modelId,
        table: f.table,
        column: f.field,
        op: 'in',
        values: vals.map((x) => _coerceFilterValue(f.type, x)),
      });
      continue;
    }
    const v = _coerceFilterValue(f.type, f.value);
    if (v === null || v === '') continue;
    out.push({
      modelId: f.modelId,
      table: f.table,
      column: f.field,
      op,
      value: v,
    });
  }
  return out;
}

export function collectDashboardFilters(engine) {
  if (!engine?.widgetManager) return [];
  const snap = engine.__dashboardFilterSnapshot;
  // Только снимок после commit (есть Map по моделям). Иначе при сбросе фильтра
  // collect мог вернуть старые sqlPredicates и KPI оставался «как с фильтром».
  if (
    snap
    && Array.isArray(snap.sqlPredicates)
    && snap.predicatesByModelId instanceof Map
  ) {
    return snap.sqlPredicates;
  }
  const descriptors = engine.filterStore
    ? engine.filterStore.syncFromEngine(engine)
    : buildFilterDescriptorsFromEngine(engine);
  return sqlFiltersFromDescriptors(descriptors);
}

export function filtersForModel(globalFilters, modelId) {
  return globalFilters
    .filter((f) => sameDataModelId(f.modelId, modelId))
    .map(({ table, column, op, value, values }) => {
      const row = { table, column, op };
      if (values != null) row.values = values;
      else row.value = value;
      return row;
    });
}

/**
 * После смены глобальных фильтров — перезагрузка данных у всех виджетов кроме filter.
 * @param {object} engine — WorkspaceEngine
 * @returns {Promise<Array<{ status: string, value?: unknown, reason?: unknown }>>}
 */
function widgetModelIdsForReload(widget) {
  const ids = new Set();
  const push = (v) => {
    if (v == null || v === '') return;
    ids.add(String(v));
  };
  push(widget?.dataSource?.modelId);
  if (Array.isArray(widget?.settings?.bindingFields)) {
    widget.settings.bindingFields.forEach((b) => push(b?.modelId));
  }
  push(widget?.settings?.bindingDimension?.modelId);
  push(widget?.settings?.bindingMeasure?.modelId);
  // Last resolved formula data source (KPI / text / gauge may stash model on dataSource after resolve).
  push(widget?.settings?.resolvedModelId);
  push(widget?._resolvedFormulaModelId);
  // Formula-mode KPI often has model only after resolveKpiDataSourceFromFormula.
  if (widget?.type === 'kpi' || widget?.type === 'gauge' || widget?.type === 'text') {
    push(widget?.settings?.modelId);
  }
  return ids;
}

/**
 * Ограниченный параллелизм `reloadFromDataModel` как Promise.allSettled.
 * @param {Array<() => Promise<unknown>>} jobs
 */
async function _reloadWidgetJobsPool(jobs, maxConcurrent) {
  if (!jobs.length) return [];
  const results = Array(jobs.length);
  let idx = 0;
  const n = jobs.length;
  const conc = Math.max(1, Math.min(Number(maxConcurrent) || 10, n));
  async function worker() {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= n) return;
      try {
        // eslint-disable-next-line no-await-in-loop
        const v = await jobs[myIdx]();
        results[myIdx] = { status: 'fulfilled', value: v };
      } catch (reason) {
        results[myIdx] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: conc }, () => worker()));
  return results;
}

export function reloadDashboardDataWidgets(engine, options = {}) {
  if (!engine?.widgetManager) return Promise.resolve([]);
  const strategy = options.strategy === 'by-model' ? 'by-model' : 'all';
  const changed = new Set((options.modelIds || []).map((x) => String(x)));
  const fallbackAll = options.fallbackAll !== false;
  const maxConcurrentRaw = Number(options.maxConcurrentWidgetReloads);
  const maxConcurrent =
    Number.isFinite(maxConcurrentRaw) && maxConcurrentRaw > 0 ? Math.floor(maxConcurrentRaw) : 10;

  const baseReload =
    options.reloadOptions && typeof options.reloadOptions === 'object' ? options.reloadOptions : {};
  const reloadOpts = {
    ...baseReload,
    signal: baseReload.signal ?? engine?.requestSignal,
  };
  const seen = new Set();
  const jobs = [];
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (!w || w.type === 'filter' || seen.has(w.id)) return;
    seen.add(w.id);
    if (strategy === 'by-model') {
      const ids = widgetModelIdsForReload(w);
      if (ids.size === 0) {
        if (!fallbackAll) return;
      } else if (changed.size > 0) {
        let hit = false;
        ids.forEach((mid) => {
          if (changed.has(String(mid))) hit = true;
        });
        if (!hit) return;
      } else if (!fallbackAll) {
        // Пустой changedModelIds и строгий режим — не трогаем привязанные виджеты.
        return;
      }
      // Иначе: changed пуст, но fallbackAll — перезагружаем все виджеты с привязкой
      // (на случай расхождения снимка diff с реальным изменением фильтров).
    }
    if (typeof w.reloadFromDataModel === 'function') {
      jobs.push(() =>
        Promise.resolve(w.reloadFromDataModel(engine, reloadOpts)).catch((err) => {
          if (err?.name === 'AbortError') return;
          console.error('[dashboard] reloadFromDataModel', w.type, w.id, err);
        }),
      );
    }
  });

  engine.__dashboardBulkReloadDepth = (engine.__dashboardBulkReloadDepth || 0) + 1;
  return _reloadWidgetJobsPool(jobs, maxConcurrent).finally(() => {
    engine.__dashboardBulkReloadDepth = Math.max(0, (engine.__dashboardBulkReloadDepth || 1) - 1);
  });
}

/**
 * Снимок строк фильтров по уникальному filterFieldKey (для realtime / localStorage).
 * Пишем только поля с активным ограничением (и brush линейного графика) —
 * иначе после сброса в storage остаются «пустые» строки / старые legacy-ключи оживают.
 * @param {object} engine
 * @param {string|number|null|undefined} sheetId
 */
export function serializeDashboardFilterSnapshot(engine, sheetId) {
  const fields = [];
  const seen = new Set();
  if (!engine?.widgetManager) {
    return {
      dashboardId: engine?.dashboardId ?? null,
      sheetId: sheetId ?? null,
      scope: 'dashboard',
      fields,
    };
  }
  const descriptors = buildFilterDescriptorsFromEngine(engine);
  descriptors.forEach((f) => {
    if (
      f.sourceWidgetId != null &&
      f.rangeMin != null &&
      f.rangeMax != null &&
      Number.isFinite(Number(f.rangeMin)) &&
      Number.isFinite(Number(f.rangeMax))
    ) {
      const baseKey = filterFieldKey(f);
      const key = baseKey ? `${baseKey}##lineBrush##${f.sourceWidgetId}` : `lineBrush##${f.sourceWidgetId}`;
      if (!key || seen.has(key)) return;
      seen.add(key);
      fields.push({
        key,
        modelId: f.modelId,
        table: f.table,
        field: f.field,
        type: f.type,
        selectedValues: [],
        excludedValues: [],
        pattern: '',
        displayLabel: f.displayLabel != null ? String(f.displayLabel) : '',
        sourceWidgetId: f.sourceWidgetId,
        rangeMin: f.rangeMin,
        rangeMax: f.rangeMax,
        brushIso: f.brushIso === true,
      });
      return;
    }
    if (!_filterRowHasActiveConstraint(f)) return;
    const key = filterFieldKey(f);
    if (!key || seen.has(key)) return;
    seen.add(key);
    fields.push({
      key,
      modelId: f.modelId,
      table: f.table,
      field: f.field,
      type: f.type,
      selectedValues: Array.isArray(f.selectedValues) ? [...f.selectedValues] : [],
      excludedValues: Array.isArray(f.excludedValues) ? [...f.excludedValues] : [],
      pattern: f.pattern != null ? String(f.pattern) : '',
      displayLabel: f.displayLabel != null ? String(f.displayLabel) : '',
      rangeMin: f.rangeMin,
      rangeMax: f.rangeMax,
    });
  });
  return {
    dashboardId: engine?.dashboardId ?? null,
    sheetId: sheetId ?? null,
    scope: 'dashboard',
    fields,
  };
}

/**
 * Применить снимок фильтров дашборда к текущему листу.
 * Сначала сбрасывает текущий выбор, затем накладывает поля из снимка
 * (поля без виджета «Фильтр» → `engine.__virtualDashboardFilters`).
 * @param {object} engine
 * @param {{ fields?: Array<{ key: string, selectedValues?: unknown[], pattern?: string }> }} payload
 */
export function applyDashboardFilterSnapshot(engine, payload) {
  if (!engine?.widgetManager || !payload || !Array.isArray(payload.fields)) return;

  // Полный сброс перед наложением — иначе поля, которых нет в снимке (после clear),
  // остались бы активными в виджетах / virtual.
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    let touched = false;
    w.settings.filters.forEach((row) => {
      if (
        (Array.isArray(row.selectedValues) && row.selectedValues.length) ||
        (Array.isArray(row.excludedValues) && row.excludedValues.length) ||
        String(row.pattern || '').trim() ||
        _hasRangeConstraint(row)
      ) {
        touched = true;
      }
      row.selectedValues = [];
      row.excludedValues = [];
      row.pattern = '';
      row.rangeMin = null;
      row.rangeMax = null;
    });
    if (touched && typeof w.update === 'function') w.update();
  });
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'line-chart' || !w.settings?.dashboardBrushX) return;
    delete w.settings.dashboardBrushX;
    if (typeof w.update === 'function') w.update();
  });
  engine.__virtualDashboardFilters = [];

  if (payload.fields.length === 0) {
    if (typeof engine.saveSnapshot === 'function') engine.saveSnapshot();
    return;
  }

  /** @type {Set<string>} */
  const appliedKeys = new Set();
  const byKey = new Map(
    payload.fields
      .filter((f) => f && (f.key || filterFieldKey(f)))
      .map((f) => [f.key || filterFieldKey(f), f]),
  );
  engine.widgetManager.getAllWidgets().forEach((w) => {
    if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
    let touched = false;
    w.settings.filters.forEach((row) => {
      const key = filterFieldKey(row);
      if (!key || !byKey.has(key)) return;
      const src = byKey.get(key);
      if (src.sourceWidgetId != null && src.rangeMin != null) return;
      row.selectedValues = Array.isArray(src.selectedValues) ? [...src.selectedValues] : [];
      row.excludedValues = Array.isArray(src.excludedValues) ? [...src.excludedValues] : [];
      row.pattern = src.pattern != null ? String(src.pattern) : '';
      row.displayLabel = src.displayLabel != null ? String(src.displayLabel) : '';
      row.rangeMin = src.rangeMin ?? null;
      row.rangeMax = src.rangeMax ?? null;
      appliedKeys.add(key);
      touched = true;
    });
    if (touched && typeof w.update === 'function') w.update();
  });

  /** Поля без виджета на этом листе — virtual, чтобы фильтр оставался dashboard-wide. */
  /** @type {object[]} */
  const nextVirtual = [];
  payload.fields.forEach((src) => {
    if (src.sourceWidgetId != null && src.rangeMin != null) return;
    const key = src.key || filterFieldKey(src);
    if (!key || appliedKeys.has(key)) return;
    const selected = Array.isArray(src.selectedValues) ? src.selectedValues : [];
    const excluded = Array.isArray(src.excludedValues) ? src.excludedValues : [];
    const pattern = src.pattern != null ? String(src.pattern) : '';
    const hasActive =
      selected.some((x) => x !== '' && x != null) ||
      excluded.some((x) => x !== '' && x != null) ||
      Boolean(String(pattern).trim()) ||
      _hasRangeConstraint(src);
    if (!hasActive) return;
    if (src.modelId == null || !src.table || !src.field) return;
    nextVirtual.push({
      id: `vf_${String(key).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48)}`,
      modelId: src.modelId,
      table: src.table,
      field: src.field,
      type: src.type || 'string',
      selectedValues: [...selected],
      excludedValues: [...excluded],
      pattern,
      displayLabel: src.displayLabel != null ? String(src.displayLabel) : '',
      rangeMin: src.rangeMin ?? null,
      rangeMax: src.rangeMax ?? null,
    });
  });
  engine.__virtualDashboardFilters = nextVirtual;

  payload.fields.forEach((src) => {
    if (src.sourceWidgetId == null || !Number.isFinite(Number(src.rangeMin)) || !Number.isFinite(Number(src.rangeMax)))
      return;
    const wid = src.sourceWidgetId;
    const w =
      engine.widgetManager.getWidget(wid) ||
      engine.widgetManager.getWidget(String(wid)) ||
      engine.widgetManager.getWidget(Number(wid));
    if (!w || w.type !== 'line-chart' || !w.settings) return;
    w.settings.dashboardBrushX = {
      modelId: src.modelId,
      table: src.table,
      field: src.field,
      fieldType: src.type,
      xMin: Number(src.rangeMin),
      xMax: Number(src.rangeMax),
      displayLabel: src.displayLabel != null ? String(src.displayLabel) : '',
      useIsoBounds: src.brushIso === true || src.useIsoBounds === true,
    };
    if (typeof w.update === 'function') w.update();
  });
  if (typeof engine.saveSnapshot === 'function') engine.saveSnapshot();
}

/**
 * Drop целой таблицы с панели «Данные» → виджет «Таблица»:
 * все поля таблицы становятся колонками (существующие заменяются).
 * @returns {boolean} true если применено
 */
export function applyDataTableToWidget(widget, payload) {
  if (!widget || widget.type !== 'table') return false;
  const modelId = payload?.modelId;
  const tableName = payload?.tableName;
  const fields = Array.isArray(payload?.fields) ? payload.fields : [];
  if (modelId == null || !tableName) return false;

  if (!widget.settings || typeof widget.settings !== 'object') {
    widget.settings = {};
  }
  widget.settings.bindingFields = fields
    .map((f) => {
      const fieldName = f?.name || f?.fieldName || f?.field;
      if (!fieldName) return null;
      const type = f?.type || 'string';
      return {
        modelId,
        table: tableName,
        field: fieldName,
        type,
        formula: `[${tableName}.${fieldName}]`,
      };
    })
    .filter(Boolean);

  widget.dataSource = {
    type: 'data-model',
    modelId,
    table: tableName,
    fieldType: widget.settings.bindingFields[0]?.type || 'string',
  };
  return true;
}

/**
 * Назначение поля с панели «Данные» на виджет.
 * Custom widgets may handle binding via definition.applyDataField.
 * Payload с kind === 'table' (или fields без fieldName) — см. applyDataTableToWidget.
 * @returns {'filter'|'chart'|'default'|'data_input'|'ignored'|string}
 */
export function applyDataFieldToWidget(widget, payload) {
  const isTablePayload =
    payload?.kind === 'table' ||
    (Array.isArray(payload?.fields) && !payload?.fieldName);

  if (isTablePayload) {
    return applyDataTableToWidget(widget, payload) ? 'default' : 'ignored';
  }

  const binding = {
    modelId: payload.modelId,
    table: payload.tableName,
    field: payload.fieldName,
    type: payload.type,
  };

  const engine =
    typeof window !== 'undefined' && window.engine ? window.engine : null;
  const def =
    engine && typeof engine.getWidgetDefinition === 'function'
      ? engine.getWidgetDefinition(widget?.type)
      : null;
  if (def && typeof def.applyDataField === 'function') {
    if (!widget.settings || typeof widget.settings !== 'object') {
      widget.settings = {};
    }
    const result = def.applyDataField(widget.settings, widget.dataSource || null, {
      ...binding,
      tableName: payload.tableName,
      fieldName: payload.fieldName,
      raw: payload,
    });
    if (result && typeof result === 'object') {
      if (result.settings) widget.settings = result.settings;
      if ('dataSource' in result) widget.dataSource = result.dataSource;
    }
    return def.type || widget.type || 'custom';
  }

  if (widget.type === 'filter') {
    if (!Array.isArray(widget.settings.filters)) widget.settings.filters = [];
    const newRow = {
      id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      modelId: binding.modelId,
      table: binding.table,
      field: binding.field,
      type: binding.type,
      pattern: '',
      selectedValues: [],
      excludedValues: [],
      appearance: 'auto',
      selection: 'auto',
    };
    const key = filterFieldKey(newRow);
    if (key && typeof window !== 'undefined' && window.engine?.widgetManager) {
      const widgets = window.engine.widgetManager.getAllWidgets();
      outer: for (let i = 0; i < widgets.length; i += 1) {
        const w = widgets[i];
        if (w.type !== 'filter' || !Array.isArray(w.settings?.filters)) continue;
        for (let j = 0; j < w.settings.filters.length; j += 1) {
          const f = w.settings.filters[j];
          if (filterFieldKey(f) !== key) continue;
          const hasSel = Array.isArray(f.selectedValues) && f.selectedValues.length > 0;
          const hasExc = Array.isArray(f.excludedValues) && f.excludedValues.length > 0;
          const hasPat = Boolean(patternToSqlLike(f.pattern || ''));
          if (hasSel || hasExc || hasPat || _hasRangeConstraint(f)) {
            newRow.selectedValues = Array.isArray(f.selectedValues) ? [...f.selectedValues] : [];
            newRow.excludedValues = Array.isArray(f.excludedValues) ? [...f.excludedValues] : [];
            newRow.pattern = f.pattern != null ? String(f.pattern) : '';
            newRow.rangeMin = f.rangeMin ?? null;
            newRow.rangeMax = f.rangeMax ?? null;
            break outer;
          }
        }
      }
    }
    widget.settings.filters.push(newRow);
    return 'filter';
  }

  if (widget.type === 'table') {
    if (!Array.isArray(widget.settings.bindingFields)) {
      widget.settings.bindingFields = [];
    }
    const ds = widget.dataSource;
    if (ds?.modelId != null && ds.modelId !== binding.modelId) {
      widget.settings.bindingFields = [];
    }
    const pairKey = `${binding.table}.${binding.field}`;
    if (
      !widget.settings.bindingFields.some(
        (b) => `${b.table}.${b.field}` === pairKey,
      )
    ) {
      widget.settings.bindingFields.push({
        modelId: binding.modelId,
        table: binding.table,
        field: binding.field,
        type: binding.type,
        formula: `[${binding.table}.${binding.field}]`,
      });
    }
    if (!ds?.table) {
      widget.dataSource = {
        type: 'data-model',
        modelId: binding.modelId,
        table: binding.table,
        fieldType: binding.type,
      };
    } else {
      widget.dataSource = {
        type: 'data-model',
        modelId: binding.modelId,
        table: ds.table,
        fieldType: binding.type,
      };
    }
    return 'default';
  }

  if (widget.type === 'data_input') {
    if (!Array.isArray(widget.settings.fields)) widget.settings.fields = [];
    widget.settings.modelId = binding.modelId;
    widget.settings.table = binding.table;
    const fieldName = String(binding.field || '').trim();
    if (
      fieldName &&
      !widget.settings.fields.some((f) => String(f?.name || '') === fieldName)
    ) {
      widget.settings.fields.push({
        name: fieldName,
        type: mapSchemaColumnToFieldType(binding.type),
        label: fieldName,
        required: false,
      });
    }
    widget.dataSource = {
      type: 'data-model',
      modelId: binding.modelId,
      table: binding.table,
    };
    return 'data_input';
  }

  const chartTypes = ['pie-chart', 'bar-chart', 'line-chart'];
  if (chartTypes.includes(widget.type)) {
    const withFormula = {
      ...binding,
      formula: `[${binding.table}.${binding.field}]`,
    };
    if (!widget.settings.bindingDimension) {
      widget.settings.bindingDimension = { ...withFormula };
    } else if (widget.type === 'line-chart') {
      if (!Array.isArray(widget.settings.bindingMeasures)) widget.settings.bindingMeasures = [];
      if (!widget.settings.bindingMeasure && !widget.settings.bindingMeasures.length) {
        widget.settings.bindingMeasure = { ...withFormula };
        widget.settings.bindingMeasures = [{ ...withFormula }];
      } else {
        const key = `${binding.modelId}::${binding.table}::${binding.field}`;
        const exists = widget.settings.bindingMeasures.some(
          (m) => `${m.modelId}::${m.table}::${m.field}` === key,
        );
        if (!exists) {
          widget.settings.bindingMeasures.push({
            ...withFormula,
            id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            label: String(binding.field || ''),
            visible: true,
          });
        }
        if (!widget.settings.bindingMeasure) {
          widget.settings.bindingMeasure = { ...widget.settings.bindingMeasures[0] };
        }
      }
    } else if (!widget.settings.bindingMeasure) {
      widget.settings.bindingMeasure = { ...withFormula };
    } else {
      widget.settings.bindingMeasure = { ...withFormula };
    }
    widget.dataSource = {
      type: 'data-model',
      modelId: binding.modelId,
      table: binding.table,
      field: binding.field,
      fieldType: binding.type,
    };
    return 'chart';
  }

  widget.dataSource = {
    type: 'data-model',
    modelId: binding.modelId,
    table: binding.table,
    field: binding.field,
    fieldType: binding.type,
  };

  // Button widget: wire Data-tab drop into filter action payload(s)
  if (widget.type === 'button-widget' || widget.type === 'button_widget') {
    if (!widget.settings || typeof widget.settings !== 'object') widget.settings = {};
    if (!Array.isArray(widget.settings.buttons)) widget.settings.buttons = [];
    const buttons = widget.settings.buttons;
    const targets =
      buttons.length > 0
        ? buttons.filter((b) => String(b?.action?.type || '').toLowerCase() === 'filter')
        : [];
    const applyTo =
      targets.length > 0
        ? targets
        : buttons.length > 0
          ? [buttons[0]]
          : [];
    if (applyTo.length === 0) {
      // create a default filter button if empty
      buttons.push({
        id: `btn_${Date.now()}`,
        label: binding.field || 'Фильтр',
        action: {
          type: 'filter',
          target: 'global',
          payload: {
            modelId: binding.modelId,
            table: binding.table,
            field: binding.field,
            type: binding.type || 'string',
          },
        },
      });
    } else {
      applyTo.forEach((btn) => {
        if (!btn.action || typeof btn.action !== 'object') {
          btn.action = { type: 'filter', target: 'global', payload: {} };
        }
        if (String(btn.action.type || '').toLowerCase() !== 'filter') {
          btn.action.type = 'filter';
        }
        if (!btn.action.payload || typeof btn.action.payload !== 'object') {
          btn.action.payload = {};
        }
        btn.action.payload.modelId = binding.modelId;
        btn.action.payload.table = binding.table;
        btn.action.payload.field = binding.field;
        if (binding.type) btn.action.payload.type = binding.type;
      });
    }
    widget.dataSource = {
      type: 'data-model',
      modelId: binding.modelId,
      table: binding.table,
      field: binding.field,
      fieldType: binding.type,
    };
    return 'button-filter';
  }

  return 'default';
}
