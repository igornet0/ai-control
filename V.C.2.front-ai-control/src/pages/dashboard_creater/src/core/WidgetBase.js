import { eventBus } from './EventBus.js';
import { resolveColorSettingMap } from '../widgets/common/resolveColorSetting.js';
import { colorToRgba } from '../widgets/common/colorToRgba.js';

export const WIDGET_VARIANTS = ['glass', 'solid', 'outline', 'minimal', 'elevated', 'accent'];
export const WIDGET_DENSITIES = ['compact', 'normal', 'spacious'];

/**
 * WidgetBase - Базовый класс для всех виджетов
 * Содержит общую логику для позиционирования, размеров, выделения
 */
export class WidgetBase {
    constructor(config = {}) {
        this.id = config.id || this.generateId();
        this.type = config.type || 'base';
        // Не использовать `x || 0`: валидный 0 и Number("0") должны сохраняться; NaN/null → 0.
        this.x = Number.isFinite(Number(config.x)) ? Number(config.x) : 0;
        this.y = Number.isFinite(Number(config.y)) ? Number(config.y) : 0;
        this.width = Number.isFinite(Number(config.width)) && Number(config.width) > 0
            ? Number(config.width)
            : 300;
        this.height = Number.isFinite(Number(config.height)) && Number(config.height) > 0
            ? Number(config.height)
            : 200;
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

        /** @type {Record<string, string>|null} */
        this._resolvedStyleColors = null;
        /** @type {Record<string, string>|null} */
        this._resolvedWidgetColors = null;
        /** @type {boolean} */
        this._colorResolveScheduled = false;

        /** @type {import('../sdk/WidgetContext.js').WidgetContext|null} */
        this.ctx = config._ctx || config.ctx || null;

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
        
        // Критичный layout inline: main.css грузится асинхронно — без position:absolute
        // виджеты складываются в поток в начале workspace (и canvas кнопки рисуется в 0×0).
        this.element.style.position = 'absolute';
        this.element.style.boxSizing = 'border-box';
        this.element.style.overflow = 'visible';

        // Фон, рамка и скругление по умолчанию — из CSS-варианта (.widget--variant-*), см. applyStyles.
        
        // Контейнер для содержимого виджета
        const content = document.createElement('div');
        content.className = 'widget-content';
        content.style.width = '100%';
        content.style.height = '100%';
        content.style.overflow = 'hidden';
        content.style.boxSizing = 'border-box';
        content.style.position = 'relative';
        this.element.appendChild(content);
        
        // Handles для изменения размера
        this.createResizeHandles();
        this.createProfilePinButton();
        
        this.updatePosition();
    }

