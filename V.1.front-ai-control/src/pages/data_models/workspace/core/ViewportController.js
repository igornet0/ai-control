import { eventBus } from './EventBus.js';

/**
 * ViewportController - Управление viewport и workspace
 * Обрабатывает zoom и pan
 */
export class ViewportController {
    constructor(viewportElement, workspaceElement) {
        this.viewport = viewportElement;
        this.workspace = workspaceElement;
        
        // Состояние viewport
        this.zoom = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Состояние pan
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panStartOffsetX = 0;
        this.panStartOffsetY = 0;
        
        // Минимальный и максимальный zoom
        this.minZoom = 0.1;
        this.maxZoom = 3.0;
        
        this.init();
    }

    init() {
                
        // Обработка колеса мыши для zoom
        this.viewport.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Обработка pan (Space + drag или средняя кнопка мыши)
        this.viewport.addEventListener('mousedown', (e) => {
                        this.handleMouseDown(e);
        });
        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                            }
            this.handleMouseMove(e);
        });
        document.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                            }
            this.handleMouseUp(e);
        });
        
        // Обработка клавиши Space
        this.spacePressed = false;
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                this.spacePressed = true;
                this.updateCursor();
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                this.updateCursor();
            }
        });
        
        // Применяем начальное состояние
        this.updateTransform();
    }

    /**
     * Обработка колеса мыши для zoom
     */
    handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + delta));
        
                
        if (newZoom !== this.zoom) {
            // Zoom относительно позиции мыши
            const rect = this.viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Координаты мыши в workspace до zoom
            const workspaceX = (mouseX - this.offsetX) / this.zoom;
            const workspaceY = (mouseY - this.offsetY) / this.zoom;
            
            // Применяем новый zoom
            this.zoom = newZoom;
            
            // Корректируем offset, чтобы точка под курсором осталась на месте
            this.offsetX = mouseX - workspaceX * this.zoom;
            this.offsetY = mouseY - workspaceY * this.zoom;
            
            this.updateTransform();
            // Эмитим событие с явным указанием zoom для надежности
            // Используем более точное округление для лучшей синхронизации
            const zoomToEmit = parseFloat(this.zoom.toFixed(3)); // Округляем до 3 знаков для лучшей точности
                        eventBus.emit('viewport:zoom', { zoom: zoomToEmit });
                    } else {
                    }
    }

    /**
     * Обработка начала pan
     */
    handleMouseDown(e) {
                
        // Pan при средней кнопке мыши или зажатом Space + ЛКМ
        if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
                        e.preventDefault();
            this.startPan(e);
            return;
        }
        
        // Pan при ЛКМ на пустом месте (не на виджете и не на handle)
        if (e.button === 0) {
            const target = e.target;
            // Проверяем, что клик не по виджету или его элементам
            const isWidget = target.closest('.widget');
            const isResizeHandle = target.closest('.resize-handle');
            const isConnectionHandle = target.closest('.connection-handle');
            
                        
            // Если клик по пустому месту - начинаем pan
            if (!isWidget && !isResizeHandle && !isConnectionHandle) {
                                e.preventDefault();
                this.startPan(e);
            } else {
                            }
        }
    }
    
    /**
     * Начало pan операции
     */
    startPan(e) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panStartOffsetX = this.offsetX;
        this.panStartOffsetY = this.offsetY;
        this.workspace.classList.add('panning');
        this.updateCursor();
    }

    /**
     * Обработка перемещения мыши при pan
     */
    handleMouseMove(e) {
        if (this.isPanning) {
            const deltaX = e.clientX - this.panStartX;
            const deltaY = e.clientY - this.panStartY;
            
            this.offsetX = this.panStartOffsetX + deltaX;
            this.offsetY = this.panStartOffsetY + deltaY;
            
            this.updateTransform();
            eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
        }
    }

    /**
     * Обработка окончания pan
     */
    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.workspace.classList.remove('panning');
            this.updateCursor();
        }
    }

    /**
     * Обновление курсора в зависимости от состояния
     */
    updateCursor() {
        if (this.isPanning) {
            this.viewport.style.cursor = 'grabbing';
            this.workspace.style.cursor = 'grabbing';
        } else if (this.spacePressed) {
            this.viewport.style.cursor = 'grab';
            this.workspace.style.cursor = 'grab';
        } else {
            this.viewport.style.cursor = 'default';
            this.workspace.style.cursor = 'default';
        }
    }

    /**
     * Применение transform к workspace
     */
    updateTransform() {
        this.workspace.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.zoom})`;
    }

    /**
     * Установка zoom программно
     * @param {number} zoom - Новое значение zoom
     */
    setZoom(zoom) {
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        if (Math.abs(newZoom - this.zoom) > 0.001) { // Используем сравнение с погрешностью для чисел с плавающей точкой
            this.zoom = newZoom;
            this.updateTransform();
            // Эмитим событие с явным указанием zoom для надежности
            // Используем более точное округление для лучшей синхронизации
            const zoomToEmit = parseFloat(this.zoom.toFixed(3)); // Округляем до 3 знаков для лучшей точности
                        eventBus.emit('viewport:zoom', { zoom: zoomToEmit });
        }
    }

    /**
     * Установка offset программно
     * @param {number} x - Новый offsetX
     * @param {number} y - Новый offsetY
     */
    setOffset(x, y) {
        this.offsetX = x;
        this.offsetY = y;
        this.updateTransform();
        eventBus.emit('viewport:pan', { offsetX: this.offsetX, offsetY: this.offsetY });
    }

    /**
     * Преобразование координат viewport → workspace
     * @param {number} viewportX - X координата в viewport
     * @param {number} viewportY - Y координата в viewport
     * @returns {{x: number, y: number}} Координаты в workspace
     */
    viewportToWorkspace(viewportX, viewportY) {
        return {
            x: (viewportX - this.offsetX) / this.zoom,
            y: (viewportY - this.offsetY) / this.zoom
        };
    }

    /**
     * Преобразование координат workspace → viewport
     * @param {number} workspaceX - X координата в workspace
     * @param {number} workspaceY - Y координата в workspace
     * @returns {{x: number, y: number}} Координаты в viewport
     */
    workspaceToViewport(workspaceX, workspaceY) {
        return {
            x: workspaceX * this.zoom + this.offsetX,
            y: workspaceY * this.zoom + this.offsetY
        };
    }

    /**
     * Получить текущее состояние
     */
    getState() {
        return {
            zoom: this.zoom,
            offsetX: this.offsetX,
            offsetY: this.offsetY
        };
    }

    /**
     * Восстановить состояние
     */
    setState(state) {
        const newZoom = state.zoom || 1.0;
        this.zoom = newZoom;
        this.offsetX = state.offsetX || 0;
        this.offsetY = state.offsetY || 0;
        this.updateTransform();
        // Эмитим событие для синхронизации UI
        const zoomToEmit = parseFloat(this.zoom.toFixed(3));
        eventBus.emit('viewport:zoom', { zoom: zoomToEmit });
    }
}
