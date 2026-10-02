import { eventBus } from './EventBus.js';
import { WidgetBase } from './WidgetBase.js';
import {
    LONG_PRESS_MS,
    VIEWPORT_INTERACTIVE_SELECTOR,
    isTouchLikePointer,
    pointerMovedBeyondTolerance,
} from './viewportTouchGestures.js';

/**
 * WidgetManager - Управление виджетами на workspace
 * Обрабатывает добавление, удаление, перемещение, изменение размера
 */
export class WidgetManager {
    constructor(workspaceElement, viewportController, engine = null) {
        this.workspace = workspaceElement;
        this.viewportController = viewportController;
        this.engine = engine; // Ссылка на engine для проверки режима
        this.widgets = new Map();
        
        // Состояние для drag & drop
        this.dragging = false;
        this.dragWidget = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartWidgetX = 0;
        this.dragStartWidgetY = 0;
        
        // Состояние для resize
        this.resizing = false;
        this.resizeWidget = null;
        this.resizeDirection = null;
        this.resizeStartX = 0;
        this.resizeStartY = 0;
        this.resizeStartWidth = 0;
        this.resizeStartHeight = 0;
        this.resizeStartWidgetX = 0;
        this.resizeStartWidgetY = 0;
        
        // Выделенные виджеты
        this.selectedWidgets = new Set();

        /** Shift+ЛКМ: рамка выделения { x1, y1 } в workspace-координатах */
        this.marqueeOrigin = null;
        /** ЛКМ зажата во время рамки */
        this.marqueePointerDown = false;
        /** @type {HTMLDivElement|null} */
        this._marqueeEl = null;
        /** Групповой drag: Map<widgetId, {x,y}> */
        this.dragGroupStarts = null;

        /** @type {{ widget: WidgetBase, x: number, y: number, pointerId: number } | null} */
        this._pendingLongPress = null;
        /** @type {ReturnType<typeof setTimeout> | null} */
        this._longPressTimer = null;
        this._activePointerId = null;
        /** @type {Element | null} */
        this._activePointerEl = null;
        
        // Snap к сетке
        this.snapToGrid = true;
        this.gridSize = 20;
        
        // Границы workspace (из CSS: width: 20000px, height: 20000px)
        this.workspaceBounds = {
            minX: 0,
            minY: 0,
            maxX: 20000,
            maxY: 20000
        };
        
        this.init();
    }
    
    /**
     * Получить границы workspace
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
     */
    getWorkspaceBounds() {
        // Доска в main.css — 20000×20000. Пока CSS не применился, getComputedStyle
        // часто даёт ~viewport; clamp тогда схлопывает виджеты в (0,0).
        const DEFAULT_BOARD = 20000;
        const MIN_TRUSTED = 5000;
        let width = DEFAULT_BOARD;
        let height = DEFAULT_BOARD;
        try {
            const computedStyle = window.getComputedStyle(this.workspace);
            const cw = parseFloat(computedStyle.width);
            const ch = parseFloat(computedStyle.height);
            if (Number.isFinite(cw) && cw >= MIN_TRUSTED) width = cw;
            if (Number.isFinite(ch) && ch >= MIN_TRUSTED) height = ch;
        } catch {
            /* keep defaults */
        }

        return {
            minX: 0,
            minY: 0,
            maxX: width,
            maxY: height
        };
    }
    
    /**
     * Ограничить позицию виджета границами workspace
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @param {number} width - Ширина виджета
     * @param {number} height - Высота виджета
     * @returns {{x: number, y: number}} Ограниченные координаты
     */
    constrainWidgetPosition(x, y, width, height) {
        const bounds = this.getWorkspaceBounds();
        
        // Ограничиваем позицию так, чтобы виджет полностью помещался в workspace
        const constrainedX = Math.max(bounds.minX, Math.min(bounds.maxX - width, x));
        const constrainedY = Math.max(bounds.minY, Math.min(bounds.maxY - height, y));
        
        return { x: constrainedX, y: constrainedY };
    }
    
    /**
     * Ограничить размер виджета границами workspace
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @param {number} width - Ширина виджета
     * @param {number} height - Высота виджета
     * @returns {{x: number, y: number, width: number, height: number}} Ограниченные размеры и позиция
     */
    constrainWidgetSize(x, y, width, height) {
        const bounds = this.getWorkspaceBounds();
        const minSize = 50; // Минимальный размер виджета
        
        // Ограничиваем размер так, чтобы виджет не выходил за границы
        let constrainedWidth = Math.max(minSize, Math.min(bounds.maxX - x, width));
        let constrainedHeight = Math.max(minSize, Math.min(bounds.maxY - y, height));
        
        // Если виджет выходит за границы, корректируем позицию
        let constrainedX = x;
        let constrainedY = y;
        
        if (x + constrainedWidth > bounds.maxX) {
            constrainedX = bounds.maxX - constrainedWidth;
            if (constrainedX < bounds.minX) {
                constrainedX = bounds.minX;
                constrainedWidth = bounds.maxX - bounds.minX;
            }
        }
        
        if (y + constrainedHeight > bounds.maxY) {
            constrainedY = bounds.maxY - constrainedHeight;
            if (constrainedY < bounds.minY) {
                constrainedY = bounds.minY;
                constrainedHeight = bounds.maxY - bounds.minY;
            }
        }
        
        // Убеждаемся, что позиция не отрицательная
        constrainedX = Math.max(bounds.minX, constrainedX);
        constrainedY = Math.max(bounds.minY, constrainedY);
        
        return { 
            x: constrainedX, 
            y: constrainedY, 
            width: constrainedWidth, 
            height: constrainedHeight 
        };
    }

    /** Скрыть подсказку drop у всех контейнеров */
    hideAllContainerDropHints() {
        this.widgets.forEach((w) => {
            if (w.type === 'container' && typeof w.hideDropHint === 'function') {
                w.hideDropHint();
            }
        });
    }

