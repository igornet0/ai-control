/**
 * WidgetStylePanel - Панель стилей виджета в футуристичном дизайне
 */

import { eventBus } from '../src/core/EventBus.js';
import { WIDGET_VARIANTS, WIDGET_DENSITIES } from '../src/core/WidgetBase.js';
import {
    getStylePanelDataBindingHintText,
    widgetNeedsStylePanelDataHint,
} from '../src/core/widgetDataBinding.js';
import {
    createGaugeTarget,
    getGaugeTargetPresets,
    GAUGE_TARGETS_MAX,
    normalizeGaugeSettings,
} from '../src/widgets/gauge/gaugeSettingsSchema.js';
import { syncFilterRowsByField } from '../../../services/dashboardFilterUtils.js';
import {
    getFormulaEditorModalHTML,
    wireFormulaEditorModal,
} from '../src/formula/formulaEditorModal.js';
import { tryCompileColorFormula } from '../src/formula/colorExpr.js';
import { getDashboardSchema } from '../../../services/dashboardSqliteSchemaService.js';
import {
    createDataInputFieldFromColumn,
    DATA_INPUT_FIELD_TYPES,
    DATA_INPUT_TEAM_ROLES,
    DEFAULT_DATA_INPUT_INSERT_ROLES,
    migrateInsertRoles,
    normalizeFieldDef,
} from '../src/widgets/data-input/dataInputSchema.js';
import { defaultSelectOptionsFormula } from '../src/widgets/data-input/dataInputSelectOptions.js';

/** Роли insert для data_input — TeamRole сотрудника. */
const DATA_INPUT_INSERT_ROLE_OPTIONS = DATA_INPUT_TEAM_ROLES.map((id) => ({
    id,
    label: id,
}));

const DATA_INPUT_FIELD_TYPE_LABELS = {
    text: 'Текст',
    textarea: 'Многострочный',
    number: 'Число',
    float: 'Дробное',
    boolean: 'Да/нет',
    select: 'Список',
    multiselect: 'Множественный выбор',
    date: 'Дата',
    datetime: 'Дата и время',
    email: 'Email',
    password: 'Пароль',
    tags: 'Теги',
    relation: 'Связь',
    file: 'Файл',
    image: 'Изображение',
    formula: 'Формула',
};
import { parseKpiBgRuleThresholdInput } from '../src/widgets/kpi/kpiBackgroundStyle.js';
import { clearKpiComputeQueryCache } from '../src/widgets/kpi/kpiCompute.js';
import {
    KPI_CURRENCY_OPTIONS,
    resolveKpiCurrencyOption,
} from '../src/widgets/kpi/kpiCurrencies.js';
import { invalidateDashboardTransportCaches } from '../../../services/dashboardFilterTransport.js';
import {
    svgStylePanelHeader,
    svgPaletteBrush,
    svgDragHandle,
    svgFormulaFxOpen,
} from '../icons/dashboardCreaterIcons.js';
import {
    LINE_TIMEFRAME_PRESETS,
    LINE_TIMEFRAME_PRESET_ORDER,
    decodeTimeframeSlot,
    encodeCustomTimeframeSlot,
    formatTimeframeSlotLabel,
    parseCustomTimeframeInput,
} from '../src/widgets/line-chart/lineChartTimeframe.js';
import { buildReferenceFromUiInput } from '../src/widgets/line-chart/lineChartReferenceFormula.js';
import { defaultTableColumnFormula } from '../src/widgets/common/tableColumnFormula.js';
import {
    applyChartBindingFormula,
    defaultChartBindingFormula,
} from '../src/widgets/common/chartBindingFormula.js';
import {
    BUTTON_ICON_OPTIONS,
    DEFAULT_BUTTON_STYLE,
    getButtonIconLabel,
    getButtonIconNoneSvg,
    getButtonIconSvg,
    normalizeButtonStylePartial,
    createUniqueButtonId,
} from '../src/widgets/button/ButtonItem.js';
import {
    BUTTON_ACTION_TYPES,
    normalizeButtonActionType,
} from '../src/widgets/button/ButtonAction.js';
import {
    BUTTON_PAYLOAD_EXAMPLES,
    getButtonPayloadExamplesForType,
} from '../src/widgets/button/buttonPayloadExamples.js';
import {
    DEFAULT_FILTER_BUTTON_STYLE,
    normalizeFilterButtonStyle,
} from '../src/widgets/filter/filterButtonStyle.js';
import { normalizeFilterStyle } from '../src/widgets/filter/filterStyle.js';
import {
    FILTER_APPEARANCE_OPTIONS,
    FILTER_SELECTION_OPTIONS,
    normalizeFilterAppearance,
    normalizeFilterSelection,
} from '../src/widgets/filter/filterAppearance.js';
import { sheetService } from '../../../services/sheetService.js';
import { dashboardService } from '../../../services/dashboardService.js';
import { mountSettingsPanelContribution } from '../src/sdk/mountSettingsPanel.js';

export class WidgetStylePanel {
    constructor(viewportController = null, engine = null) {
        this.currentWidget = null;
        this.panel = null;
        this.currentGradient = null;
        this._isLoadingWidgetStyles = false;
        this._loadingWidgetStylesDepth = 0;
        this.viewportController = viewportController;
        this.engine = engine || (typeof window !== 'undefined' ? window.engine : null);
        /** @type {null | (() => void)} */
        this._sdkPanelUnmount = null;
        this.init();
    }

    init() {
        this.createPanel();
        this.setupDataBindingChipListener();
        this.setupAccordions();
        this.setupWidgetPositionSync();
        this.setupLineChartTimeframeSlotEditors();
        this.setupLineChartReferenceEditor();
    }

    /**
     * Экземпляр виджета из WidgetManager по id (защита от устаревшей ссылки после пересоздания листа / DOM).
     */
    resolveLiveWidget(widget) {
        if (!widget?.id || !this.engine?.widgetManager?.getWidget) {
            return widget ?? null;
        }
        return this.engine.widgetManager.getWidget(widget.id) || widget;
    }

    /**
     * Убрать панель из DOM (например при размонтировании React, чтобы не копить дубликаты #widget-style-panel).
     */
    destroy() {
        this.closeButtonWidgetIconPicker?.();
        this.closeKpiCurrencyPicker?.();
        this.closeButtonPayloadHelpModal?.();
        if (this._buttonIconMenuEl?.parentNode) {
            this._buttonIconMenuEl.parentNode.removeChild(this._buttonIconMenuEl);
        }
        this._buttonIconMenuEl = null;
        if (this._kpiCurrencyMenuEl?.parentNode) {
            this._kpiCurrencyMenuEl.parentNode.removeChild(this._kpiCurrencyMenuEl);
        }
        this._kpiCurrencyMenuEl = null;
        if (this._buttonPayloadHelpModalEl?.parentNode) {
            this._buttonPayloadHelpModalEl.parentNode.removeChild(this._buttonPayloadHelpModalEl);
        }
        this._buttonPayloadHelpModalEl = null;
        if (this.panel) {
            this.hide();
            if (this.panel.parentNode) {
                this.panel.parentNode.removeChild(this.panel);
            }
        }
        this.panel = null;
        this.currentWidget = null;
        this._teardownSdkSettingsPanel();
    }

    _teardownSdkSettingsPanel() {
        if (typeof this._sdkPanelUnmount === 'function') {
            try {
                this._sdkPanelUnmount();
            } catch (err) {
                console.error('SDK settings panel unmount failed', err);
            }
        }
        this._sdkPanelUnmount = null;
    }

    /**
     * Mount definition.settingsPanel into #widget-sdk-settings-slot when present.
     * @returns {boolean} true if SDK panel is used (legacy type section should stay hidden)
     */
    _mountSdkSettingsPanel(widget) {
        this._teardownSdkSettingsPanel();
        const slot = this.panel?.querySelector('#widget-sdk-settings-slot');
        if (!slot || !widget) return false;

        const def =
            typeof this.engine?.getWidgetDefinition === 'function'
                ? this.engine.getWidgetDefinition(widget.type)
                : null;
        if (!def?.settingsPanel?.sections?.length) {
            slot.style.display = 'none';
            return false;
        }

        const mounted = mountSettingsPanelContribution(slot, def, {
            widget,
            engine: this.engine,
            openFormulaEditor: (opts) => {
                if (typeof this.openFormulaEditorModal === 'function') {
                    this.openFormulaEditorModal(opts || {});
                }
            },
        });
        this._sdkPanelUnmount = mounted.unmount;
        return true;
    }

    /**
     * Кнопка с иконкой fx у полей формул. Атрибуты: data-formula-mode, data-formula-target-id, data-formula-apply.
     * @param {string} dataAttrs
     * @returns {string}
     */
    formulaEditorOpenButton(dataAttrs = '') {
        return `<button type="button" class="formula-open-btn" ${dataAttrs} aria-label="Редактор формулы" title="Открыть редактор формулы"><span class="formula-open-btn__icon" aria-hidden="true">${svgFormulaFxOpen}</span></button>`;
    }

    /**
     * Блок «формула цвета» под picker.
     * @param {{ formulaId: string, applyKey?: string, placeholder?: string }} opts
     */
    renderColorFormulaFieldHtml(opts = {}) {
        const formulaId = opts.formulaId;
        if (!formulaId) return '';
        const applyKey = opts.applyKey || 'styles';
        const placeholder = opts.placeholder || 'IF([value] > 0, RGB(74,222,128), RGB(255,107,107)) или #RRGGBB';
        const formulaValue = String(opts.value || '');
        return `
            <div class="color-formula-field" data-color-formula-for="${this._escapeBindingText(formulaId)}">
                <div class="formula-label-with-btn" style="margin-top:0.35rem;">
                    <label class="style-label" for="${this._escapeBindingText(formulaId)}">Формула цвета</label>
                    ${this.formulaEditorOpenButton(
                        `data-formula-mode="direct" data-formula-target-id="${this._escapeBindingText(formulaId)}" data-formula-apply="${this._escapeBindingText(applyKey)}" data-formula-color="1"`,
                    )}
                </div>
                <textarea class="style-input color-formula-input" id="${this._escapeBindingText(formulaId)}" rows="2" spellcheck="false" placeholder="${this._escapeBindingText(placeholder)}" data-color-formula="1">${this._escapeBindingText(formulaValue)}</textarea>
                <div style="margin-top:0.25rem;font-size:0.68rem;color:var(--text-secondary);line-height:1.3;">Пусто — цвет из picker. Формула перекрывает (IF/RGB или агрегат → #RRGGBB).</div>
            </div>`;
    }

    /**
     * Color picker + text + формула.
     * @param {{
     *   label: string,
     *   colorId: string,
     *   textId?: string,
     *   formulaId?: string,
     *   value?: string,
     *   applyKey?: string,
     * }} opts
     */
    renderColorWithFormulaHtml(opts = {}) {
        const colorId = opts.colorId;
        const textId = opts.textId || `${colorId}-text`;
        const formulaId = opts.formulaId || `${colorId}-formula`;
        const value = /^#[0-9a-fA-F]{6}$/i.test(String(opts.value || '')) ? opts.value : '#888888';
        const label = opts.label || 'Цвет';
        const applyKey = opts.applyKey || 'styles';
        return `
            <div class="style-control-group color-with-formula" data-color-with-formula="${this._escapeBindingText(colorId)}">
                <label class="style-label" for="${this._escapeBindingText(textId)}">${this._escapeBindingText(label)}</label>
                <div class="color-picker-wrapper">
                    <div class="color-picker">
                        <input type="color" id="${this._escapeBindingText(colorId)}" value="${this._escapeBindingText(value)}">
                    </div>
                    <input type="text" class="style-input" id="${this._escapeBindingText(textId)}" value="${this._escapeBindingText(value)}" style="flex: 1;" autocomplete="off">
                </div>
                ${this.renderColorFormulaFieldHtml({ formulaId, applyKey })}
            </div>`;
    }

    /**
     * Под каждым input[type=color][id] добавляет поле формулы, если его ещё нет.
     */
    ensureColorFormulaFields() {
        if (!this.panel) return;
        const skipIds = new Set([
            'bar-chart-palette-add-color',
            'pie-chart-palette-add-color',
            'kpi-delta-color', // has dedicated formula textarea with same id suffix already wired
        ]);
        this.panel.querySelectorAll('input[type="color"][id]').forEach((pick) => {
            const id = pick.id;
            if (!id || skipIds.has(id)) return;
            const formulaId = `${id}-formula`;
            if (this.panel.querySelector(`#${CSS.escape(formulaId)}`)) return;
            if (pick.closest('.color-formula-field')) return;

            const applyKey =
                id.startsWith('style-') || id.startsWith('shadow-')
                    ? 'styles'
                    : this.currentWidget?.type || 'styles';

            const host =
                pick.closest('.color-picker-wrapper') ||
                pick.closest('.style-control-group') ||
                pick.parentElement;
            if (!host) return;
            const block = document.createElement('div');
            block.innerHTML = this.renderColorFormulaFieldHtml({ formulaId, applyKey });
            const node = block.firstElementChild;
            if (!node) return;
            if (host.classList?.contains('color-picker-wrapper')) {
                host.insertAdjacentElement('afterend', node);
            } else {
                host.appendChild(node);
            }
        });
    }

    readColorFormulaFromPanel(formulaId) {
        const el = this.panel?.querySelector(`#${CSS.escape(formulaId)}`);
        return String(el?.value || '').trim();
    }

    writeColorFormulaToPanel(formulaId, formula) {
        const el = this.panel?.querySelector(`#${CSS.escape(formulaId)}`);
        if (el) el.value = String(formula || '');
    }

    /**
     * Собрать colorFormulas map со всех textarea[data-color-formula].
     * @returns {Record<string, string>}
     */
    collectPanelColorFormulas() {
        /** @type {Record<string, string>} */
        const out = {};
        if (!this.panel) return out;
        this.panel.querySelectorAll('textarea.color-formula-input[id], textarea[data-color-formula][id]').forEach((ta) => {
            const id = ta.id;
            if (!id) return;
            const v = String(ta.value || '').trim();
            if (v) out[id] = v;
        });
        return out;
    }

    /**
     * Записать map формул в поля панели (id → value).
     * @param {Record<string, string>|null|undefined} map
     */
    loadPanelColorFormulas(map) {
        if (!this.panel) return;
        const m = map && typeof map === 'object' ? map : {};
        this.panel.querySelectorAll('textarea.color-formula-input[id], textarea[data-color-formula][id]').forEach((ta) => {
            const id = ta.id;
            if (!id) return;
            if (Object.prototype.hasOwnProperty.call(m, id)) {
                ta.value = String(m[id] || '');
            }
        });
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'widget-style-panel';
        panel.className = 'widget-style-panel hidden';
        
        panel.innerHTML = `
            <div class="widget-style-header">
                <div class="widget-style-header-icon">${svgStylePanelHeader}</div>
                <h3>Стиль виджета</h3>
            </div>
            <div class="widget-style-content">
                <div id="widget-data-binding-hint" class="widget-data-binding-hint hidden" role="status" aria-live="polite"></div>
                ${this.createLayoutSection()}
                ${this.createTabsSection()}
                ${this.createContainerTabPositionSection()}
                <div id="widget-sdk-settings-slot" class="widget-sdk-settings-slot" style="display: none;"></div>
                ${this.createGaugeSettingsSection()}
                ${this.createKpiSettingsSection()}
                ${this.createTextWidgetSettingsSection()}
                ${this.createHtmlWidgetSettingsSection()}
                ${this.createTableSettingsSection()}
                ${this.createPieChartSettingsSection()}
                ${this.createBarChartSettingsSection()}
                ${this.createLineChartSettingsSection()}
                ${this.createFilterWidgetSettingsSection()}
                ${this.createButtonWidgetSettingsSection()}
                ${this.createDataInputWidgetSettingsSection()}
                ${this.createDataBindingSection()}
                ${this.createAppearanceSection()}
                ${this.createTypographySection()}
                ${this.createBordersSection()}
                ${this.createShadowsSection()}
                ${this.createAnimationsSection()}
                ${this.createAdvancedCSSSection()}
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
        this.ensureColorFormulaFields();
    }

    createLayoutSection() {
        return `
            <div class="style-section expanded" data-section="layout">
                <div class="style-section-header">
                    <span class="style-section-title">Макет</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <div class="style-input-group">
                                <div>
                                    <label class="style-label">X</label>
                                    <input type="number" class="style-input" id="style-x" data-property="x">
                                </div>
                                <div>
                                    <label class="style-label">Y</label>
                                    <input type="number" class="style-input" id="style-y" data-property="y">
                                </div>
                                <div>
                                    <label class="style-label">W</label>
                                    <input type="number" class="style-input" id="style-w" data-property="width">
                                </div>
                                <div>
                                    <label class="style-label">H</label>
                                    <input type="number" class="style-input" id="style-h" data-property="height">
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Выравнивание</label>
                            <div class="alignment-grid">
                                <button class="alignment-btn" data-align="left" title="Слева">
                                    <svg class="alignment-icon" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M2 4h12M2 8h12M2 12h8"/>
                                    </svg>
                                </button>
                                <button class="alignment-btn active" data-align="center" title="По центру">
                                    <svg class="alignment-icon" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M3 4h10M4 8h8M5 12h6"/>
                                    </svg>
                                </button>
                                <button class="alignment-btn" data-align="right" title="Справа">
                                    <svg class="alignment-icon" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M2 4h12M4 8h12M6 12h10"/>
                                    </svg>
                                </button>
                                <button class="alignment-btn" data-align="top" title="Сверху">
                                    <svg class="alignment-icon" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 2v12M4 6h8M2 4h12"/>
                                    </svg>
                                </button>
                                <button class="alignment-btn active" data-align="middle" title="По центру">
                                    <svg class="alignment-icon" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 2v12M4 6h8M2 8h12"/>
                                    </svg>
                                </button>
                                <button class="alignment-btn" data-align="bottom" title="Снизу">
                                    <svg class="alignment-icon" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 2v12M4 6h8M2 12h12"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="style-control-group" id="style-allow-export-profile-group" style="margin-top:0.85rem;">
                            <div class="flex-between" style="align-items:center;gap:0.75rem;">
                                <div>
                                    <label class="style-label" for="style-allow-export-profile" style="margin-bottom:0.2rem;">Экспорт в профиль</label>
                                    <p style="margin:0;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                        Если выключено — кнопку закрепления не видно, а виджет скрыт в профиле.
                                    </p>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="style-allow-export-profile" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createAppearanceSection() {
        return `
            <div class="style-section" data-section="appearance">
                <div class="style-section-header">
                    <span class="style-section-title">Внешний вид</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div id="kpi-conditional-bg-block" class="kpi-conditional-bg-block" style="display:none;">
                            <div class="style-control-group" style="margin-bottom:0.75rem;padding-bottom:0.65rem;border-bottom:1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                                <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Фон KPI</div>
                                <p style="margin:0 0 0.5rem 0;font-size:0.72rem;color:var(--text-secondary);line-height:1.4;">
                                    Заливка области KPI: один цвет, правила по значению или по знаку дельты (сравнение периодов). Накладывается на содержимое; оболочка карточки — ниже («Тип фона»).
                                </p>
                            <label class="style-label" for="kpi-bg-mode">Режим</label>
                            <select class="style-select" id="kpi-bg-mode">
                                <option value="solid">Один цвет</option>
                                <option value="rules">По значению KPI</option>
                                <option value="delta">По дельте (Δ &lt; 0 / Δ &gt; 0)</option>
                            </select>
                            <div id="kpi-bg-solid-wrap" style="margin-top:0.5rem;">
                                <div class="flex-between" style="margin-bottom:0.45rem;">
                                    <label class="style-label" for="kpi-bg-solid-transparent">Без заливки (прозрачно)</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="kpi-bg-solid-transparent">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                <label class="style-label" for="kpi-bg-solid-color">Цвет фона</label>
                                <div class="color-picker-wrapper">
                                    <div class="color-picker">
                                        <input type="color" id="kpi-bg-solid-color" value="#0d1117">
                                    </div>
                                </div>
                            </div>
                            <div id="kpi-bg-rules-wrap" style="display:none;margin-top:0.5rem;">
                                <label class="style-label" for="kpi-bg-preset">Быстрый шаблон</label>
                                <select class="style-select" id="kpi-bg-preset">
                                    <option value="">— выберите —</option>
                                    <option value="traffic">Трафик: &lt; 0 красный / ≥ 0 зелёный</option>
                                    <option value="threshold100">Порог: ≥ 100 зелёный</option>
                                </select>
                                <div style="margin-top:0.45rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                    Правила сравниваются с числом KPI сверху вниз; первое совпадение задаёт цвет.
                                </div>
                                <div id="kpi-bg-rules-list" style="margin-top:0.65rem;"></div>
                                <button type="button" class="btn btn-secondary" id="kpi-bg-add-rule" style="margin-top:0.5rem;">Добавить правило</button>
                            </div>
                            <div id="kpi-bg-delta-wrap" style="display:none;margin-top:0.5rem;">
                                <div style="font-size:0.72rem;color:var(--text-secondary);line-height:1.35;margin-bottom:0.5rem;">
                                    Фон по абсолютной дельте (текущий период минус база сравнения). При отсутствии сравнения или при Δ = 0 используется цвет «по умолчанию» ниже.
                                </div>
                                <label class="style-label" for="kpi-bg-delta-neg">Фон при Δ &lt; 0</label>
                                <div class="color-picker-wrapper" style="margin-bottom:0.5rem;">
                                    <div class="color-picker">
                                        <input type="color" id="kpi-bg-delta-neg" value="#c62828">
                                    </div>
                                </div>
                                <label class="style-label" for="kpi-bg-delta-pos">Фон при Δ &gt; 0</label>
                                <div class="color-picker-wrapper">
                                    <div class="color-picker">
                                        <input type="color" id="kpi-bg-delta-pos" value="#2e7d32">
                                    </div>
                                </div>
                            </div>
                            <div id="kpi-bg-non-solid-fallback-wrap" style="display:none;margin-top:0.55rem;">
                                <label class="style-label" for="kpi-bg-default-color">Цвет по умолчанию</label>
                                <div style="margin:0 0 0.35rem 0;font-size:0.7rem;color:var(--text-secondary);line-height:1.35;">
                                    Правила: ни одно не подошло. Дельта: нет сравнения или Δ = 0.
                                </div>
                                <div class="flex-between" style="margin-bottom:0.35rem;">
                                    <label class="style-label" for="kpi-bg-default-transparent" style="font-size:0.8rem;">Прозрачный</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="kpi-bg-default-transparent">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                <input type="color" class="style-input" id="kpi-bg-default-color" value="#0d1117" style="max-width:120px;height:36px;padding:2px;">
                            </div>
                            </div>
                        </div>
                        <p id="appearance-kpi-shell-hint" style="display:none;margin:0 0 0.65rem 0;font-size:0.72rem;color:var(--text-secondary);line-height:1.4;">
                            <strong>Фон контейнера</strong> (ниже): градиент, стекло, прозрачность — оболочка виджета. Для KPI сверху дополнительно задан «Фон KPI».
                        </p>
                        <div id="filter-appearance-block" class="filter-appearance-block" style="display:none;">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Отображение фильтра</div>
                            <p class="filter-appearance-hint">
                                Для каждого поля — как выбирать значение. <strong>Авто</strong> подбирает контрол по типу и числу значений (enum → сегменты/чипы, число → слайдер, много значений → Select).
                            </p>
                            <div id="filter-appearance-fields"></div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Стиль карточки</label>
                            <select class="style-select" id="style-variant">
                                <option value="glass">Стекло</option>
                                <option value="solid">Сплошной</option>
                                <option value="outline">Контур</option>
                                <option value="minimal">Минимал (без рамки и фона)</option>
                                <option value="elevated">Приподнятый</option>
                                <option value="accent">Акцент (полоса слева)</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Плотность</label>
                            <select class="style-select" id="style-density">
                                <option value="compact">Компактно</option>
                                <option value="normal" selected>Обычно</option>
                                <option value="spacious">Просторно</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Тип фона</label>
                            <select class="style-select" id="style-bg-type">
                                <option value="">По умолчанию (из стиля карточки)</option>
                                <option value="solid">Сплошной цвет</option>
                                <option value="gradient">Градиент</option>
                                <option value="glass">Стеклянный режим</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="bg-solid-controls">
                            <label class="style-label">Цвет фона</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="style-bg-color" value="#1a1d22">
                                </div>
                                <input type="text" class="style-input" id="style-bg-color-text" value="#1a1d22" style="flex: 1;">
                            </div>
                        </div>
                        <div class="style-control-group" id="bg-gradient-controls" style="display: none;">
                            <label class="style-label">Градиенты</label>
                            <div class="gradient-presets">
                                <div class="gradient-preset" data-gradient="linear-gradient(135deg, #005DFF, #00E0FF)" style="background: linear-gradient(135deg, #005DFF, #00E0FF);"></div>
                                <div class="gradient-preset" data-gradient="linear-gradient(135deg, #667eea, #764ba2)" style="background: linear-gradient(135deg, #667eea, #764ba2);"></div>
                                <div class="gradient-preset" data-gradient="linear-gradient(135deg, #f093fb, #f5576c)" style="background: linear-gradient(135deg, #f093fb, #f5576c);"></div>
                                <div class="gradient-preset" data-gradient="linear-gradient(135deg, #4facfe, #00f2fe)" style="background: linear-gradient(135deg, #4facfe, #00f2fe);"></div>
                            </div>
                            <button class="add-shadow-btn" id="btn-custom-gradient" type="button">Пользовательский градиент</button>
                            <div id="bg-custom-gradient-controls" class="custom-gradient-controls" style="display: none;">
                                <div class="style-control-group" style="margin-top: 0.5rem;">
                                    <label class="style-label" for="style-gradient-type">Тип градиента</label>
                                    <select class="style-select" id="style-gradient-type">
                                        <option value="linear">Линейный</option>
                                        <option value="radial">Радиальный</option>
                                    </select>
                                </div>
                                <div class="style-control-group" id="style-gradient-angle-row">
                                    <label class="style-label" for="style-gradient-angle">Угол</label>
                                    <div class="slider-container">
                                        <input type="range" class="style-slider" id="style-gradient-angle" min="0" max="360" value="135">
                                        <span class="slider-value" id="style-gradient-angle-value">135°</span>
                                    </div>
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="style-gradient-color1-text">Цвет 1</label>
                                    <div class="color-picker-wrapper">
                                        <div class="color-picker">
                                            <input type="color" id="style-gradient-color1" value="#005DFF">
                                        </div>
                                        <input type="text" class="style-input" id="style-gradient-color1-text" value="#005DFF" style="flex: 1;">
                                    </div>
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="style-gradient-color2-text">Цвет 2</label>
                                    <div class="color-picker-wrapper">
                                        <div class="color-picker">
                                            <input type="color" id="style-gradient-color2" value="#00E0FF">
                                        </div>
                                        <input type="text" class="style-input" id="style-gradient-color2-text" value="#00E0FF" style="flex: 1;">
                                    </div>
                                </div>
                                <div class="custom-gradient-preview" id="style-gradient-preview" aria-hidden="true"></div>
                            </div>
                        </div>
                        <div class="style-control-group" id="bg-glass-controls" style="display: none;">
                            <div class="glass-controls">
                                <div class="flex-between">
                                    <label class="style-label">Стеклянный режим</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="style-glass-enabled">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                <div class="slider-container">
                                    <label class="style-label">Размытие</label>
                                    <input type="range" class="style-slider" id="style-glass-blur" min="0" max="20" value="8">
                                    <span class="slider-value" id="glass-blur-value">8px</span>
                                </div>
                                <div class="slider-container">
                                    <label class="style-label">Прозрачность</label>
                                    <input type="range" class="style-slider" id="style-glass-opacity" min="0" max="1" step="0.1" value="0.1">
                                    <span class="slider-value" id="glass-opacity-value">0.1</span>
                                </div>
                                <div class="color-picker-wrapper">
                                    <label class="style-label">Оттенок</label>
                                    <div class="color-picker">
                                        <input type="color" id="style-glass-color" value="#ffffff">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Прозрачность</label>
                                <input type="range" class="style-slider" id="style-opacity" min="0" max="1" step="0.01" value="1">
                                <span class="slider-value" id="opacity-value">100%</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Режим наложения</label>
                            <select class="style-select" id="style-blend-mode">
                                <option value="normal">Обычный</option>
                                <option value="multiply">Умножение</option>
                                <option value="screen">Экран</option>
                                <option value="overlay">Перекрытие</option>
                                <option value="soft-light">Мягкий свет</option>
                                <option value="hard-light">Жесткий свет</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createTypographySection() {
        return `
            <div class="style-section" data-section="typography">
                <div class="style-section-header">
                    <span class="style-section-title">Типографика</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <p id="typography-widget-context-hint" class="gauge-panel-cross-hint" style="display:none;" role="note"></p>
                        <div class="style-control-group">
                            <label class="style-label">Семейство шрифтов</label>
                            <select class="style-select" id="style-font-family">
                                <option value="Inter">Inter</option>
                                <option value="Roboto">Roboto</option>
                                <option value="JetBrains Mono">JetBrains Mono</option>
                                <option value="Arial">Arial</option>
                                <option value="Georgia">Georgia</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Насыщенность шрифта</label>
                                <input type="range" class="style-slider" id="style-font-weight" min="100" max="900" step="100" value="400">
                                <span class="slider-value" id="font-weight-value">400</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Размер шрифта</label>
                                <input type="range" class="style-slider" id="style-font-size" min="8" max="72" value="16">
                                <span class="slider-value" id="font-size-value">16px</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Межбуквенное расстояние</label>
                                <input type="range" class="style-slider" id="style-letter-spacing" min="-2" max="10" step="0.1" value="0">
                                <span class="slider-value" id="letter-spacing-value">0px</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Высота строки</label>
                                <input type="range" class="style-slider" id="style-line-height" min="0.8" max="3" step="0.1" value="1.5">
                                <span class="slider-value" id="line-height-value">1.5</span>
                            </div>
                        </div>
                        <div class="style-control-group" id="style-typography-text-color-row">
                            <label class="style-label">Цвет текста</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="style-text-color" value="#000000">
                                </div>
                                <input type="text" class="style-input" id="style-text-color-text" value="#000000" style="flex: 1;">
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Тень текста</label>
                            <input type="text" class="style-input" id="style-text-shadow" placeholder="0 0 12px #00E0FF">
                        </div>
                        <div id="kpi-number-format-typography" style="display:none;margin-top:0.75rem;padding-top:0.65rem;border-top:1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.45rem;">Формат числа KPI</div>
                            <div class="style-control-group">
                                <label class="style-label" for="kpi-format">Формат числа</label>
                                <select class="style-select" id="kpi-format">
                                    <option value="number">Число</option>
                                    <option value="currency">Валюта</option>
                                    <option value="percent">Доля как % (значение×100)</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="kpi-currency-row">
                                <label class="style-label" id="kpi-currency-label">Валюта</label>
                                <input type="hidden" id="kpi-currency" value="USD">
                                <button
                                    type="button"
                                    class="kpi-currency-trigger"
                                    id="kpi-currency-trigger"
                                    aria-haspopup="menu"
                                    aria-expanded="false"
                                    aria-labelledby="kpi-currency-label"
                                    title="Выбрать валюту"
                                >
                                    <span class="kpi-currency-trigger__symbol" data-kpi-currency-symbol aria-hidden="true">$</span>
                                    <span class="kpi-currency-trigger__meta">
                                        <span class="kpi-currency-trigger__code" data-kpi-currency-code-label>USD</span>
                                        <span class="kpi-currency-trigger__name" data-kpi-currency-name>Доллар США</span>
                                    </span>
                                    <span class="kpi-currency-trigger__chevron" aria-hidden="true">▾</span>
                                </button>
                            </div>
                            <div class="style-control-group">
                                <label class="style-label" for="kpi-decimals">Знаков после запятой</label>
                                <input type="number" class="style-input" id="kpi-decimals" min="0" max="8" step="1" value="2">
                            </div>
                            <div class="style-control-group">
                                <div class="flex-between">
                                    <label class="style-label">Компактные числа (1k, 1.2M)</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="kpi-number-compact" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="text-preview" id="typography-preview">
                            Предпросмотр текста
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createBordersSection() {
        return `
            <div class="style-section" data-section="borders">
                <div class="style-section-header">
                    <span class="style-section-title">Границы и углы</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="border-preview" id="border-preview">
                            <div class="border-preview-inner"></div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Ширина границы</label>
                                <input type="range" class="style-slider" id="style-border-width" min="0" max="20" value="0">
                                <span class="slider-value" id="border-width-value">0px</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Стиль границы</label>
                            <select class="style-select" id="style-border-style">
                                <option value="solid">Сплошная</option>
                                <option value="dashed">Пунктирная</option>
                                <option value="dotted">Точечная</option>
                                <option value="double">Двойная</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Цвет границы</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="style-border-color" value="#00E0FF">
                                </div>
                                <input type="text" class="style-input" id="style-border-color-text" value="#00E0FF" style="flex: 1;">
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label">Неоновое свечение</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="style-neon-glow-enabled">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div id="neon-glow-controls" style="display: none;">
                                <div class="slider-container">
                                    <label class="style-label">Интенсивность</label>
                                    <input type="range" class="style-slider" id="style-neon-intensity" min="0" max="30" value="12">
                                    <span class="slider-value" id="neon-intensity-value">12px</span>
                                </div>
                                <div class="slider-container">
                                    <label class="style-label">Распространение</label>
                                    <input type="range" class="style-slider" id="style-neon-spread" min="0" max="20" value="0">
                                    <span class="slider-value" id="neon-spread-value">0px</span>
                                </div>
                                <div class="color-picker-wrapper">
                                    <label class="style-label">Цвет свечения</label>
                                    <div class="color-picker">
                                        <input type="color" id="style-neon-color" value="#00E0FF">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Радиус углов</label>
                                <input type="range" class="style-slider" id="style-border-radius" min="0" max="50" value="0">
                                <span class="slider-value" id="border-radius-value">0px</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createShadowsSection() {
        return `
            <div class="style-section" data-section="shadows">
                <div class="style-section-header">
                    <span class="style-section-title">Тени</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div id="shadow-layers"></div>
                        <button class="add-shadow-btn" id="btn-add-shadow">+ Добавить тень</button>
                    </div>
                </div>
            </div>
        `;
    }

    createAnimationsSection() {
        return `
            <div class="style-section" data-section="animations">
                <div class="style-section-header">
                    <span class="style-section-title">Анимации</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="animation-preview" id="animation-preview">
                            <div class="animation-preview-box"></div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label">Включить анимацию</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="style-animation-enabled">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div id="animation-controls-wrapper" style="display: none;">
                            <div class="style-control-group">
                                <label class="style-label">Тип анимации</label>
                                <select class="style-select" id="style-animation-type">
                                    <option value="fade">Затухание</option>
                                    <option value="pulse">Пульсация</option>
                                    <option value="slideIn">Появление</option>
                                    <option value="scaleIn">Масштабирование</option>
                                    <option value="hoverGlow">Свечение при наведении</option>
                                    <option value="neonBreathing">Неоновое дыхание</option>
                                </select>
                            </div>
                            <div class="style-control-group">
                                <div class="slider-container">
                                    <label class="style-label">Длительность</label>
                                    <input type="range" class="style-slider" id="style-animation-duration" min="0.1" max="5" step="0.1" value="1">
                                    <span class="slider-value" id="animation-duration-value">1s</span>
                                </div>
                            </div>
                            <div class="style-control-group">
                                <label class="style-label">Плавность</label>
                                <select class="style-select" id="style-animation-easing">
                                    <option value="ease">Плавно</option>
                                    <option value="ease-in">Ускорение</option>
                                    <option value="ease-out">Замедление</option>
                                    <option value="ease-in-out">Ускорение-замедление</option>
                                    <option value="linear">Линейно</option>
                                </select>
                            </div>
                            <div class="style-control-group">
                                <div class="slider-container">
                                    <label class="style-label">Задержка</label>
                                    <input type="range" class="style-slider" id="style-animation-delay" min="0" max="3" step="0.1" value="0">
                                    <span class="slider-value" id="animation-delay-value">0s</span>
                                </div>
                            </div>
                            <div class="style-control-group">
                                <div class="flex-between">
                                    <label class="style-label">Повтор</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="style-animation-loop">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createTextWidgetSettingsSection() {
        return `
            <div class="style-section text-widget-settings-section" data-section="text" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Текст</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <label class="style-label" for="text-widget-mode">Режим</label>
                            <select class="style-select" id="text-widget-mode">
                                <option value="static">Статический текст</option>
                                <option value="dynamic">Динамический (формулы)</option>
                            </select>
                        </div>
                        <div id="text-widget-static-block">
                            <div class="style-control-group">
                                <label class="style-label" for="text-widget-static-text">Текст</label>
                                <textarea class="style-input" id="text-widget-static-text" rows="4" placeholder="Введите текст…" autocomplete="off"></textarea>
                            </div>
                        </div>
                        <div id="text-widget-dynamic-block" style="display:none;">
                            <div class="style-control-group">
                                <label class="style-label" for="text-widget-timestamp-display">Даты MIN/MAX</label>
                                <select class="style-select" id="text-widget-timestamp-display">
                                    <option value="local">Как в системе (локально)</option>
                                    <option value="utc">UTC</option>
                                </select>
                                <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                    Как показывать результат одиночных MIN/MAX по полю даты в плейсхолдерах.
                                </div>
                            </div>
                            <div class="style-control-group">
                                <div class="formula-label-with-btn">
                                    <label class="style-label" for="text-widget-template">Шаблон</label>
                                    ${this.formulaEditorOpenButton('data-formula-mode="text-template"')}
                                </div>
                                <textarea class="style-input" id="text-widget-template" rows="4" placeholder="Например: Выручка: {SUM([orders.amount])}" autocomplete="off"></textarea>
                                <div style="margin-top:0.45rem;font-size:0.72rem;color:var(--text-secondary);">
                                    Плейсхолдеры <code>{…}</code> — формулы (SUM, AVG, COUNT, MIN, MAX и арифметика). COUNT считает строки после фильтров.
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group" style="margin-top:0.5rem;padding-top:0.55rem;border-top:1px dashed var(--border-subtle, rgba(255,255,255,0.08));">
                            <div style="font-size:0.72rem;color:var(--text-secondary);line-height:1.35;margin-bottom:0.45rem;">
                                Формулы стиля (агрегаты): фон блока и цвет текста — результат как <code>#RRGGBB</code>; видимость — 0 скрыть, иначе показать.
                            </div>
                            <div class="formula-label-with-btn">
                                <label class="style-label" for="text-widget-bg-formula">Фон блока</label>
                                ${this.formulaEditorOpenButton(
                                    'data-formula-mode="direct" data-formula-target-id="text-widget-bg-formula" data-formula-apply="text-widget"',
                                )}
                            </div>
                            <textarea class="style-input" id="text-widget-bg-formula" rows="2" spellcheck="false" placeholder="#1a1d24"></textarea>
                            <div class="formula-label-with-btn" style="margin-top:0.45rem;">
                                <label class="style-label" for="text-widget-fg-formula">Цвет текста</label>
                                ${this.formulaEditorOpenButton(
                                    'data-formula-mode="direct" data-formula-target-id="text-widget-fg-formula" data-formula-apply="text-widget"',
                                )}
                            </div>
                            <textarea class="style-input" id="text-widget-fg-formula" rows="2" spellcheck="false" placeholder="#E4E6EB"></textarea>
                            <div class="formula-label-with-btn" style="margin-top:0.45rem;">
                                <label class="style-label" for="text-widget-vis-formula">Видимость (0/1)</label>
                                ${this.formulaEditorOpenButton(
                                    'data-formula-mode="direct" data-formula-target-id="text-widget-vis-formula" data-formula-apply="text-widget"',
                                )}
                            </div>
                            <textarea class="style-input" id="text-widget-vis-formula" rows="2" spellcheck="false" placeholder="1"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createHtmlWidgetSettingsSection() {
        return `
            <div class="style-section html-widget-settings-section expanded" data-section="html" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">HTML</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <label class="style-label" for="html-widget-code">HTML-код</label>
                            <textarea
                                class="style-input html-widget-code-input"
                                id="html-widget-code"
                                rows="12"
                                spellcheck="false"
                                autocomplete="off"
                                placeholder="<div style=&quot;padding:12px&quot;>Hello</div>"
                            ></textarea>
                            <div style="margin-top:0.45rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Содержимое вставляется во виджет как HTML. Стили фона/рамки виджета настраиваются в секциях «Внешний вид» и «Границы».
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createKpiSettingsSection() {
        return `
            <div class="style-section kpi-settings-section expanded" data-section="kpi" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">KPI и дельта</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="kpi-show-title">Показывать заголовок</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="kpi-show-title" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="kpi-widget-title-row">
                            <label class="style-label" for="kpi-widget-title">Текст заголовка</label>
                            <input type="text" class="style-input" id="kpi-widget-title" maxlength="200" placeholder="Например: Общая сумма" autocomplete="off">
                        </div>
                        <div class="style-control-group" id="kpi-title-size-row">
                            <label class="style-label" for="kpi-title-size">Размер заголовка (px)</label>
                            <input type="number" class="style-input" id="kpi-title-size" min="8" max="48" step="1" placeholder="по умолчанию">
                        </div>
                        <div class="style-control-group" id="kpi-title-color-row">
                            <label class="style-label" for="kpi-title-color-text">Цвет текста заголовка</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="kpi-title-color" value="#B0B3B8">
                                </div>
                                <input type="text" class="style-input" id="kpi-title-color-text" value="#B0B3B8" style="flex: 1;">
                            </div>
                        </div>
                        <details class="kpi-settings-sub" open>
                            <summary class="kpi-settings-sub-summary">Значение и формула</summary>
                            <div class="kpi-settings-sub-body">
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-mode">Режим значения</label>
                            <select class="style-select" id="kpi-mode">
                                <option value="simple">Простой (поле + агрегат)</option>
                                <option value="formula">Формула</option>
                            </select>
                        </div>
                        <div id="kpi-mode-simple-block" class="style-control-group">
                            <label class="style-label" for="kpi-value-field">Поле значения</label>
                            <select class="style-select" id="kpi-value-field">
                                <option value="">— выберите —</option>
                            </select>
                            <label class="style-label" for="kpi-aggregation" style="margin-top:0.65rem;">Агрегация</label>
                            <select class="style-select" id="kpi-aggregation">
                                <option value="sum">SUM</option>
                                <option value="avg">AVG</option>
                                <option value="count">COUNT</option>
                                <option value="min">MIN</option>
                                <option value="max">MAX</option>
                            </select>
                            <div id="kpi-count-mode-row" style="display:none;margin-top:0.65rem;">
                                <label class="style-label" for="kpi-count-mode">COUNT считает</label>
                                <select class="style-select" id="kpi-count-mode">
                                    <option value="rows">Все строки (COUNT(*))</option>
                                    <option value="non_null">Непустые значения поля (COUNT(field))</option>
                                    <option value="distinct">Уникальные значения поля (COUNT DISTINCT)</option>
                                </select>
                            </div>
                        </div>
                        <div id="kpi-mode-formula-block" class="style-control-group" style="display:none;">
                            <div class="formula-label-with-btn">
                                <label class="style-label" for="kpi-value-formula">Формула значения</label>
                                ${this.formulaEditorOpenButton('data-formula-mode="kpi"')}
                            </div>
                            <textarea class="style-input" id="kpi-value-formula" rows="3" spellcheck="false" placeholder="SUM([Таблица.Колонка]) / COUNT(*)"></textarea>
                            <details style="margin-top:0.5rem;">
                                <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-secondary);">Подсказка по формуле</summary>
                                <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.4;">
                                    Только агрегаты (SUM, AVG, COUNT, MIN, MAX) и арифметика. Фильтры дашборда учитываются.
                                    Имя таблицы в выражении (<code style="font-size:0.85em;">SUM(таблица.колонка)</code>) должно совпадать с таблицей источника виджета (базовая таблица модели); иначе агрегат не попадёт в запрос.
                                </div>
                            </details>
                        </div>
                            </div>
                        </details>
                        <details class="kpi-settings-sub" open>
                            <summary class="kpi-settings-sub-summary">Период и колонка даты</summary>
                            <div class="kpi-settings-sub-body">
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-date-field">Колонка даты</label>
                            <select class="style-select" id="kpi-date-field">
                                <option value="">— выберите —</option>
                            </select>
                            <details style="margin-top:0.45rem;">
                                <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-secondary);">Как используется дата</summary>
                                <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.4;">
                                    Если на дашборде задан период по этому полю (кисть линейного графика или фильтр gte/lte) — он задаёт текущий интервал. Иначе используется запасной диапазон ниже. Без обоих дельта скрыта.
                                </div>
                            </details>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-granularity">Шаг времени (границы периода)</label>
                            <select class="style-select" id="kpi-granularity">
                                <option value="auto">Авто (по интервалу между метками; не календарный месяц)</option>
                                <option value="minute">Минута</option>
                                <option value="hour">Час</option>
                                <option value="day">День</option>
                                <option value="week">Неделя (с Пн)</option>
                                <option value="month">Месяц (календарный: 1-е 00:00 — конец месяца по последней дате в данных)</option>
                            </select>
                            <details style="margin-top:0.45rem;">
                                <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-secondary);">Как влияет на сумму и дельту</summary>
                                <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.4;">
                                    С колонкой даты KPI считается только внутри текущего интервала (фильтр дашборда или запасной диапазон / авто по последней дате). Этот шаг выравнивает начало и конец интервала (например, полный календарный месяц или неделя с понедельника). Дельта — то же правило для предыдущего периода (для «месяц» — предыдущий календарный месяц). Без колонки даты — только формула по всем строкам с учётом фильтров. Календарь — локальная таймзона браузера.
                                    <strong style="display:block;margin-top:0.35rem;font-weight:600;">Важно:</strong> для суммы за последний календарный месяц выберите «Месяц», а не «Авто». «Авто» оценивает шаг по плотности меток (частые минутные данные давали бы узкий интервал — минута).
                                </div>
                            </details>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-period-shift">Сдвиг периода (шагов назад)</label>
                            <input type="number" class="style-input" id="kpi-period-shift" min="0" step="1" value="0" placeholder="0" autocomplete="off">
                            <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                0 — текущий период. 1, 2, 3… — сдвиг назад на столько шагов времени (как в «Шаг времени» выше). Дельта считается уже от сдвинутого окна.
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-period-mode">Если на дашборде нет фильтра по колонке даты</label>
                            <select class="style-select" id="kpi-period-mode">
                                <option value="auto">Авто: последнее «окно» по данным (как последние две метки) и сравнение с предыдущим, если есть строки</option>
                                <option value="fallback">Запасной диапазон (поля «С / По» ниже)</option>
                            </select>
                            <details style="margin-top:0.45rem;">
                                <summary style="cursor:pointer;font-size:0.78rem;color:var(--text-secondary);">Про авто и фильтры</summary>
                                <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.4;">
                                    При фильтре даты на дашборде всегда используется он; дельта скрывается, если в окне сравнения нет ни одной строки.
                                </div>
                            </details>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Запасной диапазон (если нет глобального фильтра по дате)</label>
                            <div class="style-input-group">
                                <div>
                                    <label class="style-label" for="kpi-fallback-start">С</label>
                                    <input type="date" class="style-input" id="kpi-fallback-start">
                                </div>
                                <div>
                                    <label class="style-label" for="kpi-fallback-end">По</label>
                                    <input type="date" class="style-input" id="kpi-fallback-end">
                                </div>
                            </div>
                        </div>
                            </div>
                        </details>
                        <details class="kpi-settings-sub" open>
                            <summary class="kpi-settings-sub-summary">Дельта</summary>
                            <div class="kpi-settings-sub-body">
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="kpi-delta-enabled">Показывать дельту</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="kpi-delta-enabled" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div id="kpi-delta-options">
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-delta-mode">Сравнение (дельта)</label>
                            <select class="style-select" id="kpi-delta-mode">
                                <option value="previous_period">Предыдущий период (сдвиг на длину текущего)</option>
                                <option value="previous_year">Год назад</option>
                                <option value="custom">Произвольный диапазон сравнения</option>
                            </select>
                        </div>
                        <div id="kpi-delta-custom-range-block" class="style-control-group" style="display:none;">
                            <label class="style-label">Диапазон сравнения</label>
                            <div class="style-input-group">
                                <div>
                                    <label class="style-label" for="kpi-delta-custom-start">С</label>
                                    <input type="date" class="style-input" id="kpi-delta-custom-start">
                                </div>
                                <div>
                                    <label class="style-label" for="kpi-delta-custom-end">По</label>
                                    <input type="date" class="style-input" id="kpi-delta-custom-end">
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-delta-type">Тип дельты</label>
                            <select class="style-select" id="kpi-delta-type">
                                <option value="absolute">Абсолютная</option>
                                <option value="percent">Процент</option>
                                <option value="both">Оба</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-delta-display">Вид отображения дельты</label>
                            <select class="style-select" id="kpi-delta-display">
                                <option value="below">Под значением</option>
                                <option value="inline">Справа от значения</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="kpi-delta-color">Цвет дельты</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="kpi-delta-color" value="#9aa0a6">
                                </div>
                                <input type="text" class="style-input" id="kpi-delta-color-text" value="" placeholder="авто по тренду" style="flex: 1;" autocomplete="off">
                            </div>
                            <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Пустое значение — зелёный/красный по тренду. Формула ниже перекрывает цвет.
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="formula-label-with-btn">
                                <label class="style-label" for="kpi-delta-color-formula">Формула цвета</label>
                                ${this.formulaEditorOpenButton(
                                    'data-formula-mode="direct" data-formula-target-id="kpi-delta-color-formula" data-formula-apply="kpi"',
                                )}
                            </div>
                            <textarea class="style-input" id="kpi-delta-color-formula" rows="2" spellcheck="false" placeholder='IF([delta] >= 0, RGB(74,222,128), RGB(255,107,107))'></textarea>
                            <div style="margin-top:0.35rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Поля: <code>[delta]</code>, <code>[percent]</code>, <code>[current]</code>, <code>[previous]</code>. Результат — <code>#RRGGBB</code> или <code>RGB(…)</code>.
                            </div>
                        </div>
                        </div>
                            </div>
                        </details>
                        <p style="margin:0.5rem 0 0 0;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                            Формат числа и компактный вид — в секции «Типографика» (блок «Формат числа KPI»). Условный фон — в «Внешний вид».
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    createGaugeSettingsSection() {
        return `
            <div class="style-section gauge-settings-section expanded" data-section="gauge" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Настройки датчика</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <details class="gauge-settings-sub" id="gauge-sub-title" open>
                            <summary class="gauge-settings-sub-summary">Заголовок</summary>
                            <div class="gauge-settings-sub-body">
                            ${this.createWidgetTitleControlsHtml('gauge', {
                                defaultTitle: 'Датчик',
                                placeholder: 'Датчик',
                            })}
                            </div>
                        </details>
                        <details class="gauge-settings-sub" id="gauge-sub-data" open>
                            <summary class="gauge-settings-sub-summary">Данные и шкала</summary>
                            <div class="gauge-settings-sub-body">
                            <div class="style-control-group">
                                <label class="style-label" for="gauge-value-source">Источник значения</label>
                                <select class="style-select" id="gauge-value-source">
                                    <option value="static_value">Статическое число</option>
                                    <option value="field_value">Поле (сумма)</option>
                                    <option value="aggregated_value">Поле + агрегат</option>
                                    <option value="formula_value">Формула</option>
                                </select>
                                <p id="gauge-field-binding-hint" class="gauge-panel-cross-hint" style="display:none;margin-top:0.45rem;margin-bottom:0;">Для режимов с полем перетащите колонку на виджет (панель привязки данных). «Поле (сумма)» всегда считает SUM.</p>
                            </div>
                            <div class="style-control-group" id="gauge-static-value-row" style="display:none;">
                                <label class="style-label" for="gauge-static-value">Значение</label>
                                <input type="number" class="style-input" id="gauge-static-value" step="any" value="0">
                            </div>
                            <div class="style-control-group" id="gauge-aggregation-row" style="display:none;">
                                <label class="style-label" for="gauge-aggregation">Агрегат</label>
                                <select class="style-select" id="gauge-aggregation">
                                    <option value="sum">SUM</option>
                                    <option value="avg">AVG</option>
                                    <option value="min">MIN</option>
                                    <option value="max">MAX</option>
                                    <option value="count">COUNT</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="gauge-count-mode-row" style="display:none;">
                                <label class="style-label" for="gauge-count-mode">Режим COUNT</label>
                                <select class="style-select" id="gauge-count-mode">
                                    <option value="rows">Строки</option>
                                    <option value="non_null">Не пустые</option>
                                    <option value="distinct">Уникальные</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="gauge-formula-block" style="display:none;">
                                <div class="formula-label-with-btn">
                                    <label class="style-label" for="gauge-value-formula">Формула значения</label>
                                    ${this.formulaEditorOpenButton('data-formula-mode="gauge-value"')}
                                </div>
                                <textarea class="style-input" id="gauge-value-formula" rows="2" spellcheck="false" placeholder="SUM([Таблица.Поле])"></textarea>
                                <p style="margin:0.35rem 0 0 0;font-size:0.7rem;color:var(--text-secondary);line-height:1.35;">
                                    Если в формуле нет квалифицированных таблиц, укажите модель, перетащив поле на виджет.
                                </p>
                            </div>
                            <div class="style-control-group" id="gauge-scale-range-block">
                                <label class="style-label">Диапазон шкалы</label>
                                <p class="gauge-targets-hint">Число или формула (агрегат). Пустое min/max → 0 / 100.</p>
                                <div class="gauge-scale-formula-row">
                                    <div class="gauge-scale-formula-col">
                                        <div class="formula-label-with-btn">
                                            <label class="style-label" for="gauge-min-formula">Min</label>
                                            ${this.formulaEditorOpenButton(
                                                'data-formula-mode="direct" data-formula-target-id="gauge-min-formula" data-formula-apply="gauge"',
                                            )}
                                        </div>
                                        <textarea class="style-input gauge-formula-ta" id="gauge-min-formula" rows="1" spellcheck="false" placeholder="0 или MIN([t.x])"></textarea>
                                    </div>
                                    <div class="gauge-scale-formula-col">
                                        <div class="formula-label-with-btn">
                                            <label class="style-label" for="gauge-max-formula">Max</label>
                                            ${this.formulaEditorOpenButton(
                                                'data-formula-mode="direct" data-formula-target-id="gauge-max-formula" data-formula-apply="gauge"',
                                            )}
                                        </div>
                                        <textarea class="style-input gauge-formula-ta" id="gauge-max-formula" rows="1" spellcheck="false" placeholder="100 или MAX([t.x])"></textarea>
                                    </div>
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-targets-block">
                                <label class="style-label">Цели (зоны шкалы)</label>
                                <p class="gauge-targets-hint">Порог — число или формула; цвет и подпись маркера.</p>
                                <div id="gauge-targets-presets" class="gauge-targets-presets" role="group" aria-label="Пресеты целей">
                                    <button type="button" class="gauge-targets-preset" data-gauge-target-preset="traffic" title="Низкий / норма / высокий">
                                        <span class="gauge-targets-preset-dots" aria-hidden="true"><i style="background:#ef4444"></i><i style="background:#eab308"></i><i style="background:#22c55e"></i></span>
                                        Светофор
                                    </button>
                                    <button type="button" class="gauge-targets-preset" data-gauge-target-preset="margin" title="Зоны 20 / 40 / 60">
                                        <span class="gauge-targets-preset-dots" aria-hidden="true"><i style="background:#ef4444"></i><i style="background:#f59e0b"></i><i style="background:#22c55e"></i></span>
                                        Margin %
                                    </button>
                                    <button type="button" class="gauge-targets-preset" data-gauge-target-preset="loaders" title="Нагрузка / KPI">
                                        <span class="gauge-targets-preset-dots" aria-hidden="true"><i style="background:#ef4444"></i><i style="background:#eab308"></i><i style="background:#22c55e"></i></span>
                                        Нагрузка
                                    </button>
                                </div>
                                <div id="gauge-targets-list" class="gauge-targets-list"></div>
                                <button type="button" class="gauge-targets-add" id="gauge-target-add">+ Добавить цель</button>
                                <div class="flex-between gauge-targets-paint-row">
                                    <label class="style-label" for="gauge-targets-paint-track">Красить шкалу зонами</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gauge-targets-paint-track" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            </div>
                        </details>

                        <details class="gauge-settings-sub" id="gauge-sub-format" open>
                            <summary class="gauge-settings-sub-summary">Подпись и формат значения</summary>
                            <div class="gauge-settings-sub-body">
                            <p class="gauge-panel-cross-hint">Размер, начертание и семейство шрифта числа в центре задаются в общем разделе панели «Типографика» (этот блок — цвет, суффиксы и шаблон).</p>
                            <div class="style-control-group">
                                <div class="flex-between">
                                    <label class="style-label" for="gauge-show-value">Показывать число</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gauge-show-value" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-value-format-row">
                                <label class="style-label" for="gauge-value-format">Формат значения</label>
                                <select class="style-select" id="gauge-value-format">
                                    <option value="number">Число</option>
                                    <option value="percent">Процент</option>
                                    <option value="custom">Шаблон</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="gauge-percent-mode-row" style="display:none;">
                                <label class="style-label" for="gauge-value-percent-mode">Режим процента</label>
                                <select class="style-select" id="gauge-value-percent-mode">
                                    <option value="of_range">Доля заполнения (min–max)</option>
                                    <option value="literal">Как в данных (уже %)</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="gauge-value-precision-row">
                                <label class="style-label" for="gauge-value-precision">Точность (знаков)</label>
                                <input type="number" class="style-input" id="gauge-value-precision" min="0" max="8" step="1" value="0">
                            </div>
                            <div class="style-control-group" id="gauge-number-notation-row" style="display:none;">
                                <label class="style-label" for="gauge-value-number-notation">Запись числа</label>
                                <select class="style-select" id="gauge-value-number-notation">
                                    <option value="standard">Обычная</option>
                                    <option value="compact">Компактная (1.2k, 1M)</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="gauge-custom-pattern-row" style="display:none;">
                                <label class="style-label" for="gauge-value-custom-pattern">Шаблон</label>
                                <input type="text" class="style-input" id="gauge-value-custom-pattern" value="{value}" placeholder="{value} {percent}">
                            </div>
                            <div class="style-control-group" id="gauge-value-suffix-row">
                                <label class="style-label" for="gauge-value-suffix">Суффикс (для числа)</label>
                                <input type="text" class="style-input" id="gauge-value-suffix" value="%" maxlength="12">
                            </div>
                            <div class="style-control-group" id="gauge-value-text-appearance-row">
                                <label class="style-label" for="gauge-value-text-color-text">Цвет текста значения</label>
                                <p style="margin:0 0 0.35rem;font-size:0.68rem;color:var(--text-secondary);line-height:1.35;">Цвет центральной подписи задаётся только здесь.</p>
                                <div class="color-picker-wrapper">
                                    <div class="color-picker">
                                        <input type="color" id="gauge-value-text-color" value="#ffffff">
                                    </div>
                                    <input type="text" class="style-input" id="gauge-value-text-color-text" value="#ffffff" style="flex: 1;">
                                </div>
                            </div>
                            </div>
                        </details>

                        <details class="gauge-settings-sub" id="gauge-sub-appearance" open>
                            <summary class="gauge-settings-sub-summary">Внешний вид шкалы</summary>
                            <div class="gauge-settings-sub-body">
                            <div class="style-control-group">
                                <label class="style-label" for="gauge-style-type">Тип шкалы</label>
                                <select class="style-select" id="gauge-style-type">
                                    <option value="arc">Дуга</option>
                                    <option value="full_circle">Полный круг</option>
                                    <option value="donut">Кольцо</option>
                                    <option value="thin_line">Тонкая линия</option>
                                    <option value="segmented">Сегменты</option>
                                    <option value="progress_bar">Прогресс-бар</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="gauge-donut-ratio-row" style="display:none;">
                                <div class="slider-container">
                                    <label class="style-label">Внутренний радиус (доля)</label>
                                    <input type="range" class="style-slider" id="gauge-donut-inner-ratio" min="0.2" max="0.92" step="0.02" value="0.62">
                                    <span class="slider-value" id="gauge-donut-inner-ratio-value">0.62</span>
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-thin-sweep-row" style="display:none;">
                                <div class="slider-container">
                                    <label class="style-label">Размах (град.)</label>
                                    <input type="range" class="style-slider" id="gauge-thin-sweep" min="90" max="359" step="1" value="300">
                                    <span class="slider-value" id="gauge-thin-sweep-value">300°</span>
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-segmented-row" style="display:none;">
                                <label class="style-label" for="gauge-segmented-count">Число сегментов</label>
                                <input type="number" class="style-input" id="gauge-segmented-count" min="3" max="48" value="12">
                                <label class="style-label" for="gauge-segmented-gap" style="margin-top:0.5rem;">Зазор (град.)</label>
                                <input type="number" class="style-input" id="gauge-segmented-gap" min="0" max="20" step="0.5" value="3">
                            </div>
                            <div class="style-control-group" id="gauge-progress-bar-radius-row" style="display:none;">
                                <div class="slider-container">
                                    <label class="style-label">Скругление углов полосы</label>
                                    <input type="range" class="style-slider" id="gauge-progress-bar-radius" min="0" max="48" step="1" value="10">
                                    <span class="slider-value" id="gauge-progress-bar-radius-value">10 px</span>
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-dial-row">
                                <div class="slider-container">
                                    <label class="style-label">Поворот шкалы</label>
                                    <input type="range" class="style-slider" id="gauge-dial-rotation" min="-180" max="180" value="0" step="1">
                                    <span class="slider-value" id="gauge-dial-rotation-value">0°</span>
                                </div>
                            </div>

                            <div class="style-control-group">
                                <label class="style-label" for="gauge-fill-color-mode">Цвет заполнения</label>
                                <select class="style-select" id="gauge-fill-color-mode">
                                    <option value="static">Фиксированный</option>
                                    <option value="range">По долям (0–1)</option>
                                    <option value="gradient">Градиент</option>
                                </select>
                            </div>
                            <div class="style-control-group" id="gauge-gradient-row" style="display:none;">
                                <div class="color-picker-wrapper">
                                    <label class="style-label">Цвет A → B</label>
                                    <div class="color-picker">
                                        <input type="color" id="gauge-gradient-a" value="#00ff80">
                                    </div>
                                    <input type="text" class="style-input" id="gauge-gradient-a-text" value="#00ff80" style="flex:1;">
                                    <div class="color-picker">
                                        <input type="color" id="gauge-gradient-b" value="#00f0ff">
                                    </div>
                                    <input type="text" class="style-input" id="gauge-gradient-b-text" value="#00f0ff" style="flex:1;">
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-range-rules-row" style="display:none;">
                                <label class="style-label" for="gauge-range-rules-json">Правила цвета (JSON)</label>
                                <textarea class="style-input" id="gauge-range-rules-json" rows="3" spellcheck="false" placeholder='[{"from":0,"to":0.5,"color":"#0f0"},{"from":0.5,"to":1,"color":"#f00"}]'></textarea>
                            </div>
                            <div class="style-control-group" id="gauge-thickness-row">
                                <div class="slider-container">
                                    <label class="style-label" id="gauge-thickness-label">Толщина дуги</label>
                                    <input type="range" class="style-slider" id="gauge-thickness" min="8" max="32" value="16">
                                    <span class="slider-value" id="gauge-thickness-value">16px</span>
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-round-caps-row">
                                <div class="flex-between">
                                    <label class="style-label" for="gauge-round-caps">Закруглить концы дуги</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gauge-round-caps" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="style-control-group" id="gauge-fill-color-static-row">
                                <label class="style-label">Цвет заполнения (фикс.)</label>
                                <div class="color-picker-wrapper">
                                    <div class="color-picker">
                                        <input type="color" id="gauge-fill-color" value="#00ff80">
                                    </div>
                                    <input type="text" class="style-input" id="gauge-fill-color-text" value="#00ff80" style="flex: 1;">
                                </div>
                            </div>
                            <div class="style-control-group">
                                <label class="style-label">Цвет шкалы (дорожка)</label>
                                <div class="color-picker-wrapper">
                                    <div class="color-picker">
                                        <input type="color" id="gauge-track-color" value="#ffffff">
                                    </div>
                                    <input type="text" class="style-input" id="gauge-track-color-text" value="#ffffff" style="flex: 1;">
                                </div>
                            </div>
                            </div>
                        </details>

                        <details class="gauge-settings-sub" id="gauge-sub-effects">
                            <summary class="gauge-settings-sub-summary">Индикатор, анимация и эффекты</summary>
                            <div class="gauge-settings-sub-body">
                            <div id="gauge-indicator-only-wrap">
                                <div class="style-control-group">
                                    <label class="style-label" for="gauge-indicator-type">Индикатор</label>
                                    <select class="style-select" id="gauge-indicator-type">
                                        <option value="dot">Точка</option>
                                        <option value="needle">Стрелка</option>
                                        <option value="line">Линия</option>
                                    </select>
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="gauge-indicator-size">Размер индикатора</label>
                                    <input type="number" class="style-input" id="gauge-indicator-size" min="1" max="40" step="1" value="" placeholder="авто">
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="gauge-indicator-color-text">Цвет индикатора (опц.)</label>
                                    <div class="color-picker-wrapper">
                                        <div class="color-picker">
                                            <input type="color" id="gauge-indicator-color" value="#00ff80">
                                        </div>
                                        <input type="text" class="style-input" id="gauge-indicator-color-text" value="" style="flex: 1;" placeholder="как заполнение">
                                    </div>
                                </div>
                            </div>
                            <div class="style-control-group">
                                <div class="flex-between">
                                    <label class="style-label" for="gauge-animation-enabled">Анимация</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gauge-animation-enabled" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="style-control-group">
                                <div class="flex-between">
                                    <label class="style-label" for="gauge-interaction-enabled">Клик (событие gauge:click)</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gauge-interaction-enabled">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div class="style-control-group">
                                <div class="flex-between">
                                    <label class="style-label">Неоновое свечение</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="gauge-neon-enabled" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                <div id="gauge-neon-controls" style="display: block; margin-top: 0.75rem;">
                                    <div class="color-picker-wrapper">
                                        <label class="style-label">Цвет неона</label>
                                        <div class="color-picker">
                                            <input type="color" id="gauge-neon-color" value="#78ff82">
                                        </div>
                                        <input type="text" class="style-input" id="gauge-neon-color-text" value="#78ff82" style="flex: 1;">
                                    </div>
                                </div>
                            </div>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
        `;
    }

    createTableSettingsSection() {
        return `
            <div class="style-section table-settings-section expanded" data-section="table-settings" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Таблица</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="table-show-title">Показывать заголовок</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="table-show-title">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="table-widget-title-row">
                            <label class="style-label" for="table-widget-title">Текст заголовка</label>
                            <input type="text" class="style-input" id="table-widget-title" maxlength="200" placeholder="Таблица" autocomplete="off">
                        </div>
                        <div class="style-control-group" id="table-title-size-row">
                            <label class="style-label" for="table-title-size">Размер заголовка (px)</label>
                            <input type="number" class="style-input" id="table-title-size" min="8" max="48" step="1" value="14">
                        </div>
                        <div class="style-control-group" id="table-title-color-row">
                            <label class="style-label" for="table-title-color-text">Цвет текста заголовка</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="table-title-color" value="#8B5CF6">
                                </div>
                                <input type="text" class="style-input" id="table-title-color-text" value="#8B5CF6" style="flex: 1;">
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="table-column-header-bg-color-text">Цвет ячеек таблицы заголовка</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="table-column-header-bg-color" value="#6b7280">
                                </div>
                                <input type="text" class="style-input" id="table-column-header-bg-color-text" value="#6b7280" style="flex: 1;">
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="table-max-rows">Сколько строк загружать и показывать</label>
                            <input type="number" class="style-input" id="table-max-rows" min="1" max="5000" value="500" step="1">
                            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);">
                                Учитываются глобальные фильтры дашборда; максимум 5000 строк (лимит сервера).
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createPieChartSettingsSection() {
        const titleBlock = `
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="pie-chart-show-title">Показывать заголовок</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pie-chart-show-title">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="pie-chart-widget-title-row">
                            <label class="style-label" for="pie-chart-widget-title">Текст заголовка</label>
                            <input type="text" class="style-input" id="pie-chart-widget-title" maxlength="200" placeholder="Круговая диаграмма" autocomplete="off">
                        </div>
                        <div class="style-control-group" id="pie-chart-title-size-row">
                            <label class="style-label" for="pie-chart-title-size">Размер заголовка (px)</label>
                            <input type="number" class="style-input" id="pie-chart-title-size" min="8" max="48" step="1" value="14">
                        </div>
                        <div class="style-control-group" id="pie-chart-title-color-row">
                            <label class="style-label" for="pie-chart-title-color-text">Цвет текста заголовка</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="pie-chart-title-color" value="#8B5CF6">
                                </div>
                                <input type="text" class="style-input" id="pie-chart-title-color-text" value="#8B5CF6" style="flex: 1;">
                            </div>
                        </div>`;

        const dataBlock = `
                        <div class="style-control-group">
                            <label class="style-label" for="pie-chart-slice-weight">Вес сектора (SQL)</label>
                            <select class="style-input" id="pie-chart-slice-weight">
                                <option value="auto">Авто: сумма для числа, количество для текста</option>
                                <option value="sum">Сумма (SUM)</option>
                                <option value="count">Количество (COUNT)</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="pie-chart-group-small">Группировка мелких («Прочее»)</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pie-chart-group-small" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div id="pie-chart-group-small-hint" style="margin-top:0.4rem;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Категории с долей меньше порога объединяются в один сектор.
                            </div>
                        </div>`;

        const layoutBlock = `
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="pie-chart-donut">Кольцо (donut)</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pie-chart-donut">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="pie-chart-inner-radius-row">
                            <div class="slider-container">
                                <label class="style-label">Внутренний радиус (доля)</label>
                                <input type="range" class="style-slider" id="pie-chart-inner-radius" min="0.2" max="0.85" step="0.02" value="0.58">
                                <span class="slider-value" id="pie-chart-inner-radius-value">0.58</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Зазор между сегментами</label>
                                <input type="range" class="style-slider" id="pie-chart-segment-pad" min="0" max="0.14" step="0.005" value="0.04">
                                <span class="slider-value" id="pie-chart-segment-pad-value">0.04</span>
                            </div>
                        </div>
                        <div class="style-control-group" id="pie-chart-center-enabled-row">
                            <div class="flex-between">
                                <label class="style-label" for="pie-chart-center-enabled">Текст в центре</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pie-chart-center-enabled" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="pie-chart-center-source-row">
                            <label class="style-label" for="pie-chart-center-source">Источник для {value} и {metric}</label>
                            <select class="style-input" id="pie-chart-center-source">
                                <option value="segments">Видимые секторы</option>
                                <option value="measure">Мера</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-center-seg-aggregate-wrap">
                            <label class="style-label" for="pie-chart-center-seg-aggregate">Агрегация по секторам</label>
                            <select class="style-input" id="pie-chart-center-seg-aggregate">
                                <option value="sum">Сумма</option>
                                <option value="avg">Среднее по категориям</option>
                                <option value="min">Минимум</option>
                                <option value="max">Максимум</option>
                                <option value="count">Число категорий</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-center-measure-fn-wrap" style="display:none;">
                            <label class="style-label" for="pie-chart-center-measure-fn">Функция SQL по мере</label>
                            <select class="style-input" id="pie-chart-center-measure-fn">
                                <option value="sum">SUM</option>
                                <option value="avg">AVG</option>
                                <option value="min">MIN</option>
                                <option value="max">MAX</option>
                                <option value="count">COUNT</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-center-number-format-row">
                            <label class="style-label" for="pie-chart-center-number-format">Формат чисел в центре</label>
                            <select class="style-input" id="pie-chart-center-number-format">
                                <option value="compact">Компактный (666 млрд)</option>
                                <option value="standard">Обычный</option>
                                <option value="scientific">Научный</option>
                                <option value="integer">Целые</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-center-template-row">
                            <label class="style-label" for="pie-chart-center-template">Шаблон текста в центре</label>
                            <input type="text" class="style-input" id="pie-chart-center-template" placeholder="{total} или Итого: {sum} · {count} шт." autocomplete="off">
                        </div>`;

        const colorsBlock = `
                        <div class="style-control-group">
                            <label class="style-label" for="pie-chart-color-mode">Цвет секторов</label>
                            <select class="style-input" id="pie-chart-color-mode">
                                <option value="gradient">Градиент</option>
                                <option value="solid">Один цвет</option>
                                <option value="palette">Палитра по очереди</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-solid-color-row">
                            <label class="style-label" for="pie-chart-solid-color">Цвет (solid)</label>
                            <input type="color" class="style-input" id="pie-chart-solid-color" value="#00E0FF">
                        </div>
                        <div class="style-control-group" id="pie-chart-palette-group">
                            <label class="style-label">Палитра цветов</label>
                            <p class="bar-chart-palette-hint">Для режимов «Палитра» и «Градиент». Нажмите пресет или добавьте свой цвет.</p>
                            <div id="pie-chart-palette-swatches" class="bar-chart-palette-swatches" role="list"></div>
                            <div class="bar-chart-palette-add-row">
                                <input type="color" id="pie-chart-palette-add-color" class="bar-chart-palette-color-input" value="#00E0FF" aria-label="Выбор цвета">
                                <button type="button" class="bar-chart-palette-btn" id="pie-chart-palette-add">Добавить</button>
                                <button type="button" class="bar-chart-palette-btn bar-chart-palette-btn--ghost" id="pie-chart-palette-reset">Очистить</button>
                            </div>
                            <div class="bar-chart-palette-presets" id="pie-chart-palette-presets" aria-label="Быстрые цвета">
                                <button type="button" class="bar-chart-palette-preset" data-hex="#00E0FF" style="background:#00E0FF" title="#00E0FF"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#3D8BFF" style="background:#3D8BFF" title="#3D8BFF"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#005DFF" style="background:#005DFF" title="#005DFF"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#00FFB8" style="background:#00FFB8" title="#00FFB8"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#FF6B6B" style="background:#FF6B6B" title="#FF6B6B"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#FFD93D" style="background:#FFD93D" title="#FFD93D"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#A78BFA" style="background:#A78BFA" title="#A78BFA"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#34D399" style="background:#34D399" title="#34D399"></button>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="formula-label-with-btn">
                                <label class="style-label" for="pie-chart-slice-threshold-formula">Порог / цвет секторов (формула)</label>
                                ${this.formulaEditorOpenButton(
                                    'data-formula-mode="direct" data-formula-target-id="pie-chart-slice-threshold-formula" data-formula-apply="pie-chart"',
                                )}
                            </div>
                            <textarea class="style-input" id="pie-chart-slice-threshold-formula" rows="3" spellcheck="false" placeholder='AVG([t.amount]) или IF([t.status]="paid", RGB(34,197,94), None)'></textarea>
                            <div class="style-field-hint">Агрегат — порог по value. IF / MATCH + RGB — цвет по измерению. None — цвет из палитры/режима.</div>
                            <div class="style-input-group" id="pie-chart-threshold-colors-row" style="gap:0.5rem;margin-top:0.35rem;">
                                <div style="flex:1">
                                    <label class="style-label" for="pie-chart-slice-above-color">Цвет ≥ порога</label>
                                    <input type="color" class="style-input" id="pie-chart-slice-above-color" value="#34d399">
                                </div>
                                <div style="flex:1">
                                    <label class="style-label" for="pie-chart-slice-below-color">Цвет &lt; порога</label>
                                    <input type="color" class="style-input" id="pie-chart-slice-below-color" value="#f87171">
                                </div>
                            </div>
                        </div>`;

        const labelsBlock = `
                        <div class="style-control-group">
                            <label class="style-label" for="pie-chart-label-position">Подписи на сегментах</label>
                            <select class="style-input" id="pie-chart-label-position">
                                <option value="inside">Внутри</option>
                                <option value="outside">Снаружи</option>
                                <option value="hidden">Скрыть</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-label-value-display-row">
                            <label class="style-label" for="pie-chart-label-value-display">На сегментах показывать</label>
                            <select class="style-input" id="pie-chart-label-value-display">
                                <option value="percent">Проценты</option>
                                <option value="value">Значение</option>
                                <option value="both">Проценты и значение</option>
                                <option value="none">Не показывать число</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-label-show-name-row">
                            <div class="flex-between">
                                <label class="style-label" for="pie-chart-label-show-name">Имя категории на сегменте</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pie-chart-label-show-name">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="pie-chart-show-legend">Легенда</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pie-chart-show-legend" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="pie-chart-legend-value-display-row">
                            <label class="style-label" for="pie-chart-legend-value-display">В легенде показывать</label>
                            <select class="style-input" id="pie-chart-legend-value-display">
                                <option value="percent">Проценты</option>
                                <option value="value">Значение</option>
                                <option value="both">Проценты и значение</option>
                                <option value="none">Только имя</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-legend-position-row">
                            <label class="style-label" for="pie-chart-legend-position">Легенда: сторона</label>
                            <select class="style-input" id="pie-chart-legend-position">
                                <option value="right">Справа</option>
                                <option value="left">Слева</option>
                                <option value="top">Сверху</option>
                                <option value="bottom">Снизу</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-legend-align-row">
                            <label class="style-label" for="pie-chart-legend-align">Легенда: выравнивание</label>
                            <select class="style-input" id="pie-chart-legend-align">
                                <option value="start">Начало</option>
                                <option value="center">Центр</option>
                                <option value="end">Конец</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-legend-item-flow-row">
                            <label class="style-label" for="pie-chart-legend-item-flow">Легенда: элементы</label>
                            <select class="style-input" id="pie-chart-legend-item-flow">
                                <option value="column">Столбик</option>
                                <option value="row">Строка (с переносом)</option>
                            </select>
                        </div>
                        <div class="style-control-group" id="pie-chart-legend-search-row">
                            <div class="flex-between">
                                <label class="style-label" for="pie-chart-legend-search">Поиск в легенде</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="pie-chart-legend-search" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>`;

        return `
            <div class="style-section pie-chart-settings-section expanded" data-section="pie-chart-settings" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Круговая диаграмма</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner style-section-inner--subgroups">
                        ${this.createStyleSubgroup('pie-title', 'Заголовок', titleBlock, { expanded: true })}
                        ${this.createStyleSubgroup('pie-data', 'Данные', dataBlock, { expanded: true })}
                        ${this.createStyleSubgroup('pie-layout', 'Макет и центр', layoutBlock, { expanded: false })}
                        ${this.createStyleSubgroup('pie-colors', 'Цвета и оформление', colorsBlock, { expanded: true })}
                        ${this.createStyleSubgroup('pie-labels', 'Подписи и легенда', labelsBlock, { expanded: false })}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Вложенная сворачиваемая группа внутри настроек виджета.
     * @param {string} id
     * @param {string} title
     * @param {string} bodyHtml
     * @param {{ expanded?: boolean }} [opts]
     */
    createStyleSubgroup(id, title, bodyHtml, opts = {}) {
        const expanded = opts.expanded !== false;
        return `
            <div class="style-subgroup${expanded ? ' expanded' : ''}" data-subgroup="${id}">
                <button type="button" class="style-subgroup-header" aria-expanded="${expanded ? 'true' : 'false'}">
                    <span class="style-subgroup-title">${title}</span>
                    <span class="style-subgroup-chevron" aria-hidden="true">▼</span>
                </button>
                <div class="style-subgroup-body">
                    ${bodyHtml}
                </div>
            </div>
        `;
    }

    /**
     * Блок «Заголовок»: показ / текст / размер / цвет (префикс id как у bar-chart).
     * @param {string} idPrefix
     * @param {{ defaultTitle?: string, defaultColor?: string, placeholder?: string }} [opts]
     */
    createWidgetTitleControlsHtml(idPrefix, opts = {}) {
        const defaultTitle = opts.defaultTitle || '';
        const defaultColor = opts.defaultColor || '#8B5CF6';
        const placeholder = opts.placeholder || defaultTitle;
        return `
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="${idPrefix}-show-title">Показывать заголовок</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="${idPrefix}-show-title">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="${idPrefix}-widget-title-row">
                            <label class="style-label" for="${idPrefix}-widget-title">Текст заголовка</label>
                            <input type="text" class="style-input" id="${idPrefix}-widget-title" maxlength="200" placeholder="${placeholder}" autocomplete="off">
                        </div>
                        <div class="style-control-group" id="${idPrefix}-title-size-row">
                            <label class="style-label" for="${idPrefix}-title-size">Размер заголовка (px)</label>
                            <input type="number" class="style-input" id="${idPrefix}-title-size" min="8" max="48" step="1" value="14">
                        </div>
                        <div class="style-control-group" id="${idPrefix}-title-color-row">
                            <label class="style-label" for="${idPrefix}-title-color-text">Цвет текста заголовка</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="${idPrefix}-title-color" value="${defaultColor}">
                                </div>
                                <input type="text" class="style-input" id="${idPrefix}-title-color-text" value="${defaultColor}" style="flex: 1;">
                            </div>
                            ${this.renderColorFormulaFieldHtml({
                                formulaId: `${idPrefix}-title-color-formula`,
                                applyKey: idPrefix,
                            })}
                        </div>`;
    }

    /**
     * @param {object} w
     * @param {string} idPrefix
     * @param {{ defaultTitle?: string, defaultColor?: string }} [opts]
     */
    applyWidgetTitleSettingsFromPanel(w, idPrefix, opts = {}) {
        if (!w?.settings || !this.panel) return;
        const defaultTitle = opts.defaultTitle || '';
        const showCb = this.panel.querySelector(`#${idPrefix}-show-title`);
        const titleInp = this.panel.querySelector(`#${idPrefix}-widget-title`);
        const sizeInp = this.panel.querySelector(`#${idPrefix}-title-size`);
        if (showCb) w.settings.showTitle = !!showCb.checked;
        if (titleInp) {
            const t = (titleInp.value || '').trim();
            w.settings.title = t.length ? t : defaultTitle;
        }
        if (sizeInp) {
            let n = parseInt(sizeInp.value, 10);
            if (!Number.isFinite(n)) n = 14;
            w.settings.titleSize = Math.min(48, Math.max(8, n));
        }
        const color = this.readTitleColorFromPanel(idPrefix, opts.defaultColor || '#8B5CF6');
        if (color) w.settings.titleColor = color;
        w.settings.titleColorFormula = this.readColorFormulaFromPanel(`${idPrefix}-title-color-formula`);
        this.syncWidgetTitleSubRows(idPrefix);
    }

    /**
     * @param {Record<string, unknown>} s
     * @param {string} idPrefix
     * @param {{ defaultTitle?: string, defaultColor?: string, defaultShow?: boolean }} [opts]
     */
    loadWidgetTitleSettingsToPanel(s, idPrefix, opts = {}) {
        if (!this.panel || !s) return;
        const defaultTitle = opts.defaultTitle || '';
        const defaultColor = opts.defaultColor || '#8B5CF6';
        const showCb = this.panel.querySelector(`#${idPrefix}-show-title`);
        if (showCb) {
            showCb.checked = opts.defaultShow === true ? s.showTitle !== false : !!s.showTitle;
        }
        const tit = this.panel.querySelector(`#${idPrefix}-widget-title`);
        if (tit) {
            tit.value =
                s.title != null && String(s.title).length ? String(s.title) : defaultTitle;
        }
        const ts = this.panel.querySelector(`#${idPrefix}-title-size`);
        if (ts) {
            let n = parseInt(s.titleSize, 10);
            if (!Number.isFinite(n)) n = 14;
            ts.value = String(Math.min(48, Math.max(8, n)));
        }
        this.writeTitleColorToPanel(idPrefix, s.titleColor, defaultColor);
        this.writeColorFormulaToPanel(`${idPrefix}-title-color-formula`, s.titleColorFormula || '');
        this.syncWidgetTitleSubRows(idPrefix);
    }

    createBarChartSettingsSection() {
        const titleBlock = this.createWidgetTitleControlsHtml('bar-chart', {
            defaultTitle: 'Столбчатая диаграмма',
            placeholder: 'Столбчатая диаграмма',
        });

        const dataBlock = `
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-slice-weight">Высота столбца (SQL)</label>
                            <select class="style-input" id="bar-chart-slice-weight">
                                <option value="auto">Авто: сумма для числа, количество для текста</option>
                                <option value="sum">Сумма (SUM)</option>
                                <option value="count">Количество (COUNT)</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-orientation">Рост столбцов / ось категорий</label>
                            <select class="style-input" id="bar-chart-orientation">
                                <option value="bottom">Снизу вверх (категории снизу)</option>
                                <option value="top">Сверху вниз (категории сверху)</option>
                                <option value="left">Слева направо (категории слева)</option>
                                <option value="right">Справа налево (категории справа)</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-sort">Сортировка категорий</label>
                            <select class="style-input" id="bar-chart-sort">
                                <option value="none">Как пришло с сервера</option>
                                <option value="value_desc">По значению (убывание)</option>
                                <option value="value_asc">По значению (возрастание)</option>
                                <option value="label_asc">По подписи (А→Я)</option>
                                <option value="label_desc">По подписи (Я→А)</option>
                            </select>
                        </div>`;

        const layoutBlock = `
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Зазор между столбцами (доля шага)</label>
                                <input type="range" class="style-slider" id="bar-chart-gap" min="0" max="80" step="1" value="20">
                                <span class="slider-value" id="bar-chart-gap-value">0.20</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Зазор между столбцами (px)</label>
                                <input type="range" class="style-slider" id="bar-chart-gap-px" min="0" max="28" step="1" value="8">
                                <span class="slider-value" id="bar-chart-gap-px-value">8</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Скругление столбцов (px)</label>
                                <input type="range" class="style-slider" id="bar-chart-border-radius" min="0" max="16" step="1" value="4">
                                <span class="slider-value" id="bar-chart-border-radius-value">4</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Отступы контейнера (px)</label>
                            <div class="style-input-group" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                                <div><span class="style-label" style="font-size:0.72rem;">Верх</span><input type="number" class="style-input" id="bar-chart-pad-t" min="0" max="120" step="1" value="20"></div>
                                <div><span class="style-label" style="font-size:0.72rem;">Право</span><input type="number" class="style-input" id="bar-chart-pad-r" min="0" max="120" step="1" value="20"></div>
                                <div><span class="style-label" style="font-size:0.72rem;">Низ</span><input type="number" class="style-input" id="bar-chart-pad-b" min="0" max="120" step="1" value="44"></div>
                                <div><span class="style-label" style="font-size:0.72rem;">Лево</span><input type="number" class="style-input" id="bar-chart-pad-l" min="0" max="160" step="1" value="48"></div>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-scroll">Прокрутка при многих категориях</label>
                            <select class="style-input" id="bar-chart-scroll">
                                <option value="auto">Авто (вертикаль → по X, горизонталь → по Y)</option>
                                <option value="on">Всегда включена</option>
                                <option value="off">Выключена</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Мин. ширина/высота категории (px)</label>
                                <input type="range" class="style-slider" id="bar-chart-min-band" min="12" max="120" step="1" value="28">
                                <span class="slider-value" id="bar-chart-min-band-value">28</span>
                            </div>
                        </div>`;

        const labelsBlock = `
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-label-placement">Подписи категорий и значений</label>
                            <select class="style-input" id="bar-chart-label-placement">
                                <option value="axis">Только у оси категорий</option>
                                <option value="onBar">Только у столбца</option>
                                <option value="both">Ось и у столбца</option>
                                <option value="none">Скрыть подписи категорий</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-label-rotation">Поворот подписи категории (вертикальный режим)</label>
                            <select class="style-input" id="bar-chart-label-rotation">
                                <option value="0">0°</option>
                                <option value="45">45°</option>
                                <option value="90">90°</option>
                                <option value="-45">-45°</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="bar-chart-show-values">Показывать значения</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="bar-chart-show-values" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-value-position">Позиция значения</label>
                            <select class="style-input" id="bar-chart-value-position">
                                <option value="top">Снаружи (у конца столбца)</option>
                                <option value="inside">Внутри столбца</option>
                                <option value="outside">С другой стороны оси</option>
                                <option value="right">Справа от столбца (вертик.) / у конца (гориз.)</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-value-format">Формат числа на столбце</label>
                            <select class="style-input" id="bar-chart-value-format">
                                <option value="raw">Число (как есть)</option>
                                <option value="int">Целые</option>
                                <option value="compact">Сокращение (1K, 1M)</option>
                            </select>
                        </div>`;

        const statsBlock = `
                        <div class="style-control-group">
                            <details class="line-chart-fold" id="bar-chart-stats-fold" open>
                                <summary class="line-chart-fold__summary">Линии по всем столбцам</summary>
                                <div class="line-chart-fold__body">
                                    <div class="line-chart-compact-toggles line-chart-compact-toggles--stats">
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="bar-chart-stats-avg">Среднее</label><label class="toggle-switch"><input type="checkbox" id="bar-chart-stats-avg"><span class="toggle-slider"></span></label></div>
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="bar-chart-stats-median">Медиана</label><label class="toggle-switch"><input type="checkbox" id="bar-chart-stats-median"><span class="toggle-slider"></span></label></div>
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="bar-chart-stats-sum">Сумма</label><label class="toggle-switch"><input type="checkbox" id="bar-chart-stats-sum"><span class="toggle-slider"></span></label></div>
                                    </div>
                                </div>
                            </details>
                        </div>`;

        const colorsBlock = `
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Прозрачность сетки</label>
                                <input type="range" class="style-slider" id="bar-chart-grid-opacity" min="0" max="40" step="1" value="14">
                                <span class="slider-value" id="bar-chart-grid-opacity-value">0.14</span>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="bar-chart-hover">Подсветка при наведении</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="bar-chart-hover" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-color-mode">Цвет столбцов</label>
                            <select class="style-input" id="bar-chart-color-mode">
                                <option value="gradient">Градиент </option>
                                <option value="solid">Один цвет</option>
                                <option value="palette">Палитра по очереди</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="bar-chart-solid-color">Цвет (solid)</label>
                            <input type="color" class="style-input" id="bar-chart-solid-color" value="#00E0FF">
                        </div>
                        <div class="style-control-group">
                            <div class="formula-label-with-btn">
                                <label class="style-label" for="bar-chart-threshold-formula">Порог окраски столбцов (формула)</label>
                                ${this.formulaEditorOpenButton(
                                    'data-formula-mode="direct" data-formula-target-id="bar-chart-threshold-formula" data-formula-apply="bar-chart"',
                                )}
                            </div>
                            <textarea class="style-input" id="bar-chart-threshold-formula" rows="2" spellcheck="false" placeholder="Например AVG([table.amount]) — столбцы выше/ниже порога"></textarea>
                            <div class="style-input-group" style="gap:0.5rem;margin-top:0.35rem;">
                                <div style="flex:1">
                                    <label class="style-label" for="bar-chart-threshold-high-color">Цвет ≥ порога</label>
                                    <input type="color" class="style-input" id="bar-chart-threshold-high-color" value="#34d399">
                                </div>
                                <div style="flex:1">
                                    <label class="style-label" for="bar-chart-threshold-low-color">Цвет &lt; порога</label>
                                    <input type="color" class="style-input" id="bar-chart-threshold-low-color" value="#f87171">
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group" id="bar-chart-palette-group">
                            <label class="style-label">Палитра цветов</label>
                            <p class="bar-chart-palette-hint">Для режимов «Палитра» и «Градиент» по категориям. Нажмите пресет или добавьте свой цвет.</p>
                            <div id="bar-chart-palette-swatches" class="bar-chart-palette-swatches" role="list"></div>
                            <div class="bar-chart-palette-add-row">
                                <input type="color" id="bar-chart-palette-add-color" class="bar-chart-palette-color-input" value="#00E0FF" aria-label="Выбор цвета">
                                <button type="button" class="bar-chart-palette-btn" id="bar-chart-palette-add">Добавить</button>
                                <button type="button" class="bar-chart-palette-btn bar-chart-palette-btn--ghost" id="bar-chart-palette-reset">Очистить</button>
                            </div>
                            <div class="bar-chart-palette-presets" aria-label="Быстрые цвета">
                                <button type="button" class="bar-chart-palette-preset" data-hex="#00E0FF" style="background:#00E0FF" title="#00E0FF"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#3D8BFF" style="background:#3D8BFF" title="#3D8BFF"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#005DFF" style="background:#005DFF" title="#005DFF"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#00FFB8" style="background:#00FFB8" title="#00FFB8"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#FF6B6B" style="background:#FF6B6B" title="#FF6B6B"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#FFD93D" style="background:#FFD93D" title="#FFD93D"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#A78BFA" style="background:#A78BFA" title="#A78BFA"></button>
                                <button type="button" class="bar-chart-palette-preset" data-hex="#34D399" style="background:#34D399" title="#34D399"></button>
                            </div>
                        </div>`;

        return `
            <div class="style-section bar-chart-settings-section expanded" data-section="bar-chart-settings" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Столбчатая диаграмма</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner style-section-inner--subgroups">
                        ${this.createStyleSubgroup('bar-title', 'Заголовок', titleBlock, { expanded: true })}
                        ${this.createStyleSubgroup('bar-data', 'Данные и оси', dataBlock, { expanded: true })}
                        ${this.createStyleSubgroup('bar-layout', 'Макет и размеры', layoutBlock, { expanded: false })}
                        ${this.createStyleSubgroup('bar-labels', 'Подписи и значения', labelsBlock, { expanded: false })}
                        ${this.createStyleSubgroup('bar-stats', 'Статистика', statsBlock, { expanded: true })}
                        ${this.createStyleSubgroup('bar-colors', 'Цвета и оформление', colorsBlock, { expanded: false })}
                    </div>
                </div>
            </div>
        `;
    }

    /** @returns {string|null} */
    normalizeBarPaletteHex(c) {
        const s = String(c || '').trim();
        const m = s.match(/^#?([0-9a-fA-F]{6})$/i);
        return m ? `#${m[1].toUpperCase()}` : null;
    }

    /** @param {string} hex @param {string} [formula] */
    createBarPaletteChipElement(hex, formula = '') {
        const h = this.normalizeBarPaletteHex(hex);
        if (!h) return null;
        const wrap = document.createElement('div');
        wrap.className = 'bar-chart-palette-chip';
        wrap.dataset.color = h;
        wrap.setAttribute('role', 'listitem');
        const fx = String(formula || '').trim();
        wrap.innerHTML = `
            <span class="bar-chart-palette-chip-swatch" style="background:${h}"></span>
            <span class="bar-chart-palette-chip-hex">${h}</span>
            <button type="button" class="bar-chart-palette-chip-remove" aria-label="Удалить цвет">&times;</button>
            <textarea class="style-input bar-chart-palette-chip-formula" rows="1" spellcheck="false" placeholder="Формула цвета (опц.)" data-color-formula="1">${this._escapeBindingText(fx)}</textarea>
        `;
        return wrap;
    }

    /** @param {string} rootSelector @param {string} hex @param {string} [formula] @returns {boolean} */
    appendChartPaletteChip(rootSelector, hex, formula = '') {
        const root = this.panel?.querySelector(rootSelector);
        if (!root) return false;
        const max = 24;
        if (root.querySelectorAll('.bar-chart-palette-chip').length >= max) return false;
        const h = this.normalizeBarPaletteHex(hex);
        if (!h) return false;
        const el = this.createBarPaletteChipElement(h, formula);
        if (!el) return false;
        root.appendChild(el);
        return true;
    }

    /**
     * @param {string} rootSelector
     * @param {unknown} rawPalette
     * @param {unknown} [rawFormulas]
     */
    populateChartPaletteSwatches(rootSelector, rawPalette, rawFormulas = null) {
        const root = this.panel?.querySelector(rootSelector);
        if (!root) return;
        root.innerHTML = '';
        let arr = [];
        if (Array.isArray(rawPalette)) {
            arr = rawPalette;
        } else if (typeof rawPalette === 'string' && rawPalette.trim()) {
            arr = rawPalette
                .split(/[,;\s]+/)
                .map((x) => x.trim())
                .filter(Boolean);
        }
        const formulas = Array.isArray(rawFormulas) ? rawFormulas : [];
        arr.forEach((c, i) => {
            const el = this.createBarPaletteChipElement(c, formulas[i] || '');
            if (el) root.appendChild(el);
        });
    }

    /** @param {string} rootSelector */
    collectChartPaletteColorsFromPanel(rootSelector) {
        const root = this.panel?.querySelector(rootSelector);
        if (!root) return [];
        return Array.from(root.querySelectorAll('.bar-chart-palette-chip'))
            .map((el) => this.normalizeBarPaletteHex(el.dataset.color))
            .filter(Boolean);
    }

    /** @param {string} rootSelector @returns {string[]} */
    collectChartPaletteFormulasFromPanel(rootSelector) {
        const root = this.panel?.querySelector(rootSelector);
        if (!root) return [];
        return Array.from(root.querySelectorAll('.bar-chart-palette-chip')).map((el) =>
            String(el.querySelector('.bar-chart-palette-chip-formula')?.value || '').trim(),
        );
    }

    /** @param {string} hex @returns {boolean} */
    appendBarPaletteChip(hex) {
        return this.appendChartPaletteChip('#bar-chart-palette-swatches', hex);
    }

    /** @param {unknown} rawPalette @param {unknown} [rawFormulas] */
    populateBarPaletteSwatches(rawPalette, rawFormulas = null) {
        this.populateChartPaletteSwatches('#bar-chart-palette-swatches', rawPalette, rawFormulas);
    }

    collectBarPaletteColorsFromPanel() {
        return this.collectChartPaletteColorsFromPanel('#bar-chart-palette-swatches');
    }

    collectBarPaletteFormulasFromPanel() {
        return this.collectChartPaletteFormulasFromPanel('#bar-chart-palette-swatches');
    }

    /** @param {string} hex @returns {boolean} */
    appendPiePaletteChip(hex) {
        return this.appendChartPaletteChip('#pie-chart-palette-swatches', hex);
    }

    /** @param {unknown} rawPalette @param {unknown} [rawFormulas] */
    populatePiePaletteSwatches(rawPalette, rawFormulas = null) {
        this.populateChartPaletteSwatches('#pie-chart-palette-swatches', rawPalette, rawFormulas);
    }

    collectPiePaletteColorsFromPanel() {
        return this.collectChartPaletteColorsFromPanel('#pie-chart-palette-swatches');
    }

    collectPiePaletteFormulasFromPanel() {
        return this.collectChartPaletteFormulasFromPanel('#pie-chart-palette-swatches');
    }

    setupLineChartTimeframeSlotEditors() {
        if (this._lineChartTfSlotEditorsBound) return;
        this._lineChartTfSlotEditorsBound = true;
        const panel = this.panel;
        if (!panel) return;
        let dragSlot = null;

        panel.addEventListener('click', (e) => {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            const widget = this.currentWidget;
            if (!widget || widget.type !== 'line-chart') return;

            if (t.closest('#line-chart-tf-add-toggle')) {
                const pop = panel.querySelector('#line-chart-tf-add-panel');
                pop?.classList.toggle('line-chart-tf-add-panel--open');
                if (pop?.classList.contains('line-chart-tf-add-panel--open')) this._fillLineChartTfAddPresetButtons(widget);
                return;
            }

            const addPreset = t.closest('[data-line-tf-add-preset]');
            if (addPreset) {
                const pid = addPreset.getAttribute('data-line-tf-add-preset');
                if (pid) this._lineChartAddTimeframeSlot(widget, pid);
                return;
            }

            if (t.closest('#line-chart-tf-add-custom-apply')) {
                const inp = panel.querySelector('#line-chart-tf-add-custom-input');
                const raw = inp?.value || '';
                const parsed = parseCustomTimeframeInput(raw);
                if (parsed.error || !parsed.intervalMs) return;
                const enc = encodeCustomTimeframeSlot(parsed.intervalMs);
                this._lineChartAddTimeframeSlot(widget, enc);
                if (inp) inp.value = '';
                return;
            }

            const rm = t.closest('.line-chart-tf-slot-remove');
            if (rm) {
                const row = rm.closest('.line-chart-tf-slot-row');
                const slot = row?.dataset?.slot;
                if (slot) this._lineChartRemoveTimeframeSlot(widget, slot);
            }
        });

        panel.addEventListener('dragstart', (e) => {
            const row = e.target && /** @type {HTMLElement} */ (e.target).closest?.('.line-chart-tf-slot-row');
            if (!row || !panel.contains(row)) return;
            dragSlot = row.dataset.slot || null;
            row.classList.add('line-chart-tf-slot-row--dragging');
            try {
                e.dataTransfer?.setData('text/plain', row.dataset.slot || '');
            } catch {
                /* ignore */
            }
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        });

        panel.addEventListener('dragend', (e) => {
            const row = e.target && /** @type {HTMLElement} */ (e.target).closest?.('.line-chart-tf-slot-row');
            if (row) row.classList.remove('line-chart-tf-slot-row--dragging');
            dragSlot = null;
        });

        panel.addEventListener('dragover', (e) => {
            const row = e.target && /** @type {HTMLElement} */ (e.target).closest?.('.line-chart-tf-slot-row');
            if (!row || !panel.querySelector('#line-chart-tf-available-list')?.contains(row)) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        });

        panel.addEventListener('drop', (e) => {
            const row = e.target && /** @type {HTMLElement} */ (e.target).closest?.('.line-chart-tf-slot-row');
            const listEl = panel.querySelector('#line-chart-tf-available-list');
            if (!row || !listEl?.contains(row)) return;
            e.preventDefault();
            const widget = this.currentWidget;
            if (!widget || widget.type !== 'line-chart') return;
            const to = row.dataset.slot || '';
            const from =
                dragSlot ||
                (() => {
                    try {
                        return e.dataTransfer?.getData('text/plain') || '';
                    } catch {
                        return '';
                    }
                })();
            if (!from || !to || from === to) return;
            if (!widget.settings.timeframe) widget.settings.timeframe = {};
            const arr = [...(widget.settings.timeframe.availableIds || [])].map(String);
            const i = arr.indexOf(from);
            const j = arr.indexOf(to);
            if (i < 0 || j < 0) return;
            arr.splice(i, 1);
            arr.splice(j, 0, from);
            widget.settings.timeframe.availableIds = arr;
            this.renderLineChartTimeframeSlotList(widget);
            if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
        });
    }

    /**
     * @param {*} widget
     */
    _lineChartAddTimeframeSlot(widget, slotOrPresetId) {
        if (!widget?.settings) return;
        if (!widget.settings.timeframe) widget.settings.timeframe = {};
        const slot = String(slotOrPresetId);
        if (!decodeTimeframeSlot(slot)) return;
        const arr = [...(widget.settings.timeframe.availableIds || [])].map(String);
        if (arr.includes(slot)) return;
        arr.push(slot);
        widget.settings.timeframe.availableIds = arr;
        this.renderLineChartTimeframeSlotList(widget);
        if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
    }

    /**
     * @param {*} widget
     */
    _lineChartRemoveTimeframeSlot(widget, slot) {
        if (!widget?.settings?.timeframe) return;
        const arr = [...(widget.settings.timeframe.availableIds || [])].map(String).filter((s) => s !== slot);
        widget.settings.timeframe.availableIds = arr.length ? arr : [...LINE_TIMEFRAME_PRESET_ORDER];
        const cur = String(widget.settings.timeframe.id || 'raw');
        const dec = decodeTimeframeSlot(slot);
        if (dec?.kind === 'preset' && cur === dec.id) {
            widget.settings.timeframe.id = 'raw';
            widget.settings.timeframe.customIntervalMs = null;
        }
        if (dec?.kind === 'customSlot' && widget.settings.timeframe.id === 'custom') {
            if (Number(widget.settings.timeframe.customIntervalMs) === dec.intervalMs) {
                widget.settings.timeframe.id = 'raw';
                widget.settings.timeframe.customIntervalMs = null;
            }
        }
        this.renderLineChartTimeframeSlotList(widget);
        if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
    }

    /**
     * @param {import('../src/core/WidgetBase.js').WidgetBase | Record<string, unknown>} widget
     */
    _fillLineChartTfAddPresetButtons(widget) {
        const wrap = this.panel?.querySelector('#line-chart-tf-add-presets');
        if (!wrap || !widget?.settings?.timeframe) return;
        const have = new Set((widget.settings.timeframe.availableIds || []).map(String));
        wrap.innerHTML = '';
        for (const id of LINE_TIMEFRAME_PRESET_ORDER) {
            const p = LINE_TIMEFRAME_PRESETS[id];
            if (!p || p.intervalMs <= 0) continue;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'line-chart-tf-add-preset-btn';
            btn.setAttribute('data-line-tf-add-preset', id);
            btn.textContent = `+ ${p.label}`;
            if (have.has(id)) {
                btn.disabled = true;
                btn.textContent = `${p.label} (уже в списке)`;
            }
            wrap.appendChild(btn);
        }
    }

    /**
     * @param {*} widget
     */
    renderLineChartSeriesList(widget) {
        const list = this.panel?.querySelector('#line-chart-series-list');
        if (!list || !widget || widget.type !== 'line-chart') return;
        const measures = Array.isArray(widget.settings?.bindingMeasures)
            ? widget.settings.bindingMeasures
            : widget.settings?.bindingMeasure
              ? [widget.settings.bindingMeasure]
              : [];
        list.textContent = '';
        if (!measures.length) {
            list.innerHTML =
                '<div class="line-chart-series-empty">Нет мер — перетащите поле Y на виджет. Цвет/градиент настраивается у каждой Y-серии.</div>';
            return;
        }
        measures.forEach((m, idx) => {
            const colorMode = m.colorMode === 'gradient' || m.gradient?.enabled ? 'gradient' : 'solid';
            const solidColor = /^#[0-9a-fA-F]{6}$/i.test(String(m.color || '')) ? m.color : '#4DA3FF';
            const gFrom = /^#[0-9a-fA-F]{6}$/i.test(String(m.gradient?.from || ''))
                ? m.gradient.from
                : '#005DFF';
            const gTo = /^#[0-9a-fA-F]{6}$/i.test(String(m.gradient?.to || ''))
                ? m.gradient.to
                : '#00E0FF';
            const gMode = m.gradient?.mode === 'y' ? 'y' : 'x';

            const card = document.createElement('div');
            card.className = 'line-chart-series-card';

            const top = document.createElement('div');
            top.className = 'line-chart-series-card__top';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = m.visible !== false;
            cb.title = 'Показать серию';
            cb.addEventListener('change', () => {
                m.visible = !!cb.checked;
                if (!Array.isArray(widget.settings.bindingMeasures)) {
                    widget.settings.bindingMeasures = measures;
                }
                widget.update?.();
                this.applyLineChartPanelSettings();
            });

            const lab = document.createElement('input');
            lab.type = 'text';
            lab.className = 'style-input';
            lab.value = String(m.label || m.field || `Серия ${idx + 1}`);
            lab.style.flex = '1';
            lab.addEventListener('change', () => {
                m.label = lab.value;
                widget.update?.();
            });

            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'line-chart-tf-slot-remove';
            rm.textContent = '×';
            rm.title = 'Удалить серию';
            rm.addEventListener('click', () => {
                widget.settings.bindingMeasures = measures.filter((x) => x !== m);
                if (widget.settings.bindingMeasures[0]) {
                    widget.settings.bindingMeasure = { ...widget.settings.bindingMeasures[0] };
                } else {
                    widget.settings.bindingMeasure = null;
                }
                this.renderLineChartSeriesList(widget);
                if (this.engine && typeof widget.reloadFromDataModel === 'function') {
                    void widget.reloadFromDataModel(this.engine);
                } else {
                    widget.update?.();
                }
            });

            top.appendChild(cb);
            top.appendChild(lab);
            top.appendChild(rm);

            const paintRow = document.createElement('div');
            paintRow.className = 'line-chart-series-paint';

            const modeLab = document.createElement('label');
            modeLab.className = 'style-label';
            modeLab.textContent = 'Заливка';
            const modeSel = document.createElement('select');
            modeSel.className = 'style-input';
            modeSel.innerHTML =
                '<option value="solid">Цвет</option><option value="gradient">Градиент</option>';
            modeSel.value = colorMode;

            const solidWrap = document.createElement('div');
            solidWrap.className = 'line-chart-series-paint__solid';
            solidWrap.style.display = colorMode === 'solid' ? 'flex' : 'none';
            const color = document.createElement('input');
            color.type = 'color';
            color.id = `line-series-${idx}-color`;
            color.value = solidColor;
            color.title = 'Цвет линии';
            solidWrap.appendChild(color);
            const colorFxId = `line-series-${idx}-color-formula`;
            const colorFxHost = document.createElement('div');
            colorFxHost.innerHTML = this.renderColorFormulaFieldHtml({
                formulaId: colorFxId,
                applyKey: 'line-chart',
            });
            if (colorFxHost.firstElementChild) solidWrap.appendChild(colorFxHost.firstElementChild);
            this.writeColorFormulaToPanel(colorFxId, m.colorFormula || '');

            const gradWrap = document.createElement('div');
            gradWrap.className = 'line-chart-series-paint__grad';
            gradWrap.style.display = colorMode === 'gradient' ? 'grid' : 'none';
            const from = document.createElement('input');
            from.type = 'color';
            from.id = `line-series-${idx}-grad-from`;
            from.value = gFrom;
            from.title = 'Градиент: от';
            const to = document.createElement('input');
            to.type = 'color';
            to.id = `line-series-${idx}-grad-to`;
            to.value = gTo;
            to.title = 'Градиент: до';
            const dir = document.createElement('select');
            dir.className = 'style-input';
            dir.innerHTML =
                '<option value="x">По X</option><option value="y">По Y</option>';
            dir.value = gMode;
            gradWrap.appendChild(from);
            gradWrap.appendChild(to);
            gradWrap.appendChild(dir);

            const applyPaint = () => {
                const mode = modeSel.value === 'gradient' ? 'gradient' : 'solid';
                m.colorMode = mode;
                m.color = color.value;
                m.colorFormula = this.readColorFormulaFromPanel(colorFxId);
                m.gradient = {
                    enabled: mode === 'gradient',
                    mode: dir.value === 'y' ? 'y' : 'x',
                    from: from.value,
                    to: to.value,
                };
                if (!Array.isArray(widget.settings.bindingMeasures)) {
                    widget.settings.bindingMeasures = measures;
                }
                widget.settings.bindingMeasures = measures;
                if (idx === 0) {
                    if (!widget.settings.line) widget.settings.line = {};
                    widget.settings.line.color = m.color;
                }
                solidWrap.style.display = mode === 'solid' ? 'flex' : 'none';
                gradWrap.style.display = mode === 'gradient' ? 'grid' : 'none';
                this._syncLineChartPanelAccent(this.panel?.querySelector('.line-chart-settings-section'));
                widget.update?.();
                this.engine?.saveSnapshot?.();
            };

            modeSel.addEventListener('change', applyPaint);
            color.addEventListener('input', applyPaint);
            color.addEventListener('change', applyPaint);
            from.addEventListener('input', applyPaint);
            from.addEventListener('change', applyPaint);
            to.addEventListener('input', applyPaint);
            to.addEventListener('change', applyPaint);
            dir.addEventListener('change', applyPaint);

            paintRow.appendChild(modeLab);
            paintRow.appendChild(modeSel);
            paintRow.appendChild(solidWrap);
            paintRow.appendChild(gradWrap);

            card.appendChild(top);
            card.appendChild(paintRow);
            list.appendChild(card);
        });
    }

    _formatLineChartRefChipValue(r) {
        if (!r) return '—';
        if (r.type === 'average' || r.type === 'median') return `${r.type} (viewport)`;
        if (r.type === 'band') {
            const lo = r.yMinFormula || (r.yMin != null ? String(r.yMin) : '—');
            const hi = r.yMaxFormula || (r.yMax != null ? String(r.yMax) : '—');
            return `${lo} … ${hi}`;
        }
        if (r.valueFormula) return r.valueFormula;
        if (r.value != null && Number.isFinite(Number(r.value))) return String(r.value);
        return '—';
    }

    renderLineChartReferencesList(widget) {
        const box = this.panel?.querySelector('#line-chart-ref-list');
        if (!box || !widget || widget.type !== 'line-chart') return;
        const refs = Array.isArray(widget.settings?.references) ? widget.settings.references : [];
        box.textContent = '';
        if (!refs.length) {
            const empty = document.createElement('div');
            empty.className = 'line-chart-ref-list-empty';
            empty.textContent = 'Пока нет линий — добавьте Target или зону';
            box.appendChild(empty);
            return;
        }
        refs.forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'line-chart-ref-chip';
            const sw = document.createElement('span');
            sw.className = 'line-chart-ref-chip__swatch';
            sw.style.background = r.color || '#f59e0b';
            const t = document.createElement('span');
            t.className = 'line-chart-ref-chip__text';
            t.textContent = `${r.label || r.type}: ${this._formatLineChartRefChipValue(r)}`;
            t.title = this._formatLineChartRefChipValue(r);
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = '×';
            rm.className = 'line-chart-ref-chip__remove';
            rm.title = 'Удалить';
            rm.addEventListener('click', () => {
                widget.settings.references = (widget.settings.references || []).filter((_, j) => j !== i);
                delete widget.settings._resolvedReferences;
                this.renderLineChartReferencesList(widget);
                if (typeof widget.update === 'function') widget.update();
                this.engine?.saveSnapshot?.();
            });
            row.appendChild(sw);
            row.appendChild(t);
            row.appendChild(rm);
            box.appendChild(row);
        });
    }

    _syncLineChartRefTypeUi() {
        const p = this.panel;
        if (!p) return;
        const type = p.querySelector('#line-chart-ref-type')?.value || 'constant';
        const valRow = p.querySelector('#line-chart-ref-value-row');
        const maxRow = p.querySelector('#line-chart-ref-ymax-row');
        const needsValue = type === 'constant' || type === 'target' || type === 'band';
        if (valRow) valRow.style.display = needsValue ? '' : 'none';
        if (maxRow) maxRow.style.display = type === 'band' ? '' : 'none';
    }

    setupLineChartReferenceEditor() {
        if (this._lineChartRefBound) return;
        this._lineChartRefBound = true;
        this.panel?.addEventListener('change', (e) => {
            if (e.target?.id === 'line-chart-ref-type') this._syncLineChartRefTypeUi();
        });
        this.panel?.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('#line-chart-ref-add');
            if (!btn) return;
            e.preventDefault();
            const widget = this.currentWidget;
            if (!widget || widget.type !== 'line-chart') return;
            const p = this.panel;
            const type = p.querySelector('#line-chart-ref-type')?.value || 'constant';
            const valueRaw = String(p.querySelector('#line-chart-ref-value')?.value || '');
            const yMaxRaw = String(p.querySelector('#line-chart-ref-ymax')?.value || '');
            const label = String(p.querySelector('#line-chart-ref-label')?.value || '').trim();
            const color = p.querySelector('#line-chart-ref-color')?.value || '#f59e0b';

            const built = buildReferenceFromUiInput({ type, valueRaw, yMaxRaw, label, color });
            if (!built.ok || !built.row) {
                btn.classList.add('line-chart-ref-add-btn--shake');
                setTimeout(() => btn.classList.remove('line-chart-ref-add-btn--shake'), 400);
                if (built.error) btn.title = built.error;
                return;
            }
            btn.title = 'Добавить на график';

            if (!Array.isArray(widget.settings.references)) widget.settings.references = [];
            widget.settings.references.push(built.row);
            if (p.querySelector('#line-chart-ref-value')) p.querySelector('#line-chart-ref-value').value = '';
            if (p.querySelector('#line-chart-ref-ymax')) p.querySelector('#line-chart-ref-ymax').value = '';
            this.renderLineChartReferencesList(widget);
            const needsFormula =
                !!(built.row.valueFormula || built.row.yMinFormula || built.row.yMaxFormula);
            void (async () => {
                if (needsFormula && typeof widget._resolveLineReferenceFormulas === 'function') {
                    await widget._resolveLineReferenceFormulas(this.engine);
                } else {
                    widget.settings._resolvedReferences = widget.settings.references;
                }
                if (typeof widget.update === 'function') widget.update();
                this.engine?.saveSnapshot?.();
            })();
        });
        queueMicrotask(() => this._syncLineChartRefTypeUi());
    }

    renderLineChartTimeframeSlotList(widget) {
        const list = this.panel?.querySelector('#line-chart-tf-available-list');
        if (!list || !widget?.settings?.timeframe || widget.type !== 'line-chart') return;
        const tf = widget.settings.timeframe;
        if (!Array.isArray(tf.availableIds) || !tf.availableIds.length) {
            tf.availableIds = [...LINE_TIMEFRAME_PRESET_ORDER];
        }
        list.innerHTML = '';
        for (const slot of tf.availableIds) {
            if (!decodeTimeframeSlot(slot)) continue;
            const row = document.createElement('div');
            row.className = 'line-chart-tf-slot-row';
            row.draggable = true;
            row.dataset.slot = slot;
            const grip = document.createElement('span');
            grip.className = 'line-chart-tf-slot-grip';
            grip.innerHTML = svgDragHandle;
            grip.title = 'Перетащить';
            const lab = document.createElement('span');
            lab.className = 'line-chart-tf-slot-label';
            lab.textContent = formatTimeframeSlotLabel(slot);
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'line-chart-tf-slot-remove';
            rm.setAttribute('aria-label', 'Убрать');
            rm.innerHTML = '&times;';
            row.appendChild(grip);
            row.appendChild(lab);
            row.appendChild(rm);
            list.appendChild(row);
        }
        this._fillLineChartTfAddPresetButtons(widget);
    }

    /**
     * @param {string | undefined | null} raw
     * @returns {string|null}
     */
    normalizeLineChartHex(raw) {
        const s = String(raw || '').trim();
        const m = s.match(/^#?([0-9a-fA-F]{6})$/i);
        return m ? `#${m[1].toUpperCase()}` : null;
    }

    /**
     * @param {string} hex
     * @returns {string}
     */
    lineChartHexToRgb(hex) {
        const h = this.normalizeLineChartHex(hex) || '#4DA3FF';
        const n = h.slice(1);
        const r = parseInt(n.slice(0, 2), 16);
        const g = parseInt(n.slice(2, 4), 16);
        const b = parseInt(n.slice(4, 6), 16);
        return `${r}, ${g}, ${b}`;
    }

    /**
     * @param {HTMLElement} section
     * @param {string} tabKey
     */
    _setLineChartTab(section, tabKey) {
        const tabs = section.querySelectorAll('.line-chart-tab-btn');
        const panels = section.querySelectorAll('.line-chart-tab-panel');
        const active = String(tabKey || 'interaction');
        tabs.forEach((btn) => {
            const on = btn.getAttribute('data-line-tab') === active;
            btn.classList.toggle('line-chart-tab-btn--active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panels.forEach((panel) => {
            const on = panel.getAttribute('data-line-tab-panel') === active;
            panel.classList.toggle('line-chart-tab-panel--active', on);
        });
        section.dataset.lineChartActiveTab = active;
    }

    /**
     * @param {HTMLElement} section
     */
    _syncLineChartPanelAccent(section) {
        if (!section) return;
        const w = this.currentWidget;
        const first = Array.isArray(w?.settings?.bindingMeasures) ? w.settings.bindingMeasures[0] : null;
        const fromSeries = first?.color;
        const fromLine = w?.settings?.line?.color;
        const color =
            this.normalizeLineChartHex(fromSeries) ||
            this.normalizeLineChartHex(fromLine) ||
            '#4DA3FF';
        section.style.setProperty('--line-chart-accent', color);
        section.style.setProperty('--line-chart-accent-rgb', this.lineChartHexToRgb(color));
        const sw = section.querySelector('.line-chart-accent-swatch');
        const tx = section.querySelector('.line-chart-accent-value');
        if (sw) sw.style.background = color;
        if (tx) tx.textContent = color;
    }

    /**
     * Сгруппировать длинные настройки Line Chart по вкладкам (без изменения id полей).
     * @param {HTMLElement} section
     */
    _ensureLineChartTabsLayout(section) {
        if (!section || section._lineChartTabsReady) return;
        const inner = section.querySelector('.style-section-inner');
        if (!inner) return;
        const groups = [...inner.querySelectorAll(':scope > .style-control-group')];
        if (!groups.length) return;

        const hasId = (el, id) => !!el.querySelector(`#${id}`);
        const pickTab = (group) => {
            if (
                hasId(group, 'line-chart-tf-enabled') ||
                hasId(group, 'line-chart-series-list') ||
                hasId(group, 'line-chart-prefer-server-agg')
            ) {
                return hasId(group, 'line-chart-prefer-server-agg') || hasId(group, 'line-chart-lod-mode')
                    ? 'performance'
                    : hasId(group, 'line-chart-series-list')
                      ? 'data'
                      : 'data';
            }
            if (hasId(group, 'line-chart-lod-mode')) return 'performance';
            if (
                [
                    'line-chart-ma-enabled',
                    'line-chart-trend-enabled',
                    'line-chart-compare-enabled',
                    'line-chart-forecast-enabled',
                    'line-chart-anomalies-enabled',
                    'line-chart-ref-value',
                    'line-chart-ref-add',
                ].some((id) => hasId(group, id))
            ) {
                return 'analytics';
            }
            if (
                [
                    'line-chart-line-width',
                    'line-chart-line-smooth',
                    'line-chart-line-style',
                    'line-chart-line-opacity',
                    'line-chart-points-enabled',
                    'line-chart-point-radius',
                    'line-chart-point-hover-radius',
                    'line-chart-point-color',
                    'line-chart-threshold-formula',
                    'line-chart-labels-enabled',
                    'line-chart-label-mode',
                    'line-chart-label-position',
                    'line-chart-label-format',
                    'line-chart-label-custom',
                    'line-chart-tooltip-enabled',
                    'line-chart-tooltip-show-value',
                    'line-chart-chart-type',
                    'line-chart-stack',
                    'line-chart-legend-enabled',
                    'line-chart-crosshair-enabled',
                    'line-chart-tooltip-pct',
                    'line-chart-grid-enabled',
                    'line-chart-grid-density',
                    'line-chart-grid-opacity',
                    'line-chart-grid-color',
                    'line-chart-axis-x',
                    'line-chart-axis-y',
                    'line-chart-axis-x-type',
                    'line-chart-axis-x-rotate',
                ].some((id) => hasId(group, id))
            ) {
                return 'display';
            }
            return 'interaction';
        };

        const shell = document.createElement('div');
        shell.className = 'line-chart-tabs-shell';
        shell.innerHTML = `
            <div class="line-chart-tabs-head">
                <div class="line-chart-tabs-nav" role="tablist" aria-label="Группы настроек линейного графика">
                    <button type="button" class="line-chart-tab-btn" data-line-tab="data" role="tab">Данные</button>
                    <button type="button" class="line-chart-tab-btn" data-line-tab="display" role="tab">Визуал</button>
                    <button type="button" class="line-chart-tab-btn" data-line-tab="analytics" role="tab">Аналитика</button>
                    <button type="button" class="line-chart-tab-btn" data-line-tab="interaction" role="tab">Взаимод.</button>
                    <button type="button" class="line-chart-tab-btn" data-line-tab="performance" role="tab">Произв.</button>
                </div>
            </div>
            <div class="line-chart-tab-panel" data-line-tab-panel="data"></div>
            <div class="line-chart-tab-panel" data-line-tab-panel="display"></div>
            <div class="line-chart-tab-panel" data-line-tab-panel="analytics"></div>
            <div class="line-chart-tab-panel" data-line-tab-panel="interaction"></div>
            <div class="line-chart-tab-panel" data-line-tab-panel="performance"></div>
        `;

        const panels = new Map(
            [...shell.querySelectorAll('.line-chart-tab-panel')].map((el) => [el.getAttribute('data-line-tab-panel'), el]),
        );
        groups.forEach((group) => {
            const key = pickTab(group);
            (panels.get(key) || panels.get('interaction'))?.appendChild(group);
        });

        inner.appendChild(shell);
        section._lineChartTabsReady = true;
        let active = section.dataset.lineChartActiveTab || 'data';
        if (active === 'series' || active === 'axes') active = 'display';
        if (active === 'timeframe' || active === 'perf') active = active === 'perf' ? 'performance' : 'data';
        this._setLineChartTab(section, active);
        this._syncLineChartPanelAccent(section);
    }

    createLineChartSettingsSection() {
        return `
            <div class="style-section line-chart-settings-section expanded" data-section="line-chart-settings" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Линейный график</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        ${this.createStyleSubgroup(
                            'line-title',
                            'Заголовок',
                            this.createWidgetTitleControlsHtml('line-chart', {
                                defaultTitle: 'Линейный график',
                                placeholder: 'Линейный график',
                            }),
                            { expanded: false },
                        )}
                        <div class="style-control-group">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Y-серии (measures)</div>
                            <p style="margin:0 0 0.45rem 0;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Перетащите поля меры на виджет (до 8). У каждой серии — цвет или градиент. Снимите галочку, чтобы скрыть.
                            </p>
                            <div id="line-chart-series-list" class="line-chart-series-list"></div>
                        </div>
                        <div class="style-control-group line-chart-display-compact" data-line-display-block="view">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Вид</div>
                            <label class="style-label" for="line-chart-chart-type">Тип графика</label>
                            <select class="style-input" id="line-chart-chart-type">
                                <option value="line">Line</option>
                                <option value="spline">Spline</option>
                                <option value="area">Area</option>
                                <option value="step">Step</option>
                            </select>
                            <div id="line-chart-stack-row" class="line-chart-inline-toggle">
                                <label class="style-label" for="line-chart-stack">Stacked area</label>
                                <label class="toggle-switch"><input type="checkbox" id="line-chart-stack"><span class="toggle-slider"></span></label>
                            </div>
                            <div class="line-chart-compact-toggles">
                                <div class="line-chart-inline-toggle">
                                    <label class="style-label" for="line-chart-legend-enabled">Легенда</label>
                                    <label class="toggle-switch"><input type="checkbox" id="line-chart-legend-enabled" checked><span class="toggle-slider"></span></label>
                                </div>
                                <div class="line-chart-inline-toggle">
                                    <label class="style-label" for="line-chart-crosshair-enabled">Crosshair</label>
                                    <label class="toggle-switch"><input type="checkbox" id="line-chart-crosshair-enabled" checked><span class="toggle-slider"></span></label>
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Аналитика</div>
                            <details class="line-chart-fold" id="line-chart-stats-fold">
                                <summary class="line-chart-fold__summary">Статистика (viewport)</summary>
                                <div class="line-chart-fold__body">
                                    <div class="line-chart-compact-toggles line-chart-compact-toggles--stats">
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="line-chart-stats-last">Последнее</label><label class="toggle-switch"><input type="checkbox" id="line-chart-stats-last"><span class="toggle-slider"></span></label></div>
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="line-chart-stats-minmax">Min / Max</label><label class="toggle-switch"><input type="checkbox" id="line-chart-stats-minmax"><span class="toggle-slider"></span></label></div>
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="line-chart-stats-avg">Среднее</label><label class="toggle-switch"><input type="checkbox" id="line-chart-stats-avg"><span class="toggle-slider"></span></label></div>
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="line-chart-stats-median">Медиана</label><label class="toggle-switch"><input type="checkbox" id="line-chart-stats-median"><span class="toggle-slider"></span></label></div>
                                        <div class="line-chart-inline-toggle"><label class="style-label" for="line-chart-stats-sum">Сумма</label><label class="toggle-switch"><input type="checkbox" id="line-chart-stats-sum"><span class="toggle-slider"></span></label></div>
                                    </div>
                                </div>
                            </details>
                            <div class="line-chart-analytics-item">
                                <div class="flex-between"><label class="style-label" for="line-chart-ma-enabled">Moving Average</label><label class="toggle-switch"><input type="checkbox" id="line-chart-ma-enabled"><span class="toggle-slider"></span></label></div>
                                <div id="line-chart-ma-deps" class="line-chart-deps">
                                    <label class="style-label" for="line-chart-ma-window">Окно MA</label>
                                    <input type="number" class="style-input" id="line-chart-ma-window" min="2" max="365" value="7">
                                </div>
                            </div>
                            <div class="line-chart-analytics-item">
                                <div class="flex-between"><label class="style-label" for="line-chart-trend-enabled">Линия тренда</label><label class="toggle-switch"><input type="checkbox" id="line-chart-trend-enabled"><span class="toggle-slider"></span></label></div>
                                <div id="line-chart-trend-deps" class="line-chart-deps">
                                    <label class="style-label" for="line-chart-trend-degree">Степень тренда</label>
                                    <select class="style-input" id="line-chart-trend-degree"><option value="1">Linear</option><option value="2">Polynomial²</option></select>
                                </div>
                            </div>
                            <div class="line-chart-analytics-item">
                                <div class="flex-between"><label class="style-label" for="line-chart-compare-enabled">Сравнение периодов</label><label class="toggle-switch"><input type="checkbox" id="line-chart-compare-enabled"><span class="toggle-slider"></span></label></div>
                                <div id="line-chart-compare-deps" class="line-chart-deps">
                                    <label class="style-label" for="line-chart-compare-mode">Режим сравнения</label>
                                    <select class="style-input" id="line-chart-compare-mode">
                                        <option value="previous_period">Предыдущий период</option>
                                        <option value="previous_year">Прошлый год</option>
                                        <option value="custom_shift">Свой сдвиг (мс)</option>
                                    </select>
                                    <div id="line-chart-compare-shift-row">
                                        <label class="style-label" for="line-chart-compare-shift">Сдвиг (мс)</label>
                                        <input type="number" class="style-input" id="line-chart-compare-shift" placeholder="например 86400000">
                                    </div>
                                </div>
                            </div>
                            <div class="line-chart-analytics-item">
                                <div class="flex-between"><label class="style-label" for="line-chart-forecast-enabled">Forecast</label><label class="toggle-switch"><input type="checkbox" id="line-chart-forecast-enabled"><span class="toggle-slider"></span></label></div>
                                <div id="line-chart-forecast-deps" class="line-chart-deps">
                                    <p class="line-chart-ref-hint">Прогноз вправо от последней точки (time/linear X). Viewport расширяется, если виден конец ряда.</p>
                                    <label class="style-label" for="line-chart-forecast-horizon">Горизонт (точек)</label>
                                    <input type="number" class="style-input" id="line-chart-forecast-horizon" min="1" max="500" value="30">
                                    <label class="style-label" for="line-chart-forecast-method">Метод</label>
                                    <select class="style-input" id="line-chart-forecast-method"><option value="linear">Linear</option><option value="ma">Moving Average</option></select>
                                    <label class="style-label" for="line-chart-forecast-conf">Confidence</label>
                                    <select class="style-input" id="line-chart-forecast-conf"><option value="0.8">80%</option><option value="0.95">95%</option></select>
                                </div>
                            </div>
                            <div class="line-chart-analytics-item">
                                <div class="flex-between"><label class="style-label" for="line-chart-anomalies-enabled">Аномалии (z-score)</label><label class="toggle-switch"><input type="checkbox" id="line-chart-anomalies-enabled"><span class="toggle-slider"></span></label></div>
                            </div>
                        </div>
                        <div class="style-control-group line-chart-ref-block">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Reference line</div>
                            <p class="line-chart-ref-hint">Число или скалярная Formula (SUM/AVG…). Formula считается в контексте модели/фильтров (global). Average/Median — по текущему viewport.</p>
                            <label class="style-label" for="line-chart-ref-type">Тип</label>
                            <select class="style-input" id="line-chart-ref-type">
                                <option value="constant">Constant</option>
                                <option value="target">Target</option>
                                <option value="average">Average (viewport)</option>
                                <option value="median">Median (viewport)</option>
                                <option value="band">Band (зона)</option>
                            </select>
                            <div class="line-chart-ref-fields" id="line-chart-ref-value-row">
                                <div class="formula-label-with-btn">
                                    <label class="style-label" for="line-chart-ref-value">Значение / yMin</label>
                                    ${this.formulaEditorOpenButton(
                                        'data-formula-mode="direct" data-formula-target-id="line-chart-ref-value" data-formula-apply="line-chart"',
                                    )}
                                </div>
                                <textarea class="style-input" id="line-chart-ref-value" rows="1" spellcheck="false" placeholder="150000 или SUM([t.revenue]) * 1.1"></textarea>
                            </div>
                            <div class="line-chart-ref-fields" id="line-chart-ref-ymax-row">
                                <div class="formula-label-with-btn">
                                    <label class="style-label" for="line-chart-ref-ymax">yMax (для band)</label>
                                    ${this.formulaEditorOpenButton(
                                        'data-formula-mode="direct" data-formula-target-id="line-chart-ref-ymax" data-formula-apply="line-chart"',
                                    )}
                                </div>
                                <textarea class="style-input" id="line-chart-ref-ymax" rows="1" spellcheck="false" placeholder="число или AVG([t.x])"></textarea>
                            </div>
                            <label class="style-label" for="line-chart-ref-label">Подпись</label>
                            <input type="text" class="style-input" id="line-chart-ref-label" placeholder="Target">
                            <label class="style-label" for="line-chart-ref-color">Цвет</label>
                            <input type="color" class="style-input" id="line-chart-ref-color" value="#f59e0b">
                            <button type="button" class="line-chart-ref-add-btn" id="line-chart-ref-add">
                                <span class="line-chart-ref-add-btn__plus" aria-hidden="true">+</span>
                                <span>Добавить на график</span>
                            </button>
                            <div id="line-chart-ref-list" class="line-chart-ref-list"></div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="line-chart-lod-mode">LOD downsampling</label>
                            <select class="style-input" id="line-chart-lod-mode">
                                <option value="minmax">Min/Max</option>
                                <option value="lttb">LTTB</option>
                            </select>
                            <div class="flex-between" style="margin-top:0.55rem;">
                                <label class="style-label" for="line-chart-prefer-server-agg">Server aggregation</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-prefer-server-agg" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="flex-between" style="margin-top:0.45rem;">
                                <label class="style-label" for="line-chart-zoom-toolbar">Кнопки zoom на графике</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-zoom-toolbar" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-zoom-enabled">Масштабирование (zoom)</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-zoom-enabled" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-pan-enabled">Прокрутка (pan)</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-pan-enabled" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-minimap-enabled">Mini-map</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-minimap-enabled" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-minimap-height-row">
                            <div class="slider-container">
                                <label class="style-label">Высота mini-map (px)</label>
                                <input type="range" class="style-slider" id="line-chart-minimap-height" min="40" max="120" step="4" value="60">
                                <span class="slider-value" id="line-chart-minimap-height-value">60</span>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-wheel-zoom-row">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-wheel-zoom">Колесо мыши — zoom</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-wheel-zoom" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-drag-zoom-row">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-drag-zoom">Выделение (Shift+drag / pan off)</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-drag-zoom" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-dbl-reset-row">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-dbl-reset">Двойной клик — сброс вида</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-dbl-reset" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-zoom-x-row">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-zoom-x">Zoom по оси X</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-zoom-x" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-zoom-y-row">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-zoom-y">Zoom по оси Y</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-zoom-y" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-cross-filter-brush-x-row">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-cross-filter-brush-x" title="Выделение прямоугольником по X задаёт фильтр дашборда по полю оси X (без zoom по X)">Выделение по X → фильтр дашборда</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-cross-filter-brush-x" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="line-chart-data-window-anchor">Начальный вид по оси X</label>
                            <select class="style-input" id="line-chart-data-window-anchor">
                                <option value="start">С начала ряда</option>
                                <option value="end">С конца (последние)</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <div class="slider-container">
                                <label class="style-label">Доля диапазона при первом показе</label>
                                <input type="range" class="style-slider" id="line-chart-initial-span" min="10" max="100" step="5" value="100">
                                <span class="slider-value" id="line-chart-initial-span-value">100%</span>
                            </div>
                        </div>
                        <div class="style-control-group" id="line-chart-auto-refetch-row">
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-auto-refetch" title="При панорамировании у края загруженного окна подгружаются соседние точки с сервера">Подгрузка точек при панорамировании</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-auto-refetch" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <p style="margin:0.35rem 0 0 0;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Отрисовка всегда сжимает точки под ширину экрана (Min/Max LOD) — полный ряд не рисуется целиком.
                            </p>
                        </div>
                        <div class="style-control-group" style="margin-top:0.75rem;padding-top:0.65rem;border-top:1px solid var(--border-subtle, rgba(255,255,255,0.08));">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Таймфрейм (ось времени)</div>
                            <p style="margin:0 0 0.5rem 0;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Агрегация на клиенте по интервалу. Работает при типе оси X «время» или auto → время.
                            </p>
                            <div class="flex-between">
                                <label class="style-label" for="line-chart-tf-enabled">Включить таймфреймы</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-tf-enabled">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div id="line-chart-tf-deps">
                            <label class="style-label" for="line-chart-tf-agg" style="margin-top:0.55rem;">Агрегация в бакете</label>
                            <select class="style-input" id="line-chart-tf-agg">
                                <option value="avg">Среднее (avg)</option>
                                <option value="sum">Сумма</option>
                                <option value="min">Минимум</option>
                                <option value="max">Максимум</option>
                                <option value="count">Количество строк</option>
                            </select>
                            <label class="style-label" for="line-chart-tf-bar-layout" style="margin-top:0.55rem;">Расположение кнопок</label>
                            <select class="style-input" id="line-chart-tf-bar-layout" title="Как выстраивать кнопки таймфрейма на виджете">
                                <option value="column">В столбик</option>
                                <option value="row">В строку</option>
                            </select>
                            <label class="style-label" for="line-chart-tf-bar-density" style="margin-top:0.45rem;">Вид кнопок</label>
                            <select class="style-input" id="line-chart-tf-bar-density" title="Размер кнопок и полей на полосе таймфрейма">
                                <option value="comfortable">Обычный</option>
                                <option value="compact">Компактный</option>
                            </select>
                            <label class="style-label" style="margin-top:0.55rem;">Кнопки на графике</label>
                            <p style="margin:0.25rem 0 0 0;font-size:0.72rem;color:var(--text-secondary);line-height:1.35;">
                                Порядок в списке совпадает с колонкой на виджете. Перетащите строку за иконку слева.
                            </p>
                            <div id="line-chart-tf-available-list" class="line-chart-tf-slot-list"></div>
                            <div class="line-chart-tf-add-wrap">
                                <button type="button" class="line-chart-tf-add-toggle" id="line-chart-tf-add-toggle">
                                    + Добавить интервал…
                                </button>
                                <div class="line-chart-tf-add-panel" id="line-chart-tf-add-panel">
                                    <div class="style-label" style="font-size:0.76rem;margin-bottom:6px;">Стандартные</div>
                                    <div id="line-chart-tf-add-presets" class="line-chart-tf-add-presets"></div>
                                    <div class="line-chart-tf-add-custom-row">
                                        <input type="text" class="style-input" id="line-chart-tf-add-custom-input" placeholder="напр. 45m, 2w, 3mo" autocomplete="off" title="s, m, h, d, w, mo, y">
                                        <button type="button" class="style-button" id="line-chart-tf-add-custom-apply">Добавить</button>
                                    </div>
                                </div>
                            </div>
                            <div class="flex-between" style="margin-top:0.45rem;">
                                <label class="style-label" for="line-chart-tf-allow-custom">Поле своего интервала</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-tf-allow-custom" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="flex-between" style="margin-top:0.45rem;">
                                <label class="style-label" for="line-chart-tf-auto" title="После загрузки данных подбирает интервал по числу точек">Автовыбор таймфрейма</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="line-chart-tf-auto">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <label class="style-label" for="line-chart-tf-sync" style="margin-top:0.55rem;">Синхронизация (ID группы)</label>
                            <input type="text" class="style-input" id="line-chart-tf-sync" maxlength="120" placeholder="Одинаковый ID — общий таймфрейм" autocomplete="off">
                            </div>
                        </div>
                        <div class="style-control-group line-chart-display-compact" data-line-display-block="line">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Линия</div>
                            <div class="slider-container">
                                <label class="style-label">Толщина</label>
                                <input type="range" class="style-slider" id="line-chart-line-width" min="1" max="8" step="1" value="2">
                                <span class="slider-value" id="line-chart-line-width-value">2</span>
                            </div>
                            <div class="line-chart-compact-row">
                                <div>
                                    <label class="style-label" for="line-chart-line-style">Стиль</label>
                                    <select class="style-input" id="line-chart-line-style">
                                        <option value="solid">Сплошная</option>
                                        <option value="dashed">Штрих</option>
                                        <option value="dotted">Точки</option>
                                    </select>
                                </div>
                                <div id="line-chart-line-smooth-row" class="line-chart-inline-toggle" style="align-self:end;">
                                    <label class="style-label" for="line-chart-line-smooth">Сглаживание</label>
                                    <label class="toggle-switch"><input type="checkbox" id="line-chart-line-smooth" checked><span class="toggle-slider"></span></label>
                                </div>
                            </div>
                            <div class="slider-container" style="margin-top:0.35rem;">
                                <label class="style-label">Прозрачность</label>
                                <input type="range" class="style-slider" id="line-chart-line-opacity" min="20" max="100" step="1" value="95">
                                <span class="slider-value" id="line-chart-line-opacity-value">0.95</span>
                            </div>
                        </div>
                        <div class="style-control-group line-chart-display-compact" data-line-display-block="points">
                            <div class="line-chart-inline-toggle">
                                <label class="style-label" for="line-chart-points-enabled" style="font-weight:600;">Точки</label>
                                <label class="toggle-switch"><input type="checkbox" id="line-chart-points-enabled"><span class="toggle-slider"></span></label>
                            </div>
                            <div id="line-chart-point-radius-row" class="slider-container" style="margin-top:0.35rem;">
                                <label class="style-label">Радиус</label>
                                <input type="range" class="style-slider" id="line-chart-point-radius" min="0" max="12" step="1" value="3">
                                <span class="slider-value" id="line-chart-point-radius-value">3</span>
                            </div>
                            <div id="line-chart-point-hover-radius-row" class="slider-container">
                                <label class="style-label">Hover</label>
                                <input type="range" class="style-slider" id="line-chart-point-hover-radius" min="2" max="20" step="1" value="6">
                                <span class="slider-value" id="line-chart-point-hover-radius-value">6</span>
                            </div>
                            <div id="line-chart-point-color-row" class="line-chart-compact-row" style="margin-top:0.25rem;">
                                <div>
                                    <label class="style-label" for="line-chart-point-color">Цвет</label>
                                    <input type="color" class="style-input" id="line-chart-point-color" value="#4DA3FF">
                                </div>
                            </div>
                            <div id="line-chart-threshold-block" class="line-chart-deps" style="margin-top:0.4rem;">
                                <div class="formula-label-with-btn">
                                    <label class="style-label" for="line-chart-threshold-formula">Порог цвета (формула)</label>
                                    ${this.formulaEditorOpenButton(
                                        'data-formula-mode="direct" data-formula-target-id="line-chart-threshold-formula" data-formula-apply="line-chart"',
                                    )}
                                </div>
                                <textarea class="style-input" id="line-chart-threshold-formula" rows="1" spellcheck="false"></textarea>
                                <div class="style-input-group" id="line-chart-threshold-colors-row" style="gap:0.5rem;margin-top:0.35rem;">
                                    <div style="flex:1">
                                        <label class="style-label" for="line-chart-threshold-high-color">Y ≥</label>
                                        <input type="color" class="style-input" id="line-chart-threshold-high-color" value="#34d399">
                                    </div>
                                    <div style="flex:1">
                                        <label class="style-label" for="line-chart-threshold-low-color">Y &lt;</label>
                                        <input type="color" class="style-input" id="line-chart-threshold-low-color" value="#f87171">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group line-chart-display-compact" data-line-display-block="labels">
                            <div class="line-chart-inline-toggle">
                                <label class="style-label" for="line-chart-labels-enabled" style="font-weight:600;">Подписи</label>
                                <label class="toggle-switch"><input type="checkbox" id="line-chart-labels-enabled"><span class="toggle-slider"></span></label>
                            </div>
                            <div id="line-chart-label-mode-row" class="line-chart-compact-row" style="margin-top:0.35rem;">
                                <div>
                                    <label class="style-label" for="line-chart-label-mode">Режим</label>
                                    <select class="style-input" id="line-chart-label-mode">
                                        <option value="none">Нет</option>
                                        <option value="last_point">Последняя</option>
                                        <option value="all">Все</option>
                                        <option value="extremes">Min/Max</option>
                                    </select>
                                </div>
                                <div id="line-chart-label-position-row">
                                    <label class="style-label" for="line-chart-label-position">Позиция</label>
                                    <select class="style-input" id="line-chart-label-position">
                                        <option value="auto">Авто</option>
                                        <option value="above">Сверху</option>
                                        <option value="below">Снизу</option>
                                    </select>
                                </div>
                            </div>
                            <div id="line-chart-label-format-row" style="margin-top:0.35rem;">
                                <label class="style-label" for="line-chart-label-format">Формат</label>
                                <select class="style-input" id="line-chart-label-format">
                                    <option value="auto">Авто</option>
                                    <option value="number">Число</option>
                                    <option value="date">Дата</option>
                                    <option value="custom">Шаблон</option>
                                </select>
                            </div>
                            <div id="line-chart-label-custom-row" style="margin-top:0.35rem;">
                                <label class="style-label" for="line-chart-label-custom">Шаблон ({'{value}'}, {'{x}'})</label>
                                <input type="text" class="style-input" id="line-chart-label-custom" placeholder="{value}">
                            </div>
                        </div>
                        <div class="style-control-group line-chart-display-compact" data-line-display-block="tooltip">
                            <div class="line-chart-inline-toggle">
                                <label class="style-label" for="line-chart-tooltip-enabled" style="font-weight:600;" title="Подсказка при наведении">Tooltip</label>
                                <label class="toggle-switch"><input type="checkbox" id="line-chart-tooltip-enabled" checked><span class="toggle-slider"></span></label>
                            </div>
                            <div id="line-chart-tooltip-deps" class="line-chart-compact-toggles" style="margin-top:0.35rem;">
                                <div class="line-chart-inline-toggle">
                                    <label class="style-label" for="line-chart-tooltip-show-value">Значение</label>
                                    <label class="toggle-switch"><input type="checkbox" id="line-chart-tooltip-show-value" checked><span class="toggle-slider"></span></label>
                                </div>
                                <div class="line-chart-inline-toggle">
                                    <label class="style-label" for="line-chart-tooltip-pct">% Δ</label>
                                    <label class="toggle-switch"><input type="checkbox" id="line-chart-tooltip-pct" checked><span class="toggle-slider"></span></label>
                                </div>
                            </div>
                        </div>
                        <div class="style-control-group line-chart-display-compact" data-line-display-block="grid">
                            <div class="line-chart-inline-toggle">
                                <label class="style-label" for="line-chart-grid-enabled" style="font-weight:600;">Сетка</label>
                                <label class="toggle-switch"><input type="checkbox" id="line-chart-grid-enabled" checked><span class="toggle-slider"></span></label>
                            </div>
                            <div id="line-chart-grid-density-row" class="slider-container" style="margin-top:0.35rem;">
                                <label class="style-label">Плотность</label>
                                <input type="range" class="style-slider" id="line-chart-grid-density" min="2" max="12" step="1" value="5">
                                <span class="slider-value" id="line-chart-grid-density-value">5</span>
                            </div>
                            <div id="line-chart-grid-opacity-row" class="slider-container">
                                <label class="style-label">Прозрачность</label>
                                <input type="range" class="style-slider" id="line-chart-grid-opacity" min="0" max="40" step="1" value="14">
                                <span class="slider-value" id="line-chart-grid-opacity-value">0.14</span>
                            </div>
                            <div id="line-chart-grid-color-row" style="margin-top:0.25rem;">
                                <label class="style-label" for="line-chart-grid-color">Цвет</label>
                                <input type="color" class="style-input" id="line-chart-grid-color" value="#00E0FF">
                            </div>
                        </div>
                        <div class="style-control-group line-chart-display-compact" data-line-display-block="axes">
                            <div class="style-label" style="font-weight:600;margin-bottom:0.35rem;">Оси</div>
                            <div class="line-chart-compact-toggles">
                                <div class="line-chart-inline-toggle">
                                    <label class="style-label" for="line-chart-axis-x">Ось X</label>
                                    <label class="toggle-switch"><input type="checkbox" id="line-chart-axis-x" checked><span class="toggle-slider"></span></label>
                                </div>
                                <div class="line-chart-inline-toggle">
                                    <label class="style-label" for="line-chart-axis-y">Ось Y</label>
                                    <label class="toggle-switch"><input type="checkbox" id="line-chart-axis-y" checked><span class="toggle-slider"></span></label>
                                </div>
                            </div>
                            <div class="line-chart-compact-row" style="margin-top:0.35rem;">
                                <div id="line-chart-axis-x-type-row">
                                    <label class="style-label" for="line-chart-axis-x-type">Тип X</label>
                                    <select class="style-input" id="line-chart-axis-x-type">
                                        <option value="auto">Авто</option>
                                        <option value="linear">Число</option>
                                        <option value="time">Время</option>
                                        <option value="category">Категория</option>
                                    </select>
                                </div>
                                <div id="line-chart-axis-x-rotate-row">
                                    <label class="style-label" for="line-chart-axis-x-rotate">Поворот X°</label>
                                    <select class="style-input" id="line-chart-axis-x-rotate">
                                        <option value="0">0</option>
                                        <option value="45">45</option>
                                        <option value="-45">-45</option>
                                        <option value="90">90</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createFilterWidgetSettingsSection() {
        return `
            <div class="style-section filter-widget-settings-section expanded" data-section="filter-widget-settings" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Фильтр</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="filter-show-title">Показывать заголовок</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="filter-show-title" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group" id="filter-widget-title-row">
                            <label class="style-label" for="filter-widget-title">Текст заголовка</label>
                            <input type="text" class="style-input" id="filter-widget-title" placeholder="Фильтры" autocomplete="off">
                        </div>
                        <div class="style-control-group" id="filter-title-color-row">
                            <label class="style-label" for="filter-title-color-text">Цвет текста заголовка</label>
                            <div class="color-picker-wrapper">
                                <div class="color-picker">
                                    <input type="color" id="filter-title-color" value="#8B5CF6">
                                </div>
                                <input type="text" class="style-input" id="filter-title-color-text" value="#8B5CF6" style="flex: 1;">
                            </div>
                        </div>
                        <div class="filter-widget-btn-style" id="filter-style-block">
                            <div class="button-widget-shared-style__title">Оформление фильтра</div>
                            <div class="button-widget-field-hint">Акцент и скругление по умолчанию берутся из темы дашборда.</div>
                            <div class="style-control-group" style="margin-top:0.45rem;">
                                <label class="style-label" for="filter-style-variant">Вариант полей</label>
                                <select class="style-select" id="filter-style-variant" data-filter-style="variant">
                                    <option value="soft">Мягкий</option>
                                    <option value="outline">Контур</option>
                                    <option value="filled">Заливка</option>
                                    <option value="underline">Подчёркивание</option>
                                    <option value="pill">Таблетки</option>
                                    <option value="glass">Стекло</option>
                                </select>
                            </div>
                            <div class="style-input-group">
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-style-size">Размер</label>
                                    <select class="style-select" id="filter-style-size" data-filter-style="size">
                                        <option value="sm">S</option>
                                        <option value="md">M</option>
                                        <option value="lg">L</option>
                                    </select>
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-style-layout">Раскладка</label>
                                    <select class="style-select" id="filter-style-layout" data-filter-style="layout">
                                        <option value="auto">Авто</option>
                                        <option value="row">В строку</option>
                                        <option value="column">Столбиком</option>
                                    </select>
                                </div>
                            </div>
                            <div class="style-control-group">
                                <label class="style-label" for="filter-style-radius">Скругление: <span id="filter-style-radius-val">как в теме</span></label>
                                <input type="range" class="style-slider" id="filter-style-radius" data-filter-style="radius" min="-1" max="24" step="1" value="-1">
                            </div>
                            <div class="style-control-group">
                                <label class="style-label" for="filter-style-gap">Отступ между полями: <span id="filter-style-gap-val">8px</span></label>
                                <input type="range" class="style-slider" id="filter-style-gap" data-filter-style="gap" min="0" max="24" step="1" value="8">
                            </div>
                            <div class="style-control-group">
                                <div class="flex-between">
                                    <label class="style-label" for="filter-style-accent-theme">Акцент как в теме</label>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="filter-style-accent-theme" data-filter-style="accentTheme" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                <div class="color-picker-wrapper" id="filter-style-accent-row" style="margin-top:0.35rem;">
                                    <div class="color-picker">
                                        <input type="color" id="filter-style-accent" data-filter-style="accent" value="#8B5CF6">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="filter-widget-btn-style" id="filter-btn-style-block">
                            <div class="button-widget-shared-style__title">Стиль кнопок полей</div>
                            <div class="button-widget-field-hint">Один стиль для всех кнопок фильтра внутри виджета.</div>
                            <div class="style-input-group" style="margin-top:0.45rem;">
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-btn-bg">Фон</label>
                                    <input type="color" class="style-input" id="filter-btn-bg" data-filter-btn-style="background" value="#163A42">
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-btn-hover">Hover</label>
                                    <input type="color" class="style-input" id="filter-btn-hover" data-filter-btn-style="hoverBackground" value="#1C4F5A">
                                </div>
                            </div>
                            <div class="style-input-group">
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-btn-open">Открытая</label>
                                    <input type="color" class="style-input" id="filter-btn-open" data-filter-btn-style="openBackground" value="#226672">
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-btn-border">Рамка</label>
                                    <input type="color" class="style-input" id="filter-btn-border" data-filter-btn-style="borderColor" value="#2A7A88">
                                </div>
                            </div>
                            <div class="style-input-group">
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-btn-radius">Скругление</label>
                                    <input type="number" class="style-input" id="filter-btn-radius" data-filter-btn-style="borderRadius" min="0" max="999" value="999">
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label" for="filter-btn-font-weight">Жирность</label>
                                    <select class="style-input" id="filter-btn-font-weight" data-filter-btn-style="fontWeight">
                                        <option value="400">400</option>
                                        <option value="500">500</option>
                                        <option value="600" selected>600</option>
                                        <option value="700">700</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" class="btn btn-secondary" id="filter-btn-style-reset" style="margin-top:0.55rem;width:100%;">Сбросить стиль кнопок</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createDataInputWidgetSettingsSection() {
        const titleBlock = this.createWidgetTitleControlsHtml('data-input', {
            defaultTitle: 'Ввод данных',
            placeholder: 'Ввод данных',
        });

        const sourceBlock = `
                        <div class="style-control-group" id="data-input-model-row">
                            <label class="style-label" for="data-input-model-id">Модель данных</label>
                            <select class="style-select" id="data-input-model-id">
                                <option value="">Загрузка…</option>
                            </select>
                            <div class="style-field-hint" id="data-input-model-hint">Выберите модель, подключённую к дашборду.</div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="data-input-table">Таблица</label>
                            <select class="style-select" id="data-input-table">
                                <option value="">Сначала выберите модель</option>
                            </select>
                            <div class="style-field-hint">Таблицы выбранной модели, куда форма будет вставлять строки.</div>
                        </div>
                        <div class="style-control-group data-input-generate-row">
                            <button type="button" class="btn btn-secondary" id="data-input-generate-fields">Сгенерировать поля из схемы</button>
                            <div class="style-field-hint">Подставит колонки таблицы в список полей ниже. Текущие поля будут заменены.</div>
                            <div id="data-input-generate-status" class="data-input-panel-status" hidden></div>
                        </div>`;

        const formBlock = `
                        <div class="style-control-group">
                            <label class="style-label" for="data-input-submit-label">Текст кнопки отправки</label>
                            <input type="text" class="style-input" id="data-input-submit-label" maxlength="80" placeholder="Сохранить">
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="data-input-columns">Колонок в форме</label>
                            <select class="style-select" id="data-input-columns">
                                <option value="1">1 — одна колонка</option>
                                <option value="2">2 — две колонки</option>
                                <option value="3">3 — три колонки</option>
                            </select>
                            <div class="style-field-hint">Как разложить поля на сетке внутри виджета.</div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="data-input-interactive-editor" title="В режиме редактора форма обычно неактивна">Клики в редакторе</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="data-input-interactive-editor">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="style-field-hint">Нужно, чтобы проверить отправку формы, не переключаясь в просмотр.</div>
                        </div>`;

        const accessBlock = `
                        <div class="style-control-group">
                            <div class="flex-between" style="align-items:baseline;gap:0.5rem;">
                                <label class="style-label">Роли с правом записи</label>
                                <button type="button" class="btn btn-secondary btn-sm" id="data-input-role-add">Добавить</button>
                            </div>
                            <div id="data-input-roles-list" class="data-input-roles-list" role="list"></div>
                            <div id="data-input-role-picker" class="data-input-role-picker" hidden>
                                <select class="style-select" id="data-input-role-select" aria-label="Выберите роль">
                                    <option value="">Выберите роль…</option>
                                </select>
                            </div>
                            <div class="style-field-hint">TeamRole сотрудников, которым разрешено сохранять данные через форму.</div>
                        </div>`;

        const fieldsBlock = `
                        <div class="style-control-group">
                            <div class="flex-between" style="align-items:baseline;gap:0.5rem;">
                                <label class="style-label">Поля формы</label>
                                <span id="data-input-fields-count" class="data-input-fields-count">0 полей</span>
                            </div>
                            <div id="data-input-fields-list" class="data-input-fields-list"></div>
                            <div class="data-input-fields-actions">
                                <button type="button" class="btn btn-secondary btn-sm" id="data-input-field-add">Добавить поле</button>
                            </div>
                            <div id="data-input-fields-status" class="data-input-panel-status" hidden></div>
                            <div class="style-field-hint">Имя поля должно совпадать с колонкой выбранной таблицы. Несуществующие колонки подсвечены.</div>
                        </div>`;

        return `
            <div class="style-section data-input-settings-section expanded" data-section="data-input-settings" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Ввод данных</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner style-section-inner--subgroups">
                        ${this.createStyleSubgroup('data-input-title', 'Заголовок', titleBlock, { expanded: true })}
                        ${this.createStyleSubgroup('data-input-source', 'Источник данных', sourceBlock, { expanded: true })}
                        ${this.createStyleSubgroup('data-input-form', 'Форма', formBlock, { expanded: true })}
                        ${this.createStyleSubgroup('data-input-access', 'Доступ', accessBlock, { expanded: false })}
                        ${this.createStyleSubgroup('data-input-fields', 'Поля формы', fieldsBlock, { expanded: true })}
                    </div>
                </div>
            </div>
        `;
    }

    createButtonWidgetSettingsSection() {
        return `
            <div class="style-section button-widget-settings-section expanded" data-section="button-widget-settings" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Кнопки</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        ${this.createWidgetTitleControlsHtml('button-widget', {
                            defaultTitle: 'Кнопки',
                            placeholder: 'Кнопки',
                        })}
                        <div class="style-control-group">
                            <label class="style-label" for="button-widget-layout-direction">Расположение</label>
                            <select class="style-input" id="button-widget-layout-direction">
                                <option value="row">В ряд</option>
                                <option value="column">Столбиком</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="button-widget-layout-wrap">Переносить на новую строку</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="button-widget-layout-wrap" checked>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label" for="button-widget-interactive-editor" title="В режиме редактора кнопки обычно неактивны">Клики в редакторе</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="button-widget-interactive-editor">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div class="button-widget-field-hint">Нужно, чтобы проверить действие кнопки, не выходя в просмотр</div>
                        </div>
                        ${this.createStyleSubgroup(
                            'button-widget-shared-style',
                            'Общий стиль кнопок',
                            `
                            <div class="button-widget-shared-style">
                                <div class="button-widget-field-hint">Применяется ко всем кнопкам. У отдельной кнопки можно включить «Свой стиль».</div>
                                <div class="style-input-group" style="margin-top:0.45rem;">
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-bg">Фон</label>
                                        <input type="color" class="style-input" id="button-widget-shared-bg" data-button-shared-style="background" value="#2D6BFF">
                                    </div>
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-color">Текст</label>
                                        <input type="color" class="style-input" id="button-widget-shared-color" data-button-shared-style="color" value="#FFFFFF">
                                    </div>
                                </div>
                                <div class="style-input-group">
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-hover">Hover</label>
                                        <input type="color" class="style-input" id="button-widget-shared-hover" data-button-shared-style="hoverBackground" value="#3D7BFF">
                                    </div>
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-active">Active</label>
                                        <input type="color" class="style-input" id="button-widget-shared-active" data-button-shared-style="activeBackground" value="#1E57E2">
                                    </div>
                                </div>
                                <div class="style-input-group">
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-border">Рамка</label>
                                        <input type="color" class="style-input" id="button-widget-shared-border" data-button-shared-style="borderColor" value="#2D6BFF">
                                    </div>
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-radius">Скругление</label>
                                        <input type="number" class="style-input" id="button-widget-shared-radius" data-button-shared-style="borderRadius" min="0" max="48" value="8">
                                    </div>
                                </div>
                                <div class="style-input-group">
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-font-size">Размер шрифта</label>
                                        <input type="number" class="style-input" id="button-widget-shared-font-size" data-button-shared-style="fontSize" min="8" max="72" value="14">
                                    </div>
                                    <div class="style-control-group">
                                        <label class="style-label" for="button-widget-shared-font-weight">Жирность</label>
                                        <select class="style-input" id="button-widget-shared-font-weight" data-button-shared-style="fontWeight">
                                            <option value="400">400</option>
                                            <option value="500">500</option>
                                            <option value="600" selected>600</option>
                                            <option value="700">700</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            `,
                            { expanded: false },
                        )}
                        <div id="button-widget-buttons-list" class="button-widget-buttons-list"></div>
                        <button type="button" class="btn btn-secondary" id="button-widget-add-btn">+ Добавить кнопку</button>
                    </div>
                </div>
            </div>
        `;
    }

    _ensureButtonWidgetIconMenu() {
        let menu = this._buttonIconMenuEl;
        if (menu && menu.isConnected) return menu;
        menu = document.getElementById('button-widget-icon-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'button-widget-icon-menu';
            menu.className = 'button-widget-icon-menu';
            menu.hidden = true;
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', 'Выбор иконки');
            menu.innerHTML = `
                <div class="button-widget-icon-menu__grid" data-button-icon-grid></div>
                <div class="button-widget-icon-menu__pager">
                    <button type="button" class="button-widget-icon-menu__page-btn" data-button-icon-page="prev" aria-label="Предыдущая страница">‹</button>
                    <span class="button-widget-icon-menu__page-label" data-button-icon-page-label>1 / 1</span>
                    <button type="button" class="button-widget-icon-menu__page-btn" data-button-icon-page="next" aria-label="Следующая страница">›</button>
                </div>
            `;
            document.body.appendChild(menu);
        }
        this._buttonIconMenuEl = menu;
        return menu;
    }

    createDataBindingSection() {
        return `
            <div class="style-section data-binding-section expanded" data-section="data-binding" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Привязка к полям</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div id="data-binding-chips" class="data-binding-chips" aria-live="polite"></div>
                    </div>
                </div>
            </div>
        `;
    }

    setupDataBindingChipListener() {
        if (this._dataBindingListenerAttached || !this.panel) return;
        this._dataBindingListenerAttached = true;
        this.panel.addEventListener('click', (e) => {
            const formulaBtn = e.target.closest('[data-table-column-formula]');
            if (formulaBtn && this.panel.contains(formulaBtn)) {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(formulaBtn.getAttribute('data-table-column-formula'), 10);
                if (!Number.isNaN(idx)) {
                    this.openTableColumnFormulaEditor(idx);
                }
                return;
            }

            const chartFormulaBtn = e.target.closest('[data-chart-binding-formula]');
            if (chartFormulaBtn && this.panel.contains(chartFormulaBtn)) {
                e.preventDefault();
                e.stopPropagation();
                const role = chartFormulaBtn.getAttribute('data-chart-binding-formula');
                if (role === 'dimension' || role === 'measure') {
                    this.openChartBindingFormulaEditor(role);
                }
                return;
            }

            const btn = e.target.closest('[data-binding-remove]');
            if (!btn || !this.currentWidget) return;
            e.preventDefault();
            const w = this.currentWidget;
            const kind = btn.getAttribute('data-binding-remove');

            if (kind === 'table-field') {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                if (!Number.isNaN(idx) && Array.isArray(w.settings?.bindingFields)) {
                    w.settings.bindingFields.splice(idx, 1);
                    if (w.settings.bindingFields.length === 0) {
                        w.dataSource = null;
                    }
                }
                if (this.engine && typeof w.reloadFromDataModel === 'function') {
                    void w.reloadFromDataModel(this.engine);
                } else {
                    w.update();
                }
                this.updateDataBindingSection(w);
                eventBus.emit('widget:data-binding-updated', { widget: w });
                if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
                return;
            } else if (kind === 'kpi-field' || kind === 'gauge-field' || kind === 'image-field') {
                w.dataSource = null;
            } else if (kind === 'chart-dim') {
                if (w.settings) w.settings.bindingDimension = null;
            } else if (kind === 'chart-meas') {
                if (w.settings) w.settings.bindingMeasure = null;
            } else if (kind === 'filter-field') {
                const fid = btn.getAttribute('data-filter-id');
                if (fid && Array.isArray(w.settings?.filters)) {
                    const next = w.settings.filters.filter((x) => x.id !== fid);
                    if (next.length !== w.settings.filters.length) {
                        w.settings.filters = next;
                        if (w._expandedFilterId === fid) w._expandedFilterId = null;
                    }
                }
            }

            w.update();
            eventBus.emit('widget:data-binding-updated', { widget: w });
            if (kind === 'filter-field') {
                eventBus.emit('dashboard:filters-changed', { source: 'style-panel-filter-remove' });
                if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
            }
        });

        this.panel.addEventListener('input', (e) => {
            const inp = e.target.closest('.filter-field-display-label');
            if (!inp || !this.currentWidget || this.currentWidget.type !== 'filter') return;
            const fid = inp.getAttribute('data-filter-id');
            const row = this.currentWidget.settings?.filters?.find((x) => x.id === fid);
            if (!row) return;
            row.displayLabel = inp.value;
            syncFilterRowsByField(this.engine, row, {});
            this.currentWidget.update();
        });
        this.panel.addEventListener('blur', (e) => {
            const inp = e.target.closest('.filter-field-display-label');
            if (!inp || !this.currentWidget || this.currentWidget.type !== 'filter') return;
            if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
            eventBus.emit('widget:data-binding-updated', { widget: this.currentWidget });
        }, true);

        this._bindingDragFrom = null;
        this.panel.addEventListener('dragstart', (e) => {
            const chip = e.target.closest('.data-binding-chip[data-bind-idx]');
            if (!chip || !this.currentWidget || this.currentWidget.type !== 'table') return;
            if (e.target.closest('[data-binding-remove]') || e.target.closest('[data-table-column-formula]')) {
                e.preventDefault();
                return;
            }
            const from = parseInt(chip.dataset.bindIdx, 10);
            if (Number.isNaN(from)) return;
            this._bindingDragFrom = from;
            chip.classList.add('data-binding-chip--dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(from));
        });
        this.panel.addEventListener('dragend', () => {
            this._bindingDragFrom = null;
            this.panel.querySelectorAll('.data-binding-chip--dragging').forEach((el) => {
                el.classList.remove('data-binding-chip--dragging');
            });
            this.panel.querySelectorAll('.data-binding-chip--drag-over').forEach((el) => {
                el.classList.remove('data-binding-chip--drag-over');
            });
        });
        this.panel.addEventListener('dragover', (e) => {
            if (!this.currentWidget || this.currentWidget.type !== 'table') return;
            const chip = e.target.closest('.data-binding-chip[data-bind-idx]');
            this.panel.querySelectorAll('.data-binding-chip--drag-over').forEach((c) => {
                c.classList.remove('data-binding-chip--drag-over');
            });
            if (chip) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                chip.classList.add('data-binding-chip--drag-over');
            }
        });
        this.panel.addEventListener('drop', (e) => {
            const chip = e.target.closest('.data-binding-chip[data-bind-idx]');
            if (!chip || !this.currentWidget || this.currentWidget.type !== 'table') return;
            e.preventDefault();
            const from = this._bindingDragFrom ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
            const to = parseInt(chip.dataset.bindIdx, 10);
            if (from == null || Number.isNaN(from) || Number.isNaN(to) || from === to) return;
            const w = this.currentWidget;
            const bf = w.settings?.bindingFields;
            if (!Array.isArray(bf) || from < 0 || from >= bf.length || to < 0 || to >= bf.length) return;
            const [moved] = bf.splice(from, 1);
            bf.splice(to, 0, moved);
            w.update();
            eventBus.emit('widget:data-binding-updated', { widget: w });
            this.updateDataBindingSection(w);
        });
    }

    _escapeBindingText(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    updateDataBindingSection(widget) {
        const section = this.panel?.querySelector('.data-binding-section');
        const chips = this.panel?.querySelector('#data-binding-chips');
        if (!section || !chips) return;

        const typesWithBindingUi = [
            'table',
            'kpi',
            'gauge',
            'line-chart',
            'bar-chart',
            'pie-chart',
            'filter',
            'image',
        ];
        if (!widget || !typesWithBindingUi.includes(widget.type)) {
            section.style.display = 'none';
            chips.innerHTML = '';
            this.syncFilterAppearancePanel(null);
            return;
        }

        section.style.display = 'block';
        chips.innerHTML = '';
        chips.className = 'data-binding-chips';

        if (widget.type === 'table') {
            chips.classList.add('data-binding-chips--column');
            (widget.settings?.bindingFields || []).forEach((b, idx) => {
                const chip = document.createElement('div');
                chip.className = 'data-binding-chip data-binding-chip--row';
                chip.draggable = true;
                chip.dataset.bindIdx = String(idx);
                chip.title = `${b.table}.${b.field} — перетащите для порядка колонок`;
                chip.innerHTML = `
                    <span class="data-binding-chip-handle" title="Переместить">⠿</span>
                    <span class="data-binding-chip-label">${this._escapeBindingText(b.field)}</span>
                    <button type="button" class="formula-open-btn formula-open-btn--compact data-binding-formula-btn" data-table-column-formula="${idx}" draggable="false" aria-label="Редактор формулы колонки" title="${this._escapeBindingText(b.formula || defaultTableColumnFormula(b))}">fx</button>
                    <button type="button" class="data-binding-chip-remove" data-binding-remove="table-field" data-idx="${idx}" draggable="false" title="Убрать">×</button>
                `;
                chips.appendChild(chip);
            });
        } else if (widget.type === 'kpi' || widget.type === 'gauge') {
            const f = widget.dataSource?.field;
            if (f) {
                const kind = widget.type === 'kpi' ? 'kpi-field' : 'gauge-field';
                const chip = document.createElement('span');
                chip.className = 'data-binding-chip';
                chip.title = `${widget.dataSource.table}.${f}`;
                chip.innerHTML = `
                <span class="data-binding-chip-label">${this._escapeBindingText(f)}</span>
                <button type="button" class="data-binding-chip-remove" data-binding-remove="${kind}" title="Убрать">×</button>
            `;
                chips.appendChild(chip);
            }
        } else if (widget.type === 'image') {
            const f = widget.dataSource?.field;
            if (f) {
                const chip = document.createElement('span');
                chip.className = 'data-binding-chip';
                chip.title = `${widget.dataSource.table || ''}.${f}`.replace(/^\./, '');
                chip.innerHTML = `
                <span class="data-binding-chip-label">${this._escapeBindingText(f)}</span>
                <button type="button" class="data-binding-chip-remove" data-binding-remove="image-field" title="Убрать">×</button>
            `;
                chips.appendChild(chip);
            }
        } else if (['line-chart', 'bar-chart', 'pie-chart'].includes(widget.type)) {
            const dim = widget.settings?.bindingDimension;
            const meas = widget.settings?.bindingMeasure;
            if (dim?.field || String(dim?.formula || '').trim()) {
                const dimLabel = dim.field || 'формула';
                const dimFx = dim.formula || defaultChartBindingFormula(dim);
                const chip = document.createElement('span');
                chip.className = 'data-binding-chip';
                chip.title = `${dim.table}.${dim.field || ''}`.replace(/\.$/, '');
                chip.innerHTML = `
                    <span class="data-binding-chip-label">Измерение: ${this._escapeBindingText(dimLabel)}</span>
                    <button type="button" class="formula-open-btn formula-open-btn--compact data-binding-formula-btn" data-chart-binding-formula="dimension" aria-label="Редактор формулы измерения" title="${this._escapeBindingText(dimFx)}">fx</button>
                    <button type="button" class="data-binding-chip-remove" data-binding-remove="chart-dim" title="Убрать">×</button>
                `;
                chips.appendChild(chip);
            }
            if (meas?.field || String(meas?.formula || '').trim()) {
                const measLabel = meas.field || 'формула';
                const measFx = meas.formula || defaultChartBindingFormula(meas);
                const chip = document.createElement('span');
                chip.className = 'data-binding-chip';
                chip.title = `${meas.table}.${meas.field || ''}`.replace(/\.$/, '');
                chip.innerHTML = `
                    <span class="data-binding-chip-label">Мера: ${this._escapeBindingText(measLabel)}</span>
                    <button type="button" class="formula-open-btn formula-open-btn--compact data-binding-formula-btn" data-chart-binding-formula="measure" aria-label="Редактор формулы меры" title="${this._escapeBindingText(measFx)}">fx</button>
                    <button type="button" class="data-binding-chip-remove" data-binding-remove="chart-meas" title="Убрать">×</button>
                `;
                chips.appendChild(chip);
            }
        } else if (widget.type === 'filter') {
            chips.classList.add('data-binding-chips--column');
            (widget.settings?.filters || []).forEach((f) => {
                const wrap = document.createElement('div');
                wrap.className = 'data-binding-filter-bind-row';
                const chip = document.createElement('div');
                chip.className = 'data-binding-chip data-binding-chip--row';
                chip.title = `${f.table}.${f.field}`;
                chip.innerHTML = `
                    <span class="data-binding-chip-label">${this._escapeBindingText(f.field)}</span>
                    <span class="data-binding-chip-meta">${this._escapeBindingText(f.table)}</span>
                    <button type="button" class="data-binding-chip-remove" data-binding-remove="filter-field" data-filter-id="${this._escapeBindingText(f.id)}" title="Убрать поле">×</button>
                `;
                wrap.appendChild(chip);
                const grp = document.createElement('div');
                grp.className = 'style-control-group data-binding-filter-label-group';
                const ph = this._escapeBindingText(f.field);
                const val = this._escapeBindingText(f.displayLabel ?? '');
                grp.innerHTML = `
                    <label class="style-label">Подпись на виджете</label>
                    <input type="text" class="style-input filter-field-display-label" data-filter-id="${this._escapeBindingText(f.id)}" value="${val}" placeholder="${ph}">
                `;
                wrap.appendChild(grp);
                chips.appendChild(wrap);
            });
            this.syncFilterAppearancePanel(widget);
        }
    }

    createTabsSection() {
        return `
            <div class="style-section tabs-section" data-section="tabs" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Вкладки</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <label class="style-label">Виджеты в контейнере</label>
                            <div class="tabs-list-hint">Клик по ✎ или двойной клик по названию — переименовать вкладку (независимо от заголовка виджета). Порядок: перетащите за ручку слева.</div>
                            <div class="tabs-list" id="container-tabs-list">
                                <div class="tabs-empty-message">Нет виджетов в контейнере</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createContainerTabPositionSection() {
        return `
            <div class="style-section container-tab-position-section" data-section="container-tab-position" style="display: none;">
                <div class="style-section-header">
                    <span class="style-section-title">Отображение</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        ${this.createWidgetTitleControlsHtml('container', {
                            defaultTitle: 'Шкаф',
                            placeholder: 'Шкаф',
                        })}
                        <div class="style-control-group">
                            <label class="style-label">Расположение заголовка с вкладками</label>
                            <select class="style-select" id="container-tab-position">
                                <option value="top">Сверху</option>
                                <option value="bottom">Снизу</option>
                                <option value="left">Слева</option>
                                <option value="right">Справа</option>
                            </select>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label" for="container-slots-per-tab">Виджетов на одной вкладке</label>
                            <select class="style-select" id="container-slots-per-tab">
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                            </select>
                            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);">
                                На вкладке до четырёх виджетов — сеткой. Смена порядка вкладок перетаскиванием (ручка слева) доступна только при значении 1.
                            </div>
                        </div>
                        <div class="style-control-group">
                            <div class="flex-between">
                                <label class="style-label">Скрыть контент (только вкладки)</label>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="container-content-collapsed">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary);">
                                При включении контент будет скрыт, при клике на вкладку - откроется
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createAdvancedCSSSection() {
        return `
            <div class="style-section" data-section="advanced">
                <div class="style-section-header">
                    <span class="style-section-title">Расширенный CSS</span>
                    <div class="style-section-chevron">▼</div>
                </div>
                <div class="style-section-body">
                    <div class="style-section-inner">
                        <div class="style-control-group">
                            <label class="style-label">Пользовательский CSS</label>
                            <textarea class="css-editor" id="style-custom-css" placeholder="/* Пользовательский CSS */&#10;transform: rotate(5deg);"></textarea>
                        </div>
                        <div class="css-variables">
                            <div class="css-variables-title">Доступные переменные</div>
                            <div class="css-variable">--widget-bg</div>
                            <div class="css-variable">--widget-border-radius</div>
                            <div class="css-variable">--widget-shadow</div>
                            <div class="css-variable">--widget-accent</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupAccordions() {
        // Setup accordion toggles
        this.panel.querySelectorAll('.style-section-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.style-section');
                section.classList.toggle('expanded');
            });
        });

        this.panel.querySelectorAll('.style-subgroup-header').forEach((header) => {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const subgroup = header.closest('.style-subgroup');
                if (!subgroup) return;
                const open = subgroup.classList.toggle('expanded');
                header.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });

        // Setup background type switcher
        const bgTypeSelect = this.panel.querySelector('#style-bg-type');
        if (bgTypeSelect) {
            bgTypeSelect.addEventListener('change', (e) => {
                const type = e.target.value;
                this.panel.querySelector('#bg-solid-controls').style.display = type === 'solid' ? 'block' : 'none';
                this.panel.querySelector('#bg-gradient-controls').style.display = type === 'gradient' ? 'block' : 'none';
                this.panel.querySelector('#bg-glass-controls').style.display = type === 'glass' ? 'block' : 'none';
                if (type === 'gradient' && !this.currentGradient) {
                    this.applyGradientConfigToPanel(this.defaultGradientConfig(), { showCustom: false });
                }
                if (type !== 'gradient') {
                    this.setCustomGradientControlsVisible(false);
                }
                if (!this._isLoadingWidgetStyles) {
                    this.updateWidget();
                }
            });
        }

        ['#style-variant', '#style-density'].forEach((sel) => {
            this.panel.querySelector(sel)?.addEventListener('change', () => {
                if (!this._isLoadingWidgetStyles) {
                    this.updateWidget();
                }
            });
        });

        // Setup all event listeners
        this.setupEventListeners();
    }

    setupWidgetPositionSync() {
        // Синхронизация полей X и Y при перемещении виджета
        eventBus.on('widget:moved', ({ widget }) => {
            if (widget === this.currentWidget) {
                this.updatePositionFields(widget);
            }
        });
        eventBus.on('widget:move-end', ({ widget }) => {
            if (widget === this.currentWidget) {
                this.updatePositionFields(widget);
            }
        });
        eventBus.on('widget:resized', ({ widget }) => {
            if (widget === this.currentWidget) {
                this.updatePositionFields(widget);
                this.updateSizeFields(widget);
            }
        });
        eventBus.on('widget:resize-end', ({ widget }) => {
            if (widget === this.currentWidget) {
                this.updatePositionFields(widget);
                this.updateSizeFields(widget);
            }
        });
    }

    updatePositionFields(widget) {
        if (!widget || !this.panel) return;
        const xInput = this.panel.querySelector('#style-x');
        const yInput = this.panel.querySelector('#style-y');
        // Устанавливаем флаг, что это автоматическое обновление, а не ручное изменение пользователем
        this._isUpdatingPositionFields = true;
        if (xInput) xInput.value = Math.round(widget.x || 0);
        if (yInput) yInput.value = Math.round(widget.y || 0);
        // Сбрасываем флаг после небольшой задержки, чтобы обработчики событий успели сработать
        setTimeout(() => {
            this._isUpdatingPositionFields = false;
        }, 0);
    }

    updateSizeFields(widget) {
        if (!widget || !this.panel) return;
        const wInput = this.panel.querySelector('#style-w');
        const hInput = this.panel.querySelector('#style-h');
        // Устанавливаем флаг, что это автоматическое обновление
        this._isUpdatingSizeFields = true;
        if (wInput) wInput.value = Math.round(widget.width || 300);
        if (hInput) hInput.value = Math.round(widget.height || 200);
        setTimeout(() => {
            this._isUpdatingSizeFields = false;
        }, 0);
    }

    setupEventListeners() {
        // Layout controls
        ['x', 'y', 'w', 'h'].forEach(prop => {
            const input = this.panel.querySelector(`#style-${prop === 'w' ? 'w' : prop === 'h' ? 'h' : prop}`);
            if (input) {
                input.addEventListener('change', () => this.updateWidget());
            }
        });

        // Alignment buttons
        this.setupAlignmentListeners();

        const exportProfileToggle = this.panel.querySelector('#style-allow-export-profile');
        if (exportProfileToggle) {
            exportProfileToggle.addEventListener('change', () => {
                if (!this.currentWidget || this.currentWidget.type === 'filter') return;
                if (!this.currentWidget.settings || typeof this.currentWidget.settings !== 'object') {
                    this.currentWidget.settings = {};
                }
                this.currentWidget.settings.allowExportToProfile = !!exportProfileToggle.checked;
                if (typeof this.currentWidget.syncProfilePinButton === 'function') {
                    this.currentWidget.syncProfilePinButton();
                }
                eventBus.emit('widget:settings-changed', { widget: this.currentWidget });
            });
        }

        // Appearance controls
        this.setupAppearanceListeners();
        
        // Typography controls
        this.setupTypographyListeners();
        
        // Borders controls
        this.setupBordersListeners();
        
        // Shadows controls
        this.setupShadowsListeners();
        
        // Animations controls
        this.setupAnimationsListeners();
        
        // Advanced CSS
        const cssEditor = this.panel.querySelector('#style-custom-css');
        if (cssEditor) {
            cssEditor.addEventListener('input', () => this.updateWidget());
        }
        
        // Gauge settings
        this.setupGaugeListeners();

        this.setupKpiWidgetListeners();

        this.setupKpiFormatTypographyListeners();

        this.setupTextWidgetListeners();
        this.setupHtmlWidgetListeners();
        this.setupTableSettingsListeners();
        this.setupPieChartSettingsListeners();
        this.setupBarChartSettingsListeners();
        this.setupLineChartSettingsListeners();
        this.setupFilterWidgetSettingsListeners();
        this.setupFilterAppearanceListeners();
        this.setupButtonWidgetSettingsListeners();
        this.setupDataInputWidgetSettingsListeners();

        // Container tab position settings
        this.setupContainerTabPositionListeners();

        this.setupFormulaEditorOpenButtons();
        this.setupColorFormulaListeners();
    }

    setupColorFormulaListeners() {
        if (!this.panel || this.panel._colorFormulaWired) return;
        this.panel._colorFormulaWired = true;
        const onFormulaEdit = (e) => {
            const ta = e.target?.closest?.('textarea.color-formula-input, textarea[data-color-formula]');
            if (!ta || !this.panel.contains(ta)) return;
            if (this._isLoadingWidgetStyles) return;
            this.updateWidget();
        };
        this.panel.addEventListener('change', onFormulaEdit);
        this.panel.addEventListener('input', (e) => {
            const ta = e.target?.closest?.('textarea.color-formula-input, textarea[data-color-formula]');
            if (!ta || !this.panel.contains(ta)) return;
            if (this._colorFormulaDebounce) clearTimeout(this._colorFormulaDebounce);
            this._colorFormulaDebounce = setTimeout(() => {
                this._colorFormulaDebounce = null;
                if (!this._isLoadingWidgetStyles) this.updateWidget();
            }, 320);
        });
    }

    setupFormulaEditorOpenButtons() {
        if (!this.panel || this.panel._aicFormulaEditorOpenBtnsWired) return;
        this.panel._aicFormulaEditorOpenBtnsWired = true;
        this.panel.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.formula-open-btn');
            if (!btn || !this.panel.contains(btn)) return;
            e.preventDefault();
            e.stopPropagation();
            const mode = btn.getAttribute('data-formula-mode') || 'direct';
            switch (mode) {
                case 'text-template':
                    this.openTextFormulaEditorModal();
                    return;
                case 'kpi':
                    this.openKpiFormulaEditorModal();
                    return;
                case 'gauge-value':
                    this.openGaugeFormulaEditorModal();
                    return;
                case 'direct': {
                    const targetId = btn.getAttribute('data-formula-target-id');
                    const applyKey = btn.getAttribute('data-formula-apply') || 'gauge';
                    if (!targetId) return;
                    const ta = this.panel.querySelector(`#${CSS.escape(targetId)}`);
                    if (!ta) return;
                    const initial = ta.value ?? '';
                    const colorMode =
                        btn.getAttribute('data-formula-color') === '1' ||
                        String(targetId).endsWith('-color-formula') ||
                        String(targetId).includes('color-formula') ||
                        (applyKey === 'pie-chart' && targetId === 'pie-chart-slice-threshold-formula') ||
                        (applyKey === 'kpi' && targetId === 'kpi-delta-color-formula');
                    this.openFormulaEditorModal({
                        title: colorMode ? 'Формула цвета' : 'Редактор формулы',
                        initialFormula: String(initial),
                        applyButtonText: 'Применить',
                        allowFieldRef: true,
                        allowColorExpr: colorMode,
                        onApply: (formula) => {
                            ta.value = formula;
                            this.applyAfterFormulaSave(applyKey);
                        },
                    });
                    return;
                }
                default:
                    break;
            }
        });
    }

    /**
     * Применить настройки виджета после сохранения формулы из модалки.
     * @param {string} key
     */
    applyAfterFormulaSave(key) {
        switch (key) {
            case 'text-widget':
                void this.applyTextWidgetPanelSettings();
                return;
            case 'gauge':
                this.updateGaugeSettings();
                return;
            case 'pie-chart':
                this.applyPieChartPanelSettings();
                return;
            case 'bar-chart':
                this.applyBarChartPanelSettings();
                return;
            case 'line-chart':
                this.applyLineChartPanelSettings();
                return;
            case 'kpi':
                void this.applyKpiPanelSettings();
                return;
            case 'filter':
                this.panel
                    ?.querySelector('.filter-widget-settings-section')
                    ?.dispatchEvent(new Event('change', { bubbles: true }));
                this.updateWidget();
                return;
            case 'button-widget':
                this.applyButtonWidgetPanelSettings?.();
                this.updateWidget();
                return;
            case 'data-input':
                this.applyDataInputPanelSettings?.();
                return;
            case 'styles':
            case 'table':
            case 'container':
            default:
                this.updateWidget();
                if (key === 'table') this.applyTablePanelSettings?.();
                return;
        }
    }

    /**
     * Редактор формулы колонки таблицы (привязка к полю).
     * @param {number} colIdx
     */
    openTableColumnFormulaEditor(colIdx) {
        const w = this.currentWidget;
        if (!w || w.type !== 'table' || !Array.isArray(w.settings?.bindingFields)) return;
        const bf = w.settings.bindingFields[colIdx];
        if (!bf) return;

        const initial = String(bf.formula ?? '').trim() || defaultTableColumnFormula(bf);
        const label = String(bf.field || bf.table || `Колонка ${colIdx + 1}`);

        this.openFormulaEditorModal({
            title: `Формула: ${label}`,
            initialFormula: initial,
            applyButtonText: 'Сохранить',
            allowFieldRef: true,
            onApply: (formula) => {
                const next = String(formula ?? '').trim() || defaultTableColumnFormula(bf);
                bf.formula = next;
                void this.reloadTableWidgetAfterColumnFormulaChange();
            },
        });
    }

    /**
     * Редактор формулы измерения или меры графика (pie / bar / line).
     * @param {'dimension'|'measure'} role
     */
    openChartBindingFormulaEditor(role) {
        const w = this.currentWidget;
        if (!w || !['line-chart', 'bar-chart', 'pie-chart'].includes(w.type)) return;
        if (!w.settings) w.settings = {};
        const key = role === 'dimension' ? 'bindingDimension' : 'bindingMeasure';
        const bf = w.settings[key];
        if (!bf) return;

        const initial = String(bf.formula ?? '').trim() || defaultChartBindingFormula(bf);
        const label =
            role === 'dimension'
                ? `Измерение: ${bf.field || bf.table || ''}`
                : `Мера: ${bf.field || bf.table || ''}`;

        this.openFormulaEditorModal({
            title: `Формула: ${label}`,
            initialFormula: initial,
            applyButtonText: 'Сохранить',
            allowFieldRef: true,
            onApply: (formula) => {
                applyChartBindingFormula(bf, formula);
                void this.reloadChartWidgetAfterBindingFormulaChange();
            },
        });
    }

    async reloadTableWidgetAfterColumnFormulaChange() {
        const w = this.currentWidget;
        if (!w || w.type !== 'table') return;
        const eng = this.engine;
        if (eng && typeof w.reloadFromDataModel === 'function') {
            await w.reloadFromDataModel(eng);
        } else {
            w.update();
        }
        this.updateDataBindingSection(w);
        eventBus.emit('widget:styles-changed', { widget: w });
        if (eng?.saveSnapshot) eng.saveSnapshot();
    }

    async reloadChartWidgetAfterBindingFormulaChange() {
        const w = this.currentWidget;
        if (!w || !['line-chart', 'bar-chart', 'pie-chart'].includes(w.type)) return;
        const eng = this.engine;
        if (eng && typeof w.reloadFromDataModel === 'function') {
            await w.reloadFromDataModel(eng);
        } else {
            w.update();
        }
        this.updateDataBindingSection(w);
        eventBus.emit('widget:data-binding-updated', { widget: w });
        eventBus.emit('widget:styles-changed', { widget: w });
        if (eng?.saveSnapshot) eng.saveSnapshot();
    }

    setupTableSettingsListeners() {
        const section = this.panel.querySelector('.table-settings-section');
        if (!section || section._tableSettingsPanelBound) return;
        section._tableSettingsPanelBound = true;

        const applyTitle = () => {
            void this.applyTableTitleFromPanel();
        };

        const input = this.panel.querySelector('#table-max-rows');
        const runMaxRows = () => {
            void this.updateTableSettings();
        };
        if (input) {
            input.addEventListener('change', runMaxRows);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    runMaxRows();
                }
            });
        }

        section.addEventListener('change', (e) => {
            if (!e.target.closest('.table-settings-section')) return;
            if (e.target.id === 'table-max-rows') return;
            applyTitle();
        });
        section.addEventListener('input', (e) => {
            const id = e.target?.id || '';
            if (
                id === 'table-widget-title' ||
                id === 'table-title-size' ||
                id === 'table-title-color' ||
                id === 'table-title-color-text'
            ) {
                applyTitle();
            }
        });

        const hdrPick = this.panel.querySelector('#table-column-header-bg-color');
        const hdrText = this.panel.querySelector('#table-column-header-bg-color-text');
        if (hdrPick && hdrText) {
            hdrPick.addEventListener('input', (e) => {
                hdrText.value = e.target.value;
                applyTitle();
            });
            hdrText.addEventListener('change', (e) => {
                if (/^#[0-9a-fA-F]{6}$/.test(e.target.value.trim())) {
                    hdrPick.value = e.target.value.trim();
                }
                applyTitle();
            });
        }
        this.wireTitleColorInputs('table', applyTitle);
    }

    async applyTableTitleFromPanel() {
        const w = this.currentWidget;
        if (!w || w.type !== 'table' || !w.settings) return;

        const showCb = this.panel.querySelector('#table-show-title');
        const titleInp = this.panel.querySelector('#table-widget-title');
        const sizeInp = this.panel.querySelector('#table-title-size');
        if (showCb) w.settings.showTitle = !!showCb.checked;
        if (titleInp) {
            const t = (titleInp.value || '').trim();
            w.settings.title = t.length ? t : 'Таблица';
        }
        if (sizeInp) {
            let n = parseInt(sizeInp.value, 10);
            if (!Number.isFinite(n)) n = 14;
            w.settings.titleSize = Math.min(48, Math.max(8, n));
        }
        const titleColor = this.readTitleColorFromPanel('table');
        if (titleColor) w.settings.titleColor = titleColor;

        const hdrText = this.panel.querySelector('#table-column-header-bg-color-text');
        if (hdrText) {
            const c = (hdrText.value || '').trim();
            if (/^#[0-9a-fA-F]{6}$/i.test(c)) {
                w.settings.columnHeaderBackgroundColor = c;
            }
        }

        this.syncWidgetTitleSubRows('table');
        const eng = this.engine;
        if (eng && typeof w.reloadFromDataModel === 'function') {
            await w.reloadFromDataModel(eng);
        } else {
            w.update();
        }
        eventBus.emit('widget:styles-changed', { widget: w });
    }

    async updateTableSettings() {
        if (!this.currentWidget || this.currentWidget.type !== 'table') return;

        const input = this.panel.querySelector('#table-max-rows');
        let v = input ? parseInt(input.value, 10) : 500;
        if (!Number.isFinite(v)) v = 500;
        v = Math.min(5000, Math.max(1, v));
        if (input) input.value = String(v);

        this.currentWidget.settings.maxRows = v;

        const eng = this.engine;
        if (eng && typeof this.currentWidget.reloadFromDataModel === 'function') {
            await this.currentWidget.reloadFromDataModel(eng);
        } else {
            this.currentWidget.update();
        }
        eventBus.emit('widget:styles-changed', { widget: this.currentWidget });
    }

    syncTextWidgetModeUi() {
        const modeSel = this.panel?.querySelector('#text-widget-mode');
        const dyn = this.panel?.querySelector('#text-widget-dynamic-block');
        const st = this.panel?.querySelector('#text-widget-static-block');
        if (!modeSel || !dyn || !st) return;
        const isDyn = modeSel.value === 'dynamic';
        dyn.style.display = isDyn ? 'block' : 'none';
        st.style.display = isDyn ? 'none' : 'block';
    }

    setupTextWidgetListeners() {
        const section = this.panel.querySelector('.text-widget-settings-section');
        if (!section || section._textWidgetPanelBound) return;
        section._textWidgetPanelBound = true;

        const modeSel = this.panel.querySelector('#text-widget-mode');
        if (modeSel) {
            modeSel.addEventListener('change', () => {
                this.syncTextWidgetModeUi();
                void this.applyTextWidgetPanelSettings();
            });
        }

        const staticTa = this.panel.querySelector('#text-widget-static-text');
        if (staticTa) {
            let t = null;
            staticTa.addEventListener('input', () => {
                if (t) clearTimeout(t);
                t = setTimeout(() => {
                    t = null;
                    void this.applyTextWidgetPanelSettings();
                }, 400);
            });
        }

        const tplTa = this.panel.querySelector('#text-widget-template');
        if (tplTa) {
            let t2 = null;
            tplTa.addEventListener('input', () => {
                if (t2) clearTimeout(t2);
                t2 = setTimeout(() => {
                    t2 = null;
                    void this.applyTextWidgetPanelSettings();
                }, 400);
            });
        }

        const tsDisp = this.panel.querySelector('#text-widget-timestamp-display');
        if (tsDisp) {
            tsDisp.addEventListener('change', () => {
                void this.applyTextWidgetPanelSettings();
            });
        }

        ['#text-widget-bg-formula', '#text-widget-fg-formula', '#text-widget-vis-formula'].forEach((sel) => {
            const ta = this.panel.querySelector(sel);
            if (!ta) return;
            let t3 = null;
            ta.addEventListener('input', () => {
                if (t3) clearTimeout(t3);
                t3 = setTimeout(() => {
                    t3 = null;
                    void this.applyTextWidgetPanelSettings();
                }, 400);
            });
        });
    }

    async applyTextWidgetPanelSettings() {
        const w = this.currentWidget;
        if (!w || w.type !== 'text') return;

        const modeSel = this.panel.querySelector('#text-widget-mode');
        const mode = modeSel?.value === 'dynamic' ? 'dynamic' : 'static';
        w.settings.mode = mode;

        const staticTa = this.panel.querySelector('#text-widget-static-text');
        if (staticTa) {
            w.settings.text = staticTa.value;
        }
        const tplTa = this.panel.querySelector('#text-widget-template');
        if (tplTa) {
            w.settings.template = tplTa.value;
        }
        const tsSel = this.panel.querySelector('#text-widget-timestamp-display');
        if (tsSel) {
            w.settings.timestampDisplay = tsSel.value === 'utc' ? 'utc' : 'local';
        }

        const bgF = this.panel.querySelector('#text-widget-bg-formula');
        const fgF = this.panel.querySelector('#text-widget-fg-formula');
        const visF = this.panel.querySelector('#text-widget-vis-formula');
        if (bgF) w.settings.blockBackgroundFormula = bgF.value || '';
        if (fgF) w.settings.textColorFormula = fgF.value || '';
        if (visF) w.settings.visibilityFormula = visF.value || '';

        w._dynamicCacheKey = null;
        const eng = this.engine;
        if (eng && typeof w.reloadFromDataModel === 'function') {
            await w.reloadFromDataModel(eng);
        } else {
            w.update();
        }
        eventBus.emit('widget:settings-changed', { widget: w });
    }

    setupHtmlWidgetListeners() {
        const section = this.panel.querySelector('.html-widget-settings-section');
        if (!section || section._htmlWidgetPanelBound) return;
        section._htmlWidgetPanelBound = true;

        const codeTa = this.panel.querySelector('#html-widget-code');
        if (!codeTa) return;

        let debounceTimer = null;
        const apply = () => {
            debounceTimer = null;
            this.applyHtmlWidgetPanelSettings();
        };
        codeTa.addEventListener('input', () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(apply, 300);
        });
        codeTa.addEventListener('blur', () => {
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            this.applyHtmlWidgetPanelSettings();
        });
    }

    applyHtmlWidgetPanelSettings() {
        const w = this.resolveLiveWidget(this.currentWidget) || this.currentWidget;
        if (!w || w.type !== 'html') return;

        if (!w.settings || typeof w.settings !== 'object') {
            w.settings = {};
        }

        const codeTa = this.panel.querySelector('#html-widget-code');
        if (codeTa) {
            w.settings.html = codeTa.value;
        }

        if (typeof w.render === 'function') {
            w.render();
        } else if (typeof w.update === 'function') {
            w.update();
        }
        eventBus.emit('widget:settings-changed', { widget: w });
    }

    syncHtmlPanelFromWidget(widget) {
        if (!widget || widget.type !== 'html') return;
        const codeTa = this.panel?.querySelector('#html-widget-code');
        if (!codeTa) return;
        const next = widget.settings?.html != null ? String(widget.settings.html) : '';
        if (codeTa.value !== next) {
            codeTa.value = next;
        }
    }

    isKpiDateColumnType(type) {
        const t = String(type || '').toLowerCase();
        return t.includes('date') || t.includes('time') || t === 'timestamp';
    }

    isKpiNumericColumnType(type) {
        const t = String(type || '').toLowerCase();
        return (
            t.includes('int') ||
            t.includes('number') ||
            t.includes('numeric') ||
            t.includes('decimal') ||
            t.includes('float') ||
            t.includes('double') ||
            t.includes('real') ||
            t === 'money'
        );
    }

    syncKpiModeDependentUi() {
        const mode = this.panel?.querySelector('#kpi-mode')?.value || 'simple';
        const simpleBl = this.panel?.querySelector('#kpi-mode-simple-block');
        const formBl = this.panel?.querySelector('#kpi-mode-formula-block');
        if (simpleBl) simpleBl.style.display = mode === 'simple' ? 'block' : 'none';
        if (formBl) formBl.style.display = mode === 'formula' ? 'block' : 'none';
        this.syncKpiCountModeVisibility();
    }

    syncKpiCountModeVisibility() {
        const mode = this.panel?.querySelector('#kpi-mode')?.value || 'simple';
        const agg = this.panel?.querySelector('#kpi-aggregation')?.value || 'sum';
        const row = this.panel?.querySelector('#kpi-count-mode-row');
        if (!row) return;
        row.style.display = mode === 'simple' && agg === 'count' ? 'block' : 'none';
    }

    syncKpiDeltaCustomRangeVisibility() {
        const enabled = this.panel?.querySelector('#kpi-delta-enabled')?.checked !== false;
        const opts = this.panel?.querySelector('#kpi-delta-options');
        if (opts) opts.style.display = enabled ? '' : 'none';
        const dm = this.panel?.querySelector('#kpi-delta-mode')?.value || 'previous_period';
        const blk = this.panel?.querySelector('#kpi-delta-custom-range-block');
        if (blk) blk.style.display = enabled && dm === 'custom' ? 'block' : 'none';
    }

    syncKpiFormatDependentUi() {
        const fmt = this.panel?.querySelector('#kpi-format')?.value;
        const row = this.panel?.querySelector('#kpi-currency-row');
        if (row) row.style.display = fmt === 'currency' ? 'block' : 'none';
        if (fmt !== 'currency') this.closeKpiCurrencyPicker();
        this.syncKpiCurrencyTriggerUi();
    }

    /**
     * @param {string|null|undefined} [codeOverride]
     */
    syncKpiCurrencyTriggerUi(codeOverride) {
        if (!this.panel) return;
        const hidden = this.panel.querySelector('#kpi-currency');
        const code =
            codeOverride != null
                ? String(codeOverride)
                : String(hidden?.value || 'USD');
        const opt = resolveKpiCurrencyOption(code);
        if (hidden) hidden.value = opt.code;
        const symbolEl = this.panel.querySelector('[data-kpi-currency-symbol]');
        const codeEl = this.panel.querySelector('[data-kpi-currency-code-label]');
        const nameEl = this.panel.querySelector('[data-kpi-currency-name]');
        if (symbolEl) symbolEl.textContent = opt.symbol;
        if (codeEl) codeEl.textContent = opt.code;
        if (nameEl) nameEl.textContent = opt.label;
        const trigger = this.panel.querySelector('#kpi-currency-trigger');
        if (trigger) {
            trigger.title = `${opt.label} (${opt.code})`;
            trigger.setAttribute('data-kpi-currency-value', opt.code);
        }
    }

    _ensureKpiCurrencyMenu() {
        let menu = this._kpiCurrencyMenuEl;
        if (menu && menu.isConnected) return menu;
        menu = document.getElementById('kpi-currency-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'kpi-currency-menu';
            menu.className = 'kpi-currency-menu';
            menu.hidden = true;
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', 'Выбор валюты');
            menu.innerHTML = '<div class="kpi-currency-menu__grid" data-kpi-currency-grid></div>';
            document.body.appendChild(menu);
            menu.addEventListener('click', (e) => {
                const optBtn = e.target.closest('[data-kpi-currency-pick]');
                if (!optBtn || !menu.contains(optBtn)) return;
                e.preventDefault();
                e.stopPropagation();
                const code = optBtn.getAttribute('data-kpi-currency-pick') || 'USD';
                this.setKpiCurrencyFromPicker(code);
            });
        }
        this._kpiCurrencyMenuEl = menu;
        return menu;
    }

    closeKpiCurrencyPicker() {
        const menu = this._kpiCurrencyMenuEl || document.getElementById('kpi-currency-menu');
        if (menu) {
            menu.hidden = true;
            menu.classList.remove('is-open');
        }
        const trigger = this.panel?.querySelector('#kpi-currency-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
        this._kpiCurrencyPickerOpen = false;
        if (this._kpiCurrencyPickerOutsideHandler) {
            document.removeEventListener('mousedown', this._kpiCurrencyPickerOutsideHandler, true);
            this._kpiCurrencyPickerOutsideHandler = null;
        }
    }

    renderKpiCurrencyPickerMenu() {
        const menu = this._ensureKpiCurrencyMenu();
        if (!menu) return;
        const current = String(this.panel?.querySelector('#kpi-currency')?.value || 'USD')
            .trim()
            .toUpperCase()
            .slice(0, 3) || 'USD';
        const grid = menu.querySelector('[data-kpi-currency-grid]');
        if (!grid) return;
        grid.innerHTML = KPI_CURRENCY_OPTIONS.map((opt) => {
            const selected = opt.code === current;
            return `
                <button
                    type="button"
                    class="kpi-currency-option${selected ? ' is-selected' : ''}"
                    role="menuitemradio"
                    aria-checked="${selected ? 'true' : 'false'}"
                    data-kpi-currency-pick="${this._escapeBindingText(opt.code)}"
                    title="${this._escapeBindingText(`${opt.label} (${opt.code})`)}"
                >
                    <span class="kpi-currency-option__symbol" aria-hidden="true">${this._escapeBindingText(opt.symbol)}</span>
                    <span class="kpi-currency-option__code">${this._escapeBindingText(opt.code)}</span>
                </button>
            `;
        }).join('');
    }

    openKpiCurrencyPicker(triggerEl) {
        if (!this.panel || !triggerEl) return;
        const menu = this._ensureKpiCurrencyMenu();
        if (!menu) return;

        this.closeButtonWidgetIconPicker?.();
        this.closeKpiCurrencyPicker();
        this._kpiCurrencyPickerOpen = true;
        triggerEl.setAttribute('aria-expanded', 'true');
        this.renderKpiCurrencyPickerMenu();

        menu.hidden = false;
        menu.classList.add('is-open');
        const rect = triggerEl.getBoundingClientRect();
        const menuW = Math.max(280, Math.min(360, rect.width));
        menu.style.width = `${menuW}px`;
        menu.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - menuW - 8)}px`;
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const approxH = 260;
        if (spaceBelow < approxH && rect.top > spaceBelow) {
            menu.style.top = `${Math.max(8, rect.top - approxH - 6)}px`;
        } else {
            menu.style.top = `${rect.bottom + 6}px`;
        }

        this._kpiCurrencyPickerOutsideHandler = (evt) => {
            if (menu.contains(evt.target) || triggerEl.contains(evt.target)) return;
            this.closeKpiCurrencyPicker();
        };
        setTimeout(() => {
            if (this._kpiCurrencyPickerOutsideHandler) {
                document.addEventListener('mousedown', this._kpiCurrencyPickerOutsideHandler, true);
            }
        }, 0);
    }

    toggleKpiCurrencyPicker(triggerEl) {
        if (this._kpiCurrencyPickerOpen) {
            this.closeKpiCurrencyPicker();
            return;
        }
        this.openKpiCurrencyPicker(triggerEl);
    }

    /**
     * @param {string} code
     */
    setKpiCurrencyFromPicker(code) {
        const opt = resolveKpiCurrencyOption(code);
        const hidden = this.panel?.querySelector('#kpi-currency');
        if (hidden) hidden.value = opt.code;
        this.syncKpiCurrencyTriggerUi(opt.code);
        this.closeKpiCurrencyPicker();
        this.applyKpiFormatFromPanel();
    }

    syncKpiBgModeUi() {
        const mode = this.panel?.querySelector('#kpi-bg-mode')?.value || 'solid';
        const solid = this.panel?.querySelector('#kpi-bg-solid-wrap');
        const rules = this.panel?.querySelector('#kpi-bg-rules-wrap');
        const delta = this.panel?.querySelector('#kpi-bg-delta-wrap');
        const fallback = this.panel?.querySelector('#kpi-bg-non-solid-fallback-wrap');
        if (solid) solid.style.display = mode === 'solid' ? 'block' : 'none';
        if (rules) rules.style.display = mode === 'rules' ? 'block' : 'none';
        if (delta) delta.style.display = mode === 'delta' ? 'block' : 'none';
        if (fallback) fallback.style.display = mode === 'rules' || mode === 'delta' ? 'block' : 'none';
    }

    syncKpiBgSolidColorDisabled() {
        const tr = this.panel?.querySelector('#kpi-bg-solid-transparent');
        const col = this.panel?.querySelector('#kpi-bg-solid-color');
        if (col) col.disabled = !!tr?.checked;
    }

    /**
     * @param {HTMLElement|null} row
     */
    syncKpiBgRuleRowSecondVisibility(row) {
        if (!row) return;
        const op = row.querySelector('.kpi-bg-rule-op')?.value || '';
        const v2wrap = row.querySelector('.kpi-bg-threshold-v2');
        if (v2wrap) {
            v2wrap.style.display = op === 'between' ? 'flex' : 'none';
        }
    }

    /**
     * Порог правила фона: число или формула (те же фильтры дашборда, что у KPI).
     * @param {number} literalValue
     * @param {unknown} valueFormula
     * @param {'kpi-bg-rule-v1-input'|'kpi-bg-rule-v2-input'} inputClass
     * @param {''|'kpi-bg-threshold-v2'} wrapModifier
     * @returns {HTMLDivElement}
     */
    createKpiBgFormulaThresholdWrap(literalValue, valueFormula, inputClass, wrapModifier = '') {
        const wrap = document.createElement('div');
        wrap.className = `kpi-bg-threshold-wrap ${wrapModifier}`.trim();
        wrap.style.cssText =
            'display:flex;flex-direction:column;gap:0.2rem;min-width:0;max-width:280px;';
        wrap.title =
            inputClass === 'kpi-bg-rule-v2-input'
                ? 'Верхняя граница «между»: число или формула; считается по данным и фильтрам дашборда.'
                : 'Порог сравнения с числом KPI: число или формула (SUM, COUNT… как в поле значения KPI).';

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = `style-input ${inputClass}`;
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.placeholder = '100 или SUM(revenue)';
        inp.style.minWidth = '140px';
        inp.style.flex = '1 1 120px';
        const vf = String(valueFormula ?? '').trim();
        const lit =
            literalValue != null && Number.isFinite(Number(literalValue)) ? Number(literalValue) : 0;
        inp.value = vf ? vf : String(lit);
        const inpId = `aic-kpi-th-${inputClass}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
        inp.id = inpId;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:0.35rem;align-items:center;width:100%;min-width:0;';
        row.appendChild(inp);

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'formula-open-btn formula-open-btn--compact';
        openBtn.title = 'Открыть редактор формулы';
        openBtn.setAttribute('aria-label', 'Редактор формулы');
        openBtn.setAttribute('data-formula-mode', 'direct');
        openBtn.setAttribute('data-formula-target-id', inpId);
        openBtn.setAttribute('data-formula-apply', 'kpi');
        openBtn.innerHTML = `<span class="formula-open-btn__icon" aria-hidden="true">${svgFormulaFxOpen}</span>`;
        row.appendChild(openBtn);

        wrap.appendChild(row);
        return wrap;
    }

    /**
     * @param {Record<string, unknown>} [rule]
     * @returns {HTMLDivElement}
     */
    createKpiBgRuleRowEl(rule = {}) {
        const op = String(rule.op || 'gte');
        const v1 = rule.value != null && Number.isFinite(Number(rule.value)) ? Number(rule.value) : 0;
        const v2 = rule.value2 != null && Number.isFinite(Number(rule.value2)) ? Number(rule.value2) : 0;
        const color = /^#[0-9a-fA-F]{6}$/.test(String(rule.color || '')) ? String(rule.color) : '#1565c0';
        const vf1 = rule.valueFormula;
        const vf2 = rule.value2Formula;

        const row = document.createElement('div');
        row.className = 'kpi-bg-rule-row';
        row.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem;align-items:flex-end;margin-bottom:0.5rem;';

        const sel = document.createElement('select');
        sel.className = 'style-select kpi-bg-rule-op';
        sel.style.minWidth = '140px';
        const opts = [
            ['lt', '< (меньше)'],
            ['lte', '≤ (не больше)'],
            ['gt', '> (больше)'],
            ['gte', '≥ (не меньше)'],
            ['eq', '= (равно)'],
            ['between', 'Между двумя'],
        ];
        for (const [val, label] of opts) {
            const o = document.createElement('option');
            o.value = val;
            o.textContent = label;
            if (val === op) o.selected = true;
            sel.appendChild(o);
        }
        sel.addEventListener('change', () => this.syncKpiBgRuleRowSecondVisibility(row));
        row.appendChild(sel);

        row.appendChild(this.createKpiBgFormulaThresholdWrap(v1, vf1, 'kpi-bg-rule-v1-input', ''));
        row.appendChild(this.createKpiBgFormulaThresholdWrap(v2, vf2, 'kpi-bg-rule-v2-input', 'kpi-bg-threshold-v2'));

        const cp = document.createElement('input');
        cp.type = 'color';
        cp.className = 'kpi-bg-rule-color';
        cp.style.width = '44px';
        cp.style.height = '32px';
        cp.style.padding = '2px';
        cp.value = color;
        row.appendChild(cp);

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'btn btn-secondary kpi-bg-rule-remove';
        rm.textContent = '×';
        rm.title = 'Удалить правило';
        rm.style.minWidth = '36px';
        row.appendChild(rm);

        this.syncKpiBgRuleRowSecondVisibility(row);
        return row;
    }

    /**
     * @param {{ settings?: object }} widget
     */
    rebuildKpiBgRulesListFromSettings(widget) {
        const list = this.panel?.querySelector('#kpi-bg-rules-list');
        if (!list) return;
        list.innerHTML = '';
        const rules = Array.isArray(widget?.settings?.kpiBackgroundRules) ? widget.settings.kpiBackgroundRules : [];
        for (const r of rules) {
            list.appendChild(this.createKpiBgRuleRowEl(r));
        }
    }

    collectKpiBgRulesFromPanel() {
        const list = this.panel?.querySelectorAll('#kpi-bg-rules-list .kpi-bg-rule-row');
        if (!list) return [];
        /** @type {object[]} */
        const rules = [];
        list.forEach((row) => {
            const op = row.querySelector('.kpi-bg-rule-op')?.value || 'gte';
            const raw1 = row.querySelector('.kpi-bg-rule-v1-input')?.value ?? '';
            const raw2 = row.querySelector('.kpi-bg-rule-v2-input')?.value ?? '';
            const p1 = parseKpiBgRuleThresholdInput(raw1);
            const p2 = parseKpiBgRuleThresholdInput(raw2);
            let color = String(row.querySelector('.kpi-bg-rule-color')?.value || '#333333');
            if (!/^#[0-9a-fA-F]{6}$/i.test(color)) color = '#333333';
            rules.push({
                op,
                value: p1.value,
                value2: p2.value,
                valueFormula: p1.valueFormula,
                value2Formula: p2.valueFormula,
                color,
            });
        });
        return rules;
    }

    applyKpiBgPresetFromSelect() {
        const preset = this.panel?.querySelector('#kpi-bg-preset');
        if (!preset) return;
        const v = String(preset.value || '');
        if (!v) return;
        const modeEl = this.panel?.querySelector('#kpi-bg-mode');
        if (modeEl) modeEl.value = 'rules';
        const def = this.panel?.querySelector('#kpi-bg-default-color');
        if (def) def.value = '#1a1d23';
        const defTr0 = this.panel?.querySelector('#kpi-bg-default-transparent');
        if (defTr0) {
            defTr0.checked = false;
            if (def) def.disabled = false;
        }
        const list = this.panel?.querySelector('#kpi-bg-rules-list');
        if (list) list.innerHTML = '';
        if (v === 'traffic') {
            list?.appendChild(this.createKpiBgRuleRowEl({ op: 'lt', value: 0, value2: 0, color: '#c62828' }));
            list?.appendChild(this.createKpiBgRuleRowEl({ op: 'gte', value: 0, value2: 0, color: '#2e7d32' }));
        } else if (v === 'threshold100') {
            list?.appendChild(this.createKpiBgRuleRowEl({ op: 'gte', value: 100, value2: 0, color: '#2e7d32' }));
        }
        preset.value = '';
        this.syncKpiBgModeUi();
        void this.applyKpiPanelSettings();
    }

    async fillKpiDateFieldOptions(widget) {
        const sel = this.panel?.querySelector('#kpi-date-field');
        if (!sel) return;
        const ds = widget?.dataSource;
        const dashId = this.engine?.dashboardId;
        const cur = String(widget?.settings?.dateField || '');
        sel.innerHTML = '<option value="">— выберите —</option>';
        if (!dashId || ds?.modelId == null || !ds?.table) return;
        try {
            const { fields } = await getDashboardSchema(dashId);
            const list = (fields || []).filter(
                (f) =>
                    f.modelId != null &&
                    String(f.modelId) === String(ds.modelId) &&
                    f.tableName === ds.table &&
                    this.isKpiDateColumnType(f.type),
            );
            list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
            for (const col of list) {
                const opt = document.createElement('option');
                opt.value = col.name;
                opt.textContent = `${col.name} (${col.type || '?'})`;
                sel.appendChild(opt);
            }
            if (cur && !list.some((c) => c.name === cur)) {
                const opt = document.createElement('option');
                opt.value = cur;
                opt.textContent = `${cur} (сохранено)`;
                sel.appendChild(opt);
            }
        } catch (e) {
            console.warn('fillKpiDateFieldOptions', e);
        }
    }

    async fillKpiValueFieldOptions(widget) {
        const sel = this.panel?.querySelector('#kpi-value-field');
        if (!sel) return;
        const ds = widget?.dataSource;
        const dashId = this.engine?.dashboardId;
        const cur = String(widget?.settings?.valueField || '');
        sel.innerHTML = '<option value="">— выберите —</option>';
        if (!dashId || ds?.modelId == null || !ds?.table) return;
        try {
            const { fields } = await getDashboardSchema(dashId);
            const list = (fields || []).filter(
                (f) =>
                    f.modelId != null &&
                    String(f.modelId) === String(ds.modelId) &&
                    f.tableName === ds.table &&
                    this.isKpiNumericColumnType(f.type),
            );
            list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
            for (const col of list) {
                const opt = document.createElement('option');
                opt.value = col.name;
                opt.textContent = `${col.name} (${col.type || '?'})`;
                sel.appendChild(opt);
            }
            if (cur && !list.some((c) => c.name === cur)) {
                const opt = document.createElement('option');
                opt.value = cur;
                opt.textContent = `${cur} (сохранено)`;
                sel.appendChild(opt);
            }
        } catch (e) {
            console.warn('fillKpiValueFieldOptions', e);
        }
    }

    async syncKpiPanelFromWidget(widget) {
        if (!this.panel || widget?.type !== 'kpi') return;
        const s = widget.settings || {};

        const tit = this.panel.querySelector('#kpi-widget-title');
        if (tit) tit.value = s.title != null ? String(s.title) : '';

        const kpiShow = this.panel.querySelector('#kpi-show-title');
        if (kpiShow) kpiShow.checked = s.showTitle !== false;
        const kpiTs = this.panel.querySelector('#kpi-title-size');
        if (kpiTs) {
            if (s.titleSize != null && Number.isFinite(Number(s.titleSize))) {
                kpiTs.value = String(Math.min(48, Math.max(8, parseInt(s.titleSize, 10))));
            } else {
                kpiTs.value = '';
            }
        }
        this.writeTitleColorToPanel('kpi', s.titleColor, '#B0B3B8');
        this.syncWidgetTitleSubRows('kpi');

        const mode = this.panel.querySelector('#kpi-mode');
        if (mode) mode.value = s.kpiMode === 'formula' ? 'formula' : 'simple';

        const vf = this.panel.querySelector('#kpi-value-field');
        const agg = this.panel.querySelector('#kpi-aggregation');
        if (agg) agg.value = s.aggregation || 'sum';
        const cm = this.panel.querySelector('#kpi-count-mode');
        if (cm) {
            const mode = String(s.countMode || '').toLowerCase();
            cm.value = mode === 'distinct' ? 'distinct' : mode === 'non_null' ? 'non_null' : 'rows';
        }

        const f = this.panel.querySelector('#kpi-value-formula');
        if (f) f.value = String(s.valueFormula || '');

        const cr = s.customRange || {};
        const fs = this.panel.querySelector('#kpi-fallback-start');
        const fe = this.panel.querySelector('#kpi-fallback-end');
        if (fs) fs.value = cr.start || '';
        if (fe) fe.value = cr.end || '';

        const dcr = s.deltaCustomRange || {};
        const dcs = this.panel.querySelector('#kpi-delta-custom-start');
        const dce = this.panel.querySelector('#kpi-delta-custom-end');
        if (dcs) dcs.value = dcr.start || '';
        if (dce) dce.value = dcr.end || '';

        const dm = this.panel.querySelector('#kpi-delta-mode');
        if (dm) dm.value = s.deltaMode || 'previous_period';

        const deltaEn = this.panel.querySelector('#kpi-delta-enabled');
        if (deltaEn) deltaEn.checked = s.deltaEnabled !== false;

        const dt = this.panel.querySelector('#kpi-delta-type');
        if (dt) dt.value = s.deltaType || 'both';

        const dd = this.panel.querySelector('#kpi-delta-display');
        if (dd) {
            const v = String(s.deltaDisplay || 'below').toLowerCase();
            dd.value = v === 'inline' ? 'inline' : 'below';
        }

        const dColor = String(s.deltaColor || '').trim();
        const dColorOk = /^#[0-9a-fA-F]{6}$/i.test(dColor);
        const dCol = this.panel.querySelector('#kpi-delta-color');
        const dColText = this.panel.querySelector('#kpi-delta-color-text');
        if (dCol) dCol.value = dColorOk ? dColor : '#9aa0a6';
        if (dColText) dColText.value = dColorOk ? dColor : '';
        const dColFx = this.panel.querySelector('#kpi-delta-color-formula');
        if (dColFx) dColFx.value = String(s.deltaColorFormula || '');

        const fmt = this.panel.querySelector('#kpi-format');
        if (fmt) fmt.value = s.format || 'number';
        const cur = this.panel.querySelector('#kpi-currency');
        if (cur) cur.value = resolveKpiCurrencyOption(s.currency || 'USD').code;
        this.syncKpiCurrencyTriggerUi(cur?.value || s.currency || 'USD');
        const dec = this.panel.querySelector('#kpi-decimals');
        if (dec) dec.value = String(s.decimals ?? 2);
        const nc = this.panel.querySelector('#kpi-number-compact');
        if (nc) nc.checked = s.numberCompact !== false;

        await this.fillKpiDateFieldOptions(widget);
        await this.fillKpiValueFieldOptions(widget);
        if (vf) vf.value = s.valueField || '';

        const df = this.panel.querySelector('#kpi-date-field');
        if (df) df.value = s.dateField || '';

        const gr = this.panel.querySelector('#kpi-granularity');
        if (gr) gr.value = s.granularity || 'auto';

        const pShift = this.panel.querySelector('#kpi-period-shift');
        if (pShift) {
            const n = parseInt(String(s.periodShift ?? 0), 10);
            pShift.value = String(!Number.isFinite(n) || n < 0 ? 0 : n);
        }

        const pm = this.panel.querySelector('#kpi-period-mode');
        if (pm) pm.value = s.periodMode === 'fallback' ? 'fallback' : 'auto';

        const bgMode = this.panel.querySelector('#kpi-bg-mode');
        if (bgMode) {
            const m = String(s.kpiBackgroundMode || 'solid').toLowerCase();
            bgMode.value = m === 'rules' ? 'rules' : m === 'delta' ? 'delta' : 'solid';
        }

        const dNeg = this.panel.querySelector('#kpi-bg-delta-neg');
        if (dNeg) {
            const c = String(s.kpiBackgroundDeltaNegativeColor || '#c62828');
            dNeg.value = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : '#c62828';
        }
        const dPos = this.panel.querySelector('#kpi-bg-delta-pos');
        if (dPos) {
            const c = String(s.kpiBackgroundDeltaPositiveColor || '#2e7d32');
            dPos.value = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : '#2e7d32';
        }

        const solidTr = this.panel.querySelector('#kpi-bg-solid-transparent');
        const bgStr = String(s.backgroundColor || 'transparent').toLowerCase();
        if (solidTr) solidTr.checked = bgStr === 'transparent';

        const solidCol = this.panel.querySelector('#kpi-bg-solid-color');
        if (solidCol) {
            const hex =
                bgStr !== 'transparent' && /^#[0-9a-fA-F]{6}$/i.test(String(s.backgroundColor))
                    ? String(s.backgroundColor)
                    : '#0d1117';
            solidCol.value = hex;
        }

        const defc = this.panel.querySelector('#kpi-bg-default-color');
        const defTr = this.panel.querySelector('#kpi-bg-default-transparent');
        if (defTr) {
            const dc = String(s.kpiBackgroundDefaultColor || '').toLowerCase();
            defTr.checked = dc === 'transparent';
        }
        if (defc) {
            const d = String(s.kpiBackgroundDefaultColor || '#0d1117');
            defc.value =
                /^#[0-9a-fA-F]{6}$/i.test(d) && d.toLowerCase() !== 'transparent' ? d : '#0d1117';
        }

        this.rebuildKpiBgRulesListFromSettings(widget);
        this.syncKpiBgModeUi();
        this.syncKpiBgSolidColorDisabled();
        const defColDis = this.panel.querySelector('#kpi-bg-default-color');
        if (defColDis) defColDis.disabled = !!this.panel.querySelector('#kpi-bg-default-transparent')?.checked;

        this.syncKpiModeDependentUi();
        this.syncKpiDeltaCustomRangeVisibility();
        this.syncKpiFormatDependentUi();
    }

    /** Сигнатура KPI-настроек, влияющих на запрос данных (без формата отображения числа). */
    _kpiDataSettingsSignature(settings) {
        const s = settings || {};
        return JSON.stringify({
            title: s.title,
            showTitle: s.showTitle,
            titleSize: s.titleSize,
            kpiMode: s.kpiMode,
            valueField: s.valueField,
            aggregation: s.aggregation,
            countMode: s.countMode,
            valueFormula: s.valueFormula,
            dateField: s.dateField,
            granularity: s.granularity,
            periodShift: s.periodShift,
            periodMode: s.periodMode,
            customRange: s.customRange,
            deltaMode: s.deltaMode,
            deltaCustomRange: s.deltaCustomRange,
            deltaType: s.deltaType,
            deltaDisplay: s.deltaDisplay,
            kpiBackgroundMode: s.kpiBackgroundMode,
            kpiBackgroundDeltaNegativeColor: s.kpiBackgroundDeltaNegativeColor,
            kpiBackgroundDeltaPositiveColor: s.kpiBackgroundDeltaPositiveColor,
            backgroundColor: s.backgroundColor,
            kpiBackgroundDefaultColor: s.kpiBackgroundDefaultColor,
            kpiBackgroundRules: s.kpiBackgroundRules,
        });
    }

    /** Применяет только формат числа KPI и сразу перерисовывает виджет. */
    applyKpiFormatFromPanel() {
        const w = this.currentWidget;
        if (!w || w.type !== 'kpi') return;

        const fmt = this.panel.querySelector('#kpi-format');
        if (fmt) w.settings.format = fmt.value;

        const cur = this.panel.querySelector('#kpi-currency');
        if (cur) {
            const c = String(cur.value || 'USD').trim().toUpperCase().slice(0, 3);
            w.settings.currency = c || 'USD';
        }

        const dec = this.panel.querySelector('#kpi-decimals');
        if (dec) {
            let d = parseInt(dec.value, 10);
            if (!Number.isFinite(d)) d = 2;
            w.settings.decimals = Math.min(8, Math.max(0, d));
        }

        const nc = this.panel.querySelector('#kpi-number-compact');
        if (nc) w.settings.numberCompact = nc.checked;

        this.syncKpiFormatDependentUi();
        w.update();
        eventBus.emit('widget:settings-changed', { widget: w });
    }

    setupKpiFormatTypographyListeners() {
        if (!this.panel || this.panel._kpiFormatTypoBound) return;
        this.panel._kpiFormatTypoBound = true;

        const applyFormat = () => this.applyKpiFormatFromPanel();

        const fmt = this.panel.querySelector('#kpi-format');
        if (fmt) {
            fmt.addEventListener('change', () => {
                this.syncKpiFormatDependentUi();
                applyFormat();
            });
        }

        const dec = this.panel.querySelector('#kpi-decimals');
        if (dec) {
            dec.addEventListener('input', applyFormat);
            dec.addEventListener('change', applyFormat);
        }

        const cur = this.panel.querySelector('#kpi-currency');
        if (cur) {
            cur.addEventListener('change', applyFormat);
        }

        const trigger = this.panel.querySelector('#kpi-currency-trigger');
        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleKpiCurrencyPicker(trigger);
            });
        }

        const nc = this.panel.querySelector('#kpi-number-compact');
        if (nc) nc.addEventListener('change', applyFormat);
    }

    async applyKpiPanelSettings() {
        const w = this.currentWidget;
        if (!w || w.type !== 'kpi') return;

        const dataSigBefore = this._kpiDataSettingsSignature(w.settings);

        const tit = this.panel.querySelector('#kpi-widget-title');
        if (tit) w.settings.title = String(tit.value || '').trim();

        const showKpiTitle = this.panel.querySelector('#kpi-show-title');
        if (showKpiTitle) w.settings.showTitle = !!showKpiTitle.checked;
        const kpiTitleSize = this.panel.querySelector('#kpi-title-size');
        if (kpiTitleSize) {
            const raw = String(kpiTitleSize.value || '').trim();
            if (raw === '') {
                w.settings.titleSize = null;
            } else {
                let n = parseInt(raw, 10);
                w.settings.titleSize = Number.isFinite(n) ? Math.min(48, Math.max(8, n)) : null;
            }
        }
        const kpiTitleColor = this.readTitleColorFromPanel('kpi', '#B0B3B8');
        if (kpiTitleColor) w.settings.titleColor = kpiTitleColor;
        this.syncWidgetTitleSubRows('kpi');

        const modeEl = this.panel.querySelector('#kpi-mode');
        if (modeEl) w.settings.kpiMode = modeEl.value === 'formula' ? 'formula' : 'simple';

        const vf = this.panel.querySelector('#kpi-value-field');
        if (vf) w.settings.valueField = vf.value;

        const agg = this.panel.querySelector('#kpi-aggregation');
        if (agg) w.settings.aggregation = agg.value;
        const cm = this.panel.querySelector('#kpi-count-mode');
        if (cm) {
            const mode = String(cm.value || '').toLowerCase();
            w.settings.countMode = mode === 'distinct' ? 'distinct' : mode === 'non_null' ? 'non_null' : 'rows';
        }

        const fo = this.panel.querySelector('#kpi-value-formula');
        if (fo) w.settings.valueFormula = fo.value;

        const df = this.panel.querySelector('#kpi-date-field');
        if (df) w.settings.dateField = df.value;

        const gr = this.panel.querySelector('#kpi-granularity');
        if (gr) w.settings.granularity = gr.value || 'auto';

        const pShift = this.panel.querySelector('#kpi-period-shift');
        if (pShift) {
            const n = parseInt(String(pShift.value ?? '0'), 10);
            w.settings.periodShift = !Number.isFinite(n) || n < 0 ? 0 : Math.floor(n);
        }

        const pm = this.panel.querySelector('#kpi-period-mode');
        if (pm) w.settings.periodMode = pm.value === 'fallback' ? 'fallback' : 'auto';

        const fs = this.panel.querySelector('#kpi-fallback-start');
        const fe = this.panel.querySelector('#kpi-fallback-end');
        w.settings.customRange = {
            start: fs?.value || '',
            end: fe?.value || '',
        };

        const dm = this.panel.querySelector('#kpi-delta-mode');
        if (dm) w.settings.deltaMode = dm.value;

        const deltaEn = this.panel.querySelector('#kpi-delta-enabled');
        if (deltaEn) w.settings.deltaEnabled = !!deltaEn.checked;

        const dcs = this.panel.querySelector('#kpi-delta-custom-start');
        const dce = this.panel.querySelector('#kpi-delta-custom-end');
        w.settings.deltaCustomRange = {
            start: dcs?.value || '',
            end: dce?.value || '',
        };

        const dty = this.panel.querySelector('#kpi-delta-type');
        if (dty) w.settings.deltaType = dty.value;

        const ddp = this.panel.querySelector('#kpi-delta-display');
        if (ddp) {
            const v = String(ddp.value || 'below').toLowerCase();
            w.settings.deltaDisplay = v === 'inline' ? 'inline' : 'below';
        }

        const dColText = this.panel.querySelector('#kpi-delta-color-text');
        const textOnly = String(dColText?.value || '').trim();
        w.settings.deltaColor = /^#[0-9a-fA-F]{6}$/i.test(textOnly) ? textOnly : '';

        const dColFx = this.panel.querySelector('#kpi-delta-color-formula');
        if (dColFx) w.settings.deltaColorFormula = String(dColFx.value || '').trim();

        const fmt = this.panel.querySelector('#kpi-format');
        if (fmt) w.settings.format = fmt.value;

        const cur = this.panel.querySelector('#kpi-currency');
        if (cur) {
            const c = String(cur.value || 'USD').trim().toUpperCase().slice(0, 3);
            w.settings.currency = c || 'USD';
        }

        const dec = this.panel.querySelector('#kpi-decimals');
        if (dec) {
            let d = parseInt(dec.value, 10);
            if (!Number.isFinite(d)) d = 2;
            w.settings.decimals = Math.min(8, Math.max(0, d));
        }

        const nc = this.panel.querySelector('#kpi-number-compact');
        if (nc) w.settings.numberCompact = nc.checked;

        const bgMode = this.panel.querySelector('#kpi-bg-mode');
        if (bgMode) {
            const v = String(bgMode.value || 'solid').toLowerCase();
            w.settings.kpiBackgroundMode = v === 'rules' ? 'rules' : v === 'delta' ? 'delta' : 'solid';
        }

        const dNeg = this.panel.querySelector('#kpi-bg-delta-neg');
        if (dNeg) {
            const c = String(dNeg.value || '#c62828');
            w.settings.kpiBackgroundDeltaNegativeColor = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : '#c62828';
        }
        const dPos = this.panel.querySelector('#kpi-bg-delta-pos');
        if (dPos) {
            const c = String(dPos.value || '#2e7d32');
            w.settings.kpiBackgroundDeltaPositiveColor = /^#[0-9a-fA-F]{6}$/i.test(c) ? c : '#2e7d32';
        }

        const solidTr = this.panel.querySelector('#kpi-bg-solid-transparent');
        const solidCol = this.panel.querySelector('#kpi-bg-solid-color');
        if (solidTr?.checked) {
            w.settings.backgroundColor = 'transparent';
        } else if (solidCol?.value) {
            w.settings.backgroundColor = solidCol.value;
        }

        const defc = this.panel.querySelector('#kpi-bg-default-color');
        const defTr = this.panel.querySelector('#kpi-bg-default-transparent');
        if (defTr?.checked) {
            w.settings.kpiBackgroundDefaultColor = 'transparent';
        } else if (defc) {
            const d = String(defc.value || '#0d1117');
            w.settings.kpiBackgroundDefaultColor = /^#[0-9a-fA-F]{6}$/i.test(d) ? d : 'transparent';
        }
        w.settings.kpiBackgroundRules = this.collectKpiBgRulesFromPanel();

        const dataSigAfter = this._kpiDataSettingsSignature(w.settings);
        const dataSettingsChanged = dataSigBefore !== dataSigAfter;

        if (!dataSettingsChanged) {
            w.update();
            eventBus.emit('widget:settings-changed', { widget: w });
            return;
        }

        w._kpiCacheKey = null;
        if (w.type === 'kpi') {
            w._kpiApplyGeneration = (w._kpiApplyGeneration || 0) + 1;
            clearKpiComputeQueryCache();
            invalidateDashboardTransportCaches({ filtersChanged: false });
        }

        const eng = this.engine;
        if (eng && typeof w.reloadFromDataModel === 'function') {
            await w.reloadFromDataModel(eng);
        } else {
            w.update();
        }
        eventBus.emit('widget:settings-changed', { widget: w });
    }

    closeFormulaEditorModal() {
        const el = document.getElementById('aic-formula-editor-modal');
        if (el?.parentNode) el.parentNode.removeChild(el);
    }

    closeTextFormulaEditorModal() {
        this.closeFormulaEditorModal();
    }

    /**
     * @param {{
     *   title?: string,
     *   initialFormula?: string,
     *   applyButtonText?: string,
     *   onApply: (formula: string) => void,
     *   allowFieldRef?: boolean,
     *   allowColorExpr?: boolean,
     * }} opts
     */
    openFormulaEditorModal(opts) {
        this.closeFormulaEditorModal();
        const eng = this.engine;
        const ds = this.currentWidget?.dataSource;
        const title = opts.title || 'Редактор формулы';
        const applyButtonText = opts.applyButtonText || 'Сохранить';

        const backdrop = document.createElement('div');
        backdrop.id = 'aic-formula-editor-modal';
        backdrop.className = 'formula-modal-backdrop';
        backdrop.innerHTML = getFormulaEditorModalHTML();
        document.body.appendChild(backdrop);

        wireFormulaEditorModal(backdrop, {
            title,
            initialFormula: opts.initialFormula ?? '',
            saveButtonText: applyButtonText,
            onSave: opts.onApply,
            engine: eng,
            dataSource: ds,
            allowFieldRef: !!opts.allowFieldRef,
            allowColorExpr: !!opts.allowColorExpr,
        });
    }

    openTextFormulaEditorModal() {
        this.openFormulaEditorModal({
            title: 'Редактор формулы',
            initialFormula: '',
            applyButtonText: 'Вставить в шаблон',
            onApply: (formula) => {
                const tpl = this.panel.querySelector('#text-widget-template');
                if (tpl) {
                    const ins = `{${formula}}`;
                    const start = tpl.selectionStart ?? tpl.value.length;
                    const end = tpl.selectionEnd ?? tpl.value.length;
                    const v = tpl.value;
                    tpl.value = v.slice(0, start) + ins + v.slice(end);
                    tpl.focus();
                    const pos = start + ins.length;
                    try {
                        tpl.setSelectionRange(pos, pos);
                    } catch {
                        /* ignore */
                    }
                }
                void this.applyTextWidgetPanelSettings();
            },
        });
    }

    openKpiFormulaEditorModal() {
        const taPanel = this.panel.querySelector('#kpi-value-formula');
        const w = this.currentWidget;
        const initial = taPanel?.value ?? w?.settings?.valueFormula ?? '';
        this.openFormulaEditorModal({
            title: 'Редактор формулы KPI',
            initialFormula: String(initial),
            applyButtonText: 'Применить к KPI',
            onApply: (formula) => {
                if (taPanel) taPanel.value = formula;
                const modeEl = this.panel?.querySelector('#kpi-mode');
                if (modeEl) {
                    modeEl.value = 'formula';
                    this.syncKpiModeDependentUi();
                }
                void this.applyKpiPanelSettings();
            },
        });
    }

    setupKpiWidgetListeners() {
        const section = this.panel.querySelector('.kpi-settings-section');
        if (!section || section._kpiPanelBound) return;
        section._kpiPanelBound = true;

        const applyNow = () => {
            void this.applyKpiPanelSettings();
        };

        let formulaDebounce = null;
        const scheduleFormulaApply = () => {
            if (formulaDebounce) clearTimeout(formulaDebounce);
            formulaDebounce = setTimeout(() => {
                formulaDebounce = null;
                applyNow();
            }, 400);
        };

        const mode = this.panel.querySelector('#kpi-mode');
        if (mode) {
            mode.addEventListener('change', () => {
                this.syncKpiModeDependentUi();
                applyNow();
            });
        }
        this.syncKpiModeDependentUi();
        const kpiAgg = this.panel.querySelector('#kpi-aggregation');
        if (kpiAgg) {
            kpiAgg.addEventListener('change', () => {
                this.syncKpiCountModeVisibility();
                applyNow();
            });
        }

        const deltaMode = this.panel.querySelector('#kpi-delta-mode');
        if (deltaMode) {
            deltaMode.addEventListener('change', () => {
                this.syncKpiDeltaCustomRangeVisibility();
                applyNow();
            });
        }
        const deltaEnabled = this.panel.querySelector('#kpi-delta-enabled');
        if (deltaEnabled) {
            deltaEnabled.addEventListener('change', () => {
                this.syncKpiDeltaCustomRangeVisibility();
                applyNow();
            });
        }
        this.syncKpiDeltaCustomRangeVisibility();

        const kpiDeltaColor = this.panel.querySelector('#kpi-delta-color');
        const kpiDeltaColorText = this.panel.querySelector('#kpi-delta-color-text');
        if (kpiDeltaColor && kpiDeltaColorText) {
            kpiDeltaColor.addEventListener('input', () => {
                kpiDeltaColorText.value = kpiDeltaColor.value;
                applyNow();
            });
            kpiDeltaColorText.addEventListener('input', () => {
                const v = String(kpiDeltaColorText.value || '').trim();
                if (/^#[0-9a-fA-F]{6}$/i.test(v)) kpiDeltaColor.value = v;
                applyNow();
            });
            kpiDeltaColorText.addEventListener('change', applyNow);
        }
        const kpiDeltaColorFx = this.panel.querySelector('#kpi-delta-color-formula');
        if (kpiDeltaColorFx) {
            kpiDeltaColorFx.addEventListener('change', applyNow);
            kpiDeltaColorFx.addEventListener('input', scheduleFormulaApply);
        }

        const kpiTitle = this.panel.querySelector('#kpi-widget-title');
        if (kpiTitle) {
            kpiTitle.addEventListener('input', applyNow);
        }
        const kpiShowTitle = this.panel.querySelector('#kpi-show-title');
        if (kpiShowTitle) kpiShowTitle.addEventListener('change', applyNow);
        const kpiTitleSize = this.panel.querySelector('#kpi-title-size');
        if (kpiTitleSize) {
            kpiTitleSize.addEventListener('input', applyNow);
            kpiTitleSize.addEventListener('change', applyNow);
        }
        this.wireTitleColorInputs('kpi', applyNow);

        const kpiPanelChangeApplyIds = new Set([
            'kpi-date-field',
            'kpi-granularity',
            'kpi-period-shift',
            'kpi-period-mode',
            'kpi-value-field',
            'kpi-aggregation',
            'kpi-count-mode',
            'kpi-fallback-start',
            'kpi-fallback-end',
            'kpi-delta-custom-start',
            'kpi-delta-custom-end',
            'kpi-delta-type',
            'kpi-delta-display',
        ]);
        section.addEventListener('change', (e) => {
            const id = e.target?.id || '';
            if (kpiPanelChangeApplyIds.has(id)) applyNow();
        });
        const periodShiftInp = this.panel.querySelector('#kpi-period-shift');
        if (periodShiftInp) {
            periodShiftInp.addEventListener('input', applyNow);
        }

        const fta = this.panel.querySelector('#kpi-value-formula');
        if (fta) {
            fta.addEventListener('change', applyNow);
            fta.addEventListener('input', scheduleFormulaApply);
        }

        const kpiBgMode = this.panel.querySelector('#kpi-bg-mode');
        if (kpiBgMode) {
            kpiBgMode.addEventListener('change', () => {
                this.syncKpiBgModeUi();
                applyNow();
            });
        }
        const kpiBgSolidTr = this.panel.querySelector('#kpi-bg-solid-transparent');
        if (kpiBgSolidTr) {
            kpiBgSolidTr.addEventListener('change', () => {
                this.syncKpiBgSolidColorDisabled();
                applyNow();
            });
        }
        const kpiBgSolidCol = this.panel.querySelector('#kpi-bg-solid-color');
        if (kpiBgSolidCol) kpiBgSolidCol.addEventListener('input', applyNow);

        const kpiBgDefTr = this.panel.querySelector('#kpi-bg-default-transparent');
        if (kpiBgDefTr) {
            kpiBgDefTr.addEventListener('change', () => {
                const c = this.panel.querySelector('#kpi-bg-default-color');
                if (c) c.disabled = !!kpiBgDefTr.checked;
                applyNow();
            });
        }
        const kpiBgDefCol = this.panel.querySelector('#kpi-bg-default-color');
        if (kpiBgDefCol) kpiBgDefCol.addEventListener('input', applyNow);

        const kpiBgDeltaNeg = this.panel.querySelector('#kpi-bg-delta-neg');
        if (kpiBgDeltaNeg) kpiBgDeltaNeg.addEventListener('input', applyNow);
        const kpiBgDeltaPos = this.panel.querySelector('#kpi-bg-delta-pos');
        if (kpiBgDeltaPos) kpiBgDeltaPos.addEventListener('input', applyNow);

        const kpiBgPreset = this.panel.querySelector('#kpi-bg-preset');
        if (kpiBgPreset) kpiBgPreset.addEventListener('change', () => this.applyKpiBgPresetFromSelect());

        const kpiBgAdd = this.panel.querySelector('#kpi-bg-add-rule');
        if (kpiBgAdd) {
            kpiBgAdd.addEventListener('click', () => {
                const list = this.panel.querySelector('#kpi-bg-rules-list');
                list?.appendChild(this.createKpiBgRuleRowEl({ op: 'gte', value: 0, value2: 100, color: '#1565c0' }));
                applyNow();
            });
        }

        /** @type {ReturnType<typeof setTimeout>|null} */
        let kpiBgRulesDeb = null;
        const onKpiBgRulesClick = (e) => {
            const t = /** @type {HTMLElement} */ (e.target);
            if (!t?.classList?.contains('kpi-bg-rule-remove')) return;
            if (!t.closest?.('#kpi-bg-rules-list')) return;
            t.closest('.kpi-bg-rule-row')?.remove();
            applyNow();
        };
        const onKpiBgRulesInput = (e) => {
            const t = /** @type {HTMLElement} */ (e.target);
            if (!t.closest?.('#kpi-bg-rules-list')) return;
            if (kpiBgRulesDeb) clearTimeout(kpiBgRulesDeb);
            kpiBgRulesDeb = setTimeout(() => {
                kpiBgRulesDeb = null;
                applyNow();
            }, 350);
        };
        const onKpiBgRulesChange = (e) => {
            const t = /** @type {HTMLElement} */ (e.target);
            if (!t?.classList?.contains('kpi-bg-rule-op')) return;
            if (!t.closest?.('#kpi-bg-rules-list')) return;
            const row = t.closest('.kpi-bg-rule-row');
            this.syncKpiBgRuleRowSecondVisibility(row);
            applyNow();
        };
        this.panel.addEventListener('click', onKpiBgRulesClick);
        this.panel.addEventListener('input', onKpiBgRulesInput);
        this.panel.addEventListener('change', onKpiBgRulesChange);
    }

    setupPieChartSettingsListeners() {
        const section = this.panel.querySelector('.pie-chart-settings-section');
        if (!section || section._pieChartPanelBound) return;
        section._pieChartPanelBound = true;

        const apply = () => this.applyPieChartPanelSettings();

        const innerR = this.panel.querySelector('#pie-chart-inner-radius');
        const innerRVal = this.panel.querySelector('#pie-chart-inner-radius-value');
        const segPad = this.panel.querySelector('#pie-chart-segment-pad');
        const segPadVal = this.panel.querySelector('#pie-chart-segment-pad-value');
        if (innerR && innerRVal) {
            innerR.addEventListener('input', () => {
                innerRVal.textContent = innerR.value;
                apply();
            });
        }
        if (segPad && segPadVal) {
            segPad.addEventListener('input', () => {
                segPadVal.textContent = segPad.value;
                apply();
            });
        }

        section.addEventListener('change', (e) => {
            if (!e.target.closest('.pie-chart-settings-section')) return;
            if (
                e.target?.id === 'pie-chart-color-mode' ||
                e.target?.id === 'pie-chart-slice-threshold-formula' ||
                e.target?.id === 'pie-chart-label-position' ||
                e.target?.id === 'pie-chart-show-legend'
            ) {
                this.syncPieChartDependentUi();
            }
            apply();
        });
        section.addEventListener('input', (e) => {
            if (
                e.target &&
                (e.target.id === 'pie-chart-center-template' ||
                    e.target.id === 'pie-chart-widget-title' ||
                    e.target.id === 'pie-chart-title-size' ||
                    e.target.id === 'pie-chart-title-color' ||
                    e.target.id === 'pie-chart-title-color-text' ||
                    e.target.id === 'pie-chart-slice-threshold-formula' ||
                    e.target.id === 'pie-chart-slice-above-color' ||
                    e.target.id === 'pie-chart-slice-below-color' ||
                    e.target.id === 'pie-chart-solid-color' ||
                    e.target.id === 'pie-chart-palette-add-color')
            ) {
                if (e.target.id === 'pie-chart-slice-threshold-formula') {
                    this.syncPieChartDependentUi();
                }
                apply();
            }
        });

        const palPresets = this.panel.querySelector('#pie-chart-palette-presets');
        if (palPresets && !palPresets._piePalettePresetsBound) {
            palPresets._piePalettePresetsBound = true;
            palPresets.addEventListener('click', (e) => {
                const b = e.target.closest('.bar-chart-palette-preset');
                if (!b?.dataset?.hex) return;
                this.appendPiePaletteChip(b.dataset.hex);
                apply();
            });
        }
        const palSwatches = this.panel.querySelector('#pie-chart-palette-swatches');
        if (palSwatches && !palSwatches._piePaletteSwatchesBound) {
            palSwatches._piePaletteSwatchesBound = true;
            palSwatches.addEventListener('click', (e) => {
                if (e.target.closest('.bar-chart-palette-chip-remove')) {
                    e.target.closest('.bar-chart-palette-chip')?.remove();
                    apply();
                }
            });
        }
        const palAddBtn = this.panel.querySelector('#pie-chart-palette-add');
        if (palAddBtn && !palAddBtn._piePaletteAddBound) {
            palAddBtn._piePaletteAddBound = true;
            palAddBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const inp = this.panel.querySelector('#pie-chart-palette-add-color');
                if (inp?.value) {
                    this.appendPiePaletteChip(inp.value);
                    apply();
                }
            });
        }
        const palResetBtn = this.panel.querySelector('#pie-chart-palette-reset');
        if (palResetBtn && !palResetBtn._piePaletteResetBound) {
            palResetBtn._piePaletteResetBound = true;
            palResetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const root = this.panel.querySelector('#pie-chart-palette-swatches');
                if (root) root.innerHTML = '';
                apply();
            });
        }

        this.wireTitleColorInputs('pie-chart', apply);
        this.syncPieChartDependentUi();
    }

    setupBarChartSettingsListeners() {
        const section = this.panel.querySelector('.bar-chart-settings-section');
        if (!section || section._barChartPanelBound) return;
        section._barChartPanelBound = true;
        const apply = () => this.applyBarChartPanelSettings();
        section.addEventListener('change', (e) => {
            if (!e.target.closest('.bar-chart-settings-section')) return;
            apply();
        });
        section.addEventListener('input', (e) => {
            if (!e.target.closest('.bar-chart-settings-section')) return;
            const id = e.target?.id || '';
            if (
                id === 'bar-chart-gap' ||
                id === 'bar-chart-gap-px' ||
                id === 'bar-chart-min-band' ||
                id === 'bar-chart-solid-color' ||
                id === 'bar-chart-border-radius' ||
                id === 'bar-chart-grid-opacity' ||
                id === 'bar-chart-pad-t' ||
                id === 'bar-chart-pad-r' ||
                id === 'bar-chart-pad-b' ||
                id === 'bar-chart-pad-l' ||
                id === 'bar-chart-widget-title' ||
                id === 'bar-chart-title-size' ||
                id === 'bar-chart-title-color' ||
                id === 'bar-chart-title-color-text' ||
                id === 'bar-chart-threshold-formula'
            ) {
                apply();
            }
        });
        this.wireTitleColorInputs('bar-chart', apply);
        const gap = this.panel.querySelector('#bar-chart-gap');
        const gapVal = this.panel.querySelector('#bar-chart-gap-value');
        if (gap && gapVal) {
            gap.addEventListener('input', () => {
                gapVal.textContent = (parseInt(gap.value, 10) / 100).toFixed(2);
            });
        }
        const gapPx = this.panel.querySelector('#bar-chart-gap-px');
        const gapPxVal = this.panel.querySelector('#bar-chart-gap-px-value');
        if (gapPx && gapPxVal) {
            gapPx.addEventListener('input', () => {
                gapPxVal.textContent = String(gapPx.value);
            });
        }
        const brR = this.panel.querySelector('#bar-chart-border-radius');
        const brRVal = this.panel.querySelector('#bar-chart-border-radius-value');
        if (brR && brRVal) {
            brR.addEventListener('input', () => {
                brRVal.textContent = String(brR.value);
            });
        }
        const gOp = this.panel.querySelector('#bar-chart-grid-opacity');
        const gOpVal = this.panel.querySelector('#bar-chart-grid-opacity-value');
        if (gOp && gOpVal) {
            gOp.addEventListener('input', () => {
                gOpVal.textContent = (parseInt(gOp.value, 10) / 100).toFixed(2);
            });
        }

        const band = this.panel.querySelector('#bar-chart-min-band');
        const bandVal = this.panel.querySelector('#bar-chart-min-band-value');
        if (band && bandVal) {
            band.addEventListener('input', () => {
                bandVal.textContent = String(band.value);
            });
        }

        const palPresets = this.panel.querySelector('.bar-chart-palette-presets');
        if (palPresets && !palPresets._barPalettePresetsBound) {
            palPresets._barPalettePresetsBound = true;
            palPresets.addEventListener('click', (e) => {
                const b = e.target.closest('.bar-chart-palette-preset');
                if (!b?.dataset?.hex) return;
                this.appendBarPaletteChip(b.dataset.hex);
                apply();
            });
        }
        const palSwatches = this.panel.querySelector('#bar-chart-palette-swatches');
        if (palSwatches && !palSwatches._barPaletteSwatchesBound) {
            palSwatches._barPaletteSwatchesBound = true;
            palSwatches.addEventListener('click', (e) => {
                if (e.target.closest('.bar-chart-palette-chip-remove')) {
                    e.target.closest('.bar-chart-palette-chip')?.remove();
                    apply();
                }
            });
        }
        const palAddBtn = this.panel.querySelector('#bar-chart-palette-add');
        if (palAddBtn && !palAddBtn._barPaletteAddBound) {
            palAddBtn._barPaletteAddBound = true;
            palAddBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const inp = this.panel.querySelector('#bar-chart-palette-add-color');
                if (inp?.value) {
                    this.appendBarPaletteChip(inp.value);
                    apply();
                }
            });
        }
        const palResetBtn = this.panel.querySelector('#bar-chart-palette-reset');
        if (palResetBtn && !palResetBtn._barPaletteResetBound) {
            palResetBtn._barPaletteResetBound = true;
            palResetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const root = this.panel.querySelector('#bar-chart-palette-swatches');
                if (root) root.innerHTML = '';
                apply();
            });
        }
    }

    applyBarChartPanelSettings() {
        const w = this.currentWidget;
        if (!w || w.type !== 'bar-chart' || !w.settings) return;

        const showCb = this.panel.querySelector('#bar-chart-show-title');
        const titleInp = this.panel.querySelector('#bar-chart-widget-title');
        const sizeInp = this.panel.querySelector('#bar-chart-title-size');
        if (showCb) w.settings.showTitle = !!showCb.checked;
        if (titleInp) {
            const t = (titleInp.value || '').trim();
            w.settings.title = t.length ? t : 'Столбчатая диаграмма';
        }
        if (sizeInp) {
            let n = parseInt(sizeInp.value, 10);
            if (!Number.isFinite(n)) n = 14;
            w.settings.titleSize = Math.min(48, Math.max(8, n));
        }
        const barTitleColor = this.readTitleColorFromPanel('bar-chart');
        if (barTitleColor) w.settings.titleColor = barTitleColor;
        this.syncWidgetTitleSubRows('bar-chart');

        const prevSlice = w.settings.barSliceWeight || 'auto';
        const sliceSel = this.panel.querySelector('#bar-chart-slice-weight');
        if (sliceSel) {
            const sw = sliceSel.value;
            w.settings.barSliceWeight = sw === 'sum' || sw === 'count' ? sw : 'auto';
        }

        const orientSel = this.panel.querySelector('#bar-chart-orientation');
        if (orientSel) {
            const v = orientSel.value;
            w.settings.barOrientation =
                v === 'top' || v === 'left' || v === 'right' || v === 'bottom' ? v : 'bottom';
        }

        const sortSel = this.panel.querySelector('#bar-chart-sort');
        if (sortSel) {
            const v = sortSel.value;
            w.settings.barSort =
                v === 'value_desc' ||
                v === 'value_asc' ||
                v === 'label_asc' ||
                v === 'label_desc' ||
                v === 'none'
                    ? v
                    : 'none';
        }

        const gapEl = this.panel.querySelector('#bar-chart-gap');
        if (gapEl) {
            let g = parseInt(gapEl.value, 10) / 100;
            if (!Number.isFinite(g)) g = 0.2;
            w.settings.barGap = Math.min(0.9, Math.max(0, g));
        }

        const lp = this.panel.querySelector('#bar-chart-label-placement');
        if (lp) {
            const v = lp.value;
            w.settings.barLabelPlacement =
                v === 'axis' || v === 'onBar' || v === 'both' || v === 'none' ? v : 'axis';
        }

        const lr = this.panel.querySelector('#bar-chart-label-rotation');
        if (lr) {
            let n = parseInt(lr.value, 10);
            if (!Number.isFinite(n)) n = 0;
            w.settings.barLabelRotation = [0, 45, 90, -45].includes(n) ? n : 0;
        }

        const vf = this.panel.querySelector('#bar-chart-value-format');
        if (vf) {
            const v = vf.value;
            w.settings.barValueFormat = v === 'int' || v === 'compact' ? v : 'raw';
        }

        const cm = this.panel.querySelector('#bar-chart-color-mode');
        if (cm) {
            const v = cm.value;
            w.settings.barColorMode = v === 'solid' || v === 'palette' ? v : 'gradient';
        }

        const solid = this.panel.querySelector('#bar-chart-solid-color');
        if (solid && solid.value) w.settings.barSolidColor = solid.value;

        const chips = this.collectBarPaletteColorsFromPanel();
        if (chips.length) {
            w.settings.barPalette = chips;
            w.settings.barPaletteFormulas = this.collectBarPaletteFormulasFromPanel();
        } else {
            delete w.settings.barPalette;
            delete w.settings.barPaletteFormulas;
        }

        const sc = this.panel.querySelector('#bar-chart-scroll');
        if (sc) {
            const v = sc.value;
            w.settings.barScroll = v === 'off' || v === 'on' ? v : 'auto';
        }

        const mb = this.panel.querySelector('#bar-chart-min-band');
        if (mb) {
            let n = parseInt(mb.value, 10);
            if (!Number.isFinite(n)) n = 28;
            w.settings.barMinBandPx = Math.min(120, Math.max(12, n));
        }

        const gapPxEl = this.panel.querySelector('#bar-chart-gap-px');
        if (gapPxEl) {
            let g = parseInt(gapPxEl.value, 10);
            if (!Number.isFinite(g)) g = 8;
            w.settings.barGapPx = Math.min(48, Math.max(0, g));
        }

        const showV = this.panel.querySelector('#bar-chart-show-values');
        if (showV) w.settings.showValues = !!showV.checked;

        const vPos = this.panel.querySelector('#bar-chart-value-position');
        if (vPos) {
            const v = vPos.value;
            w.settings.valuePosition =
                v === 'inside' || v === 'outside' || v === 'top' || v === 'right' ? v : 'top';
        }

        const pt = this.panel.querySelector('#bar-chart-pad-t');
        const pr = this.panel.querySelector('#bar-chart-pad-r');
        const pb = this.panel.querySelector('#bar-chart-pad-b');
        const pl = this.panel.querySelector('#bar-chart-pad-l');
        if (pt || pr || pb || pl) {
            const p0 = {
                top: 20,
                right: 20,
                bottom: 44,
                left: 48,
                ...(w.settings.padding || {}),
            };
            w.settings.padding = {
                top: Math.min(200, Math.max(0, parseInt(pt?.value, 10) || p0.top)),
                right: Math.min(240, Math.max(0, parseInt(pr?.value, 10) || p0.right)),
                bottom: Math.min(240, Math.max(0, parseInt(pb?.value, 10) || p0.bottom)),
                left: Math.min(280, Math.max(0, parseInt(pl?.value, 10) || p0.left)),
            };
        }

        const brEl = this.panel.querySelector('#bar-chart-border-radius');
        if (brEl) {
            let r = parseInt(brEl.value, 10);
            if (!Number.isFinite(r)) r = 4;
            w.settings.barBorderRadius = Math.min(24, Math.max(0, r));
        }

        const gOpEl = this.panel.querySelector('#bar-chart-grid-opacity');
        if (gOpEl) {
            let o = parseInt(gOpEl.value, 10) / 100;
            if (!Number.isFinite(o)) o = 0.14;
            w.settings.gridOpacity = Math.min(0.6, Math.max(0, o));
        }

        const hov = this.panel.querySelector('#bar-chart-hover');
        if (hov) w.settings.barHoverEffect = !!hov.checked;

        if (!w.settings.stats || typeof w.settings.stats !== 'object') w.settings.stats = {};
        const stAvg = this.panel.querySelector('#bar-chart-stats-avg');
        if (stAvg) w.settings.stats.showAvg = !!stAvg.checked;
        const stMed = this.panel.querySelector('#bar-chart-stats-median');
        if (stMed) w.settings.stats.showMedian = !!stMed.checked;
        const stSum = this.panel.querySelector('#bar-chart-stats-sum');
        if (stSum) w.settings.stats.showSum = !!stSum.checked;

        const oldBarThr = String(w.settings.barThresholdFormula || '').trim();
        const bThrTa = this.panel.querySelector('#bar-chart-threshold-formula');
        if (bThrTa) w.settings.barThresholdFormula = bThrTa.value || '';
        const bHi = this.panel.querySelector('#bar-chart-threshold-high-color');
        const bLo = this.panel.querySelector('#bar-chart-threshold-low-color');
        if (bHi?.value) w.settings.barThresholdHighColor = bHi.value;
        if (bLo?.value) w.settings.barThresholdLowColor = bLo.value;
        const barThrChanged = oldBarThr !== String(w.settings.barThresholdFormula || '').trim();

        const sliceChanged = (w.settings.barSliceWeight || 'auto') !== prevSlice;
        if (
            barThrChanged &&
            this.engine &&
            typeof w.reloadFromDataModel === 'function' &&
            w.settings.bindingDimension?.modelId
        ) {
            void w.reloadFromDataModel(this.engine);
            eventBus.emit('widget:styles-changed', { widget: w });
            return;
        }
        if (
            sliceChanged &&
            this.engine &&
            typeof w.reloadFromDataModel === 'function' &&
            w.settings.bindingDimension?.modelId
        ) {
            void w.reloadFromDataModel(this.engine);
            eventBus.emit('widget:styles-changed', { widget: w });
            return;
        }

        w.update();
        eventBus.emit('widget:styles-changed', { widget: w });
    }

    setupLineChartSettingsListeners() {
        const section = this.panel.querySelector('.line-chart-settings-section');
        if (!section || section._lineChartPanelBound) return;
        this._ensureLineChartTabsLayout(section);
        section._lineChartPanelBound = true;
        const apply = () => this.applyLineChartPanelSettings();
        section.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.line-chart-tab-btn');
            if (!btn || !section.contains(btn)) return;
            const tab = btn.getAttribute('data-line-tab') || 'interaction';
            this._setLineChartTab(section, tab);
        });
        section.addEventListener('change', (e) => {
            if (!e.target.closest('.line-chart-settings-section')) return;
            apply();
        });
        section.addEventListener('input', (e) => {
            if (!e.target.closest('.line-chart-settings-section')) return;
            const id = e.target?.id || '';
            if (
                id === 'line-chart-line-width' ||
                id === 'line-chart-line-opacity' ||
                id === 'line-chart-point-radius' ||
                id === 'line-chart-point-hover-radius' ||
                id === 'line-chart-grid-density' ||
                id === 'line-chart-grid-opacity' ||
                id === 'line-chart-minimap-height' ||
                id === 'line-chart-point-color' ||
                id === 'line-chart-threshold-formula' ||
                id === 'line-chart-grid-color' ||
                id === 'line-chart-label-custom' ||
                id === 'line-chart-initial-span' ||
                id === 'line-chart-tf-add-custom-input' ||
                id === 'line-chart-tf-sync' ||
                id === 'line-chart-widget-title' ||
                id === 'line-chart-title-size' ||
                id === 'line-chart-title-color' ||
                id === 'line-chart-title-color-text'
            ) {
                if (id === 'line-chart-threshold-formula') {
                    this.syncLineChartDependentUi();
                }
                apply();
            }
        });

        const lw = this.panel.querySelector('#line-chart-line-width');
        const lwVal = this.panel.querySelector('#line-chart-line-width-value');
        if (lw && lwVal) {
            lw.addEventListener('input', () => {
                lwVal.textContent = String(lw.value);
            });
        }
        const lo = this.panel.querySelector('#line-chart-line-opacity');
        const loVal = this.panel.querySelector('#line-chart-line-opacity-value');
        if (lo && loVal) {
            lo.addEventListener('input', () => {
                loVal.textContent = (parseInt(lo.value, 10) / 100).toFixed(2);
            });
        }
        const pr = this.panel.querySelector('#line-chart-point-radius');
        const prVal = this.panel.querySelector('#line-chart-point-radius-value');
        if (pr && prVal) {
            pr.addEventListener('input', () => {
                prVal.textContent = String(pr.value);
            });
        }
        const ph = this.panel.querySelector('#line-chart-point-hover-radius');
        const phVal = this.panel.querySelector('#line-chart-point-hover-radius-value');
        if (ph && phVal) {
            ph.addEventListener('input', () => {
                phVal.textContent = String(ph.value);
            });
        }
        const gd = this.panel.querySelector('#line-chart-grid-density');
        const gdVal = this.panel.querySelector('#line-chart-grid-density-value');
        if (gd && gdVal) {
            gd.addEventListener('input', () => {
                gdVal.textContent = String(gd.value);
            });
        }
        const go = this.panel.querySelector('#line-chart-grid-opacity');
        const goVal = this.panel.querySelector('#line-chart-grid-opacity-value');
        if (go && goVal) {
            go.addEventListener('input', () => {
                goVal.textContent = (parseInt(go.value, 10) / 100).toFixed(2);
            });
        }
        const mh = this.panel.querySelector('#line-chart-minimap-height');
        const mhVal = this.panel.querySelector('#line-chart-minimap-height-value');
        if (mh && mhVal) {
            mh.addEventListener('input', () => {
                mhVal.textContent = String(mh.value);
            });
        }
        const ispan = this.panel.querySelector('#line-chart-initial-span');
        const ispanVal = this.panel.querySelector('#line-chart-initial-span-value');
        if (ispan && ispanVal) {
            ispan.addEventListener('input', () => {
                ispanVal.textContent = `${ispan.value}%`;
            });
        }
        this._syncLineChartPanelAccent(section);
        this.syncLineChartDependentUi();
        this.wireTitleColorInputs('line-chart', apply);
    }

    applyLineChartPanelSettings() {
        const w = this.currentWidget;
        if (!w || w.type !== 'line-chart' || !w.settings) return;
        const p = this.panel;
        this.syncLineChartDependentUi();
        this.applyWidgetTitleSettingsFromPanel(w, 'line-chart', {
            defaultTitle: 'Линейный график',
        });

        const setBool = (sel, path) => {
            const el = p.querySelector(sel);
            if (!el) return;
            const keys = path.split('.');
            let o = w.settings;
            for (let i = 0; i < keys.length - 1; i++) {
                const k = keys[i];
                if (!o[k] || typeof o[k] !== 'object') o[k] = {};
                o = o[k];
            }
            o[keys[keys.length - 1]] = !!el.checked;
        };

        setBool('#line-chart-zoom-enabled', 'zoom.enabled');
        setBool('#line-chart-pan-enabled', 'pan.enabled');
        setBool('#line-chart-minimap-enabled', 'miniMap.enabled');
        setBool('#line-chart-wheel-zoom', 'zoom.wheel');
        setBool('#line-chart-drag-zoom', 'zoom.dragSelect');
        setBool('#line-chart-dbl-reset', 'zoom.doubleClickReset');
        setBool('#line-chart-zoom-x', 'zoom.x');
        setBool('#line-chart-zoom-y', 'zoom.y');
        const cfb = p.querySelector('#line-chart-cross-filter-brush-x');
        if (cfb) w.settings.crossFilterBrushX = !!cfb.checked;
        if (cfb && !cfb.checked && w.settings.dashboardBrushX) {
            delete w.settings.dashboardBrushX;
            if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
            eventBus.emit('dashboard:filters-changed', { source: 'line-chart-brush-panel-off' });
        }
        setBool('#line-chart-line-smooth', 'line.smooth');
        setBool('#line-chart-points-enabled', 'points.enabled');
        setBool('#line-chart-labels-enabled', 'labels.enabled');
        setBool('#line-chart-grid-enabled', 'grid.enabled');
        setBool('#line-chart-axis-x', 'axis.x.enabled');
        setBool('#line-chart-axis-y', 'axis.y.enabled');
        setBool('#line-chart-tooltip-enabled', 'tooltip.enabled');
        setBool('#line-chart-tooltip-show-value', 'tooltip.showValue');
        setBool('#line-chart-tooltip-pct', 'tooltip.showPctChange');
        setBool('#line-chart-legend-enabled', 'legend.enabled');
        setBool('#line-chart-crosshair-enabled', 'crosshair.enabled');
        setBool('#line-chart-stack', 'stack');
        setBool('#line-chart-stats-last', 'stats.showLast');
        setBool('#line-chart-stats-minmax', 'stats.showMinMax');
        setBool('#line-chart-stats-avg', 'stats.showAvg');
        setBool('#line-chart-stats-median', 'stats.showMedian');
        setBool('#line-chart-stats-sum', 'stats.showSum');
        setBool('#line-chart-ma-enabled', 'analytics.ma.enabled');
        setBool('#line-chart-trend-enabled', 'analytics.trend.enabled');
        setBool('#line-chart-compare-enabled', 'analytics.compare.enabled');
        setBool('#line-chart-forecast-enabled', 'analytics.forecast.enabled');
        setBool('#line-chart-anomalies-enabled', 'analytics.anomalies.enabled');
        setBool('#line-chart-zoom-toolbar', 'zoom.showToolbar');
        const arf = p.querySelector('#line-chart-auto-refetch');
        if (arf) w.settings.auto_refetch_on_pan = !!arf.checked;
        const ct = p.querySelector('#line-chart-chart-type');
        if (ct) w.settings.chartType = ct.value;
        const maW = p.querySelector('#line-chart-ma-window');
        if (maW) {
            if (!w.settings.analytics) w.settings.analytics = {};
            if (!w.settings.analytics.ma) w.settings.analytics.ma = {};
            w.settings.analytics.ma.window = parseInt(maW.value, 10) || 7;
        }
        const td = p.querySelector('#line-chart-trend-degree');
        if (td) {
            if (!w.settings.analytics) w.settings.analytics = {};
            if (!w.settings.analytics.trend) w.settings.analytics.trend = {};
            w.settings.analytics.trend.degree = td.value === '2' ? 2 : 1;
        }
        const cm = p.querySelector('#line-chart-compare-mode');
        if (cm) {
            if (!w.settings.analytics) w.settings.analytics = {};
            if (!w.settings.analytics.compare) w.settings.analytics.compare = {};
            w.settings.analytics.compare.mode = cm.value;
        }
        const cs = p.querySelector('#line-chart-compare-shift');
        if (cs) {
            if (!w.settings.analytics) w.settings.analytics = {};
            if (!w.settings.analytics.compare) w.settings.analytics.compare = {};
            const n = Number(cs.value);
            w.settings.analytics.compare.shiftMs = Number.isFinite(n) ? n : null;
        }
        const fh = p.querySelector('#line-chart-forecast-horizon');
        const fm = p.querySelector('#line-chart-forecast-method');
        const fc = p.querySelector('#line-chart-forecast-conf');
        if (fh || fm || fc) {
            if (!w.settings.analytics) w.settings.analytics = {};
            if (!w.settings.analytics.forecast) w.settings.analytics.forecast = {};
            if (fh) w.settings.analytics.forecast.horizon = parseInt(fh.value, 10) || 30;
            if (fm) w.settings.analytics.forecast.method = fm.value;
            if (fc) w.settings.analytics.forecast.confidence = Number(fc.value) >= 0.95 ? 0.95 : 0.8;
        }
        // LOD всегда авто по ширине viewport — mode выбирается в панели.
        const lodModeEl = p.querySelector('#line-chart-lod-mode');
        const lodMode = lodModeEl?.value === 'lttb' ? 'lttb' : 'minmax';
        w.settings.lod = { ...(w.settings.lod || {}), enabled: true, mode: lodMode };
        delete w.settings.lod.threshold;
        delete w.settings.lod.maxRenderPoints;
        const prefSrv = p.querySelector('#line-chart-prefer-server-agg');
        if (prefSrv) {
            if (!w.settings.timeframe) w.settings.timeframe = {};
            w.settings.timeframe.preferServerAggregation = !!prefSrv.checked;
        }

        const tfEn = p.querySelector('#line-chart-tf-enabled');
        const tfAgg = p.querySelector('#line-chart-tf-agg');
        const tfBarLayout = p.querySelector('#line-chart-tf-bar-layout');
        const tfBarDensity = p.querySelector('#line-chart-tf-bar-density');
        const tfAllowC = p.querySelector('#line-chart-tf-allow-custom');
        const tfAuto = p.querySelector('#line-chart-tf-auto');
        const tfSync = p.querySelector('#line-chart-tf-sync');
        const tfSlotList = p.querySelector('#line-chart-tf-available-list');
        if (tfEn || tfAgg || tfBarLayout || tfBarDensity || tfSlotList || tfAllowC || tfAuto || tfSync) {
            if (!w.settings.timeframe || typeof w.settings.timeframe !== 'object') w.settings.timeframe = {};
            if (tfEn) w.settings.timeframe.enabled = !!tfEn.checked;
            if (tfAgg) w.settings.timeframe.aggregation = tfAgg.value;
            if (tfBarLayout) {
                const v = String(tfBarLayout.value || '').toLowerCase();
                w.settings.timeframe.barLayout = v === 'row' ? 'row' : 'column';
            }
            if (tfBarDensity) {
                const d = String(tfBarDensity.value || '').toLowerCase();
                w.settings.timeframe.barDensity = d === 'compact' ? 'compact' : 'comfortable';
            }
            if (tfSlotList) {
                const slots = [...tfSlotList.querySelectorAll('.line-chart-tf-slot-row')]
                    .map((r) => r.dataset.slot)
                    .filter((s) => s && decodeTimeframeSlot(s));
                if (slots.length) w.settings.timeframe.availableIds = slots;
            }
            if (tfAllowC) w.settings.timeframe.allowCustom = !!tfAllowC.checked;
            if (tfAuto) w.settings.timeframe.autoSuggest = !!tfAuto.checked;
            if (tfSync) w.settings.timeframe.syncGroupId = String(tfSync.value || '').trim().slice(0, 120);
            if (tfEn?.checked && String(w.settings.timeframe.id || '') === 'raw') {
                const first = (w.settings.timeframe.availableIds || [])[0];
                if (first) {
                    const d = decodeTimeframeSlot(first);
                    if (d?.kind === 'preset') w.settings.timeframe.id = d.id;
                    else if (d?.kind === 'customSlot') {
                        w.settings.timeframe.id = 'custom';
                        w.settings.timeframe.customIntervalMs = d.intervalMs;
                    }
                }
            }
            if (tfEn && !tfEn.checked) {
                w.settings.timeframe.id = 'raw';
                w.settings.timeframe.customIntervalMs = null;
            }
        }

        const lw = p.querySelector('#line-chart-line-width');
        if (lw) w.settings.line = { ...w.settings.line, width: parseInt(lw.value, 10) || 2 };
        const lst = p.querySelector('#line-chart-line-style');
        if (lst) w.settings.line = { ...w.settings.line, style: lst.value };
        // Цвет/градиент — на вкладке Данные у Y-серий; синхронизируем fallback line.color
        const firstMeas = Array.isArray(w.settings.bindingMeasures) ? w.settings.bindingMeasures[0] : null;
        if (firstMeas?.color) {
            w.settings.line = { ...w.settings.line, color: firstMeas.color };
        }
        const lop = p.querySelector('#line-chart-line-opacity');
        if (lop) w.settings.line = { ...w.settings.line, opacity: parseInt(lop.value, 10) / 100 };

        const pr = p.querySelector('#line-chart-point-radius');
        if (pr) w.settings.points = { ...w.settings.points, radius: parseInt(pr.value, 10) };
        const phr = p.querySelector('#line-chart-point-hover-radius');
        if (phr) w.settings.points = { ...w.settings.points, hoverRadius: parseInt(phr.value, 10) };
        const pc = p.querySelector('#line-chart-point-color');
        if (pc?.value) w.settings.points = { ...w.settings.points, color: pc.value };

        const oldLn = String(w.settings.lineThresholdFormula || '').trim();
        const lThr = p.querySelector('#line-chart-threshold-formula');
        if (lThr) w.settings.lineThresholdFormula = lThr.value || '';
        const lHi = p.querySelector('#line-chart-threshold-high-color');
        const lLo = p.querySelector('#line-chart-threshold-low-color');
        if (lHi?.value) w.settings.lineThresholdHighColor = lHi.value;
        if (lLo?.value) w.settings.lineThresholdLowColor = lLo.value;
        const lnThrChanged = oldLn !== String(w.settings.lineThresholdFormula || '').trim();
        if (
            lnThrChanged &&
            this.engine &&
            typeof w.reloadFromDataModel === 'function' &&
            w.settings.bindingDimension?.modelId
        ) {
            void w.reloadFromDataModel(this.engine);
            eventBus.emit('widget:styles-changed', { widget: w });
            return;
        }

        const lm = p.querySelector('#line-chart-label-mode');
        if (lm) w.settings.labels = { ...w.settings.labels, mode: lm.value };
        const lp = p.querySelector('#line-chart-label-position');
        if (lp) w.settings.labels = { ...w.settings.labels, position: lp.value };
        const lf = p.querySelector('#line-chart-label-format');
        if (lf) w.settings.labels = { ...w.settings.labels, format: lf.value };
        const lct = p.querySelector('#line-chart-label-custom');
        if (lct) w.settings.labels = { ...w.settings.labels, customFormat: lct.value || null };

        const gd = p.querySelector('#line-chart-grid-density');
        if (gd) w.settings.grid = { ...w.settings.grid, density: parseInt(gd.value, 10) };
        const gop = p.querySelector('#line-chart-grid-opacity');
        if (gop) w.settings.grid = { ...w.settings.grid, opacity: parseInt(gop.value, 10) / 100 };
        const gc = p.querySelector('#line-chart-grid-color');
        if (gc?.value) w.settings.grid = { ...w.settings.grid, color: gc.value };

        const ax = p.querySelector('#line-chart-axis-x-type');
        if (ax) w.settings.axis = { ...w.settings.axis, x: { ...(w.settings.axis?.x || {}), type: ax.value } };
        const axr = p.querySelector('#line-chart-axis-x-rotate');
        if (axr) {
            let n = parseInt(axr.value, 10);
            if (!Number.isFinite(n)) n = 0;
            w.settings.axis = { ...w.settings.axis, x: { ...(w.settings.axis?.x || {}), rotate: n } };
        }

        const mh = p.querySelector('#line-chart-minimap-height');
        if (mh) w.settings.miniMap = { ...w.settings.miniMap, height: parseInt(mh.value, 10) };

        const prevAnchor = (w.settings.dataWindow && w.settings.dataWindow.anchor) || 'start';
        const dwa = p.querySelector('#line-chart-data-window-anchor');
        const isp = p.querySelector('#line-chart-initial-span');
        if (dwa || isp) {
            if (!w.settings.dataWindow || typeof w.settings.dataWindow !== 'object') w.settings.dataWindow = {};
            if (dwa) w.settings.dataWindow.anchor = dwa.value === 'end' ? 'end' : 'start';
            if (isp) {
                let pct = parseInt(isp.value, 10);
                if (!Number.isFinite(pct)) pct = 100;
                pct = Math.min(100, Math.max(10, pct));
                w.settings.dataWindow.initialSpan = pct / 100;
            }
        }
        const nextAnchor = (w.settings.dataWindow && w.settings.dataWindow.anchor) || 'start';
        if (
            prevAnchor !== nextAnchor &&
            this.engine &&
            typeof w.reloadFromDataModel === 'function' &&
            w.settings.bindingDimension?.modelId
        ) {
            void w.reloadFromDataModel(this.engine);
            eventBus.emit('widget:styles-changed', { widget: w });
            return;
        }

        w.update();
        eventBus.emit('widget:styles-changed', { widget: w });
    }

    setupFilterWidgetSettingsListeners() {
        const section = this.panel.querySelector('.filter-widget-settings-section');
        if (!section || section._filterWidgetPanelBound) return;
        section._filterWidgetPanelBound = true;

        const syncTitleRow = () => {
            const showCb = this.panel.querySelector('#filter-show-title');
            const show = !!(showCb && showCb.checked);
            const row = this.panel.querySelector('#filter-widget-title-row');
            const colorRow = this.panel.querySelector('#filter-title-color-row');
            if (row) row.classList.toggle('filter-widget-title-row--hidden', !show);
            if (colorRow) colorRow.classList.toggle('widget-panel-title-sub--hidden', !show);
        };

        const readButtonStyleFromPanel = () =>
            normalizeFilterButtonStyle({
                background: this.panel.querySelector('#filter-btn-bg')?.value,
                hoverBackground: this.panel.querySelector('#filter-btn-hover')?.value,
                openBackground: this.panel.querySelector('#filter-btn-open')?.value,
                borderColor: this.panel.querySelector('#filter-btn-border')?.value,
                borderRadius: this.panel.querySelector('#filter-btn-radius')?.value,
                fontWeight: this.panel.querySelector('#filter-btn-font-weight')?.value,
            });

        const writeButtonStyleToPanel = (style) => {
            const s = normalizeFilterButtonStyle(style) || { ...DEFAULT_FILTER_BUTTON_STYLE };
            const setVal = (id, value) => {
                const el = this.panel.querySelector(id);
                if (!el || value == null) return;
                el.value = String(value);
            };
            setVal('#filter-btn-bg', s.background);
            setVal('#filter-btn-hover', s.hoverBackground);
            setVal('#filter-btn-open', s.openBackground);
            setVal('#filter-btn-border', s.borderColor);
            setVal('#filter-btn-radius', s.borderRadius);
            setVal('#filter-btn-font-weight', s.fontWeight);
        };
        this._writeFilterButtonStyleToPanel = writeButtonStyleToPanel;

        const q = (id) => this.panel.querySelector(id);
        const syncFilterStyleLabels = () => {
            const r = parseInt(q('#filter-style-radius')?.value ?? '-1', 10);
            const radiusVal = q('#filter-style-radius-val');
            if (radiusVal) radiusVal.textContent = r < 0 ? 'как в теме' : `${r}px`;
            const gapVal = q('#filter-style-gap-val');
            if (gapVal) gapVal.textContent = `${q('#filter-style-gap')?.value ?? 8}px`;
            const themeAccent = !!q('#filter-style-accent-theme')?.checked;
            const accentRow = q('#filter-style-accent-row');
            if (accentRow) accentRow.style.display = themeAccent ? 'none' : '';
        };

        const readFilterStyleFromPanel = () =>
            normalizeFilterStyle({
                variant: q('#filter-style-variant')?.value,
                size: q('#filter-style-size')?.value,
                layout: q('#filter-style-layout')?.value,
                radius: q('#filter-style-radius')?.value,
                gap: q('#filter-style-gap')?.value,
                accent: q('#filter-style-accent-theme')?.checked ? '' : q('#filter-style-accent')?.value,
            });

        const writeFilterStyleToPanel = (style) => {
            const s = normalizeFilterStyle(style);
            const setVal = (id, value) => {
                const el = q(id);
                if (el) el.value = String(value);
            };
            setVal('#filter-style-variant', s.variant);
            setVal('#filter-style-size', s.size);
            setVal('#filter-style-layout', s.layout);
            setVal('#filter-style-radius', s.radius);
            setVal('#filter-style-gap', s.gap);
            const themeCb = q('#filter-style-accent-theme');
            if (themeCb) themeCb.checked = !s.accent;
            if (s.accent) setVal('#filter-style-accent', s.accent);
            syncFilterStyleLabels();
        };
        this._writeFilterStyleToPanel = writeFilterStyleToPanel;

        const apply = (opts = {}) => {
            const w = this.currentWidget;
            if (!w || w.type !== 'filter' || !w.settings) return;
            const showCb = this.panel.querySelector('#filter-show-title');
            const titleInp = this.panel.querySelector('#filter-widget-title');
            if (showCb) w.settings.showTitle = !!showCb.checked;
            if (titleInp) {
                const t = (titleInp.value || '').trim();
                w.settings.title = t.length ? t : 'Фильтры';
            }
            const filterTitleColor = this.readTitleColorFromPanel('filter');
            if (filterTitleColor) w.settings.titleColor = filterTitleColor;

            if (opts.resetButtonStyle) {
                w.settings.buttonStyle = null;
                writeButtonStyleToPanel(null);
            } else if (opts.touchButtonStyle || w.settings.buttonStyle) {
                w.settings.buttonStyle = readButtonStyleFromPanel();
            }
            if (opts.touchFilterStyle) {
                w.settings.filterStyle = readFilterStyleFromPanel();
                syncFilterStyleLabels();
            }

            syncTitleRow();
            w.update();
            eventBus.emit('widget:styles-changed', { widget: w });
        };

        section.addEventListener('change', (e) => {
            if (!e.target.closest('.filter-widget-settings-section')) return;
            const touchButtonStyle = !!e.target.closest('[data-filter-btn-style]');
            const touchFilterStyle = !!e.target.closest('[data-filter-style]');
            apply({ touchButtonStyle, touchFilterStyle });
        });
        section.addEventListener('input', (e) => {
            if (!e.target) return;
            const touchButtonStyle = !!e.target.closest('[data-filter-btn-style]');
            const touchFilterStyle = !!e.target.closest('[data-filter-style]');
            if (touchFilterStyle) {
                apply({ touchFilterStyle });
            } else if (
                touchButtonStyle ||
                e.target.id === 'filter-widget-title' ||
                e.target.id === 'filter-title-color' ||
                e.target.id === 'filter-title-color-text'
            ) {
                apply({ touchButtonStyle });
            }
        });
        const resetBtn = this.panel.querySelector('#filter-btn-style-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                apply({ resetButtonStyle: true });
            });
        }
        this.wireTitleColorInputs('filter', () => apply({}));
        syncTitleRow();
    }

    setupFilterAppearanceListeners() {
        const host = this.panel?.querySelector('#filter-appearance-fields');
        if (!host || host._filterAppearanceBound) return;
        host._filterAppearanceBound = true;
        host.addEventListener('change', (e) => {
            const sel = e.target?.closest?.('[data-filter-appearance], [data-filter-selection]');
            if (!sel) return;
            const w = this.currentWidget;
            if (!w || w.type !== 'filter' || !Array.isArray(w.settings?.filters)) return;
            const id = sel.getAttribute('data-filter-id');
            const row = w.settings.filters.find((x) => x.id === id);
            if (!row) return;
            if (sel.hasAttribute('data-filter-appearance')) {
                row.appearance = normalizeFilterAppearance(sel.value);
            } else {
                row.selection = normalizeFilterSelection(sel.value);
            }
            w.update();
            eventBus.emit('widget:styles-changed', { widget: w });
            this.syncFilterAppearancePanel(w);
            if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
        });
    }

    syncFilterAppearancePanel(widget) {
        const block = this.panel?.querySelector('#filter-appearance-block');
        const host = this.panel?.querySelector('#filter-appearance-fields');
        if (!block || !host) return;
        const isFilter = widget?.type === 'filter';
        block.style.display = isFilter ? 'block' : 'none';
        if (!isFilter) {
            host.innerHTML = '';
            return;
        }
        const rows = widget.settings?.filters || [];
        if (!rows.length) {
            host.innerHTML = '<div class="filter-appearance-empty">Подключите поля — здесь появится тип отображения каждого фильтра.</div>';
            return;
        }
        const appearanceOpts = FILTER_APPEARANCE_OPTIONS.map(
            (o) => `<option value="${o.id}">${o.label}</option>`,
        ).join('');
        const selectionOpts = FILTER_SELECTION_OPTIONS.map(
            (o) => `<option value="${o.id}">${o.label}</option>`,
        ).join('');
        host.innerHTML = rows
            .map((f) => {
                const id = this._escapeBindingText(f.id);
                const cap = this._escapeBindingText(String(f.displayLabel || f.field || ''));
                const meta = this._escapeBindingText(`${f.table || ''}.${f.field || ''}`);
                const appearance = normalizeFilterAppearance(f.appearance);
                const selection = normalizeFilterSelection(f.selection);
                const hideSel = appearance === 'slider';
                return `
                    <div class="filter-appearance-row" data-filter-id="${id}">
                        <div class="filter-appearance-row-title" title="${meta}">${cap || meta}</div>
                        <div class="filter-appearance-row-controls">
                            <div class="style-control-group">
                                <label class="style-label">Appearance</label>
                                <select class="style-select" data-filter-appearance data-filter-id="${id}">${appearanceOpts}</select>
                            </div>
                            <div class="style-control-group filter-appearance-selection"${hideSel ? ' hidden' : ''}>
                                <label class="style-label">Выбор</label>
                                <select class="style-select" data-filter-selection data-filter-id="${id}">${selectionOpts}</select>
                            </div>
                        </div>
                    </div>`;
            })
            .join('');
        host.querySelectorAll('[data-filter-appearance]').forEach((el) => {
            const row = rows.find((x) => x.id === el.getAttribute('data-filter-id'));
            if (row) el.value = normalizeFilterAppearance(row.appearance);
        });
        host.querySelectorAll('[data-filter-selection]').forEach((el) => {
            const row = rows.find((x) => x.id === el.getAttribute('data-filter-id'));
            if (row) el.value = normalizeFilterSelection(row.selection);
        });
    }

    parseJsonOrFallback(input, fallback = {}) {
        const raw = String(input || '').trim();
        if (!raw) return fallback;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    }

    normalizeButtonActionType(type) {
        return normalizeButtonActionType(type);
    }

    _buttonStyleColorValue(style, key, fallback) {
        const raw = style?.[key];
        if (typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/i.test(raw)) return raw;
        return fallback;
    }

    _buttonStyleColorFormulaSpecs(idx = null) {
        const prefix = idx == null ? 'button-widget-shared' : `button-widget-btn-${idx}`;
        return [
            { styleKey: 'background', id: `${prefix}-bg`, formulaKey: 'backgroundFormula', label: 'Фон' },
            { styleKey: 'color', id: `${prefix}-color`, formulaKey: 'colorFormula', label: 'Текст' },
            { styleKey: 'hoverBackground', id: `${prefix}-hover`, formulaKey: 'hoverBackgroundFormula', label: 'Hover' },
            { styleKey: 'activeBackground', id: `${prefix}-active`, formulaKey: 'activeBackgroundFormula', label: 'Active' },
            { styleKey: 'borderColor', id: `${prefix}-border`, formulaKey: 'borderColorFormula', label: 'Рамка' },
        ];
    }

    _readButtonStyleFormulasFromPanel(idx) {
        const out = {};
        if (!this.panel) return out;
        this._buttonStyleColorFormulaSpecs(idx).forEach(({ id, formulaKey }) => {
            const el = this.panel.querySelector(`#${CSS.escape(`${id}-formula`)}`);
            if (!el) return;
            out[formulaKey] = String(el.value || '').trim();
        });
        return out;
    }

    _flushButtonCustomStyleFormulasToWidget(widget) {
        if (!this.panel || widget?.type !== 'button-widget' || !Array.isArray(widget.settings?.buttons)) return;
        widget.settings.buttons.forEach((btn, i) => {
            if (!btn || typeof btn !== 'object') return;
            const style = { ...(btn.style && typeof btn.style === 'object' ? btn.style : {}), ...this._readButtonStyleFormulasFromPanel(i) };
            btn.style = normalizeButtonStylePartial(style);
        });
    }

    _renderButtonStyleColorControlHtml({ idx, fieldPrefix, styleKey, label, id, value, formula }) {
        const idxAttr = idx != null ? ` data-button-widget-idx="${idx}"` : '';
        return `
                    <div class="style-control-group">
                        <label class="style-label" for="${this._escapeBindingText(id)}">${this._escapeBindingText(label)}</label>
                        <input type="color" class="style-input" id="${this._escapeBindingText(id)}" data-${fieldPrefix}="${styleKey}"${idxAttr} value="${this._escapeBindingText(value)}">
                        ${this.renderColorFormulaFieldHtml({
                            formulaId: `${id}-formula`,
                            applyKey: 'button-widget',
                            value: formula,
                        })}
                    </div>`;
    }

    _renderButtonStyleFieldsHtml({ scope, idx = null, style = {}, open = false } = {}) {
        const s = style && typeof style === 'object' ? style : {};
        const bg = this._buttonStyleColorValue(s, 'background', DEFAULT_BUTTON_STYLE.background);
        const color = this._buttonStyleColorValue(s, 'color', DEFAULT_BUTTON_STYLE.color);
        const hover = this._buttonStyleColorValue(s, 'hoverBackground', DEFAULT_BUTTON_STYLE.hoverBackground);
        const active = this._buttonStyleColorValue(s, 'activeBackground', DEFAULT_BUTTON_STYLE.activeBackground);
        const border = this._buttonStyleColorValue(s, 'borderColor', DEFAULT_BUTTON_STYLE.borderColor);
        const radius = s.borderRadius != null ? Number(s.borderRadius) : DEFAULT_BUTTON_STYLE.borderRadius;
        const fontSize = s.fontSize != null ? Number(s.fontSize) : DEFAULT_BUTTON_STYLE.fontSize;
        const fontWeight = s.fontWeight != null ? String(s.fontWeight) : String(DEFAULT_BUTTON_STYLE.fontWeight);
        const idxAttr = idx != null ? ` data-button-widget-idx="${idx}"` : '';
        const fieldPrefix = scope === 'custom' ? 'button-style' : 'button-shared-style';
        const specs = this._buttonStyleColorFormulaSpecs(idx);
        const byKey = Object.fromEntries(specs.map((x) => [x.styleKey, x]));
        const colorCtrl = (styleKey, value) => {
            const spec = byKey[styleKey];
            return this._renderButtonStyleColorControlHtml({
                idx,
                fieldPrefix,
                styleKey,
                label: spec.label,
                id: spec.id,
                value,
                formula: s[spec.formulaKey] || '',
            });
        };

        return `
            <div class="button-widget-style-fields" ${open ? '' : 'hidden'}>
                <div class="style-input-group">
                    ${colorCtrl('background', bg)}
                    ${colorCtrl('color', color)}
                </div>
                <div class="style-input-group">
                    ${colorCtrl('hoverBackground', hover)}
                    ${colorCtrl('activeBackground', active)}
                </div>
                <div class="style-input-group">
                    ${colorCtrl('borderColor', border)}
                    <div class="style-control-group">
                        <label class="style-label">Скругление</label>
                        <input type="number" class="style-input" data-${fieldPrefix}="borderRadius"${idxAttr} min="0" max="48" value="${Number.isFinite(radius) ? radius : 8}">
                    </div>
                </div>
                <div class="style-input-group">
                    <div class="style-control-group">
                        <label class="style-label">Размер шрифта</label>
                        <input type="number" class="style-input" data-${fieldPrefix}="fontSize"${idxAttr} min="8" max="72" value="${Number.isFinite(fontSize) ? fontSize : 14}">
                    </div>
                    <div class="style-control-group">
                        <label class="style-label">Жирность</label>
                        <select class="style-input" data-${fieldPrefix}="fontWeight"${idxAttr}>
                            <option value="400" ${fontWeight === '400' ? 'selected' : ''}>400</option>
                            <option value="500" ${fontWeight === '500' ? 'selected' : ''}>500</option>
                            <option value="600" ${fontWeight === '600' ? 'selected' : ''}>600</option>
                            <option value="700" ${fontWeight === '700' ? 'selected' : ''}>700</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    syncButtonWidgetSharedStyleFromWidget(widget) {
        if (!this.panel || widget?.type !== 'button-widget') return;
        const shared = {
            ...DEFAULT_BUTTON_STYLE,
            ...(widget.styles?.typography
                ? {
                    fontFamily: widget.styles.typography.fontFamily,
                    fontSize: widget.styles.typography.fontSize,
                    fontWeight: widget.styles.typography.fontWeight,
                    color: widget.styles.typography.color,
                }
                : {}),
            ...(widget.settings?.defaultButtonStyle || {}),
        };
        const setVal = (id, value) => {
            const el = this.panel.querySelector(id);
            if (!el || value == null) return;
            el.value = String(value);
        };
        setVal('#button-widget-shared-bg', this._buttonStyleColorValue(shared, 'background', DEFAULT_BUTTON_STYLE.background));
        setVal('#button-widget-shared-color', this._buttonStyleColorValue(shared, 'color', DEFAULT_BUTTON_STYLE.color));
        setVal('#button-widget-shared-hover', this._buttonStyleColorValue(shared, 'hoverBackground', DEFAULT_BUTTON_STYLE.hoverBackground));
        setVal('#button-widget-shared-active', this._buttonStyleColorValue(shared, 'activeBackground', DEFAULT_BUTTON_STYLE.activeBackground));
        setVal('#button-widget-shared-border', this._buttonStyleColorValue(shared, 'borderColor', DEFAULT_BUTTON_STYLE.borderColor));
        setVal('#button-widget-shared-radius', shared.borderRadius ?? DEFAULT_BUTTON_STYLE.borderRadius);
        setVal('#button-widget-shared-font-size', shared.fontSize ?? DEFAULT_BUTTON_STYLE.fontSize);
        setVal('#button-widget-shared-font-weight', shared.fontWeight ?? DEFAULT_BUTTON_STYLE.fontWeight);
    }

    applyButtonWidgetSharedStyleFromPanel() {
        const w = this.currentWidget;
        if (!w || w.type !== 'button-widget' || !this.panel) return;
        const read = (sel) => this.panel.querySelector(sel)?.value;
        const prev = w.settings.defaultButtonStyle && typeof w.settings.defaultButtonStyle === 'object'
            ? w.settings.defaultButtonStyle
            : {};
        const next = normalizeButtonStylePartial({
            ...prev,
            background: read('#button-widget-shared-bg'),
            color: read('#button-widget-shared-color'),
            hoverBackground: read('#button-widget-shared-hover'),
            activeBackground: read('#button-widget-shared-active'),
            borderColor: read('#button-widget-shared-border'),
            borderRadius: read('#button-widget-shared-radius'),
            fontSize: read('#button-widget-shared-font-size'),
            fontWeight: read('#button-widget-shared-font-weight'),
            ...this._readButtonStyleFormulasFromPanel(null),
        });
        w.settings.defaultButtonStyle = next;
        // Keep typography in sync so section «Типографика» reflects button text style
        if (!w.styles) w.styles = {};
        if (!w.styles.typography) w.styles.typography = {};
        if (next.color) w.styles.typography.color = next.color;
        if (next.fontSize != null) w.styles.typography.fontSize = next.fontSize;
        if (next.fontWeight != null) w.styles.typography.fontWeight = String(next.fontWeight);
        w.update();
        eventBus.emit('widget:settings-changed', { widget: w });
        eventBus.emit('widget:styles-changed', { widget: w });
    }

    _buttonActionTypeLabel(type) {
        const id = this.normalizeButtonActionType(type);
        if (id === 'set_param') return 'Параметр (устарело)';
        return BUTTON_ACTION_TYPES.find((x) => x.id === id)?.label || id;
    }

    _buttonActionTypeHint(type) {
        const id = this.normalizeButtonActionType(type);
        if (id === 'set_param') {
            return 'Действие удалено — выберите другое';
        }
        return BUTTON_ACTION_TYPES.find((x) => x.id === id)?.hint || '';
    }

    async ensureButtonWidgetMetaOptions() {
        const dashboardId = this.engine?.dashboardId;
        if (dashboardId == null || dashboardId === '') {
            this._buttonWidgetSheets = this._buttonWidgetSheets || [];
            this._buttonWidgetModels = this._buttonWidgetModels || [];
            return;
        }
        if (this._buttonWidgetMetaDashboardId !== String(dashboardId)) {
            this._buttonWidgetMetaDashboardId = String(dashboardId);
            this._buttonWidgetSheetsPromise = null;
            this._buttonWidgetModelsPromise = null;
            this._buttonWidgetSheets = [];
            this._buttonWidgetModels = [];
        }
        if (!this._buttonWidgetSheetsPromise) {
            this._buttonWidgetSheetsPromise = sheetService
                .getDashboardSheets(dashboardId)
                .then((data) => {
                    this._buttonWidgetSheets = Array.isArray(data) ? data : data?.sheets || [];
                })
                .catch(() => {
                    this._buttonWidgetSheets = [];
                });
        }
        if (!this._buttonWidgetModelsPromise) {
            this._buttonWidgetModelsPromise = dashboardService
                .getDashboardDataModels(dashboardId)
                .then((data) => {
                    const list = Array.isArray(data) ? data : data?.data_models || data?.data || [];
                    this._buttonWidgetModels = Array.isArray(list) ? list : [];
                })
                .catch(() => {
                    this._buttonWidgetModels = [];
                });
        }
        await Promise.all([this._buttonWidgetSheetsPromise, this._buttonWidgetModelsPromise]);
    }

    _renderButtonActionFieldsHtml(actionType, action, idx) {
        const target = action.target != null ? String(action.target) : '';
        const payload = action.payload && typeof action.payload === 'object' ? action.payload : {};
        const payloadStr = JSON.stringify(payload, null, 2);
        const hint = this._buttonActionTypeHint(actionType);
        const sheets = Array.isArray(this._buttonWidgetSheets) ? this._buttonWidgetSheets : [];
        const models = Array.isArray(this._buttonWidgetModels) ? this._buttonWidgetModels : [];

        const actionOptions = [
            ...(actionType === 'set_param'
                ? [
                      `<option value="set_param" selected>${this._escapeBindingText(
                          'Параметр (устарело — выберите другое)',
                      )}</option>`,
                  ]
                : []),
            ...BUTTON_ACTION_TYPES.map(
                (opt) =>
                    `<option value="${opt.id}" ${actionType === opt.id ? 'selected' : ''}>${this._escapeBindingText(opt.label)}</option>`,
            ),
        ].join('');

        let contextual = '';
        if (actionType === 'navigate') {
            const sheetOptions = [
                `<option value="" ${!target ? 'selected' : ''}>Выберите лист…</option>`,
                ...sheets.map((sheet) => {
                    const sid = String(sheet.id);
                    const name = sheet.name || sheet.title || `Лист ${sid}`;
                    return `<option value="${this._escapeBindingText(sid)}" ${target === sid ? 'selected' : ''}>${this._escapeBindingText(name)}</option>`;
                }),
            ];
            if (target && !sheets.some((s) => String(s.id) === target)) {
                sheetOptions.push(
                    `<option value="${this._escapeBindingText(target)}" selected>Лист ${this._escapeBindingText(target)}</option>`,
                );
            }
            contextual = `
                <div class="style-control-group">
                    <label class="style-label">Лист</label>
                    <select class="style-input" data-button-widget-field="action-target" data-button-widget-idx="${idx}">
                        ${sheetOptions.join('')}
                    </select>
                </div>
            `;
        } else if (actionType === 'link') {
            const url = (payload.url != null && String(payload.url).trim())
                ? String(payload.url)
                : (target && target !== 'global' && target !== 'all' ? target : '');
            contextual = `
                <div class="style-control-group">
                    <label class="style-label">URL</label>
                    <input type="text" class="style-input" data-button-widget-field="link-url" data-button-widget-idx="${idx}" value="${this._escapeBindingText(url)}" placeholder="https://example.com" autocomplete="off" spellcheck="false">
                </div>
                <div class="button-widget-field-hint">По нажатию откроется новая вкладка с этой страницей.</div>
            `;
        } else if (actionType === 'reload') {
            contextual = `
                <div class="button-widget-action-note">
                    По нажатию обновит данные всех виджетов дашборда (как кнопка обновления в панели).
                </div>
            `;
        } else if (actionType === 'hard_reload') {
            const modelId = payload.modelId != null ? String(payload.modelId) : target === 'all' || target === 'global' || !target ? '' : target;
            const modelOptions = [
                `<option value="" ${!modelId ? 'selected' : ''}>Все модели дашборда</option>`,
                ...models.map((model) => {
                    const mid = String(model.id ?? model.model_id ?? '');
                    const name = model.name || model.title || `Модель ${mid}`;
                    return `<option value="${this._escapeBindingText(mid)}" ${modelId === mid ? 'selected' : ''}>${this._escapeBindingText(name)} (#${this._escapeBindingText(mid)})</option>`;
                }),
            ];
            if (modelId && !models.some((m) => String(m.id ?? m.model_id) === modelId)) {
                modelOptions.push(
                    `<option value="${this._escapeBindingText(modelId)}" selected>Модель #${this._escapeBindingText(modelId)}</option>`,
                );
            }
            contextual = `
                <div class="style-control-group">
                    <label class="style-label">Модель данных</label>
                    <select class="style-input" data-button-widget-field="hard-reload-model" data-button-widget-idx="${idx}">
                        ${modelOptions.join('')}
                    </select>
                </div>
                <div class="button-widget-action-note">
                    Запустит сборку модели с окном прогресса. После успешной сборки обновит данные на дашборде.
                </div>
            `;
        } else if (actionType === 'filter') {
            const fieldRaw = payload.field != null ? String(payload.field) : '';
            const tableRaw = payload.table != null ? String(payload.table) : '';
            const field =
                tableRaw && fieldRaw && !fieldRaw.includes('.')
                    ? `${tableRaw}.${fieldRaw}`
                    : fieldRaw;
            const value = payload.value != null
                ? String(payload.value)
                : Array.isArray(payload.values)
                    ? payload.values.join(', ')
                    : '';
            contextual = `
                <div class="style-control-group">
                    <label class="style-label">Поле фильтра</label>
                    <input type="text" class="style-input" data-button-widget-field="filter-field" data-button-widget-idx="${idx}" value="${this._escapeBindingText(field)}" placeholder="employees.name или name" autocomplete="off">
                </div>
                <div class="button-widget-field-hint">Перетащите колонку с вкладки «Данные» на виджет — подставятся модель и таблица. В редакторе включите «Клики в редакторе».</div>
                <div class="style-control-group">
                    <label class="style-label">Значение</label>
                    <input type="text" class="style-input" data-button-widget-field="filter-value" data-button-widget-idx="${idx}" value="${this._escapeBindingText(value)}" placeholder="одно значение или через запятую" autocomplete="off">
                </div>
            `;
        } else if (actionType === 'set_param') {
            contextual = `
                <div class="button-widget-action-note">
                    Действие «Параметр» больше недоступно. Выберите другое действие в списке выше.
                </div>
            `;
        } else if (actionType === 'set_variable') {
            const key = payload.key != null ? String(payload.key) : '';
            const value = payload.value != null ? String(payload.value) : '';
            const catalog =
                typeof this.engine?.getModelVariableCatalog === 'function'
                    ? this.engine.getModelVariableCatalog()
                    : [];
            const known = new Set((catalog || []).map((v) => String(v.name)));
            const varOptions = [
                `<option value="" ${!key ? 'selected' : ''}>Выберите переменную…</option>`,
                ...(catalog || []).map((v) => {
                    const src = v.source === 'dashboard' ? 'дашборд' : 'модель';
                    const label = `@${v.name} · ${v.type || 'Number'} · ${src}`;
                    return `<option value="${this._escapeBindingText(v.name)}" ${
                        key === v.name ? 'selected' : ''
                    }>${this._escapeBindingText(label)}</option>`;
                }),
            ];
            if (key && !known.has(key)) {
                varOptions.push(
                    `<option value="${this._escapeBindingText(key)}" selected>${this._escapeBindingText(
                        `@${key} (нет в каталоге)`,
                    )}</option>`,
                );
            }
            contextual = `
                <div class="style-control-group">
                    <label class="style-label">Переменная</label>
                    <select class="style-input" data-button-widget-field="var-key" data-button-widget-idx="${idx}">
                        ${varOptions.join('')}
                    </select>
                </div>
                <div class="style-control-group">
                    <label class="style-label">Значение</label>
                    <input type="text" class="style-input" data-button-widget-field="var-value" data-button-widget-idx="${idx}" value="${this._escapeBindingText(value)}" placeholder="0" autocomplete="off">
                </div>
                <div class="button-widget-field-hint">${
                    key
                        ? `В формулах: @${this._escapeBindingText(key)}`
                        : 'Список из панели «Данные → Переменные» (модель + дашборд).'
                }</div>
            `;
        } else if (actionType === 'custom') {
            const handler = payload.handler || payload.name || (target !== 'global' ? target : '');
            contextual = `
                <div class="style-control-group">
                    <label class="style-label">Имя обработчика</label>
                    <input type="text" class="style-input" data-button-widget-field="custom-handler" data-button-widget-idx="${idx}" value="${this._escapeBindingText(String(handler || ''))}" placeholder="myHandler" autocomplete="off">
                </div>
            `;
        }

        const showAdvanced = true;
        return `
            <div class="style-control-group">
                <label class="style-label">Действие</label>
                <select class="style-input" data-button-widget-field="action-type" data-button-widget-idx="${idx}">
                    ${actionOptions}
                </select>
                ${hint ? `<div class="button-widget-field-hint">${this._escapeBindingText(hint)}</div>` : ''}
            </div>
            ${contextual}
            ${
                showAdvanced
                    ? `
                <details class="button-widget-advanced">
                    <summary>Дополнительно (JSON)</summary>
                    <div class="style-control-group" style="margin-top:0.45rem;">
                        <div class="button-widget-payload-header flex-between">
                            <label class="style-label">Payload</label>
                            <button
                                type="button"
                                class="btn btn-secondary button-widget-payload-help-btn"
                                data-button-payload-help="${idx}"
                                data-button-payload-help-type="${this._escapeBindingText(actionType)}"
                                title="Примеры payload"
                            >Примеры</button>
                        </div>
                        <textarea class="style-input" data-button-widget-field="action-payload" data-button-widget-idx="${idx}" rows="3" style="resize:vertical;font-family:monospace;">${this._escapeBindingText(payloadStr)}</textarea>
                    </div>
                </details>
            `
                    : ''
            }
        `;
    }

    _ensureButtonPayloadHelpModal() {
        let modal = this._buttonPayloadHelpModalEl;
        if (modal && modal.isConnected) return modal;
        modal = document.getElementById('button-payload-help-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'button-payload-help-modal';
            modal.className = 'button-payload-help-modal';
            modal.hidden = true;
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'button-payload-help-title');
            modal.innerHTML = `
                <div class="button-payload-help-modal__backdrop" data-payload-help-close></div>
                <div class="button-payload-help-modal__card">
                    <div class="button-payload-help-modal__header">
                        <h3 id="button-payload-help-title">Примеры Payload</h3>
                        <button type="button" class="button-payload-help-modal__close" data-payload-help-close aria-label="Закрыть">×</button>
                    </div>
                    <p class="button-payload-help-modal__intro" data-payload-help-intro></p>
                    <div class="button-payload-help-modal__tabs" data-payload-help-tabs></div>
                    <div class="button-payload-help-modal__body" data-payload-help-body></div>
                    <div class="button-payload-help-modal__footer">
                        <button type="button" class="btn btn-secondary" data-payload-help-close>Закрыть</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => {
                if (e.target.closest('[data-payload-help-close]')) {
                    this.closeButtonPayloadHelpModal();
                    return;
                }
                const tabBtn = e.target.closest('[data-payload-help-tab]');
                if (tabBtn) {
                    const type = tabBtn.getAttribute('data-payload-help-tab');
                    this._renderButtonPayloadHelpBody(type);
                    return;
                }
                const useBtn = e.target.closest('[data-payload-help-use]');
                if (useBtn) {
                    e.preventDefault();
                    const exampleIdx = parseInt(useBtn.getAttribute('data-payload-help-use'), 10);
                    const type = useBtn.getAttribute('data-payload-help-type') || '';
                    this._applyButtonPayloadExample(type, exampleIdx);
                }
            });
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeButtonPayloadHelpModal();
            });
        }
        this._buttonPayloadHelpModalEl = modal;
        return modal;
    }

    _renderButtonPayloadHelpBody(actionType) {
        const modal = this._ensureButtonPayloadHelpModal();
        const type = this.normalizeButtonActionType(actionType);
        const section = getButtonPayloadExamplesForType(type) || BUTTON_PAYLOAD_EXAMPLES[0];
        const intro = modal.querySelector('[data-payload-help-intro]');
        const tabs = modal.querySelector('[data-payload-help-tabs]');
        const body = modal.querySelector('[data-payload-help-body]');
        if (intro) {
            intro.textContent = section.description || '';
        }
        if (tabs) {
            tabs.innerHTML = BUTTON_PAYLOAD_EXAMPLES.map((item) => {
                const active = item.actionType === section.actionType ? ' is-active' : '';
                return `<button type="button" class="button-payload-help-tab${active}" data-payload-help-tab="${item.actionType}">${this._escapeBindingText(item.title)}</button>`;
            }).join('');
        }
        if (body) {
            body.innerHTML = (section.examples || [])
                .map((ex, i) => {
                    const jsonStr = JSON.stringify(ex.json ?? {}, null, 2);
                    return `
                        <article class="button-payload-help-example">
                            <div class="button-payload-help-example__head flex-between">
                                <strong>${this._escapeBindingText(ex.label || `Пример ${i + 1}`)}</strong>
                                <button
                                    type="button"
                                    class="btn btn-secondary"
                                    data-payload-help-use="${i}"
                                    data-payload-help-type="${this._escapeBindingText(section.actionType)}"
                                    style="padding:0.2rem 0.5rem;min-height:unset;"
                                >Вставить</button>
                            </div>
                            <p class="button-payload-help-example__how">${this._escapeBindingText(ex.how || '')}</p>
                            <pre class="button-payload-help-example__code"><code>${this._escapeBindingText(jsonStr)}</code></pre>
                        </article>
                    `;
                })
                .join('');
        }
        this._buttonPayloadHelpType = section.actionType;
        const title = modal.querySelector('#button-payload-help-title');
        if (title) title.textContent = `Примеры: ${section.title}`;
    }

    openButtonPayloadHelpModal({ idx = null, actionType = 'custom' } = {}) {
        const modal = this._ensureButtonPayloadHelpModal();
        this._buttonPayloadHelpIdx = idx;
        this._renderButtonPayloadHelpBody(actionType);
        modal.hidden = false;
        modal.classList.add('is-open');
        const closeBtn = modal.querySelector('.button-payload-help-modal__close');
        closeBtn?.focus?.();
    }

    closeButtonPayloadHelpModal() {
        const modal = this._buttonPayloadHelpModalEl || document.getElementById('button-payload-help-modal');
        if (!modal) return;
        modal.hidden = true;
        modal.classList.remove('is-open');
        this._buttonPayloadHelpIdx = null;
    }

    _applyButtonPayloadExample(actionType, exampleIdx) {
        const section = getButtonPayloadExamplesForType(actionType);
        const example = section?.examples?.[exampleIdx];
        if (!example) return;
        const idx = this._buttonPayloadHelpIdx;
        const w = this.currentWidget;
        if (w?.type === 'button-widget' && Array.isArray(w.settings?.buttons) && Number.isFinite(idx)) {
            const btn = w.settings.buttons[idx] || {};
            if (!btn.action || typeof btn.action !== 'object') {
                btn.action = { type: actionType, target: 'global', payload: {} };
            }
            btn.action.type = this.normalizeButtonActionType(actionType);
            btn.action.payload = { ...(example.json && typeof example.json === 'object' ? example.json : {}) };
            if (btn.action.type === 'custom' && btn.action.payload.handler) {
                btn.action.target = String(btn.action.payload.handler);
            }
            if (btn.action.type === 'hard_reload' && btn.action.payload.modelId != null) {
                btn.action.target = String(btn.action.payload.modelId);
            }
            if (btn.action.type === 'link' && btn.action.payload.url) {
                btn.action.target = String(btn.action.payload.url);
            }
            w.settings.buttons[idx] = btn;
            w.update();
            eventBus.emit('widget:settings-changed', { widget: w });
            eventBus.emit('widget:styles-changed', { widget: w });
            this.closeButtonPayloadHelpModal();
            this.renderButtonWidgetSettingsList(w);
            return;
        }
        // Fallback: fill focused/open textarea if present
        const ta = this.panel?.querySelector(
            `textarea[data-button-widget-field="action-payload"][data-button-widget-idx="${idx}"]`,
        );
        if (ta) {
            ta.value = JSON.stringify(example.json ?? {}, null, 2);
            ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
        this.closeButtonPayloadHelpModal();
    }

    closeButtonWidgetIconPicker() {
        const menu = this._buttonIconMenuEl || document.getElementById('button-widget-icon-menu');
        if (menu) {
            menu.hidden = true;
            menu.classList.remove('is-open');
        }
        this.panel?.querySelectorAll('.button-widget-icon-trigger[aria-expanded="true"]').forEach((el) => {
            el.setAttribute('aria-expanded', 'false');
        });
        this._buttonIconPicker = null;
        if (this._buttonIconPickerOutsideHandler) {
            document.removeEventListener('mousedown', this._buttonIconPickerOutsideHandler, true);
            this._buttonIconPickerOutsideHandler = null;
        }
    }

    _getButtonIconPickerPageCount() {
        const pageSize = 12;
        return Math.max(1, Math.ceil(BUTTON_ICON_OPTIONS.length / pageSize));
    }

    renderButtonWidgetIconPickerPage() {
        const menu = this._ensureButtonWidgetIconMenu();
        const state = this._buttonIconPicker;
        if (!menu || !state) return;

        const pageSize = 12;
        const pageCount = this._getButtonIconPickerPageCount();
        const page = Math.max(0, Math.min(state.page, pageCount - 1));
        state.page = page;

        const start = page * pageSize;
        const slice = BUTTON_ICON_OPTIONS.slice(start, start + pageSize);
        const currentId = state.currentId == null ? '' : String(state.currentId);
        const grid = menu.querySelector('[data-button-icon-grid]');
        if (grid) {
            grid.innerHTML = slice
                .map((opt) => {
                    const selected = opt.id === currentId || (!currentId && !opt.id);
                    const svg = opt.svg || (opt.id ? getButtonIconSvg(opt.id, { size: 18 }) : getButtonIconNoneSvg({ size: 18 }));
                    return `
                        <button
                            type="button"
                            class="button-widget-icon-option${selected ? ' is-selected' : ''}"
                            role="menuitemradio"
                            aria-checked="${selected ? 'true' : 'false'}"
                            data-button-icon-id="${this._escapeBindingText(opt.id)}"
                            title="${this._escapeBindingText(opt.label)}"
                        >
                            <span class="button-widget-icon-option__glyph" aria-hidden="true">${svg}</span>
                            <span class="button-widget-icon-option__label">${this._escapeBindingText(opt.label)}</span>
                        </button>
                    `;
                })
                .join('');
        }

        const labelEl = menu.querySelector('[data-button-icon-page-label]');
        if (labelEl) labelEl.textContent = `${page + 1} / ${pageCount}`;

        const prevBtn = menu.querySelector('[data-button-icon-page="prev"]');
        const nextBtn = menu.querySelector('[data-button-icon-page="next"]');
        if (prevBtn) prevBtn.disabled = page <= 0;
        if (nextBtn) nextBtn.disabled = page >= pageCount - 1;
    }

    openButtonWidgetIconPicker(triggerEl, idx) {
        if (!this.panel || !triggerEl) return;
        const menu = this._ensureButtonWidgetIconMenu();
        if (!menu) return;

        const currentId = String(triggerEl.getAttribute('data-button-widget-icon-value') || '');
        const pageSize = 12;
        let page = 0;
        const foundIdx = BUTTON_ICON_OPTIONS.findIndex((opt) => opt.id === currentId);
        if (foundIdx >= 0) page = Math.floor(foundIdx / pageSize);

        this.closeKpiCurrencyPicker?.();
        this.closeButtonWidgetIconPicker();
        this._buttonIconPicker = { idx, currentId, page };

        this.renderButtonWidgetIconPickerPage();
        menu.hidden = false;
        menu.classList.add('is-open');
        triggerEl.setAttribute('aria-expanded', 'true');

        const triggerRect = triggerEl.getBoundingClientRect();
        const panelRect = this.panel.getBoundingClientRect();
        const menuWidth = Math.min(280, Math.max(220, triggerRect.width));
        let left = triggerRect.left;
        let top = triggerRect.bottom + 6;
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

        menu.style.width = `${menuWidth}px`;
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;

        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            if (menuRect.bottom > window.innerHeight - 8) {
                const aboveTop = triggerRect.top - menuRect.height - 6;
                if (aboveTop >= 8) {
                    menu.style.top = `${aboveTop}px`;
                }
            }
            if (menuRect.right > panelRect.right - 4) {
                menu.style.left = `${Math.max(8, panelRect.right - menuWidth - 8)}px`;
            }
        });

        this._buttonIconPickerOutsideHandler = (evt) => {
            if (menu.contains(evt.target) || triggerEl.contains(evt.target)) return;
            this.closeButtonWidgetIconPicker();
        };
        setTimeout(() => {
            if (this._buttonIconPickerOutsideHandler) {
                document.addEventListener('mousedown', this._buttonIconPickerOutsideHandler, true);
            }
        }, 0);
    }

    toggleButtonWidgetIconPicker(triggerEl, idx) {
        const open = this._buttonIconPicker && this._buttonIconPicker.idx === idx;
        if (open) {
            this.closeButtonWidgetIconPicker();
            return;
        }
        this.openButtonWidgetIconPicker(triggerEl, idx);
    }

    renderButtonWidgetSettingsList(widget) {
        this.closeButtonWidgetIconPicker();
        this._flushButtonCustomStyleFormulasToWidget(widget);
        const list = this.panel?.querySelector('#button-widget-buttons-list');
        if (!list || !widget || widget.type !== 'button-widget') return;
        const buttons = Array.isArray(widget.settings?.buttons) ? widget.settings.buttons : [];
        if (buttons.length === 0) {
            list.innerHTML = '<div class="tabs-empty-message">Кнопки не добавлены</div>';
            return;
        }

        if (!(this._buttonWidgetCollapsedIds instanceof Set)) {
            this._buttonWidgetCollapsedIds = new Set();
        }

        const render = () => {
            list.innerHTML = buttons
                .map((btn, idx) => {
                    const action = btn?.action && typeof btn.action === 'object' ? btn.action : {};
                    const actionType = this.normalizeButtonActionType(action.type);
                    const target = action.target != null ? String(action.target) : '';
                    const id = btn?.id != null ? String(btn.id) : `btn_${idx + 1}`;
                    const label = btn?.label != null ? String(btn.label) : `Button ${idx + 1}`;
                    const icon = btn?.icon != null ? String(btn.icon) : '';
                    const iconSvg = icon ? getButtonIconSvg(icon, { size: 16 }) : getButtonIconNoneSvg({ size: 16 });
                    const iconLabel = getButtonIconLabel(icon);
                    const collapsed = this._buttonWidgetCollapsedIds.has(id);
                    const actionLabel = this._buttonActionTypeLabel(actionType);
                    const useCustomStyle = btn?.useCustomStyle === true;
                    const buttonStyle = btn?.style && typeof btn.style === 'object' ? btn.style : {};
                    const summary = [label, actionLabel, actionType === 'navigate' || actionType === 'link' ? target : '']
                        .filter(Boolean)
                        .join(' · ');
                    return `
                        <div class="style-control-group button-widget-row${collapsed ? ' is-collapsed' : ''}" data-button-widget-row="${idx}" data-button-widget-id="${this._escapeBindingText(id)}">
                            <div class="button-widget-row-header flex-between">
                                <div class="button-widget-row-title">
                                    <button
                                        type="button"
                                        class="button-widget-row-toggle"
                                        data-button-widget-toggle="${idx}"
                                        data-button-widget-toggle-id="${this._escapeBindingText(id)}"
                                        aria-expanded="${collapsed ? 'false' : 'true'}"
                                        title="${collapsed ? 'Развернуть' : 'Свернуть'}"
                                    >
                                        <span class="button-widget-row-chevron" aria-hidden="true">${collapsed ? '▶' : '▼'}</span>
                                        <span>Кнопка #${idx + 1}</span>
                                    </button>
                                    ${collapsed ? `<span class="button-widget-row-summary">${this._escapeBindingText(summary)}</span>` : ''}
                                </div>
                                <button type="button" class="btn btn-secondary" data-button-widget-remove="${idx}" style="padding:0.2rem 0.45rem;min-height:unset;">Удалить</button>
                            </div>
                            <div class="button-widget-row-body" style="display:${collapsed ? 'none' : 'block'};">
                                <div class="style-control-group">
                                    <label class="style-label">Текст на кнопке</label>
                                    <input type="text" class="style-input" data-button-widget-field="label" data-button-widget-idx="${idx}" value="${this._escapeBindingText(label)}" autocomplete="off">
                                </div>
                                <div class="style-control-group">
                                    <label class="style-label">Иконка</label>
                                    <button
                                        type="button"
                                        class="button-widget-icon-trigger"
                                        data-button-widget-icon-picker="${idx}"
                                        data-button-widget-icon-value="${this._escapeBindingText(icon)}"
                                        aria-haspopup="menu"
                                        aria-expanded="false"
                                        title="Выбрать иконку"
                                    >
                                        <span class="button-widget-icon-trigger__glyph" aria-hidden="true">${iconSvg}</span>
                                        <span class="button-widget-icon-trigger__label">${this._escapeBindingText(iconLabel)}</span>
                                        <span class="button-widget-icon-trigger__chevron" aria-hidden="true">▼</span>
                                    </button>
                                </div>
                                <div class="style-control-group">
                                    <div class="flex-between">
                                        <label class="style-label" for="button-widget-custom-style-${idx}">Свой стиль</label>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="button-widget-custom-style-${idx}" data-button-widget-field="use-custom-style" data-button-widget-idx="${idx}" ${useCustomStyle ? 'checked' : ''}>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                    <div class="button-widget-field-hint">Если выключено — берутся общие стили и типографика виджета</div>
                                </div>
                                ${this._renderButtonStyleFieldsHtml({
                                    scope: 'custom',
                                    idx,
                                    style: buttonStyle,
                                    open: useCustomStyle,
                                })}
                                ${this._renderButtonActionFieldsHtml(actionType, action, idx)}
                            </div>
                        </div>
                    `;
                })
                .join('');
        };

        render();
        this.ensureButtonWidgetMetaOptions().then(() => {
            if (this.currentWidget === widget || this.currentWidget?.id === widget?.id) {
                render();
            }
        });
    }

    applyButtonWidgetPanelSettings() {
        const w = this.currentWidget;
        if (!w || w.type !== 'button-widget' || !w.settings) return;
        this.applyWidgetTitleSettingsFromPanel(w, 'button-widget', {
            defaultTitle: 'Кнопки',
        });
        const direction = this.panel.querySelector('#button-widget-layout-direction')?.value || 'row';
        const wrap = !!this.panel.querySelector('#button-widget-layout-wrap')?.checked;
        const interactive = !!this.panel.querySelector('#button-widget-interactive-editor')?.checked;
        if (!w.settings.layout || typeof w.settings.layout !== 'object') w.settings.layout = {};
        w.settings.layout.direction = direction === 'column' ? 'column' : 'row';
        w.settings.layout.wrap = wrap;
        w.settings.interactiveInEditor = interactive;
        w.update();
        eventBus.emit('widget:settings-changed', { widget: w });
        eventBus.emit('widget:styles-changed', { widget: w });
    }

    setupDataInputWidgetSettingsListeners() {
        const section = this.panel.querySelector('.data-input-settings-section');
        if (!section || section._dataInputPanelBound) return;
        section._dataInputPanelBound = true;

        const applyNow = () => this.applyDataInputPanelSettings();

        section.addEventListener('input', (e) => {
            const t = e.target;
            if (!t) return;
            if (t.closest('#data-input-fields-list') || t.closest('#data-input-roles-list')) {
                applyNow();
                if (t.matches('[data-di-field="name"], [data-di-field="type"], [data-di-field="isPrimaryKey"], [data-di-field="optionsSource"]')) {
                    this.renderDataInputFieldsEditor(this._readDataInputFieldsFromPanel(), {
                        preserveCollapse: true,
                    });
                }
                return;
            }
            applyNow();
        });
        section.addEventListener('change', (e) => {
            const t = e.target;
            if (!t) return;
            if (t.id === 'data-input-model-id') {
                const modelId = String(t.value || '').trim();
                const prevTable = String(this.panel.querySelector('#data-input-table')?.value || '').trim();
                this.populateDataInputTableSelect(modelId, prevTable);
                applyNow();
                this.renderDataInputFieldsEditor(this._readDataInputFieldsFromPanel(), {
                    preserveCollapse: true,
                });
                return;
            }
            if (t.id === 'data-input-table') {
                applyNow();
                this.renderDataInputFieldsEditor(this._readDataInputFieldsFromPanel(), {
                    preserveCollapse: true,
                });
                return;
            }
            if (t.id === 'data-input-role-select') {
                const role = String(t.value || '').trim();
                if (role) {
                    const roles = this._readDataInputRolesFromPanel();
                    if (!roles.includes(role)) roles.push(role);
                    this.renderDataInputRolesEditor(roles);
                    this._hideDataInputRolePicker();
                    applyNow();
                }
                return;
            }
            if (t.closest('#data-input-fields-list')) {
                if (t.matches('[data-di-field="name"]')) {
                    this._maybeAutofillDataInputFieldFromColumn(t);
                }
                applyNow();
                if (t.matches('[data-di-field="name"], [data-di-field="type"], [data-di-field="isPrimaryKey"], [data-di-field="optionsSource"]')) {
                    this.renderDataInputFieldsEditor(this._readDataInputFieldsFromPanel(), {
                        preserveCollapse: true,
                    });
                }
                return;
            }
            applyNow();
        });
        this.wireTitleColorInputs('data-input', applyNow);

        section.addEventListener('click', (e) => {
            const t = e.target;
            if (!(t instanceof Element)) return;

            if (t.closest('#data-input-role-add')) {
                e.preventDefault();
                this._showDataInputRolePicker();
                return;
            }
            const roleRemove = t.closest('[data-di-role-remove]');
            if (roleRemove) {
                e.preventDefault();
                const role = String(roleRemove.getAttribute('data-di-role-remove') || '');
                const roles = this._readDataInputRolesFromPanel().filter((r) => r !== role);
                this.renderDataInputRolesEditor(
                    roles.length ? roles : [...DEFAULT_DATA_INPUT_INSERT_ROLES],
                );
                this._hideDataInputRolePicker();
                applyNow();
                return;
            }

            if (t.closest('#data-input-field-add')) {
                e.preventDefault();
                const fields = this._readDataInputFieldsFromPanel();
                const cols = this._getDataInputTableColumnNames();
                const used = new Set(fields.map((f) => String(f.name || '').trim()).filter(Boolean));
                const nextCol = cols.find((c) => !used.has(c));
                fields.push(
                    normalizeFieldDef(
                        {
                            name: nextCol || '',
                            type: 'text',
                            label: nextCol || '',
                            required: false,
                        },
                        fields.length,
                    ),
                );
                this.renderDataInputFieldsEditor(fields, { expandIndex: fields.length - 1 });
                applyNow();
                return;
            }

            const fieldRemove = t.closest('[data-di-field-remove]');
            if (fieldRemove) {
                e.preventDefault();
                const idx = parseInt(fieldRemove.getAttribute('data-di-field-remove'), 10);
                if (!Number.isFinite(idx)) return;
                const fields = this._readDataInputFieldsFromPanel();
                fields.splice(idx, 1);
                this.renderDataInputFieldsEditor(fields);
                applyNow();
                return;
            }

            const fieldToggle = t.closest('[data-di-field-toggle]');
            if (fieldToggle) {
                e.preventDefault();
                const row = fieldToggle.closest('[data-di-field-row]');
                if (!row) return;
                row.classList.toggle('is-collapsed');
                const chevron = fieldToggle.querySelector('.data-input-field-row-chevron');
                if (chevron) chevron.textContent = row.classList.contains('is-collapsed') ? '▶' : '▼';
            }
        });

        const genBtn = section.querySelector('#data-input-generate-fields');
        if (genBtn) {
            genBtn.addEventListener('click', async () => {
                const w = this.currentWidget;
                if (!w || w.type !== 'data_input') return;
                const modelId = parseInt(this.panel.querySelector('#data-input-model-id')?.value, 10);
                const table = String(this.panel.querySelector('#data-input-table')?.value || '').trim();
                if (!modelId || !table) {
                    this._setDataInputGenerateStatus('Выберите модель и таблицу.', 'error');
                    return;
                }
                try {
                    const dashboardId = this.engine?.dashboardId;
                    if (!dashboardId) {
                        this._setDataInputGenerateStatus('Сохраните дашборд, чтобы загрузить схему модели.', 'error');
                        return;
                    }
                    genBtn.disabled = true;
                    this._setDataInputGenerateStatus('Загрузка схемы…', 'info');
                    const schemaRes = await this.ensureDataInputSchema(dashboardId);
                    const rawSchema =
                        schemaRes.rawByModelId.get(modelId) ||
                        schemaRes.rawByModelId.get(String(modelId)) ||
                        schemaRes.rawByModelId.get(Number(modelId));
                    const tables = rawSchema?.tables || [];
                    const tbl = tables.find((t) => t.name === table);
                    if (!tbl?.columns?.length) {
                        this._setDataInputGenerateStatus(
                            `Таблица «${table}» не найдена в выбранной модели.`,
                            'error',
                        );
                        return;
                    }
                    const fields = tbl.columns
                        .map(createDataInputFieldFromColumn)
                        .filter(Boolean)
                        .map((f, i) => normalizeFieldDef(f, i));
                    this.renderDataInputFieldsEditor(fields);
                    applyNow();
                    this._setDataInputGenerateStatus(
                        `Готово: ${fields.length} пол${fields.length === 1 ? 'е' : fields.length < 5 ? 'я' : 'ей'} из «${table}».`,
                        'ok',
                    );
                } catch (err) {
                    console.warn('generate fields from schema', err);
                    this._setDataInputGenerateStatus(
                        err?.message ? String(err.message) : 'Не удалось загрузить схему.',
                        'error',
                    );
                } finally {
                    genBtn.disabled = false;
                }
            });
        }
    }

    /**
     * @returns {string[]}
     */
    _readDataInputRolesFromPanel() {
        const list = this.panel?.querySelector('#data-input-roles-list');
        if (!list) return [];
        return migrateInsertRoles(
            [...list.querySelectorAll('[data-di-role]')]
                .map((el) => String(el.getAttribute('data-di-role') || '').trim())
                .filter(Boolean),
        );
    }

    /**
     * @param {string[]} roles
     */
    renderDataInputRolesEditor(roles) {
        const list = this.panel?.querySelector('#data-input-roles-list');
        if (!list) return;
        const normalized = migrateInsertRoles(roles);
        if (!normalized.length) {
            list.innerHTML = '<div class="data-input-roles-empty">Роли не заданы — нажмите «Добавить».</div>';
            return;
        }
        list.innerHTML = normalized
            .map(
                (role) => `
            <div class="data-input-role-row" data-di-role="${this._escapeBindingText(role)}" role="listitem">
                <span class="data-input-role-name">${this._escapeBindingText(role)}</span>
                <button type="button" class="data-input-role-remove" data-di-role-remove="${this._escapeBindingText(role)}" title="Убрать роль" aria-label="Убрать ${this._escapeBindingText(role)}">×</button>
            </div>`,
            )
            .join('');
    }

    _showDataInputRolePicker() {
        const picker = this.panel?.querySelector('#data-input-role-picker');
        const sel = this.panel?.querySelector('#data-input-role-select');
        if (!picker || !sel) return;
        const used = new Set(this._readDataInputRolesFromPanel());
        const available = DATA_INPUT_INSERT_ROLE_OPTIONS.filter((r) => !used.has(r.id));
        if (!available.length) {
            sel.innerHTML = '<option value="">Все роли уже добавлены</option>';
            sel.disabled = true;
            picker.hidden = false;
            return;
        }
        sel.disabled = false;
        sel.innerHTML =
            '<option value="">Выберите роль…</option>' +
            available
                .map(
                    (r) =>
                        `<option value="${this._escapeBindingText(r.id)}">${this._escapeBindingText(r.label)}</option>`,
                )
                .join('');
        picker.hidden = false;
        sel.focus();
    }

    _hideDataInputRolePicker() {
        const picker = this.panel?.querySelector('#data-input-role-picker');
        const sel = this.panel?.querySelector('#data-input-role-select');
        if (picker) picker.hidden = true;
        if (sel) {
            sel.value = '';
            sel.disabled = false;
        }
    }

    /**
     * @returns {string[]} имена колонок текущей таблицы
     */
    _getDataInputTableColumnNames() {
        const modelId = String(this.panel?.querySelector('#data-input-model-id')?.value || '').trim();
        const table = String(this.panel?.querySelector('#data-input-table')?.value || '').trim();
        if (!modelId || !table || !this._dataInputSchema) return [];

        const fromFlat = (this._dataInputSchema.fields || [])
            .filter((f) => String(f.modelId) === modelId && String(f.tableName) === table)
            .map((f) => f.name)
            .filter(Boolean);
        if (fromFlat.length) return [...new Set(fromFlat)];

        const raw =
            this._dataInputSchema.rawByModelId?.get(Number(modelId)) ||
            this._dataInputSchema.rawByModelId?.get(modelId);
        const tbl = (raw?.tables || []).find((t) => t?.name === table);
        return (tbl?.columns || [])
            .map((c) => c?.name)
            .filter((n) => n && !String(n).startsWith('__'));
    }

    /**
     * При выборе колонки — подставить тип/подпись из схемы, если поле ещё пустое.
     * @param {HTMLElement} nameEl
     */
    _maybeAutofillDataInputFieldFromColumn(nameEl) {
        const row = nameEl?.closest?.('[data-di-field-row]');
        if (!row) return;
        const name = String(nameEl.value || '').trim();
        if (!name) return;
        const modelId = String(this.panel?.querySelector('#data-input-model-id')?.value || '').trim();
        const table = String(this.panel?.querySelector('#data-input-table')?.value || '').trim();
        const schemaField = (this._dataInputSchema?.fields || []).find(
            (f) =>
                String(f.modelId) === modelId &&
                String(f.tableName) === table &&
                String(f.name) === name,
        );
        const labelEl = row.querySelector('[data-di-field="label"]');
        const typeEl = row.querySelector('[data-di-field="type"]');
        if (labelEl && (!labelEl.value || labelEl.value === nameEl.dataset.prevName)) {
            labelEl.value = name;
        }
        nameEl.dataset.prevName = name;
        if (typeEl && schemaField?.type) {
            const mapped = createDataInputFieldFromColumn({
                name,
                type: schemaField.type,
                sqlite_type: schemaField.sqliteType,
            });
            if (mapped?.type) typeEl.value = mapped.type;
        }
    }

    /**
     * @returns {object[]}
     */
    _readDataInputFieldsFromPanel() {
        const list = this.panel?.querySelector('#data-input-fields-list');
        if (!list) return [];
        const rows = [...list.querySelectorAll('[data-di-field-row]')];
        return rows.map((row, index) => {
            const get = (key) => row.querySelector(`[data-di-field="${key}"]`);
            const name = String(get('name')?.value || '').trim();
            const type = String(get('type')?.value || 'text');
            const label = String(get('label')?.value || '');
            const placeholder = String(get('placeholder')?.value || '');
            const required = !!get('required')?.checked;
            const readonly = !!get('readonly')?.checked;
            const hidden = !!get('hidden')?.checked;
            const isPrimaryKey = !!get('isPrimaryKey')?.checked;
            const optionsRaw = String(get('options')?.value || '').trim();
            const options = optionsRaw
                ? optionsRaw
                      .split('\n')
                      .map((line) => {
                          const s = line.trim();
                          if (!s) return null;
                          if (s.includes('|')) {
                              const [value, lab] = s.split('|').map((x) => x.trim());
                              return { value, label: lab || value };
                          }
                          return { value: s, label: s };
                      })
                      .filter(Boolean)
                : [];
            const optionsSource =
                String(get('optionsSource')?.value || 'manual') === 'formula' ? 'formula' : 'manual';
            let optionsFormula = String(get('optionsFormula')?.value || '').trim();
            const optionsLabelFormula = String(get('optionsLabelFormula')?.value || '').trim();
            if (optionsSource === 'formula' && !optionsFormula) {
                const table = String(this.panel.querySelector('#data-input-table')?.value || '').trim();
                optionsFormula = defaultSelectOptionsFormula(table, name);
            }
            const id = row.getAttribute('data-di-field-id') || `field_${index + 1}`;
            return normalizeFieldDef(
                {
                    id,
                    name,
                    type,
                    label: label || name,
                    placeholder,
                    required: required || isPrimaryKey,
                    readonly,
                    hidden,
                    isPrimaryKey,
                    options,
                    optionsSource,
                    optionsFormula,
                    optionsLabelFormula,
                },
                index,
            );
        });
    }

    /**
     * @param {object[]} fields
     * @param {{ preserveCollapse?: boolean, expandIndex?: number }} [opts]
     */
    renderDataInputFieldsEditor(fields, opts = {}) {
        const list = this.panel?.querySelector('#data-input-fields-list');
        const status = this.panel?.querySelector('#data-input-fields-status');
        if (!list) return;

        const collapsed = new Set();
        if (opts.preserveCollapse) {
            list.querySelectorAll('[data-di-field-row].is-collapsed').forEach((row) => {
                const id = row.getAttribute('data-di-field-id');
                if (id) collapsed.add(id);
            });
        }

        const cols = this._getDataInputTableColumnNames();
        const colSet = new Set(cols);
        const hasSchema = cols.length > 0;
        const normalized = (Array.isArray(fields) ? fields : []).map((f, i) => normalizeFieldDef(f, i));

        let invalidCount = 0;
        if (!normalized.length) {
            list.innerHTML =
                '<div class="data-input-fields-empty">Поля не заданы. Сгенерируйте из схемы или добавьте вручную.</div>';
            this._updateDataInputFieldsCount(0);
            if (status) {
                status.hidden = true;
                status.textContent = '';
            }
            return;
        }

        const typeOptionsHtml = DATA_INPUT_FIELD_TYPES.map((t) => {
            const lab = DATA_INPUT_FIELD_TYPE_LABELS[t] || t;
            return `<option value="${t}">${this._escapeBindingText(lab)}</option>`;
        }).join('');

        list.innerHTML = normalized
            .map((field, idx) => {
                const name = String(field.name || '').trim();
                const unknown = hasSchema && name && !colSet.has(name);
                const missingName = !name;
                if (unknown || missingName) invalidCount += 1;
                const id = field.id || `field_${idx + 1}`;
                const isCollapsed =
                    opts.expandIndex === idx
                        ? false
                        : opts.preserveCollapse
                          ? collapsed.has(id)
                          : true;
                const summaryParts = [
                    name || 'без имени',
                    DATA_INPUT_FIELD_TYPE_LABELS[field.type] || field.type,
                ];
                if (field.required) summaryParts.push('обяз.');
                if (field.isPrimaryKey) summaryParts.push('PK');
                if (unknown) summaryParts.push('нет в таблице');

                const nameOptions = [];
                if (!name) {
                    nameOptions.push('<option value="">Выберите колонку…</option>');
                }
                cols.forEach((c) => {
                    nameOptions.push(
                        `<option value="${this._escapeBindingText(c)}" ${c === name ? 'selected' : ''}>${this._escapeBindingText(c)}</option>`,
                    );
                });
                if (name && !colSet.has(name)) {
                    nameOptions.push(
                        `<option value="${this._escapeBindingText(name)}" selected>${this._escapeBindingText(name)} (нет в таблице)</option>`,
                    );
                }

                const optionsStr = (field.options || [])
                    .map((o) => {
                        if (o == null) return '';
                        if (typeof o === 'string') return o;
                        const v = o.value != null ? String(o.value) : '';
                        const l = o.label != null ? String(o.label) : v;
                        return l && l !== v ? `${v}|${l}` : v;
                    })
                    .filter(Boolean)
                    .join('\n');

                const showOptions = field.type === 'select' || field.type === 'multiselect' || field.type === 'tags';
                const optionsSource = field.optionsSource === 'formula' ? 'formula' : 'manual';
                const tableName = String(this.panel.querySelector('#data-input-table')?.value || '').trim();
                const optionsFormula =
                    String(field.optionsFormula || '').trim() ||
                    (optionsSource === 'formula' ? defaultSelectOptionsFormula(tableName, name) : '');
                const optionsLabelFormula = String(field.optionsLabelFormula || '').trim();
                const formulaId = `di-opt-formula-${idx}`;
                const labelFormulaId = `di-opt-label-formula-${idx}`;
                if (showOptions && optionsSource === 'formula') summaryParts.push('формула');
                const errClass = unknown || missingName ? ' data-input-field-row--error' : '';
                const errBadge = unknown
                    ? '<span class="data-input-field-error-badge" title="Колонки нет в выбранной таблице">Нет в таблице</span>'
                    : missingName
                      ? '<span class="data-input-field-error-badge">Нет имени</span>'
                      : '';

                return `
                <div class="data-input-field-row${errClass}${isCollapsed ? ' is-collapsed' : ''}" data-di-field-row data-di-field-id="${this._escapeBindingText(id)}">
                    <div class="data-input-field-row-header flex-between">
                        <button type="button" class="data-input-field-row-toggle" data-di-field-toggle>
                            <span class="data-input-field-row-chevron" aria-hidden="true">${isCollapsed ? '▶' : '▼'}</span>
                            <span class="data-input-field-row-title-text">Поле ${idx + 1}</span>
                        </button>
                        <div class="data-input-field-row-meta">
                            ${errBadge}
                            <button type="button" class="data-input-field-remove" data-di-field-remove="${idx}" title="Удалить поле">×</button>
                        </div>
                    </div>
                    <div class="data-input-field-row-summary">${this._escapeBindingText(summaryParts.join(' · '))}</div>
                    <div class="data-input-field-row-body">
                        <div class="style-control-group">
                            <label class="style-label">Колонка (name)</label>
                            ${
                                cols.length
                                    ? `<select class="style-select" data-di-field="name">${nameOptions.join('')}</select>`
                                    : `<input type="text" class="style-input" data-di-field="name" value="${this._escapeBindingText(name)}" placeholder="column_name" autocomplete="off">`
                            }
                            ${
                                unknown
                                    ? '<div class="data-input-field-inline-error">Такой колонки нет в выбранной таблице.</div>'
                                    : ''
                            }
                        </div>
                        <div class="style-input-group">
                            <div class="style-control-group">
                                <label class="style-label">Тип</label>
                                <select class="style-select" data-di-field="type">${typeOptionsHtml}</select>
                            </div>
                            <div class="style-control-group">
                                <label class="style-label">Подпись</label>
                                <input type="text" class="style-input" data-di-field="label" value="${this._escapeBindingText(field.label || '')}" autocomplete="off">
                            </div>
                        </div>
                        <div class="style-control-group">
                            <label class="style-label">Placeholder</label>
                            <input type="text" class="style-input" data-di-field="placeholder" value="${this._escapeBindingText(field.placeholder || '')}" autocomplete="off">
                        </div>
                        <div class="data-input-field-flags">
                            <label class="data-input-flag"><input type="checkbox" data-di-field="isPrimaryKey" ${field.isPrimaryKey ? 'checked' : ''}> Primary key (PK)</label>
                            <label class="data-input-flag"><input type="checkbox" data-di-field="required" ${field.required || field.isPrimaryKey ? 'checked' : ''}> Обязательное</label>
                            <label class="data-input-flag"><input type="checkbox" data-di-field="readonly" ${field.readonly ? 'checked' : ''}> Только чтение</label>
                            <label class="data-input-flag"><input type="checkbox" data-di-field="hidden" ${field.hidden ? 'checked' : ''}> Скрытое</label>
                        </div>
                        ${
                            field.isPrimaryKey
                                ? '<div class="style-field-hint">В форме появится кнопка «Сгенерировать» для этого поля.</div>'
                                : ''
                        }
                        <div class="data-input-field-options"${showOptions ? '' : ' hidden'}>
                            <div class="style-control-group">
                                <label class="style-label">Источник вариантов</label>
                                <select class="style-select" data-di-field="optionsSource">
                                    <option value="manual"${optionsSource !== 'formula' ? ' selected' : ''}>Варианты (по строке; value|label)</option>
                                    <option value="formula"${optionsSource === 'formula' ? ' selected' : ''}>Формула (поле данных)</option>
                                </select>
                            </div>
                            <div class="style-control-group"${optionsSource === 'formula' ? ' hidden' : ''}>
                                <label class="style-label">Варианты (по строке; value|label)</label>
                                <textarea class="style-input" data-di-field="options" rows="3" spellcheck="false">${this._escapeBindingText(optionsStr)}</textarea>
                            </div>
                            <div class="style-control-group"${optionsSource === 'formula' ? '' : ' hidden'}>
                                <div class="formula-label-with-btn">
                                    <label class="style-label" for="${formulaId}">Поле значения</label>
                                    ${this.formulaEditorOpenButton(
                                        `data-formula-mode="direct" data-formula-target-id="${formulaId}" data-formula-apply="data-input"`,
                                    )}
                                </div>
                                <textarea class="style-input" id="${formulaId}" data-di-field="optionsFormula" rows="2" spellcheck="false" placeholder="[orders.region_id]">${this._escapeBindingText(optionsFormula)}</textarea>
                                <div class="style-field-hint">Уникальные значения этого поля — value варианта, например <code>[orders.region_id]</code>.</div>
                            </div>
                            <div class="style-control-group"${optionsSource === 'formula' ? '' : ' hidden'}>
                                <div class="formula-label-with-btn">
                                    <label class="style-label" for="${labelFormulaId}">Поле имени</label>
                                    ${this.formulaEditorOpenButton(
                                        `data-formula-mode="direct" data-formula-target-id="${labelFormulaId}" data-formula-apply="data-input"`,
                                    )}
                                </div>
                                <textarea class="style-input" id="${labelFormulaId}" data-di-field="optionsLabelFormula" rows="2" spellcheck="false" placeholder="[orders.name]">${this._escapeBindingText(optionsLabelFormula)}</textarea>
                                <div class="style-field-hint">Подпись в списке — уникальное имя для каждого значения, например <code>[orders.name]</code>. Пусто — показывать само значение.</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            })
            .join('');

        list.querySelectorAll('[data-di-field-row]').forEach((row, idx) => {
            const typeSel = row.querySelector('[data-di-field="type"]');
            if (typeSel) typeSel.value = normalized[idx]?.type || 'text';
            const srcSel = row.querySelector('[data-di-field="optionsSource"]');
            if (srcSel) srcSel.value = normalized[idx]?.optionsSource === 'formula' ? 'formula' : 'manual';
        });

        this._updateDataInputFieldsCount(normalized.length);
        if (status) {
            if (invalidCount > 0 && hasSchema) {
                status.hidden = false;
                status.textContent =
                    invalidCount === 1
                        ? '1 поле не совпадает со схемой таблицы.'
                        : `${invalidCount} поля не совпадают со схемой таблицы.`;
                status.className = 'data-input-panel-status data-input-panel-status--error';
            } else {
                status.hidden = true;
                status.textContent = '';
            }
        }
    }

    /**
     * Модели дашборда + schema tables для селектов data_input.
     * @param {string|number} [dashboardId]
     */
    async ensureDataInputSourceOptions(dashboardId = this.engine?.dashboardId) {
        await this.ensureButtonWidgetMetaOptions();
        if (dashboardId == null || dashboardId === '') {
            this._dataInputSchema = { tables: [], fields: [], rawByModelId: new Map() };
            return this._dataInputSchema;
        }
        return this.ensureDataInputSchema(dashboardId);
    }

    /**
     * @param {string|number} dashboardId
     */
    async ensureDataInputSchema(dashboardId) {
        const key = String(dashboardId);
        if (this._dataInputSchemaKey === key && this._dataInputSchema) {
            return this._dataInputSchema;
        }
        if (this._dataInputSchemaPromise && this._dataInputSchemaKey === key) {
            return this._dataInputSchemaPromise;
        }
        this._dataInputSchemaKey = key;
        this._dataInputSchemaPromise = getDashboardSchema(dashboardId)
            .then((schema) => {
                this._dataInputSchema = schema || { tables: [], fields: [], rawByModelId: new Map() };
                return this._dataInputSchema;
            })
            .catch((err) => {
                console.warn('data_input schema', err);
                this._dataInputSchema = { tables: [], fields: [], rawByModelId: new Map() };
                return this._dataInputSchema;
            });
        return this._dataInputSchemaPromise;
    }

    /**
     * @returns {Array<{id:number|string, name?:string}>}
     */
    _getDataInputLinkedModels() {
        const list = Array.isArray(this._buttonWidgetModels) ? this._buttonWidgetModels : [];
        return list
            .map((m) => ({
                id: m.id ?? m.model_id,
                name: m.name || m.title || `Модель ${m.id ?? m.model_id}`,
            }))
            .filter((m) => m.id != null && m.id !== '');
    }

    /**
     * @param {string|number|null|undefined} selectedModelId
     * @param {{ autoApplySingle?: boolean }} [opts]
     * @returns {string} выбранный model id (строка) или ''
     */
    populateDataInputModelSelect(selectedModelId, opts = {}) {
        const sel = this.panel?.querySelector('#data-input-model-id');
        const hint = this.panel?.querySelector('#data-input-model-hint');
        if (!sel) return '';
        const models = this._getDataInputLinkedModels();
        const wanted = selectedModelId != null && selectedModelId !== '' ? String(selectedModelId) : '';
        let chosen = wanted;

        if (!models.length) {
            sel.innerHTML = '<option value="">Нет подключённых моделей</option>';
            sel.disabled = true;
            if (hint) {
                hint.textContent = 'Подключите модель данных к дашборду, чтобы выбрать её здесь.';
            }
            return '';
        }

        if (!chosen || !models.some((m) => String(m.id) === chosen)) {
            // Одну подключённую модель выбираем сразу; при нескольких — ждём явного выбора
            if (models.length === 1 && opts.autoApplySingle !== false) {
                chosen = String(models[0].id);
            } else {
                chosen = '';
            }
        }

        const options = [];
        if (models.length > 1 && !chosen) {
            options.push('<option value="">Выберите модель…</option>');
        }
        models.forEach((m) => {
            const id = String(m.id);
            const label =
                models.length === 1
                    ? `${m.name}`
                    : `${m.name} (#${id})`;
            options.push(
                `<option value="${this._escapeBindingText(id)}" ${id === chosen ? 'selected' : ''}>${this._escapeBindingText(label)}</option>`,
            );
        });
        if (chosen && !models.some((m) => String(m.id) === chosen)) {
            options.push(
                `<option value="${this._escapeBindingText(chosen)}" selected>Модель #${this._escapeBindingText(chosen)} (не в списке)</option>`,
            );
        }
        sel.innerHTML = options.join('');
        sel.disabled = models.length === 0;
        // Одна модель — выбор фактически нет, но значение видно
        sel.title = models.length === 1 ? 'К дашборду подключена одна модель' : '';
        if (hint) {
            hint.textContent =
                models.length === 1
                    ? 'К дашборду подключена одна модель — выбрана автоматически.'
                    : 'Выберите модель, подключённую к дашборду.';
        }
        return chosen;
    }

    /**
     * @param {string|number|null|undefined} modelId
     * @param {string|null|undefined} selectedTable
     * @returns {string} выбранное имя таблицы или ''
     */
    populateDataInputTableSelect(modelId, selectedTable) {
        const sel = this.panel?.querySelector('#data-input-table');
        if (!sel) return '';
        const mid = modelId != null && modelId !== '' ? String(modelId) : '';
        const wanted = selectedTable != null ? String(selectedTable).trim() : '';
        if (!mid) {
            sel.innerHTML = '<option value="">Сначала выберите модель</option>';
            sel.disabled = true;
            return '';
        }

        const schemaTables = Array.isArray(this._dataInputSchema?.tables)
            ? this._dataInputSchema.tables
            : [];
        let tables = schemaTables
            .filter((t) => String(t.modelId) === mid)
            .map((t) => t.tableName)
            .filter(Boolean);

        // Fallback: raw schema tables for model
        if (!tables.length && this._dataInputSchema?.rawByModelId) {
            const raw =
                this._dataInputSchema.rawByModelId.get(Number(mid)) ||
                this._dataInputSchema.rawByModelId.get(mid);
            tables = (raw?.tables || [])
                .filter((t) => t?.name && !t.skipped)
                .map((t) => t.name);
        }

        tables = [...new Set(tables)].sort((a, b) => a.localeCompare(b, 'ru'));

        if (!tables.length) {
            sel.innerHTML = '<option value="">Нет таблиц в модели</option>';
            sel.disabled = true;
            return '';
        }

        let chosen = wanted;
        if (!chosen || !tables.includes(chosen)) {
            chosen = tables.length === 1 ? tables[0] : '';
        }

        const options = [];
        if (tables.length > 1 && !chosen) {
            options.push('<option value="">Выберите таблицу…</option>');
        }
        tables.forEach((name) => {
            options.push(
                `<option value="${this._escapeBindingText(name)}" ${name === chosen ? 'selected' : ''}>${this._escapeBindingText(name)}</option>`,
            );
        });
        if (chosen && !tables.includes(chosen)) {
            options.push(
                `<option value="${this._escapeBindingText(chosen)}" selected>${this._escapeBindingText(chosen)} (нет в схеме)</option>`,
            );
        }
        sel.innerHTML = options.join('');
        sel.disabled = false;
        return chosen;
    }

    /**
     * @param {string} text
     * @param {'ok'|'error'|'info'} kind
     */
    _setDataInputGenerateStatus(text, kind = 'info') {
        const el = this.panel?.querySelector('#data-input-generate-status');
        if (!el) return;
        if (!text) {
            el.hidden = true;
            el.textContent = '';
            el.className = 'data-input-panel-status';
            return;
        }
        el.hidden = false;
        el.textContent = text;
        el.className = `data-input-panel-status data-input-panel-status--${kind}`;
    }

    _updateDataInputFieldsCount(count) {
        const el = this.panel?.querySelector('#data-input-fields-count');
        if (!el) return;
        const n = Number.isFinite(count) ? count : 0;
        const mod10 = n % 10;
        const mod100 = n % 100;
        let word = 'полей';
        if (mod10 === 1 && mod100 !== 11) word = 'поле';
        else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'поля';
        el.textContent = `${n} ${word}`;
    }

    syncDataInputPanelFromWidget(widget) {
        if (!this.panel || widget?.type !== 'data_input') return;
        const s = widget.settings || {};
        this.loadWidgetTitleSettingsToPanel(s, 'data-input', {
            defaultTitle: 'Ввод данных',
            defaultShow: true,
        });
        const set = (id, val) => {
            const el = this.panel.querySelector(id);
            if (el) el.value = val != null ? String(val) : '';
        };
        set('#data-input-submit-label', s.submitLabel ?? 'Сохранить');
        const cols = this.panel.querySelector('#data-input-columns');
        if (cols) cols.value = String(Math.min(3, Math.max(1, parseInt(s.columns, 10) || 1)));
        const interactive = this.panel.querySelector('#data-input-interactive-editor');
        if (interactive) interactive.checked = s.interactiveInEditor === true;

        const roles = migrateInsertRoles(s.permissions?.insert_roles);
        this.renderDataInputRolesEditor(roles);
        this._hideDataInputRolePicker();

        const fields = Array.isArray(s.fields) ? s.fields : [];
        this.renderDataInputFieldsEditor(fields);
        this._setDataInputGenerateStatus('', 'info');

        const modelSel = this.panel.querySelector('#data-input-model-id');
        const tableSel = this.panel.querySelector('#data-input-table');
        if (modelSel) {
            modelSel.innerHTML = '<option value="">Загрузка…</option>';
            modelSel.disabled = true;
        }
        if (tableSel) {
            tableSel.innerHTML = '<option value="">Загрузка…</option>';
            tableSel.disabled = true;
        }

        const syncGen = ++this._dataInputSourceSyncGen || (this._dataInputSourceSyncGen = 1);
        const wantedModel = s.modelId ?? s.model_id ?? null;
        const wantedTable = s.table ?? '';
        void this.ensureDataInputSourceOptions().then(() => {
            if (syncGen !== this._dataInputSourceSyncGen) return;
            if (this.currentWidget !== widget && this.currentWidget?.id !== widget?.id) return;
            const chosenModel = this.populateDataInputModelSelect(wantedModel, {
                autoApplySingle: true,
            });
            const chosenTable = this.populateDataInputTableSelect(chosenModel, wantedTable);
            const currentFields = this._readDataInputFieldsFromPanel();
            this.renderDataInputFieldsEditor(currentFields.length ? currentFields : fields);
            const needApply =
                (chosenModel && String(wantedModel ?? '') !== String(chosenModel)) ||
                (chosenTable && String(wantedTable || '') !== String(chosenTable));
            if (needApply && this.currentWidget?.type === 'data_input') {
                this.applyDataInputPanelSettings();
            }
        });
    }

    applyDataInputPanelSettings() {
        const w = this.currentWidget;
        if (!w || w.type !== 'data_input') return;
        this.applyWidgetTitleSettingsFromPanel(w, 'data-input', {
            defaultTitle: 'Ввод данных',
        });
        const sub = this.panel.querySelector('#data-input-submit-label');
        if (sub) w.settings.submitLabel = sub.value || 'Сохранить';
        const tbl = this.panel.querySelector('#data-input-table');
        if (tbl) w.settings.table = tbl.value.trim();
        const mid = this.panel.querySelector('#data-input-model-id');
        if (mid) {
            const n = parseInt(mid.value, 10);
            w.settings.modelId = Number.isFinite(n) ? n : null;
        }
        const colsEl = this.panel.querySelector('#data-input-columns');
        if (colsEl) w.settings.columns = parseInt(colsEl.value, 10) || 1;
        const interactive = this.panel.querySelector('#data-input-interactive-editor');
        if (interactive) w.settings.interactiveInEditor = !!interactive.checked;

        const roles = this._readDataInputRolesFromPanel();
        w.settings.permissions = {
            ...(w.settings.permissions || {}),
            insert_roles: roles.length ? roles : [...DEFAULT_DATA_INPUT_INSERT_ROLES],
        };

        w.settings.fields = this._readDataInputFieldsFromPanel();
        this._updateDataInputFieldsCount(w.settings.fields.length);

        if (w.settings.modelId && w.settings.table) {
            w.dataSource = {
                type: 'data-model',
                modelId: w.settings.modelId,
                table: w.settings.table,
            };
        }
        w.update();
        if (this.engine?.saveSnapshot) this.engine.saveSnapshot();
        eventBus.emit('widget:settings-changed', { widget: w });
    }

    setupButtonWidgetSettingsListeners() {
        const section = this.panel.querySelector('.button-widget-settings-section');
        if (!section || section._buttonWidgetPanelBound) return;
        section._buttonWidgetPanelBound = true;

        const applyField = (idx, field, value, { rerender = false } = {}) => {
            const w = this.currentWidget;
            if (!w || w.type !== 'button-widget' || !Array.isArray(w.settings?.buttons)) return;
            const i = parseInt(idx, 10);
            if (!Number.isFinite(i) || i < 0 || i >= w.settings.buttons.length) return;
            const btn = w.settings.buttons[i] || {};
            if (!btn.action || typeof btn.action !== 'object') btn.action = { type: 'custom', target: 'global', payload: {} };
            if (!btn.action.payload || typeof btn.action.payload !== 'object') btn.action.payload = {};

            if (field === 'label') btn.label = String(value ?? '').trim();
            if (field === 'icon') btn.icon = String(value || '').trim() || null;
            if (field === 'use-custom-style') {
                btn.useCustomStyle = value === true || value === 'true' || value === 'on';
                if (btn.useCustomStyle && (!btn.style || typeof btn.style !== 'object')) {
                    btn.style = normalizeButtonStylePartial({
                        ...(w.settings?.defaultButtonStyle || {}),
                        ...this._readButtonStyleFormulasFromPanel(null),
                    });
                }
                rerender = true;
            }
            if (field === 'button-style') {
                // handled separately via dataset key
            }
            if (field === 'action-type') {
                const nextType = this.normalizeButtonActionType(value);
                btn.action.type = nextType;
                if (nextType === 'reload') {
                    btn.action.target = 'global';
                } else if (nextType === 'hard_reload') {
                    btn.action.target = 'all';
                    delete btn.action.payload.modelId;
                    delete btn.action.payload.modelIds;
                } else if (nextType === 'navigate' && (!btn.action.target || btn.action.target === 'global' || btn.action.target === 'all')) {
                    btn.action.target = '';
                } else if (nextType === 'link') {
                    const prevUrl = String(btn.action.payload?.url || '').trim();
                    if (!btn.action.target || btn.action.target === 'global' || btn.action.target === 'all') {
                        btn.action.target = prevUrl;
                    }
                }
                rerender = true;
            }
            if (field === 'action-target') btn.action.target = String(value || '').trim() || 'global';
            if (field === 'link-url') {
                const url = String(value || '').trim();
                btn.action.target = url;
                if (url) btn.action.payload.url = url;
                else delete btn.action.payload.url;
            }
            if (field === 'hard-reload-model') {
                const modelId = String(value || '').trim();
                if (modelId) {
                    btn.action.target = modelId;
                    btn.action.payload.modelId = Number(modelId) || modelId;
                } else {
                    btn.action.target = 'all';
                    delete btn.action.payload.modelId;
                    delete btn.action.payload.modelIds;
                }
            }
            if (field === 'filter-field') {
                const raw = String(value || '').trim();
                if (!raw) {
                    delete btn.action.payload.field;
                } else if (raw.includes('.')) {
                    const parts = raw.split('.').map((p) => p.trim()).filter(Boolean);
                    btn.action.payload.field = parts[parts.length - 1] || raw;
                    btn.action.payload.table = parts.slice(0, -1).join('.') || btn.action.payload.table;
                } else {
                    btn.action.payload.field = raw;
                }
                // Prefer model/table from widget dataSource when user only typed a bare column
                const ds = w.dataSource;
                if (ds?.modelId != null && btn.action.payload.modelId == null) {
                    btn.action.payload.modelId = ds.modelId;
                }
                if (ds?.table && !btn.action.payload.table) {
                    btn.action.payload.table = ds.table;
                }
            }
            if (field === 'filter-value') {
                const raw = String(value || '').trim();
                if (!raw) {
                    delete btn.action.payload.value;
                    delete btn.action.payload.values;
                } else if (raw.includes(',')) {
                    btn.action.payload.values = raw.split(',').map((x) => x.trim()).filter(Boolean);
                    delete btn.action.payload.value;
                } else {
                    btn.action.payload.value = raw;
                    delete btn.action.payload.values;
                }
            }
            if (field === 'param-key') {
                btn.action.payload.key = String(value || '').trim();
            }
            if (field === 'param-value') {
                btn.action.payload.value = value;
            }
            if (field === 'var-key') {
                btn.action.payload.key = String(value || '').trim();
            }
            if (field === 'var-value') {
                btn.action.payload.value = value;
            }
            if (field === 'custom-handler') {
                const handler = String(value || '').trim();
                btn.action.target = handler || 'global';
                if (handler) btn.action.payload.handler = handler;
                else delete btn.action.payload.handler;
            }
            if (field === 'action-payload') {
                const prevPayload = btn.action.payload && typeof btn.action.payload === 'object' ? btn.action.payload : {};
                btn.action.payload = this.parseJsonOrFallback(value, prevPayload);
            }
            w.settings.buttons[i] = btn;
            w.update();
            eventBus.emit('widget:settings-changed', { widget: w });
            eventBus.emit('widget:styles-changed', { widget: w });
            if (rerender) this.renderButtonWidgetSettingsList(w);
        };

        const applyButtonStyleField = (idx, styleKey, value) => {
            const w = this.currentWidget;
            if (!w || w.type !== 'button-widget' || !Array.isArray(w.settings?.buttons)) return;
            const i = parseInt(idx, 10);
            if (!Number.isFinite(i) || i < 0 || i >= w.settings.buttons.length) return;
            const btn = w.settings.buttons[i] || {};
            if (!btn.style || typeof btn.style !== 'object') btn.style = {};
            const numericKeys = new Set(['borderRadius', 'fontSize', 'fontWeight', 'borderWidth', 'shadowBlur']);
            if (numericKeys.has(styleKey)) {
                const n = Number(value);
                if (Number.isFinite(n)) btn.style[styleKey] = n;
            } else {
                btn.style[styleKey] = value;
            }
            btn.style = normalizeButtonStylePartial(btn.style);
            btn.useCustomStyle = true;
            w.settings.buttons[i] = btn;
            w.update();
            eventBus.emit('widget:settings-changed', { widget: w });
            eventBus.emit('widget:styles-changed', { widget: w });
        };

        const iconMenu = this._ensureButtonWidgetIconMenu();
        if (iconMenu && !iconMenu._buttonIconMenuBound) {
            iconMenu._buttonIconMenuBound = true;
            iconMenu.addEventListener('click', (e) => {
                const pageBtn = e.target.closest('[data-button-icon-page]');
                if (pageBtn && this._buttonIconPicker) {
                    e.preventDefault();
                    e.stopPropagation();
                    const dir = pageBtn.getAttribute('data-button-icon-page');
                    const pageCount = this._getButtonIconPickerPageCount();
                    if (dir === 'prev') this._buttonIconPicker.page = Math.max(0, this._buttonIconPicker.page - 1);
                    if (dir === 'next') this._buttonIconPicker.page = Math.min(pageCount - 1, this._buttonIconPicker.page + 1);
                    this.renderButtonWidgetIconPickerPage();
                    return;
                }

                const optBtn = e.target.closest('[data-button-icon-id]');
                if (!optBtn || !this._buttonIconPicker) return;
                e.preventDefault();
                e.stopPropagation();
                const iconId = optBtn.getAttribute('data-button-icon-id') || '';
                const idx = this._buttonIconPicker.idx;
                applyField(idx, 'icon', iconId);
                this.closeButtonWidgetIconPicker();
                if (this.currentWidget?.type === 'button-widget') {
                    this.renderButtonWidgetSettingsList(this.currentWidget);
                }
            });
        }

        section.addEventListener('click', (e) => {
            const w = this.currentWidget;
            if (!w || w.type !== 'button-widget') return;

            const iconPickerBtn = e.target.closest('[data-button-widget-icon-picker]');
            if (iconPickerBtn) {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(iconPickerBtn.getAttribute('data-button-widget-icon-picker'), 10);
                if (Number.isFinite(idx)) this.toggleButtonWidgetIconPicker(iconPickerBtn, idx);
                return;
            }

            const payloadHelpBtn = e.target.closest('[data-button-payload-help]');
            if (payloadHelpBtn) {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(payloadHelpBtn.getAttribute('data-button-payload-help'), 10);
                const actionType = payloadHelpBtn.getAttribute('data-button-payload-help-type') || 'custom';
                this.openButtonPayloadHelpModal({
                    idx: Number.isFinite(idx) ? idx : null,
                    actionType,
                });
                return;
            }

            const addBtn = e.target.closest('#button-widget-add-btn');
            if (addBtn) {
                if (!Array.isArray(w.settings.buttons)) w.settings.buttons = [];
                const nextIndex = w.settings.buttons.length + 1;
                const existingIds = w.settings.buttons.map((b) => b?.id);
                w.settings.buttons.push({
                    id: createUniqueButtonId(existingIds),
                    label: `Кнопка ${nextIndex}`,
                    icon: 'arrow',
                    action: { type: 'reload', target: 'global', payload: {} },
                });
                this.renderButtonWidgetSettingsList(w);
                this.applyButtonWidgetPanelSettings();
                return;
            }

            const toggleBtn = e.target.closest('[data-button-widget-toggle]');
            if (toggleBtn) {
                e.preventDefault();
                const toggleId = String(toggleBtn.getAttribute('data-button-widget-toggle-id') || '').trim();
                if (!toggleId) return;
                if (!(this._buttonWidgetCollapsedIds instanceof Set)) {
                    this._buttonWidgetCollapsedIds = new Set();
                }
                if (this._buttonWidgetCollapsedIds.has(toggleId)) {
                    this._buttonWidgetCollapsedIds.delete(toggleId);
                } else {
                    this._buttonWidgetCollapsedIds.add(toggleId);
                }
                this.renderButtonWidgetSettingsList(w);
                return;
            }

            const removeBtn = e.target.closest('[data-button-widget-remove]');
            if (removeBtn) {
                const idx = parseInt(removeBtn.getAttribute('data-button-widget-remove'), 10);
                if (Number.isFinite(idx) && idx >= 0 && idx < (w.settings.buttons || []).length) {
                    const removed = w.settings.buttons[idx];
                    const removedId = removed?.id != null ? String(removed.id) : '';
                    if (removedId && this._buttonWidgetCollapsedIds instanceof Set) {
                        this._buttonWidgetCollapsedIds.delete(removedId);
                    }
                    w.settings.buttons.splice(idx, 1);
                    this.renderButtonWidgetSettingsList(w);
                    this.applyButtonWidgetPanelSettings();
                }
            }
        });

        section.addEventListener('change', (e) => {
            if (!e.target.closest('.button-widget-settings-section')) return;
            if (
                e.target.id === 'button-widget-layout-direction'
                || e.target.id === 'button-widget-layout-wrap'
                || e.target.id === 'button-widget-interactive-editor'
                || e.target.id === 'button-widget-show-title'
                || e.target.id === 'button-widget-widget-title'
                || e.target.id === 'button-widget-title-size'
                || e.target.id === 'button-widget-title-color'
                || e.target.id === 'button-widget-title-color-text'
            ) {
                this.applyButtonWidgetPanelSettings();
                return;
            }
            if (e.target.hasAttribute('data-button-shared-style') || e.target.id?.startsWith('button-widget-shared-')) {
                this.applyButtonWidgetSharedStyleFromPanel();
                return;
            }
            const styleKey = e.target.getAttribute('data-button-style');
            if (styleKey) {
                const idx = e.target.getAttribute('data-button-widget-idx');
                applyButtonStyleField(idx, styleKey, e.target.value);
                return;
            }
            const idx = e.target.getAttribute('data-button-widget-idx');
            const field = e.target.getAttribute('data-button-widget-field');
            if (idx != null && field) {
                const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                applyField(idx, field, value, {
                    rerender: field === 'action-type' || field === 'hard-reload-model' || field === 'use-custom-style',
                });
            }
        });

        section.addEventListener('input', (e) => {
            if (
                e.target.id === 'button-widget-widget-title'
                || e.target.id === 'button-widget-title-size'
                || e.target.id === 'button-widget-title-color'
                || e.target.id === 'button-widget-title-color-text'
            ) {
                this.applyButtonWidgetPanelSettings();
                return;
            }
            if (e.target.hasAttribute('data-button-shared-style') || e.target.id?.startsWith('button-widget-shared-')) {
                this.applyButtonWidgetSharedStyleFromPanel();
                return;
            }
            const styleKey = e.target.getAttribute('data-button-style');
            if (styleKey) {
                const idx = e.target.getAttribute('data-button-widget-idx');
                applyButtonStyleField(idx, styleKey, e.target.value);
                return;
            }
            const idx = e.target.getAttribute('data-button-widget-idx');
            const field = e.target.getAttribute('data-button-widget-field');
            if (idx == null || !field) return;
            if (field === 'action-payload') return; // JSON применяем по change/blur
            if (field === 'action-type' || field === 'hard-reload-model' || field === 'use-custom-style') return;
            if (e.target.type === 'checkbox') return;
            applyField(idx, field, e.target.value);
        });
        this.wireTitleColorInputs('button-widget', () => this.applyButtonWidgetPanelSettings());
    }

    syncPieCenterSourceUi() {
        if (!this.panel) return;
        this.syncPieChartDependentUi();
    }

    /**
     * Показ/скрытие зависимых настроек линейного графика.
     */
    syncLineChartDependentUi() {
        if (!this.panel) return;
        const q = (id) => this.panel.querySelector(id);
        const show = (sel, on) => {
            const el = q(sel);
            if (!el) return;
            el.style.display = on ? '' : 'none';
            el.classList.toggle('widget-panel-title-sub--hidden', !on);
        };

        this.syncWidgetTitleSubRows('line-chart');

        const zoomOn = q('#line-chart-zoom-enabled')?.checked !== false;
        show('#line-chart-wheel-zoom-row', zoomOn);
        show('#line-chart-drag-zoom-row', zoomOn);
        show('#line-chart-dbl-reset-row', zoomOn);
        show('#line-chart-zoom-x-row', zoomOn);
        show('#line-chart-zoom-y-row', zoomOn);
        show('#line-chart-cross-filter-brush-x-row', zoomOn);

        const minimapOn = q('#line-chart-minimap-enabled')?.checked !== false;
        show('#line-chart-minimap-height-row', minimapOn);

        const panOn = q('#line-chart-pan-enabled')?.checked !== false;
        show('#line-chart-auto-refetch-row', panOn);

        const tfOn = !!q('#line-chart-tf-enabled')?.checked;
        show('#line-chart-tf-deps', tfOn);

        const pointsOn = !!q('#line-chart-points-enabled')?.checked;
        show('#line-chart-point-radius-row', pointsOn);
        show('#line-chart-point-hover-radius-row', pointsOn);
        show('#line-chart-point-color-row', pointsOn);
        show('#line-chart-threshold-block', pointsOn);
        const thrRaw = String(q('#line-chart-threshold-formula')?.value || '').trim();
        show('#line-chart-threshold-colors-row', pointsOn && thrRaw.length > 0);

        const labelsOn = !!q('#line-chart-labels-enabled')?.checked;
        show('#line-chart-label-mode-row', labelsOn);
        show('#line-chart-label-position-row', labelsOn);
        show('#line-chart-label-format-row', labelsOn);
        const labelFmt = q('#line-chart-label-format')?.value || 'auto';
        show('#line-chart-label-custom-row', labelsOn && labelFmt === 'custom');

        const tipOn = q('#line-chart-tooltip-enabled')?.checked !== false;
        show('#line-chart-tooltip-deps', tipOn);

        const gridOn = q('#line-chart-grid-enabled')?.checked !== false;
        show('#line-chart-grid-density-row', gridOn);
        show('#line-chart-grid-opacity-row', gridOn);
        show('#line-chart-grid-color-row', gridOn);

        const axisXOn = q('#line-chart-axis-x')?.checked !== false;
        show('#line-chart-axis-x-type-row', axisXOn);
        show('#line-chart-axis-x-rotate-row', axisXOn);

        const chartType = q('#line-chart-chart-type')?.value || 'spline';
        show('#line-chart-stack-row', chartType === 'area');
        // step: сглаживание не применимо; spline уже «гладкий»
        show('#line-chart-line-smooth-row', chartType === 'line' || chartType === 'area');

        const maOn = !!q('#line-chart-ma-enabled')?.checked;
        show('#line-chart-ma-deps', maOn);

        const trendOn = !!q('#line-chart-trend-enabled')?.checked;
        show('#line-chart-trend-deps', trendOn);

        const compareOn = !!q('#line-chart-compare-enabled')?.checked;
        show('#line-chart-compare-deps', compareOn);
        const compareMode = q('#line-chart-compare-mode')?.value || 'previous_period';
        show('#line-chart-compare-shift-row', compareOn && compareMode === 'custom_shift');

        const forecastOn = !!q('#line-chart-forecast-enabled')?.checked;
        show('#line-chart-forecast-deps', forecastOn);

        // Reference editor: value / yMax уже через _syncLineChartRefTypeUi
        if (typeof this._syncLineChartRefTypeUi === 'function') {
            this._syncLineChartRefTypeUi();
        }
    }

    /**
     * Показ/скрытие зависимых настроек pie: заголовок, donut/центр, легенда, порог.
     */
    syncPieChartDependentUi() {
        if (!this.panel) return;
        const q = (id) => this.panel.querySelector(id);
        const show = (sel, on) => {
            const el = typeof sel === 'string' ? q(sel) : sel;
            if (!el) return;
            el.style.display = on ? '' : 'none';
            el.classList.toggle('widget-panel-title-sub--hidden', !on);
        };

        this.syncWidgetTitleSubRows('pie-chart');

        const thrRaw = String(q('#pie-chart-slice-threshold-formula')?.value || '').trim();
        const showThrColors = thrRaw.length > 0 && !tryCompileColorFormula(thrRaw).ok;
        show('#pie-chart-threshold-colors-row', showThrColors);

        const colorMode = q('#pie-chart-color-mode')?.value || 'palette';
        show('#pie-chart-solid-color-row', colorMode === 'solid');
        show('#pie-chart-palette-group', colorMode === 'palette' || colorMode === 'gradient');

        const donutOn = !!q('#pie-chart-donut')?.checked;
        show('#pie-chart-inner-radius-row', donutOn);
        show('#pie-chart-center-enabled-row', donutOn);

        const centerOn = donutOn && q('#pie-chart-center-enabled')?.checked !== false;
        show('#pie-chart-center-source-row', centerOn);
        show('#pie-chart-center-number-format-row', centerOn);
        show('#pie-chart-center-template-row', centerOn);

        const src = q('#pie-chart-center-source')?.value || 'segments';
        show('#pie-chart-center-measure-fn-wrap', centerOn && src === 'measure');
        show('#pie-chart-center-seg-aggregate-wrap', centerOn && src === 'segments');

        const legendOn = q('#pie-chart-show-legend')?.checked !== false;
        show('#pie-chart-legend-position-row', legendOn);
        show('#pie-chart-legend-align-row', legendOn);
        show('#pie-chart-legend-item-flow-row', legendOn);
        show('#pie-chart-legend-search-row', legendOn);
        show('#pie-chart-legend-value-display-row', legendOn);

        const labelPos = q('#pie-chart-label-position')?.value || 'inside';
        const labelsOn = labelPos !== 'hidden';
        show('#pie-chart-label-value-display-row', labelsOn);
        show('#pie-chart-label-show-name-row', labelsOn);

        const groupSmallOn = q('#pie-chart-group-small')?.checked !== false;
        show('#pie-chart-group-small-hint', groupSmallOn);
    }

    /**
     * Скрывает строки «текст/размер/цвет заголовка», если выключено «Показывать заголовок».
     * @param {'pie-chart'|'bar-chart'|'table'|'kpi'|'filter'|'line-chart'|'gauge'|'container'|'button-widget'|'data-input'} idPrefix
     */
    syncWidgetTitleSubRows(idPrefix) {
        if (!this.panel) return;
        const showCb = this.panel.querySelector(`#${idPrefix}-show-title`);
        const show = !!(showCb && showCb.checked);
        const tr = this.panel.querySelector(`#${idPrefix}-widget-title-row`);
        const sr = this.panel.querySelector(`#${idPrefix}-title-size-row`);
        const cr = this.panel.querySelector(`#${idPrefix}-title-color-row`);
        if (tr) tr.classList.toggle('widget-panel-title-sub--hidden', !show);
        if (sr) sr.classList.toggle('widget-panel-title-sub--hidden', !show);
        if (cr) cr.classList.toggle('widget-panel-title-sub--hidden', !show);
    }

    /**
     * @param {string} idPrefix
     * @param {string} [fallback='#8B5CF6']
     * @returns {string|null} valid #RRGGBB or null
     */
    readTitleColorFromPanel(idPrefix, fallback = '#8B5CF6') {
        const textEl = this.panel?.querySelector(`#${idPrefix}-title-color-text`);
        const pickEl = this.panel?.querySelector(`#${idPrefix}-title-color`);
        const raw = String(textEl?.value || pickEl?.value || '').trim();
        if (/^#[0-9a-fA-F]{6}$/i.test(raw)) return raw;
        if (/^#[0-9a-fA-F]{6}$/i.test(fallback)) return fallback;
        return null;
    }

    /**
     * @param {string} idPrefix
     * @param {string|null|undefined} color
     * @param {string} [fallback='#8B5CF6']
     */
    writeTitleColorToPanel(idPrefix, color, fallback = '#8B5CF6') {
        const raw = String(color || '').trim();
        const val = /^#[0-9a-fA-F]{6}$/i.test(raw) ? raw : fallback;
        const pickEl = this.panel?.querySelector(`#${idPrefix}-title-color`);
        const textEl = this.panel?.querySelector(`#${idPrefix}-title-color-text`);
        if (pickEl) pickEl.value = val;
        if (textEl) textEl.value = val;
    }

    /**
     * Sync color picker + text for title color; calls onChange on user edits.
     * @param {string} idPrefix
     * @param {() => void} onChange
     */
    wireTitleColorInputs(idPrefix, onChange) {
        const pickEl = this.panel?.querySelector(`#${idPrefix}-title-color`);
        const textEl = this.panel?.querySelector(`#${idPrefix}-title-color-text`);
        if (!pickEl || !textEl || pickEl._titleColorWired) return;
        pickEl._titleColorWired = true;
        pickEl.addEventListener('input', () => {
            textEl.value = pickEl.value;
            onChange();
        });
        textEl.addEventListener('change', () => {
            const raw = String(textEl.value || '').trim();
            if (/^#[0-9a-fA-F]{6}$/i.test(raw)) {
                pickEl.value = raw;
                onChange();
            }
        });
        textEl.addEventListener('input', () => {
            const raw = String(textEl.value || '').trim();
            if (/^#[0-9a-fA-F]{6}$/i.test(raw)) {
                pickEl.value = raw;
                onChange();
            }
        });
    }

    applyPieChartPanelSettings() {
        const w = this.resolveLiveWidget(this.currentWidget);
        if (!w || w.type !== 'pie-chart' || !w.settings) return;
        this.currentWidget = w;

        const showCb = this.panel.querySelector('#pie-chart-show-title');
        const titleInp = this.panel.querySelector('#pie-chart-widget-title');
        const sizeInp = this.panel.querySelector('#pie-chart-title-size');
        if (showCb) w.settings.showTitle = !!showCb.checked;
        if (titleInp) {
            const t = (titleInp.value || '').trim();
            w.settings.title = t.length ? t : 'Круговая диаграмма';
        }
        if (sizeInp) {
            let n = parseInt(sizeInp.value, 10);
            if (!Number.isFinite(n)) n = 14;
            w.settings.titleSize = Math.min(48, Math.max(8, n));
        }
        const pieTitleColor = this.readTitleColorFromPanel('pie-chart');
        if (pieTitleColor) w.settings.titleColor = pieTitleColor;

        const prevSlice = w.settings.pieSliceWeight || 'auto';
        const prevCenter = { ...(w.settings.center || {}) };
        const prevDonut = !!w.settings.donut;

        const donut = this.panel.querySelector('#pie-chart-donut');
        const innerR = this.panel.querySelector('#pie-chart-inner-radius');
        const segPad = this.panel.querySelector('#pie-chart-segment-pad');
        const colorModeEl = this.panel.querySelector('#pie-chart-color-mode');
        const solidEl = this.panel.querySelector('#pie-chart-solid-color');
        const labelPos = this.panel.querySelector('#pie-chart-label-position');
        const legPos = this.panel.querySelector('#pie-chart-legend-position');
        const legAlign = this.panel.querySelector('#pie-chart-legend-align');
        const legFlow = this.panel.querySelector('#pie-chart-legend-item-flow');
        const legOn = this.panel.querySelector('#pie-chart-show-legend');

        w.settings.donut = !!(donut && donut.checked);
        if (innerR) {
            let ir = parseFloat(innerR.value);
            if (!Number.isFinite(ir)) ir = 0.58;
            w.settings.innerRadius = Math.min(0.92, Math.max(0, ir));
        }
        if (segPad) {
            let sp = parseFloat(segPad.value);
            if (!Number.isFinite(sp)) sp = 0.04;
            w.settings.segmentPad = Math.min(0.35, Math.max(0, sp));
        }

        const pieColorMode = ['gradient', 'solid', 'palette'].includes(colorModeEl?.value)
            ? colorModeEl.value
            : 'palette';
        w.settings.pieColorMode = pieColorMode;
        if (solidEl?.value) w.settings.pieSolidColor = solidEl.value;
        const piePalette = this.collectPiePaletteColorsFromPanel();
        if (piePalette.length) {
            w.settings.colors = piePalette;
            w.settings.paletteFormulas = this.collectPiePaletteFormulasFromPanel();
            w.settings.colorMode = 'custom';
        } else if (pieColorMode === 'solid') {
            w.settings.colorMode = 'custom';
            w.settings.colors = [w.settings.pieSolidColor || '#00E0FF'];
            delete w.settings.paletteFormulas;
        }
        if (!w.settings.gradients) w.settings.gradients = {};
        w.settings.gradients.enabled = pieColorMode === 'gradient';
        w.settings.gradients.type = 'radial';
        if (!w.settings.labels) w.settings.labels = {};
        if (labelPos && labelPos.value) w.settings.labels.position = labelPos.value;
        const labelValueDisp = this.panel.querySelector('#pie-chart-label-value-display');
        if (labelValueDisp?.value) {
            const m = String(labelValueDisp.value).toLowerCase();
            w.settings.labels.valueDisplay = ['percent', 'value', 'both', 'none'].includes(m) ? m : 'percent';
            w.settings.labels.showPercent =
                w.settings.labels.valueDisplay === 'percent' || w.settings.labels.valueDisplay === 'both';
            w.settings.labels.showValue =
                w.settings.labels.valueDisplay === 'value' || w.settings.labels.valueDisplay === 'both';
        }
        const labelShowName = this.panel.querySelector('#pie-chart-label-show-name');
        if (labelShowName) w.settings.labels.showName = !!labelShowName.checked;
        if (!w.settings.legend) w.settings.legend = {};
        if (legPos && legPos.value) w.settings.legend.position = legPos.value;
        if (legAlign && legAlign.value) w.settings.legend.align = legAlign.value;
        if (legFlow && legFlow.value) w.settings.legend.itemFlow = legFlow.value;
        const groupSmall = this.panel.querySelector('#pie-chart-group-small');
        w.settings.legend.groupSmallIntoOther = !!(groupSmall && groupSmall.checked);
        const legSearch = this.panel.querySelector('#pie-chart-legend-search');
        if (legSearch) w.settings.legend.searchEnabled = !!legSearch.checked;
        const enabled = !(legOn && !legOn.checked);
        w.settings.showLegend = enabled;
        w.settings.legend.enabled = enabled;
        const legendValueDisp = this.panel.querySelector('#pie-chart-legend-value-display');
        if (legendValueDisp?.value) {
            const m = String(legendValueDisp.value).toLowerCase();
            w.settings.legend.valueDisplay = ['percent', 'value', 'both', 'none'].includes(m) ? m : 'percent';
            w.settings.legend.showPercent =
                w.settings.legend.valueDisplay === 'percent' || w.settings.legend.valueDisplay === 'both';
            w.settings.legend.showValue =
                w.settings.legend.valueDisplay === 'value' || w.settings.legend.valueDisplay === 'both';
        }

        const sliceSel = this.panel.querySelector('#pie-chart-slice-weight');
        if (sliceSel) {
            const sw = sliceSel.value;
            w.settings.pieSliceWeight =
                sw === 'sum' || sw === 'count' ? sw : 'auto';
        }

        const oldPieThr = String(w.settings.pieSliceThresholdFormula || '').trim();
        const pieThrTa = this.panel.querySelector('#pie-chart-slice-threshold-formula');
        if (pieThrTa) w.settings.pieSliceThresholdFormula = pieThrTa.value || '';
        const pieHi = this.panel.querySelector('#pie-chart-slice-above-color');
        const pieLo = this.panel.querySelector('#pie-chart-slice-below-color');
        if (pieHi?.value) w.settings.pieSliceAboveColor = pieHi.value;
        if (pieLo?.value) w.settings.pieSliceBelowColor = pieLo.value;
        const pieThrChanged = oldPieThr !== String(w.settings.pieSliceThresholdFormula || '').trim();
        if (
            pieThrChanged &&
            this.engine &&
            typeof w.reloadFromDataModel === 'function' &&
            w.settings.bindingDimension?.modelId
        ) {
            void w.reloadFromDataModel(this.engine);
            eventBus.emit('widget:settings-changed', { widget: w });
            return;
        }

        if (!w.settings.center) w.settings.center = {};
        const cEn = this.panel.querySelector('#pie-chart-center-enabled');
        const centerOn = cEn ? !!cEn.checked : true;
        if (cEn) w.settings.center.enabled = centerOn;
        const cSrc = this.panel.querySelector('#pie-chart-center-source');
        const nextSrc = cSrc?.value === 'measure' ? 'measure' : 'segments';
        w.settings.center.valueSource = nextSrc;
        const cSeg = this.panel.querySelector('#pie-chart-center-seg-aggregate');
        if (cSeg && cSeg.value) w.settings.center.segmentAggregate = cSeg.value;
        const cMeas = this.panel.querySelector('#pie-chart-center-measure-fn');
        if (cMeas && cMeas.value) w.settings.center.measureFn = cMeas.value;
        const cFmt = this.panel.querySelector('#pie-chart-center-number-format');
        if (cFmt && cFmt.value) w.settings.center.numberFormat = cFmt.value;
        const cTpl = this.panel.querySelector('#pie-chart-center-template');
        if (cTpl) {
            const t = (cTpl.value || '').trim();
            w.settings.center.template = t || '{total}';
        }

        if (nextSrc === 'segments') {
            delete w.settings.centerMeasureValue;
        }

        this.syncPieCenterSourceUi();

        const sliceChanged = (w.settings.pieSliceWeight || 'auto') !== prevSlice;
        if (
            sliceChanged &&
            this.engine &&
            typeof w.reloadFromDataModel === 'function' &&
            w.settings.bindingDimension?.modelId
        ) {
            void w.reloadFromDataModel(this.engine);
            eventBus.emit('widget:settings-changed', { widget: w });
            return;
        }

        const needsCenterReload =
            nextSrc === 'measure' &&
            w.settings.donut &&
            centerOn &&
            this.engine &&
            typeof w.reloadFromDataModel === 'function' &&
            w.settings.bindingDimension?.modelId &&
            (prevCenter.valueSource !== 'measure' ||
                prevCenter.measureFn !== w.settings.center.measureFn ||
                (!prevDonut && w.settings.donut));

        if (needsCenterReload) {
            void w.reloadFromDataModel(this.engine);
        } else {
            w.update();
        }
        eventBus.emit('widget:settings-changed', { widget: w });
    }
    
    openGaugeFormulaEditorModal() {
        const taPanel = this.panel.querySelector('#gauge-value-formula');
        const w = this.currentWidget;
        const initial = taPanel?.value ?? w?.settings?.valueFormula ?? '';
        this.openFormulaEditorModal({
            title: 'Редактор формулы датчика',
            initialFormula: String(initial),
            applyButtonText: 'Применить к датчику',
            onApply: (formula) => {
                if (taPanel) taPanel.value = formula;
                const src = this.panel?.querySelector('#gauge-value-source');
                if (src) {
                    src.value = 'formula_value';
                    this.syncGaugePanelDependentUi();
                }
                this.updateGaugeSettings();
            },
        });
    }

    /** Показ / скрытие полей панели датчика по режиму. */
    syncGaugePanelDependentUi() {
        if (!this.panel) return;
        const src =
            this.panel.querySelector('#gauge-value-source')?.value || 'static_value';
        const fmt = this.panel.querySelector('#gauge-value-format')?.value || 'number';
        const fillMode = this.panel.querySelector('#gauge-fill-color-mode')?.value || 'static';
        const gtype = this.panel.querySelector('#gauge-style-type')?.value || 'arc';
        const agg = this.panel.querySelector('#gauge-aggregation')?.value || 'sum';
        const showVal =
            this.panel.querySelector('#gauge-show-value')?.checked !== false;

        const show = (id, on) => {
            const el = this.panel.querySelector(id);
            if (el) el.style.display = on ? '' : 'none';
        };

        show('#gauge-static-value-row', src === 'static_value');
        show('#gauge-aggregation-row', src === 'aggregated_value');
        show('#gauge-count-mode-row', src === 'aggregated_value' && agg === 'count');
        show('#gauge-formula-block', src === 'formula_value');
        show('#gauge-field-binding-hint', src === 'field_value' || src === 'aggregated_value');

        /** Центральная подпись: формат имеет смысл только когда число показывается */
        show('#gauge-value-format-row', showVal);
        show('#gauge-percent-mode-row', showVal && fmt === 'percent');
        show('#gauge-value-precision-row', showVal);
        show('#gauge-number-notation-row', showVal && fmt === 'number');
        show('#gauge-custom-pattern-row', showVal && fmt === 'custom');
        show('#gauge-value-suffix-row', showVal && fmt === 'number');
        show('#gauge-value-text-appearance-row', showVal);

        show('#gauge-fill-color-static-row', fillMode === 'static');
        show('#gauge-gradient-row', fillMode === 'gradient');
        show('#gauge-range-rules-row', fillMode === 'range');
        show('#gauge-donut-ratio-row', gtype === 'donut');
        show('#gauge-thin-sweep-row', gtype === 'thin_line');
        show('#gauge-segmented-row', gtype === 'segmented');
        show('#gauge-progress-bar-radius-row', gtype === 'progress_bar');
        show('#gauge-dial-row', gtype !== 'progress_bar');
        show('#gauge-round-caps-row', gtype !== 'progress_bar');

        const indWrap = this.panel.querySelector('#gauge-indicator-only-wrap');
        if (indWrap) indWrap.style.display = gtype === 'progress_bar' ? 'none' : '';

        const thickLab = this.panel.querySelector('#gauge-thickness-label');
        if (thickLab) {
            thickLab.textContent = gtype === 'progress_bar' ? 'Толщина полосы' : 'Толщина дуги';
        }
        const thickSlider = this.panel.querySelector('#gauge-thickness');
        if (thickSlider) {
            thickSlider.max = gtype === 'progress_bar' ? '80' : '32';
            const cur = parseInt(thickSlider.value, 10);
            const cap = parseInt(thickSlider.max, 10);
            if (Number.isFinite(cur) && Number.isFinite(cap) && cur > cap) thickSlider.value = String(cap);
        }
    }

    /**
     * Число-литерал vs формула в одном поле панели датчика.
     * @param {string} raw
     * @returns {{ literal: number|null, formula: string }}
     */
    parseGaugeNumericOrFormula(raw) {
        const s = String(raw ?? '').trim();
        if (!s) return { literal: null, formula: '' };
        const n = Number(s);
        if (Number.isFinite(n) && String(n) === s) {
            return { literal: n, formula: '' };
        }
        // «40.0» / «.5» — тоже литералы
        if (Number.isFinite(n) && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) {
            return { literal: n, formula: '' };
        }
        return { literal: null, formula: s };
    }

    /**
     * @param {Array<{ id?: string, label?: string, value?: number|null, formula?: string, color?: string }>} targets
     */
    renderGaugeTargetsList(targets) {
        const list = this.panel?.querySelector('#gauge-targets-list');
        if (!list) return;
        const items = Array.isArray(targets) ? targets : [];
        if (!items.length) {
            list.innerHTML =
                '<div class="gauge-targets-empty">Нет целей — добавьте или выберите пресет.</div>';
            return;
        }
        list.innerHTML = items
            .map((raw, index) => {
                const t = createGaugeTarget(raw || {});
                const fid = `gauge-target-formula-${t.id}`;
                const threshold =
                    String(t.formula || '').trim() ||
                    (t.value != null && Number.isFinite(Number(t.value)) ? String(t.value) : '');
                const fxBtn = this.formulaEditorOpenButton(
                    `data-formula-mode="direct" data-formula-target-id="${fid}" data-formula-apply="gauge"`,
                );
                return `<div class="gauge-target-card" data-target-id="${t.id}">
                    <div class="gauge-target-card-head">
                        <span class="gauge-target-card-index">${index + 1}</span>
                        <input type="color" class="style-input gauge-target-color" value="${t.color}" title="Цвет зоны" aria-label="Цвет зоны">
                        <input type="text" class="style-input gauge-target-label" value="${String(t.label || '').replace(/"/g, '&quot;')}" placeholder="Подпись" aria-label="Подпись">
                        <button type="button" class="gauge-target-remove" title="Удалить" aria-label="Удалить цель">×</button>
                    </div>
                    <div class="gauge-target-card-formula">
                        <div class="formula-label-with-btn">
                            <label class="style-label" for="${fid}">Порог (число / формула)</label>
                            ${fxBtn}
                        </div>
                        <textarea class="style-input gauge-formula-ta gauge-target-formula" id="${fid}" rows="1" spellcheck="false" placeholder="40 или AVG([t.x])">${String(threshold).replace(/</g, '&lt;')}</textarea>
                    </div>
                </div>`;
            })
            .join('');

        list.querySelectorAll('textarea.gauge-formula-ta').forEach((ta) => {
            if (ta._gaugeScaleFormulaDebounced) return;
            ta._gaugeScaleFormulaDebounced = true;
            let debounce = null;
            ta.addEventListener('input', () => {
                if (debounce) clearTimeout(debounce);
                debounce = setTimeout(() => {
                    debounce = null;
                    this.updateGaugeSettings();
                }, 400);
            });
        });
    }

    /**
     * @returns {Array<{ id: string, label: string, value: number|null, formula: string, color: string }>}
     */
    collectGaugeTargetsFromPanel() {
        const list = this.panel?.querySelector('#gauge-targets-list');
        if (!list) return [];
        /** @type {ReturnType<typeof createGaugeTarget>[]} */
        const out = [];
        list.querySelectorAll('.gauge-target-card').forEach((card) => {
            if (out.length >= GAUGE_TARGETS_MAX) return;
            const id = String(card.getAttribute('data-target-id') || '').trim();
            const color = card.querySelector('.gauge-target-color')?.value || '#f59e0b';
            const label = card.querySelector('.gauge-target-label')?.value || '';
            const parsed = this.parseGaugeNumericOrFormula(
                card.querySelector('.gauge-target-formula')?.value || '',
            );
            out.push(
                createGaugeTarget({
                    id,
                    label,
                    value: parsed.literal,
                    formula: parsed.formula,
                    color,
                }),
            );
        });
        return out;
    }

    setupGaugeListeners() {
        if (!this.panel || this.panel._aicGaugeListenersDelegated) return;
        this.panel._aicGaugeListenersDelegated = true;

        const inGauge = (t) => t && this.panel.contains(t) && t.closest('.gauge-settings-section');

        this.panel.addEventListener('click', (e) => {
            const t = e.target;
            if (!inGauge(t)) return;
            const addBtn = t.closest?.('#gauge-target-add');
            if (addBtn) {
                e.preventDefault();
                const cur = this.collectGaugeTargetsFromPanel();
                if (cur.length >= GAUGE_TARGETS_MAX) return;
                cur.push(createGaugeTarget({ label: '', value: null, color: '#f59e0b' }));
                this.renderGaugeTargetsList(cur);
                this.updateGaugeSettings();
                return;
            }
            const rm = t.closest?.('.gauge-target-remove');
            if (rm) {
                e.preventDefault();
                const card = rm.closest('.gauge-target-card');
                card?.remove();
                this.renderGaugeTargetsList(this.collectGaugeTargetsFromPanel());
                this.updateGaugeSettings();
                return;
            }
            const presetBtn = t.closest?.('[data-gauge-target-preset]');
            if (presetBtn) {
                e.preventDefault();
                const key = presetBtn.getAttribute('data-gauge-target-preset');
                const presets = getGaugeTargetPresets();
                const preset = presets[key];
                if (!preset) return;
                const minParsed = this.parseGaugeNumericOrFormula(
                    this.panel.querySelector('#gauge-min-formula')?.value || '',
                );
                const maxParsed = this.parseGaugeNumericOrFormula(
                    this.panel.querySelector('#gauge-max-formula')?.value || '',
                );
                const min =
                    minParsed.literal != null
                        ? minParsed.literal
                        : Number(this.currentWidget?.settings?.min);
                const max =
                    maxParsed.literal != null
                        ? maxParsed.literal
                        : Number(this.currentWidget?.settings?.max);
                const next = preset.apply(
                    Number.isFinite(min) ? min : 0,
                    Number.isFinite(max) ? max : 100,
                );
                this.renderGaugeTargetsList(next);
                this.updateGaugeSettings();
            }
        });

        this.panel.addEventListener('input', (e) => {
            const t = e.target;
            if (!inGauge(t)) return;
            const id = t?.id || '';
            const inTargetCard = !!t.closest?.('.gauge-target-card');
            if (!id.startsWith('gauge-') && !inTargetCard) return;

            if (id === 'gauge-thickness') {
                const lab = this.panel.querySelector('#gauge-thickness-value');
                if (lab) lab.textContent = t.value + 'px';
            }
            if (id === 'gauge-progress-bar-radius') {
                const lab = this.panel.querySelector('#gauge-progress-bar-radius-value');
                if (lab) lab.textContent = `${t.value} px`;
            }
            if (id === 'gauge-dial-rotation') {
                const lab = this.panel.querySelector('#gauge-dial-rotation-value');
                if (lab) lab.textContent = `${t.value}°`;
            }
            if (id === 'gauge-donut-inner-ratio') {
                const lab = this.panel.querySelector('#gauge-donut-inner-ratio-value');
                if (lab) lab.textContent = t.value;
            }
            if (id === 'gauge-thin-sweep') {
                const lab = this.panel.querySelector('#gauge-thin-sweep-value');
                if (lab) lab.textContent = `${t.value}°`;
            }
            if (id === 'gauge-fill-color') {
                const tx = this.panel.querySelector('#gauge-fill-color-text');
                if (tx) tx.value = t.value;
            }
            if (id === 'gauge-fill-color-text') {
                const c = this.panel.querySelector('#gauge-fill-color');
                if (c && /^#[0-9a-fA-F]{6}$/i.test(t.value)) c.value = t.value;
            }
            if (id === 'gauge-track-color') {
                const tx = this.panel.querySelector('#gauge-track-color-text');
                if (tx) tx.value = t.value;
            }
            if (id === 'gauge-track-color-text') {
                const c = this.panel.querySelector('#gauge-track-color');
                if (c && /^#[0-9a-fA-F]{6}$/i.test(t.value)) c.value = t.value;
            }
            if (id === 'gauge-neon-color') {
                const tx = this.panel.querySelector('#gauge-neon-color-text');
                if (tx) tx.value = t.value;
            }
            if (id === 'gauge-neon-color-text') {
                const c = this.panel.querySelector('#gauge-neon-color');
                if (c && /^#[0-9a-fA-F]{6}$/i.test(t.value)) c.value = t.value;
            }
            if (id === 'gauge-gradient-a') {
                const tx = this.panel.querySelector('#gauge-gradient-a-text');
                if (tx) tx.value = t.value;
            }
            if (id === 'gauge-gradient-a-text') {
                const c = this.panel.querySelector('#gauge-gradient-a');
                if (c && /^#[0-9a-fA-F]{6}$/i.test(t.value)) c.value = t.value;
            }
            if (id === 'gauge-gradient-b') {
                const tx = this.panel.querySelector('#gauge-gradient-b-text');
                if (tx) tx.value = t.value;
            }
            if (id === 'gauge-gradient-b-text') {
                const c = this.panel.querySelector('#gauge-gradient-b');
                if (c && /^#[0-9a-fA-F]{6}$/i.test(t.value)) c.value = t.value;
            }
            if (id === 'gauge-indicator-color') {
                const tx = this.panel.querySelector('#gauge-indicator-color-text');
                if (tx) tx.value = t.value;
            }
            if (id === 'gauge-indicator-color-text') {
                const c = this.panel.querySelector('#gauge-indicator-color');
                if (c && /^#[0-9a-fA-F]{6}$/i.test(t.value)) c.value = t.value;
            }
            if (id === 'gauge-value-text-color') {
                const tx = this.panel.querySelector('#gauge-value-text-color-text');
                if (tx) tx.value = t.value;
                this.updateTypographyPreview();
            }
            if (id === 'gauge-value-text-color-text') {
                const c = this.panel.querySelector('#gauge-value-text-color');
                if (c && /^#[0-9a-fA-F]{6}$/i.test(t.value)) c.value = t.value;
                this.updateTypographyPreview();
            }

            if (
                id === 'gauge-value-source' ||
                id === 'gauge-value-format' ||
                id === 'gauge-fill-color-mode' ||
                id === 'gauge-style-type' ||
                id === 'gauge-aggregation' ||
                id === 'gauge-value-number-notation' ||
                id === 'gauge-show-value'
            ) {
                this.syncGaugePanelDependentUi();
            }

            this.updateGaugeSettings();
        });

        this.panel.addEventListener('change', (e) => {
            const t = e.target;
            if (!inGauge(t)) return;
            const id = t?.id || '';
            if (id === 'gauge-neon-enabled') {
                const neonControls = this.panel.querySelector('#gauge-neon-controls');
                if (neonControls) neonControls.style.display = t.checked ? 'block' : 'none';
            }
            if (
                id === 'gauge-value-source' ||
                id === 'gauge-value-format' ||
                id === 'gauge-fill-color-mode' ||
                id === 'gauge-style-type' ||
                id === 'gauge-aggregation' ||
                id === 'gauge-value-number-notation' ||
                id === 'gauge-show-value'
            ) {
                this.syncGaugePanelDependentUi();
            }
            if (
                id.startsWith('gauge-') &&
                id !== 'gauge-value-formula' &&
                !id.endsWith('-formula')
            ) {
                this.updateGaugeSettings();
            }
        });

        let formulaDebounce = null;
        const ta = this.panel.querySelector('#gauge-value-formula');

        const gaugeSection = this.panel.querySelector('.gauge-settings-section');

        const taList = gaugeSection
            ? gaugeSection.querySelectorAll('textarea.gauge-formula-ta')
            : [];
        taList.forEach((ta) => {
            if (ta._gaugeScaleFormulaDebounced) return;
            ta._gaugeScaleFormulaDebounced = true;
            ta.addEventListener('input', () => {
                if (formulaDebounce) clearTimeout(formulaDebounce);
                formulaDebounce = setTimeout(() => {
                    formulaDebounce = null;
                    this.updateGaugeSettings();
                }, 400);
            });
        });
        if (ta && !ta._gaugeFormulaDebounced) {
            ta._gaugeFormulaDebounced = true;
            ta.addEventListener('input', () => {
                if (formulaDebounce) clearTimeout(formulaDebounce);
                formulaDebounce = setTimeout(() => {
                    formulaDebounce = null;
                    this.updateGaugeSettings();
                }, 400);
            });
        }
        this.wireTitleColorInputs('gauge', () => this.updateGaugeSettings());
    }
    
    updateGaugeSettings() {
        let w = this.resolveLiveWidget(this.currentWidget);
        if (!w || w.type !== 'gauge') {
            const sel = this.engine?.widgetManager?.getSelectedWidgets?.() || [];
            w = sel.find((x) => x?.type === 'gauge') || null;
        }
        if (!w || w.type !== 'gauge') return;
        this.currentWidget = w;

        const pickGaugeDataSig = (s) => ({
            valueSource: s.valueSource,
            staticValue: s.staticValue,
            aggregation: s.aggregation,
            countMode: s.countMode,
            valueFormula: String(s.valueFormula || '').trim(),
            minFormula: String(s.minFormula || '').trim(),
            maxFormula: String(s.maxFormula || '').trim(),
            targets: (Array.isArray(s.targets) ? s.targets : []).map((t) => ({
                id: t.id,
                formula: String(t.formula || '').trim(),
                value: t.value,
            })),
        });
        const before = pickGaugeDataSig(w.settings);

        const q = (sel) => this.panel.querySelector(sel);

        let rangeColorRules = [];
        const jsonRaw = (q('#gauge-range-rules-json')?.value || '').trim();
        if (jsonRaw) {
            try {
                const parsed = JSON.parse(jsonRaw);
                if (Array.isArray(parsed)) rangeColorRules = parsed;
            } catch {
                /* ignore malformed JSON */
            }
        }

        const indSizeRaw = q('#gauge-indicator-size')?.value;
        let indicatorSize = null;
        if (indSizeRaw !== '' && indSizeRaw != null) {
            const n = parseInt(indSizeRaw, 10);
            if (Number.isFinite(n)) indicatorSize = n;
        }

        const targets = this.collectGaugeTargetsFromPanel();
        const targetsPaintTrack = q('#gauge-targets-paint-track')?.checked !== false;

        const indColorTxt = (q('#gauge-indicator-color-text')?.value || '').trim();
        let indicatorColor = '';
        if (indColorTxt) indicatorColor = indColorTxt;
        else if (q('#gauge-indicator-color')?.value) indicatorColor = q('#gauge-indicator-color').value;

        const staticRaw = q('#gauge-static-value')?.value;
        const staticValue =
            staticRaw === '' || staticRaw == null ? null : Number(staticRaw);

        const thickness = parseInt(q('#gauge-thickness')?.value, 10) || 16;
        const dialRotRaw = q('#gauge-dial-rotation')?.value;
        const dialRotation = dialRotRaw !== undefined && dialRotRaw !== '' ? parseInt(dialRotRaw, 10) : 0;
        const fillColor = q('#gauge-fill-color')?.value || '#00ff80';
        const trackColor = q('#gauge-track-color')?.value || '#ffffff';
        const neonEnabled = q('#gauge-neon-enabled')?.checked !== false;
        const neonColor = q('#gauge-neon-color')?.value || '#78ff82';

        let gaugeTextColor = (q('#gauge-value-text-color-text')?.value || '').trim();
        if (!/^#[0-9a-fA-F]{6}$/i.test(gaugeTextColor)) {
            const gcp = q('#gauge-value-text-color')?.value || '#ffffff';
            gaugeTextColor = /^#[0-9a-fA-F]{6}$/i.test(gcp) ? gcp : '#ffffff';
        }
        const valueNumberNotation =
            q('#gauge-value-number-notation')?.value === 'compact' ? 'compact' : 'standard';

        w.updateSettings({
            valueSource: q('#gauge-value-source')?.value || 'static_value',
            staticValue,
            aggregation: q('#gauge-aggregation')?.value || 'sum',
            countMode: q('#gauge-count-mode')?.value || 'rows',
            valueFormula: q('#gauge-value-formula')?.value || '',
            minFormula: (() => {
                const p = this.parseGaugeNumericOrFormula(q('#gauge-min-formula')?.value || '');
                return p.formula;
            })(),
            maxFormula: (() => {
                const p = this.parseGaugeNumericOrFormula(q('#gauge-max-formula')?.value || '');
                return p.formula;
            })(),
            min: (() => {
                const raw = q('#gauge-min-formula')?.value || '';
                if (!String(raw).trim()) return 0;
                const p = this.parseGaugeNumericOrFormula(raw);
                if (p.literal != null) return p.literal;
                const cur = Number(w.settings?.min);
                return Number.isFinite(cur) ? cur : 0;
            })(),
            max: (() => {
                const raw = q('#gauge-max-formula')?.value || '';
                if (!String(raw).trim()) return 100;
                const p = this.parseGaugeNumericOrFormula(raw);
                if (p.literal != null) return p.literal;
                const cur = Number(w.settings?.max);
                return Number.isFinite(cur) ? cur : 100;
            })(),
            targets,
            targetsPaintTrack,
            targetValue: null,
            targetFormula: '',
            showValue: q('#gauge-show-value')?.checked !== false,
            showTitle: !!q('#gauge-show-title')?.checked,
            title: (() => {
                const t = (q('#gauge-widget-title')?.value || '').trim();
                return t.length ? t : 'Датчик';
            })(),
            titleSize: (() => {
                let n = parseInt(q('#gauge-title-size')?.value, 10);
                if (!Number.isFinite(n)) n = 14;
                return Math.min(48, Math.max(8, n));
            })(),
            titleColor: this.readTitleColorFromPanel('gauge') || '#8B5CF6',
            valueFormat: q('#gauge-value-format')?.value || 'percent',
            valuePercentMode: q('#gauge-value-percent-mode')?.value || 'of_range',
            valuePrecision: parseInt(q('#gauge-value-precision')?.value, 10) || 0,
            valueCustomPattern: q('#gauge-value-custom-pattern')?.value || '{value}',
            valueSuffix: q('#gauge-value-suffix')?.value ?? '%',
            valueNumberNotation,
            textColor: gaugeTextColor,
            fillColorMode: q('#gauge-fill-color-mode')?.value || 'static',
            gradientColorA: q('#gauge-gradient-a')?.value || '#00ff80',
            gradientColorB: q('#gauge-gradient-b')?.value || '#00f0ff',
            rangeColorRules,
            gaugeStyleType: q('#gauge-style-type')?.value || 'arc',
            donutInnerRatio: parseFloat(q('#gauge-donut-inner-ratio')?.value) || 0.62,
            thinLineSweepDeg: parseInt(q('#gauge-thin-sweep')?.value, 10) || 300,
            segmentedCount: parseInt(q('#gauge-segmented-count')?.value, 10) || 12,
            segmentedGapDeg: parseFloat(q('#gauge-segmented-gap')?.value) || 3,
            progressBarCornerRadius: parseInt(q('#gauge-progress-bar-radius')?.value, 10) || 10,
            indicatorType: q('#gauge-indicator-type')?.value || 'dot',
            indicatorSize,
            indicatorColor,
            animationEnabled: q('#gauge-animation-enabled')?.checked !== false,
            interactionEnabled: q('#gauge-interaction-enabled')?.checked === true,
            thickness,
            dialRotation: Number.isFinite(dialRotation) ? Math.max(-180, Math.min(180, dialRotation)) : 0,
            fillColor,
            gaugeColor: trackColor,
            neonEnabled,
            neonColor,
            roundCaps: q('#gauge-round-caps')?.checked !== false,
        });

        const after = pickGaugeDataSig(w.settings);
        const dataChanged = JSON.stringify(before) !== JSON.stringify(after);
        if (dataChanged && this.engine && typeof w.reloadFromDataModel === 'function') {
            void w.reloadFromDataModel(this.engine);
        }

        this.syncWidgetTitleSubRows('gauge');
        eventBus.emit('widget:settings-changed', { widget: w });
    }
    
    setupContainerTabPositionListeners() {
        const section = this.panel.querySelector('.container-tab-position-section');
        if (section && !section._containerTitleBound) {
            section._containerTitleBound = true;
            const applyTitle = () => this.updateContainerWidgetTitle();
            section.addEventListener('change', (e) => {
                const id = e.target?.id || '';
                if (id.startsWith('container-show-title') || id.startsWith('container-widget-title') || id.startsWith('container-title-')) {
                    applyTitle();
                }
            });
            section.addEventListener('input', (e) => {
                const id = e.target?.id || '';
                if (id.startsWith('container-widget-title') || id.startsWith('container-title-')) {
                    applyTitle();
                }
            });
            this.wireTitleColorInputs('container', applyTitle);
        }

        const tabPositionSelect = this.panel.querySelector('#container-tab-position');
        if (tabPositionSelect && !tabPositionSelect._aicContainerTabBound) {
            tabPositionSelect._aicContainerTabBound = true;
            tabPositionSelect.addEventListener('change', () => {
                this.updateContainerTabPosition();
            });
        }

        const slotsSelect = this.panel.querySelector('#container-slots-per-tab');
        if (slotsSelect && !slotsSelect._aicContainerSlotsBound) {
            slotsSelect._aicContainerSlotsBound = true;
            slotsSelect.addEventListener('change', () => {
                this.updateContainerSlotsPerTab();
            });
        }
        
        const contentCollapsedToggle = this.panel.querySelector('#container-content-collapsed');
        if (contentCollapsedToggle && !contentCollapsedToggle._aicContainerCollapsedBound) {
            contentCollapsedToggle._aicContainerCollapsedBound = true;
            contentCollapsedToggle.addEventListener('change', () => {
                this.updateContainerContentCollapsed();
            });
        }
    }

    updateContainerWidgetTitle() {
        if (!this.currentWidget || this.currentWidget.type !== 'container') return;
        if (!this.currentWidget.settings || typeof this.currentWidget.settings !== 'object') {
            this.currentWidget.settings = {};
        }
        this.applyWidgetTitleSettingsFromPanel(this.currentWidget, 'container', {
            defaultTitle: 'Шкаф',
        });
        if (typeof this.currentWidget.updateSettings === 'function') {
            this.currentWidget.updateSettings({
                showTitle: this.currentWidget.settings.showTitle,
                title: this.currentWidget.settings.title,
                titleSize: this.currentWidget.settings.titleSize,
                titleColor: this.currentWidget.settings.titleColor,
            });
        } else if (typeof this.currentWidget.update === 'function') {
            this.currentWidget.update();
        }
        eventBus.emit('widget:settings-changed', { widget: this.currentWidget });
        eventBus.emit('widget:styles-changed', { widget: this.currentWidget });
    }
    
    updateContainerTabPosition() {
        if (!this.currentWidget || this.currentWidget.type !== 'container') return;
        
        const tabPosition = this.panel.querySelector('#container-tab-position')?.value || 'top';
        
        if (this.currentWidget.updateSettings) {
            this.currentWidget.updateSettings({
                tabPosition: tabPosition
            });
        }
    }
    
    updateContainerContentCollapsed() {
        if (!this.currentWidget || this.currentWidget.type !== 'container') return;
        
        const contentCollapsed = this.panel.querySelector('#container-content-collapsed')?.checked || false;
        
        if (this.currentWidget.updateSettings) {
            this.currentWidget.updateSettings({
                contentCollapsed: contentCollapsed
            });
        }
    }

    updateContainerSlotsPerTab() {
        if (!this.currentWidget || this.currentWidget.type !== 'container') return;

        const sel = this.panel.querySelector('#container-slots-per-tab');
        let n = parseInt(sel?.value, 10);
        if (!Number.isFinite(n)) n = 1;
        n = Math.min(4, Math.max(1, n));

        if (this.currentWidget.updateSettings) {
            this.currentWidget.updateSettings({ slotsPerTab: n });
        }

        this.updateTabsList(this.currentWidget);
        eventBus.emit('widget:styles-changed', { widget: this.currentWidget });
        if (this.engine && this.engine.saveSnapshot) {
            this.engine.saveSnapshot();
        }
    }

    setupAlignmentListeners() {
        const alignmentButtons = this.panel.querySelectorAll('.alignment-btn');
        
        alignmentButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const align = btn.dataset.align;
                if (!align || !this.currentWidget) return;
                
                // Убираем активный класс со всех кнопок в той же группе
                const isHorizontal = ['left', 'center', 'right'].includes(align);
                const group = isHorizontal 
                    ? ['left', 'center', 'right']
                    : ['top', 'middle', 'bottom'];
                
                group.forEach(alignType => {
                    const groupBtn = this.panel.querySelector(`[data-align="${alignType}"]`);
                    if (groupBtn) {
                        groupBtn.classList.remove('active');
                    }
                });
                
                // Добавляем активный класс к выбранной кнопке
                btn.classList.add('active');
                
                // Применяем выравнивание
                this.applyAlignment(align);
            });
        });
    }

    applyAlignment(align) {
        if (!this.currentWidget) return;
        
        // Получаем viewport элемент
        const viewport = document.getElementById('viewport');
        if (!viewport) return;
        
        // Получаем размеры viewport
        const viewportRect = viewport.getBoundingClientRect();
        const viewportWidth = viewportRect.width;
        const viewportHeight = viewportRect.height;
        
        // Используем viewportController для точных вычислений, если доступен
        let zoom = 1;
        let offsetX = 0;
        let offsetY = 0;
        
        if (this.viewportController) {
            zoom = this.viewportController.zoom || 1;
            offsetX = this.viewportController.offsetX || 0;
            offsetY = this.viewportController.offsetY || 0;
        } else {
            // Fallback: пытаемся получить из workspace transform
            const workspace = document.getElementById('workspace');
            if (workspace) {
                const transform = workspace.style.transform || '';
                const zoomMatch = transform.match(/scale\(([^)]+)\)/);
                const translateMatch = transform.match(/translate\(([^)]+)\)/);
                
                if (zoomMatch) {
                    zoom = parseFloat(zoomMatch[1]) || 1;
                }
                
                if (translateMatch) {
                    const coords = translateMatch[1].split(',').map(s => s.trim());
                    offsetX = parseFloat(coords[0]) || 0;
                    offsetY = parseFloat(coords[1]) || 0;
                }
            }
        }
        
        // Преобразуем размеры viewport в координаты workspace
        const workspaceWidth = viewportWidth / zoom;
        const workspaceHeight = viewportHeight / zoom;
        
        // Вычисляем новые координаты виджета
        let newX = this.currentWidget.x;
        let newY = this.currentWidget.y;
        
        // Используем viewportController для преобразования координат, если доступен
        if (this.viewportController) {
            // Горизонтальное выравнивание
            if (align === 'left') {
                const leftPos = this.viewportController.viewportToWorkspace(0, 0);
                newX = leftPos.x;
            } else if (align === 'center') {
                const centerPos = this.viewportController.viewportToWorkspace(viewportWidth / 2, 0);
                newX = centerPos.x - (this.currentWidget.width / 2);
            } else if (align === 'right') {
                const rightPos = this.viewportController.viewportToWorkspace(viewportWidth, 0);
                newX = rightPos.x - this.currentWidget.width;
            }
            
            // Вертикальное выравнивание
            if (align === 'top') {
                const topPos = this.viewportController.viewportToWorkspace(0, 0);
                newY = topPos.y;
            } else if (align === 'middle') {
                const middlePos = this.viewportController.viewportToWorkspace(0, viewportHeight / 2);
                newY = middlePos.y - (this.currentWidget.height / 2);
            } else if (align === 'bottom') {
                const bottomPos = this.viewportController.viewportToWorkspace(0, viewportHeight);
                newY = bottomPos.y - this.currentWidget.height;
            }
        } else {
            // Fallback: используем простые вычисления
            // Горизонтальное выравнивание
            if (align === 'left') {
                newX = -offsetX / zoom;
            } else if (align === 'center') {
                newX = (workspaceWidth / 2) - (this.currentWidget.width / 2) - (offsetX / zoom);
            } else if (align === 'right') {
                newX = workspaceWidth - this.currentWidget.width - (offsetX / zoom);
            }
            
            // Вертикальное выравнивание
            if (align === 'top') {
                newY = -offsetY / zoom;
            } else if (align === 'middle') {
                newY = (workspaceHeight / 2) - (this.currentWidget.height / 2) - (offsetY / zoom);
            } else if (align === 'bottom') {
                newY = workspaceHeight - this.currentWidget.height - (offsetY / zoom);
            }
        }
        
        // Применяем новую позицию с проверкой границ
        const widgetManager = this.engine?.widgetManager;
        this.currentWidget.setPosition(newX, newY, widgetManager);
        
        // Обновляем поля ввода
        const xInput = this.panel.querySelector('#style-x');
        const yInput = this.panel.querySelector('#style-y');
        if (xInput) xInput.value = Math.round(newX);
        if (yInput) yInput.value = Math.round(newY);
        
        // Сохраняем выравнивание в стилях
        if (!this.currentWidget.styles) {
            this.currentWidget.styles = {};
        }
        if (!this.currentWidget.styles.layout) {
            this.currentWidget.styles.layout = {};
        }
        
        // Получаем текущее выравнивание или используем значения по умолчанию
        const currentAlignment = this.currentWidget.styles.layout.alignment || {};
        const isHorizontal = ['left', 'center', 'right'].includes(align);
        
        if (isHorizontal) {
            this.currentWidget.styles.layout.alignment = {
                horizontal: align,
                vertical: currentAlignment.vertical || 'middle'
            };
        } else {
            this.currentWidget.styles.layout.alignment = {
                horizontal: currentAlignment.horizontal || 'center',
                vertical: align
            };
        }
    }

    defaultGradientConfig() {
        return { type: 'linear', angle: 135, color1: '#005DFF', color2: '#00E0FF' };
    }

    normalizeGradientConfig(raw) {
        const g = raw && typeof raw === 'object' ? raw : {};
        const type = g.type === 'radial' ? 'radial' : 'linear';
        const angleRaw = Number(g.angle);
        const color1 = /^#[0-9a-fA-F]{6}$/i.test(String(g.color1 || '')) ? g.color1 : '#005DFF';
        const color2 = /^#[0-9a-fA-F]{6}$/i.test(String(g.color2 || '')) ? g.color2 : '#00E0FF';
        return {
            type,
            angle: Number.isFinite(angleRaw) ? angleRaw : 135,
            color1,
            color2,
        };
    }

    gradientConfigToCss(grad) {
        const g = this.normalizeGradientConfig(grad);
        if (g.type === 'radial') {
            return `radial-gradient(circle, ${g.color1}, ${g.color2})`;
        }
        return `linear-gradient(${g.angle}deg, ${g.color1}, ${g.color2})`;
    }

    setCustomGradientControlsVisible(visible) {
        const wrap = this.panel?.querySelector('#bg-custom-gradient-controls');
        if (wrap) wrap.style.display = visible ? 'block' : 'none';
        this.syncGradientAngleRowVisibility();
    }

    syncGradientAngleRowVisibility() {
        const type = this.panel?.querySelector('#style-gradient-type')?.value || 'linear';
        const row = this.panel?.querySelector('#style-gradient-angle-row');
        if (row) row.style.display = type === 'radial' ? 'none' : '';
    }

    applyGradientConfigToPanel(grad, { showCustom = false } = {}) {
        if (!this.panel) return this.defaultGradientConfig();
        const g = this.normalizeGradientConfig(grad);
        this.currentGradient = g;

        const typeEl = this.panel.querySelector('#style-gradient-type');
        if (typeEl) typeEl.value = g.type;

        const angleEl = this.panel.querySelector('#style-gradient-angle');
        const angleVal = this.panel.querySelector('#style-gradient-angle-value');
        if (angleEl) angleEl.value = String(g.angle);
        if (angleVal) angleVal.textContent = `${g.angle}°`;

        this.syncGradientColorInputs('#style-gradient-color1', '#style-gradient-color1-text', g.color1);
        this.syncGradientColorInputs('#style-gradient-color2', '#style-gradient-color2-text', g.color2);
        this.syncGradientPresetSelection(g);
        this.setCustomGradientControlsVisible(showCustom || !this.isGradientMatchingAnyPreset(g));
        this.updateGradientPreview();
        return g;
    }

    syncGradientColorInputs(colorSel, textSel, value) {
        const color = this.panel?.querySelector(colorSel);
        const text = this.panel?.querySelector(textSel);
        if (color) color.value = value;
        if (text) text.value = value;
    }

    isGradientMatchingAnyPreset(grad) {
        if (!this.panel) return false;
        const g = this.normalizeGradientConfig(grad);
        return Array.from(this.panel.querySelectorAll('.gradient-preset')).some((preset) => {
            const match = String(preset.dataset.gradient || '').match(
                /linear-gradient\(135deg,\s*(#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\)/,
            );
            if (!match) return false;
            return (
                g.type === 'linear'
                && g.angle === 135
                && g.color1.toLowerCase() === match[1].toLowerCase()
                && g.color2.toLowerCase() === match[2].toLowerCase()
            );
        });
    }

    syncGradientPresetSelection(grad) {
        if (!this.panel) return;
        const g = this.normalizeGradientConfig(grad);
        this.panel.querySelectorAll('.gradient-preset').forEach((preset) => {
            const match = String(preset.dataset.gradient || '').match(
                /linear-gradient\(135deg,\s*(#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\)/,
            );
            const active =
                !!match
                && g.type === 'linear'
                && g.angle === 135
                && g.color1.toLowerCase() === match[1].toLowerCase()
                && g.color2.toLowerCase() === match[2].toLowerCase();
            preset.classList.toggle('active', active);
        });
    }

    collectGradientFromPanel() {
        if (!this.panel) return this.defaultGradientConfig();
        const type = this.panel.querySelector('#style-gradient-type')?.value === 'radial' ? 'radial' : 'linear';
        const angle = parseInt(this.panel.querySelector('#style-gradient-angle')?.value, 10);
        const c1Raw = (this.panel.querySelector('#style-gradient-color1-text')?.value || '').trim();
        const c2Raw = (this.panel.querySelector('#style-gradient-color2-text')?.value || '').trim();
        const c1Pick = this.panel.querySelector('#style-gradient-color1')?.value || '#005DFF';
        const c2Pick = this.panel.querySelector('#style-gradient-color2')?.value || '#00E0FF';
        return this.normalizeGradientConfig({
            type,
            angle,
            color1: /^#[0-9a-fA-F]{6}$/i.test(c1Raw) ? c1Raw : c1Pick,
            color2: /^#[0-9a-fA-F]{6}$/i.test(c2Raw) ? c2Raw : c2Pick,
        });
    }

    updateGradientPreview() {
        const preview = this.panel?.querySelector('#style-gradient-preview');
        if (!preview) return;
        preview.style.background = this.gradientConfigToCss(this.collectGradientFromPanel());
    }

    wireGradientColorPair(colorSel, textSel) {
        const color = this.panel?.querySelector(colorSel);
        const text = this.panel?.querySelector(textSel);
        if (!color || !text) return;
        color.addEventListener('input', (e) => {
            text.value = e.target.value;
            this.panel.querySelectorAll('.gradient-preset').forEach((p) => p.classList.remove('active'));
            this.updateGradientPreview();
            this.updateWidget();
        });
        text.addEventListener('change', (e) => {
            if (/^#[0-9a-fA-F]{6}$/i.test(e.target.value)) {
                color.value = e.target.value;
            }
            this.panel.querySelectorAll('.gradient-preset').forEach((p) => p.classList.remove('active'));
            this.updateGradientPreview();
            this.updateWidget();
        });
    }

    setupAppearanceListeners() {
        // Background color
        const bgColor = this.panel.querySelector('#style-bg-color');
        const bgColorText = this.panel.querySelector('#style-bg-color-text');
        if (bgColor && bgColorText) {
            bgColor.addEventListener('input', (e) => {
                bgColorText.value = e.target.value;
                this.updateWidget();
            });
            bgColorText.addEventListener('change', (e) => {
                bgColor.value = e.target.value;
                this.updateWidget();
            });
        }

        // Gradient presets
        this.panel.querySelectorAll('.gradient-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const gradientValue = preset.dataset.gradient;
                if (gradientValue) {
                    const match = gradientValue.match(/linear-gradient\(135deg,\s*(#[0-9A-Fa-f]{6}),\s*(#[0-9A-Fa-f]{6})\)/);
                    if (match) {
                        this.applyGradientConfigToPanel(
                            {
                                type: 'linear',
                                angle: 135,
                                color1: match[1],
                                color2: match[2],
                            },
                            { showCustom: false },
                        );
                    }
                }
                this.updateWidget();
            });
        });

        const customGradientBtn = this.panel.querySelector('#btn-custom-gradient');
        if (customGradientBtn) {
            customGradientBtn.addEventListener('click', () => {
                if (!this.currentGradient) {
                    this.applyGradientConfigToPanel(this.defaultGradientConfig(), { showCustom: true });
                } else {
                    this.setCustomGradientControlsVisible(true);
                    this.panel.querySelectorAll('.gradient-preset').forEach((p) => p.classList.remove('active'));
                }
                this.updateWidget();
            });
        }

        const gradientType = this.panel.querySelector('#style-gradient-type');
        if (gradientType) {
            gradientType.addEventListener('change', () => {
                this.panel.querySelectorAll('.gradient-preset').forEach((p) => p.classList.remove('active'));
                this.syncGradientAngleRowVisibility();
                this.updateGradientPreview();
                this.updateWidget();
            });
        }

        const gradientAngle = this.panel.querySelector('#style-gradient-angle');
        const gradientAngleValue = this.panel.querySelector('#style-gradient-angle-value');
        if (gradientAngle && gradientAngleValue) {
            gradientAngle.addEventListener('input', (e) => {
                gradientAngleValue.textContent = `${e.target.value}°`;
                this.panel.querySelectorAll('.gradient-preset').forEach((p) => p.classList.remove('active'));
                this.updateGradientPreview();
                this.updateWidget();
            });
        }

        this.wireGradientColorPair('#style-gradient-color1', '#style-gradient-color1-text');
        this.wireGradientColorPair('#style-gradient-color2', '#style-gradient-color2-text');

        // Glass mode
        const glassEnabled = this.panel.querySelector('#style-glass-enabled');
        const glassBlur = this.panel.querySelector('#style-glass-blur');
        const glassBlurValue = this.panel.querySelector('#glass-blur-value');
        const glassOpacity = this.panel.querySelector('#style-glass-opacity');
        const glassOpacityValue = this.panel.querySelector('#glass-opacity-value');
        
        if (glassEnabled) {
            glassEnabled.addEventListener('change', () => {
                if (!this._isLoadingWidgetStyles) {
                    this.updateWidget();
                }
            });
        }
        
        if (glassBlur && glassBlurValue) {
            glassBlur.addEventListener('input', (e) => {
                glassBlurValue.textContent = e.target.value + 'px';
                this.updateWidget();
            });
        }
        
        if (glassOpacity && glassOpacityValue) {
            glassOpacity.addEventListener('input', (e) => {
                glassOpacityValue.textContent = parseFloat(e.target.value).toFixed(1);
                this.updateWidget();
            });
        }
        
        const glassColor = this.panel.querySelector('#style-glass-color');
        if (glassColor) {
            glassColor.addEventListener('input', () => {
                this.updateWidget();
            });
        }

        // Opacity
        const opacity = this.panel.querySelector('#style-opacity');
        const opacityValue = this.panel.querySelector('#opacity-value');
        if (opacity && opacityValue) {
            opacity.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                opacityValue.textContent = Math.round(val * 100) + '%';
                this.updateWidget();
            });
        }

        // Blend mode
        const blendMode = this.panel.querySelector('#style-blend-mode');
        if (blendMode) {
            blendMode.addEventListener('change', () => this.updateWidget());
        }
    }

    setupTypographyListeners() {
        // Font weight
        const fontWeight = this.panel.querySelector('#style-font-weight');
        const fontWeightValue = this.panel.querySelector('#font-weight-value');
        if (fontWeight && fontWeightValue) {
            fontWeight.addEventListener('input', (e) => {
                fontWeightValue.textContent = e.target.value;
                this.updateWidget();
            });
        }

        // Font size
        const fontSize = this.panel.querySelector('#style-font-size');
        const fontSizeValue = this.panel.querySelector('#font-size-value');
        if (fontSize && fontSizeValue) {
            fontSize.addEventListener('input', (e) => {
                fontSizeValue.textContent = e.target.value + 'px';
                this.updateWidget();
            });
        }

        // Letter spacing
        const letterSpacing = this.panel.querySelector('#style-letter-spacing');
        const letterSpacingValue = this.panel.querySelector('#letter-spacing-value');
        if (letterSpacing && letterSpacingValue) {
            letterSpacing.addEventListener('input', (e) => {
                letterSpacingValue.textContent = e.target.value + 'px';
                this.updateWidget();
            });
        }

        // Line height
        const lineHeight = this.panel.querySelector('#style-line-height');
        const lineHeightValue = this.panel.querySelector('#line-height-value');
        if (lineHeight && lineHeightValue) {
            lineHeight.addEventListener('input', (e) => {
                lineHeightValue.textContent = e.target.value;
                this.updateWidget();
            });
        }

        // Text color
        const textColor = this.panel.querySelector('#style-text-color');
        const textColorText = this.panel.querySelector('#style-text-color-text');
        if (textColor && textColorText) {
            textColor.addEventListener('input', (e) => {
                textColorText.value = e.target.value;
                this.updateWidget();
            });
            textColorText.addEventListener('change', (e) => {
                textColor.value = e.target.value;
                this.updateWidget();
            });
        }

        // Text shadow
        const textShadow = this.panel.querySelector('#style-text-shadow');
        if (textShadow) {
            textShadow.addEventListener('input', () => {
                this.updateTypographyPreview();
                this.updateWidget();
            });
        }
        
        // Update typography preview on changes
        const typographyInputs = ['#style-font-family', '#style-font-weight', '#style-font-size', 
                                  '#style-letter-spacing', '#style-line-height', '#style-text-color'];
        typographyInputs.forEach(selector => {
            const input = this.panel.querySelector(selector);
            if (input) {
                input.addEventListener('input', () => {
                    this.updateTypographyPreview();
                    this.updateWidget();
                });
            }
        });
    }

    setupBordersListeners() {
        // Border width
        const borderWidth = this.panel.querySelector('#style-border-width');
        const borderWidthValue = this.panel.querySelector('#border-width-value');
        if (borderWidth && borderWidthValue) {
            borderWidth.addEventListener('input', (e) => {
                borderWidthValue.textContent = e.target.value + 'px';
                this.updateWidget();
            });
        }

        // Border style
        const borderStyle = this.panel.querySelector('#style-border-style');
        if (borderStyle) {
            borderStyle.addEventListener('change', () => this.updateWidget());
        }

        // Border color
        const borderColor = this.panel.querySelector('#style-border-color');
        const borderColorText = this.panel.querySelector('#style-border-color-text');
        if (borderColor && borderColorText) {
            borderColor.addEventListener('input', (e) => {
                borderColorText.value = e.target.value;
                this.updateWidget();
            });
            borderColorText.addEventListener('change', (e) => {
                borderColor.value = e.target.value;
                this.updateWidget();
            });
        }

        // Neon glow
        const neonEnabled = this.panel.querySelector('#style-neon-glow-enabled');
        const neonControls = this.panel.querySelector('#neon-glow-controls');
        if (neonEnabled && neonControls) {
            neonEnabled.addEventListener('change', (e) => {
                neonControls.style.display = e.target.checked ? 'block' : 'none';
                if (!this._isLoadingWidgetStyles) {
                    this.updateWidget();
                }
            });
        }
        
        // Neon glow controls
        const neonIntensity = this.panel.querySelector('#style-neon-intensity');
        const neonIntensityValue = this.panel.querySelector('#neon-intensity-value');
        if (neonIntensity && neonIntensityValue) {
            neonIntensity.addEventListener('input', (e) => {
                neonIntensityValue.textContent = e.target.value + 'px';
                this.updateWidget();
            });
        }
        
        const neonSpread = this.panel.querySelector('#style-neon-spread');
        const neonSpreadValue = this.panel.querySelector('#neon-spread-value');
        if (neonSpread && neonSpreadValue) {
            neonSpread.addEventListener('input', (e) => {
                neonSpreadValue.textContent = e.target.value + 'px';
                this.updateWidget();
            });
        }
        
        const neonColor = this.panel.querySelector('#style-neon-color');
        if (neonColor) {
            neonColor.addEventListener('input', () => {
                this.updateWidget();
            });
        }

        // Border radius
        const borderRadius = this.panel.querySelector('#style-border-radius');
        const borderRadiusValue = this.panel.querySelector('#border-radius-value');
        if (borderRadius && borderRadiusValue) {
            borderRadius.addEventListener('input', (e) => {
                borderRadiusValue.textContent = e.target.value + 'px';
                this.updateWidget();
            });
        }
    }

    setupShadowsListeners() {
        const addShadowBtn = this.panel.querySelector('#btn-add-shadow');
        if (addShadowBtn) {
            addShadowBtn.addEventListener('click', () => {
                this.addShadowLayer();
            });
        }
    }

    setupAnimationsListeners() {
        const animEnabled = this.panel.querySelector('#style-animation-enabled');
        const animControlsWrapper = this.panel.querySelector('#animation-controls-wrapper');
        if (animEnabled && animControlsWrapper) {
            animEnabled.addEventListener('change', (e) => {
                animControlsWrapper.style.display = e.target.checked ? 'block' : 'none';
                if (!this._isLoadingWidgetStyles) {
                    this.updateWidget();
                }
            });
        }

        const animDuration = this.panel.querySelector('#style-animation-duration');
        const animDurationValue = this.panel.querySelector('#animation-duration-value');
        if (animDuration && animDurationValue) {
            animDuration.addEventListener('input', (e) => {
                animDurationValue.textContent = e.target.value + 's';
                this.updateWidget();
            });
        }
    }

    updateTypographyPreview() {
        const preview = this.panel.querySelector('#typography-preview');
        if (!preview) return;
        
        const fontFamily = this.panel.querySelector('#style-font-family')?.value || 'Inter';
        const fontWeight = this.panel.querySelector('#style-font-weight')?.value || '400';
        const fontSize = this.panel.querySelector('#style-font-size')?.value || '16';
        const letterSpacing = this.panel.querySelector('#style-letter-spacing')?.value || '0';
        const lineHeight = this.panel.querySelector('#style-line-height')?.value || '1.5';
        let color = this.panel.querySelector('#style-text-color')?.value || '#000000';
        if (this.currentWidget?.type === 'gauge') {
            const gtxt = this.panel.querySelector('#gauge-value-text-color-text');
            const gpick = this.panel.querySelector('#gauge-value-text-color');
            const raw = (gtxt?.value || '').trim();
            color =
                /^#[0-9a-fA-F]{6}$/i.test(raw)
                    ? raw
                    : /^#[0-9a-fA-F]{6}$/i.test(gpick?.value || '')
                      ? gpick.value
                      : color;
        }
        const textShadow = this.panel.querySelector('#style-text-shadow')?.value || '';
        
        preview.style.fontFamily = fontFamily;
        preview.style.fontWeight = fontWeight;
        preview.style.fontSize = fontSize + 'px';
        preview.style.letterSpacing = letterSpacing + 'px';
        preview.style.lineHeight = lineHeight;
        preview.style.color = color;
        preview.style.textShadow = textShadow;
    }

    addShadowLayer(initial = null) {
        const shadowLayers = this.panel.querySelector('#shadow-layers');
        if (!shadowLayers) return;

        const layerIndex = shadowLayers.children.length;
        const x = initial?.x != null && Number.isFinite(Number(initial.x)) ? Number(initial.x) : 0;
        const y = initial?.y != null && Number.isFinite(Number(initial.y)) ? Number(initial.y) : 4;
        const blur = initial?.blur != null && Number.isFinite(Number(initial.blur)) ? Number(initial.blur) : 8;
        const spread = initial?.spread != null && Number.isFinite(Number(initial.spread)) ? Number(initial.spread) : 0;
        const color = typeof initial?.color === 'string' && /^#[0-9a-fA-F]{6}$/i.test(initial.color)
            ? initial.color
            : '#000000';

        const layer = document.createElement('div');
        layer.className = 'shadow-layer';
        const colorId = `shadow-color-${layerIndex}-${Date.now().toString(36)}`;
        layer.innerHTML = `
            <div class="shadow-layer-header">
                <span class="shadow-layer-title">Тень #${layerIndex + 1}</span>
                <button type="button" class="shadow-layer-remove" aria-label="Удалить тень">×</button>
            </div>
            <div class="style-input-group">
                <div>
                    <label class="style-label">X</label>
                    <input type="number" class="style-input shadow-x" value="${x}">
                </div>
                <div>
                    <label class="style-label">Y</label>
                    <input type="number" class="style-input shadow-y" value="${y}">
                </div>
                <div>
                    <label class="style-label">Размытие</label>
                    <input type="number" class="style-input shadow-blur" value="${blur}">
                </div>
                <div>
                    <label class="style-label">Распространение</label>
                    <input type="number" class="style-input shadow-spread" value="${spread}">
                </div>
            </div>
            <div class="style-control-group">
                <label class="style-label">Цвет</label>
                <div class="color-picker-wrapper">
                    <div class="color-picker">
                        <input type="color" class="shadow-color" id="${colorId}" value="${color}">
                    </div>
                    <input type="text" class="style-input shadow-color-text" value="${color}" style="flex: 1;">
                </div>
                ${this.renderColorFormulaFieldHtml({ formulaId: `${colorId}-formula`, applyKey: 'styles' })}
            </div>
        `;

        shadowLayers.appendChild(layer);

        const formulaTa = layer.querySelector(`#${CSS.escape(`${colorId}-formula`)}`);
        if (formulaTa && initial?.colorFormula) {
            formulaTa.value = String(initial.colorFormula);
        }

        const removeBtn = layer.querySelector('.shadow-layer-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                layer.remove();
                this.renumberShadowLayers();
                this.updateWidget();
            });
        }

        // Setup listeners for this layer
        layer.querySelectorAll('.style-input, .shadow-color, .color-formula-input').forEach(input => {
            input.addEventListener('input', () => this.updateWidget());
        });

        if (!this._isLoadingWidgetStyles) {
            this.updateWidget();
        }
    }

    renumberShadowLayers() {
        const shadowLayers = this.panel.querySelector('#shadow-layers');
        if (!shadowLayers) return;
        Array.from(shadowLayers.querySelectorAll('.shadow-layer')).forEach((layer, idx) => {
            const title = layer.querySelector('.shadow-layer-title');
            if (title) title.textContent = `Тень #${idx + 1}`;
        });
    }

    show(widget) {
        const w = this.resolveLiveWidget(widget) ?? widget;
        this.currentWidget = w;
        this.panel.classList.remove('hidden');
        document.getElementById('app')?.classList.add('app--style-panel-open');
        eventBus.emit('style-panel:visibility', { open: true });
        eventBus.emit('widget-panel:close');

        const hint = this.panel.querySelector('#widget-data-binding-hint');
        if (hint) {
            if (widgetNeedsStylePanelDataHint(w)) {
                hint.textContent = getStylePanelDataBindingHintText();
                hint.classList.remove('hidden');
            } else {
                hint.classList.add('hidden');
                hint.textContent = '';
            }
        }

        const typoCtx = this.panel.querySelector('#typography-widget-context-hint');
        if (typoCtx) {
            if (w.type === 'gauge') {
                typoCtx.style.display = '';
                typoCtx.textContent =
                    'Для датчика: размер и гарнитура центральной подписи задаются здесь; цвет текста числа, суффиксы и шаблон — в разделе «Настройки датчика» → «Подпись и формат значения».';
            } else if (w.type === 'button-widget') {
                typoCtx.style.display = '';
                typoCtx.textContent =
                    'Для кнопок типографика и цвет текста применяются к подписям на canvas. Фон и hover удобнее задавать в разделе «Кнопки» → «Общий стиль» или «Свой стиль» у конкретной кнопки.';
            } else {
                typoCtx.style.display = 'none';
                typoCtx.textContent = '';
            }
        }
        
        // Показываем/скрываем type-specific секции; SDK settingsPanel перекрывает legacy для своего типа
        const usesSdkPanel = this._mountSdkSettingsPanel(w);

        const gaugeSection = this.panel.querySelector('.gauge-settings-section');
        if (gaugeSection) {
            gaugeSection.style.display = !usesSdkPanel && w.type === 'gauge' ? 'block' : 'none';
            if (w.type === 'gauge' && !usesSdkPanel) gaugeSection.classList.add('expanded');
        }

        const kpiSection = this.panel.querySelector('.kpi-settings-section');
        if (kpiSection) {
            kpiSection.style.display = !usesSdkPanel && w.type === 'kpi' ? 'block' : 'none';
            if (w.type === 'kpi' && !usesSdkPanel) kpiSection.classList.add('expanded');
        }

        const textWidgetSection = this.panel.querySelector('.text-widget-settings-section');
        if (textWidgetSection) {
            textWidgetSection.style.display = !usesSdkPanel && w.type === 'text' ? 'block' : 'none';
        }

        const htmlWidgetSection = this.panel.querySelector('.html-widget-settings-section');
        if (htmlWidgetSection) {
            htmlWidgetSection.style.display = !usesSdkPanel && w.type === 'html' ? 'block' : 'none';
            if (w.type === 'html' && !usesSdkPanel) htmlWidgetSection.classList.add('expanded');
        }

        const tableSettingsSection = this.panel.querySelector('.table-settings-section');
        if (tableSettingsSection) {
            tableSettingsSection.style.display = !usesSdkPanel && w.type === 'table' ? 'block' : 'none';
        }

        const pieChartSettingsSection = this.panel.querySelector('.pie-chart-settings-section');
        if (pieChartSettingsSection) {
            pieChartSettingsSection.style.display = !usesSdkPanel && w.type === 'pie-chart' ? 'block' : 'none';
        }

        const barChartSettingsSection = this.panel.querySelector('.bar-chart-settings-section');
        if (barChartSettingsSection) {
            barChartSettingsSection.style.display = !usesSdkPanel && w.type === 'bar-chart' ? 'block' : 'none';
        }

        const lineChartSettingsSection = this.panel.querySelector('.line-chart-settings-section');
        if (lineChartSettingsSection) {
            lineChartSettingsSection.style.display = !usesSdkPanel && w.type === 'line-chart' ? 'block' : 'none';
        }

        const filterWidgetSettingsSection = this.panel.querySelector('.filter-widget-settings-section');
        if (filterWidgetSettingsSection) {
            filterWidgetSettingsSection.style.display = !usesSdkPanel && w.type === 'filter' ? 'block' : 'none';
        }

        const buttonWidgetSettingsSection = this.panel.querySelector('.button-widget-settings-section');
        if (buttonWidgetSettingsSection) {
            buttonWidgetSettingsSection.style.display = !usesSdkPanel && w.type === 'button-widget' ? 'block' : 'none';
        }

        const dataInputSettingsSection = this.panel.querySelector('.data-input-settings-section');
        if (dataInputSettingsSection) {
            dataInputSettingsSection.style.display = !usesSdkPanel && w.type === 'data_input' ? 'block' : 'none';
        }
        
        // Показываем/скрываем секцию вкладок для контейнеров
        const tabsSection = this.panel.querySelector('.tabs-section');
        if (tabsSection) {
            tabsSection.style.display = w.type === 'container' ? 'block' : 'none';
            if (w.type === 'container') {
                this.updateTabsList(w);
            }
        }
        
        // Показываем/скрываем секцию расположения вкладок для контейнеров
        const tabPositionSection = this.panel.querySelector('.container-tab-position-section');
        if (tabPositionSection) {
            tabPositionSection.style.display = w.type === 'container' ? 'block' : 'none';
        }

        this.updateDataBindingSection(w);

        this.loadWidgetStyles(w);

        if (w.type === 'kpi') {
            void this.syncKpiPanelFromWidget(w);
        }

        if (w.type === 'data_input') {
            this.syncDataInputPanelFromWidget(w);
        }

        if (w.type === 'html') {
            this.syncHtmlPanelFromWidget(w);
        }

        const kpiBgBlock = this.panel.querySelector('#kpi-conditional-bg-block');
        if (kpiBgBlock) {
            kpiBgBlock.style.display = w.type === 'kpi' ? 'block' : 'none';
        }
        const appearanceKpiShellHint = this.panel.querySelector('#appearance-kpi-shell-hint');
        if (appearanceKpiShellHint) {
            appearanceKpiShellHint.style.display = w.type === 'kpi' ? 'block' : 'none';
        }
        const filterAppearanceBlock = this.panel.querySelector('#filter-appearance-block');
        if (filterAppearanceBlock) {
            filterAppearanceBlock.style.display = w.type === 'filter' ? 'block' : 'none';
        }
        if (w.type === 'filter') {
            this.panel.querySelector('[data-section="appearance"]')?.classList.add('expanded');
        }
        const kpiFmtTypo = this.panel.querySelector('#kpi-number-format-typography');
        if (kpiFmtTypo) {
            kpiFmtTypo.style.display = w.type === 'kpi' ? 'block' : 'none';
        }

        const typographyTextColorRow = this.panel.querySelector('#style-typography-text-color-row');
        if (typographyTextColorRow) {
            typographyTextColorRow.style.display =
                w.type === 'gauge' || w.type === 'html' ? 'none' : '';
        }
    }

    hide() {
        this.closeKpiCurrencyPicker?.();
        this._teardownSdkSettingsPanel();
        this.panel?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('app--style-panel-open');
        eventBus.emit('style-panel:visibility', { open: false });
        const hint = this.panel?.querySelector('#widget-data-binding-hint');
        if (hint) {
            hint.classList.add('hidden');
            hint.textContent = '';
        }
        // Keep currentWidget so in-flight panel inputs / delayed listeners can still apply styles.
        // show() replaces it; destroy() clears it.
    }

    /**
     * Подпись вкладки шкафа (кастомная на контейнере либо авто по типу виджета).
     * Не использует settings.title виджета — заголовок виджета независим.
     * @param {*} containerWidget
     * @param {*} widget — первый виджет вкладки
     * @param {string[]} [groupIds]
     * @returns {string}
     */
    getContainedWidgetDisplayName(containerWidget, widget, groupIds) {
        if (containerWidget && typeof containerWidget.getTabLabelForGroup === 'function') {
            const group =
                Array.isArray(groupIds) && groupIds.length
                    ? groupIds
                    : widget?.id
                      ? [widget.id]
                      : [];
            return containerWidget.getTabLabelForGroup(group);
        }
        if (!widget) return '';
        const displayNames = {
            text: 'Текст',
            table: 'Таблица',
            'line-chart': 'Линейный график',
            'bar-chart': 'Столбчатая диаграмма',
            'pie-chart': 'Круговая диаграмма',
            kpi: 'KPI',
            gauge: 'Датчик',
            html: 'HTML',
            image: 'Медиа',
            filter: 'Фильтр',
            'button-widget': 'Кнопки',
            data_input: 'Ввод данных',
        };
        return displayNames[widget.type] || widget.type;
    }

    /**
     * Сохранить название вкладки на шкафе (settings.tabLabels); пустая строка — авто по типу.
     * Не меняет settings.title / заголовок виджета.
     */
    applyContainedWidgetTabTitle(containerWidget, widget, rawTitle) {
        if (!containerWidget || !widget?.id) return;
        if (typeof containerWidget.setCustomTabLabel === 'function') {
            containerWidget.setCustomTabLabel(widget.id, rawTitle);
        } else {
            if (!containerWidget.settings) containerWidget.settings = {};
            if (!containerWidget.settings.tabLabels) containerWidget.settings.tabLabels = {};
            const v = (rawTitle ?? '').trim();
            if (!v) delete containerWidget.settings.tabLabels[widget.id];
            else containerWidget.settings.tabLabels[widget.id] = v.slice(0, 80);
        }
        containerWidget.render();
        this.updateTabsList(containerWidget);
        eventBus.emit('widget:settings-changed', { widget: containerWidget });
        eventBus.emit('widget:styles-changed', { widget: containerWidget });
        if (this.engine && this.engine.saveSnapshot) {
            this.engine.saveSnapshot();
        }
    }

    /**
     * Редактирование названия вкладки по двойному клику / кнопке.
     */
    beginTabNameEdit(containerWidget, widget, nameEl, groupIds) {
        if (!nameEl || nameEl.querySelector('.tab-item-name-input')) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'style-input tab-item-name-input';
        input.value = this.getContainedWidgetDisplayName(containerWidget, widget, groupIds);
        input.placeholder = 'Название вкладки';
        input.maxLength = 80;
        input.autocomplete = 'off';

        const oldText = nameEl.textContent;
        nameEl.textContent = '';
        nameEl.appendChild(input);

        let cancelled = false;
        const cleanup = () => {
            input.removeEventListener('blur', onBlur);
            input.removeEventListener('keydown', onKey);
        };

        const onBlur = () => {
            cleanup();
            if (cancelled) {
                nameEl.textContent = oldText;
                if (input.parentNode === nameEl) nameEl.removeChild(input);
                return;
            }
            this.applyContainedWidgetTabTitle(containerWidget, widget, input.value);
        };

        const onKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelled = true;
                cleanup();
                nameEl.textContent = oldText;
                if (input.parentNode === nameEl) nameEl.removeChild(input);
            }
        };

        input.addEventListener('blur', onBlur);
        input.addEventListener('keydown', onKey);
        queueMicrotask(() => {
            input.focus();
            input.select();
        });
    }

    updateTabsList(containerWidget) {
        const tabsList = this.panel.querySelector('#container-tabs-list');
        if (!tabsList || !containerWidget) return;

        const hint = this.panel.querySelector('.tabs-list-hint');
        const slots = containerWidget.getSlotsPerTab ? containerWidget.getSlotsPerTab() : 1;
        const multiTab = slots > 1;
        if (hint) {
            hint.textContent = multiTab
                ? 'Несколько виджетов на вкладке (до 4). Переименование — ✎ или двойной клик (подпись вкладки не связана с заголовком виджета). Порядок вкладок перетаскиванием — только при «1 виджет на вкладке».'
                : 'Клик по ✎ или двойной клик по названию — переименовать вкладку (независимо от заголовка виджета). Порядок: перетащите за ручку слева.';
        }

        // Очищаем список
        tabsList.innerHTML = '';

        const cw = containerWidget.containedWidgets;
        if (!cw || cw.length === 0) {
            tabsList.innerHTML = '<div class="tabs-empty-message">Нет виджетов в контейнере</div>';
            return;
        }

        const groups =
            containerWidget.tabGroups?.length > 0
                ? containerWidget.tabGroups
                : cw.map((id) => [id]);

        // Создаем элементы списка: одна строка на вкладку (группу)
        groups.forEach((ids) => {
            const cleanIds = (ids || []).filter((id) => containerWidget.widgetReferences.has(id));
            if (!cleanIds.length) return;

            const primaryId = cleanIds[0];
            const widget = containerWidget.widgetReferences.get(primaryId);
            if (!widget) return;

            const tabName = this.getContainedWidgetDisplayName(containerWidget, widget, cleanIds);

            const tabItem = document.createElement('div');
            tabItem.className = 'tab-item';
            tabItem.dataset.widgetId = primaryId;
            tabItem.draggable = false;

            const handle = document.createElement('div');
            handle.className = 'tab-item-handle';
            handle.innerHTML = svgDragHandle;
            handle.title = 'Перетащите, чтобы изменить порядок вкладок';
            if (multiTab) {
                handle.style.display = 'none';
                handle.draggable = false;
            } else {
                handle.style.display = '';
                handle.draggable = true;
            }

            handle.addEventListener('dragstart', (e) => {
                if (multiTab) {
                    e.preventDefault();
                    return;
                }
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', primaryId);
                tabItem.classList.add('dragging');
            });

            handle.addEventListener('dragend', () => {
                tabItem.classList.remove('dragging');
            });

            const content = document.createElement('div');
            content.className = 'tab-item-content';

            const nameEl = document.createElement('div');
            nameEl.className = 'tab-item-name';
            nameEl.textContent = tabName;
            nameEl.title = 'Двойной клик — переименовать вкладку';
            nameEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.beginTabNameEdit(containerWidget, widget, nameEl, cleanIds);
            });

            const typeEl = document.createElement('div');
            typeEl.className = 'tab-item-type';
            typeEl.textContent =
                cleanIds.length > 1
                    ? cleanIds
                          .map((id) => containerWidget.widgetReferences.get(id)?.type || id)
                          .join(', ')
                    : widget.type;

            const actions = document.createElement('div');
            actions.className = 'tab-item-actions';

            const renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'tab-item-rename-btn';
            renameBtn.title = 'Переименовать вкладку';
            renameBtn.setAttribute('aria-label', 'Переименовать вкладку');
            renameBtn.textContent = '✎';
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.beginTabNameEdit(containerWidget, widget, nameEl, cleanIds);
            });

            const styleBtn = document.createElement('button');
            styleBtn.type = 'button';
            styleBtn.className = 'tab-item-style-btn';
            styleBtn.title = 'Открыть стили';
            styleBtn.innerHTML = svgPaletteBrush;
            styleBtn.setAttribute('aria-label', 'Открыть стили');
            styleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openWidgetStyles(widget);
            });
            actions.appendChild(renameBtn);
            actions.appendChild(styleBtn);

            content.appendChild(nameEl);
            content.appendChild(typeEl);
            tabItem.appendChild(handle);
            tabItem.appendChild(content);
            tabItem.appendChild(actions);

            tabItem.addEventListener('click', (e) => {
                if (e.target.closest('.tab-item-style-btn')) return;
                if (e.target.closest('.tab-item-rename-btn')) return;
                if (e.target.closest('.tab-item-name-input')) return;
                containerWidget.setActiveTab(primaryId);
            });

            tabsList.appendChild(tabItem);
        });

        // Настраиваем drag-and-drop для всего списка (только режим 1 виджет на вкладку)
        if (!multiTab) {
            this.setupTabsDragAndDrop(tabsList, containerWidget);
        }
    }

    setupTabsDragAndDrop(tabsList, containerWidget) {
        if (tabsList.dataset.tabsPanelDragBound === '1') return;
        tabsList.dataset.tabsPanelDragBound = '1';

        tabsList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = this.getDragAfterElement(tabsList, e.clientY);
            const dragging = tabsList.querySelector('.dragging');
            if (dragging) {
                if (afterElement == null) {
                    tabsList.appendChild(dragging);
                } else {
                    tabsList.insertBefore(dragging, afterElement);
                }
            }
        });

        tabsList.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const draggedId = e.dataTransfer.getData('text/html');
            if (!draggedId) return;
            
            // Небольшая задержка, чтобы DOM успел обновиться после dragover
            setTimeout(() => {
                // Получаем новый порядок элементов из DOM
                const tabItems = Array.from(tabsList.querySelectorAll('.tab-item'));
                const newOrder = tabItems.map(item => item.dataset.widgetId).filter(id => id); // Фильтруем пустые значения
                
                if (newOrder.length === 0) return;
                
                // Применяем новый порядок
                this.reorderTabsByOrder(containerWidget, newOrder);
            }, 10);
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.tab-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    reorderTabsByOrder(containerWidget, newOrder) {
        if (!containerWidget || !containerWidget.tabGroups) return;

        const slots = containerWidget.getSlotsPerTab ? containerWidget.getSlotsPerTab() : 1;
        if (slots > 1) return;

        const byPrimary = new Map();
        for (const g of containerWidget.tabGroups) {
            if (g?.length) byPrimary.set(g[0], [...g]);
        }

        const next = [];
        for (const id of newOrder) {
            const g = byPrimary.get(id);
            if (g) next.push(g);
        }
        for (const g of containerWidget.tabGroups) {
            if (g?.length && !next.some((row) => row[0] === g[0])) {
                next.push([...g]);
            }
        }

        const flatOld = containerWidget.containedWidgets.join('\0');
        containerWidget.tabGroups = next;
        if (typeof containerWidget.syncContainedWidgetsFromTabGroups === 'function') {
            containerWidget.syncContainedWidgetsFromTabGroups();
        }
        const flatNew = containerWidget.containedWidgets.join('\0');
        if (flatOld === flatNew) return;

        // Принудительно обновляем отображение контейнера
        const content = containerWidget.element?.querySelector('.widget-content');
        const header = content?.querySelector('.container-header');
        if (header) {
            header.innerHTML = '';
        }

        containerWidget.render();

        // Обновляем список в панели стилей
        this.updateTabsList(containerWidget);

        if (this.engine && this.engine.saveSnapshot) {
            this.engine.saveSnapshot();
        }
    }

    openWidgetStyles(widget) {
        if (!widget || !this.engine) return;
        
        // Выделяем виджет
        if (this.engine.widgetManager) {
            this.engine.widgetManager.selectWidget(widget.id);
        }
        
        // Открываем панель стилей для этого виджета
        this.show(widget);
    }

    loadWidgetStyles(widget) {
        if (!widget) return;

        this._loadingWidgetStylesDepth =
            (typeof this._loadingWidgetStylesDepth === 'number' ? this._loadingWidgetStylesDepth : 0) + 1;
        this._isLoadingWidgetStyles = true;
        try {
        const styles = widget.getStyles() || {};

        // Layout
        const xInput = this.panel.querySelector('#style-x');
        const yInput = this.panel.querySelector('#style-y');
        const wInput = this.panel.querySelector('#style-w');
        const hInput = this.panel.querySelector('#style-h');
        if (xInput) xInput.value = widget.x || 0;
        if (yInput) yInput.value = widget.y || 0;
        if (wInput) wInput.value = widget.width || 300;
        if (hInput) hInput.value = widget.height || 200;

        const exportProfileToggle = this.panel.querySelector('#style-allow-export-profile');
        const exportProfileGroup = this.panel.querySelector('#style-allow-export-profile-group');
        if (exportProfileGroup) {
            exportProfileGroup.style.display = widget.type === 'filter' ? 'none' : '';
        }
        if (exportProfileToggle) {
            exportProfileToggle.checked = widget.type === 'filter'
              ? false
              : widget.settings?.allowExportToProfile !== false;
        }

        // Alignment
        const layout = styles.layout || {};
        // Убираем активный класс со всех кнопок выравнивания
        this.panel.querySelectorAll('.alignment-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (layout.alignment) {
            // Поддерживаем старый формат (просто строка) и новый формат (объект)
            let horizontalAlign = 'center';
            let verticalAlign = 'middle';
            
            if (typeof layout.alignment === 'string') {
                // Старый формат - одно значение
                if (['left', 'center', 'right'].includes(layout.alignment)) {
                    horizontalAlign = layout.alignment;
                } else {
                    verticalAlign = layout.alignment;
                }
            } else if (typeof layout.alignment === 'object') {
                // Новый формат - объект с horizontal и vertical
                horizontalAlign = layout.alignment.horizontal || 'center';
                verticalAlign = layout.alignment.vertical || 'middle';
            }
            
            // Добавляем активный класс к сохраненным кнопкам выравнивания
            const horizontalBtn = this.panel.querySelector(`[data-align="${horizontalAlign}"]`);
            const verticalBtn = this.panel.querySelector(`[data-align="${verticalAlign}"]`);
            if (horizontalBtn) horizontalBtn.classList.add('active');
            if (verticalBtn) verticalBtn.classList.add('active');
        } else {
            // Устанавливаем значения по умолчанию (center, middle)
            const centerBtn = this.panel.querySelector('[data-align="center"]');
            const middleBtn = this.panel.querySelector('[data-align="middle"]');
            if (centerBtn) centerBtn.classList.add('active');
            if (middleBtn) middleBtn.classList.add('active');
        }

        // Appearance
        // Все поля сбрасываются к умолчаниям, чтобы значения не «перетекали» между виджетами.
        const appearance = styles.appearance || {};
        const variantSelect = this.panel.querySelector('#style-variant');
        if (variantSelect) {
            variantSelect.value = WIDGET_VARIANTS.includes(appearance.variant) ? appearance.variant : 'glass';
        }
        const densitySelect = this.panel.querySelector('#style-density');
        if (densitySelect) {
            densitySelect.value = WIDGET_DENSITIES.includes(appearance.density) ? appearance.density : 'normal';
        }
        const bgType = this.panel.querySelector('#style-bg-type');
        if (bgType) {
            bgType.value = ['solid', 'gradient', 'glass'].includes(appearance.backgroundType)
                ? appearance.backgroundType
                : '';
            bgType.dispatchEvent(new Event('change'));
        }
        
        const bgColor = this.panel.querySelector('#style-bg-color');
        const bgColorText = this.panel.querySelector('#style-bg-color-text');
        if (bgColor && bgColorText) {
            const bg = appearance.backgroundColor || '#1a1d22';
            bgColor.value = /^#[0-9a-f]{6}$/i.test(bg) ? bg : '#1a1d22';
            bgColorText.value = bg;
        }
        
        const opacity = this.panel.querySelector('#style-opacity');
        const opacityValue = this.panel.querySelector('#opacity-value');
        if (opacity && opacityValue) {
            const op = Number.isFinite(Number(appearance.opacity)) && appearance.opacity !== null && appearance.opacity !== ''
                ? Math.min(1, Math.max(0, Number(appearance.opacity)))
                : 1;
            opacity.value = op;
            opacityValue.textContent = Math.round(op * 100) + '%';
        }
        
        const blendMode = this.panel.querySelector('#style-blend-mode');
        if (blendMode) {
            blendMode.value = appearance.blendMode || 'normal';
        }
        
        // Glass mode
        {
            const isGlass = appearance.backgroundType === 'glass';
            const glassEnabled = this.panel.querySelector('#style-glass-enabled');
            if (glassEnabled) glassEnabled.checked = isGlass;
            const glassColor = this.panel.querySelector('#style-glass-color');
            if (glassColor) {
                const gc = appearance.glassColor || '#ffffff';
                glassColor.value = /^#[0-9a-f]{6}$/i.test(gc) ? gc : '#ffffff';
            }
            const glassBlur = this.panel.querySelector('#style-glass-blur');
            const glassBlurValue = this.panel.querySelector('#glass-blur-value');
            const blur = Number.isFinite(Number(appearance.glassBlur)) && appearance.glassBlur !== null && appearance.glassBlur !== ''
                ? Number(appearance.glassBlur)
                : 8;
            if (glassBlur) glassBlur.value = blur;
            if (glassBlurValue) glassBlurValue.textContent = blur + 'px';
            const glassOpacity = this.panel.querySelector('#style-glass-opacity');
            const glassOpacityValue = this.panel.querySelector('#glass-opacity-value');
            const gop = Number.isFinite(Number(appearance.glassOpacity)) && appearance.glassOpacity !== null && appearance.glassOpacity !== ''
                ? Number(appearance.glassOpacity)
                : 0.1;
            if (glassOpacity) glassOpacity.value = gop;
            if (glassOpacityValue) glassOpacityValue.textContent = gop.toFixed(1);
        }
        
        // Gradient
        if (appearance.backgroundType === 'gradient') {
            this.applyGradientConfigToPanel(
                appearance.gradient || this.defaultGradientConfig(),
                { showCustom: this.isGradientMatchingAnyPreset(appearance.gradient) ? false : true },
            );
        } else {
            this.currentGradient = null;
            this.setCustomGradientControlsVisible(false);
        }

        // Typography
        const typography = styles.typography || {};
        const fontFamily = this.panel.querySelector('#style-font-family');
        if (fontFamily) fontFamily.value = typography.fontFamily || 'Inter';
        
        const fontWeight = this.panel.querySelector('#style-font-weight');
        const fontWeightValue = this.panel.querySelector('#font-weight-value');
        if (fontWeight && fontWeightValue) {
            fontWeight.value = typography.fontWeight || '400';
            fontWeightValue.textContent = typography.fontWeight || '400';
        }
        
        const fontSize = this.panel.querySelector('#style-font-size');
        const fontSizeValue = this.panel.querySelector('#font-size-value');
        if (fontSize && fontSizeValue) {
            fontSize.value = typography.fontSize || 16;
            fontSizeValue.textContent = (typography.fontSize || 16) + 'px';
        }
        
        const textColor = this.panel.querySelector('#style-text-color');
        const textColorText = this.panel.querySelector('#style-text-color-text');
        const defaultTypographyColor = widget.type === 'filter' ? '#000000' : null;
        const resolvedTypographyColor = typography.color || defaultTypographyColor;
        if (textColor && textColorText && resolvedTypographyColor) {
            textColor.value = resolvedTypographyColor;
            textColorText.value = resolvedTypographyColor;
        }
        
        const textShadow = this.panel.querySelector('#style-text-shadow');
        if (textShadow) {
            textShadow.value = typography.textShadow || '';
        }
        
        this.updateTypographyPreview();

        // Borders
        const borders = styles.borders || {};
        const borderWidth = this.panel.querySelector('#style-border-width');
        const borderWidthValue = this.panel.querySelector('#border-width-value');
        if (borderWidth && borderWidthValue) {
            borderWidth.value = borders.width || 0;
            borderWidthValue.textContent = (borders.width || 0) + 'px';
        }
        
        const borderStyle = this.panel.querySelector('#style-border-style');
        if (borderStyle) {
            borderStyle.value = borders.style || 'solid';
        }
        
        const borderColor = this.panel.querySelector('#style-border-color');
        const borderColorText = this.panel.querySelector('#style-border-color-text');
        if (borderColor && borderColorText) {
            const bc = borders.color || '#00e0ff';
            borderColor.value = /^#[0-9a-f]{6}$/i.test(bc) ? bc : '#00e0ff';
            borderColorText.value = borders.color || '';
        }
        
        const borderRadius = this.panel.querySelector('#style-border-radius');
        const borderRadiusValue = this.panel.querySelector('#border-radius-value');
        if (borderRadius && borderRadiusValue) {
            borderRadius.value = borders.radius || 0;
            borderRadiusValue.textContent = (borders.radius || 0) + 'px';
        }
        
        // Neon glow
        {
            const neonEnabled = this.panel.querySelector('#style-neon-glow-enabled');
            const neonControls = this.panel.querySelector('#neon-glow-controls');
            const neonOn = !!(borders.neonGlow && borders.neonGlow.enabled);
            if (neonEnabled) neonEnabled.checked = neonOn;
            if (neonControls) neonControls.style.display = neonOn ? 'block' : 'none';
            if (neonOn && borders.neonGlow) {
                const neonIntensity = this.panel.querySelector('#style-neon-intensity');
                const neonIntensityValue = this.panel.querySelector('#neon-intensity-value');
                if (neonIntensity) {
                    neonIntensity.value = borders.neonGlow.intensity ?? 12;
                    if (neonIntensityValue) {
                        neonIntensityValue.textContent = `${neonIntensity.value}px`;
                    }
                }
                const neonSpread = this.panel.querySelector('#style-neon-spread');
                const neonSpreadValue = this.panel.querySelector('#neon-spread-value');
                if (neonSpread) {
                    neonSpread.value = borders.neonGlow.spread ?? 0;
                    if (neonSpreadValue) {
                        neonSpreadValue.textContent = `${neonSpread.value}px`;
                    }
                }
                const neonColor = this.panel.querySelector('#style-neon-color');
                if (neonColor && borders.neonGlow.color) neonColor.value = borders.neonGlow.color;
            }
        }

        // Shadows — restore layers before any synthetic change events that call updateWidget
        {
            const shadowLayersEl = this.panel.querySelector('#shadow-layers');
            if (shadowLayersEl) {
                shadowLayersEl.innerHTML = '';
                const shadows = Array.isArray(styles.shadows) ? styles.shadows : [];
                shadows.forEach((shadow) => {
                    if (!shadow || shadow.enabled === false) return;
                    this.addShadowLayer(shadow);
                });
            }
        }

        // Animations
        const animations = styles.animations || {};
        const animEnabled = this.panel.querySelector('#style-animation-enabled');
        const animControlsWrapper = this.panel.querySelector('#animation-controls-wrapper');
        if (animEnabled) {
            animEnabled.checked = animations.enabled || false;
            if (animControlsWrapper) {
                animControlsWrapper.style.display = animEnabled.checked ? 'block' : 'none';
            }
        }
        
        // Advanced CSS
        const advancedCSS = styles.advancedCSS || {};
        const customCSS = this.panel.querySelector('#style-custom-css');
        if (customCSS && advancedCSS.custom) {
            customCSS.value = advancedCSS.custom;
        }
        
        // Container tab position settings (только для виджетов типа container)
        if (widget.type === 'container') {
            if (!widget.settings || typeof widget.settings !== 'object') widget.settings = {};
            this.loadWidgetTitleSettingsToPanel(widget.settings, 'container', {
                defaultTitle: 'Шкаф',
            });
            const tabPositionSelect = this.panel.querySelector('#container-tab-position');
            if (tabPositionSelect) {
                const tabPosition = widget.tabPosition || 'top';
                tabPositionSelect.value = tabPosition;
            }
            
            const contentCollapsedToggle = this.panel.querySelector('#container-content-collapsed');
            if (contentCollapsedToggle) {
                const contentCollapsed = widget.contentCollapsed !== undefined ? widget.contentCollapsed : false;
                contentCollapsedToggle.checked = contentCollapsed;
            }

            const slotsSelect = this.panel.querySelector('#container-slots-per-tab');
            if (slotsSelect) {
                const n = widget.getSlotsPerTab ? widget.getSlotsPerTab() : 1;
                slotsSelect.value = String(Math.min(4, Math.max(1, n)));
            }
        }
        
        // Таблица: лимит строк и заголовок
        if (widget.type === 'table' && widget.settings) {
            const s = widget.settings;
            const maxRowsInput = this.panel.querySelector('#table-max-rows');
            if (maxRowsInput) {
                let v = parseInt(widget.settings.maxRows, 10);
                if (!Number.isFinite(v)) v = 500;
                v = Math.min(5000, Math.max(1, v));
                maxRowsInput.value = String(v);
            }
            const tableShow = this.panel.querySelector('#table-show-title');
            if (tableShow) tableShow.checked = !!s.showTitle;
            const tableTit = this.panel.querySelector('#table-widget-title');
            if (tableTit) {
                tableTit.value =
                    s.title != null && String(s.title).length ? String(s.title) : 'Таблица';
            }
            const tableTs = this.panel.querySelector('#table-title-size');
            if (tableTs) {
                let ts = parseInt(s.titleSize, 10);
                if (!Number.isFinite(ts)) ts = 14;
                tableTs.value = String(Math.min(48, Math.max(8, ts)));
            }
            this.writeTitleColorToPanel('table', s.titleColor, '#8B5CF6');
            const hdrPick = this.panel.querySelector('#table-column-header-bg-color');
            const hdrText = this.panel.querySelector('#table-column-header-bg-color-text');
            const hdrVal = s.columnHeaderBackgroundColor || '#6b7280';
            if (hdrPick) hdrPick.value = hdrVal;
            if (hdrText) hdrText.value = hdrVal;
            this.syncWidgetTitleSubRows('table');
        }

        if (widget.type === 'pie-chart' && widget.settings) {
            const s = widget.settings;
            const sliceW = this.panel.querySelector('#pie-chart-slice-weight');
            if (sliceW) {
                const v = s.pieSliceWeight === 'sum' || s.pieSliceWeight === 'count' ? s.pieSliceWeight : 'auto';
                sliceW.value = v;
            }
            const pieThrTa = this.panel.querySelector('#pie-chart-slice-threshold-formula');
            if (pieThrTa) pieThrTa.value = s.pieSliceThresholdFormula != null ? String(s.pieSliceThresholdFormula) : '';
            const pieHi = this.panel.querySelector('#pie-chart-slice-above-color');
            const pieLo = this.panel.querySelector('#pie-chart-slice-below-color');
            if (pieHi) {
                const c = s.pieSliceAboveColor || '#34d399';
                pieHi.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#34d399';
            }
            if (pieLo) {
                const c = s.pieSliceBelowColor || '#f87171';
                pieLo.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#f87171';
            }
            const legEnabled = s.legend?.enabled !== false && s.showLegend !== false;
            const legendCb = this.panel.querySelector('#pie-chart-show-legend');
            if (legendCb) legendCb.checked = legEnabled;

            const donutCb = this.panel.querySelector('#pie-chart-donut');
            if (donutCb) donutCb.checked = !!s.donut;

            const innerR = this.panel.querySelector('#pie-chart-inner-radius');
            const innerRVal = this.panel.querySelector('#pie-chart-inner-radius-value');
            if (innerR) {
                let ir = parseFloat(s.innerRadius);
                if (!Number.isFinite(ir)) ir = 0.58;
                ir = Math.min(0.85, Math.max(0.2, ir));
                innerR.value = String(ir);
                if (innerRVal) innerRVal.textContent = String(ir);
            }

            const segPad = this.panel.querySelector('#pie-chart-segment-pad');
            const segPadVal = this.panel.querySelector('#pie-chart-segment-pad-value');
            if (segPad) {
                let sp = parseFloat(s.segmentPad);
                if (!Number.isFinite(sp)) sp = 0.04;
                sp = Math.min(0.14, Math.max(0, sp));
                segPad.value = String(sp);
                if (segPadVal) segPadVal.textContent = String(sp);
            }

            let pieMode = String(s.pieColorMode || '').toLowerCase();
            if (!['gradient', 'solid', 'palette'].includes(pieMode)) {
                pieMode = s.gradients?.enabled ? 'gradient' : 'palette';
            }
            const colorModeEl = this.panel.querySelector('#pie-chart-color-mode');
            if (colorModeEl) colorModeEl.value = pieMode;
            const solidEl = this.panel.querySelector('#pie-chart-solid-color');
            if (solidEl) {
                const sc = s.pieSolidColor || (Array.isArray(s.colors) && s.colors[0]) || '#00E0FF';
                solidEl.value = /^#[0-9a-fA-F]{6}$/i.test(sc) ? sc : '#00E0FF';
            }
            this.populatePiePaletteSwatches(
                Array.isArray(s.colors) && s.colors.length
                    ? s.colors
                    : ['#00E0FF', '#3D8BFF', '#005DFF', '#00FFB8', '#FF6B6B', '#FFD93D'],
                s.paletteFormulas,
            );

            const labelPos = this.panel.querySelector('#pie-chart-label-position');
            if (labelPos) labelPos.value = s.labels?.position || 'inside';
            const labelValueDisp = this.panel.querySelector('#pie-chart-label-value-display');
            if (labelValueDisp) {
                const m = String(s.labels?.valueDisplay || '').toLowerCase();
                if (['percent', 'value', 'both', 'none'].includes(m)) {
                    labelValueDisp.value = m;
                } else if (s.labels?.showValue && s.labels?.showPercent !== false) {
                    labelValueDisp.value = 'both';
                } else if (s.labels?.showValue) {
                    labelValueDisp.value = 'value';
                } else if (s.labels?.showPercent === false) {
                    labelValueDisp.value = 'none';
                } else {
                    labelValueDisp.value = 'percent';
                }
            }
            const labelShowName = this.panel.querySelector('#pie-chart-label-show-name');
            if (labelShowName) labelShowName.checked = !!s.labels?.showName;
            const legendValueDisp = this.panel.querySelector('#pie-chart-legend-value-display');
            if (legendValueDisp) {
                const m = String(s.legend?.valueDisplay || '').toLowerCase();
                if (['percent', 'value', 'both', 'none'].includes(m)) {
                    legendValueDisp.value = m;
                } else if (s.legend?.showValue && s.legend?.showPercent !== false) {
                    legendValueDisp.value = 'both';
                } else if (s.legend?.showValue) {
                    legendValueDisp.value = 'value';
                } else if (s.legend?.showPercent === false) {
                    legendValueDisp.value = 'none';
                } else {
                    legendValueDisp.value = 'percent';
                }
            }

            const legPos = this.panel.querySelector('#pie-chart-legend-position');
            if (legPos) legPos.value = s.legend?.position || 'right';

            const legAlign = this.panel.querySelector('#pie-chart-legend-align');
            if (legAlign) legAlign.value = s.legend?.align || 'start';

            const legFlow = this.panel.querySelector('#pie-chart-legend-item-flow');
            if (legFlow) {
                const f = s.legend?.itemFlow === 'row' ? 'row' : 'column';
                legFlow.value = f;
            }

            const legSearch = this.panel.querySelector('#pie-chart-legend-search');
            if (legSearch) legSearch.checked = s.legend?.searchEnabled !== false;

            const groupSmall = this.panel.querySelector('#pie-chart-group-small');
            if (groupSmall) groupSmall.checked = s.legend?.groupSmallIntoOther !== false;

            const c = s.center || {};
            const cenOn = this.panel.querySelector('#pie-chart-center-enabled');
            if (cenOn) cenOn.checked = c.enabled !== false;

            const cSrc = this.panel.querySelector('#pie-chart-center-source');
            if (cSrc) cSrc.value = c.valueSource === 'measure' ? 'measure' : 'segments';

            const cSeg = this.panel.querySelector('#pie-chart-center-seg-aggregate');
            if (cSeg) {
                const a = c.segmentAggregate || 'sum';
                cSeg.value = ['sum', 'avg', 'min', 'max', 'count'].includes(a) ? a : 'sum';
            }

            const cMeas = this.panel.querySelector('#pie-chart-center-measure-fn');
            if (cMeas) {
                const fn = (c.measureFn || 'sum').toLowerCase();
                cMeas.value = ['sum', 'avg', 'min', 'max', 'count'].includes(fn) ? fn : 'sum';
            }

            const cFmt = this.panel.querySelector('#pie-chart-center-number-format');
            if (cFmt) {
                const fm = c.numberFormat || 'compact';
                cFmt.value = ['compact', 'standard', 'scientific', 'integer'].includes(fm) ? fm : 'compact';
            }

            const cTpl = this.panel.querySelector('#pie-chart-center-template');
            if (cTpl) cTpl.value = c.template != null ? String(c.template) : '{total}';

            const pieShow = this.panel.querySelector('#pie-chart-show-title');
            if (pieShow) pieShow.checked = !!s.showTitle;
            const pieTit = this.panel.querySelector('#pie-chart-widget-title');
            if (pieTit) {
                pieTit.value =
                    s.title != null && String(s.title).length ? String(s.title) : 'Круговая диаграмма';
            }
            const pieTs = this.panel.querySelector('#pie-chart-title-size');
            if (pieTs) {
                let ts = parseInt(s.titleSize, 10);
                if (!Number.isFinite(ts)) ts = 14;
                pieTs.value = String(Math.min(48, Math.max(8, ts)));
            }
            this.writeTitleColorToPanel('pie-chart', s.titleColor, '#8B5CF6');
            this.syncPieChartDependentUi();
        }

        if (widget.type === 'bar-chart' && widget.settings) {
            const s = widget.settings;
            const sliceW = this.panel.querySelector('#bar-chart-slice-weight');
            if (sliceW) {
                const v =
                    s.barSliceWeight === 'sum' || s.barSliceWeight === 'count'
                        ? s.barSliceWeight
                        : 'auto';
                sliceW.value = v;
            }

            const orient = this.panel.querySelector('#bar-chart-orientation');
            if (orient) {
                const o = s.barOrientation;
                orient.value =
                    o === 'top' || o === 'left' || o === 'right' || o === 'bottom' ? o : 'bottom';
            }

            const sort = this.panel.querySelector('#bar-chart-sort');
            if (sort) {
                const so = s.barSort;
                sort.value =
                    so === 'value_desc' ||
                    so === 'value_asc' ||
                    so === 'label_asc' ||
                    so === 'label_desc' ||
                    so === 'none'
                        ? so
                        : 'none';
            }

            const gap = this.panel.querySelector('#bar-chart-gap');
            const gapVal = this.panel.querySelector('#bar-chart-gap-value');
            if (gap) {
                let g = parseFloat(s.barGap);
                if (!Number.isFinite(g)) g = 0.2;
                g = Math.min(0.9, Math.max(0, g));
                gap.value = String(Math.round(g * 100));
                if (gapVal) gapVal.textContent = g.toFixed(2);
            }

            const lp = this.panel.querySelector('#bar-chart-label-placement');
            if (lp) {
                const v = s.barLabelPlacement;
                lp.value =
                    v === 'axis' || v === 'onBar' || v === 'both' || v === 'none' ? v : 'axis';
            }

        const lr = this.panel.querySelector('#bar-chart-label-rotation');
        if (lr) {
            let n = parseInt(s.barLabelRotation, 10);
            if (!Number.isFinite(n)) n = 0;
            lr.value = String([0, 45, 90, -45].includes(n) ? n : 0);
        }

            const vf = this.panel.querySelector('#bar-chart-value-format');
            if (vf) {
                const v = s.barValueFormat;
                vf.value = v === 'int' || v === 'compact' ? v : 'raw';
            }

            const cm = this.panel.querySelector('#bar-chart-color-mode');
            if (cm) {
                const v = s.barColorMode;
                cm.value = v === 'solid' || v === 'palette' ? v : 'gradient';
            }

            const solid = this.panel.querySelector('#bar-chart-solid-color');
            if (solid) {
                const c = s.barSolidColor || '#00E0FF';
                solid.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#00E0FF';
            }

            const bThr = this.panel.querySelector('#bar-chart-threshold-formula');
            if (bThr) bThr.value = s.barThresholdFormula != null ? String(s.barThresholdFormula) : '';
            const bHi = this.panel.querySelector('#bar-chart-threshold-high-color');
            const bLo = this.panel.querySelector('#bar-chart-threshold-low-color');
            if (bHi) {
                const c = s.barThresholdHighColor || '#34d399';
                bHi.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#34d399';
            }
            if (bLo) {
                const c = s.barThresholdLowColor || '#f87171';
                bLo.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#f87171';
            }

            const palArr = Array.isArray(s.barPalette)
                ? s.barPalette
                : typeof s.barPalette === 'string' && s.barPalette.trim()
                  ? s.barPalette
                        .split(/[,;\s]+/)
                        .map((x) => x.trim())
                        .filter(Boolean)
                  : [];
            this.populateBarPaletteSwatches(palArr, s.barPaletteFormulas);

            const sc = this.panel.querySelector('#bar-chart-scroll');
            if (sc) {
                const v = s.barScroll;
                sc.value = v === 'off' || v === 'on' ? v : 'auto';
            }

            const mb = this.panel.querySelector('#bar-chart-min-band');
            const mbVal = this.panel.querySelector('#bar-chart-min-band-value');
            if (mb) {
                let n = parseInt(s.barMinBandPx, 10);
                if (!Number.isFinite(n)) n = 28;
                n = Math.min(120, Math.max(12, n));
                mb.value = String(n);
                if (mbVal) mbVal.textContent = String(n);
            }

            const gapPx = this.panel.querySelector('#bar-chart-gap-px');
            const gapPxVal = this.panel.querySelector('#bar-chart-gap-px-value');
            if (gapPx) {
                let g = parseInt(s.barGapPx, 10);
                if (!Number.isFinite(g)) g = 8;
                g = Math.min(28, Math.max(0, g));
                gapPx.value = String(g);
                if (gapPxVal) gapPxVal.textContent = String(g);
            }

            const showV = this.panel.querySelector('#bar-chart-show-values');
            if (showV) showV.checked = s.showValues !== false;

            const vPos = this.panel.querySelector('#bar-chart-value-position');
            if (vPos) {
                const v = s.valuePosition;
                vPos.value =
                    v === 'inside' || v === 'outside' || v === 'top' || v === 'right' ? v : 'top';
            }

            const p = s.padding || {};
            const pt = this.panel.querySelector('#bar-chart-pad-t');
            const pr = this.panel.querySelector('#bar-chart-pad-r');
            const pb = this.panel.querySelector('#bar-chart-pad-b');
            const pl = this.panel.querySelector('#bar-chart-pad-l');
            if (pt) pt.value = String(p.top ?? 20);
            if (pr) pr.value = String(p.right ?? 20);
            if (pb) pb.value = String(p.bottom ?? 44);
            if (pl) pl.value = String(p.left ?? 48);

            const brEl = this.panel.querySelector('#bar-chart-border-radius');
            const brVal = this.panel.querySelector('#bar-chart-border-radius-value');
            if (brEl) {
                let r = parseInt(s.barBorderRadius, 10);
                if (!Number.isFinite(r)) r = 4;
                r = Math.min(16, Math.max(0, r));
                brEl.value = String(r);
                if (brVal) brVal.textContent = String(r);
            }

            const gOp = this.panel.querySelector('#bar-chart-grid-opacity');
            const gOpVal = this.panel.querySelector('#bar-chart-grid-opacity-value');
            if (gOp) {
                let o = parseFloat(s.gridOpacity);
                if (!Number.isFinite(o)) o = 0.14;
                o = Math.min(0.4, Math.max(0, o));
                gOp.value = String(Math.round(o * 100));
                if (gOpVal) gOpVal.textContent = o.toFixed(2);
            }

            const hov = this.panel.querySelector('#bar-chart-hover');
            if (hov) hov.checked = s.barHoverEffect !== false;

            const stAvg = this.panel.querySelector('#bar-chart-stats-avg');
            if (stAvg) stAvg.checked = !!s.stats?.showAvg;
            const stMed = this.panel.querySelector('#bar-chart-stats-median');
            if (stMed) stMed.checked = !!s.stats?.showMedian;
            const stSum = this.panel.querySelector('#bar-chart-stats-sum');
            if (stSum) stSum.checked = !!s.stats?.showSum;

            const barShow = this.panel.querySelector('#bar-chart-show-title');
            if (barShow) barShow.checked = !!s.showTitle;
            const barTit = this.panel.querySelector('#bar-chart-widget-title');
            if (barTit) {
                barTit.value =
                    s.title != null && String(s.title).length ? String(s.title) : 'Столбчатая диаграмма';
            }
            const barTs = this.panel.querySelector('#bar-chart-title-size');
            if (barTs) {
                let ts = parseInt(s.titleSize, 10);
                if (!Number.isFinite(ts)) ts = 14;
                barTs.value = String(Math.min(48, Math.max(8, ts)));
            }
            this.writeTitleColorToPanel('bar-chart', s.titleColor, '#8B5CF6');
            this.syncWidgetTitleSubRows('bar-chart');
        }

        if (widget.type === 'line-chart' && widget.settings) {
            const s = widget.settings;
            const q = (id) => this.panel.querySelector(id);
            const lineSection = this.panel.querySelector('.line-chart-settings-section');
            if (lineSection) this._ensureLineChartTabsLayout(lineSection);
            this.loadWidgetTitleSettingsToPanel(s, 'line-chart', {
                defaultTitle: 'Линейный график',
            });

            const ze = q('#line-chart-zoom-enabled');
            if (ze) ze.checked = s.zoom?.enabled !== false;
            const pe = q('#line-chart-pan-enabled');
            if (pe) pe.checked = s.pan?.enabled !== false;
            const me = q('#line-chart-minimap-enabled');
            if (me) me.checked = s.miniMap?.enabled !== false;
            const mh = q('#line-chart-minimap-height');
            const mhVal = q('#line-chart-minimap-height-value');
            if (mh) {
                let h = parseInt(s.miniMap?.height, 10);
                if (!Number.isFinite(h)) h = 60;
                h = Math.min(120, Math.max(40, h));
                mh.value = String(h);
                if (mhVal) mhVal.textContent = String(h);
            }
            const wz = q('#line-chart-wheel-zoom');
            if (wz) wz.checked = s.zoom?.wheel !== false;
            const dz = q('#line-chart-drag-zoom');
            if (dz) dz.checked = s.zoom?.dragSelect !== false;
            const dr = q('#line-chart-dbl-reset');
            if (dr) dr.checked = s.zoom?.doubleClickReset !== false;
            const zx = q('#line-chart-zoom-x');
            if (zx) zx.checked = s.zoom?.x !== false;
            const zy = q('#line-chart-zoom-y');
            if (zy) zy.checked = s.zoom?.y !== false;
            const cfb = q('#line-chart-cross-filter-brush-x');
            if (cfb) {
                const axType = s.axis?.x?.type || 'auto';
                const effective =
                    typeof s.crossFilterBrushX === 'boolean' ? s.crossFilterBrushX : axType === 'time';
                cfb.checked = effective;
            }

            const dwa = q('#line-chart-data-window-anchor');
            if (dwa) {
                const a = s.dataWindow?.anchor || 'start';
                dwa.value = a === 'end' ? 'end' : 'start';
            }
            const isp = q('#line-chart-initial-span');
            const ispVal = q('#line-chart-initial-span-value');
            if (isp) {
                let frac = parseFloat(s.dataWindow?.initialSpan);
                if (!Number.isFinite(frac)) frac = 1;
                frac = Math.min(1, Math.max(0.1, frac));
                const pct = Math.round(frac * 100);
                isp.value = String(Math.min(100, Math.max(10, pct - (pct % 5))));
                if (ispVal) ispVal.textContent = `${isp.value}%`;
            }

            const lw = q('#line-chart-line-width');
            const lwVal = q('#line-chart-line-width-value');
            if (lw) {
                let w = parseInt(s.line?.width, 10);
                if (!Number.isFinite(w)) w = 2;
                lw.value = String(Math.min(8, Math.max(1, w)));
                if (lwVal) lwVal.textContent = String(lw.value);
            }
            const sm = q('#line-chart-line-smooth');
            if (sm) sm.checked = s.line?.smooth !== false;
            const chartTypeEl = q('#line-chart-chart-type');
            if (chartTypeEl) {
                const ct = s.chartType || (s.line?.smooth === false ? 'line' : 'spline');
                chartTypeEl.value = ['line', 'area', 'step', 'spline'].includes(ct) ? ct : 'spline';
            }
            const stackEl = q('#line-chart-stack');
            if (stackEl) stackEl.checked = !!s.stack;
            const legEl = q('#line-chart-legend-enabled');
            if (legEl) legEl.checked = s.legend?.enabled !== false;
            const chEl = q('#line-chart-crosshair-enabled');
            if (chEl) chEl.checked = s.crosshair?.enabled !== false;
            const pctEl = q('#line-chart-tooltip-pct');
            if (pctEl) pctEl.checked = s.tooltip?.showPctChange !== false;
            const stLast = q('#line-chart-stats-last');
            if (stLast) stLast.checked = !!s.stats?.showLast;
            const stMm = q('#line-chart-stats-minmax');
            if (stMm) stMm.checked = !!s.stats?.showMinMax;
            const stAvg = q('#line-chart-stats-avg');
            if (stAvg) stAvg.checked = !!s.stats?.showAvg;
            const stMed = q('#line-chart-stats-median');
            if (stMed) stMed.checked = !!s.stats?.showMedian;
            const stSum = q('#line-chart-stats-sum');
            if (stSum) stSum.checked = !!s.stats?.showSum;
            const maEn = q('#line-chart-ma-enabled');
            if (maEn) maEn.checked = !!s.analytics?.ma?.enabled;
            const maW = q('#line-chart-ma-window');
            if (maW) maW.value = String(s.analytics?.ma?.window || 7);
            const trEn = q('#line-chart-trend-enabled');
            if (trEn) trEn.checked = !!s.analytics?.trend?.enabled;
            const trDeg = q('#line-chart-trend-degree');
            if (trDeg) trDeg.value = s.analytics?.trend?.degree === 2 ? '2' : '1';
            const cmpEn = q('#line-chart-compare-enabled');
            if (cmpEn) cmpEn.checked = !!s.analytics?.compare?.enabled;
            const cmpMode = q('#line-chart-compare-mode');
            if (cmpMode) cmpMode.value = s.analytics?.compare?.mode || 'previous_period';
            const cmpShift = q('#line-chart-compare-shift');
            if (cmpShift) cmpShift.value = s.analytics?.compare?.shiftMs != null ? String(s.analytics.compare.shiftMs) : '';
            const fcEn = q('#line-chart-forecast-enabled');
            if (fcEn) fcEn.checked = !!s.analytics?.forecast?.enabled;
            const fcH = q('#line-chart-forecast-horizon');
            if (fcH) fcH.value = String(s.analytics?.forecast?.horizon || 30);
            const fcM = q('#line-chart-forecast-method');
            if (fcM) fcM.value = s.analytics?.forecast?.method || 'linear';
            const fcC = q('#line-chart-forecast-conf');
            if (fcC) fcC.value = Number(s.analytics?.forecast?.confidence) >= 0.95 ? '0.95' : '0.8';
            const anEn = q('#line-chart-anomalies-enabled');
            if (anEn) anEn.checked = !!s.analytics?.anomalies?.enabled;
            const lodEl = q('#line-chart-lod-mode');
            if (lodEl) lodEl.value = s.lod?.mode === 'lttb' ? 'lttb' : 'minmax';
            const prefSrv = q('#line-chart-prefer-server-agg');
            if (prefSrv) prefSrv.checked = s.timeframe?.preferServerAggregation !== false;
            const zt = q('#line-chart-zoom-toolbar');
            if (zt) zt.checked = s.zoom?.showToolbar !== false;
            this.renderLineChartSeriesList(widget);
            this.renderLineChartReferencesList(widget);
            this._syncLineChartRefTypeUi();
            const lst = q('#line-chart-line-style');
            if (lst) {
                const v = s.line?.style;
                lst.value = v === 'dashed' || v === 'dotted' ? v : 'solid';
            }
            const lop = q('#line-chart-line-opacity');
            const lopVal = q('#line-chart-line-opacity-value');
            if (lop) {
                let o = parseFloat(s.line?.opacity);
                if (!Number.isFinite(o)) o = 0.95;
                o = Math.min(1, Math.max(0.2, o));
                lop.value = String(Math.round(o * 100));
                if (lopVal) lopVal.textContent = o.toFixed(2);
            }

            const pEn = q('#line-chart-points-enabled');
            if (pEn) pEn.checked = !!s.points?.enabled;
            const pr = q('#line-chart-point-radius');
            const prVal = q('#line-chart-point-radius-value');
            if (pr) {
                pr.value = String(Math.min(12, Math.max(0, parseInt(s.points?.radius, 10) || 3)));
                if (prVal) prVal.textContent = String(pr.value);
            }
            const ph = q('#line-chart-point-hover-radius');
            const phVal = q('#line-chart-point-hover-radius-value');
            if (ph) {
                ph.value = String(Math.min(20, Math.max(2, parseInt(s.points?.hoverRadius, 10) || 6)));
                if (phVal) phVal.textContent = String(ph.value);
            }
            const pc = q('#line-chart-point-color');
            if (pc) {
                const c = s.points?.color || s.line?.color || '#4DA3FF';
                pc.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#4DA3FF';
            }

            const lnThr = q('#line-chart-threshold-formula');
            if (lnThr) lnThr.value = s.lineThresholdFormula != null ? String(s.lineThresholdFormula) : '';
            const lnHi = q('#line-chart-threshold-high-color');
            const lnLo = q('#line-chart-threshold-low-color');
            if (lnHi) {
                const c = s.lineThresholdHighColor || '#34d399';
                lnHi.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#34d399';
            }
            if (lnLo) {
                const c = s.lineThresholdLowColor || '#f87171';
                lnLo.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#f87171';
            }

            const labEn = q('#line-chart-labels-enabled');
            if (labEn) labEn.checked = !!s.labels?.enabled;
            const lm = q('#line-chart-label-mode');
            if (lm) {
                const m = s.labels?.mode || 'last_point';
                lm.value = ['none', 'last_point', 'all', 'extremes'].includes(m) ? m : 'last_point';
            }
            const lp = q('#line-chart-label-position');
            if (lp) {
                const p = s.labels?.position || 'auto';
                lp.value = ['above', 'below', 'auto'].includes(p) ? p : 'auto';
            }
            const lf = q('#line-chart-label-format');
            if (lf) {
                const f = s.labels?.format || 'auto';
                lf.value = ['auto', 'number', 'date', 'custom'].includes(f) ? f : 'auto';
            }
            const lct = q('#line-chart-label-custom');
            if (lct) lct.value = s.labels?.customFormat != null ? String(s.labels.customFormat) : '';

            const gEn = q('#line-chart-grid-enabled');
            if (gEn) gEn.checked = s.grid?.enabled !== false;
            const gd = q('#line-chart-grid-density');
            const gdVal = q('#line-chart-grid-density-value');
            if (gd) {
                gd.value = String(Math.min(12, Math.max(2, parseInt(s.grid?.density, 10) || 5)));
                if (gdVal) gdVal.textContent = String(gd.value);
            }
            const go = q('#line-chart-grid-opacity');
            const goVal = q('#line-chart-grid-opacity-value');
            if (go) {
                let o = parseFloat(s.grid?.opacity);
                if (!Number.isFinite(o)) o = 0.14;
                go.value = String(Math.round(o * 100));
                if (goVal) goVal.textContent = o.toFixed(2);
            }
            const gc = q('#line-chart-grid-color');
            if (gc) {
                const c = s.grid?.color || '#00E0FF';
                gc.value = /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#00E0FF';
            }

            const ax = q('#line-chart-axis-x');
            if (ax) ax.checked = s.axis?.x?.enabled !== false;
            const ay = q('#line-chart-axis-y');
            if (ay) ay.checked = s.axis?.y?.enabled !== false;
            const axt = q('#line-chart-axis-x-type');
            if (axt) {
                const t = s.axis?.x?.type || 'auto';
                axt.value = ['auto', 'linear', 'time', 'category'].includes(t) ? t : 'auto';
            }
            const axr = q('#line-chart-axis-x-rotate');
            if (axr) {
                let n = parseInt(s.axis?.x?.rotate, 10);
                if (!Number.isFinite(n)) n = 0;
                axr.value = String([0, 45, -45, 90].includes(n) ? n : 0);
            }

            const arf = q('#line-chart-auto-refetch');
            if (arf) arf.checked = s.auto_refetch_on_pan !== false;

            const tf = s.timeframe || {};
            const tfE = q('#line-chart-tf-enabled');
            if (tfE) tfE.checked = !!tf.enabled;
            const tfAgg = q('#line-chart-tf-agg');
            if (tfAgg) {
                const a = String(tf.aggregation || 'avg').toLowerCase();
                tfAgg.value = ['sum', 'avg', 'min', 'max', 'count'].includes(a) ? a : 'avg';
            }
            const tfBl = q('#line-chart-tf-bar-layout');
            if (tfBl) {
                const l = String(tf.barLayout || 'column').toLowerCase();
                tfBl.value = l === 'row' ? 'row' : 'column';
            }
            const tfBd = q('#line-chart-tf-bar-density');
            if (tfBd) {
                const d = String(tf.barDensity || 'comfortable').toLowerCase();
                tfBd.value = d === 'compact' ? 'compact' : 'comfortable';
            }
            const addPanel = this.panel.querySelector('#line-chart-tf-add-panel');
            if (addPanel) addPanel.classList.remove('line-chart-tf-add-panel--open');
            const tfAddInp = q('#line-chart-tf-add-custom-input');
            if (tfAddInp) tfAddInp.value = '';
            this.renderLineChartTimeframeSlotList(widget);
            const tfAc = q('#line-chart-tf-allow-custom');
            if (tfAc) tfAc.checked = tf.allowCustom !== false;
            const tfAu = q('#line-chart-tf-auto');
            if (tfAu) tfAu.checked = !!tf.autoSuggest;
            const tfSy = q('#line-chart-tf-sync');
            if (tfSy) tfSy.value = tf.syncGroupId != null ? String(tf.syncGroupId) : '';

            const tip = q('#line-chart-tooltip-enabled');
            const tipVal = q('#line-chart-tooltip-show-value');
            if (tip) tip.checked = s.tooltip?.enabled !== false;
            if (tipVal) tipVal.checked = s.tooltip?.showValue !== false;
            if (lineSection) this._syncLineChartPanelAccent(lineSection);
            this.syncLineChartDependentUi();
        }

        if (widget.type === 'filter' && widget.settings) {
            const showCb = this.panel.querySelector('#filter-show-title');
            const titleInp = this.panel.querySelector('#filter-widget-title');
            const titleRow = this.panel.querySelector('#filter-widget-title-row');
            const colorRow = this.panel.querySelector('#filter-title-color-row');
            const show = widget.settings.showTitle !== false;
            if (showCb) showCb.checked = show;
            if (titleInp) {
                const t = widget.settings.title;
                titleInp.value = t != null && String(t).length ? String(t) : 'Фильтры';
            }
            this.writeTitleColorToPanel('filter', widget.settings.titleColor, '#8B5CF6');
            if (titleRow) titleRow.classList.toggle('filter-widget-title-row--hidden', !show);
            if (colorRow) colorRow.classList.toggle('widget-panel-title-sub--hidden', !show);
            if (typeof this._writeFilterStyleToPanel === 'function') {
                this._writeFilterStyleToPanel(widget.settings.filterStyle);
            }
            if (typeof this._writeFilterButtonStyleToPanel === 'function') {
                this._writeFilterButtonStyleToPanel(widget.settings.buttonStyle);
            } else {
                const s =
                    normalizeFilterButtonStyle(widget.settings.buttonStyle) || {
                        ...DEFAULT_FILTER_BUTTON_STYLE,
                    };
                const setVal = (id, value) => {
                    const el = this.panel.querySelector(id);
                    if (!el || value == null) return;
                    el.value = String(value);
                };
                setVal('#filter-btn-bg', s.background);
                setVal('#filter-btn-hover', s.hoverBackground);
                setVal('#filter-btn-open', s.openBackground);
                setVal('#filter-btn-border', s.borderColor);
                setVal('#filter-btn-radius', s.borderRadius);
                setVal('#filter-btn-font-weight', s.fontWeight);
            }
            this.syncFilterAppearancePanel(widget);
        }

        if (widget.type === 'button-widget' && widget.settings) {
            this.loadWidgetTitleSettingsToPanel(widget.settings, 'button-widget', {
                defaultTitle: 'Кнопки',
            });
            const layoutDirection = this.panel.querySelector('#button-widget-layout-direction');
            const layoutWrap = this.panel.querySelector('#button-widget-layout-wrap');
            const interactiveEditor = this.panel.querySelector('#button-widget-interactive-editor');
            const direction = widget.settings?.layout?.direction === 'column' ? 'column' : 'row';
            const wrap = widget.settings?.layout?.wrap !== false;
            if (layoutDirection) layoutDirection.value = direction;
            if (layoutWrap) layoutWrap.checked = wrap;
            if (interactiveEditor) interactiveEditor.checked = widget.settings.interactiveInEditor === true;
            this.syncButtonWidgetSharedStyleFromWidget(widget);
            this.renderButtonWidgetSettingsList(widget);
        }

        // Gauge settings (только для виджетов типа gauge)
        if (widget.type === 'gauge' && widget.settings) {
            const s = normalizeGaugeSettings(widget.settings || {}, { dataSource: widget.dataSource });
            this.loadWidgetTitleSettingsToPanel(s, 'gauge', {
                defaultTitle: 'Датчик',
            });
            const qg = (id) => this.panel.querySelector(id);

            const src = qg('#gauge-value-source');
            if (src) src.value = String(s.valueSource || 'static_value');

            const gStatic = qg('#gauge-static-value');
            if (gStatic) {
                const sv = s.staticValue != null && Number.isFinite(Number(s.staticValue)) ? Number(s.staticValue) : 0;
                gStatic.value = String(sv);
            }

            const gAgg = qg('#gauge-aggregation');
            if (gAgg) gAgg.value = String(s.aggregation || 'sum');
            const gCm = qg('#gauge-count-mode');
            if (gCm) gCm.value = String(s.countMode || 'rows');

            const gFormula = qg('#gauge-value-formula');
            if (gFormula) gFormula.value = s.valueFormula != null ? String(s.valueFormula) : '';

            const gMinF = qg('#gauge-min-formula');
            const gMaxF = qg('#gauge-max-formula');
            if (gMinF) {
                const mf = String(s.minFormula || '').trim();
                gMinF.value = mf || (s.min != null && Number.isFinite(Number(s.min)) ? String(s.min) : '0');
            }
            if (gMaxF) {
                const xf = String(s.maxFormula || '').trim();
                gMaxF.value = xf || (s.max != null && Number.isFinite(Number(s.max)) ? String(s.max) : '100');
            }

            this.renderGaugeTargetsList(Array.isArray(s.targets) ? s.targets : []);
            const gPaint = qg('#gauge-targets-paint-track');
            if (gPaint) gPaint.checked = s.targetsPaintTrack !== false;

            const gShow = qg('#gauge-show-value');
            if (gShow) gShow.checked = s.showValue !== false;

            const gFmt = qg('#gauge-value-format');
            if (gFmt) gFmt.value = String(s.valueFormat || 'percent');
            const gPm = qg('#gauge-value-percent-mode');
            if (gPm) gPm.value = s.valuePercentMode === 'literal' ? 'literal' : 'of_range';
            const gPrec = qg('#gauge-value-precision');
            if (gPrec) gPrec.value = String(s.valuePrecision ?? 0);
            const gPat = qg('#gauge-value-custom-pattern');
            if (gPat) gPat.value = String(s.valueCustomPattern || '{value}');
            const gSuf = qg('#gauge-value-suffix');
            if (gSuf) gSuf.value = s.valueSuffix != null ? String(s.valueSuffix) : '%';

            const gNot = qg('#gauge-value-number-notation');
            if (gNot) {
                const nn = String(s.valueNumberNotation || 'standard').toLowerCase();
                gNot.value = nn === 'compact' ? 'compact' : 'standard';
            }

            const gvtc = qg('#gauge-value-text-color');
            const gvtct = qg('#gauge-value-text-color-text');
            const tyCol = String(widget.styles?.typography?.color || '').trim();
            let effGaugeTxtColor = String(s.textColor ?? '').trim();
            if (!/^#[0-9a-fA-F]{6}$/i.test(effGaugeTxtColor)) {
                effGaugeTxtColor = /^#[0-9a-fA-F]{6}$/i.test(tyCol) ? tyCol : '#ffffff';
            }
            if (gvtc) gvtc.value = effGaugeTxtColor;
            if (gvtct) gvtct.value = effGaugeTxtColor;

            const gFillMode = qg('#gauge-fill-color-mode');
            if (gFillMode) gFillMode.value = String(s.fillColorMode || 'static');

            const ga = qg('#gauge-gradient-a');
            const gat = qg('#gauge-gradient-a-text');
            const gaVal = String(s.gradientColorA || '#00ff80');
            if (ga) ga.value = gaVal;
            if (gat) gat.value = gaVal;
            const gb = qg('#gauge-gradient-b');
            const gbt = qg('#gauge-gradient-b-text');
            const gbVal = String(s.gradientColorB || '#00f0ff');
            if (gb) gb.value = gbVal;
            if (gbt) gbt.value = gbVal;

            const grj = qg('#gauge-range-rules-json');
            if (grj) {
                const rules = Array.isArray(s.rangeColorRules) ? s.rangeColorRules : [];
                grj.value = rules.length ? JSON.stringify(rules, null, 0) : '';
            }

            const gst = qg('#gauge-style-type');
            if (gst) gst.value = String(s.gaugeStyleType || 'arc');

            const gpr = qg('#gauge-progress-bar-radius');
            const gprv = qg('#gauge-progress-bar-radius-value');
            let pcr = parseInt(String(s.progressBarCornerRadius), 10);
            if (!Number.isFinite(pcr)) pcr = 10;
            pcr = Math.min(48, Math.max(0, pcr));
            if (gpr) gpr.value = String(pcr);
            if (gprv) gprv.textContent = `${pcr} px`;

            const gd = qg('#gauge-donut-inner-ratio');
            const gdv = qg('#gauge-donut-inner-ratio-value');
            const dr = Number(s.donutInnerRatio) || 0.62;
            if (gd) gd.value = String(dr);
            if (gdv) gdv.textContent = String(dr);

            const gsw = qg('#gauge-thin-sweep');
            const gswv = qg('#gauge-thin-sweep-value');
            const sw = parseInt(String(s.thinLineSweepDeg), 10) || 300;
            if (gsw) gsw.value = String(sw);
            if (gswv) gswv.textContent = `${sw}°`;

            const gsc = qg('#gauge-segmented-count');
            if (gsc) gsc.value = String(s.segmentedCount ?? 12);
            const gsg = qg('#gauge-segmented-gap');
            if (gsg) gsg.value = String(s.segmentedGapDeg ?? 3);

            const git = qg('#gauge-indicator-type');
            if (git) git.value = String(s.indicatorType || 'dot');
            const gisz = qg('#gauge-indicator-size');
            if (gisz) {
                const iz = s.indicatorSize;
                gisz.value = iz != null && Number.isFinite(Number(iz)) ? String(iz) : '';
            }
            const gic = qg('#gauge-indicator-color');
            const gict = qg('#gauge-indicator-color-text');
            const ic = String(s.indicatorColor || '').trim();
            if (gict) gict.value = ic;
            if (gic && ic && /^#[0-9a-fA-F]{6}$/i.test(ic)) gic.value = ic;

            const gan = qg('#gauge-animation-enabled');
            if (gan) gan.checked = s.animationEnabled !== false;
            const gix = qg('#gauge-interaction-enabled');
            if (gix) gix.checked = s.interactionEnabled === true;

            const grc = qg('#gauge-round-caps');
            if (grc) grc.checked = s.roundCaps !== false;

            const thickness = qg('#gauge-thickness');
            const thicknessValue = qg('#gauge-thickness-value');
            if (thickness && thicknessValue) {
                thickness.value = String(s.thickness || 16);
                thicknessValue.textContent = String(s.thickness || 16) + 'px';
            }

            const dialRot = qg('#gauge-dial-rotation');
            const dialRotLabel = qg('#gauge-dial-rotation-value');
            if (dialRot && dialRotLabel) {
                const drn = typeof s.dialRotation === 'number' && Number.isFinite(s.dialRotation) ? Math.round(s.dialRotation) : 0;
                const clamped = Math.max(-180, Math.min(180, drn));
                dialRot.value = String(clamped);
                dialRotLabel.textContent = `${clamped}°`;
            }

            const fillColor = qg('#gauge-fill-color');
            const fillColorText = qg('#gauge-fill-color-text');
            if (fillColor && fillColorText) {
                const fillColorValue = s.fillColor || '#00ff80';
                fillColor.value = fillColorValue;
                fillColorText.value = fillColorValue;
            }

            const trackColor = qg('#gauge-track-color');
            const trackColorText = qg('#gauge-track-color-text');
            if (trackColor && trackColorText) {
                const trackColorValue = s.gaugeColor || '#ffffff';
                trackColor.value = trackColorValue;
                trackColorText.value = trackColorValue;
            }

            const neonEnabled = qg('#gauge-neon-enabled');
            const neonControls = qg('#gauge-neon-controls');
            if (neonEnabled) {
                const neonEnabledValue = s.neonEnabled !== undefined ? s.neonEnabled : true;
                neonEnabled.checked = neonEnabledValue;
                if (neonControls) {
                    neonControls.style.display = neonEnabledValue ? 'block' : 'none';
                }
            }

            const neonColor = qg('#gauge-neon-color');
            const neonColorText = qg('#gauge-neon-color-text');
            if (neonColor && neonColorText) {
                const neonColorValue = s.neonColor || '#78ff82';
                neonColor.value = neonColorValue;
                neonColorText.value = neonColorValue;
            }

            this.syncGaugePanelDependentUi();
            this.updateTypographyPreview();
        }

        if (widget.type === 'text' && widget.settings) {
            const modeSel = this.panel.querySelector('#text-widget-mode');
            if (modeSel) {
                modeSel.value = widget.settings.mode === 'dynamic' ? 'dynamic' : 'static';
            }
            const staticTa = this.panel.querySelector('#text-widget-static-text');
            if (staticTa) {
                staticTa.value = widget.settings.text != null ? String(widget.settings.text) : '';
            }
            const tplTa = this.panel.querySelector('#text-widget-template');
            if (tplTa) {
                tplTa.value = widget.settings.template != null ? String(widget.settings.template) : '';
            }
            const tsDisp = this.panel.querySelector('#text-widget-timestamp-display');
            if (tsDisp) {
                tsDisp.value = widget.settings.timestampDisplay === 'utc' ? 'utc' : 'local';
            }
            const bgF = this.panel.querySelector('#text-widget-bg-formula');
            if (bgF) bgF.value = widget.settings.blockBackgroundFormula != null ? String(widget.settings.blockBackgroundFormula) : '';
            const fgF = this.panel.querySelector('#text-widget-fg-formula');
            if (fgF) fgF.value = widget.settings.textColorFormula != null ? String(widget.settings.textColorFormula) : '';
            const visF = this.panel.querySelector('#text-widget-vis-formula');
            if (visF) visF.value = widget.settings.visibilityFormula != null ? String(widget.settings.visibilityFormula) : '';
            this.syncTextWidgetModeUi();
        }

        if (widget.type === 'html') {
            this.syncHtmlPanelFromWidget(widget);
        }

        // Color formulas (all pickers + known style keys)
        this.ensureColorFormulaFields();
        const cf = widget.settings?.colorFormulas && typeof widget.settings.colorFormulas === 'object'
            ? { ...widget.settings.colorFormulas }
            : {};
        const app = styles.appearance || {};
        if (app.backgroundColorFormula) cf['style-bg-color-formula'] = app.backgroundColorFormula;
        if (app.glassColorFormula) cf['style-glass-color-formula'] = app.glassColorFormula;
        if (app.gradient?.color1Formula) cf['style-gradient-color1-formula'] = app.gradient.color1Formula;
        if (app.gradient?.color2Formula) cf['style-gradient-color2-formula'] = app.gradient.color2Formula;
        const typo = styles.typography || {};
        if (typo.colorFormula) {
            cf['style-text-color-formula'] = typo.colorFormula;
            cf['gauge-value-text-color-formula'] = typo.colorFormula;
        }
        if (borders.colorFormula) cf['style-border-color-formula'] = borders.colorFormula;
        if (borders.neonGlow?.colorFormula) cf['style-neon-color-formula'] = borders.neonGlow.colorFormula;
        if (widget.settings?.titleColorFormula) {
            const prefixes = [
                widget.type,
                'kpi',
                'filter',
                'table',
                'pie-chart',
                'bar-chart',
                'line-chart',
                'gauge',
                'button-widget',
                'data-input',
                'container',
            ];
            prefixes.forEach((p) => {
                cf[`${p}-title-color-formula`] = widget.settings.titleColorFormula;
            });
        }
        // Known widget settings mirrors
        const s = widget.settings || {};
        if (s.backgroundColorFormula) cf['kpi-bg-solid-color-formula'] = s.backgroundColorFormula;
        if (s.kpiBackgroundDefaultColorFormula) cf['kpi-bg-default-color-formula'] = s.kpiBackgroundDefaultColorFormula;
        if (s.kpiBackgroundDeltaNegativeColorFormula) cf['kpi-bg-delta-neg-formula'] = s.kpiBackgroundDeltaNegativeColorFormula;
        if (s.kpiBackgroundDeltaPositiveColorFormula) cf['kpi-bg-delta-pos-formula'] = s.kpiBackgroundDeltaPositiveColorFormula;
        if (s.deltaColorFormula) cf['kpi-delta-color-formula'] = s.deltaColorFormula;
        if (s.textColorFormula) cf['gauge-value-text-color-formula'] = s.textColorFormula;
        if (s.fillColorFormula) cf['gauge-fill-color-formula'] = s.fillColorFormula;
        if (s.gaugeColorFormula) cf['gauge-track-color-formula'] = s.gaugeColorFormula;
        if (s.neonColorFormula) cf['gauge-neon-color-formula'] = s.neonColorFormula;
        if (s.columnHeaderBackgroundColorFormula) cf['table-column-header-bg-color-formula'] = s.columnHeaderBackgroundColorFormula;
        if (s.buttonStyle?.backgroundFormula) cf['filter-btn-bg-formula'] = s.buttonStyle.backgroundFormula;
        if (s.buttonStyle?.hoverBackgroundFormula) cf['filter-btn-hover-formula'] = s.buttonStyle.hoverBackgroundFormula;
        if (s.buttonStyle?.openBackgroundFormula) cf['filter-btn-open-formula'] = s.buttonStyle.openBackgroundFormula;
        if (s.buttonStyle?.borderColorFormula) cf['filter-btn-border-formula'] = s.buttonStyle.borderColorFormula;
        if (s.pieSolidColorFormula) cf['pie-chart-solid-color-formula'] = s.pieSolidColorFormula;
        if (s.barSolidColorFormula) cf['bar-chart-solid-color-formula'] = s.barSolidColorFormula;
        if (s.pointColorFormula) cf['line-chart-point-color-formula'] = s.pointColorFormula;
        if (s.gridColorFormula) cf['line-chart-grid-color-formula'] = s.gridColorFormula;
        if (s.refColorFormula) cf['line-chart-ref-color-formula'] = s.refColorFormula;
        if (s.defaultButtonStyle?.backgroundFormula) cf['button-widget-shared-bg-formula'] = s.defaultButtonStyle.backgroundFormula;
        if (s.defaultButtonStyle?.colorFormula) cf['button-widget-shared-color-formula'] = s.defaultButtonStyle.colorFormula;
        if (s.defaultButtonStyle?.hoverBackgroundFormula) cf['button-widget-shared-hover-formula'] = s.defaultButtonStyle.hoverBackgroundFormula;
        if (s.defaultButtonStyle?.activeBackgroundFormula) cf['button-widget-shared-active-formula'] = s.defaultButtonStyle.activeBackgroundFormula;
        if (s.defaultButtonStyle?.borderColorFormula) cf['button-widget-shared-border-formula'] = s.defaultButtonStyle.borderColorFormula;
        (Array.isArray(s.buttons) ? s.buttons : []).forEach((btn, i) => {
            const st = btn?.style && typeof btn.style === 'object' ? btn.style : {};
            this._buttonStyleColorFormulaSpecs(i).forEach(({ id, formulaKey }) => {
                if (st[formulaKey]) cf[`${id}-formula`] = st[formulaKey];
            });
        });
        this.loadPanelColorFormulas(cf);

        if (typeof widget.resolveStyleColorFormulas === 'function') {
            void widget.resolveStyleColorFormulas(this.engine).then(() => {
                widget.applyStyles?.();
                widget.update?.();
            });
        }
        } finally {
            this._loadingWidgetStylesDepth = Math.max(
                0,
                (typeof this._loadingWidgetStylesDepth === 'number' ? this._loadingWidgetStylesDepth : 1) - 1,
            );
            this._isLoadingWidgetStyles = this._loadingWidgetStylesDepth > 0;
        }
    }

    updateWidget() {
        // Avoid wiping styles (e.g. shadows) while hydrating the panel from widget state.
        if (this._isLoadingWidgetStyles || this._loadingWidgetStylesDepth > 0) return;

        let widget = this.resolveLiveWidget(this.currentWidget);
        // Panel can briefly lose currentWidget after deselect/remap — recover from selection.
        if (!widget && this.engine?.widgetManager?.getSelectedWidgets) {
            const selected = this.engine.widgetManager.getSelectedWidgets();
            if (selected?.length === 1) {
                widget = selected[0];
            }
        }
        this.currentWidget = widget;
        if (!this.currentWidget) return;

        const styles = {};

        // Layout - обновляем позицию и размер только если они были изменены пользователем вручную
        // или если значения в полях отличаются от текущей позиции виджета
        const xInput = this.panel.querySelector('#style-x');
        const yInput = this.panel.querySelector('#style-y');
        const wInput = this.panel.querySelector('#style-w');
        const hInput = this.panel.querySelector('#style-h');
        
        // Используем значения из полей ввода, если они есть, иначе текущую позицию виджета
        const x = xInput ? (parseInt(xInput.value) || this.currentWidget.x) : this.currentWidget.x;
        const y = yInput ? (parseInt(yInput.value) || this.currentWidget.y) : this.currentWidget.y;
        const w = wInput ? (parseInt(wInput.value) || this.currentWidget.width) : this.currentWidget.width;
        const h = hInput ? (parseInt(hInput.value) || this.currentWidget.height) : this.currentWidget.height;
        
        // Обновляем позицию только если:
        // 1. Поля не обновляются автоматически (не через updatePositionFields)
        // 2. И значения действительно отличаются от текущей позиции
        // Это предотвращает сброс позиции при изменении только стилей
        // Получаем widgetManager для проверки границ
        const widgetManager = this.engine?.widgetManager;
        
        if (!this._isUpdatingPositionFields) {
            const xChanged = Math.abs(x - this.currentWidget.x) > 0.1;
            const yChanged = Math.abs(y - this.currentWidget.y) > 0.1;
            if (xChanged || yChanged) {
                this.currentWidget.setPosition(x, y, widgetManager);
            }
        }
        
        if (!this._isUpdatingSizeFields) {
            const wChanged = Math.abs(w - this.currentWidget.width) > 0.1;
            const hChanged = Math.abs(h - this.currentWidget.height) > 0.1;
            if (wChanged || hChanged) {
                this.currentWidget.setSize(w, h, widgetManager);
            }
        }

        const exportProfileToggle = this.panel.querySelector('#style-allow-export-profile');
        if (exportProfileToggle && this.currentWidget.type !== 'filter') {
            if (!this.currentWidget.settings || typeof this.currentWidget.settings !== 'object') {
                this.currentWidget.settings = {};
            }
            this.currentWidget.settings.allowExportToProfile = !!exportProfileToggle.checked;
            if (typeof this.currentWidget.syncProfilePinButton === 'function') {
                this.currentWidget.syncProfilePinButton();
            }
        }

        // Сохраняем выравнивание, если оно было установлено
        const horizontalAlign = ['left', 'center', 'right'].find(align => 
            this.panel.querySelector(`[data-align="${align}"]`)?.classList.contains('active')
        );
        const verticalAlign = ['top', 'middle', 'bottom'].find(align => 
            this.panel.querySelector(`[data-align="${align}"]`)?.classList.contains('active')
        );
        
        if (horizontalAlign || verticalAlign) {
            if (!styles.layout) {
                styles.layout = {};
            }
            styles.layout.alignment = {
                horizontal: horizontalAlign || 'center',
                vertical: verticalAlign || 'middle'
            };
        }

        // Appearance
        const bgType = this.panel.querySelector('#style-bg-type')?.value || '';
        const opacityRaw = parseFloat(this.panel.querySelector('#style-opacity')?.value);
        styles.appearance = {
            variant: this.panel.querySelector('#style-variant')?.value || 'glass',
            density: this.panel.querySelector('#style-density')?.value || 'normal',
            backgroundType: bgType,
            backgroundColor: this.panel.querySelector('#style-bg-color')?.value || '#1a1d22',
            backgroundColorFormula: this.readColorFormulaFromPanel('style-bg-color-formula'),
            opacity: Number.isFinite(opacityRaw) ? Math.min(1, Math.max(0, opacityRaw)) : 1,
            blendMode: this.panel.querySelector('#style-blend-mode')?.value || 'normal'
        };
        
        // Gradient
        if (bgType === 'gradient') {
            styles.appearance.gradient = this.collectGradientFromPanel();
            if (styles.appearance.gradient && typeof styles.appearance.gradient === 'object') {
                styles.appearance.gradient.color1Formula = this.readColorFormulaFromPanel(
                    'style-gradient-color1-formula',
                );
                styles.appearance.gradient.color2Formula = this.readColorFormulaFromPanel(
                    'style-gradient-color2-formula',
                );
            }
            this.currentGradient = styles.appearance.gradient;
        }
        
        // Glass mode
        if (bgType === 'glass') {
            const blurRaw = parseInt(this.panel.querySelector('#style-glass-blur')?.value, 10);
            const glassOpacityRaw = parseFloat(this.panel.querySelector('#style-glass-opacity')?.value);
            styles.appearance.glassColor = this.panel.querySelector('#style-glass-color')?.value || '#ffffff';
            styles.appearance.glassColorFormula = this.readColorFormulaFromPanel('style-glass-color-formula');
            styles.appearance.glassBlur = Number.isFinite(blurRaw) ? blurRaw : 8;
            styles.appearance.glassOpacity = Number.isFinite(glassOpacityRaw) ? glassOpacityRaw : 0.1;
        }

        // Typography
        const panelTextColorGlobal = this.panel.querySelector('#style-text-color')?.value || '#000000';
        const gaugeTcTxt = this.panel.querySelector('#gauge-value-text-color-text');
        const gaugeTcPick = this.panel.querySelector('#gauge-value-text-color');
        let typographyColor = panelTextColorGlobal;
        if (this.currentWidget.type === 'gauge') {
            const raw = (gaugeTcTxt?.value || '').trim();
            typographyColor =
                /^#[0-9a-fA-F]{6}$/i.test(raw)
                    ? raw
                    : /^#[0-9a-fA-F]{6}$/i.test(gaugeTcPick?.value || '')
                      ? gaugeTcPick.value
                      : '#ffffff';
        }

        styles.typography = {
            fontFamily: this.panel.querySelector('#style-font-family')?.value || 'Inter',
            fontWeight: this.panel.querySelector('#style-font-weight')?.value || '400',
            fontSize: parseInt(this.panel.querySelector('#style-font-size')?.value) || 16,
            letterSpacing: parseFloat(this.panel.querySelector('#style-letter-spacing')?.value) || 0,
            lineHeight: parseFloat(this.panel.querySelector('#style-line-height')?.value) || 1.5,
            color: typographyColor,
            colorFormula: this.readColorFormulaFromPanel(
                this.currentWidget.type === 'gauge'
                    ? 'gauge-value-text-color-formula'
                    : 'style-text-color-formula',
            ),
            textShadow: this.panel.querySelector('#style-text-shadow')?.value || ''
        };

        // Borders
        styles.borders = {
            width: parseInt(this.panel.querySelector('#style-border-width')?.value) || 0,
            style: this.panel.querySelector('#style-border-style')?.value || 'solid',
            color: this.panel.querySelector('#style-border-color')?.value || '#00E0FF',
            colorFormula: this.readColorFormulaFromPanel('style-border-color-formula'),
            radius: parseInt(this.panel.querySelector('#style-border-radius')?.value) || 0,
            neonGlow: {
                enabled: this.panel.querySelector('#style-neon-glow-enabled')?.checked || false,
                intensity: parseInt(this.panel.querySelector('#style-neon-intensity')?.value) || 12,
                spread: parseInt(this.panel.querySelector('#style-neon-spread')?.value) || 0,
                color: this.panel.querySelector('#style-neon-color')?.value || '#00E0FF',
                colorFormula: this.readColorFormulaFromPanel('style-neon-color-formula'),
            }
        };

        // Shadows
        const shadowLayers = this.panel.querySelectorAll('.shadow-layer');
        styles.shadows = Array.from(shadowLayers).map((layer, idx) => {
            const colorInput = layer.querySelector('.shadow-color');
            const colorId = colorInput?.id || '';
            const formulaId = colorId ? `${colorId}-formula` : `shadow-color-${idx}-formula`;
            return {
                enabled: true,
                x: parseInt(layer.querySelector('.shadow-x')?.value) || 0,
                y: parseInt(layer.querySelector('.shadow-y')?.value) || 0,
                blur: parseInt(layer.querySelector('.shadow-blur')?.value) || 0,
                spread: parseInt(layer.querySelector('.shadow-spread')?.value) || 0,
                color: colorInput?.value || '#000000',
                colorFormula: this.readColorFormulaFromPanel(formulaId),
            };
        });

        // Animations
        const animEnabled = this.panel.querySelector('#style-animation-enabled')?.checked || false;
        styles.animations = {
            enabled: animEnabled,
            type: this.panel.querySelector('#style-animation-type')?.value || 'fade',
            duration: parseFloat(this.panel.querySelector('#style-animation-duration')?.value) || 1,
            easing: this.panel.querySelector('#style-animation-easing')?.value || 'ease',
            delay: parseFloat(this.panel.querySelector('#style-animation-delay')?.value) || 0,
            loop: this.panel.querySelector('#style-animation-loop')?.checked || false
        };

        // Advanced CSS
        styles.advancedCSS = {
            custom: this.panel.querySelector('#style-custom-css')?.value || ''
        };

        // Apply styles
        this.currentWidget.setStyles(styles);

        // Persist all color formulas (panel ids) + mirror titleColorFormula
        if (!this.currentWidget.settings) this.currentWidget.settings = {};
        const allFormulas = this.collectPanelColorFormulas();
        this.currentWidget.settings.colorFormulas = allFormulas;
        const titleFxId = `${this.currentWidget.type}-title-color-formula`;
        // kpi / filter / table use different prefixes sometimes
        const titleCandidates = [
            titleFxId,
            'kpi-title-color-formula',
            'filter-title-color-formula',
            'table-title-color-formula',
            'pie-chart-title-color-formula',
            'bar-chart-title-color-formula',
            'line-chart-title-color-formula',
            'gauge-title-color-formula',
            'button-widget-title-color-formula',
            'data-input-title-color-formula',
            'container-title-color-formula',
        ];
        for (const id of titleCandidates) {
            if (Object.prototype.hasOwnProperty.call(allFormulas, id) || this.panel.querySelector(`#${CSS.escape(id)}`)) {
                this.currentWidget.settings.titleColorFormula = this.readColorFormulaFromPanel(id);
                break;
            }
        }

        // Mirror common widget color formulas onto settings keys
        this._mirrorWidgetColorFormulasFromPanel(this.currentWidget, allFormulas);

        if (typeof this.currentWidget.resolveAllColorFormulas === 'function') {
            void this.currentWidget.resolveAllColorFormulas(this.engine).then(() => {
                this.currentWidget.update?.({ skipColorResolve: true });
            });
        } else if (typeof this.currentWidget.resolveStyleColorFormulas === 'function') {
            void this.currentWidget.resolveStyleColorFormulas(this.engine).then(() => {
                this.currentWidget.update?.({ skipColorResolve: true });
            });
        }

        if (this.currentWidget.type === 'button-widget' && !this._isLoadingWidgetStyles) {
            const typo = styles.typography || {};
            const prev = this.currentWidget.settings?.defaultButtonStyle || {};
            this.currentWidget.settings.defaultButtonStyle = normalizeButtonStylePartial({
                ...prev,
                color: typo.color || prev.color,
                fontSize: typo.fontSize ?? prev.fontSize,
                fontWeight: typo.fontWeight ?? prev.fontWeight,
                fontFamily: typo.fontFamily || prev.fontFamily,
            });
            this.syncButtonWidgetSharedStyleFromWidget(this.currentWidget);
            this.currentWidget.update();
        }

        if (this.currentWidget.type === 'pie-chart' && !this._isLoadingWidgetStyles) {
            this.applyPieChartPanelSettings();
        }
    }

    /**
     * Зеркалирует известные panel formula ids → settings.*Formula.
     * @param {*} w
     * @param {Record<string, string>} formulas
     */
    _mirrorWidgetColorFormulasFromPanel(w, formulas) {
        if (!w?.settings) return;
        const g = (id) => String(formulas?.[id] || this.readColorFormulaFromPanel(id) || '');
        const s = w.settings;
        if (w.type === 'kpi') {
            s.backgroundColorFormula = g('kpi-bg-solid-color-formula');
            s.kpiBackgroundDefaultColorFormula = g('kpi-bg-default-color-formula');
            s.kpiBackgroundDeltaNegativeColorFormula = g('kpi-bg-delta-neg-formula');
            s.kpiBackgroundDeltaPositiveColorFormula = g('kpi-bg-delta-pos-formula');
            s.deltaColorFormula = g('kpi-delta-color-formula') || s.deltaColorFormula || '';
            s.titleColorFormula = g('kpi-title-color-formula') || s.titleColorFormula || '';
        }
        if (w.type === 'gauge') {
            s.textColorFormula = g('gauge-value-text-color-formula');
            s.fillColorFormula = g('gauge-fill-color-formula');
            s.gaugeColorFormula = g('gauge-track-color-formula');
            s.neonColorFormula = g('gauge-neon-color-formula');
            s.indicatorColorFormula = g('gauge-indicator-color-formula') || s.indicatorColorFormula || '';
            s.gradientColorAFormula = g('gauge-gradient-a-formula') || s.gradientColorAFormula || '';
            s.gradientColorBFormula = g('gauge-gradient-b-formula') || s.gradientColorBFormula || '';
            s.titleColorFormula = g('gauge-title-color-formula') || s.titleColorFormula || '';
        }
        if (w.type === 'table') {
            s.columnHeaderBackgroundColorFormula = g('table-column-header-bg-color-formula');
            s.titleColorFormula = g('table-title-color-formula') || s.titleColorFormula || '';
        }
        if (w.type === 'filter' && s.buttonStyle && typeof s.buttonStyle === 'object') {
            s.buttonStyle.backgroundFormula = g('filter-btn-bg-formula');
            s.buttonStyle.hoverBackgroundFormula = g('filter-btn-hover-formula');
            s.buttonStyle.openBackgroundFormula = g('filter-btn-open-formula');
            s.buttonStyle.borderColorFormula = g('filter-btn-border-formula');
            s.titleColorFormula = g('filter-title-color-formula') || s.titleColorFormula || '';
        }
        if (w.type === 'pie-chart') {
            s.pieSolidColorFormula = g('pie-chart-solid-color-formula');
            s.pieSliceAboveColorFormula = g('pie-chart-slice-above-color-formula');
            s.pieSliceBelowColorFormula = g('pie-chart-slice-below-color-formula');
            s.titleColorFormula = g('pie-chart-title-color-formula') || s.titleColorFormula || '';
            const pieFx = this.collectPiePaletteFormulasFromPanel();
            if (pieFx.length) s.paletteFormulas = pieFx;
        }
        if (w.type === 'bar-chart') {
            s.barSolidColorFormula = g('bar-chart-solid-color-formula');
            s.barThresholdHighColorFormula = g('bar-chart-threshold-high-color-formula');
            s.barThresholdLowColorFormula = g('bar-chart-threshold-low-color-formula');
            s.titleColorFormula = g('bar-chart-title-color-formula') || s.titleColorFormula || '';
            const barFx = this.collectBarPaletteFormulasFromPanel();
            if (barFx.length) s.barPaletteFormulas = barFx;
        }
        if (w.type === 'line-chart') {
            s.pointColorFormula = g('line-chart-point-color-formula');
            s.gridColorFormula = g('line-chart-grid-color-formula');
            s.refColorFormula = g('line-chart-ref-color-formula');
            s.lineThresholdHighColorFormula = g('line-chart-threshold-high-color-formula');
            s.lineThresholdLowColorFormula = g('line-chart-threshold-low-color-formula');
            s.titleColorFormula = g('line-chart-title-color-formula') || s.titleColorFormula || '';
            if (Array.isArray(s.bindingMeasures)) {
                s.bindingMeasures = s.bindingMeasures.map((m, i) => ({
                    ...m,
                    colorFormula: g(`line-series-${i}-color-formula`) || m.colorFormula || '',
                }));
            }
        }
        if (w.type === 'button-widget') {
            if (!s.defaultButtonStyle || typeof s.defaultButtonStyle !== 'object') s.defaultButtonStyle = {};
            s.defaultButtonStyle = normalizeButtonStylePartial({
                ...s.defaultButtonStyle,
                ...this._readButtonStyleFormulasFromPanel(null),
            });
            if (Array.isArray(s.buttons)) {
                s.buttons.forEach((btn, i) => {
                    if (!btn || typeof btn !== 'object') return;
                    const style = { ...(btn.style && typeof btn.style === 'object' ? btn.style : {}), ...this._readButtonStyleFormulasFromPanel(i) };
                    btn.style = normalizeButtonStylePartial(style);
                });
            }
            s.titleColorFormula = g('button-widget-title-color-formula') || s.titleColorFormula || '';
        }
    }
}

