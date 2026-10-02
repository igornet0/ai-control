import { WidgetBase } from '../core/WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { svgCross } from '../../icons/dashboardCreaterIcons.js';
import {
    createDashWidgetHeadingElement,
    normalizeWidgetTitleSettings,
} from './common/widgetTitle.js';

/**
 * Преобразование типа виджета в читаемое название
 */
function getWidgetDisplayName(type) {
    const displayNames = {
        'text': 'Текст',
        'table': 'Таблица',
        'line-chart': 'Линейный график',
        'bar-chart': 'Столбчатая диаграмма',
        'pie-chart': 'Круговая диаграмма',
        'kpi': 'KPI',
        'gauge': 'Датчик',
        'html': 'HTML',
        'image': 'Медиа',
        'container': 'Шкаф'
    };
    return displayNames[type] || type;
}

/**
 * ContainerWidget - Виджет-контейнер (Шкаф)
 * Позволяет размещать другие виджеты внутри и отображает их во вкладках
 */
export class ContainerWidget extends WidgetBase {
    constructor(config = {}) {
        // ВАЖНО: super() должен быть вызван первым, до любого обращения к this
        super({
            ...config,
            type: 'container',
            width: config.width || 600,
            height: config.height || 400
        });
        
        // Инициализируем свойства после вызова super()
        this.headerHeight = 80; // Высота для вертикальных расположений (top/bottom)
        this.headerWidth = 240; // Ширина для боковых расположений (left/right)
        this.contentPadding = 8; // Отступ для внутренних виджетов (чтобы контент не обрезался)
        
        // Расположение хедера с вкладками: 'top', 'bottom', 'left', 'right'
        const requestedTabPosition = config.settings?.tabPosition || 'top';
        const defaultTabPosition = this.tabPosition || 'top';
        this.tabPosition = requestedTabPosition;
        
        // Состояние видимости контента (false = открыт, true = скрыт, только вкладки)
        this.contentCollapsed = config.settings?.contentCollapsed !== undefined 
            ? config.settings.contentCollapsed 
            : false;
        
        // Флаг, указывающий, что контент был открыт пользователем через клик на вкладку
        this._contentOpenedByClick = false;
        
        // Сохраняем исходные размеры для восстановления при открытии контента
        this._originalWidth = this.width;
        this._originalHeight = this.height;
        
        // Инициализируем список виджетов и ссылки ДО возможного вызова createElement()
        // Список ID виджетов внутри контейнера
        this.containedWidgets = config.containedWidgets || [];
        
        // Ссылки на виджеты (будут установлены извне)
        this.widgetReferences = new Map();
        
        // Если tabPosition был передан в config и отличается от созданного по умолчанию,
        // пересоздаем структуру с правильным расположением
        if (requestedTabPosition !== defaultTabPosition && config.settings?.tabPosition) {
            // Сохраняем содержимое contentArea если оно есть
            const contentArea = this.element?.querySelector('.container-content-area');
            const widgetsToRestore = [];
            if (contentArea) {
                Array.from(contentArea.children).forEach(child => {
                    if (child.classList.contains('widget')) {
                        widgetsToRestore.push(child);
                    }
                });
            }
            
            // Пересоздаем структуру
            this.createElement();
            
            // Восстанавливаем виджеты
            const newContentArea = this.element?.querySelector('.container-content-area');
            if (newContentArea && widgetsToRestore.length > 0) {
                widgetsToRestore.forEach(widget => {
                    newContentArea.appendChild(widget);
                });
            }
        }
        
        // Стили для вкладок
        this.tabStyles = {
            activeBackground: 'rgba(0, 224, 255, 0.2)',
            inactiveBackground: 'rgba(255, 255, 255, 0.05)',
            activeColor: '#00E0FF',
            inactiveColor: '#B0B3B8',
            borderColor: 'rgba(0, 224, 255, 0.3)'
        };
        
        // ID активной вкладки
        this.activeTabId = config.activeTabId || null;
        
        // Режим: не хардкодить editor — виджеты часто создаются после setMode('viewer')
        this.currentMode = this._resolveMode();
        
        // Подписка на изменение режима
        this.modeUnsubscribe = eventBus.on('mode:changed', ({ mode }) => {
            if (mode === 'viewer' || mode === 'editor') {
                this.currentMode = mode;
            } else {
                this.currentMode = this._resolveMode();
            }
            // Перерисовываем для обновления видимости кнопок удаления
            this.render();
        });

        /** @type {string[][]} группы id виджетов на вкладках (мультирежим до getSlotsPerTab) */
        this.tabGroups = [];
        this.ensureTabGroups();
    }

    /**
     * Актуальный режим workspace (viewer/editor).
     * Читает engine.mode, чтобы не показывать chrome редактора после поздней загрузки виджетов.
     */
    _resolveMode() {
        const fromEngine =
            typeof window !== 'undefined' && window.engine && window.engine.mode
                ? window.engine.mode
                : null;
        if (fromEngine === 'viewer' || fromEngine === 'editor') {
            this.currentMode = fromEngine;
            return fromEngine;
        }
        return this.currentMode === 'viewer' ? 'viewer' : 'editor';
    }

    /** Сколько виджетов максимум на одной вкладке (1–4). */
    getSlotsPerTab() {
        const n = parseInt(this.settings?.slotsPerTab, 10);
        if (!Number.isFinite(n)) return 1;
        return Math.min(4, Math.max(1, n));
    }

    /** Синхронизация tabGroups из настроек или по одному виджету на вкладку. */
    ensureTabGroups() {
        let flat = [...(this.containedWidgets || [])];
        const fromSettings = this.settings?.containerTabGroups;
        if (
            flat.length === 0 &&
            Array.isArray(fromSettings) &&
            fromSettings.length > 0 &&
            fromSettings.every((row) => Array.isArray(row))
        ) {
            flat = [...new Set(fromSettings.flat().filter(Boolean))];
        }
        if (
            Array.isArray(fromSettings) &&
            fromSettings.length > 0 &&
            fromSettings.every((row) => Array.isArray(row))
        ) {
            const used = new Set();
            this.tabGroups = [];
            for (const row of fromSettings) {
                const clean = row.filter((id) => flat.includes(id) && !used.has(id));
                clean.forEach((id) => used.add(id));
                if (clean.length) this.tabGroups.push(clean);
            }
            for (const id of flat) {
                if (!used.has(id)) this.tabGroups.push([id]);
            }
        } else {
            this.tabGroups = flat.map((id) => [id]);
        }
        this._clampTabGroupsToSlotLimit();
        this.syncContainedWidgetsFromTabGroups();
        if (this.tabGroups?.length) {
            if (!this.activeTabId || !this.containedWidgets.includes(this.activeTabId)) {
                this.activeTabId = this.tabGroups[0][0];
            } else {
                const g = this.tabGroups.find((row) => row.includes(this.activeTabId));
                if (g?.length) this.activeTabId = g[0];
            }
        } else {
            this.activeTabId = null;
        }
    }

    _clampTabGroupsToSlotLimit() {
        const max = this.getSlotsPerTab();
        const next = [];
        for (const group of this.tabGroups || []) {
            let chunk = [];
            for (const id of group) {
                if (chunk.length >= max) {
                    next.push(chunk);
                    chunk = [];
                }
                chunk.push(id);
            }
            if (chunk.length) next.push(chunk);
        }
        this.tabGroups = next;
    }

