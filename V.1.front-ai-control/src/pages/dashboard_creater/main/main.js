import { WorkspaceEngine } from '../src/core/WorkspaceEngine.js';
import { eventBus } from '../src/core/EventBus.js';
import { DataManager } from '../src/data/DataManager.js';
import { ServerAPI } from '../src/core/ServerAPI.js';
import { WidgetStylePanel } from './widget-style-panel.js';
import {
    widgetPaletteIcons,
    svgToolbarUndo,
    svgToolbarRedo,
} from '../icons/dashboardCreaterIcons.js';
import {
    commitDashboardFilterTransportChange,
    reloadDashboardDataWidgetsWithSnapshot,
    invalidateDashboardTransportCaches,
} from '../../../services/dashboardFilterTransport.js';
import { registerBuiltins } from '../src/sdk/index.js';

// Глобальная обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Глобальная ошибка:', event.error);
    console.error('Сообщение:', event.message);
    console.error('Файл:', event.filename);
    console.error('Строка:', event.lineno);
    console.error('Колонка:', event.colno);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Неперехваченное отклонение промиса:', event.reason);
});

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    try {
        
        const btnUndoEl = document.getElementById('btn-undo');
        const btnRedoEl = document.getElementById('btn-redo');
        if (btnUndoEl) {
            btnUndoEl.innerHTML = svgToolbarUndo;
            btnUndoEl.setAttribute('aria-label', 'Отменить');
        }
        if (btnRedoEl) {
            btnRedoEl.innerHTML = svgToolbarRedo;
            btnRedoEl.setAttribute('aria-label', 'Повторить');
        }

        const viewport = document.getElementById('viewport');
        const workspace = document.getElementById('workspace');
        
        if (!viewport || !workspace) {
            console.error('Ошибка: viewport или workspace не найдены!');
                                    return;
        }
        
                // Создание движка
        const engine = new WorkspaceEngine(viewport, workspace);
        window.engine = engine; // Для отладки
        
        // Создание менеджера данных
        const dataManager = new DataManager();
        window.dataManager = dataManager; // Для отладки
        
        // Создание API клиента для сервера (опционально)
        const serverAPI = new ServerAPI('http://localhost:3000/api');
        window.serverAPI = serverAPI; // Для отладки
        
                registerBuiltins(engine);

        let filterReloadPending = false;
        const flush = () => {
            filterReloadPending = false;
            engine.__dashboardFilterReloadGen =
                typeof engine.__dashboardFilterReloadGen === 'number'
                    ? engine.__dashboardFilterReloadGen + 1
                    : 1;
            const snap = commitDashboardFilterTransportChange(engine);
            void reloadDashboardDataWidgetsWithSnapshot(engine, snap, { strategy: 'by-model' });
        };
        const flushVars = () => {
            filterReloadPending = false;
            engine.__dashboardFilterReloadGen =
                typeof engine.__dashboardFilterReloadGen === 'number'
                    ? engine.__dashboardFilterReloadGen + 1
                    : 1;
            try {
                invalidateDashboardTransportCaches({
                    filtersChanged: true,
                    dataChanged: true,
                });
            } catch (_) {
                /* ignore */
            }
            const snap = commitDashboardFilterTransportChange(engine, { invalidateCaches: false });
            void reloadDashboardDataWidgetsWithSnapshot(engine, snap, {
                strategy: 'all',
                fallbackAll: true,
                bypassCache: true,
            });
        };
        eventBus.on('dashboard:filters-changed', () => {
            if (filterReloadPending) return;
            filterReloadPending = true;
            queueMicrotask(flush);
        });
        eventBus.on('dashboard:model-variables-changed', () => {
            if (filterReloadPending) return;
            filterReloadPending = true;
            queueMicrotask(flushVars);
        });
        
        // Отладочная информация
                
                // Обработка кнопок панели инструментов
        setupToolbar(engine);
        
                // Обработка панели виджетов
        setupWidgetPanel(engine);
        
                // Инициализация панели стилей
        const stylePanel = new WidgetStylePanel(engine.viewportController, engine);
        window.stylePanel = stylePanel; // Для отладки
        
        // Открытие панели стилей при выделении виджета (только в режиме редактора)
        eventBus.on('widget:selected', ({ widget }) => {
            if (engine.mode === 'editor') {
                stylePanel.show(widget);
            }
        });

        eventBus.on('widget:data-binding-updated', async ({ widget: w }) => {
            if (w && typeof w.reloadFromDataModel === 'function') {
                await w.reloadFromDataModel(engine);
            }
            if (engine.mode === 'editor' && w) {
                engine.widgetManager.selectWidget(w.id);
                stylePanel.show(w);
            }
        });
        
        // Закрытие панели стилей при снятии выделения
        eventBus.on('widget:deselected-all', () => {
            stylePanel.hide();
        });
        
        // Обработка удаления виджетов из контейнера
        document.addEventListener('container:remove-widget', (e) => {
            const { containerId, widgetId } = e.detail;
            const container = engine.widgetManager.getWidget(containerId);
            if (container && container.removeWidget) {
                container.removeWidget(widgetId, engine.widgetManager);
                engine.saveSnapshot();
            }
        });
        
                // Обновление UI при изменении состояния
        updateUI(engine);
        
                // Управление видимостью панелей в зависимости от режима
        setupModePanels(engine, stylePanel);
        
            } catch (error) {
        console.error('Критическая ошибка при инициализации приложения:', error);
        alert('Ошибка при загрузке приложения: ' + error.message);
        throw error;
    }
});

