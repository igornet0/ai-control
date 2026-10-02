import { WidgetBase } from '../core/WidgetBase.js';
import { renderWidgetEmptyInnerHtml } from '../core/widgetDataBinding.js';

/**
 * CustomHTMLWidget - Виджет для отображения произвольного HTML
 */
export class CustomHTMLWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'html',
            width: config.width || 400,
            height: config.height || 300
        });
        
        this.settings = {
            html: config.settings?.html ?? '',
            ...config.settings
        };
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;

        const typography = this.styles?.typography || {};
        const htmlRaw = this.settings.html != null ? String(this.settings.html) : '';
        if (!htmlRaw.trim()) {
            content.innerHTML = renderWidgetEmptyInnerHtml(typography, 'html');
            return;
        }

        // ВНИМАНИЕ: Использование innerHTML может быть небезопасным
        // В продакшене следует использовать более безопасные методы
        content.innerHTML = `<div class="dash-widget-shell custom-html-widget-shell">${this.settings.html}</div>`;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            settings: this.settings
        };
    }

    fromJSON(json) {
        super.fromJSON(json);
        if (json.settings) {
            this.settings = { ...this.settings, ...json.settings };
        }
        this.render();
    }
}