    syncContainedWidgetsFromTabGroups() {
        this.containedWidgets = this.tabGroups.flat();
        this.settings = this.settings || {};
        this.settings.containerTabGroups = this.tabGroups.map((row) => [...row]);
        this.settings.slotsPerTab = this.getSlotsPerTab();
    }

    getActiveTabWidgetIds() {
        if (!this.activeTabId || !this.tabGroups?.length) {
            return this.activeTabId ? [this.activeTabId] : [];
        }
        const g = this.tabGroups.find((row) => row.includes(this.activeTabId));
        return g && g.length ? [...g] : [this.activeTabId];
    }

    getTabLabelForGroup(group) {
        if (!group || !group.length) return '';
        if (group.length === 1) {
            const primaryId = group[0];
            const custom = this.getCustomTabLabel(primaryId);
            if (custom) return custom;
            const w = this.widgetReferences.get(primaryId);
            if (!w) return '';
            return getWidgetDisplayName(w.type);
        }
        const head = this.getTabLabelForGroup([group[0]]);
        return `${head} · +${group.length - 1}`;
    }

    /**
     * Кастомные подписи вкладок шкафа (не связаны с settings.title виджета).
     * Ключ — id первого виджета вкладки.
     * @returns {Record<string, string>}
     */
    getTabLabelsMap() {
        if (!this.settings || typeof this.settings !== 'object') this.settings = {};
        if (!this.settings.tabLabels || typeof this.settings.tabLabels !== 'object') {
            this.settings.tabLabels = {};
        }
        return this.settings.tabLabels;
    }

    /**
     * @param {string} primaryWidgetId
     * @returns {string}
     */
    getCustomTabLabel(primaryWidgetId) {
        if (!primaryWidgetId) return '';
        const raw = this.getTabLabelsMap()[primaryWidgetId];
        return raw != null ? String(raw).trim() : '';
    }

    /**
     * @param {string} primaryWidgetId
     * @param {string} rawLabel — пустая строка сбрасывает к авто-имени по типу виджета
     */
    setCustomTabLabel(primaryWidgetId, rawLabel) {
        if (!primaryWidgetId) return;
        const labels = this.getTabLabelsMap();
        const v = (rawLabel ?? '').trim();
        if (!v) {
            delete labels[primaryWidgetId];
        } else {
            labels[primaryWidgetId] = v.slice(0, 80);
        }
        this.settings.tabLabels = labels;
    }

    /**
     * Перенос ключа подписи вкладки при смене id виджета.
     * @param {string} oldId
     * @param {string} newId
     */
    remapTabLabelKey(oldId, newId) {
        if (!oldId || !newId || oldId === newId) return;
        const labels = this.getTabLabelsMap();
        if (!Object.prototype.hasOwnProperty.call(labels, oldId)) return;
        if (!Object.prototype.hasOwnProperty.call(labels, newId)) {
            labels[newId] = labels[oldId];
        }
        delete labels[oldId];
    }

    layoutActiveTabWidgets() {
        const contentArea = this.element?.querySelector('.container-content-area');
        if (!contentArea) return;
        const ids = this.getActiveTabWidgetIds().slice(0, 4);
        const { width: AW, height: AH } = this.getAvailableSize();
        const pad = this.contentPadding || 8;
        const gap = 6;
        const W = AW;
        const H = AH;
        const place = (widgetId, x, y, w, h) => {
            const wgt = this.widgetReferences.get(widgetId);
            if (!wgt?.element) return;
            const cw = Math.max(50, w);
            const ch = Math.max(50, h);
            wgt.element.classList.add('widget--in-container');
            wgt.element.querySelectorAll('.resize-handle').forEach((handle) => {
                handle.style.display = 'none';
                handle.style.pointerEvents = 'none';
            });
            wgt.element.style.position = 'absolute';
            wgt.element.style.left = `${x}px`;
            wgt.element.style.top = `${y}px`;
            wgt.element.style.width = `${cw}px`;
            wgt.element.style.height = `${ch}px`;
            wgt.setPosition(x, y, null);
            wgt.setSize(cw, ch, null);
        };
        const n = ids.length;
        if (n === 0) return;
        if (n === 1) {
            place(ids[0], pad, pad, W, H);
            return;
        }
        if (n === 2) {
            const hw = (W - gap) / 2;
            place(ids[0], pad, pad, hw, H);
            place(ids[1], pad + hw + gap, pad, hw, H);
            return;
        }
        if (n === 3) {
            const hw = (W - gap) / 2;
            const hh = (H - gap) / 2;
            place(ids[0], pad, pad, hw, hh);
            place(ids[1], pad + hw + gap, pad, hw, hh);
            place(ids[2], pad, pad + hh + gap, W, hh);
            return;
        }
        const hw = (W - gap) / 2;
        const hh = (H - gap) / 2;
        place(ids[0], pad, pad, hw, hh);
        place(ids[1], pad + hw + gap, pad, hw, hh);
        place(ids[2], pad, pad + hh + gap, hw, hh);
        place(ids[3], pad + hw + gap, pad + hh + gap, hw, hh);
    }

    /**
     * Высота DOM-заголовка шкафа (showTitle), чтобы не обрезать вложенные виджеты.
     * @returns {number}
     */
    _estimateTitleReservePx() {
        if (this.settings?.showTitle !== true) return 0;
        const el = this.element?.querySelector('.container-widget-heading');
        if (el) {
            const h = el.offsetHeight || el.getBoundingClientRect().height;
            if (h > 0) return Math.ceil(h);
        }
        const fs = parseInt(this.settings.titleSize, 10);
        const titleFs = Number.isFinite(fs) ? Math.min(48, Math.max(8, fs)) : 14;
        // line-height ~1.2 + margin-bottom у .container-widget-heading (~0.5rem)
        return Math.ceil(titleFs * 1.25 + 8);
    }

    /**
     * Фактическая высота/ширина полосы вкладок (если уже в DOM).
     * @returns {{ headerH: number, headerW: number }}
     */
    _measureTabHeaderSize() {
        const header = this.element?.querySelector('.container-header');
        const isVertical = this.tabPosition === 'top' || this.tabPosition === 'bottom';
        if (header) {
            if (isVertical) {
                const h = header.offsetHeight || header.getBoundingClientRect().height;
                if (h > 0) return { headerH: Math.ceil(h), headerW: this.headerWidth || 220 };
            } else {
                const w = header.offsetWidth || header.getBoundingClientRect().width;
                if (w > 0) return { headerH: this.headerHeight || 60, headerW: Math.ceil(w) };
            }
        }
        return {
            headerH: this.headerHeight || 60,
            headerW: this.headerWidth || 220,
        };
    }