/**
 * Настройка панели инструментов
 */
function setupToolbar(engine) {
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    const btnExport = document.getElementById('btn-export');
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnDeleteWidget = document.getElementById('btn-delete-widget');
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValue = document.getElementById('zoom-value');
    const btnModeEditor = document.getElementById('btn-mode-editor');
    const btnModeViewer = document.getElementById('btn-mode-viewer');
    
    // Проверка наличия элементов
    if (!btnSave || !btnLoad || !btnExport || !btnUndo || !btnRedo || !zoomSlider || !zoomValue || !btnModeEditor || !btnModeViewer) {
        console.error('Ошибка: не все элементы панели инструментов найдены!');
                return;
    }
    
    // Сохранение
    btnSave.addEventListener('click', () => {
        try {
            engine.save('dashboard.json');
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
            alert('Ошибка при сохранении: ' + error.message);
        }
    });
    
    // Загрузка
    btnLoad.addEventListener('click', () => {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    engine.load(file).catch(error => {
                        console.error('Ошибка при загрузке:', error);
                        alert('Ошибка при загрузке: ' + error.message);
                    });
                }
            };
            input.click();
        } catch (error) {
            console.error('Ошибка при открытии диалога загрузки:', error);
            alert('Ошибка при загрузке: ' + error.message);
        }
    });
    
    // Экспорт JSON
    btnExport.addEventListener('click', () => {
        try {
            const json = engine.exportJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dashboard.json';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            alert('Ошибка при экспорте: ' + error.message);
        }
    });
    
    // Undo/Redo
    btnUndo.addEventListener('click', () => {
        try {
            engine.undo();
        } catch (error) {
            console.error('Ошибка при отмене:', error);
        }
    });
    
    btnRedo.addEventListener('click', () => {
        try {
            engine.redo();
        } catch (error) {
            console.error('Ошибка при повторе:', error);
        }
    });

    if (btnDeleteWidget) {
        btnDeleteWidget.addEventListener('click', () => {
            if (engine.mode === 'viewer') return;
            const selected = engine.widgetManager.getSelectedWidgets();
            if (!selected.length) return;
            selected.forEach((w) => eventBus.emit('widget:delete', { id: w.id }));
        });
    }

    // Zoom slider
    zoomSlider.addEventListener('input', (e) => {
        try {
            const zoom = parseFloat(e.target.value);
            engine.viewportController.setZoom(zoom);
            zoomValue.textContent = Math.round(zoom * 100) + '%';
        } catch (error) {
            console.error('Ошибка при изменении масштаба:', error);
        }
    });
    
    // Обновление zoom slider при изменении zoom
    eventBus.on('viewport:zoom', ({ zoom }) => {
        try {
            zoomSlider.value = zoom;
            zoomValue.textContent = Math.round(zoom * 100) + '%';
        } catch (error) {
            console.error('Ошибка при обновлении zoom:', error);
        }
    });
    
    // Режимы
    btnModeEditor.addEventListener('click', () => {
        try {
            engine.setMode('editor');
            btnModeEditor.classList.add('btn-active');
            btnModeViewer.classList.remove('btn-active');
        } catch (error) {
            console.error('Ошибка при переключении в режим редактора:', error);
        }
    });
    
    btnModeViewer.addEventListener('click', () => {
        try {
            engine.setMode('viewer');
            btnModeViewer.classList.add('btn-active');
            btnModeEditor.classList.remove('btn-active');
        } catch (error) {
            console.error('Ошибка при переключении в режим просмотра:', error);
        }
    });
}

