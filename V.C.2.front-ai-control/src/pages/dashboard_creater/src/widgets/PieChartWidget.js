import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { getDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import {
    collectDashboardFilters,
    filtersForModel,
    findFirstFilterRowByFieldKey,
    cycleFilterValueIncludeExcludeState,
    commitPieSliceIncludeStaging,
    ensureDashboardFilterRowExists,
} from '../../../../services/dashboardFilterUtils.js';
import { hasDataBinding, renderWidgetDataPlaceholder } from '../core/widgetDataBinding.js';
import { renderPieChartSvg } from './pie-chart/PieChartRenderer.js';
import { createPieLegendElement } from './pie-chart/PieLegendRenderer.js';
import { PieInteractionController } from './pie-chart/PieInteractionController.js';
import { svgCheck, svgCross } from '../../icons/dashboardCreaterIcons.js';
import { resolveKpiDataSourceFromFormula } from '../formula/formulaInference.js';
import { runNamedFormulaBundle } from '../formula/widgetFormulaRuntime.js';
import { tryCompileColorFormula } from '../formula/colorExpr.js';
import { normalizePieFormulaFields } from './common/widgetFormulaSchema.js';
import { resolveChartDimension, resolveChartMeasure, mergeChartMeasureFilters, chartMeasureAggColumn, chartMeasureForMatchesDimension } from './common/chartBindingFormula.js';
import { defaultTextColor, defaultFontFamily } from '../theme/themeRuntime.js';

/**
 * Круговая диаграмма: SVG-рендер, модульная легенда и интерактив.
 * Конфиг см. normalizePieConfig (pieChartConfig.js), в т.ч. вложенный settings.pie и settings.legend.
 */
export class PieChartWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'pie-chart',
            width: config.width || 400,
            height: config.height || 400,
        });

        this._pieController = null;
        /** @type {Set<string>|null} */
        this._pieSliceStagingSet = null;
        this._pieStagingBarEl = null;
        this._pieFilterHintEl = null;
        this._pieLegendRefresh = null;

        this.settings = {
            data: config.settings?.data || [],
            labelField: config.settings?.labelField || 'label',
            valueField: config.settings?.valueField || 'value',
            showLegend: config.settings?.showLegend !== false,
            colors: config.settings?.colors || ['#00E0FF', '#3D8BFF', '#005DFF', '#00FFB8', '#FF6B6B', '#FFD93D'],
            pieColorMode: config.settings?.pieColorMode || 'palette',
            pieSolidColor: config.settings?.pieSolidColor || '#00E0FF',
            donut: config.settings?.donut ?? false,
            innerRadius: config.settings?.innerRadius ?? 0.58,
            segmentPad: config.settings?.segmentPad ?? 0.04,
            segmentCornerRadius: config.settings?.segmentCornerRadius ?? 2,
            gradients: config.settings?.gradients,
            labels: config.settings?.labels,
            colorMode: config.settings?.colorMode || 'auto',
            legend: config.settings?.legend,
            pie: config.settings?.pie,
            pieHiddenIndices: config.settings?.pieHiddenIndices || [],
            /** @type {'auto'|'sum'|'count'} */
            pieSliceWeight: config.settings?.pieSliceWeight || 'auto',
            ...config.settings,
        };

        this.settings.center = {
            enabled: true,
            mode: 'default',
            template: '{total}',
            valueSource: 'segments',
            segmentAggregate: 'sum',
            measureFn: 'sum',
            numberFormat: 'compact',
            ...(typeof this.settings.center === 'object' && this.settings.center ? this.settings.center : {}),
        };

        this.settings.showTitle = this.settings.showTitle === true;
        if (this.settings.title == null || String(this.settings.title).trim() === '') {
            this.settings.title = 'Круговая диаграмма';
        }
        {
            const ts = parseInt(this.settings.titleSize, 10);
            this.settings.titleSize = Number.isFinite(ts) ? Math.min(48, Math.max(8, ts)) : 14;
        }

        normalizePieFormulaFields(this.settings);
    }

    _hiddenSet() {
        const arr = this.settings.pieHiddenIndices;
        return new Set(Array.isArray(arr) ? arr.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n)) : []);
    }

    _pieSyncStagingBarVisibility() {
        const el = this._pieStagingBarEl;
        if (!el) return;
        const set = this._pieSliceStagingSet;
        const dirty = Boolean(set && set.size > 0);
        el.classList.toggle('filter-dropdown-top--hidden', !dirty);
    }

    _pieSyncFilterHint(show) {
        const el = this._pieFilterHintEl;
        if (!el) return;
        el.classList.toggle('pie-filter-hint--hidden', !show);
    }

    _pieEngine() {
        return this._engine || (typeof window !== 'undefined' ? window.engine : null);
    }

    /**
     * OrderIndex-ы сегментов для подсветки: staging клика или уже применённый фильтр.
     * @param {object} [model]
     * @returns {number[]}
     */
    _pieStagingSelectedOrderIndices(model) {
        if (!model?.items) return [];
        /** @type {Set<string>} */
        const labels = new Set();
        const staging = this._pieSliceStagingSet;
        if (staging?.size) {
            staging.forEach((v) => labels.add(String(v)));
        } else {
            const engine = this._pieEngine();
            const dim = this.settings.bindingDimension;
            if (engine && dim?.field) {
                const fr = findFirstFilterRowByFieldKey(engine, dim)?.row;
                (Array.isArray(fr?.selectedValues) ? fr.selectedValues : []).forEach((v) => {
                    labels.add(String(v));
                });
            }
        }
        if (!labels.size) return [];
        /** @type {number[]} */
        const out = [];
        for (const item of model.items) {
            if (item?.isOther) continue;
            if (labels.has(String(item.label ?? ''))) out.push(item.orderIndex);
        }
        return out;
    }

    _pieSyncSliceSelectionVisual(model) {
        const ctrl = this._pieController;
        if (!ctrl || typeof ctrl.setSelectedOrderIndices !== 'function') return;
        ctrl.setSelectedOrderIndices(this._pieStagingSelectedOrderIndices(model));
    }

    _onPieSliceClickForStaging(orderIndex, model) {
        const item = model?.items?.find((x) => x.orderIndex === orderIndex);
        if (!item || item.isOther) return;
        if (!this._pieSliceStagingSet) this._pieSliceStagingSet = new Set();
        const v = String(item.label ?? '');
        if (this._pieSliceStagingSet.has(v)) this._pieSliceStagingSet.delete(v);
        else this._pieSliceStagingSet.add(v);
        this._pieSyncFilterHint(false);
        this._pieSyncStagingBarVisibility();
        this._pieSyncSliceSelectionVisual(model);
    }

    _pieCancelSliceStaging() {
        if (this._pieSliceStagingSet) this._pieSliceStagingSet.clear();
        this._pieSyncFilterHint(false);
        this._pieSyncStagingBarVisibility();
        this._pieSyncSliceSelectionVisual(this._pieLastModel);
    }

    _pieCommitSliceStaging(engine, dim) {
        if (!this._pieSliceStagingSet || this._pieSliceStagingSet.size === 0) return;
        const ensured = ensureDashboardFilterRowExists(engine, dim);
        if (!ensured.ok) {
            this._pieSyncFilterHint(true);
            return;
        }
        const r = commitPieSliceIncludeStaging(engine, dim, this._pieSliceStagingSet);
        if (!r.ok) {
            this._pieSyncFilterHint(true);
            return;
        }
        this._pieSliceStagingSet.clear();
        this._pieSyncFilterHint(false);
        this._pieSyncStagingBarVisibility();
        this._pieSyncSliceSelectionVisual(this._pieLastModel);
        eventBus.emit('dashboard:filters-changed', { source: 'pie-chart-slice' });
        if (typeof this.update === 'function') this.update();
    }

    _onPieLegendPrimary(orderIndex, model) {
        const engine = this._pieEngine();
        const dim = this.settings.bindingDimension;
        if (!engine || !dim?.field || !model?.items) return;
        const item = model.items.find((x) => x.orderIndex === orderIndex);
        if (!item || item.isOther) return;
        const ensured = ensureDashboardFilterRowExists(engine, dim);
        if (!ensured.ok) {
            this._pieSyncFilterHint(true);
            return;
        }
        this._pieSyncFilterHint(false);
        cycleFilterValueIncludeExcludeState(engine, ensured.row, item.label);
        eventBus.emit('dashboard:filters-changed', { source: 'pie-chart-legend' });
        if (typeof this._pieLegendRefresh === 'function') this._pieLegendRefresh();
    }

    getWidgetColorFormulaMap() {
        const s = this.settings || {};
        /** @type {Record<string, { hex?: string, formula?: string }>} */
        const map = {
            titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
            pieSolidColor: { hex: s.pieSolidColor, formula: s.pieSolidColorFormula },
            pieSliceAboveColor: {
                hex: s.pieSliceAboveColor,
                formula: s.pieSliceAboveColorFormula,
            },
            pieSliceBelowColor: {
                hex: s.pieSliceBelowColor,
                formula: s.pieSliceBelowColorFormula,
            },
        };
        const pal = Array.isArray(s.colors) ? s.colors : [];
        const pfx = Array.isArray(s.paletteFormulas) ? s.paletteFormulas : [];
        pal.forEach((hex, i) => {
            map[`palette_${i}`] = { hex, formula: pfx[i] || '' };
        });
        return map;
    }

    _pieSettingsWithResolvedColors() {
        const r = this._resolvedWidgetColors || {};
        const s = { ...this.settings };
        if (r.titleColor) s.titleColor = r.titleColor;
        if (r.pieSolidColor) s.pieSolidColor = r.pieSolidColor;
        if (r.pieSliceAboveColor) s.pieSliceAboveColor = r.pieSliceAboveColor;
        if (r.pieSliceBelowColor) s.pieSliceBelowColor = r.pieSliceBelowColor;
        if (Array.isArray(s.colors)) {
            s.colors = s.colors.map((hex, i) => r[`palette_${i}`] || hex);
        }
        return s;
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;

        if (this._pieController) {
            this._pieController.destroy();
            this._pieController = null;
        }

        const typography = this.styles?.typography || {};
        const fontFamily = typography.fontFamily || defaultFontFamily();
        const textColor = typography.color || defaultTextColor();
        const paintSettings = this._pieSettingsWithResolvedColors();

        if (!hasDataBinding(this)) {
            content.innerHTML = renderWidgetDataPlaceholder(this, typography);
            return;
        }

        if (paintSettings.bindingError) {
            const safe = String(paintSettings.bindingError)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--centered-msg" style="font-family:'${fontFamily}',sans-serif;color:${textColor};">
                    <div class="dash-widget-state-message">${safe}</div>
                </div>
            `;
            return;
        }

        const { data, labelField, valueField } = paintSettings;

        if (!data || data.length === 0) {
            content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--centered-msg" style="font-family:'${fontFamily}',sans-serif;color:${textColor};">
                    <div class="dash-widget-state-message">Нет строк по текущим фильтрам</div>
                </div>
            `;
            return;
        }

        let hiddenSet = this._hiddenSet();

        let result = renderPieChartSvg({
            data,
            labelField,
            valueField,
            settings: paintSettings,
            typography,
            appearance: this.styles?.appearance || {},
            hiddenSet,
            document: typeof document !== 'undefined' ? document : null,
        });

        if (!result.svg || !result.model || result.model.items.length === 0 || result.model.total <= 0) {
            const hint =
                Array.isArray(data) && data.length > 0
                    ? 'Данные есть, но вес всех сегментов нулевой. Выберите числовую меру, режим «Сумма» или «Количество» в панели стилей.'
                    : 'Нет строк по текущим фильтрам';
            content.innerHTML = `
                <div class="dash-widget-shell dash-widget-shell--centered-msg" style="font-family:'${fontFamily}',sans-serif;color:${textColor};">
                    <div class="dash-widget-state-message">${hint}</div>
                </div>
            `;
            return;
        }

        const visible = result.model.items.filter((it) => !hiddenSet.has(it.orderIndex));
        if (visible.length === 0 && result.model.items.length > 0) {
            this.settings.pieHiddenIndices = [];
            hiddenSet = new Set();
            result = renderPieChartSvg({
                data,
                labelField,
                valueField,
                settings: paintSettings,
                typography,
                appearance: this.styles?.appearance || {},
                hiddenSet,
                document: typeof document !== 'undefined' ? document : null,
            });
        }

        const cfg = result.cfg;
        if (!cfg) return;

        content.textContent = '';

        const engine = this._pieEngine();
        const dim = this.settings.bindingDimension;
        const canDataFilter = Boolean(
            engine && dim?.modelId != null && dim?.table && dim?.field,
        );

        const shell = document.createElement('div');
        shell.className = 'dash-widget-shell dash-widget-shell--column chart-widget-root pie-widget-root';
        shell.style.fontFamily = `'${fontFamily}', sans-serif`;
        shell.style.color = textColor;
        if (typography.fontSize) {
            shell.style.fontSize = `${typography.fontSize}px`;
        }

        if (paintSettings.showTitle) {
            const h = document.createElement('div');
            h.className = 'dash-widget-heading';
            h.textContent = String(paintSettings.title ?? '');
            const sz = parseInt(paintSettings.titleSize, 10);
            if (Number.isFinite(sz)) {
                h.style.fontSize = `${Math.min(48, Math.max(8, sz))}px`;
            }
            const titleColorRaw = String(paintSettings.titleColor || '').trim();
            if (/^#[0-9a-fA-F]{6}$/i.test(titleColorRaw)) {
                h.style.color = titleColorRaw;
            }
            shell.appendChild(h);
        }

        this._pieStagingBarEl = null;
        this._pieFilterHintEl = null;
        this._pieLegendRefresh = null;

        if (canDataFilter) {
            const stagingTop = document.createElement('div');
            stagingTop.className = 'filter-dropdown-top pie-staging-top filter-dropdown-top--hidden';
            stagingTop.innerHTML = `
      <div class="filter-values-confirm-bar" role="toolbar" aria-label="Подтверждение выбора сегментов">
        <button type="button" class="filter-confirm-btn filter-confirm-btn--apply" title="Применить к фильтру" aria-label="Применить к фильтру">${svgCheck}</button>
        <button type="button" class="filter-confirm-btn filter-confirm-btn--cancel" title="Отменить" aria-label="Отменить">${svgCross}</button>
      </div>`;
            const hintEl = document.createElement('div');
            hintEl.className = 'pie-filter-hint pie-filter-hint--hidden';
            hintEl.textContent =
                'Не удалось применить фильтр по сегменту. Проверьте привязку поля измерения к данным.';
            shell.appendChild(stagingTop);
            shell.appendChild(hintEl);
            this._pieStagingBarEl = stagingTop;
            this._pieFilterHintEl = hintEl;

            const applyBtn = stagingTop.querySelector('.filter-confirm-btn--apply');
            const cancelBtn = stagingTop.querySelector('.filter-confirm-btn--cancel');
            if (applyBtn) {
                applyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._pieCommitSliceStaging(engine, dim);
                });
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._pieCancelSliceStaging();
                });
            }
        }

        const body = document.createElement('div');
        body.className = 'dash-widget-chart-body pie-widget-body';

        const layout = document.createElement('div');
        layout.className = `pie-widget-layout pie-legend-pos-${cfg.legend.position} pie-legend-align-${cfg.legend.align}`;

        const chartHost = document.createElement('div');
        chartHost.className = 'pie-widget-chart-host';
        chartHost.appendChild(result.svg);

        let legendApi = null;
        let legendHost = null;
        if (cfg.legend.enabled) {
            legendHost = document.createElement('aside');
            legendHost.className = 'pie-widget-legend-host';
            legendApi = createPieLegendElement({
                model: result.model,
                cfg,
                typography,
                hiddenSet,
                getFilterRow:
                    canDataFilter && engine
                        ? () => findFirstFilterRowByFieldKey(engine, dim)?.row
                        : undefined,
            });
            legendHost.appendChild(legendApi.element);
            if (typeof legendApi.refresh === 'function') {
                this._pieLegendRefresh = () => legendApi.refresh();
            }
        }

        const pos = cfg.legend.position;
        if (pos === 'left' || pos === 'top') {
            if (legendHost) layout.appendChild(legendHost);
            layout.appendChild(chartHost);
        } else {
            layout.appendChild(chartHost);
            if (legendHost) layout.appendChild(legendHost);
        }

        body.appendChild(layout);
        shell.appendChild(body);
        content.appendChild(shell);

        const onToggleHidden = (orderIndex) => {
            const set = this._hiddenSet();
            if (set.has(orderIndex)) set.delete(orderIndex);
            else set.add(orderIndex);
            this.settings.pieHiddenIndices = Array.from(set);
            this.update();
            eventBus.emit('widget:styles-changed', { widget: this });
        };

        const onLegendPrimary =
            canDataFilter && cfg.legend.enabled && cfg.legend.interactive
                ? (orderIndex) => this._onPieLegendPrimary(orderIndex, result.model)
                : undefined;

        const onSliceClick = canDataFilter
            ? (orderIndex) => this._onPieSliceClickForStaging(orderIndex, result.model)
            : undefined;

        this._pieLastModel = result.model;
        this._pieController = new PieInteractionController({
            sliceMetas: result.sliceMetas,
            legendEl: legendApi?.element ?? null,
            cfg,
            model: result.model,
            centerTextEl: result.centerTextEl,
            centerMetric: result.centerMetric,
            rotatingG: result.rotatingG,
            svg: result.svg,
            initialRotationDeg: this.settings.pieRotationDeg,
            onRotationChange: (deg) => {
                this.settings.pieRotationDeg = deg;
                eventBus.emit('widget:styles-changed', { widget: this });
            },
            onToggleHidden: cfg.legend.enabled && cfg.legend.interactive ? onToggleHidden : undefined,
            onLegendPrimaryClick: onLegendPrimary,
            onSliceClick,
            selectedOrderIndices: this._pieStagingSelectedOrderIndices(result.model),
        });

        this._pieSyncStagingBarVisibility();
        this._pieSyncFilterHint(false);
    }

    setStyles(styles) {
        super.setStyles(styles);
        if (this.element) {
            this.render();
            this.applyStyles();
        }
    }

    async reloadFromDataModel(engine) {
        if (engine) this._engine = engine;
        const dimRaw = this.settings.bindingDimension;
        const measRaw = this.settings.bindingMeasure;
        const dim = resolveChartDimension(dimRaw);
        const meas = resolveChartMeasure(measRaw, {
            weightMode: this.settings.pieSliceWeight,
        });
        if (!engine || !dim || !meas) {
            this.update();
            return;
        }
        if (!dim.sqlOk || !meas.sqlOk) {
            this.settings.bindingError = dim.error || meas.error || 'Ошибка формулы привязки';
            this.settings.data = [];
            this.update();
            return;
        }
        const forMatch = chartMeasureForMatchesDimension(meas, dim);
        if (!forMatch.ok) {
            this.settings.bindingError = forMatch.error;
            this.settings.data = [];
            this.update();
            return;
        }
        if (String(dim.modelId) !== String(meas.modelId)) {
            console.warn('PieChart: измерение и мера должны быть из одной модели данных');
            this.settings.bindingError = 'Измерение и мера должны быть из одной модели данных';
            this.update();
            return;
        }
        try {
            delete this.settings.bindingError;
            delete this.settings.centerMeasureValue;
            const filters = mergeChartMeasureFilters(
                filtersForModel(collectDashboardFilters(engine), dim.modelId),
                meas,
            );
            const client = getDashboardDataModelClient(engine);
            const aggFn = String(meas.aggFn || 'sum').toLowerCase();
            const parseVal = typeof meas.parse === 'function' ? meas.parse : (raw) => {
                const n = parseFloat(raw);
                return Number.isFinite(n) ? n : 0;
            };
            const measureCol = chartMeasureAggColumn(dim, meas);
            const { rows } = await client.fetchAggregate({
                modelId: dim.modelId,
                base_table: dim.table,
                group_by: [dim.field],
                aggregations: [{ fn: aggFn, column: measureCol, as: 'value' }],
                filters,
                limit: 500,
            });
            this.settings.labelField = dim.field;
            this.settings.valueField = 'value';
            this.settings.data = (rows || []).map((r) => ({
                [dim.field]: r[dim.field],
                value: parseVal(r.value),
            }));
            this.settings.pieHiddenIndices = [];
            if (this._pieSliceStagingSet) this._pieSliceStagingSet.clear();

            delete this.settings._resolvedSliceThreshold;
            delete this.settings._pieSliceColorMode;
            delete this.settings._pieDimQualified;
            const pieThr = String(this.settings.pieSliceThresholdFormula || '').trim();
            if (pieThr && engine) {
                const colorCompiled = tryCompileColorFormula(pieThr);
                if (colorCompiled.ok) {
                    this.settings._pieSliceColorMode = true;
                    this.settings._pieDimQualified = `${dim.table}.${dim.field}`;
                    this.settings._resolvedSliceThreshold = null;
                } else {
                    try {
                        const resolved = await resolveKpiDataSourceFromFormula(
                            engine,
                            { modelId: dim.modelId, table: dim.table },
                            pieThr,
                        );
                        const mid = resolved?.modelId ?? dim.modelId;
                        const tbl = resolved?.table ?? dim.table;
                        if (mid != null && tbl) {
                            const b = await runNamedFormulaBundle(engine, mid, tbl, { pie_thr: pieThr }, null);
                            const n = b.byId.pie_thr?.numeric;
                            this.settings._resolvedSliceThreshold =
                                n != null && Number.isFinite(n) ? n : null;
                        }
                    } catch (e2) {
                        console.warn('PieChartWidget slice threshold formula', e2);
                        this.settings._resolvedSliceThreshold = null;
                    }
                }
            }

            const c = this.settings.center;
            if (c?.valueSource === 'measure' && this.settings.donut && c?.enabled !== false) {
                const fn = String(c.measureFn || 'sum').toLowerCase();
                if (['sum', 'avg', 'min', 'max', 'count'].includes(fn)) {
                    try {
                        const centerCol =
                            meas.field === '*' ? dim.field : chartMeasureAggColumn(dim, meas);
                        const { rows: rCenter } = await client.fetchAggregate({
                            modelId: dim.modelId,
                            base_table: dim.table,
                            group_by: [],
                            aggregations: [{ fn, column: centerCol, as: 'cv' }],
                            filters,
                            limit: 1,
                        });
                        const raw = rCenter?.[0]?.cv;
                        this.settings.centerMeasureValue =
                            raw !== undefined && raw !== null ? parseFloat(raw) : undefined;
                    } catch (e2) {
                        console.warn('PieChartWidget center measure', e2);
                    }
                }
            }

            this.dataSource = {
                type: 'data-model',
                modelId: dim.modelId,
                table: dim.table,
                field: dim.field,
                fieldType: dim.type,
            };
            this.update();
        } catch (e) {
            if (e?.name === 'AbortError') return;
            console.error('PieChartWidget reloadFromDataModel', e);
            const msg = e?.response?.data?.detail || e?.message || 'Ошибка загрузки данных';
            this.settings.bindingError =
                typeof msg === 'string' ? msg : JSON.stringify(msg);
            this.settings.data = [];
            this.update();
        }
    }

    toJSON() {
        const settings = { ...this.settings };
        delete settings.centerMeasureValue;
        delete settings.bindingError;
        delete settings._resolvedSliceThreshold;
        delete settings._pieSliceColorMode;
        delete settings._pieDimQualified;
        return {
            ...super.toJSON(),
            settings,
        };
    }

    fromJSON(json) {
        super.fromJSON(json);
        if (json.settings) {
            this.settings = { ...this.settings, ...json.settings };
        }
        delete this.settings.bindingError;
        if (this.settings.pieSliceWeight !== 'sum' && this.settings.pieSliceWeight !== 'count') {
            this.settings.pieSliceWeight = 'auto';
        }
        normalizePieFormulaFields(this.settings);
        this.settings.center = {
            enabled: true,
            mode: 'default',
            template: '{total}',
            valueSource: 'segments',
            segmentAggregate: 'sum',
            measureFn: 'sum',
            numberFormat: 'compact',
            ...(typeof this.settings.center === 'object' && this.settings.center ? this.settings.center : {}),
        };
        this.settings.showTitle = this.settings.showTitle === true;
        if (this.settings.title == null || String(this.settings.title).trim() === '') {
            this.settings.title = 'Круговая диаграмма';
        }
        {
            const ts = parseInt(this.settings.titleSize, 10);
            this.settings.titleSize = Number.isFinite(ts) ? Math.min(48, Math.max(8, ts)) : 14;
        }
        this.render();
    }
}