    /**
     * Координаты курсора в системе workspace (как у viewportToWorkspace).
     * Важно: offset/zoom заданы относительно #viewport, а не .workspace — иначе pan/zoom ломают hit-test шкафа.
     * @param {MouseEvent} e
     * @returns {{ x: number, y: number }}
     */
    eventToWorkspaceCoords(e) {
        const vc = this.viewportController;
        if (!vc) {
            const rect = this.workspace.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
        const vp = vc.viewport;
        if (!vp) {
            const rect = this.workspace.getBoundingClientRect();
            return vc.viewportToWorkspace(e.clientX - rect.left, e.clientY - rect.top);
        }
        const rect = vp.getBoundingClientRect();
        return vc.viewportToWorkspace(e.clientX - rect.left, e.clientY - rect.top);
    }

    /**
     * Контейнер-шкаф, в котором лежит виджет (по плоскому containedWidgets).
     * @param {import('./WidgetBase.js').WidgetBase} widget
     * @returns {import('../widgets/ContainerWidget.js').ContainerWidget|null}
     */
    findParentContainer(widget) {
        if (!widget) return null;
        for (const w of this.widgets.values()) {
            if (w.type === 'container' && w.containedWidgets?.includes(widget.id)) {
                return w;
            }
        }
        return null;
    }

    /**
     * Ограничение размера/позиции виджета границами области контента шкафа (локальные координаты).
     */
    constrainContainedWidgetSize(container, x, y, width, height) {
        const pad = container.contentPadding || 8;
        const { width: maxW, height: maxH } = container.getAvailableSize();
        const maxX = pad + maxW;
        const maxY = pad + maxH;
        const minSize = 50;
        let nw = Math.max(minSize, width);
        let nh = Math.max(minSize, height);
        let nx = x;
        let ny = y;
        if (nx < pad) {
            nw -= pad - nx;
            nx = pad;
        }
        if (ny < pad) {
            nh -= pad - ny;
            ny = pad;
        }
        nw = Math.max(minSize, nw);
        nh = Math.max(minSize, nh);
        if (nx + nw > maxX) nw = maxX - nx;
        if (ny + nh > maxY) nh = maxY - ny;
        nw = Math.max(minSize, nw);
        nh = Math.max(minSize, nh);
        return { x: nx, y: ny, width: nw, height: nh };
    }

    init() {
        this._onWorkspacePointerDown = (e) => this.handleWorkspacePointerDown(e);
        this._onDocumentPointerMove = (e) => this.handlePointerMove(e);
        this._onDocumentPointerUp = (e) => this.handlePointerUp(e);
        this._onWorkspaceContextMenu = (e) => e.preventDefault();
        this._onKeyUp = (e) => this.handleKeyUp(e);
        this._onBusWidgetAdd = (data) => this.addWidget(data);
        this._onBusWidgetDelete = (data) => this.deleteWidget(data.id);
        this._onBusWidgetSelect = (data) => this.selectWidget(data.id);

        this.workspace.addEventListener('pointerdown', this._onWorkspacePointerDown);
        document.addEventListener('pointermove', this._onDocumentPointerMove);
        document.addEventListener('pointerup', this._onDocumentPointerUp);
        document.addEventListener('pointercancel', this._onDocumentPointerUp);
        document.addEventListener('keyup', this._onKeyUp);
        this.workspace.addEventListener('contextmenu', this._onWorkspaceContextMenu);

        this._busUnsubs = [
            eventBus.on('widget:add', this._onBusWidgetAdd),
            eventBus.on('widget:delete', this._onBusWidgetDelete),
            eventBus.on('widget:select', this._onBusWidgetSelect),
        ];
    }

    destroy() {
        this.clearMarquee();
        this.cancelPendingLongPress();
        this._releaseActivePointer();
        this.workspace?.removeEventListener('pointerdown', this._onWorkspacePointerDown);
        document.removeEventListener('pointermove', this._onDocumentPointerMove);
        document.removeEventListener('pointerup', this._onDocumentPointerUp);
        document.removeEventListener('pointercancel', this._onDocumentPointerUp);
        document.removeEventListener('keyup', this._onKeyUp);
        this.workspace?.removeEventListener('contextmenu', this._onWorkspaceContextMenu);
        if (Array.isArray(this._busUnsubs)) {
            this._busUnsubs.forEach((u) => {
                try {
                    u?.();
                } catch (_) {
                    /* ignore */
                }
            });
            this._busUnsubs = [];
        }
        this.clear();
    }

    /**
     * Обработка pointerdown на workspace
     */
    handleWorkspacePointerDown(e) {
        if (e.pointerType === 'mouse' && e.button === 1) {
            return;
        }
        if (!e.isPrimary && isTouchLikePointer(e)) {
            this.cancelPendingLongPress();
            return;
        }
        if (this.viewportController?.isPanning && !isTouchLikePointer(e)) {
            return;
        }
        if (this.viewportController?.isPinching) {
            return;
        }

        const isViewerMode = this.engine?.mode === 'viewer';
        if (isViewerMode) {
            const widgetElement = e.target.closest('.widget');
            if (!widgetElement) {
                this.deselectAll();
            }
            return;
        }

        const handle = e.target.closest('.resize-handle');
        if (handle) {
            const widgetElement = handle.closest('.widget');
            if (widgetElement) {
                const widgetId = widgetElement.dataset.widgetId;
                const widget = this.widgets.get(widgetId);
                if (widget) {
                    if (
                        this.findParentContainer(widget) ||
                        widgetElement.closest('.container-content-area')
                    ) {
                        this.selectWidget(widget.id);
                        return;
                    }
                    this.startResize(widget, handle.dataset.direction, e);
                    return;
                }
            }
        }

        const widgetElement = e.target.closest('.widget');

        if (widgetElement) {
            const containerTab = e.target.closest('.container-tab');
            const containerHeader = e.target.closest('.container-header');
            const containerTitle = e.target.closest('.container-widget-heading');
            if (containerTab || containerHeader || containerTitle) {
                if (!isTouchLikePointer(e)) {
                    e.stopPropagation();
                }
                const cabinetEl =
                    e.target.closest('.widget[data-widget-type="container"]') || widgetElement;
                const cabinet = this.widgets.get(cabinetEl?.dataset?.widgetId);
                if (!cabinet || cabinet.type !== 'container') {
                    return;
                }
                if (containerTab) {
                    this.selectWidget(cabinet.id);
                    return;
                }
                this._beginWidgetMove(cabinet, e);
                return;
            }

            const noDragSurface = e.target.closest(VIEWPORT_INTERACTIVE_SELECTOR);
            if (noDragSurface) {
                const widgetIdEarly = widgetElement.dataset.widgetId;
                const wEarly = this.widgets.get(widgetIdEarly);
                if (wEarly && !wEarly.selected) {
                    this.deselectAll();
                    this.selectWidget(wEarly.id);
                }
                return;
            }

            if (!isTouchLikePointer(e)) {
                e.stopPropagation();
            }
            const widgetId = widgetElement.dataset.widgetId;
            const widget = this.widgets.get(widgetId);

            const containerElement = widgetElement.closest('.container-content-area');
            if (containerElement) {
                if (widget) {
                    this.selectWidget(widget.id);
                }
                return;
            }

            if (widget) {
                this._beginWidgetMove(widget, e);
            }
        } else if (e.shiftKey && e.button === 0 && !isTouchLikePointer(e)) {
            e.preventDefault();
            e.stopPropagation();
            this.startMarquee(e);
        } else {
            this.clearMarquee();
            this.deselectAll();
        }
    }

    /**
     * Mouse: сразу drag. Touch/pen: tap = select, long-press = drag.
     * @param {WidgetBase} widget
     * @param {PointerEvent} e
     */
    _beginWidgetMove(widget, e) {
        if (this.engine?.mode !== 'editor') return;
        if (isTouchLikePointer(e)) {
            this.selectWidget(widget.id);
            this._scheduleLongPressDrag(widget, e);
            return;
        }
        this.startDrag(widget, e);
    }

    _scheduleLongPressDrag(widget, e) {
        this.cancelPendingLongPress();
        this._pendingLongPress = {
            widget,
            x: e.clientX,
            y: e.clientY,
            pointerId: e.pointerId,
        };
        this._longPressTimer = setTimeout(() => {
            this._longPressTimer = null;
            const pending = this._pendingLongPress;
            this._pendingLongPress = null;
            if (!pending?.widget) return;
            this.viewportController?.beginExclusiveInteraction?.();
            pending.widget.element?.classList.add('widget--touch-lift');
            const fake = {
                clientX: pending.x,
                clientY: pending.y,
                pointerId: pending.pointerId,
                pointerType: 'touch',
                preventDefault() {},
                stopPropagation() {},
                target: pending.widget.element,
            };
            this.startDrag(pending.widget, fake);
            this._captureActivePointer(pending.widget.element, pending.pointerId);
        }, LONG_PRESS_MS);
    }

    cancelPendingLongPress() {
        if (this._longPressTimer) {
            clearTimeout(this._longPressTimer);
            this._longPressTimer = null;
        }
        this._pendingLongPress = null;
    }

    _captureActivePointer(el, pointerId) {
        this._releaseActivePointer();
        if (!el || pointerId == null || !el.setPointerCapture) return;
        try {
            el.setPointerCapture(pointerId);
            this._activePointerEl = el;
            this._activePointerId = pointerId;
        } catch {
            /* ignore */
        }
    }

    _releaseActivePointer() {
        const el = this._activePointerEl;
        const id = this._activePointerId;
        this._activePointerEl = null;
        this._activePointerId = null;
        if (!el || id == null || !el.releasePointerCapture) return;
        try {
            if (el.hasPointerCapture?.(id)) {
                el.releasePointerCapture(id);
            }
        } catch {
            /* ignore */
        }
    }

    _clearTouchLift() {
        this.widgets.forEach((widget) => {
            widget?.element?.classList.remove('widget--touch-lift');
        });
    }

    handlePointerMove(e) {
        if (this._pendingLongPress && e.pointerId === this._pendingLongPress.pointerId) {
            if (
                pointerMovedBeyondTolerance(
                    { x: this._pendingLongPress.x, y: this._pendingLongPress.y },
                    { x: e.clientX, y: e.clientY },
                )
            ) {
                this.cancelPendingLongPress();
            }
        }
        if (this.viewportController?.isPinching) {
            this.cancelPendingLongPress();
            if (this.dragging || this.resizing) {
                this._abortDragResize();
            }
            return;
        }
        this.handleMouseMove(e);
    }

    handlePointerUp(e) {
        if (this._pendingLongPress && e.pointerId === this._pendingLongPress.pointerId) {
            this.cancelPendingLongPress();
        }
        if (this._activePointerId != null && e.pointerId !== this._activePointerId) {
            return;
        }
        this.handleMouseUp(e);
        this._releaseActivePointer();
        this._clearTouchLift();
        this.viewportController?.endExclusiveInteraction?.();
    }

    _abortDragResize() {
        if (this.dragging && this.dragWidget) {
            this.hideAllContainerDropHints();
            this.dragWidget.element.style.cursor = 'move';
            this.dragging = false;
            this.dragWidget = null;
        }
        if (this.resizing && this.resizeWidget) {
            this.resizeWidget._isResizing = false;
            clearTimeout(this.resizeWidget._resizeUpdateTimer);
            this.resizing = false;
            this.resizeWidget = null;
            this.resizeDirection = null;
        }
        this.dragGroupStarts = null;
        this.hoverContainer = null;
        this._clearTouchLift();
        this._releaseActivePointer();
        this.viewportController?.endExclusiveInteraction?.();
    }

    /**
     * Обработка клика на workspace
     * @deprecated use handleWorkspacePointerDown
     */
    handleWorkspaceMouseDown(e) {
        this.handleWorkspacePointerDown(e);
    }

    handleKeyUp(e) {
        if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
            // Отпустили Shift до/без зажатой ЛКМ — отмена незавершённой рамки
            if (this.marqueeOrigin && !this.marqueePointerDown) {
                this.clearMarquee();
            }
        }
    }