/**
 * Настройка панели виджетов
 */
function setupWidgetPanel(engine) {
    // Используем делегирование событий для надежности
    const widgetPanel = document.getElementById('widget-panel');
    const widgetList = document.querySelector('.widget-list');
    
    if (!widgetPanel) {
        console.error('Ошибка: widget-panel не найден!');
        return;
    }
    
    if (!widgetList) {
        console.error('Ошибка: widget-list не найден!');
                return;
    }

    const paletteRows = [
        ['text', 'Текст'],
        ['table', 'Таблица'],
        ['line-chart', 'Линейный график'],
        ['bar-chart', 'Столбчатая диаграмма'],
        ['pie-chart', 'Круговая диаграмма'],
        ['kpi', 'KPI'],
        ['gauge', 'Датчик'],
        ['html', 'HTML'],
        ['container', 'Шкаф'],
        ['button-widget', 'Кнопки'],
    ];
    widgetList.innerHTML = paletteRows
        .map(
            ([type, label]) => `
        <div class="widget-item" data-type="${type}">
            <span class="widget-item-icon" aria-hidden="true">${widgetPaletteIcons[type]}</span>
            <span class="widget-item-label">${label}</span>
        </div>`
        )
        .join('');

    // Проверяем наличие элементов
    const widgetItems = document.querySelectorAll('.widget-item');
        
    if (widgetItems.length === 0) {
        console.error('Ошибка: элементы .widget-item не найдены!');
                return;
    }
    
    // Используем делегирование событий на родительском элементе
    widgetList.addEventListener('click', (e) => {
        try {
            const item = e.target.closest('.widget-item');
            if (!item) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const type = item.dataset.type;
            if (!type) {
                console.error('Ошибка: у элемента виджета не указан data-type');
                return;
            }
            
                        
            // Не добавляем виджеты в режиме просмотра
            if (engine.mode === 'viewer') {
                                return;
            }
            
            // Получаем центр viewport в координатах workspace
            const viewport = document.getElementById('viewport');
            if (!viewport) {
                console.error('Ошибка: viewport не найден');
                return;
            }
            
            const viewportRect = viewport.getBoundingClientRect();
            const centerX = viewportRect.width / 2;
            const centerY = viewportRect.height / 2;
            
            if (!engine.viewportController) {
                console.error('Ошибка: viewportController не инициализирован');
                return;
            }
            
            const workspacePos = engine.viewportController.viewportToWorkspace(centerX, centerY);
            
            // Добавляем виджет в центр экрана
            // Создаём виджет с базовыми данными для демонстрации
            const config = {
                x: workspacePos.x - 150,
                y: workspacePos.y - 100
            };
            
            // Добавляем демо-данные для некоторых виджетов
            if (type === 'line-chart' || type === 'bar-chart') {
                config.settings = {
                    data: [
                        { x: 'Янв', y: 10 },
                        { x: 'Фев', y: 20 },
                        { x: 'Мар', y: 15 },
                        { x: 'Апр', y: 25 },
                        { x: 'Май', y: 30 }
                    ]
                };
            } else if (type === 'pie-chart') {
                config.settings = {
                    data: [
                        { label: 'Категория A', value: 30 },
                        { label: 'Категория B', value: 45 },
                        { label: 'Категория C', value: 25 }
                    ]
                };
            } else if (type === 'table') {
                config.settings = {
                    data: [
                        { name: 'Элемент 1', value: 100, status: 'Активен' },
                        { name: 'Элемент 2', value: 200, status: 'Активен' },
                        { name: 'Элемент 3', value: 150, status: 'Неактивен' }
                    ],
                    columns: ['name', 'value', 'status']
                };
            } else if (type === 'kpi') {
                config.settings = {
                    title: 'Общая сумма',
                    value: '1,234',
                    unit: '₽',
                    trend: 'up',
                    trendValue: '+12%'
                };
            } else if (type === 'gauge') {
                config.settings = {
                    value: 65,
                    min: 0,
                    max: 100,
                    theme: 'neon',
                    gaugeColor: '#00f0ff',
                    fillColor: '#00ff80',
                    valueSuffix: '%',
                    dialRotation: 0,
                };
            } else if (type === 'button-widget') {
                config.settings = {
                    layout: { direction: 'row', wrap: true },
                    buttons: [
                        {
                            id: 'btn_1',
                            label: 'Open Sheet 2',
                            icon: 'arrow',
                            action: { type: 'navigate', target: '2', payload: {} },
                        },
                        {
                            id: 'btn_2',
                            label: 'Filter NL',
                            icon: 'filter',
                            action: {
                                type: 'filter',
                                target: 'global',
                                payload: { field: 'country', value: 'Netherlands' },
                            },
                        },
                    ],
                };
            }
            
                                    
            if (!engine.widgetClasses[type]) {
                console.error(`Виджет типа "${type}" не зарегистрирован!`);
                console.error('Зарегистрированные виджеты:', Object.keys(engine.widgetClasses));
                alert(`Виджет типа "${type}" не зарегистрирован. Пожалуйста, обновите страницу.`);
                return;
            }
            
            engine.addWidget(type, config);
        } catch (error) {
            console.error('Ошибка при добавлении виджета:', error);
            console.error('Стек ошибки:', error.stack);
            alert(`Ошибка при добавлении виджета: ${error.message}`);
        }
    });
    
    }

