/**
 * WidgetBase - Базовый класс для всех виджетов моделей данных
 * Содержит общую логику для позиционирования, размеров, выделения
 */
import { normalizeConnection } from '../widgetIdUtils.js';

export class WidgetBase {
    constructor(config = {}) {
        // Если передан числовой ID или строка с числом, используем его
        if (config.id !== undefined && config.id !== null) {
            if (typeof config.id === 'number') {
                this.id = String(config.id); // Преобразуем в строку для консистентности
            } else if (typeof config.id === 'string' && /^\d+$/.test(config.id)) {
                // Если строка содержит только цифры (ID из БД), используем её
                this.id = config.id;
            } else {
                // Если строка типа "widget_123", генерируем новый временный ID
                this.id = this.generateId();
            }
        } else {
            // Если ID не передан, генерируем временный
            this.id = this.generateId();
        }
        this.type = config.type || 'base';
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 300;
        this.height = config.height || 200;
        this.zIndex = config.zIndex || 1;
        this.selected = false;
        
        // DOM элемент
        this.element = null;
        
        // Настройки виджета
        this.settings = config.settings || {};
        
        // Источник данных
        this.dataSource = config.dataSource || null;
        
        // Стили виджета
        this.styles = config.styles || {};
        
        // Соединения с другими виджетами
        this.connections = config.connections || [];
        
        this.createElement();
    }

    /**
     * Генерация уникального ID
     */
    generateId() {
        return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Создание DOM элемента
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'widget';
        this.element.dataset.widgetId = this.id;
        this.element.dataset.widgetType = this.type;
        
        // Базовые футуристичные стили по умолчанию
        this.element.style.background = 'rgba(40,40,50,0.35)';
        this.element.style.backdropFilter = 'blur(14px) saturate(150%)';
        this.element.style.borderRadius = '18px';
        
        // Контейнер для содержимого виджета
        const content = document.createElement('div');
        content.className = 'widget-content';
        this.element.appendChild(content);

        this.fkWarning = null;
        this._ensureFkWarnBadge();
        
        // Handles для изменения размера
        this.createResizeHandles();
        
        // Handles для соединений
        this.createConnectionHandles();
        
        this.updatePosition();
    }