    /**
     * Shift+ЛКМ down: первая точка рамки. Вторая точка — при mouseup.
     * @param {MouseEvent} e
     */
    startMarquee(e) {
        if (this.engine?.mode !== 'editor') return;
        const pos = this.eventToWorkspaceCoords(e);
        this.deselectAll();
        this.marqueeOrigin = { x: pos.x, y: pos.y };
        this.marqueePointerDown = true;
        this.updateMarqueeVisual(pos.x, pos.y, pos.x, pos.y);
    }

    /**
     * Завершить рамку по отпусканию ЛКМ.
     * @param {MouseEvent} [e]
     */
    finishMarquee(e) {
        if (!this.marqueeOrigin || !this.marqueePointerDown) {
            this.marqueePointerDown = false;
            return;
        }
        const pos = e ? this.eventToWorkspaceCoords(e) : this.marqueeOrigin;
        const { x: x1, y: y1 } = this.marqueeOrigin;
        this.selectWidgetsInRect(x1, y1, pos.x, pos.y);
        this.clearMarquee();
    }

    clearMarquee() {
        this.marqueeOrigin = null;
        this.marqueePointerDown = false;
        if (this._marqueeEl) {
            this._marqueeEl.remove();
            this._marqueeEl = null;
        }
    }

    /**
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     */
    updateMarqueeVisual(x1, y1, x2, y2) {
        if (!this.workspace) return;
        if (!this._marqueeEl) {
            const el = document.createElement('div');
            el.className = 'workspace-selection-marquee';
            el.setAttribute('aria-hidden', 'true');
            this.workspace.appendChild(el);
            this._marqueeEl = el;
        }
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        const el = this._marqueeEl;
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        el.classList.toggle('workspace-selection-marquee--empty', width < 2 && height < 2);
    }

