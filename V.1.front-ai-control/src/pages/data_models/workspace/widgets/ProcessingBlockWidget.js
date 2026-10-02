import { WidgetBase } from '../core/WidgetBase.js';
import { WidgetIconMarkup } from './widgetIconMarkup.js';

/**
 * ProcessingBlockWidget - Виджет блока обработки данных
 * Представляет операции обработки (фильтр, трансформация, формула и т.д.)
 */
export class ProcessingBlockWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'processing-block',
            width: config.width || 250,
            height: config.height || 150
        });
        
        this.settings = {
            name: config.settings?.name || 'Блок обработки',
            blockType: config.settings?.blockType || 'filter', // filter, transform, join, formula, aggregate
            config: config.settings?.config || {},
            description: config.settings?.description || '',
            ...config.settings
        };
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;
        
        const { name, blockType, description } = this.settings;

        const typeNames = {
            filter: 'Фильтр',
            transform: 'Трансформация',
            formula: 'Формула',
            aggregate: 'Агрегация',
            join: 'Объединение',
            sort: 'Сортировка'
        };

        const typeName = typeNames[blockType] || 'Обработка';
        
        // Цвета для разных типов блоков
        const typeColors = {
            filter: '#3B82F6',
            transform: '#8B5CF6',
            formula: '#10B981',
            aggregate: '#F59E0B',
            join: '#EF4444',
            sort: '#06B6D4'
        };
        
        const color = typeColors[blockType] || '#6B7280';

        const typeIconSvg = {
            filter: WidgetIconMarkup.filter(color),
            transform: WidgetIconMarkup.transform(color),
            formula: WidgetIconMarkup.formula(color),
            aggregate: WidgetIconMarkup.aggregate(color),
            join: WidgetIconMarkup.join(color),
            sort: WidgetIconMarkup.transform(color),
        };
        const iconSvg = typeIconSvg[blockType] || WidgetIconMarkup.transform(color);
        
        content.innerHTML = `
            <div style="padding: 1rem; height: 100%; display: flex; flex-direction: column; justify-content: space-between; border-left: 3px solid ${color};">
                <div>
                    <div style="margin-bottom: 0.5rem;">${iconSvg}</div>
                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; color: #FFFFFF;">${name}</div>
                    <div style="font-size: 0.75rem; color: ${color}; margin-bottom: 0.5rem;">${typeName}</div>
                    ${description ? `<div style="font-size: 0.7rem; color: #6B7280; margin-top: 0.5rem;">${description}</div>` : ''}
                </div>
                <div style="font-size: 0.65rem; color: ${color}; text-align: right; margin-top: auto;">
                    Блок обработки
                </div>
            </div>
        `;
        this._syncFkWarnUi();
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
