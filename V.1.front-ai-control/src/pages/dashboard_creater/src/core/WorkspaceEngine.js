import { ViewportController } from './ViewportController.js';
import { WidgetManager } from './WidgetManager.js';
import { HistoryManager } from './HistoryManager.js';
import { Serializer } from './Serializer.js';
import { eventBus } from './EventBus.js';
import { DashboardFilterStore } from '../../../../services/dashboardFilterStore.js';
import { forgetDashboardDataModelClient } from '../../../../services/dashboardDataModel/DashboardDataModelClient.js';
import { defineWidget } from '../sdk/defineWidget.js';
import { createWidgetContext } from '../sdk/WidgetContext.js';

/** Префикс текста в системном буфере для вставки виджетов (Ctrl+V). */
export const WIDGET_CLIPBOARD_PREFIX = '__AIC_WIDGET_CLIPBOARD_V1__:';

function isDomTextInputTarget(target) {
    if (!target || !(target instanceof Element)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.closest('[contenteditable="true"]')) return true;
    return target.closest('input, textarea, select') != null;
}

function isScalarModelVariableType(type) {
    const t = String(type || '').trim().toLowerCase();
    if (!t) return true;
    return t !== 'table' && t !== 'lazytable';
}

/**
 * WorkspaceEngine - Главный движок рабочего пространства.
 * Фильтры: `filterStore` синхронизируется с виджетами «Фильтр»; `collectDashboardFilters` читает через store.
 * Запросы к SQLite-модели: `runDashboardModelQuery` (см. services/dashboardQueryCoordinator.js).
 */
export class WorkspaceEngine {
    constructor(viewportElement, workspaceElement) {
        this.viewport = viewportElement;
        this.workspace = workspaceElement;
        
        // Инициализация компонентов
        this.viewportController = new ViewportController(this.viewport, this.workspace);
        this.widgetManager = new WidgetManager(this.workspace, this.viewportController, this);
        this.historyManager = new HistoryManager(this); // Передаем engine для сохранения состояния
        this.serializer = Serializer;
        /** Последняя копия виджетов (Ctrl+C); дублирует буфер, если readText недоступен). */
        this.clipboardWidgetPayload = null;
        /** Единый снимок полей фильтра (синхронизируется с виджетами «Фильтр»). */
        this.filterStore = new DashboardFilterStore();
        /** Runtime параметры дашборда (set_param / navigate payload). */
        this.runtimeParams = new Map();
        /** Defaults скаляров из _datacode_variables (compile). */
        this.modelVariableDefaults = new Map();
        /** Локальные overrides пользователя (не пишутся в модель/дашборд). */
        this.modelVariableOverrides = new Map();
        /** Метаданные каталога: name → { type, modelId }. */
        this.modelVariableMeta = new Map();
        /**
         * Переменные дашборда из layout_config (БД).
         * name → { type, value, description }
         */
        this.dashboardVariables = new Map();
        this.sheetId = null;
        this.dashboardId = null;
        /** Точка возврата камеры (workspace coords); из sheet.layout_config.viewport */
        this.viewportHome = { x: 0, y: 0, zoom: null };
        /** Режим «поставить метку Home» (один клик) */
        this.__placingHomeMark = false;
        /** Сняты ли document-слушатели (после destroy paste/keydown не должны срабатывать) */
        this._destroyed = false;
        this._onDocumentKeyDown = null;
        this._onDocumentPaste = null;
        this._lastPasteSig = null;
        this._lastPasteAt = 0;
        
        // Режим работы
        this.mode = 'editor'; // 'editor' | 'viewer'
        /** Touch/stylus layout and long-press drag; host updates from matchMedia. */
        this.coarsePointer = false;
        
        // Регистр классов виджетов
        this.widgetClasses = {};
        /** @type {Map<string, import('../sdk/defineWidget.js').WidgetDefinition>} */
        this.widgetDefinitions = new Map();
        /** Host-injected adapters for WidgetContext (data / navigation / ui). */
        this._widgetAdapters = {};

        /** Отмена HTTP/SQLite при уходе со страницы (`destroy()`). */
        this._abortController = new AbortController();
        
        this.init();
        
        // Инициализируем отображение сетки в зависимости от режима
        this.setMode(this.mode);
    }