    /**
     * Вычисление доступных размеров для внутренних виджетов с учетом отступов,
     * полосы вкладок и заголовка шкафа.
     * @returns {{width: number, height: number}}
     */
    getAvailableSize() {
        const padding = this.contentPadding || 8;
        const paddingTotal = padding * 2;

        // Предпочитаем реальный размер content-area (уже без title + tabs).
        const contentArea = this.element?.querySelector('.container-content-area');
        if (contentArea) {
            const cw = contentArea.clientWidth;
            const ch = contentArea.clientHeight;
            if (cw > 0 && ch > 0) {
                return {
                    width: Math.max(50, cw - paddingTotal),
                    height: Math.max(50, ch - paddingTotal),
                };
            }
        }

        const isVertical = this.tabPosition === 'top' || this.tabPosition === 'bottom';
        const { headerH, headerW } = this._measureTabHeaderSize();
        const titleReserve = this._estimateTitleReservePx();

        const availableWidth = isVertical
            ? this.width - paddingTotal
            : this.width - headerW - paddingTotal;
        const availableHeight = isVertical
            ? this.height - headerH - paddingTotal - titleReserve
            : this.height - paddingTotal - titleReserve;

        return {
            width: Math.max(50, availableWidth),
            height: Math.max(50, availableHeight),
        };
    }

    /** Пересчитать раскладку после изменения title/DOM (после paint). */
    _scheduleContainedLayout() {
        if (typeof requestAnimationFrame !== 'function') {
            this.layoutActiveTabWidgets();
            return;
        }
        if (this._layoutRaf != null) {
            cancelAnimationFrame(this._layoutRaf);
        }
        this._layoutRaf = requestAnimationFrame(() => {
            this._layoutRaf = null;
            this.layoutActiveTabWidgets();
        });
    }

    /**
     * Скрытие контента с анимацией выдвижения в противоположную сторону от вкладок
     */
    collapseContent(contentArea) {
        if (!contentArea) return;
        
        // Сохраняем исходные размеры перед первым скрытием
        if (this._originalWidth === undefined || this._originalWidth === null) {
            this._originalWidth = this.width;
            this._originalHeight = this.height;
        }
        
        const isVertical = this.tabPosition === 'top' || this.tabPosition === 'bottom';
        
        if (isVertical) {
            // Для вертикального расположения вкладок (top/bottom)
            if (this.tabPosition === 'top') {
                // Вкладки сверху - контент выдвигается вниз
                contentArea.style.transform = 'translateY(100%)';
            } else {
                // Вкладки снизу - контент выдвигается вверх
                contentArea.style.transform = 'translateY(-100%)';
            }
            // Уменьшаем высоту до размера header (используем super.setSize чтобы избежать обновления _originalWidth)
            if (this.height !== this.headerHeight) {
                super.setSize(this.width, this.headerHeight);
            }
        } else {
            // Для горизонтального расположения вкладок (left/right)
            if (this.tabPosition === 'left') {
                // Вкладки слева - контент выдвигается вправо
                contentArea.style.transform = 'translateX(100%)';
            } else {
                // Вкладки справа - контент выдвигается влево
                contentArea.style.transform = 'translateX(-100%)';
            }
            // Уменьшаем ширину до размера header (используем super.setSize чтобы избежать обновления _originalWidth)
            if (this.width !== this.headerWidth) {
                super.setSize(this.headerWidth, this.height);
            }
        }
        
        contentArea.style.opacity = '0';
        contentArea.style.pointerEvents = 'none';
    }

    /**
     * Показ контента с анимацией выдвижения
     */
    expandContent(contentArea) {
        if (!contentArea) return;
        
        // Восстанавливаем исходные размеры, если они были сохранены
        if (this._originalWidth !== undefined && this._originalWidth !== null &&
            this._originalHeight !== undefined && this._originalHeight !== null) {
            // Используем super.setSize чтобы избежать обновления _originalWidth в setSize
            if (this.width !== this._originalWidth || this.height !== this._originalHeight) {
                super.setSize(this._originalWidth, this._originalHeight);
            }
        }
        
        contentArea.style.transform = 'translate(0, 0)';
        contentArea.style.opacity = '1';
        contentArea.style.pointerEvents = 'auto';
        
        if (this.containedWidgets && Array.isArray(this.containedWidgets) && this.widgetReferences) {
            this.layoutActiveTabWidgets();
        }
    }