    /**
     * Кнопка «в профиль» (появляется при наведении, если экспорт разрешён).
     */
    createProfilePinButton() {
        if (!this.element || this._profilePinBtn) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'widget-profile-pin-btn';
        btn.title = 'Показать в профиле';
        btn.setAttribute('aria-label', 'Показать в профиле');
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M16 3v4.5L19 12v2h-5v7l-2 1-2-1v-7H5v-2l3-4.5V3h8z" stroke-linejoin="round"></path>
            </svg>
        `;
        btn.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const controller = this._getProfilePinController();
            if (!controller?.toggle) return;
            void Promise.resolve(controller.toggle(this)).then(() => this.syncProfilePinButton());
        });
        this.element.appendChild(btn);
        this._profilePinBtn = btn;
        this.syncProfilePinButton();
    }

    _getProfilePinController() {
        const fromCtx = this.ctx?.adapters?.profilePin;
        if (fromCtx) return fromCtx;
        const eng = typeof window !== 'undefined' ? window.engine : null;
        return eng?.profilePinController || null;
    }

    syncProfilePinButton() {
        const btn = this._profilePinBtn;
        if (!btn) return;
        if (this.type === 'filter') {
            btn.hidden = true;
            btn.style.display = 'none';
            return;
        }
        const allow = this.settings?.allowExportToProfile !== false;
        const controller = this._getProfilePinController();
        const canPin = Boolean(allow && controller?.canPin?.(this));
        btn.hidden = !canPin;
        btn.style.display = canPin ? '' : 'none';
        if (!canPin) return;
        const pinned = Boolean(controller?.isPinned?.(this));
        btn.classList.toggle('is-pinned', pinned);
        btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
        btn.title = pinned ? 'Убрать из профиля' : 'Показать в профиле';
        btn.setAttribute('aria-label', pinned ? 'Убрать из профиля' : 'Показать в профиле');
        const svg = btn.querySelector('svg');
        if (svg) svg.setAttribute('fill', pinned ? 'currentColor' : 'none');
    }

    /**
     * Создание ручек для изменения размера
     */
    createResizeHandles() {
        const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        const corners = new Set(['nw', 'ne', 'sw', 'se']);
        handles.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${direction} ${corners.has(direction) ? 'resize-handle--corner' : 'resize-handle--edge'}`;
            handle.dataset.direction = direction;
            this.element.appendChild(handle);
        });
    }

    /**
     * Обновление позиции и размеров элемента
     */
    updatePosition() {
        if (!this.element) return;
        
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        this.element.style.zIndex = this.zIndex;
        
        // Применяем стили
        this.applyStyles();
    }
    
    /**
     * Резолв формул цвета для shell-стилей (фон, типографика, рамка, neon, тени).
     * @param {object|null} engine
     */
    async resolveStyleColorFormulas(engine = null) {
        const eng = engine || (typeof window !== 'undefined' ? window.engine : null);
        const app = this.styles?.appearance || {};
        const typo = this.styles?.typography || {};
        const borders = this.styles?.borders || {};
        const neon = borders.neonGlow || {};
        const grad = app.gradient || {};
        const ctx = {
            engine: eng,
            dataSource: this.dataSource,
            fieldValues: {},
        };
        const map = {
            backgroundColor: { hex: app.backgroundColor, formula: app.backgroundColorFormula },
            glassColor: { hex: app.glassColor, formula: app.glassColorFormula },
            gradientColor1: { hex: grad.color1, formula: grad.color1Formula },
            gradientColor2: { hex: grad.color2, formula: grad.color2Formula },
            textColor: { hex: typo.color, formula: typo.colorFormula },
            borderColor: { hex: borders.color, formula: borders.colorFormula },
            neonColor: { hex: neon.color, formula: neon.colorFormula },
            titleColor: {
                hex: this.settings?.titleColor,
                formula: this.settings?.titleColorFormula,
            },
        };
        const shadows = Array.isArray(this.styles?.shadows) ? this.styles.shadows : [];
        shadows.forEach((sh, i) => {
            map[`shadow_${i}`] = { hex: sh?.color, formula: sh?.colorFormula };
        });
        this._resolvedStyleColors = await resolveColorSettingMap(map, ctx);
        return this._resolvedStyleColors;
    }

    /**
     * Карта widget-specific цветов для формул. Переопределяется в дочерних классах.
     * @returns {Record<string, { hex?: string, formula?: string }>|null}
     */
    getWidgetColorFormulaMap() {
        const s = this.settings || {};
        if (!s.titleColor && !s.titleColorFormula) return null;
        return {
            titleColor: { hex: s.titleColor, formula: s.titleColorFormula },
        };
    }

    /**
     * Контекст полей для local color-AST (переопределяется при необходимости).
     * @returns {Record<string, unknown>}
     */
    getColorFormulaFieldValues() {
        return {};
    }

    /**
     * Резолв widget-specific формул цвета → `_resolvedWidgetColors`.
     * @param {object|null} engine
     */
    async resolveWidgetColorFormulas(engine = null) {
        const map = this.getWidgetColorFormulaMap();
        if (!map || !Object.keys(map).length) {
            this._resolvedWidgetColors = {};
            return this._resolvedWidgetColors;
        }
        const eng = engine || (typeof window !== 'undefined' ? window.engine : null);
        this._resolvedWidgetColors = await resolveColorSettingMap(map, {
            engine: eng,
            dataSource: this.dataSource,
            fieldValues: this.getColorFormulaFieldValues(),
        });
        return this._resolvedWidgetColors;
    }

    /**
     * @param {object|null} engine
     */
    async resolveAllColorFormulas(engine = null) {
        const eng = engine || (typeof window !== 'undefined' ? window.engine : null);
        await this.resolveStyleColorFormulas(eng);
        await this.resolveWidgetColorFormulas(eng);
        return {
            style: this._resolvedStyleColors,
            widget: this._resolvedWidgetColors,
        };
    }

    _rc(key, fallback) {
        const v = this._resolvedStyleColors?.[key];
        if (typeof v === 'string' && v) return v;
        return fallback;
    }

    /**
     * Resolved widget/style color by key (titleColor, fillColor, …).
     * @param {string} key
     * @param {string} [fallback]
     */
    resolvedColor(key, fallback = '') {
        const w = this._resolvedWidgetColors?.[key];
        if (typeof w === 'string' && w) return w;
        const s = this._resolvedStyleColors?.[key];
        if (typeof s === 'string' && s) return s;
        return fallback;
    }

    /** @param {unknown} obj @param {number} depth */
    _objectHasColorFormula(obj, depth = 0) {
        if (!obj || typeof obj !== 'object' || depth > 5) return false;
        if (Array.isArray(obj)) {
            return obj.some((x) => this._objectHasColorFormula(x, depth + 1));
        }
        for (const [k, v] of Object.entries(obj)) {
            if (typeof k === 'string' && k.endsWith('Formula') && String(v ?? '').trim()) return true;
            if (k === 'colorFormulas' && v && typeof v === 'object' && Object.keys(v).length) return true;
            if (k === 'paletteFormulas' && Array.isArray(v) && v.some((x) => String(x ?? '').trim())) return true;
            if (v && typeof v === 'object' && this._objectHasColorFormula(v, depth + 1)) return true;
        }
        return false;
    }

    _mayHaveColorFormulas() {
        return this._objectHasColorFormula(this.styles) || this._objectHasColorFormula(this.settings);
    }

    _scheduleColorFormulaResolve() {
        if (this._colorResolveScheduled) return;
        if (!this._mayHaveColorFormulas()) return;
        this._colorResolveScheduled = true;
        const eng = typeof window !== 'undefined' ? window.engine : null;
        Promise.resolve()
            .then(() => this.resolveAllColorFormulas(eng))
            .then(() => {
                this._colorResolveScheduled = false;
                if (!this.element) return;
                this.render();
                this.applyStyles();
            })
            .catch(() => {
                this._colorResolveScheduled = false;
            });
    }

    /**
     * Применение стилей к элементу виджета
     */
    applyStyles() {
        if (!this.element) return;
        
        const styles = this.styles || {};
        const el = this.element;
        const content = el.querySelector('.widget-content');
        
        // Layout
        if (styles.layout) {
            // Позиция и размер уже обрабатываются в updatePosition
        }
        
        // Appearance: вариант карточки и плотность — классами (CSS-токены в main.css),
        // явный фон — inline поверх варианта. Всё, что не задано, сбрасывается,
        // иначе значения предыдущих настроек «залипают» на элементе.
        const app = styles.appearance || {};
        const variant = WIDGET_VARIANTS.includes(app.variant) ? app.variant : 'glass';
        const density = WIDGET_DENSITIES.includes(app.density) ? app.density : 'normal';
        WIDGET_VARIANTS.forEach((v) => el.classList.toggle(`widget--variant-${v}`, v === variant));
        WIDGET_DENSITIES.forEach((d) => el.classList.toggle(`widget--density-${d}`, d === density));

        if (app.backgroundType === 'solid') {
            el.style.background = this._rc('backgroundColor', app.backgroundColor || '#1A1D22');
            el.style.backdropFilter = 'none';
        } else if (app.backgroundType === 'gradient') {
            el.style.backdropFilter = 'none';
            const grad = app.gradient || {};
            const type = grad.type === 'radial' ? 'radial' : 'linear';
            const color1 = this._rc('gradientColor1', grad.color1 || '#6366F1');
            const color2 = this._rc('gradientColor2', grad.color2 || '#8B5CF6');
            if (type === 'radial') {
                el.style.background = `radial-gradient(circle, ${color1}, ${color2})`;
            } else {
                el.style.background = `linear-gradient(${grad.angle ?? 135}deg, ${color1}, ${color2})`;
            }
        } else if (app.backgroundType === 'glass') {
            const glassColor = this._rc('glassColor', app.glassColor || '#ffffff');
            const glassOpacity = app.glassOpacity !== undefined ? app.glassOpacity : 0.1;
            el.style.background = colorToRgba(glassColor, glassOpacity);
            const blur = Number(app.glassBlur);
            el.style.backdropFilter = `blur(${Number.isFinite(blur) ? blur : 8}px) saturate(150%)`;
        } else {
            el.style.background = '';
            el.style.backdropFilter = '';
        }

        const opacity = Number(app.opacity);
        el.style.opacity = app.opacity !== undefined && app.opacity !== null && app.opacity !== ''
            && Number.isFinite(opacity) ? String(Math.min(1, Math.max(0, opacity))) : '';
        el.style.mixBlendMode = app.blendMode && app.blendMode !== 'normal' ? app.blendMode : '';

        // Typography (применяется к content и внутренним элементам)
        if (styles.typography && content) {
            const typo = styles.typography;
            const resolvedTextColor = this._rc('textColor', typo.color);
            // Применяем к основному контейнеру
            if (typo.fontFamily) content.style.fontFamily = typo.fontFamily;
            if (typo.fontWeight) content.style.fontWeight = typo.fontWeight;
            if (typo.fontSize) content.style.fontSize = `${typo.fontSize}px`;
            if (typo.letterSpacing !== undefined) content.style.letterSpacing = `${typo.letterSpacing}px`;
            if (typo.lineHeight) content.style.lineHeight = typo.lineHeight;
            const applyTypoColor = this.type !== 'html' && this.type !== 'gauge';
            if (applyTypoColor && resolvedTextColor) content.style.color = resolvedTextColor;
            if (typo.textShadow) content.style.textShadow = typo.textShadow;
            
            // Также применяем к прямым дочерним div элементам (для виджетов с вложенной структурой).
            // Заголовок (.dash-widget-heading) цвет берёт только из titleColor, не из типографики.
            // KPI сам масштабирует значение (fontSize * 2.2) — не затираем внутренний font-size.
            const skipInnerFontSize = this.type === 'kpi';
            const innerDivs = content.querySelectorAll(':scope > div');
            innerDivs.forEach(div => {
                const isHeading = div.classList?.contains('dash-widget-heading');
                if (typo.fontFamily) div.style.fontFamily = typo.fontFamily;
                if (typo.fontWeight) div.style.fontWeight = typo.fontWeight;
                if (!skipInnerFontSize && typo.fontSize) div.style.fontSize = `${typo.fontSize}px`;
                if (typo.letterSpacing !== undefined) div.style.letterSpacing = `${typo.letterSpacing}px`;
                if (!skipInnerFontSize && typo.lineHeight) div.style.lineHeight = typo.lineHeight;
                if (applyTypoColor && resolvedTextColor && !isHeading) div.style.color = resolvedTextColor;
                if (typo.textShadow) div.style.textShadow = typo.textShadow;
            });
        }
        
        // Collect all box-shadow values
        const boxShadows = [];
        
        // Borders & Corners
        if (styles.borders) {
            const borders = styles.borders;
            el.style.borderWidth = Number.isFinite(Number(borders.width)) && borders.width !== '' && borders.width !== null
                ? `${borders.width}px` : '';
            el.style.borderStyle = borders.style || '';
            el.style.borderColor = borders.color || this._rc('borderColor', '')
                ? this._rc('borderColor', borders.color) : '';
            el.style.borderRadius = Number.isFinite(Number(borders.radius)) && borders.radius !== '' && borders.radius !== null
                ? `${borders.radius}px` : '';
            
            // Neon glow (adds to box-shadow)
            if (borders.neonGlow && borders.neonGlow.enabled) {
                const glow = borders.neonGlow;
                const glowColor = this._rc('neonColor', glow.color || '#00E0FF');
                const intensity = glow.intensity || 12;
                const spread = glow.spread || 0;
                boxShadows.push(`0 0 ${intensity}px ${glowColor}`);
                boxShadows.push(`inset 0 0 ${intensity * 0.7}px ${glowColor}`);
                if (spread > 0) {
                    boxShadows.push(`0 0 ${spread}px ${glowColor}`);
                }
            }
        }
        
        // Shadows (adds to box-shadow)
        if (styles.shadows && Array.isArray(styles.shadows)) {
            styles.shadows.forEach((shadow, i) => {
                if (shadow.enabled) {
                    const x = shadow.x || 0;
                    const y = shadow.y || 0;
                    const blur = shadow.blur || 0;
                    const spread = shadow.spread || 0;
                    const color = this._rc(`shadow_${i}`, shadow.color || 'rgba(0, 0, 0, 0.3)');
                    boxShadows.push(`${x}px ${y}px ${blur}px ${spread}px ${color}`);
                }
            });
        }
        
        // Apply combined box-shadow
        if (boxShadows.length > 0) {
            el.style.boxShadow = boxShadows.join(', ');
        } else {
            el.style.boxShadow = '';
        }
        
        // Animations
        if (styles.animations) {
            const anim = styles.animations;
            if (anim.type && anim.enabled) {
                const duration = anim.duration || 1;
                const easing = anim.easing || 'ease';
                const delay = anim.delay || 0;
                const loop = anim.loop ? 'infinite' : '';
                el.style.animation = `${anim.type} ${duration}s ${easing} ${delay}s ${loop}`.trim();
            } else {
                el.style.animation = '';
            }
        }
        
        // Advanced CSS
        if (styles.advancedCSS) {
            const css = styles.advancedCSS;
            if (css.custom) {
                // Применяем кастомный CSS через style attribute
                const customStyles = css.custom.split(';').filter(s => s.trim());
                customStyles.forEach(style => {
                    const [prop, value] = style.split(':').map(s => s.trim());
                    if (prop && value) {
                        el.style.setProperty(prop, value);
                    }
                });
            }
        }
    }
    
    /**
     * Установка стилей
     */
    setStyles(styles) {
        const prevContentStyleSig = JSON.stringify({
            typography: this.styles?.typography ?? null,
            appearance: this.styles?.appearance ?? null,
        });

        this.styles = { ...this.styles, ...styles };

        const nextContentStyleSig = JSON.stringify({
            typography: this.styles?.typography ?? null,
            appearance: this.styles?.appearance ?? null,
        });
        const contentStylesChanged = prevContentStyleSig !== nextContentStyleSig;

        // Перерисовка контента при смене типографики или фона (SVG/HTML-виджеты читают styles в render)
        if (this.element && contentStylesChanged) {
            this.render();
        }

        // Применяем стили только если элемент существует
        if (this.element) {
            this.applyStyles();
            this._scheduleColorFormulaResolve();
        }

        // Эмитим событие об изменении стилей
        eventBus.emit('widget:styles-changed', { widget: this });
    }
    
    /**
     * Получение стилей
     */
    getStyles() {
        return this.styles || {};
    }

    /**
     * Установка позиции
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @param {WidgetManager} widgetManager - Опционально, для проверки границ
     */
    setPosition(x, y, widgetManager = null) {
        // Если передан widgetManager, ограничиваем позицию границами workspace
        if (widgetManager) {
            const constrained = widgetManager.constrainWidgetPosition(x, y, this.width, this.height);
            this.x = constrained.x;
            this.y = constrained.y;
        } else {
            this.x = x;
            this.y = y;
        }
        this.updatePosition();
    }

    /**
     * Установка размера
     * @param {number} width - Ширина
     * @param {number} height - Высота
     * @param {WidgetManager} widgetManager - Опционально, для проверки границ
     */
    setSize(width, height, widgetManager = null) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        // Если передан widgetManager, ограничиваем размер границами workspace
        if (widgetManager) {
            const constrained = widgetManager.constrainWidgetSize(this.x, this.y, width, height);
            this.width = constrained.width;
            this.height = constrained.height;
            // Обновляем позицию, если она была скорректирована
            if (constrained.x !== this.x || constrained.y !== this.y) {
                this.x = constrained.x;
                this.y = constrained.y;
            }
        } else {
            this.width = Math.max(50, width); // Минимальная ширина
            this.height = Math.max(50, height); // Минимальная высота
        }
        
        // Если размер изменился, обновляем содержимое
        if (oldWidth !== this.width || oldHeight !== this.height) {
            this.updatePosition();
            // Вызываем обновление содержимого асинхронно для производительности
            // во время перетаскивания, и сразу при программном изменении размера
            if (this._isResizing) {
                // Во время resize обновляем отложенно
                clearTimeout(this._resizeUpdateTimer);
                this._resizeUpdateTimer = setTimeout(() => {
                    this.update();
                }, 100);
            } else {
                // Немедленное обновление при программном изменении
                this.update();
            }
        } else {
            this.updatePosition();
        }
    }

    /**
     * Выделение виджета
     */
    select() {
        this.selected = true;
        if (this.element) {
            this.element.classList.add('selected');
            // Поднимаем наверх
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
        // Должно быть переопределено в дочерних классах
        const content = this.element.querySelector('.widget-content');
        if (content) {
            content.innerHTML = `<div style="padding: 1rem;">${this.type} Widget</div>`;
        }
    }

    /**
     * Обновление виджета (вызывается при изменении данных или настроек)
     * @param {{ skipColorResolve?: boolean }} [opts]
     */
    update(opts = {}) {
        if (!this.element) return;
        this.render();
        // Применяем стили после рендеринга
        this.applyStyles();
        if (!opts?.skipColorResolve) {
            this._scheduleColorFormulaResolve();
        }
    }

    /**
     * Перезагрузка данных с учётом глобальных фильтров (переопределяется в виджетах с данными).
     * Базовая реализация обновляет color-формулы (кнопки и виджеты без dataSource).
     * @param {object|import('../sdk/WidgetContext.js').WidgetContext} [_ctxOrEngine]
     *   Prefer WidgetContext; engines are accepted for backward compatibility.
     */
    reloadFromDataModel(_ctxOrEngine) {
        const eng =
            _ctxOrEngine?.engine ||
            (_ctxOrEngine?.widgetManager ? _ctxOrEngine : null) ||
            (typeof window !== 'undefined' ? window.engine : null);
        if (!this._mayHaveColorFormulas()) {
            return Promise.resolve();
        }
        return this.resolveAllColorFormulas(eng).then(() => {
            if (!this.element) return;
            this.render();
            this.applyStyles();
        });
    }

    /**
     * Проверка, содержит ли виджет точку
     * @param {number} x - X координата в workspace
     * @param {number} y - Y координата в workspace
     * @returns {boolean}
     */
    containsPoint(x, y) {
        return x >= this.x && x <= this.x + this.width &&
               y >= this.y && y <= this.y + this.height;
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
            styles: this.styles
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
        this.updatePosition();
        this.syncProfilePinButton();
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