    init() {
        // История теперь сохраняется автоматически через HistoryManager.setupEventListeners()
        // Не нужно дублировать сохранение здесь, чтобы избежать конфликтов
        
        // Обработка клавиатурных сокращений
        this.setupKeyboardShortcuts();
    }

    /**
     * Настройка клавиатурных сокращений
     */
    setupKeyboardShortcuts() {
        this._onDocumentKeyDown = (e) => {
            if (this._destroyed) return;
            // Undo/Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }

            // Копирование / вставка виджетов (полная сериализация; для контейнера — с дочерними)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                if (this.mode === 'editor' && !isDomTextInputTarget(e.target)) {
                    const selected = this.widgetManager.getSelectedWidgets();
                    if (selected.length > 0) {
                        e.preventDefault();
                        this.copySelectedWidgetsToClipboard(selected[0]);
                    }
                }
            }

            // Удаление выделенных виджетов (через шину — один обработчик в WidgetManager)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (isDomTextInputTarget(e.target)) return;
                if (this.mode !== 'editor') return;
                const selected = this.widgetManager.getSelectedWidgets();
                if (selected.length > 0) {
                    e.preventDefault();
                    selected.forEach((widget) => {
                        eventBus.emit('widget:delete', { id: widget.id });
                    });
                }
            }
        };

        this._onDocumentPaste = (e) => {
            if (this._destroyed) return;
            if (this.mode !== 'editor') return;
            if (isDomTextInputTarget(e.target)) return;
            const text = e.clipboardData?.getData('text/plain') || '';
            if (!text.startsWith(WIDGET_CLIPBOARD_PREFIX)) return;
            e.preventDefault();
            let payload;
            try {
                payload = JSON.parse(text.slice(WIDGET_CLIPBOARD_PREFIX.length));
            } catch {
                return;
            }
            this.applyPastedWidgetClipboardPayload(payload);
        };

        document.addEventListener('keydown', this._onDocumentKeyDown);
        document.addEventListener('paste', this._onDocumentPaste);
    }

    /**
     * Ctrl+C: положить в буфер обмена JSON выбранного виджета (и вложенных, если это шкаф).
     * @param {import('./WidgetBase.js').WidgetBase} widget
     */
    copySelectedWidgetsToClipboard(widget) {
        const payload = this.widgetManager.buildClipboardPayload(widget);
        this.clipboardWidgetPayload = payload;
        const text = `${WIDGET_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;
        if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(text).catch(() => {});
        }
    }

    /**
     * Вставка из буфера (событие paste): новые id, сдвиг корневых виджетов на шаг сетки.
     * @param {{ widgets?: object[] }} payload
     */
    applyPastedWidgetClipboardPayload(payload) {
        if (this._destroyed) return;
        if (!payload?.widgets?.length || !Array.isArray(payload.widgets)) {
            return;
        }
        // Защита от двойного paste (зомби-слушатели / повтор события в одном тике).
        const sig = `${payload.widgets.length}:${payload.widgets.map((w) => w?.id).join(',')}`;
        const now = Date.now();
        if (this._lastPasteSig === sig && now - (this._lastPasteAt || 0) < 400) {
            return;
        }
        this._lastPasteSig = sig;
        this._lastPasteAt = now;

        const grid = this.widgetManager.gridSize || 20;
        const remapped = WidgetManager.remapClipboardWidgetsForPaste(payload.widgets, grid);
        const hm = this.historyManager;
        hm?.disable();
        let roots = [];
        try {
            roots = this.widgetManager.appendWidgetsFromJsonArray(remapped, this.widgetClasses);
            if (roots.length > 0) {
                this.widgetManager.deselectAll();
                this.widgetManager.selectWidget(roots[0].id);
            }
        } finally {
            hm?.enable();
            hm?.saveCurrentState();
        }

        const primary = roots[0];
        if (primary) {
            eventBus.emit('widget:added', { widget: primary });
        }
    }

    /**
     * Регистрация класса виджета (legacy). Prefer `register(definition)`.
     * @param {string} type - Тип виджета
     * @param {Class} WidgetClass - Класс виджета
     */
    registerWidget(type, WidgetClass) {
        this.widgetClasses[type] = WidgetClass;
        if (!this.widgetDefinitions.has(type)) {
            this.widgetDefinitions.set(
                type,
                defineWidget({
                    type,
                    displayName: type,
                    WidgetClass,
                }),
            );
        } else {
            const prev = this.widgetDefinitions.get(type);
            this.widgetDefinitions.set(type, { ...prev, WidgetClass });
        }
    }

    /**
     * Register a full widget definition (class + metadata + settings panel).
     * @param {import('../sdk/defineWidget.js').WidgetDefinition} definition
     */
    register(definition) {
        const def = defineWidget(definition);
        this.widgetClasses[def.type] = def.WidgetClass;
        this.widgetDefinitions.set(def.type, def);
        for (const alias of def.aliases || []) {
            if (!alias || alias === def.type) continue;
            this.widgetClasses[alias] = def.WidgetClass;
            // Keep canonical `type` on the definition; key is the alias for lookup.
            this.widgetDefinitions.set(alias, { ...def, hideFromPalette: true });
        }
        return def;
    }

    /**
     * @param {string} type
     * @returns {import('../sdk/defineWidget.js').WidgetDefinition|null}
     */
    getWidgetDefinition(type) {
        if (!type) return null;
        return this.widgetDefinitions.get(type) || null;
    }

    /**
     * Unique primary definitions (alias keys omitted).
     * @returns {import('../sdk/defineWidget.js').WidgetDefinition[]}
     */
    getWidgetDefinitions() {
        /** @type {import('../sdk/defineWidget.js').WidgetDefinition[]} */
        const out = [];
        const seen = new Set();
        for (const [key, def] of this.widgetDefinitions.entries()) {
            if (!def?.type) continue;
            if (key !== def.type) continue;
            if (seen.has(def.type)) continue;
            seen.add(def.type);
            out.push(def);
        }
        return out;
    }

    /**
     * @param {import('../sdk/WidgetContext.js').WidgetAdapters} adapters
     */
    setWidgetAdapters(adapters = {}) {
        this._widgetAdapters = {
            data: { ...(this._widgetAdapters.data || {}), ...(adapters.data || {}) },
            navigation: { ...(this._widgetAdapters.navigation || {}), ...(adapters.navigation || {}) },
            ui: { ...(this._widgetAdapters.ui || {}), ...(adapters.ui || {}) },
        };
    }

    /**
     * @returns {import('../sdk/WidgetContext.js').WidgetContext}
     */
    getWidgetContext() {
        return createWidgetContext(this, this._widgetAdapters);
    }

    /**
     * Добавление виджета
     * @param {string} type - Тип виджета
     * @param {Object} config - Конфигурация виджета
     * @returns {WidgetBase} Экземпляр виджета
     */
    addWidget(type, config = {}) {
        const WidgetClass = this.widgetClasses[type];
        if (!WidgetClass) {
            console.error(`Widget type "${type}" is not registered. Available types:`, Object.keys(this.widgetClasses));
            throw new Error(`Widget type "${type}" is not registered. Available types: ${Object.keys(this.widgetClasses).join(', ')}`);
        }

        const def = this.getWidgetDefinition(type);
        const size = def?.defaultSize || {};
        const widget = new WidgetClass({
            width: size.width,
            height: size.height,
            settings: typeof def?.defaultSettings === 'function' ? def.defaultSettings() : {},
            styles: typeof def?.defaultStyles === 'function' ? def.defaultStyles() : {},
            ...config,
            settings: {
                ...(typeof def?.defaultSettings === 'function' ? def.defaultSettings() : {}),
                ...(config.settings || {}),
            },
            styles: {
                ...(typeof def?.defaultStyles === 'function' ? def.defaultStyles() : {}),
                ...(config.styles || {}),
            },
            _ctx: this.getWidgetContext(),
        });
        if (widget && !widget.ctx) {
            widget.ctx = this.getWidgetContext();
        }
        return this.widgetManager.addWidget(widget);
    }

    /**
     * Сохранение снимка состояния
     */
    saveSnapshot() {
        const state = {
            workspace: this.viewportController.getState(),
            widgets: this.widgetManager.toJSON()
        };
        this.historyManager.saveSnapshot(state);
    }

    /**
     * Отменить последнее действие
     */
    undo() {
        const state = this.historyManager.undo();
        if (state && state.state) {
                        this.restoreState(state.state);
                    }
    }

    /**
     * Повторить отменённое действие
     */
    redo() {
        const state = this.historyManager.redo();
        if (state && state.state) {
                        this.restoreState(state.state);
                    }
    }

    /**
     * Восстановление состояния
     */
    restoreState(state) {
        // Временно отключаем сохранение истории при восстановлении (чтобы не сохранять undo/redo в историю)
        this.historyManager.disable();
        
        try {
            const widgetCount = state.widgets ? state.widgets.length : 0;
                        
            // Восстанавливаем состояние workspace
            if (state.workspace) {
                this.viewportController.setState(state.workspace);
                            }
            
            // Восстанавливаем виджеты
            if (state.widgets) {
                this.widgetManager.fromJSON(state.widgets, this.widgetClasses, true);
                            }
        } finally {
            // Включаем сохранение истории обратно
            this.historyManager.enable();
        }
    }

    /**
     * Сохранение дашборда
     * @param {string} filename - Имя файла
     */
    save(filename) {
        const dashboard = {
            workspace: this.viewportController.getState(),
            widgets: this.widgetManager.toJSON(),
            metadata: {
                name: filename || 'Untitled Dashboard',
                createdAt: new Date().toISOString()
            }
        };
        
        this.serializer.saveToFile(dashboard, filename || 'dashboard.json');
    }

    /**
     * Загрузка дашборда
     * @param {File} file - Файл для загрузки
     */
    async load(file) {
        try {
            const dashboard = await this.serializer.loadFromFile(file);
            
            // Восстанавливаем состояние
            if (dashboard.workspace) {
                this.viewportController.setState(dashboard.workspace);
            }
            
            if (dashboard.widgets) {
                this.widgetManager.fromJSON(dashboard.widgets, this.widgetClasses);
            }
            
            // Очищаем историю
            this.historyManager.clear();
            
            eventBus.emit('dashboard:loaded', { dashboard });
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            eventBus.emit('dashboard:load-error', { error });
        }
    }

    /**
     * Экспорт в JSON
     * @returns {string} JSON строка
     */
    exportJSON() {
        const dashboard = {
            workspace: this.viewportController.getState(),
            widgets: this.widgetManager.toJSON(),
            metadata: {
                name: 'Exported Dashboard',
                createdAt: new Date().toISOString()
            }
        };
        
        return this.serializer.exportJSON(dashboard);
    }

    /**
     * Импорт из JSON
     * @param {string} jsonString - JSON строка
     */
    importJSON(jsonString) {
        try {
            const dashboard = this.serializer.importJSON(jsonString);
            
            if (dashboard.workspace) {
                this.viewportController.setState(dashboard.workspace);
            }
            
            if (dashboard.widgets) {
                this.widgetManager.fromJSON(dashboard.widgets, this.widgetClasses);
            }
            
            this.historyManager.clear();
            
            eventBus.emit('dashboard:loaded', { dashboard });
        } catch (error) {
            console.error('Failed to import dashboard:', error);
            eventBus.emit('dashboard:load-error', { error });
        }
    }

    /**
     * pointer-events для виджета: в viewer корень без событий (панорама workspace),
     * содержимое — auto, чтобы легенды графиков, таблица, фильтр и поиск были кликабельны.
     * @param {import('./WidgetBase.js').WidgetBase} widget
     * @param {'editor'|'viewer'} mode
     */
    applyWidgetPointerEvents(widget, mode) {
        if (!widget?.element) return;
        const el = widget.element;
        const content = el.querySelector('.widget-content');
        // Ручки ресайза — прямые потомки .widget; при pointer-events: none на корне
        // дочерние элементы с pointer-events: auto всё равно получают клики (CSS hit-testing).
        // В режиме просмотра ресайз должен быть полностью отключён.
        el.querySelectorAll('.resize-handle').forEach((h) => {
            const inCabinet =
                el.classList.contains('widget--in-container') ||
                !!el.closest('.container-content-area');
            if (mode === 'viewer' || inCabinet) {
                h.style.pointerEvents = 'none';
                h.style.display = 'none';
            } else {
                h.style.pointerEvents = '';
                h.style.display = '';
            }
        });

        if (mode === 'viewer') {
            el.style.pointerEvents = 'none';
            if (content) {
                content.style.pointerEvents = 'auto';
            }

            if (widget.type === 'container') {
                const header = el.querySelector('.container-header');
                if (header) header.style.pointerEvents = 'auto';
                el.querySelectorAll('.container-tab').forEach((tab) => {
                    tab.style.pointerEvents = 'auto';
                });
                const contentArea = el.querySelector('.container-content-area');
                if (contentArea) {
                    const closeButton = contentArea.querySelector('.container-close-button');
                    if (closeButton) closeButton.style.pointerEvents = 'auto';
                }
            }
        } else {
            el.style.pointerEvents = 'auto';
            if (content) content.style.pointerEvents = '';
            if (widget.type === 'container') {
                const header = el.querySelector('.container-header');
                if (header) header.style.pointerEvents = '';
                el.querySelectorAll('.container-tab').forEach((tab) => {
                    tab.style.pointerEvents = '';
                });
                const contentArea = el.querySelector('.container-content-area');
                if (contentArea) {
                    const closeButton = contentArea.querySelector('.container-close-button');
                    if (closeButton) closeButton.style.pointerEvents = '';
                }
            }
        }
    }

    /**
     * Установка режима работы
     * @param {string} mode - 'editor' | 'viewer'
     */
    setMode(mode) {
        this.mode = mode;
        
        // Управление отображением сетки
        if (this.workspace) {
            if (mode === 'viewer') {
                // Скрываем сетку в режиме просмотра
                this.workspace.style.backgroundImage = 'none';
                // Также скрываем сетку на viewport
                if (this.viewport) {
                    this.viewport.classList.add('viewer-mode');
                }
                this.__placingHomeMark = false;
                this.viewport?.classList.remove('viewport--placing-home');
            } else {
                // Показываем сетку в режиме редактора
                this.workspace.style.backgroundImage = `
                    linear-gradient(to right, rgba(0, 224, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0, 224, 255, 0.05) 1px, transparent 1px)
                `;
                this.workspace.style.backgroundSize = '20px 20px';
                // Убираем класс viewer-mode с viewport
                if (this.viewport) {
                    this.viewport.classList.remove('viewer-mode');
                }
            }
        }

        // Маркер Home виден только в редакторе
        const homeMarker = this.workspace?.querySelector?.('.workspace-home-marker');
        if (homeMarker) {
            const show = mode === 'editor';
            homeMarker.hidden = !show;
            homeMarker.classList.toggle('workspace-home-marker--visible', show);
        }
        
        const widgets = this.widgetManager.getAllWidgets();
        widgets.forEach((widget) => {
            if (mode === 'viewer') {
                widget.deselect();
            }
            this.applyWidgetPointerEvents(widget, mode);
            // Шкаф кэширует mode для chrome (× на вкладках) — синхронизируем до/через render
            if (widget.type === 'container') {
                if (typeof widget._resolveMode === 'function') {
                    widget._resolveMode();
                } else {
                    widget.currentMode = mode;
                }
                if (typeof widget.render === 'function') {
                    widget.render();
                }
            }
        });
        
        eventBus.emit('mode:changed', { mode });
    }

    /**
     * Получить текущее состояние
     */
    getState() {
        return {
            workspace: this.viewportController.getState(),
            widgets: this.widgetManager.toJSON(),
            mode: this.mode,
            runtimeParams: this.getRuntimeParams(),
        };
    }

    setRuntimeParam(key, value, meta = {}) {
        if (key == null || key === '') return;
        this.runtimeParams.set(String(key), value);
        eventBus.emit('dashboard:params-changed', {
            key: String(key),
            value,
            params: this.getRuntimeParams(),
            meta,
        });
    }

    setRuntimeParams(params = {}, meta = {}) {
        if (!params || typeof params !== 'object') return;
        Object.entries(params).forEach(([key, value]) => {
            this.runtimeParams.set(String(key), value);
        });
        eventBus.emit('dashboard:params-changed', {
            params: this.getRuntimeParams(),
            meta,
        });
    }

    getRuntimeParam(key, fallback = null) {
        if (key == null || key === '') return fallback;
        return this.runtimeParams.has(String(key))
            ? this.runtimeParams.get(String(key))
            : fallback;
    }

    getRuntimeParams() {
        return Object.fromEntries(this.runtimeParams.entries());
    }

    hasModelVariable(name) {
        const k = String(name ?? '');
        if (!k) return false;
        return (
            this.dashboardVariables.has(k) ||
            this.modelVariableOverrides.has(k) ||
            this.modelVariableDefaults.has(k)
        );
    }

    getModelVariable(name, fallback = undefined) {
        const k = String(name ?? '');
        if (!k) return fallback;
        if (this.dashboardVariables.has(k)) {
            return this.dashboardVariables.get(k)?.value;
        }
        if (this.modelVariableOverrides.has(k)) return this.modelVariableOverrides.get(k);
        if (this.modelVariableDefaults.has(k)) return this.modelVariableDefaults.get(k);
        return fallback;
    }

    getModelVariables() {
        const keys = new Set([
            ...this.dashboardVariables.keys(),
            ...this.modelVariableDefaults.keys(),
            ...this.modelVariableOverrides.keys(),
        ]);
        const out = {};
        [...keys]
            .map(String)
            .sort()
            .forEach((k) => {
                out[k] = this.getModelVariable(k);
            });
        return out;
    }

    getModelVariableCatalog() {
        /** @type {Map<string, object>} */
        const byName = new Map();
        for (const [name, meta] of this.modelVariableMeta.entries()) {
            byName.set(String(name), {
                name: String(name),
                type: meta.type || 'Number',
                modelId: meta.modelId ?? null,
                source: 'model',
                defaultValue: this.modelVariableDefaults.has(name)
                    ? this.modelVariableDefaults.get(name)
                    : undefined,
                value: this.modelVariableOverrides.has(name)
                    ? this.modelVariableOverrides.get(name)
                    : this.modelVariableDefaults.get(name),
            });
        }
        for (const name of this.modelVariableDefaults.keys()) {
            if (byName.has(String(name))) continue;
            byName.set(String(name), {
                name: String(name),
                type: 'Number',
                modelId: null,
                source: 'model',
                defaultValue: this.modelVariableDefaults.get(name),
                value: this.getModelVariable(name),
            });
        }
        for (const [name, spec] of this.dashboardVariables.entries()) {
            byName.set(String(name), {
                name: String(name),
                type: spec?.type || 'Number',
                modelId: null,
                source: 'dashboard',
                description: spec?.description || '',
                defaultValue: spec?.value,
                value: spec?.value,
            });
        }
        return [...byName.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    getDashboardVariableCatalog() {
        return [...this.dashboardVariables.entries()]
            .map(([name, spec]) => ({
                name: String(name),
                type: spec?.type || 'Number',
                value: spec?.value,
                description: spec?.description || '',
                source: 'dashboard',
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * @param {Array<{ name: string, type?: string, value?: unknown, description?: string }>} list
     * @param {{ silent?: boolean }} [meta]
     */
    replaceDashboardVariables(list = [], meta = {}) {
        this.dashboardVariables = new Map();
        for (const item of Array.isArray(list) ? list : []) {
            const name = String(item?.name || '').trim();
            if (!name) continue;
            this.dashboardVariables.set(name, {
                type: item.type || 'Number',
                value: item.value,
                description: String(item.description || ''),
            });
        }
        if (meta.silent) return;
        eventBus.emit('dashboard:model-variables-changed', {
            variables: this.getModelVariables(),
            meta: { source: 'dashboard-load', scope: 'dashboard', ...meta },
        });
        eventBus.emit('dashboard:dashboard-variables-changed', {
            variables: this.getDashboardVariableCatalog(),
            meta: { source: 'dashboard-load', ...meta },
        });
    }

    /**
     * @param {string} name
     * @param {{ type?: string, value?: unknown, description?: string }} spec
     * @param {{ silent?: boolean, persist?: boolean, source?: string }} [meta]
     */
    upsertDashboardVariable(name, spec = {}, meta = {}) {
        const k = String(name ?? '').trim();
        if (!k) return;
        const prev = this.dashboardVariables.get(k) || {};
        this.dashboardVariables.set(k, {
            type: spec.type || prev.type || 'Number',
            value: Object.prototype.hasOwnProperty.call(spec, 'value') ? spec.value : prev.value,
            description:
                spec.description != null ? String(spec.description) : String(prev.description || ''),
        });
        if (meta.silent) return;
        eventBus.emit('dashboard:model-variables-changed', {
            key: k,
            value: this.dashboardVariables.get(k)?.value,
            variables: this.getModelVariables(),
            meta: { scope: 'dashboard', persist: meta.persist !== false, ...meta },
        });
        eventBus.emit('dashboard:dashboard-variables-changed', {
            key: k,
            variables: this.getDashboardVariableCatalog(),
            meta: { persist: meta.persist !== false, ...meta },
        });
    }

    /**
     * @param {string} name
     * @param {{ silent?: boolean, persist?: boolean, source?: string }} [meta]
     */
    removeDashboardVariable(name, meta = {}) {
        const k = String(name ?? '').trim();
        if (!k || !this.dashboardVariables.has(k)) return;
        this.dashboardVariables.delete(k);
        if (meta.silent) return;
        eventBus.emit('dashboard:model-variables-changed', {
            key: k,
            variables: this.getModelVariables(),
            meta: { scope: 'dashboard', persist: meta.persist !== false, ...meta },
        });
        eventBus.emit('dashboard:dashboard-variables-changed', {
            key: k,
            removed: true,
            variables: this.getDashboardVariableCatalog(),
            meta: { persist: meta.persist !== false, ...meta },
        });
    }

    /**
     * @param {string} name
     * @param {unknown} value
     * @param {{ source?: string, persist?: boolean, silent?: boolean }} [meta]
     */
    setModelVariable(name, value, meta = {}) {
        const k = String(name ?? '').trim();
        if (!k) return;
        if (this.dashboardVariables.has(k)) {
            const prev = this.dashboardVariables.get(k) || {};
            this.dashboardVariables.set(k, { ...prev, value });
            if (meta.silent) return;
            eventBus.emit('dashboard:model-variables-changed', {
                key: k,
                value,
                variables: this.getModelVariables(),
                meta: { scope: 'dashboard', persist: true, ...meta },
            });
            eventBus.emit('dashboard:dashboard-variables-changed', {
                key: k,
                value,
                variables: this.getDashboardVariableCatalog(),
                meta: { persist: true, ...meta },
            });
            return;
        }
        const type = this.modelVariableMeta.get(k)?.type;
        if (type && !isScalarModelVariableType(type)) return;
        this.modelVariableOverrides.set(k, value);
        if (meta.silent) return;
        eventBus.emit('dashboard:model-variables-changed', {
            key: k,
            value,
            variables: this.getModelVariables(),
            meta: { scope: 'model', ...meta },
        });
    }

    /**
     * @param {Record<string, unknown>} vars
     * @param {{ source?: string, persist?: boolean, silent?: boolean }} [meta]
     */
    setModelVariables(vars = {}, meta = {}) {
        if (!vars || typeof vars !== 'object') return;
        let touchedDashboard = false;
        Object.entries(vars).forEach(([key, value]) => {
            const k = String(key || '').trim();
            if (!k) return;
            if (this.dashboardVariables.has(k)) {
                const prev = this.dashboardVariables.get(k) || {};
                this.dashboardVariables.set(k, { ...prev, value });
                touchedDashboard = true;
                return;
            }
            const type = this.modelVariableMeta.get(k)?.type;
            if (type && !isScalarModelVariableType(type)) return;
            this.modelVariableOverrides.set(k, value);
        });
        if (meta.silent) return;
        eventBus.emit('dashboard:model-variables-changed', {
            variables: this.getModelVariables(),
            meta: {
                scope: touchedDashboard ? 'dashboard' : 'model',
                persist: touchedDashboard,
                ...meta,
            },
        });
        if (touchedDashboard) {
            eventBus.emit('dashboard:dashboard-variables-changed', {
                variables: this.getDashboardVariableCatalog(),
                meta: { persist: true, ...meta },
            });
        }
    }

    /**
     * @param {Record<string, unknown>} vars
     * @param {{ silent?: boolean }} [meta]
     */
    applyModelVariableOverrides(vars = {}, meta = {}) {
        this.modelVariableOverrides = new Map();
        Object.entries(vars || {}).forEach(([key, value]) => {
            const k = String(key || '').trim();
            if (k) this.modelVariableOverrides.set(k, value);
        });
        if (meta.silent) return;
        eventBus.emit('dashboard:model-variables-changed', {
            variables: this.getModelVariables(),
            meta: { source: 'storage', scope: 'model', ...meta },
        });
    }

    /**
     * @param {Record<string, { value: unknown, type?: string, modelId?: string|number }>} catalog
     * @param {{ silent?: boolean }} [meta]
     */
    replaceModelVariableDefaults(catalog = {}, meta = {}) {
        this.modelVariableDefaults = new Map();
        this.modelVariableMeta = new Map();
        Object.entries(catalog || {}).forEach(([key, spec]) => {
            const k = String(key || '').trim();
            if (!k) return;
            const value = spec && typeof spec === 'object' && 'value' in spec ? spec.value : spec;
            const type = spec && typeof spec === 'object' ? spec.type : 'Number';
            this.modelVariableDefaults.set(k, value);
            this.modelVariableMeta.set(k, {
                type: type || 'Number',
                modelId: spec?.modelId ?? null,
            });
        });
        if (meta.silent) return;
        eventBus.emit('dashboard:model-variables-changed', {
            variables: this.getModelVariables(),
            meta: { source: 'defaults', scope: 'model', ...meta },
        });
    }

    /** Сигнал для `fetch` / axios / координатора запросов к SQLite-модели. */
    get requestSignal() {
        return this._abortController?.signal;
    }

    /**
     * Снять подписки данных, отменить in-flight запросы, очистить виджеты.
     * Идемпотентно: повторный вызов безопасен.
     */
    destroy() {
        this._destroyed = true;
        if (this._onDocumentKeyDown) {
            document.removeEventListener('keydown', this._onDocumentKeyDown);
            this._onDocumentKeyDown = null;
        }
        if (this._onDocumentPaste) {
            document.removeEventListener('paste', this._onDocumentPaste);
            this._onDocumentPaste = null;
        }
        try {
            this._abortController?.abort('engine-destroyed');
        } catch (_) {
            /* ignore */
        }
        try {
            forgetDashboardDataModelClient(this);
        } catch (_) {
            /* ignore */
        }
        try {
            this.viewportController?.destroy?.();
        } catch (_) {
            /* ignore */
        }
        try {
            if (typeof this.widgetManager?.destroy === 'function') {
                this.widgetManager.destroy();
            } else {
                this.widgetManager?.clear?.();
            }
        } catch (_) {
            /* ignore */
        }
        try {
            this.historyManager?.destroy?.();
        } catch (_) {
            /* ignore */
        }
    }
}