    /**
     * Выделить виджеты на доске, пересекающие прямоугольник (не внутри шкафа).
     */
    selectWidgetsInRect(x1, y1, x2, y2) {
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        this.deselectAll();
        const hits = [];
        this.widgets.forEach((widget) => {
            if (!widget || this.findParentContainer(widget)) return;
            const wl = widget.x;
            const wt = widget.y;
            const wr = widget.x + widget.width;
            const wb = widget.y + widget.height;
            const intersects = wl < right && wr > left && wt < bottom && wb > top;
            if (intersects) hits.push(widget);
        });
        hits.forEach((widget, idx) => {
            widget.select();
            this.selectedWidgets.add(widget.id);
            if (idx === 0) {
                eventBus.emit('widget:selected', { widget });
            }
        });
        if (hits.length > 1) {
            eventBus.emit('widget:multi-selected', {
                widgets: hits,
                count: hits.length,
            });
        }
    }

    /**
     * Добавить виджет к выделению без сброса остальных.
     * @param {string} widgetId
     */
    addToSelection(widgetId) {
        if (this.engine?.mode === 'viewer') return;
        const widget = this.widgets.get(widgetId);
        if (!widget) return;
        widget.select();
        this.selectedWidgets.add(widgetId);
        eventBus.emit('widget:selected', { widget });
    }

    /**
     * Начало перемещения виджета
     */
    startDrag(widget, e) {
        if (this.engine?.mode !== 'editor') return;

        e.preventDefault();
        e.stopPropagation();
        this.clearMarquee();
        this.viewportController?.beginExclusiveInteraction?.();
        
        this.dragging = true;
        this.dragWidget = widget;
        
        const workspacePos = this.eventToWorkspaceCoords(e);
        
        this.dragStartX = workspacePos.x;
        this.dragStartY = workspacePos.y;
        this.dragStartWidgetX = widget.x;
        this.dragStartWidgetY = widget.y;

        // Группа: клик по уже выделенному при нескольких выбранных
        const selected = this.getSelectedWidgets().filter((w) => !this.findParentContainer(w));
        const groupDrag = widget.selected && selected.length > 1 && selected.some((w) => w.id === widget.id);
        if (groupDrag) {
            this.dragGroupStarts = new Map();
            selected.forEach((w) => {
                this.dragGroupStarts.set(w.id, { x: w.x, y: w.y });
            });
        } else {
            this.dragGroupStarts = null;
            if (!widget.selected) {
                this.deselectAll();
                this.selectWidget(widget.id);
            }
        }
        
        widget.element.style.cursor = 'grabbing';
        if (e.pointerId != null) {
            this._captureActivePointer(widget.element, e.pointerId);
        }
        
        // Эмитим событие о начале перемещения - это сохранит начальное положение в историю
        eventBus.emit('widget:move-start', { widget, group: groupDrag });
    }