    /**
     * Создание ручек для изменения размера
     */
    createResizeHandles() {
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        handles.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${direction}`;
            handle.dataset.direction = direction;
            this.element.appendChild(handle);
        });
    }

    /**
     * Создание ручек для соединений (точки подключения)
     */
    createConnectionHandles() {
        // Входные точки (сверху)
        const inputHandle = document.createElement('div');
        inputHandle.className = 'connection-handle input-handle';
        inputHandle.dataset.type = 'input';
        inputHandle.dataset.widgetId = this.id;
        this.element.appendChild(inputHandle);
        
        // Выходные точки (снизу)
        const outputHandle = document.createElement('div');
        outputHandle.className = 'connection-handle output-handle';
        outputHandle.dataset.type = 'output';
        outputHandle.dataset.widgetId = this.id;
        this.element.appendChild(outputHandle);
    }

    /**
     * Обновление позиции и размеров элемента
     */
    updatePosition() {
        if (!this.element) {
            console.warn('[WidgetBase] updatePosition: element is null', this.id);
            return;
        }
        
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        this.element.style.zIndex = this.zIndex;
        
        // Применяем стили
        this.applyStyles();
    }
    
    /**
     * Применение стилей к элементу виджета
     */
    applyStyles() {
        if (!this.element) return;
        
        const styles = this.styles || {};
        const el = this.element;
        
        // Appearance
        if (styles.appearance) {
            const app = styles.appearance;
            
            // Background
            if (app.backgroundType === 'solid') {
                el.style.background = app.backgroundColor || '#ffffff';
            } else if (app.backgroundType === 'gradient') {
                const grad = app.gradient || {};
                if (grad.type === 'linear') {
                    el.style.background = `linear-gradient(${grad.angle || 135}deg, ${grad.color1 || '#005DFF'}, ${grad.color2 || '#00E0FF'})`;
                }
            }
        }
        
        // Borders
        if (styles.borders) {
            const borders = styles.borders;
            if (borders.width !== undefined) el.style.borderWidth = `${borders.width}px`;
            if (borders.style) el.style.borderStyle = borders.style;
            if (borders.color) el.style.borderColor = borders.color;
            if (borders.radius !== undefined) el.style.borderRadius = `${borders.radius}px`;
        }
    }
    
    /**
     * Установка стилей
     */
    setStyles(styles) {
        this.styles = { ...this.styles, ...styles };
        if (this.element) {
            this.applyStyles();
        }
    }
    
    /**
     * Получение стилей
     */
    getStyles() {
        return this.styles || {};
    }

    /**
     * Установка позиции
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.updatePosition();
    }

    /**
     * Установка размера
     */
    setSize(width, height) {
        this.width = Math.max(50, width);
        this.height = Math.max(50, height);
        this.updatePosition();
        this.update();
    }

    /**
     * Выделение виджета
     */
    select() {
        this.selected = true;
        if (this.element) {
            this.element.classList.add('selected');
            this.zIndex = 1000;
            this.updatePosition();
        }
    }

    /**
     * Снятие выделения
     */
    deselect() {
        this.selected = false;
        if (this.element) {
            this.element.classList.remove('selected');
            this.zIndex = 1;
            this.updatePosition();
        }
    }

    /**
     * Рендеринг содержимого виджета (переопределяется в дочерних классах)
     */
    render() {
        const content = this.element.querySelector('.widget-content');
        if (content) {
            content.innerHTML = `<div style="padding: 1rem;">${this.type} Widget</div>`;
        }
        this._syncFkWarnUi();
    }

    /**
     * Жёлтая обводка + бейдж warn после fk_check=warn при компиляции.
     */
    setFkWarning(message) {
        this.fkWarning = message ? String(message) : null;
        this._syncFkWarnUi();
    }

    clearFkWarning() {
        this.setFkWarning(null);
    }

    _ensureFkWarnBadge() {
        if (!this.element) return null;
        let badge = this.element.querySelector(':scope > .widget-fk-warn-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'widget-fk-warn-badge';
            badge.textContent = 'warn';
            badge.hidden = true;
            this.element.appendChild(badge);
        }
        return badge;
    }

    _syncFkWarnUi() {
        if (!this.element) return;
        const hasWarn = Boolean(this.fkWarning);
        this.element.classList.toggle('fk-warn', hasWarn);
        const badge = this._ensureFkWarnBadge();
        if (badge) {
            badge.hidden = !hasWarn;
            badge.title = this.fkWarning || '';
        }
        if (hasWarn) {
            this.element.title = this.fkWarning;
        } else {
            this.element.removeAttribute('title');
        }
    }

    /**
     * Обновление виджета
     */
    update() {
        if (!this.element) return;
        this.render();
        this.applyStyles();
        this._syncFkWarnUi();
    }

    /**
     * Проверка, содержит ли виджет точку
     */
    containsPoint(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
    }

    /**
     * Добавление соединения
     */
    addConnection(connection) {
        const normalized = normalizeConnection(connection);
        if (!this.connections.find(c => c.id === normalized.id)) {
            this.connections.push(normalized);
        }
    }

    /**
     * Удаление соединения
     */
    removeConnection(connectionId) {
        this.connections = this.connections.filter(c => c.id !== connectionId);
    }

    /**
     * Сериализация в JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            zIndex: this.zIndex,
            settings: this.settings,
            dataSource: this.dataSource,
            styles: this.styles,
            connections: this.connections
        };
    }

    /**
     * Десериализация из JSON
     */
    fromJSON(json) {
        this.id = json.id || this.id;
        this.x = json.x || 0;
        this.y = json.y || 0;
        this.width = json.width || 300;
        this.height = json.height || 200;
        this.zIndex = json.zIndex || 1;
        this.settings = json.settings || {};
        this.dataSource = json.dataSource || null;
        this.styles = json.styles || {};
        this.connections = json.connections || [];
        this.updatePosition();
    }

    /**
     * Удаление виджета
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
