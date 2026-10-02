import { WidgetBase } from '../core/WidgetBase.js';
import { WidgetIconMarkup } from './widgetIconMarkup.js';

/**
 * DataSourceWidget - Виджет источника данных
 * Представляет источник данных (файл, API, база данных и т.д.)
 */
export class DataSourceWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'data-source',
            width: config.width || 250,
            height: config.height || 150
        });
        
        this.settings = {
            name: config.settings?.name || 'Источник данных',
            sourceType: config.settings?.sourceType || 'file', // file, folder, archive, api, database, json, interactive, databridge
            sourcePath: config.settings?.sourcePath || '',
            description: config.settings?.description || '',
            selectedFile: config.settings?.selectedFile || null,
            selectedFolder: config.settings?.selectedFolder || null,
            selectedArchive: config.settings?.selectedArchive || null,
            ...config.settings
        };
    }

    /** Источник данных только отдаёт данные (исходящие соединения) */
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
        
        const { name, sourceType, description } = this.settings;

        const typeNames = {
            file: 'Файл',
            folder: 'Папка',
            archive: 'Архив',
            api: 'API',
            database: 'База данных',
            json: 'JSON',
            interactive: 'Интерактивный',
            databridge: 'DataBridge',
        };

        const iconSvg = WidgetIconMarkup.dataSourceByType(sourceType, '#00E0FF');
        const typeName = typeNames[sourceType] || 'Файл';
        const sourcePath = this.settings.sourcePath || '';
        const displayPath = sourcePath.length > 30 ? sourcePath.substring(0, 30) + '...' : sourcePath;

        let apiStatusHtml = '';
        if (sourceType === 'api') {
            const tableName = this.settings.tableName || '';
            const rowCount = this.settings.lastRowCount;
            const colCount = (this.settings.fileColumns || []).length;
            const deployStatus = this.settings.deployStatus || '';
            const hasData = colCount > 0 && (rowCount > 0 || (this.settings.previewRows || []).length > 0);
            if (tableName) {
                apiStatusHtml += `<div style="font-size: 0.65rem; color: #6B7280; margin-top: 0.25rem; font-family: 'JetBrains Mono', monospace;">${tableName}</div>`;
            }
            if (deployStatus === 'pending') {
                apiStatusHtml += `<div style="font-size: 0.65rem; color: #FBBF24; margin-top: 0.25rem;">Деплой в очереди…</div>`;
            } else if (deployStatus === 'failed') {
                apiStatusHtml += `<div style="font-size: 0.65rem; color: #F87171; margin-top: 0.25rem;">Ошибка деплоя</div>`;
            } else if (hasData) {
                apiStatusHtml += `<div style="font-size: 0.65rem; color: #34D399; margin-top: 0.25rem;">${rowCount ?? (this.settings.previewRows || []).length} строк · ${colCount} полей</div>`;
            } else if (this.settings.apiKeyId) {
                apiStatusHtml += `<div style="font-size: 0.65rem; color: #9CA3AF; margin-top: 0.25rem; font-style: italic;">Ожидание данных…</div>`;
            }
            if (colCount > 0) {
                const colsPreview = (this.settings.fileColumns || []).slice(0, 4).join(', ');
                const more = colCount > 4 ? ` +${colCount - 4}` : '';
                apiStatusHtml += `<div style="font-size: 0.6rem; color: #6B7280; margin-top: 0.2rem;">${colsPreview}${more}</div>`;
            }
        }

        let bridgeStatusHtml = '';
        if (sourceType === 'databridge') {
            const entity = this.settings.databridgeEntity || '';
            const tableName = this.settings.tableName || '';
            const colCount = (this.settings.selectedColumns || this.settings.fileColumns || []).length;
            if (entity) {
                bridgeStatusHtml += `<div style="font-size: 0.65rem; color: #6B7280; margin-top: 0.25rem; font-family: 'JetBrains Mono', monospace;">${entity}</div>`;
            }
            if (tableName) {
                bridgeStatusHtml += `<div style="font-size: 0.6rem; color: #9CA3AF; margin-top: 0.15rem; font-family: 'JetBrains Mono', monospace;">${tableName}</div>`;
            }
            if (colCount > 0) {
                bridgeStatusHtml += `<div style="font-size: 0.65rem; color: #34D399; margin-top: 0.25rem;">${colCount} полей</div>`;
            }
        }
        
        content.innerHTML = `
            <div style="padding: 1rem; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="margin-bottom: 0.5rem;">${iconSvg}</div>
                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; color: #FFFFFF;">${name}</div>
                    <div style="font-size: 0.75rem; color: #B0B3B8; margin-bottom: 0.5rem;">${typeName}</div>
                    ${sourceType !== 'api' && sourceType !== 'databridge' && sourcePath ? `<div style="font-size: 0.65rem; color: #6B7280; margin-top: 0.25rem; word-break: break-all; font-family: 'JetBrains Mono', monospace;">${displayPath}</div>` : ''}
                    ${apiStatusHtml}
                    ${bridgeStatusHtml}
                    ${description ? `<div style="font-size: 0.7rem; color: #6B7280; margin-top: 0.5rem;">${description}</div>` : ''}
                </div>
                <div style="font-size: 0.65rem; color: #00E0FF; text-align: right; margin-top: auto;">
                    Источник данных
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
