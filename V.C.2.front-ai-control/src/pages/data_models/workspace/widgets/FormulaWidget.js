import { WidgetBase } from '../core/WidgetBase.js';
import { WidgetIconMarkup } from './widgetIconMarkup.js';

/**
 * FormulaWidget - Виджет для применения формул к данным
 * Принимает входную таблицу → применяет формулы → выдаёт новую таблицу
 */
export class FormulaWidget extends WidgetBase {
    constructor(config = {}) {
        super({
            ...config,
            type: 'formula',
            width: config.width || 350,
            height: config.height || 250
        });
        
        this.settings = {
            name: config.settings?.name || 'Формула',
            description: config.settings?.description || '',
            inputSourceId: config.settings?.inputSourceId || null, // ID виджета источника данных
            expressions: config.settings?.expressions || [], // Массив формул: [{ name: 'profit', expression: 'Sales - Expenses' }]
            variables: config.settings?.variables || [], // global переменные: [{ name, kind, ... }]
            // legacy; mode is resolved per expression from field name
            outputMode: config.settings?.outputMode || 'add',
            availableFields: config.settings?.availableFields || [], // Поля из входного источника
            ...config.settings
        };
    }

    render() {
        const content = this.element.querySelector('.widget-content');
        if (!content) return;
        
        const { name, expressions, variables, inputSourceId, availableFields } = this.settings;
        
        const expressionsCount = expressions.length;
        const variablesCount = (variables || []).length;
        const fieldsCount = availableFields.length;
        const iconSvg = WidgetIconMarkup.formula('#00E0FF');
        
        content.innerHTML = `
            <div style="padding: 1rem; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="margin-bottom: 0.5rem;">${iconSvg}</div>
                    <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; color: #FFFFFF;">${name}</div>
                    <div style="font-size: 0.75rem; color: #B0B3B8; margin-bottom: 0.5rem;">
                        ${inputSourceId ? `Источник: подключен` : `Источник: не выбран`}
                    </div>
                    ${expressionsCount > 0 ? (
                        `<div style="font-size: 0.7rem; color: #00E0FF; margin-bottom: 0.25rem;">
                            Формул: ${expressionsCount}
                        </div>`
                    ) : ''}
                    ${variablesCount > 0 ? (
                        `<div style="font-size: 0.7rem; color: #34d399; margin-bottom: 0.25rem;">
                            Переменных: ${variablesCount}
                        </div>`
                    ) : ''}
                    ${fieldsCount > 0 ? (
                        `<div style="font-size: 0.65rem; color: #6B7280; margin-top: 0.25rem;">
                            Поля: ${fieldsCount}
                        </div>`
                    ) : ''}
                    ${expressions.length > 0 ? (
                        `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
                            ${expressions.slice(0, 3).map(expr => `
                                <div style="font-size: 0.65rem; color: #B0B3B8; margin-bottom: 0.25rem; font-family: 'JetBrains Mono', monospace;">
                                    ${expr.name} = ${expr.expression.substring(0, 30)}${expr.expression.length > 30 ? '...' : ''}
                                </div>
                            `).join('')}
                            ${expressions.length > 3 ? `<div style="font-size: 0.65rem; color: #6B7280;">... и еще ${expressions.length - 3}</div>` : ''}
                        </div>`
                    ) : (
                        variablesCount === 0 ? (
                        `<div style="font-size: 0.7rem; color: #6B7280; margin-top: 0.5rem; font-style: italic;">
                            Нет формул
                        </div>`
                        ) : ''
                    )}
                    ${variablesCount > 0 ? (
                        `<div style="margin-top: 0.35rem;">
                            ${(variables || []).slice(0, 2).map((v) => `
                                <div style="font-size: 0.65rem; color: #6ee7b7; margin-bottom: 0.2rem; font-family: 'JetBrains Mono', monospace;">
                                    ${(v.exportGlobal !== false ? 'global ' : '') + (v.name || 'var')}
                                </div>
                            `).join('')}
                        </div>`
                    ) : ''}
                </div>
                <div style="font-size: 0.65rem; color: #00E0FF; text-align: right; margin-top: auto;">
                    Формула
                </div>
            </div>
        `;
        this._syncFkWarnUi();
    }

    /**
     * Установка входного источника данных
     */
    setInputSource(sourceWidgetId) {
        this.settings.inputSourceId = sourceWidgetId;
        this.update();
    }

    /**
     * Добавление формулы
     */
    addExpression(name, expression) {
        const existingIndex = this.settings.expressions.findIndex(expr => expr.name === name);
        const newExpression = { name, expression };
        
        if (existingIndex >= 0) {
            this.settings.expressions[existingIndex] = newExpression;
        } else {
            this.settings.expressions.push(newExpression);
        }
        
        this.update();
    }

    /**
     * Удаление формулы
     */
    removeExpression(name) {
        this.settings.expressions = this.settings.expressions.filter(expr => expr.name !== name);
        this.update();
    }

    /**
     * Установка доступных полей из источника
     */
    setAvailableFields(fields) {
        this.settings.availableFields = fields;
        this.update();
    }

    /**
     * Получение выходной схемы (поля + новые поля из формул)
     */
    getOutputSchema() {
        const inputFields = this.settings.availableFields || [];
        const inputNames = new Set(
            inputFields.map((f) => (typeof f === 'string' ? f : f?.name)).filter(Boolean),
        );
        const result = inputFields.map((f) =>
            typeof f === 'string' ? { name: f, type: 'unknown', source: 'input' } : { ...f },
        );

        for (const expr of this.settings.expressions || []) {
            if (!expr?.name) continue;
            const formulaField = {
                name: expr.name,
                type: 'number',
                source: 'formula',
                expression: expr.expression,
            };
            if (inputNames.has(expr.name)) {
                const idx = result.findIndex(
                    (f) => (typeof f === 'string' ? f : f?.name) === expr.name,
                );
                if (idx >= 0) result[idx] = formulaField;
                else result.push(formulaField);
            } else {
                result.push(formulaField);
                inputNames.add(expr.name);
            }
        }
        return result;
    }

    /**
     * Валидация формул
     */
    validateExpressions() {
        const errors = [];
        const availableFieldNames = this.settings.availableFields.map(f => 
            typeof f === 'string' ? f : f.name
        );
        
        this.settings.expressions.forEach((expr, index) => {
            // Проверяем, что имя формулы валидно
            if (!expr.name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr.name)) {
                errors.push({
                    index,
                    name: expr.name,
                    error: 'Невалидное имя формулы'
                });
            }
            
            // Простая проверка на использование доступных полей
            // В реальности нужен более сложный парсер выражений
            const fieldRegex = new RegExp(`\\b(${availableFieldNames.join('|')})\\b`, 'g');
            const usedFields = expr.expression.match(fieldRegex) || [];
            const unknownFields = usedFields.filter(field => !availableFieldNames.includes(field));
            
            if (unknownFields.length > 0) {
                errors.push({
                    index,
                    name: expr.name,
                    error: `Используются неизвестные поля: ${unknownFields.join(', ')}`
                });
            }
        });
        
        return errors;
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
