import { WidgetBase } from '../core/WidgetBase.js';

/**
 * RelationshipWidget - Виджет связи между данными
 * Представляет связи между источниками данных или блоками обработки
 */
export class RelationshipWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'relationship',
            width: config.width || 200,
            height: config.height || 100
        });
        
        this.settings = {
            name: config.settings?.name || 'Связь',
            relationshipType: config.settings?.relationshipType || 'one-to-many', // one-to-one, one-to-many, many-to-many
            fromField: config.settings?.fromField || '',
            toField: config.settings?.toField || '',
            description: config.settings?.description || '',
            pk: config.settings?.pk || null,
            foreignKeys: config.settings?.foreignKeys || null,
            left: config.settings?.left || null,
            right: config.settings?.right || null,
            junction: config.settings?.junction || null,
            ...config.settings
        };
    }

    _formatPkFkBadge() {
        const type = this.settings.relationshipType || 'one-to-many';
        if (type === 'many-to-many') {
            const left = this.settings.left;
            const right = this.settings.right;
            const junction = this.settings.junction;
            if (left?.tableVariable && right?.tableVariable && junction?.tableVariable) {
                return `${left.tableVariable} ↔ ${right.tableVariable} via ${junction.tableVariable}`;
            }
        }
        const pk = this.settings.pk;
        const fks = Array.isArray(this.settings.foreignKeys) ? this.settings.foreignKeys : [];
        if (pk?.tableVariable && pk?.column) {
            const pkLabel = `${pk.tableVariable}.${pk.column}`;
            const fkLabels = fks
                .filter((fk) => fk?.tableVariable && fk?.column)
                .map((fk) => `${fk.tableVariable}.${fk.column}`);
            if (fkLabels.length) {
                return `${pkLabel} ← ${fkLabels.join(', ')}`;
            }
            return pkLabel;
        }
        const { fromField, toField } = this.settings;
        if (fromField && toField) return `${fromField} → ${toField}`;
        return '';
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;
        
        const { name, relationshipType, description } = this.settings;
        
        const typeIcons = {
            'one-to-one': '1:1',
            'one-to-many': '1:N',
            'many-to-many': 'N:M'
        };
        
        const typeNames = {
            'one-to-one': 'Один к одному',
            'one-to-many': 'Один ко многим',
            'many-to-many': 'Многие ко многим'
        };
        
        const icon = typeIcons[relationshipType] || '1:N';
        const typeName = typeNames[relationshipType] || 'Связь';
        const badge = this._formatPkFkBadge();
        
        content.innerHTML = `
            <div style="padding: 1rem; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.25rem; color: #00E0FF;">${icon}</div>
                <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem; color: #FFFFFF;">${name}</div>
                <div style="font-size: 0.7rem; color: #B0B3B8; margin-bottom: 0.5rem;">${typeName}</div>
                ${badge ? `
                    <div style="font-size: 0.65rem; color: #6B7280; margin-top: 0.5rem;">
                        ${badge}
                    </div>
                ` : ''}
                ${description ? `<div style="font-size: 0.65rem; color: #6B7280; margin-top: 0.25rem;">${description}</div>` : ''}
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