/**
 * Обновление UI при изменении состояния
 */
function updateUI(engine) {
    // Обновление кнопок Undo/Redo
    eventBus.on('history:changed', ({ canUndo, canRedo }) => {
        document.getElementById('btn-undo').disabled = !canUndo;
        document.getElementById('btn-redo').disabled = !canRedo;
    });
}

/**
 * Управление видимостью панелей в зависимости от режима
 */
function setupModePanels(engine, stylePanel) {
    const widgetPanel = document.getElementById('widget-panel');
    const viewport = document.getElementById('viewport');
    
    // Функция для обновления видимости панелей
    const updatePanelsVisibility = (mode) => {
        if (mode === 'viewer') {
            // Скрываем панели в режиме просмотра
            widgetPanel.classList.add('hidden');
            // Закрываем панель стилей через метод hide() для правильного сброса состояния
            if (stylePanel) {
                stylePanel.hide();
            }
            // Убираем отступ viewport слева
            viewport.style.marginLeft = '0';
        } else {
            // Показываем панели в режиме редактора
            widgetPanel.classList.remove('hidden');
            // Панель стилей показывается только при выделении виджета
            // Здесь мы её не трогаем, она управляется через stylePanel.show/hide
            // Восстанавливаем отступ viewport слева
            viewport.style.marginLeft = '240px';
        }
    };
    
    // Подписка на изменение режима
    eventBus.on('mode:changed', ({ mode }) => {
        updatePanelsVisibility(mode);
    });
    
    // Инициализация при загрузке (по умолчанию режим 'editor')
    updatePanelsVisibility(engine.mode || 'editor');
}

