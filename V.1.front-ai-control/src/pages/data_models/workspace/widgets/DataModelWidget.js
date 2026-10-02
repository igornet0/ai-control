import { WidgetBase } from '../core/WidgetBase.js';
import { WidgetIconMarkup } from './widgetIconMarkup.js';
import { normalizeLinkedTables } from '../interactive/linkedModelDataCodeSync.js';

/**
 * DataModelWidget — импорт таблиц из другой (личной или опубликованной) модели.
 * Работает как источник: отдаёт выбранные таблицы через source_table.
 * Компиляция текущей модели этот виджет не требует.
 */
export class DataModelWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'data-model',
            width: config.width || 320,
            height: config.height || 200
        });

        this.settings = {
            name: config.settings?.name || 'Модель данных',
            sourceModelId: config.settings?.sourceModelId ?? null,
            sourceModelName: config.settings?.sourceModelName || '',
            sourceModelIsPublic: Boolean(config.settings?.sourceModelIsPublic),
            selectedTables: Array.isArray(config.settings?.selectedTables)
                ? config.settings.selectedTables
                : [],
            ...config.settings
        };
    }

    /** Импортированные таблицы уходят дальше по графу (как у источника). */
    createConnectionHandles() {
        const outputHandle = document.createElement('div');
        outputHandle.className = 'connection-handle output-handle';
        outputHandle.dataset.type = 'output';
        outputHandle.dataset.widgetId = this.id;
        this.element.appendChild(outputHandle);
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;

        const { name, sourceModelName, sourceModelId, sourceModelIsPublic } = this.settings;
        const tables = normalizeLinkedTables(this.settings);
        const iconSvg = WidgetIconMarkup.dataModel('#00E0FF');
        const sourceLabel = sourceModelName
            || (sourceModelId != null ? `Модель #${sourceModelId}` : 'модель не выбрана');
        const tablePreview = tables.length
            ? tables.map((t) => t.alias).slice(0, 4).join(', ') + (tables.length > 4 ? '…' : '')
            : 'таблицы не выбраны';
        const badge = sourceModelIsPublic ? 'опубликована' : (sourceModelId ? 'личная' : '');

        content.innerHTML = `
            <div style="padding: 1rem; height: 100%; display: flex; flex-direction: column; justify-content: space-between; border-left: 3px solid #00E0FF;">
                <div>
                    <div style="margin-bottom: 0.5rem;">${iconSvg}</div>
                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; color: #FFFFFF;">${name}</div>
                    <div style="font-size: 0.7rem; color: #9CA3AF; margin-top: 0.35rem;">
                        ${sourceLabel}${badge ? ` · ${badge}` : ''}
                    </div>
                    <div style="font-size: 0.7rem; color: #6B7280; margin-top: 0.35rem;">
                        ${tables.length ? `Таблицы (${tables.length}): ${tablePreview}` : tablePreview}
                    </div>
                </div>
                <div style="font-size: 0.65rem; color: #00E0FF; text-align: right; margin-top: auto;">
                    Связанная модель
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