    /**
     * Начало изменения размера виджета
     */
    startResize(widget, direction, e) {
        // Проверяем режим - в режиме просмотра не разрешаем изменение размера
        if (this.engine?.mode === 'viewer') {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        this.viewportController?.beginExclusiveInteraction?.();
        
        this.resizing = true;
        this.resizeWidget = widget;
        this.resizeDirection = direction;
        
        // Устанавливаем флаг resize для виджета
        widget._isResizing = true;
        
        const workspacePos = this.eventToWorkspaceCoords(e);
        
        this.resizeStartX = workspacePos.x;
        this.resizeStartY = workspacePos.y;
        this.resizeStartWidth = widget.width;
        this.resizeStartHeight = widget.height;
        this.resizeStartWidgetX = widget.x;
        this.resizeStartWidgetY = widget.y;
        if (e.pointerId != null) {
            this._captureActivePointer(widget.element, e.pointerId);
        }
        
        // Эмитим событие о начале изменения размера - это сохранит начальное состояние в историю
        eventBus.emit('widget:resize-start', { widget });
        
        if (!widget.selected) {
            this.deselectAll();
            this.selectWidget(widget.id);
        }
    }

    /**
     * Обработка перемещения мыши
     */
    handleMouseMove(e) {
        // Если активен pan viewport, не обрабатываем drag/resize виджетов
        if (this.viewportController?.isPanning) {
            if (this.dragging) {
                this.hideAllContainerDropHints();
            }
            return;
        }
        
        // В режиме просмотра не обрабатываем перемещение и изменение размера
        if (this.engine?.mode === 'viewer') {
            if (this.dragging) {
                this.hideAllContainerDropHints();
                this.dragging = false;
                if (this.dragWidget) {
                    this.dragWidget.element.style.cursor = '';
                    this.dragWidget = null;
                }
            }
            if (this.resizing) {
                this.resizing = false;
                if (this.resizeWidget) {
                    this.resizeWidget._isResizing = false;
                    this.resizeWidget = null;
                    this.resizeDirection = null;
                }
            }
            return;
        }

        // Превью рамки, пока зажаты Shift+ЛКМ (или хотя бы ЛКМ после старта)
        if (this.marqueeOrigin && this.marqueePointerDown && !this.dragging && !this.resizing) {
            const pos = this.eventToWorkspaceCoords(e);
            this.updateMarqueeVisual(this.marqueeOrigin.x, this.marqueeOrigin.y, pos.x, pos.y);
        }

        if (this.dragging && this.dragWidget) {
            const workspacePos = this.eventToWorkspaceCoords(e);
            const deltaX = workspacePos.x - this.dragStartX;
            const deltaY = workspacePos.y - this.dragStartY;

            // Групповое перемещение
            if (this.dragGroupStarts && this.dragGroupStarts.size > 1) {
                this.hideAllContainerDropHints();
                this.hoverContainer = null;
                this.dragGroupStarts.forEach((start, id) => {
                    const w = this.widgets.get(id);
                    if (!w) return;
                    let newX = start.x + deltaX;
                    let newY = start.y + deltaY;
                    if (this.snapToGrid) {
                        newX = Math.round(newX / this.gridSize) * this.gridSize;
                        newY = Math.round(newY / this.gridSize) * this.gridSize;
                    }
                    const constrained = this.constrainWidgetPosition(newX, newY, w.width, w.height);
                    w.setPosition(constrained.x, constrained.y, this);
                });
                return;
            }
            
            let newX = this.dragStartWidgetX + deltaX;
            let newY = this.dragStartWidgetY + deltaY;
            
            // Проверяем, находится ли виджет над контейнером
            let hoverCandidate = null;
            if (this.dragWidget.type !== 'container') {
                const allWidgets = Array.from(this.widgets.values());
                for (const widget of allWidgets) {
                    if (widget.type === 'container' && widget.id !== this.dragWidget.id) {
                        // Проверяем, находится ли точка внутри контейнера (без header)
                        if (widget.containsPoint(workspacePos.x, workspacePos.y)) {
                            hoverCandidate = widget;
                            break;
                        }
                    }
                }
            }

            let hoverContainer = null;
            if (
                hoverCandidate &&
                typeof hoverCandidate.canAcceptWidget === 'function' &&
                hoverCandidate.canAcceptWidget(this.dragWidget, this)
            ) {
                hoverContainer = hoverCandidate;
            }
            
            // Визуальная обратная связь для контейнера
            this.widgets.forEach(widget => {
                if (widget.type === 'container' && widget.element) {
                    if (widget === hoverContainer) {
                        widget.element.style.border = '2px dashed rgba(0, 224, 255, 0.8)';
                    } else {
                        widget.element.style.border = '';
                    }
                }
            });

            this.widgets.forEach((widget) => {
                if (widget.type === 'container' && typeof widget.showDropHint === 'function') {
                    if (widget === hoverContainer) {
                        widget.showDropHint();
                    } else {
                        widget.hideDropHint();
                    }
                }
            });
            
            // Если виджет не в контейнере, обновляем его позицию
            if (!hoverContainer) {
                // Snap к сетке
                if (this.snapToGrid) {
                    newX = Math.round(newX / this.gridSize) * this.gridSize;
                    newY = Math.round(newY / this.gridSize) * this.gridSize;
                }
                
                // Ограничиваем позицию границами workspace
                const constrained = this.constrainWidgetPosition(
                    newX, 
                    newY, 
                    this.dragWidget.width, 
                    this.dragWidget.height
                );
                
                this.dragWidget.setPosition(constrained.x, constrained.y, this);
            }
            
            // Сохраняем информацию о контейнере для handleMouseUp
            this.hoverContainer = hoverContainer;
            
            // НЕ эмитим widget:moved во время перемещения - это промежуточное состояние
            // Сохраним только начальное (при startDrag) и конечное (при move-end) состояние
        }
        
        if (this.resizing && this.resizeWidget) {
            const workspacePos = this.eventToWorkspaceCoords(e);
            
            const deltaX = workspacePos.x - this.resizeStartX;
            const deltaY = workspacePos.y - this.resizeStartY;
            
            let newWidth = this.resizeStartWidth;
            let newHeight = this.resizeStartHeight;
            let newX = this.resizeStartWidgetX;
            let newY = this.resizeStartWidgetY;
            
            // Изменение размера в зависимости от направления
            const dir = this.resizeDirection;
            
            if (dir.includes('e')) {
                newWidth = this.resizeStartWidth + deltaX;
            }
            if (dir.includes('w')) {
                newWidth = this.resizeStartWidth - deltaX;
                newX = this.resizeStartWidgetX + deltaX;
            }
            if (dir.includes('s')) {
                newHeight = this.resizeStartHeight + deltaY;
            }
            if (dir.includes('n')) {
                newHeight = this.resizeStartHeight - deltaY;
                newY = this.resizeStartWidgetY + deltaY;
            }
            
            const parentContainer = this.findParentContainer(this.resizeWidget);
            if (parentContainer) {
                const constrained = this.constrainContainedWidgetSize(
                    parentContainer,
                    newX,
                    newY,
                    newWidth,
                    newHeight,
                );
                this.resizeWidget.setSize(constrained.width, constrained.height, null);
                this.resizeWidget.setPosition(constrained.x, constrained.y, null);
            } else {
                // Snap к сетке
                if (this.snapToGrid) {
                    newWidth = Math.round(newWidth / this.gridSize) * this.gridSize;
                    newHeight = Math.round(newHeight / this.gridSize) * this.gridSize;
                    newX = Math.round(newX / this.gridSize) * this.gridSize;
                    newY = Math.round(newY / this.gridSize) * this.gridSize;
                }
                
                // Ограничиваем размер и позицию границами workspace
                const constrained = this.constrainWidgetSize(newX, newY, newWidth, newHeight);
                
                this.resizeWidget.setSize(constrained.width, constrained.height, this);
                this.resizeWidget.setPosition(constrained.x, constrained.y, this);
            }
            // НЕ эмитим widget:resized во время изменения размера - это промежуточное состояние
            // Сохраним только начальное (при startResize) и конечное (при resize-end) состояние
        }
    }

    /**
     * Обработка отпускания мыши
     */
    handleMouseUp(e) {
        // Завершение рамки выделения по отпусканию ЛКМ
        if (this.marqueePointerDown && this.marqueeOrigin && !this.dragging && !this.resizing) {
            this.finishMarquee(e);
            return;
        }

        // Если pan активен, не обрабатываем завершение drag/resize
        if (this.viewportController?.isPanning) {
            // Сбрасываем состояния drag/resize, если они были активны
            if (this.dragging && this.dragWidget) {
                this.hideAllContainerDropHints();
                this.dragWidget.element.style.cursor = 'move';
                this.dragging = false;
                this.dragWidget = null;
            }
            if (this.resizing && this.resizeWidget) {
                this.resizeWidget._isResizing = false;
                clearTimeout(this.resizeWidget._resizeUpdateTimer);
                this.resizing = false;
                this.resizeWidget = null;
                this.resizeDirection = null;
            }
            return;
        }
        
        if (this.dragging) {
            // Если виджет был перетащен в контейнер (только одиночный drag)
            if (this.hoverContainer && this.dragWidget && !(this.dragGroupStarts && this.dragGroupStarts.size > 1)) {
                // Добавляем виджет в контейнер
                if (this.hoverContainer.addWidget && this.hoverContainer.addWidget(this.dragWidget, this)) {
                    // Виджет успешно добавлен в контейнер
                    eventBus.emit('widget:added-to-container', { 
                        widget: this.dragWidget, 
                        container: this.hoverContainer 
                    });
                }
            }
            
            // Убираем визуальную обратную связь с контейнеров
            this.hideAllContainerDropHints();
            this.widgets.forEach(widget => {
                if (widget.type === 'container' && widget.element) {
                    widget.element.style.border = '';
                }
            });
            
            this.dragging = false;
            if (this.dragWidget) {
                this.dragWidget.element.style.cursor = 'move';
                eventBus.emit('widget:move-end', {
                    widget: this.dragWidget,
                    group: Boolean(this.dragGroupStarts && this.dragGroupStarts.size > 1),
                });
            }
            this.dragWidget = null;
            this.dragGroupStarts = null;
            this.hoverContainer = null;
        }
        
        if (this.resizing) {
            this.resizing = false;
            if (this.resizeWidget) {
                // Снимаем флаг resize и обновляем содержимое
                this.resizeWidget._isResizing = false;
                clearTimeout(this.resizeWidget._resizeUpdateTimer);
                // Финальное обновление содержимого после завершения resize
                this.resizeWidget.update();
                eventBus.emit('widget:resize-end', { widget: this.resizeWidget });
            }
            this.resizeWidget = null;
            this.resizeDirection = null;
        }
    }

    /**
     * Добавление виджета
     */
    addWidget(widget) {
        if (!(widget instanceof WidgetBase)) {
            throw new Error('Widget must be an instance of WidgetBase');
        }
        
        // Ограничиваем позицию виджета границами workspace при добавлении
        const constrained = this.constrainWidgetPosition(
            widget.x, 
            widget.y, 
            widget.width, 
            widget.height
        );
        
        if (constrained.x !== widget.x || constrained.y !== widget.y) {
            widget.setPosition(constrained.x, constrained.y);
        }
        
        this.widgets.set(widget.id, widget);
        // Проверяем, что элемент еще не добавлен в DOM
        if (widget.element && widget.element.parentNode !== this.workspace) {
            this.workspace.appendChild(widget.element);
        }
        widget.render();

        if (this.engine?.applyWidgetPointerEvents) {
            this.engine.applyWidgetPointerEvents(widget, this.engine.mode || 'editor');
        }
        
        // Выделяем новый виджет
        this.deselectAll();
        this.selectWidget(widget.id);
        
        eventBus.emit('widget:added', { widget });
        
        return widget;
    }

    /**
     * Удаление виджета
     */
    deleteWidget(widgetId) {
        const widget = this.widgets.get(widgetId);
        if (widget) {
            widget.destroy();
            this.widgets.delete(widgetId);
            this.selectedWidgets.delete(widgetId);
            eventBus.emit('widget:deleted', { widgetId });
        }
    }

    /**
     * Переименовать id виджета в Map / DOM / selection (после bulk save).
     * @param {string} oldId
     * @param {string} newId
     * @returns {import('./WidgetBase.js').WidgetBase|null}
     */
    remapWidgetId(oldId, newId) {
        if (oldId == null || newId == null || oldId === newId) {
            return this.widgets.get(newId) || this.widgets.get(oldId) || null;
        }
        const widget = this.widgets.get(oldId);
        if (!widget) {
            return this.widgets.get(newId) || null;
        }
        widget.id = newId;
        if (widget.element) {
            widget.element.dataset.widgetId = newId;
        }
        this.widgets.delete(oldId);
        this.widgets.set(newId, widget);
        if (this.selectedWidgets.has(oldId)) {
            this.selectedWidgets.delete(oldId);
            this.selectedWidgets.add(newId);
        }
        return widget;
    }

    /**
     * Выделение виджета
     */
    selectWidget(widgetId) {
        if (this.engine?.mode === 'viewer') {
            return;
        }
        const widget = this.widgets.get(widgetId);
        if (widget) {
            this.deselectAll();
            widget.select();
            this.selectedWidgets.add(widgetId);
            eventBus.emit('widget:selected', { widget });
        }
    }

    /**
     * Снятие выделения со всех виджетов
     */
    deselectAll() {
        // Снимаем визуальное выделение и по selectedWidgets, и по флагу selected
        // (после remap id selectedWidgets мог устареть — иначе залипают resize-handles).
        this.widgets.forEach((widget) => {
            if (widget?.selected) {
                widget.deselect();
            }
        });
        this.selectedWidgets.clear();
        eventBus.emit('widget:deselected-all');
    }

    /**
     * Получить виджет по ID
     */
    getWidget(widgetId) {
        return this.widgets.get(widgetId);
    }

    /**
     * Получить все виджеты
     */
    getAllWidgets() {
        return Array.from(this.widgets.values());
    }

    /**
     * Получить выделенные виджеты
     */
    getSelectedWidgets() {
        return Array.from(this.selectedWidgets).map(id => this.widgets.get(id)).filter(Boolean);
    }

    /**
     * Очистить все виджеты
     */
    clear() {
        // Удаляем все виджеты из DOM и очищаем их
        this.widgets.forEach(widget => {
            if (widget && widget.element) {
                // Удаляем элемент из DOM, если он там есть
                if (widget.element.parentNode) {
                    widget.element.parentNode.removeChild(widget.element);
                }
                // Вызываем destroy для очистки виджета
                if (widget.destroy && typeof widget.destroy === 'function') {
                    widget.destroy();
                }
            }
        });
        this.widgets.clear();
        this.selectedWidgets.clear();
        
        // Убеждаемся, что workspace очищен от всех виджетов
        // Удаляем все элементы с классом 'widget' из workspace
        if (this.workspace) {
            const existingWidgets = this.workspace.querySelectorAll('.widget');
            existingWidgets.forEach(widgetElement => {
                if (widgetElement.parentNode === this.workspace) {
                    this.workspace.removeChild(widgetElement);
                }
            });
        }
    }

    /**
     * Сериализация всех виджетов
     */
    toJSON() {
        const widgets = [];
        
        // Собираем все виджеты, включая те, что внутри контейнеров
        this.widgets.forEach(widget => {
            if (widget.type === 'container') {
                // Для контейнеров добавляем сам контейнер
                widgets.push(widget.toJSON());
                
                // И все виджеты внутри него
                if (widget.containedWidgets) {
                    widget.containedWidgets.forEach(widgetId => {
                        const containedWidget = widget.widgetReferences.get(widgetId);
                        if (containedWidget) {
                            widgets.push(containedWidget.toJSON());
                        }
                    });
                }
            } else {
                // Проверяем, не находится ли виджет в контейнере
                let isInContainer = false;
                this.widgets.forEach(container => {
                    if (container.type === 'container' && container.containedWidgets) {
                        if (container.containedWidgets.includes(widget.id)) {
                            isInContainer = true;
                        }
                    }
                });
                
                // Добавляем только виджеты, которые не в контейнере
                if (!isInContainer) {
                    widgets.push(widget.toJSON());
                }
            }
        });
        
        return widgets;
    }

    /**
     * Данные для Ctrl+C: один выбранный виджет; для «шкафа» — контейнер и все вложенные (полная копия).
     * @param {import('./WidgetBase.js').WidgetBase} primaryWidget
     * @returns {{ version: number, widgets: object[] }}
     */
    buildClipboardPayload(primaryWidget) {
        const widgets = [];
        if (primaryWidget.type === 'container') {
            widgets.push(primaryWidget.toJSON());
            const order = primaryWidget.containedWidgets || [];
            for (const cid of order) {
                const child = this.widgets.get(cid);
                if (child) widgets.push(child.toJSON());
            }
        } else {
            widgets.push(primaryWidget.toJSON());
        }
        return { version: 1, widgets };
    }

    /**
     * Глубокая копия JSON виджетов с новыми id и сдвигом корневых элементов (чтобы вставка была заметна).
     * @param {object[]} widgetsJson
     * @param {number} gridSize
     * @returns {object[]}
     */
    static remapClipboardWidgetsForPaste(widgetsJson, gridSize = 20) {
        const widgets = JSON.parse(JSON.stringify(widgetsJson));
        const idMap = new Map();
        const genId = () =>
            `widget_${Date.now()}_${Math.random().toString(36).slice(2, 11)}_${Math.random().toString(36).slice(2, 9)}`;
        for (const w of widgets) {
            idMap.set(w.id, genId());
        }
        for (const w of widgets) {
            w.id = idMap.get(w.id);
            if (w.type === 'container' && Array.isArray(w.containedWidgets)) {
                w.containedWidgets = w.containedWidgets.map((oid) => idMap.get(oid));
            }
            if (w.activeTabId && idMap.has(w.activeTabId)) {
                w.activeTabId = idMap.get(w.activeTabId);
            }
            if (w.settings && Array.isArray(w.settings.containerTabGroups)) {
                w.settings.containerTabGroups = w.settings.containerTabGroups.map((row) =>
                    Array.isArray(row) ? row.map((oid) => idMap.get(oid)) : row
                );
            }
            if (w.settings?.tabLabels && typeof w.settings.tabLabels === 'object') {
                const nextLabels = {};
                Object.entries(w.settings.tabLabels).forEach(([oid, label]) => {
                    const nid = idMap.get(oid);
                    if (nid) nextLabels[nid] = label;
                });
                w.settings.tabLabels = nextLabels;
            }
        }
        const contained = new Set();
        for (const w of widgets) {
            if (w.type === 'container' && Array.isArray(w.containedWidgets)) {
                w.containedWidgets.forEach((id) => contained.add(id));
            }
        }
        const d = gridSize || 20;
        for (const w of widgets) {
            if (!contained.has(w.id)) {
                w.x = (w.x || 0) + d;
                w.y = (w.y || 0) + d;
            }
        }
        return widgets;
    }

    /**
     * Создать виджеты из JSON и вставить в текущий workspace без очистки (вставка из буфера).
     * @returns {import('./WidgetBase.js').WidgetBase[]} экземпляры корневых виджетов вставленного фрагмента
     */
    appendWidgetsFromJsonArray(jsonArray, widgetClasses) {
        this._hydrateWidgetsFromJsonArray(jsonArray, widgetClasses);
        const contained = new Set();
        for (const j of jsonArray) {
            if (j.type === 'container' && Array.isArray(j.containedWidgets)) {
                j.containedWidgets.forEach((id) => contained.add(id));
            }
        }
        return jsonArray
            .filter((j) => !contained.has(j.id))
            .map((j) => this.widgets.get(j.id))
            .filter(Boolean);
    }

    /**
     * Внутренняя гидратация: тот же конвейер, что и при fromJSON, но без clear().
     */
    _hydrateWidgetsFromJsonArray(jsonArray, widgetClasses) {
        const widgetsMap = new Map();
        const resolveId = (raw) => {
            if (raw == null || raw === '') return null;
            const s = String(raw);
            const candidates = s.startsWith('widget_')
                ? [s]
                : [s, `widget_${s}`, Number.isFinite(Number(s)) ? `widget_${Number(s)}` : null].filter(Boolean);
            for (const c of candidates) {
                if (widgetsMap.has(c)) return c;
            }
            return null;
        };
        jsonArray.forEach((json) => {
            const WidgetClass = widgetClasses[json.type];
            if (WidgetClass) {
                const ctx =
                    this.engine && typeof this.engine.getWidgetContext === 'function'
                        ? this.engine.getWidgetContext()
                        : null;
                const widget = new WidgetClass({ ...json, _ctx: ctx });
                if (ctx && !widget.ctx) widget.ctx = ctx;
                if (json.id && json.id !== widget.id) {
                    widget.id = json.id;
                    if (widget.element) {
                        widget.element.dataset.widgetId = json.id;
                    }
                }
                widgetsMap.set(widget.id, widget);
                this.widgets.set(widget.id, widget);

                const constrained = this.constrainWidgetPosition(
                    widget.x,
                    widget.y,
                    widget.width,
                    widget.height
                );

                if (constrained.x !== widget.x || constrained.y !== widget.y) {
                    widget.setPosition(constrained.x, constrained.y);
                }

                if (json.type !== 'container' || !json.containedWidgets || json.containedWidgets.length === 0) {
                    if (widget.element && widget.element.parentNode !== this.workspace) {
                        this.workspace.appendChild(widget.element);
                    }
                    widget.render();
                    if (widget.update && typeof widget.update === 'function') {
                        widget.update();
                    }
                }
            }
        });

        jsonArray.forEach((json) => {
            if (json.type === 'container' && json.containedWidgets && json.containedWidgets.length > 0) {
                const container = widgetsMap.get(json.id);
                if (container) {
                    const constrained = this.constrainWidgetPosition(
                        container.x,
                        container.y,
                        container.width,
                        container.height
                    );

                    if (constrained.x !== container.x || constrained.y !== container.y) {
                        container.setPosition(constrained.x, constrained.y);
                    }

                    if (container.element && container.element.parentNode !== this.workspace) {
                        this.workspace.appendChild(container.element);
                    }
                    container.render();
                    if (container.update && typeof container.update === 'function') {
                        container.update();
                    }

                    if (json.selected) {
                        container.select();
                        this.selectedWidgets.add(container.id);
                    }

                    json.containedWidgets.forEach((rawId) => {
                        const widgetId = resolveId(rawId);
                        const widget = widgetId ? widgetsMap.get(widgetId) : null;
                        if (widget) {
                            if (widget.element && widget.element.parentNode === this.workspace) {
                                this.workspace.removeChild(widget.element);
                            }
                            container.addWidget(widget, this);
                        }
                    });
                }
            } else if (json.type === 'container') {
                const container = widgetsMap.get(json.id);
                if (container) {
                    const constrained = this.constrainWidgetPosition(
                        container.x,
                        container.y,
                        container.width,
                        container.height
                    );

                    if (constrained.x !== container.x || constrained.y !== container.y) {
                        container.setPosition(constrained.x, constrained.y);
                    }

                    if (container.element && container.element.parentNode !== this.workspace) {
                        this.workspace.appendChild(container.element);
                    }
                    container.render();
                    if (container.update && typeof container.update === 'function') {
                        container.update();
                    }
                }
            }
        });

        if (this.engine?.applyWidgetPointerEvents) {
            const mode = this.engine.mode || 'editor';
            this.getAllWidgets().forEach((w) => {
                this.engine.applyWidgetPointerEvents(w, mode);
                if (w.type === 'container' && typeof w.render === 'function') {
                    if (typeof w._resolveMode === 'function') w._resolveMode();
                    else w.currentMode = mode;
                    w.render();
                }
            });
        }

        if (this.engine?.mode === 'viewer') {
            this.deselectAll();
        }
    }

    /**
     * Загрузка виджетов из JSON
     * @param {boolean} skipHistory - Пропустить сохранение в историю (для загрузки из БД)
     */
    fromJSON(jsonArray, widgetClasses, skipHistory = false) {
        let historyManager = null;
        if (this.engine && this.engine.historyManager) {
            historyManager = this.engine.historyManager;
            if (skipHistory) {
                historyManager.disable();
            }
        }

        try {
            this.clear();

            if (this.workspace) {
                while (this.workspace.firstChild) {
                    this.workspace.removeChild(this.workspace.firstChild);
                }
            }

            this._hydrateWidgetsFromJsonArray(jsonArray, widgetClasses);

            if (skipHistory && historyManager) {
                historyManager.enable();
            }
        } catch (error) {
            console.error('Error loading widgets from JSON:', error);
        }
    }
}