    /**
     * Создание кнопки закрытия контента
     */
    createCloseButton(contentArea) {
        const closeButton = document.createElement('button');
        closeButton.className = 'container-close-button';
        closeButton.innerHTML = svgCross;
        closeButton.title = 'Закрыть контент';
        closeButton.setAttribute('aria-label', 'Закрыть контент');
        closeButton.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            width: 32px;
            height: 32px;
            background: rgba(20, 20, 30, 0.8);
            border: 1px solid rgba(0, 224, 255, 0.3);
            border-radius: 6px;
            color: #00E0FF;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            transition: all 0.2s ease;
            backdrop-filter: blur(8px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        // Обработчик наведения
        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = 'rgba(0, 224, 255, 0.2)';
            closeButton.style.borderColor = '#00E0FF';
            closeButton.style.boxShadow = '0 0 12px rgba(0, 224, 255, 0.5)';
            closeButton.style.transform = 'scale(1.1)';
        });
        
        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'rgba(20, 20, 30, 0.8)';
            closeButton.style.borderColor = 'rgba(0, 224, 255, 0.3)';
            closeButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            closeButton.style.transform = 'scale(1)';
        });
        
        // Обработчик клика - закрываем контент
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this._contentOpenedByClick = false;
            const contentArea = this.element.querySelector('.container-content-area');
            if (contentArea) {
                this.collapseContent(contentArea);
            }
            closeButton.style.display = 'none';
            // Обновляем рендер для применения изменений размера
            this.render();
        });
        
        // Убеждаемся, что кнопка кликабельна в режиме просмотра
        if (this._resolveMode() === 'viewer') {
            closeButton.style.pointerEvents = 'auto';
        }
        
        return closeButton;
    }

    /**
     * Placeholder «пустой шкаф» и подсказка при drag — не затираются innerHTML.
     * @param {HTMLElement} contentArea
     */
    _appendContainerOverlayNodes(contentArea) {
        if (!contentArea) return;
        let emptyPh = contentArea.querySelector('.container-empty-placeholder');
        if (!emptyPh) {
            emptyPh = document.createElement('div');
            emptyPh.className = 'container-empty-placeholder';
            emptyPh.textContent = 'Перетащите виджеты сюда';
            contentArea.appendChild(emptyPh);
        }
        let hint = contentArea.querySelector('.container-drop-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'container-drop-hint';
            hint.textContent = 'Отпустите, чтобы добавить в шкаф';
            hint.style.display = 'none';
            contentArea.appendChild(hint);
        }
    }

    /**
     * Подсказка на корне .widget: при свёрнутом контенте .container-content-area с opacity:0,
     * подсказка внутри неё не видна — показываем копию поверх шкафа.
     */
    _ensureRootDropHint() {
        if (!this.element || this.element.querySelector('.container-drop-hint-root')) return;
        const root = document.createElement('div');
        root.className = 'container-drop-hint container-drop-hint-root';
        root.textContent = 'Отпустите, чтобы добавить в шкаф';
        root.style.display = 'none';
        this.element.appendChild(root);
    }

    /** Показать подсказку drop поверх контент-области */
    showDropHint() {
        const inner = this.element?.querySelector('.container-content-area .container-drop-hint');
        const root = this.element?.querySelector('.container-drop-hint-root');
        const useRoot = this.contentCollapsed && !this._contentOpenedByClick;
        if (inner) inner.style.display = useRoot ? 'none' : 'flex';
        if (root) root.style.display = useRoot ? 'flex' : 'none';
    }

    /** Скрыть подсказку drop */
    hideDropHint() {
        const inner = this.element?.querySelector('.container-content-area .container-drop-hint');
        const root = this.element?.querySelector('.container-drop-hint-root');
        if (inner) inner.style.display = 'none';
        if (root) root.style.display = 'none';
    }

    /**
     * Можно ли поместить виджет в этот контейнер (без изменения состояния).
     * @param {*} widget
     * @param {*} widgetManager
     */
    canAcceptWidget(widget, widgetManager) {
        if (!widget || !widgetManager) return false;
        if (widget.id === this.id) return false;
        if (widget.type === 'container') return false;
        if (this.isWidgetInContainer(widget, widgetManager)) return false;
        if (this.containedWidgets.includes(widget.id)) return false;
        return true;
    }

    /**
     * Создание DOM элемента с header и контейнером для виджетов
     */
    createElement() {
        super.createElement();
        
        // Убеждаемся, что tabStyles инициализирован
        if (!this.tabStyles) {
            this.tabStyles = {
                activeBackground: 'rgba(0, 224, 255, 0.2)',
                inactiveBackground: 'rgba(255, 255, 255, 0.05)',
                activeColor: '#00E0FF',
                inactiveColor: '#B0B3B8',
                borderColor: 'rgba(0, 224, 255, 0.3)'
            };
        }
        
        if (!this.headerHeight) {
            this.headerHeight = 60; // Высота для вертикальных расположений (top/bottom)
        }
        
        if (!this.headerWidth) {
            this.headerWidth = 220; // Ширина для боковых расположений (left/right)
        }
        
        if (!this.tabPosition) {
            this.tabPosition = 'top';
        }
        
        // Создаем структуру контейнера
        const content = this.element.querySelector('.widget-content');
        if (content) {
            content.style.position = 'relative';
            content.style.height = '100%';
            content.style.display = 'flex';
            content.style.flexDirection = 'column';
            content.style.overflow = 'hidden';

            this.settings = this.settings || {};
            normalizeWidgetTitleSettings(this.settings, {
                defaultTitle: 'Шкаф',
                defaultShow: false,
            });

            // Определяем направление flex в зависимости от расположения вкладок
            const isVertical = this.tabPosition === 'top' || this.tabPosition === 'bottom';
            
            // Header с вкладками
            const header = document.createElement('div');
            header.className = 'container-header';
            
            // Стили для header в зависимости от расположения
            if (isVertical) {
                const borderSide = this.tabPosition === 'top' ? 'bottom' : 'top';
                header.style.cssText = `
                    min-height: ${this.headerHeight}px;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    background: rgba(20, 20, 30, 0.5);
                    padding: 4px 8px;
                    gap: 4px;
                    overflow-x: visible;
                    overflow-y: visible;
                    flex-shrink: 0;
                    flex-wrap: wrap;
                `;
                header.style[`border${borderSide.charAt(0).toUpperCase() + borderSide.slice(1)}`] = `1px solid ${this.tabStyles.borderColor}`;
            } else {
                const borderSide = this.tabPosition === 'left' ? 'right' : 'left';
                header.style.cssText = `
                    width: ${this.headerWidth}px;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    background: rgba(20, 20, 30, 0.5);
                    padding: 4px 8px;
                    gap: 4px;
                    overflow-x: visible;
                    overflow-y: visible;
                    flex-shrink: 0;
                `;
                header.style[`border${borderSide.charAt(0).toUpperCase() + borderSide.slice(1)}`] = `1px solid ${this.tabStyles.borderColor}`;
            }
            
            // Контейнер для содержимого виджетов
            const contentArea = document.createElement('div');
            contentArea.className = 'container-content-area';
            contentArea.style.cssText = `
                flex: 1;
                position: relative;
                overflow: hidden;
                background: transparent;
                transition: transform 0.3s ease-out, opacity 0.3s ease-out;
            `;
            
            // Кнопка закрытия контента (появляется только когда контент скрыт по умолчанию)
            const closeButton = this.createCloseButton(contentArea);
            contentArea.appendChild(closeButton);
            this._appendContainerOverlayNodes(contentArea);
            
            // Применяем начальное состояние видимости контента
            if (this.contentCollapsed) {
                // Сохраняем исходные размеры перед скрытием
                this._originalWidth = this.width;
                this._originalHeight = this.height;
                // Устанавливаем размер для скрытого состояния
                const isVert = this.tabPosition === 'top' || this.tabPosition === 'bottom';
                if (isVert) {
                    if (this.height !== this.headerHeight) {
                        super.setSize(this.width, this.headerHeight);
                    }
                } else {
                    if (this.width !== this.headerWidth) {
                        super.setSize(this.headerWidth, this.height);
                    }
                }
                this.collapseContent(contentArea);
                closeButton.style.display = 'none';
            } else {
                this.expandContent(contentArea);
            }

            const body = document.createElement('div');
            body.className = 'container-body';
            body.style.cssText = 'flex:1;min-height:0;min-width:0;display:flex;overflow:hidden;';
            if (isVertical) {
                body.style.flexDirection = this.tabPosition === 'top' ? 'column' : 'column-reverse';
            } else {
                body.style.flexDirection = this.tabPosition === 'left' ? 'row' : 'row-reverse';
            }
            body.appendChild(header);
            body.appendChild(contentArea);

            const titleEl = createDashWidgetHeadingElement(this.settings);
            if (titleEl) {
                titleEl.classList.add('container-widget-heading');
                titleEl.style.flexShrink = '0';
                content.appendChild(titleEl);
            }
            content.appendChild(body);
            this._ensureRootDropHint();
        }
    }

    /**
     * Добавление виджета в контейнер
     */
    addWidget(widget, widgetManager) {
        if (!widget || !widgetManager) return false;
        
        // Проверяем, не является ли виджет самим контейнером
        if (widget.id === this.id) return false;
        
        // Проверяем, не является ли виджет уже контейнером (избегаем вложенности)
        if (widget.type === 'container') return false;
        
        // Проверяем, не находится ли виджет уже в другом контейнере
        if (this.isWidgetInContainer(widget, widgetManager)) return false;

        const contentArea = this.element?.querySelector('.container-content-area');
        const alreadyInThisCabinet =
            contentArea &&
            widget.element &&
            widget.element.parentNode === contentArea &&
            this.widgetReferences.has(widget.id);

        // После загрузки из БД: id уже в containedWidgets из JSON, но ссылок/DOM ещё нет — нужно догнать привязку
        if (this.containedWidgets.includes(widget.id) && !this.widgetReferences.has(widget.id)) {
            this.widgetReferences.set(widget.id, widget);
            if (widgetManager?.workspace && widget.element?.parentNode === widgetManager.workspace) {
                widget.element.parentNode.removeChild(widget.element);
            }
            this.moveWidgetToContainer(widget);
            this.ensureTabGroups();
            this.layoutActiveTabWidgets();
            this.render();
            return true;
        }

        if (this.containedWidgets.includes(widget.id) && alreadyInThisCabinet) {
            return false;
        }

        this.ensureTabGroups();
        const max = this.getSlotsPerTab();
        let gi = this.tabGroups.findIndex((g) => g.includes(this.activeTabId));
        if (gi < 0) gi = this.tabGroups.length > 0 ? this.tabGroups.length - 1 : 0;
        if (this.tabGroups.length === 0) {
            this.tabGroups.push([]);
        }
        const group = this.tabGroups[gi] || [];
        let newGroup;
        if (group.length < max) {
            newGroup = [...group, widget.id];
            this.tabGroups[gi] = newGroup;
        } else {
            newGroup = [widget.id];
            this.tabGroups.push(newGroup);
            gi = this.tabGroups.length - 1;
        }
        this.widgetReferences.set(widget.id, widget);
        this.syncContainedWidgetsFromTabGroups();

        if (!this.activeTabId) {
            this.activeTabId = newGroup[0];
        } else if (group.length >= max) {
            this.activeTabId = widget.id;
        }
        
        // Удаляем виджет из DOM основного workspace (если он там есть)
        if (widgetManager && widgetManager.workspace) {
            if (widget.element && widget.element.parentNode === widgetManager.workspace) {
                widget.element.parentNode.removeChild(widget.element);
            }
        }
        
        this.moveWidgetToContainer(widget);
        this.render();
        
        return true;
    }

    /**
     * Удаление виджета из контейнера
     */
    removeWidget(widgetId, widgetManager) {
        if (!this.containedWidgets.includes(widgetId)) return;

        const widget = this.widgetReferences.get(widgetId);

        this.tabGroups = this.tabGroups
            .map((g) => g.filter((id) => id !== widgetId))
            .filter((g) => g.length > 0);
        this.widgetReferences.delete(widgetId);

        const flatAfter = this.tabGroups.flat();
        if (!flatAfter.length) {
            this.activeTabId = null;
        } else if (
            widgetId === this.activeTabId ||
            !this.activeTabId ||
            !flatAfter.includes(this.activeTabId)
        ) {
            this.activeTabId = this.tabGroups[0][0];
        }

        this.syncContainedWidgetsFromTabGroups();

        // Удаляем кастомную подпись вкладки, если этот виджет был её ключом
        if (this.settings?.tabLabels && typeof this.settings.tabLabels === 'object') {
            delete this.settings.tabLabels[widgetId];
        }

        // Возвращаем виджет в основной workspace
        if (widget && widget.element && widgetManager && widgetManager.workspace) {
            const contentArea = this.element.querySelector('.container-content-area');
            if (contentArea && widget.element.parentNode === contentArea) {
                contentArea.removeChild(widget.element);
                widgetManager.workspace.appendChild(widget.element);
                
                widget.element.style.position = 'absolute';
                widget.element.classList.remove('widget--in-container');
                widget.element.querySelectorAll('.resize-handle').forEach((h) => {
                    h.style.display = '';
                    h.style.pointerEvents = '';
                });
                const restoreX = widget._originalX !== undefined ? widget._originalX : this.x + 50;
                const restoreY = widget._originalY !== undefined ? widget._originalY : this.y + this.height + 50;
                widget.setPosition(restoreX, restoreY);
                
                if (widget._originalWidth !== undefined && widget._originalHeight !== undefined) {
                    widget.setSize(widget._originalWidth, widget._originalHeight);
                }
            }
        }
        
        this.render();
    }

    /**
     * Перемещение виджета в контейнер (визуально)
     */
    moveWidgetToContainer(widget) {
        const contentArea = this.element.querySelector('.container-content-area');
        if (!contentArea) return;
        
        // Перемещаем DOM элемент виджета в контейнер
        if (widget.element && widget.element.parentNode) {
            widget.element.parentNode.removeChild(widget.element);
        }
        
        contentArea.appendChild(widget.element);
        
        widget.element.style.position = 'absolute';
        widget.element.classList.add('widget--in-container');
        widget.element.querySelectorAll('.resize-handle').forEach((h) => {
            h.style.display = 'none';
            h.style.pointerEvents = 'none';
        });
        
        // Сохраняем оригинальные координаты для восстановления при удалении
        widget._originalX = widget.x;
        widget._originalY = widget.y;
        widget._originalWidth = widget.width;
        widget._originalHeight = widget.height;
    }

    /**
     * Проверка, находится ли виджет в контейнере
     */
    isWidgetInContainer(widget, widgetManager) {
        const allWidgets = widgetManager.getAllWidgets();
        for (const w of allWidgets) {
            if (w.type === 'container' && w.id !== this.id) {
                if (w.containedWidgets && w.containedWidgets.includes(widget.id)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Переключение активной вкладки
     */
    setActiveTab(widgetId) {
        const g = this.tabGroups?.find((row) => row.includes(widgetId));
        if (!g || !g.length) return;
        this.activeTabId = g[0];
            
            // Если контент скрыт, открываем его при клике на вкладку
            if (this.contentCollapsed) {
                const contentArea = this.element.querySelector('.container-content-area');
                const closeButton = contentArea?.querySelector('.container-close-button');
                if (contentArea) {
                    this.expandContent(contentArea);
                    this._contentOpenedByClick = true; // Помечаем, что контент был открыт пользователем
                    // Показываем кнопку закрытия
                    if (closeButton) {
                        closeButton.style.display = 'flex';
                        // Убеждаемся, что кнопка кликабельна в режиме просмотра
                        if (this._resolveMode() === 'viewer') {
                            closeButton.style.pointerEvents = 'auto';
                        }
                    }
                    // Размеры виджетов обновляются автоматически в expandContent
                }
            }
            
        this.render();
    }

    /**
     * Рендеринг контейнера с вкладками
     */
    render() {
        const mode = this._resolveMode();

        // Убеждаемся, что tabStyles инициализирован
        if (!this.tabStyles) {
            this.tabStyles = {
                activeBackground: 'rgba(0, 224, 255, 0.2)',
                inactiveBackground: 'rgba(255, 255, 255, 0.05)',
                activeColor: '#00E0FF',
                inactiveColor: '#B0B3B8',
                borderColor: 'rgba(0, 224, 255, 0.3)'
            };
        }
        
        if (!this.headerHeight) {
            this.headerHeight = 40;
        }
        
        const content = this.element.querySelector('.widget-content');
        if (!content) return;
        
        const header = content.querySelector('.container-header');
        const contentArea = content.querySelector('.container-content-area');
        
        if (!header || !contentArea) return;
        
        // Убеждаемся, что header кликабелен в режиме просмотра
        if (mode === 'viewer') {
            header.style.pointerEvents = 'auto';
            
            // Также разрешаем клики по кнопке закрытия контента
            const closeButton = contentArea.querySelector('.container-close-button');
            if (closeButton) {
                closeButton.style.pointerEvents = 'auto';
            }
        }
        
        // Очищаем header
        header.innerHTML = '';
        
        // Создаем вкладки (по одной на группу виджетов)
        (this.tabGroups || []).forEach((group) => {
            const ids = (group || []).filter((id) => this.widgetReferences.has(id));
            if (!ids.length) return;
            const primaryId = ids[0];
            const widget = this.widgetReferences.get(primaryId);
            if (!widget) return;
            
            const tab = document.createElement('div');
            tab.className = 'container-tab';
            tab.dataset.widgetId = primaryId;
            
            // Активна ли вкладка и виден ли контент
            const isContentVisible = !this.contentCollapsed || this._contentOpenedByClick;
            const isActive = ids.includes(this.activeTabId) && isContentVisible;
            
            const tabName = this.getTabLabelForGroup(ids);
            
            // Определяем стили вкладки в зависимости от расположения
            const isVertical = this.tabPosition === 'top' || this.tabPosition === 'bottom';
            let tabStyles = '';
            
            // Вычисляем адаптивный размер шрифта в зависимости от длины текста
            const textLength = tabName.length;
            let fontSize = 12;
            if (textLength > 25) {
                fontSize = 10;
            } else if (textLength > 20) {
                fontSize = 11;
            }
            
            if (isVertical) {
                // Горизонтальные вкладки (сверху/снизу)
                const borderSide = this.tabPosition === 'top' ? 'bottom' : 'top';
                const borderRadius = this.tabPosition === 'top' ? '6px 6px 0 0' : '0 0 6px 6px';
                tabStyles = `
                    padding: 6px 12px;
                    cursor: pointer;
                    border-radius: ${borderRadius};
                    background: ${isActive ? this.tabStyles.activeBackground : this.tabStyles.inactiveBackground};
                    color: ${isActive ? this.tabStyles.activeColor : this.tabStyles.inactiveColor};
                    font-size: ${fontSize}px;
                    font-weight: ${isActive ? '600' : '400'};
                    white-space: normal;
                    word-wrap: break-word;
                    word-break: break-word;
                    transition: all 0.2s ease;
                    user-select: none;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    line-height: 1.3;
                    max-width: 100%;
                `;
            } else {
                // Боковые вкладки (слева/справа) - текст остается горизонтальным
                const borderSide = this.tabPosition === 'left' ? 'right' : 'left';
                const borderRadius = this.tabPosition === 'left' ? '6px 0 0 6px' : '0 6px 6px 0';
                tabStyles = `
                    padding: 6px 8px;
                    cursor: pointer;
                    border-radius: ${borderRadius};
                    background: ${isActive ? this.tabStyles.activeBackground : this.tabStyles.inactiveBackground};
                    color: ${isActive ? this.tabStyles.activeColor : this.tabStyles.inactiveColor};
                    font-size: ${fontSize}px;
                    font-weight: ${isActive ? '600' : '400'};
                    white-space: normal;
                    word-wrap: break-word;
                    word-break: break-word;
                    transition: all 0.2s ease;
                    user-select: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 40px;
                    width: 100%;
                    text-align: center;
                    line-height: 1.3;
                `;
            }
            
            tab.style.cssText = tabStyles;
            
            // Устанавливаем border отдельно, так как нельзя использовать шаблонные строки в CSS
            const borderSide = isVertical 
                ? (this.tabPosition === 'top' ? 'bottom' : 'top')
                : (this.tabPosition === 'left' ? 'right' : 'left');
            const borderValue = isActive ? `2px solid ${this.tabStyles.activeColor}` : 'transparent';
            tab.style[`border${borderSide.charAt(0).toUpperCase() + borderSide.slice(1)}`] = borderValue;
            
            const tabLabel = document.createElement('span');
            tabLabel.textContent = tabName;
            tabLabel.style.cssText = `
                word-wrap: break-word;
                word-break: break-word;
                overflow-wrap: break-word;
                line-height: 1.3;
            `;
            tab.appendChild(tabLabel);
            
            // Кнопка удаления (только в режиме редактора)
            let closeBtn = null;
            if (mode === 'editor') {
                closeBtn = document.createElement('span');
                closeBtn.innerHTML = '×';
                closeBtn.style.cssText = `
                    cursor: pointer;
                    font-size: 18px;
                    line-height: 1;
                    opacity: 0.6;
                    transition: opacity 0.2s ease;
                    padding: 0 4px;
                `;
                closeBtn.addEventListener('mouseenter', () => {
                    closeBtn.style.opacity = '1';
                });
                closeBtn.addEventListener('mouseleave', () => {
                    closeBtn.style.opacity = '0.6';
                });
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // Удаляем виджет из контейнера
                    // Нужно получить доступ к widgetManager через событие
                    const event = new CustomEvent('container:remove-widget', {
                        detail: { containerId: this.id, widgetId: primaryId }
                    });
                    document.dispatchEvent(event);
                });
                tab.appendChild(closeBtn);
            }
            
            // Убеждаемся, что вкладка кликабельна в режиме просмотра
            if (mode === 'viewer') {
                tab.style.pointerEvents = 'auto';
            }
            
            // Обработчик клика на вкладку
            tab.addEventListener('click', (e) => {
                // Если есть кнопка удаления и клик по ней - не переключаем вкладку
                if (closeBtn && (e.target === closeBtn || closeBtn.contains(e.target))) {
                    return;
                }
                e.stopPropagation();
                e.preventDefault();
                this.setActiveTab(primaryId);
            });
            
            // Также обрабатываем mousedown для надежности
            tab.addEventListener('mousedown', (e) => {
                // Если есть кнопка удаления и клик по ней - не переключаем вкладку
                if (closeBtn && (e.target === closeBtn || closeBtn.contains(e.target))) {
                    return;
                }
                e.stopPropagation();
                // Не вызываем preventDefault, чтобы не блокировать другие обработчики
            });
            
            header.appendChild(tab);
        });
        
        // Применяем состояние видимости контента
        // contentArea уже объявлена выше в методе
        const closeButton = contentArea.querySelector('.container-close-button');
        
        if (this.contentCollapsed) {
            // Если контент должен быть скрыт по умолчанию
            // Но если контент был открыт пользователем через клик на вкладку, оставляем его открытым
            if (!this._contentOpenedByClick) {
                this.collapseContent(contentArea);
                if (closeButton) closeButton.style.display = 'none';
            } else {
                // Контент был открыт пользователем, оставляем его открытым и показываем кнопку закрытия
                this.expandContent(contentArea);
                if (closeButton) closeButton.style.display = 'flex';
            }
        } else {
            // Если контент должен быть виден, показываем его и скрываем кнопку закрытия
            this.expandContent(contentArea);
            if (closeButton) closeButton.style.display = 'none';
            this._contentOpenedByClick = false; // Сбрасываем флаг, так как контент всегда виден
        }
        
        // Показываем/скрываем виджеты в зависимости от активной вкладки
        const activeIds = new Set(this.getActiveTabWidgetIds());
        /** @type {import('../core/WidgetBase.js').WidgetBase[]} */
        const becomeActive = [];
        this.containedWidgets.forEach(widgetId => {
            const widget = this.widgetReferences.get(widgetId);
            if (!widget || !widget.element) return;
            
            const isActive = activeIds.has(widgetId);
            const wasHidden = widget.element.style.display === 'none';
            widget.element.style.display = isActive ? 'block' : 'none';
            widget.element.style.zIndex = isActive ? 10 : 1;
            // Canvas-кнопка могла нарисоваться в 0×0, пока была display:none
            if (isActive && wasHidden) becomeActive.push(widget);
        });
        this.layoutActiveTabWidgets();
        // Второй проход после paint: clientHeight content-area уже без title/tabs
        this._scheduleContainedLayout();
        if (becomeActive.length) {
            requestAnimationFrame(() => {
                becomeActive.forEach((widget) => {
                    if (typeof widget.update === 'function') widget.update();
                    else if (typeof widget.render === 'function') widget.render();
                });
            });
        }
        
        const emptyPh = contentArea.querySelector('.container-empty-placeholder');
        if (emptyPh) {
            if (this.containedWidgets.length === 0) {
                emptyPh.style.display = 'flex';
            } else {
                emptyPh.style.display = 'none';
            }
        }
    }

    /**
     * Обновление размеров контейнера
     */
    setSize(width, height) {
        // Если контент не скрыт, обновляем сохраненные исходные размеры
        if (!this.contentCollapsed || this._contentOpenedByClick) {
            this._originalWidth = width;
            this._originalHeight = height;
        }
        
        super.setSize(width, height);
        
        this.render();
    }

    /**
     * Обновление позиции контейнера
     */
    setPosition(x, y) {
        super.setPosition(x, y);
        this.layoutActiveTabWidgets();
    }

    /**
     * Проверка, содержит ли контейнер точку (для drag & drop)
     */
    containsPoint(x, y) {
        // В свёрнутом виде высота шкафа = header: «контент» по старым формулам давал нулевую полосу — дроп не срабатывал.
        if (this.contentCollapsed && !this._contentOpenedByClick) {
            return x >= this.x && x <= this.x + this.width &&
                   y >= this.y && y <= this.y + this.height;
        }

        // Проверяем только область контента (без header)
        const isVertical = this.tabPosition === 'top' || this.tabPosition === 'bottom';
        
        if (isVertical) {
            const titleReserve = this._estimateTitleReservePx();
            const { headerH } = this._measureTabHeaderSize();
            const headerOffset = this.tabPosition === 'top' ? headerH + titleReserve : titleReserve;
            const contentStartY = this.y + headerOffset;
            const contentEndY = this.tabPosition === 'top'
                ? this.y + this.height
                : this.y + this.height - headerH;
            return x >= this.x && x <= this.x + this.width &&
                   y >= contentStartY && y <= contentEndY;
        } else {
            const { headerW } = this._measureTabHeaderSize();
            const titleReserve = this._estimateTitleReservePx();
            const headerOffset = this.tabPosition === 'left' ? headerW : 0;
            const contentStartX = this.x + headerOffset;
            const contentEndX = this.tabPosition === 'left'
                ? this.x + this.width
                : this.x + this.width - headerW;
            return x >= contentStartX && x <= contentEndX &&
                   y >= this.y + titleReserve && y <= this.y + this.height;
        }
    }

    /**
     * Обновление настроек контейнера
     */
    updateSettings(newSettings) {
        if (
            newSettings.showTitle !== undefined
            || newSettings.title !== undefined
            || newSettings.titleSize !== undefined
            || newSettings.titleColor !== undefined
        ) {
            this.settings = this.settings || {};
            if (newSettings.showTitle !== undefined) this.settings.showTitle = !!newSettings.showTitle;
            if (newSettings.title !== undefined) this.settings.title = newSettings.title;
            if (newSettings.titleSize !== undefined) this.settings.titleSize = newSettings.titleSize;
            if (newSettings.titleColor !== undefined) this.settings.titleColor = newSettings.titleColor;
            normalizeWidgetTitleSettings(this.settings, {
                defaultTitle: 'Шкаф',
                defaultShow: false,
            });
            this._syncContainerTitleHeading();
        }

        if (newSettings.slotsPerTab !== undefined) {
            this.settings = this.settings || {};
            let n = parseInt(newSettings.slotsPerTab, 10);
            if (!Number.isFinite(n)) n = 1;
            n = Math.min(4, Math.max(1, n));
            this.settings.slotsPerTab = n;
            this.ensureTabGroups();
            this.render();
        }

        // Обновляем состояние видимости контента
        if (newSettings.contentCollapsed !== undefined) {
            this.contentCollapsed = newSettings.contentCollapsed;
            // Сбрасываем флаг открытия через клик при изменении настройки
            this._contentOpenedByClick = false;
            const contentArea = this.element?.querySelector('.container-content-area');
            const closeButton = contentArea?.querySelector('.container-close-button');
            if (contentArea) {
                if (this.contentCollapsed) {
                    this.collapseContent(contentArea);
                    if (closeButton) closeButton.style.display = 'none';
                } else {
                    this.expandContent(contentArea);
                    if (closeButton) closeButton.style.display = 'none';
                }
            }
            // Перерисовываем для применения изменений
            this.render();
        }
        
        if (newSettings.tabPosition && newSettings.tabPosition !== this.tabPosition) {
            const oldTabPosition = this.tabPosition;
            this.tabPosition = newSettings.tabPosition;
            
            // Обновляем структуру без полного пересоздания
            const content = this.element.querySelector('.widget-content');
            if (!content) return;

            let body = content.querySelector('.container-body');
            const header = content.querySelector('.container-header');
            const contentArea = content.querySelector('.container-content-area');
            
            if (!header || !contentArea) {
                // Если элементов нет, пересоздаем структуру
                this.createElement();
                this.render();
                return;
            }

            if (!body) {
                body = document.createElement('div');
                body.className = 'container-body';
                body.style.cssText = 'flex:1;min-height:0;min-width:0;display:flex;overflow:hidden;';
                content.style.flexDirection = 'column';
                // Move existing header/content into body if they were direct children
                if (header.parentNode === content) content.removeChild(header);
                if (contentArea.parentNode === content) content.removeChild(contentArea);
                body.appendChild(header);
                body.appendChild(contentArea);
                content.appendChild(body);
            }
            
            // Сохраняем виджеты из старого contentArea
            const widgetsToMove = [];
            this.containedWidgets.forEach(widgetId => {
                const widget = this.widgetReferences.get(widgetId);
                if (widget && widget.element && widget.element.parentNode === contentArea) {
                    widgetsToMove.push({ widget, element: widget.element });
                }
            });
            
            // Определяем новое расположение
            const isVertical = this.tabPosition === 'top' || this.tabPosition === 'bottom';
            const wasVertical = oldTabPosition === 'top' || oldTabPosition === 'bottom';
            
            // Полностью очищаем и пересоздаем структуру для надежности
            // Удаляем все дочерние элементы из body (не content — сохраняем заголовок)
            while (body.firstChild) {
                body.removeChild(body.firstChild);
            }
            
            // Пересоздаем header с правильными стилями
            const newHeader = document.createElement('div');
            newHeader.className = 'container-header';
            
            if (isVertical) {
                const borderSide = this.tabPosition === 'top' ? 'bottom' : 'top';
                newHeader.style.cssText = `
                    min-height: ${this.headerHeight}px;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    background: rgba(20, 20, 30, 0.5);
                    padding: 4px 8px;
                    gap: 4px;
                    overflow-x: visible;
                    overflow-y: visible;
                    flex-shrink: 0;
                    flex-wrap: wrap;
                `;
                newHeader.style[`border${borderSide.charAt(0).toUpperCase() + borderSide.slice(1)}`] = `1px solid ${this.tabStyles.borderColor}`;
                body.style.flexDirection = this.tabPosition === 'top' ? 'column' : 'column-reverse';
            } else {
                const borderSide = this.tabPosition === 'left' ? 'right' : 'left';
                newHeader.style.cssText = `
                    width: ${this.headerWidth}px;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    background: rgba(20, 20, 30, 0.5);
                    padding: 4px 8px;
                    gap: 4px;
                    overflow-x: visible;
                    overflow-y: visible;
                    flex-shrink: 0;
                `;
                newHeader.style[`border${borderSide.charAt(0).toUpperCase() + borderSide.slice(1)}`] = `1px solid ${this.tabStyles.borderColor}`;
                body.style.flexDirection = this.tabPosition === 'left' ? 'row' : 'row-reverse';
            }
            
            // Пересоздаем contentArea
            const newContentArea = document.createElement('div');
            newContentArea.className = 'container-content-area';
            newContentArea.style.cssText = `
                flex: 1;
                position: relative;
                overflow: hidden;
                background: transparent;
                transition: transform 0.3s ease-out, opacity 0.3s ease-out;
            `;
            
            // Создаем кнопку закрытия для нового contentArea
            const closeButton = this.createCloseButton(newContentArea);
            newContentArea.appendChild(closeButton);
            this._appendContainerOverlayNodes(newContentArea);
            
            // Перемещаем виджеты в новый contentArea
            widgetsToMove.forEach(({ element }) => {
                if (element && element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                newContentArea.appendChild(element);
            });
            
            // Применяем состояние видимости контента
            if (this.contentCollapsed) {
                if (!this._contentOpenedByClick) {
                    // Сохраняем исходные размеры перед скрытием, если они еще не сохранены
                    if (this._originalWidth === undefined || this._originalWidth === null) {
                        this._originalWidth = this.width;
                        this._originalHeight = this.height;
                    }
                    // Устанавливаем размер для скрытого состояния с учетом нового tabPosition
                    if (isVertical) {
                        if (this.height !== this.headerHeight) {
                            super.setSize(this.width, this.headerHeight);
                        }
                    } else {
                        if (this.width !== this.headerWidth) {
                            super.setSize(this.headerWidth, this.height);
                        }
                    }
                    this.collapseContent(newContentArea);
                    closeButton.style.display = 'none';
                } else {
                    this.expandContent(newContentArea);
                    closeButton.style.display = 'flex';
                }
            } else {
                this.expandContent(newContentArea);
                closeButton.style.display = 'none';
            }
            
            // Устанавливаем flexDirection на body; content всегда column (заголовок сверху)
            content.style.flexDirection = 'column';
            if (isVertical) {
                body.style.flexDirection = this.tabPosition === 'top' ? 'column' : 'column-reverse';
            } else {
                body.style.flexDirection = this.tabPosition === 'left' ? 'row' : 'row-reverse';
            }
            
            body.appendChild(newHeader);
            body.appendChild(newContentArea);
            this._syncContainerTitleHeading();
            this._ensureRootDropHint();

            // Перерисовываем header и раскладку внутренних виджетов
            this.render();
        }
    }

    _syncContainerTitleHeading() {
        const content = this.element?.querySelector('.widget-content');
        if (!content) return;
        content.querySelectorAll('.container-widget-heading').forEach((el) => el.remove());
        this.settings = this.settings || {};
        normalizeWidgetTitleSettings(this.settings, {
            defaultTitle: 'Шкаф',
            defaultShow: false,
        });
        const titleEl = createDashWidgetHeadingElement(this.settings);
        if (titleEl) {
            titleEl.classList.add('container-widget-heading');
            titleEl.style.flexShrink = '0';
            const body = content.querySelector('.container-body');
            if (body) content.insertBefore(titleEl, body);
            else content.insertBefore(titleEl, content.firstChild);
        }
        // После появления/скрытия заголовка пересчитать размер вложенных виджетов
        this._scheduleContainedLayout();
    }
    
    /**
     * Сериализация в JSON
     */
    toJSON() {
        this.syncContainedWidgetsFromTabGroups();
        return {
            ...super.toJSON(),
            containedWidgets: this.containedWidgets,
            activeTabId: this.activeTabId,
            settings: {
                ...this.settings,
                tabPosition: this.tabPosition,
                contentCollapsed: this.contentCollapsed,
                slotsPerTab: this.getSlotsPerTab(),
                containerTabGroups: (this.tabGroups || []).map((row) => [...row]),
                tabLabels: { ...(this.settings?.tabLabels || {}) },
            }
        };
    }

    /**
     * Десериализация из JSON
     */
    fromJSON(json) {
        super.fromJSON(json);
        if (json.containedWidgets) {
            this.containedWidgets = json.containedWidgets;
        }
        if (json.activeTabId) {
            this.activeTabId = json.activeTabId;
        }
        // Сохраняем старое значение tabPosition
        const oldTabPosition = this.tabPosition;
        if (json.settings && json.settings.tabPosition) {
            this.tabPosition = json.settings.tabPosition;
        }
        // Восстанавливаем состояние видимости контента
        if (json.settings && json.settings.contentCollapsed !== undefined) {
            this.contentCollapsed = json.settings.contentCollapsed;
        }
        // Инициализируем contentPadding, если его нет
        if (this.contentPadding === undefined) {
            this.contentPadding = 8;
        }

        this.ensureTabGroups();

        // Если tabPosition изменился, пересоздаем структуру
        if (oldTabPosition !== this.tabPosition && this.element) {
            // Сохраняем виджеты из contentArea перед пересозданием
            const contentArea = this.element.querySelector('.container-content-area');
            const widgetsToRestore = [];
            if (contentArea) {
                this.containedWidgets.forEach(widgetId => {
                    const widget = this.widgetReferences.get(widgetId);
                    if (widget && widget.element && widget.element.parentNode === contentArea) {
                        widgetsToRestore.push({ widget, element: widget.element });
                    }
                });
            }
            
            // Пересоздаем структуру
            this.createElement();
            
            // Восстанавливаем виджеты в новый contentArea
            const newContentArea = this.element.querySelector('.container-content-area');
            if (newContentArea) {
                widgetsToRestore.forEach(({ element }) => {
                    if (element && element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                    newContentArea.appendChild(element);
                });
            }
        }
        
        this.render();
    }

    /**
     * Удаление контейнера
     */
    destroy() {
        // Отписываемся от событий
        if (this.modeUnsubscribe) {
            this.modeUnsubscribe();
        }
        
        // Возвращаем все виджеты в основной workspace перед удалением
        const widgetsToReturn = [];
        this.containedWidgets.forEach(widgetId => {
            const widget = this.widgetReferences.get(widgetId);
            if (widget) {
                widgetsToReturn.push(widget);
            }
        });
        
        // Удаляем виджеты из контейнера
        this.containedWidgets = [];
        this.widgetReferences.clear();
        
        // Удаляем сам контейнер
        super.destroy();
        
        // Возвращаем виджеты в workspace (если есть доступ к widgetManager)
        // Это будет обработано в WidgetManager при удалении
        return widgetsToReturn;
    }
}

