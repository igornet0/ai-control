/**
 * DataCode Web Editor - Simplified Version
 * Simple editor with vertical tabs on the left
 */

class DataCodeEditor {
    constructor() {
        this.highlighter = new DataCodeSyntaxHighlighter();
        this.tabs = new Map(); // Map of tabId -> {name, content}
        this.activeTabId = null;
        this.tabCounter = 1;
        this.historyTimeout = null;
        
        // History for undo/redo: Map of tabId -> {undo: [], redo: [], currentIndex: -1}
        this.history = new Map();
        this.isUndoRedo = false; // Flag to prevent saving to history during undo/redo
        
        // API configuration
        this.apiBaseUrl = window.API_BASE_URL || 'http://localhost:8000';
        this.authToken = null;
        this.proxyEnabled = false; // ✅ Безопасный прокси вместо прямой передачи токена
        this.pendingRequests = new Map(); // ✅ Хранилище для ожидающих запросов через прокси
        
        this.initializeElements();
        this.attachEventListeners();
        this.setupMessageListener();
        this.createNewTab();
        
        // Autocomplete state
        this.autocompleteVisible = false;
        this.autocompleteItems = [];
        this.autocompleteIndex = -1;
        
        // Function tooltip state
        this.functionTooltip = null;
        this.tooltipTimeout = null;
        
        // Файлы для загрузки перед выполнением кода (массив { filename, content }[])
        this.filesToUpload = [];
        this.fileToUpload = null; // обратная совместимость: первый файл
        
        // Контекст модели данных (при открытии из виджета) — выполнение через execute-code и сохранение кода
        this.modelId = null;
        this.codeChangeNotifyTimeout = null;
        this.executeForModelPending = new Map(); // requestId -> { resolve, reject }
        
        // Загружаем сохраненную высоту консоли
        this.loadConsoleHeight();
        
        // Загружаем код из URL параметра, если есть
        this.loadCodeFromURL();
        
        // Сообщаем родителю, что редактор готов к приёму SET_INITIAL_CODE_DATA (устраняет гонку с handleLoad)
        if (window.parent && window.parent !== window) {
            setTimeout(() => {
                window.parent.postMessage({ type: 'EDITOR_READY' }, '*');
            }, 0);
        }
    }
    
    /**
     * Загружает код из URL параметра code
     */
    loadCodeFromURL() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const codeFromURL = urlParams.get('code');
            if (codeFromURL) {
                const decodedCode = decodeURIComponent(codeFromURL);
                                // Используем setTimeout, чтобы убедиться, что редактор полностью инициализирован
                setTimeout(() => {
                    this.setCode(decodedCode);
                }, 100);
            }
        } catch (error) {
            console.error('[editor.js] Error loading code from URL:', error);
        }
    }

    initializeElements() {
        // Editor elements
        this.editor = document.getElementById('codeEditor');
        this.highlight = document.getElementById('codeHighlight');
        this.lineNumbers = document.getElementById('lineNumbers');
        this.tabsList = document.getElementById('tabsList');
        
        // Panels
        this.searchPanel = document.getElementById('searchPanel');
        this.searchInput = document.getElementById('searchInput');
        this.autocompletePanel = document.getElementById('autocompletePanel');
        this.autocompleteList = document.getElementById('autocompleteList');
        this.consolePanel = document.getElementById('consolePanel');
        this.consoleContent = document.getElementById('consoleContent');
        this.consoleResizeHandle = document.getElementById('consoleResizeHandle');
        this.consoleResizeUp = document.getElementById('consoleResizeUp');
        this.consoleResizeDown = document.getElementById('consoleResizeDown');
        
        // Buttons
        this.addTabBtn = document.getElementById('addTabBtn');
        this.compileBtn = document.getElementById('compileBtn');
        this.searchClose = document.getElementById('searchClose');
        this.consoleToggle = document.getElementById('consoleToggle');
        
        // Console resize state
        this.consoleHeight = 200; // Default height in pixels
        this.isResizing = false;
    }

    attachEventListeners() {
        // Editor input
        if (this.editor) this.editor.addEventListener('input', () => this.onEditorInput());
        if (this.editor) this.editor.addEventListener('scroll', () => this.onEditorScroll());
        if (this.editor) this.editor.addEventListener('keydown', (e) => this.onEditorKeyDown(e));
        if (this.editor) this.editor.addEventListener('keyup', (e) => this.onEditorKeyUp(e));
        if (this.editor) this.editor.addEventListener('click', () => {
            this.updateCursorPosition();
            this.hideFunctionTooltip();
        });
        if (this.editor) this.editor.addEventListener('select', () => this.updateCursorPosition());
        if (this.editor) this.editor.addEventListener('mouseup', () => this.updateCursorPosition());
        
        // Re-sync layers when browser/page zoom or layout changes
        this.setupLayoutSync();
        if (this.editor) this.editor.addEventListener('mousemove', (e) => {
            this.handleFunctionHover(e);
        });
        
        if (this.editor) this.editor.addEventListener('mouseleave', () => {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = setTimeout(() => {
                this.hideFunctionTooltip();
            }, 200);
        });
        
        // Also handle hover on highlight element (backup method)
        if (this.highlight) this.highlight.addEventListener('mouseover', (e) => {
            // Find the closest element with builtin class (built-in functions)
            const target = e.target.closest('.builtin');
            if (target) {
                clearTimeout(this.tooltipTimeout);
                
                // Get function name from data attribute or text content
                let funcName = target.getAttribute('data-function');
                if (!funcName) {
                    // Fallback: extract from text content
                    funcName = target.textContent.trim();
                    // Remove parentheses and parameters if present
                    funcName = funcName.replace(/\(.*$/, '').trim();
                }
                
                // Normalize function name to lowercase
                funcName = funcName.toLowerCase();
                
                const funcDef = this.highlighter.getFunctionDefinition(funcName);
                if (funcDef) {
                    this.tooltipTimeout = setTimeout(() => {
                        this.showFunctionTooltip(target, funcDef);
                    }, 300); // Small delay before showing tooltip
                }
            }
        });
        
        if (this.highlight) this.highlight.addEventListener('mouseout', (e) => {
            // Check if we're leaving a function element
            const target = e.target.closest('.builtin');
            if (target) {
                clearTimeout(this.tooltipTimeout);
                // Small delay to allow moving to tooltip
                this.tooltipTimeout = setTimeout(() => {
                    const relatedTarget = e.relatedTarget;
                    // Check if mouse moved to tooltip or still over function
                    if (!relatedTarget || 
                        (!relatedTarget.closest('.function-tooltip') && 
                         !relatedTarget.closest('.builtin'))) {
                        this.hideFunctionTooltip();
                    }
                }, 200);
            }
        });
        
        // Keep tooltip visible when hovering over it
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest('.function-tooltip')) {
                clearTimeout(this.tooltipTimeout);
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('.function-tooltip')) {
                this.tooltipTimeout = setTimeout(() => {
                    this.hideFunctionTooltip();
                }, 200);
            }
        });
        
        // Hide tooltip on scroll
        if (this.editor) this.editor.addEventListener('scroll', () => {
            this.hideFunctionTooltip();
        });
        
        // Tab management
        if (this.addTabBtn) this.addTabBtn.addEventListener('click', () => this.createNewTab());
        
        // Compile button
        if (this.compileBtn) this.compileBtn.addEventListener('click', () => this.compileCode());
        
        // Search
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.showSearchPanel();
            }
        });
        if (this.searchClose) this.searchClose.addEventListener('click', () => this.hideSearchPanel());
        if (this.searchInput) this.searchInput.addEventListener('input', () => this.performSearch());
        const searchNext = document.getElementById('searchNext');
        const searchPrev = document.getElementById('searchPrev');
        if (searchNext) searchNext.addEventListener('click', () => this.searchNext());
        if (searchPrev) searchPrev.addEventListener('click', () => this.searchPrev());
        
        // Console
        if (this.consoleToggle) this.consoleToggle.addEventListener('click', () => this.toggleConsole());
        if (this.consoleResizeUp) this.consoleResizeUp.addEventListener('click', () => this.resizeConsole(50));
        if (this.consoleResizeDown) this.consoleResizeDown.addEventListener('click', () => this.resizeConsole(-50));
        
        // Console resize handle (drag to resize)
        if (this.consoleResizeHandle) this.consoleResizeHandle.addEventListener('mousedown', (e) => this.startResizeConsole(e));
        document.addEventListener('mousemove', (e) => this.onResizeConsole(e));
        document.addEventListener('mouseup', () => this.stopResizeConsole());
        
        // Window resize
        window.addEventListener('resize', () => this.syncEditorLayout());
    }

    setupLayoutSync() {
        const container = this.editor?.closest('.code-editor-container')
            || this.editor?.parentElement;

        if (container && typeof ResizeObserver !== 'undefined') {
            this._layoutResizeObserver = new ResizeObserver(() => {
                this.syncEditorLayout();
            });
            this._layoutResizeObserver.observe(container);
        }

        if (window.visualViewport) {
            this._onVisualViewportChange = () => this.syncEditorLayout();
            window.visualViewport.addEventListener('resize', this._onVisualViewportChange);
            window.visualViewport.addEventListener('scroll', this._onVisualViewportChange);
        }

        document.addEventListener('selectionchange', () => {
            if (!this.editor || document.activeElement !== this.editor) return;
            this.updateCursorPosition();
        });
    }

    syncEditorLayout() {
        if (!this.editor) return;
        this.onEditorScroll();
        this.updateCursorPosition();
    }

    /**
     * Setup message listener for communication with parent window
     * БЕЗОПАСНОСТЬ: Проверяем origin всех входящих сообщений
     * ✅ ИСПРАВЛЕНО: Используем безопасный прокси вместо прямой передачи токена
     */
    setupMessageListener() {
        // Безопасный origin родительского окна (наш же домен)
        const expectedOrigin = window.location.origin;
        
        window.addEventListener('message', (event) => {
            // ✅ КРИТИЧНО: Проверяем origin перед обработкой сообщения
            if (event.origin !== expectedOrigin) {
                console.warn('Ignored message from unauthorized origin:', event.origin);
                return;
            }

            if (!event.data || typeof event.data !== 'object') {
                return;
            }

            // ✅ Безопасный прокси: обработка ответов от прокси
            if (event.data.type === 'IFRAME_API_RESPONSE') {
                const { requestId, success, data, error, status } = event.data;
                const pendingRequest = this.pendingRequests.get(requestId);
                
                if (pendingRequest) {
                    this.pendingRequests.delete(requestId);
                    if (success) {
                        pendingRequest.resolve({ data, status });
                    } else {
                        pendingRequest.reject(new Error(error?.message || 'API request failed'));
                    }
                }
                return;
            }

            // ✅ Конфигурация прокси (предпочтительный метод)
            if (event.data.type === 'API_PROXY_CONFIG') {
                if (event.data.proxyEnabled) {
                    this.proxyEnabled = true;
                    if (event.data.apiBaseUrl && typeof event.data.apiBaseUrl === 'string') {
                        this.apiBaseUrl = event.data.apiBaseUrl;
                    }
                                    }
                return;
            }

            // Устаревший метод: прямая передача токена (для обратной совместимости)
            if (event.data.type === 'API_CONFIG') {
                console.warn('Using legacy API_CONFIG - consider using API_PROXY_CONFIG');
                if (event.data.apiBaseUrl && typeof event.data.apiBaseUrl === 'string') {
                    this.apiBaseUrl = event.data.apiBaseUrl;
                }
                if (event.data.authToken && typeof event.data.authToken === 'string') {
                    this.authToken = event.data.authToken;
                    this.proxyEnabled = false; // Отключаем прокси если используется прямой токен
                }
            }

            // Обработка установки начального кода
            if (event.data.type === 'SET_CODE') {
                                if (event.data.code && typeof event.data.code === 'string') {
                    this.setCode(event.data.code);
                }
            }

            // Обработка установки массива файлов для загрузки (от DataCodeEditorWrapper)
            if (event.data.type === 'SET_FILES_TO_UPLOAD') {
                const files = event.data.files;
                if (Array.isArray(files) && files.length > 0) {
                    const valid = files.filter(f => f && f.filename && f.content);
                    this.filesToUpload = valid;
                    this.fileToUpload = valid.length > 0 ? valid[0] : null;
                                    }
            }
            // Обработка установки одного файла для загрузки (обратная совместимость)
            if (event.data.type === 'SET_FILE_TO_UPLOAD') {
                                if (event.data.file && event.data.file.filename && event.data.file.content) {
                    this.fileToUpload = event.data.file;
                    this.filesToUpload = [event.data.file];
                                    }
            }
            // Контекст модели данных: выполнение через execute-code и сохранение кода в БД
            if (event.data.type === 'MODEL_CONTEXT' && event.data.modelId != null) {
                this.modelId = event.data.modelId;
                            }
            // Начальное состояние вкладок из БД (сохранённый код)
            if (event.data.type === 'SET_INITIAL_CODE_DATA' && event.data.code_data) {
                const codeData = event.data.code_data;
                const tabs = codeData.tabs;
                const activeTab = codeData.activeTab != null ? codeData.activeTab : 0;
                if (Array.isArray(tabs) && tabs.length > 0) {
                    this.applyCodeData(tabs, activeTab);
                }
            }
            // Ответ на EXECUTE_FOR_MODEL от родителя
            if (event.data.type === 'EXECUTE_FOR_MODEL_RESPONSE') {
                const requestId = event.data.requestId;
                const pending = this.executeForModelPending.get(requestId);
                if (pending) {
                    this.executeForModelPending.delete(requestId);
                    if (event.data.success) {
                        pending.resolve({ data: event.data });
                    } else {
                        pending.reject(new Error(event.data.error || event.data.message || 'Execution failed'));
                    }
                }
            }
        });

        // Request API configuration from parent if in iframe
        if (window.parent && window.parent !== window) {
            // ✅ Используем конкретный origin вместо '*'
            window.parent.postMessage({ type: 'REQUEST_API_CONFIG' }, expectedOrigin);
        }
    }

    /**
     * ✅ Безопасный метод выполнения API запросов через прокси
     */
    async makeApiRequest(method, url, data = null) {
        const expectedOrigin = window.location.origin;
        
        // Если прокси включен, используем его
        if (this.proxyEnabled && window.parent && window.parent !== window) {
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return new Promise((resolve, reject) => {
                // Сохраняем промис для обработки ответа
                this.pendingRequests.set(requestId, { resolve, reject });
                
                // Отправляем запрос через прокси
                window.parent.postMessage({
                    type: 'IFRAME_API_REQUEST',
                    requestId: requestId,
                    method: method,
                    url: url,
                    data: data,
                    headers: {}
                }, expectedOrigin);
                
                // Таймаут для запроса (30 секунд)
                setTimeout(() => {
                    if (this.pendingRequests.has(requestId)) {
                        this.pendingRequests.delete(requestId);
                        reject(new Error('Request timeout'));
                    }
                }, 30000);
            });
        }
        
        // Fallback: прямой запрос (если прокси не доступен)
        const token = this.authToken || this.getAuthToken();
        const response = await fetch(`${this.apiBaseUrl}${url}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: data ? JSON.stringify(data) : undefined
        });
        
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || result.message || 'Request failed');
        }
        return { data: result, status: response.status };
    }

    createNewTab(name = null) {
        const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const tabName = name || `Вкладка ${this.tabCounter++}`;
        
        this.tabs.set(tabId, {
            name: tabName,
            content: '',
            widgetId: null
        });
        
        // Initialize history for this tab
        this.history.set(tabId, {
            undo: [''],
            redo: [],
            currentIndex: 0
        });
        
        this.addTabToSidebar(tabId, tabName);
        this.switchToTab(tabId);
        
        return tabId;
    }

    /**
     * Устанавливает код в активную вкладку
     */
    setCode(code) {
                
        if (!this.activeTabId) {
            console.warn('[editor.js] No active tab, creating new one');
            this.createNewTab();
        }
        
        const tab = this.tabs.get(this.activeTabId);
        if (tab) {
            tab.content = code || '';
            this.editor.value = tab.content;
            this.updateHighlight();
            this.updateLineNumbers();
            this.saveCurrentTab();
                    } else {
            console.error('[editor.js] Active tab not found:', this.activeTabId);
        }
    }

    getTabIdsInOrder() {
        if (!this.tabsList) return [];
        return Array.from(this.tabsList.querySelectorAll('.tab-item'))
            .map(item => item.dataset.tabId)
            .filter(tabId => this.tabs.has(tabId));
    }

    /**
     * Возвращает code_data: { tabs: [{ name, content, widgetId }], activeTab: number }
     */
    getCodeData() {
        const tabIdsInOrder = this.getTabIdsInOrder();
        const tabs = tabIdsInOrder.map(tabId => {
            const tab = this.tabs.get(tabId);
            const out = { name: tab ? tab.name : '', content: tab ? tab.content : '' };
            if (tab?.widgetId != null) out.widgetId = tab.widgetId;
            return out;
        });
        const activeIndex = this.activeTabId ? tabIdsInOrder.indexOf(this.activeTabId) : 0;
        return { tabs, activeTab: activeIndex >= 0 ? activeIndex : 0 };
    }

    /**
     * Собирает код из вкладок в порядке сайдбара.
     * untilActive: с первой вкладки по активную включительно (компиляция внутри редактора).
     */
    getCompiledCodeFromTabs(untilActive = false) {
        const tabIdsInOrder = this.getTabIdsInOrder();
        if (!tabIdsInOrder.length) return '';
        let endIndex = tabIdsInOrder.length - 1;
        if (untilActive && this.activeTabId) {
            const idx = tabIdsInOrder.indexOf(this.activeTabId);
            if (idx >= 0) endIndex = idx;
        }
        const prefixIds = tabIdsInOrder.slice(0, endIndex + 1);
        const codeParts = [];
        prefixIds.forEach((tabId, index) => {
            const tab = this.tabs.get(tabId);
            if (tab && tab.content.trim()) {
                if (prefixIds.length > 1) codeParts.push(`# ===== ${tab.name} =====`);
                codeParts.push(tab.content);
                if (index < prefixIds.length - 1) codeParts.push('');
            }
        });
        return codeParts.join('\n');
    }

    /**
     * Уведомляет родительское окно об изменении кода (для сохранения в БД)
     */
    notifyCodeChanged() {
        if (window.parent === window) return;
        const codeData = this.getCodeData();
        const code = this.getCompiledCodeFromTabs();
        try {
            window.parent.postMessage({
                type: 'CODE_CHANGED',
                code: code,
                code_data: codeData
            }, window.location.origin);
        } catch (e) {
            console.warn('[editor.js] notifyCodeChanged postMessage failed:', e);
        }
    }

    /**
     * Применяет сохранённый code_data (вкладки из БД)
     */
    applyCodeData(tabs, activeTabIndex) {
        if (!tabs || tabs.length === 0 || !this.tabsList) return;
        if (this.activeTabId) this.saveCurrentTab();
        const tabIdsToRemove = Array.from(this.tabs.keys());
        tabIdsToRemove.forEach(tabId => {
            const el = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (el) el.remove();
            this.tabs.delete(tabId);
            this.history.delete(tabId);
        });
        this.activeTabId = null;
        this.tabCounter = 1;
        let firstTabId = null;
        tabs.forEach((t, index) => {
            const tabId = `tab_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
            const tabName = t.name || `Вкладка ${index + 1}`;
            this.tabs.set(tabId, {
                name: tabName,
                content: t.content || '',
                widgetId: t.widgetId != null ? t.widgetId : null
            });
            this.history.set(tabId, { undo: [t.content || ''], redo: [], currentIndex: 0 });
            this.addTabToSidebar(tabId, tabName);
            if (index === 0) firstTabId = tabId;
        });
        const tabIdsInOrder = Array.from(this.tabsList.querySelectorAll('.tab-item'))
            .map(item => item.dataset.tabId)
            .filter(tabId => this.tabs.has(tabId));
        const activeId = tabIdsInOrder[Math.min(activeTabIndex, tabIdsInOrder.length - 1)] || firstTabId;
        if (activeId) this.switchToTab(activeId);
    }

    addTabToSidebar(tabId, tabName) {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        tabItem.dataset.tabId = tabId;
        tabItem.draggable = true;
        
        tabItem.innerHTML = `
            <span class="tab-name">${this.escapeHtml(tabName)}</span>
            <button class="tab-close" data-tab-id="${tabId}">×</button>
        `;
        
        tabItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchToTab(tabId);
            }
        });
        
        const closeBtn = tabItem.querySelector('.tab-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tabId);
        });
        
        // Prevent dragging when clicking close button
        closeBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        closeBtn.draggable = false;
        
        // Double-click to edit tab name
        const tabNameElement = tabItem.querySelector('.tab-name');
        let isDragging = false;
        
        tabItem.addEventListener('dragstart', () => {
            isDragging = true;
        });
        
        tabItem.addEventListener('dragend', () => {
            // Reset flag after a short delay to allow click events to process
            setTimeout(() => {
                isDragging = false;
            }, 100);
        });
        
        tabNameElement.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            // Don't start editing if we just finished dragging
            if (!isDragging) {
                this.editTabName(tabId, tabNameElement);
            }
        });
        
        // Drag and drop handlers
        tabItem.addEventListener('dragstart', (e) => {
            // Don't allow dragging if we're editing the tab name
            const tabNameInput = tabItem.querySelector('.tab-name-input');
            if (tabNameInput) {
                e.preventDefault();
                return false;
            }
            
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', tabId);
            tabItem.classList.add('dragging');
        });
        
        tabItem.addEventListener('dragend', (e) => {
            tabItem.classList.remove('dragging');
            // Remove all drag-over classes
            document.querySelectorAll('.tab-item').forEach(tab => {
                tab.classList.remove('drag-over');
            });
        });
        
        tabItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingTab = document.querySelector('.tab-item.dragging');
            if (!draggingTab || draggingTab === tabItem) return;
            
            const tabs = Array.from(this.tabsList.querySelectorAll('.tab-item'));
            const draggingIndex = tabs.indexOf(draggingTab);
            const currentIndex = tabs.indexOf(tabItem);
            
            // Remove drag-over from all tabs
            tabs.forEach(tab => tab.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom'));
            
            // Add visual feedback
            if (draggingIndex < currentIndex) {
                tabItem.classList.add('drag-over', 'drag-over-bottom');
            } else {
                tabItem.classList.add('drag-over', 'drag-over-top');
            }
        });
        
        tabItem.addEventListener('dragleave', (e) => {
            // Only remove if we're leaving the tab item itself, not a child
            if (!tabItem.contains(e.relatedTarget)) {
                tabItem.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
            }
        });
        
        tabItem.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const draggedTabId = e.dataTransfer.getData('text/plain');
            if (!draggedTabId || draggedTabId === tabId) return;
            
            const draggedTab = document.querySelector(`[data-tab-id="${draggedTabId}"]`);
            if (!draggedTab) return;
            
            const tabs = Array.from(this.tabsList.querySelectorAll('.tab-item'));
            const draggedIndex = tabs.indexOf(draggedTab);
            const targetIndex = tabs.indexOf(tabItem);
            
            if (draggedIndex !== targetIndex) {
                // Reorder tabs in DOM
                if (draggedIndex < targetIndex) {
                    tabItem.after(draggedTab);
                } else {
                    tabItem.before(draggedTab);
                }
                
                // Reorder tabs in Map (convert Map to array, reorder, recreate Map)
                this.reorderTabs(draggedTabId, tabId, draggedIndex < targetIndex);
            }
            
            // Clean up visual feedback
            tabItem.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
        
        this.tabsList.appendChild(tabItem);
    }
    
    reorderTabs(draggedTabId, targetTabId, insertAfter) {
        // Get the current DOM order (this is the source of truth after DOM manipulation)
        const tabsInDOM = Array.from(this.tabsList.querySelectorAll('.tab-item'));
        const tabIdsInOrder = tabsInDOM.map(tab => tab.dataset.tabId);
        
        // Recreate Map with new order based on DOM
        const newTabsMap = new Map();
        tabIdsInOrder.forEach(tabId => {
            const tabData = this.tabs.get(tabId);
            if (tabData) {
                newTabsMap.set(tabId, tabData);
            }
        });
        
        // Replace the old Map with the new one
        this.tabs = newTabsMap;
    }
    
    editTabName(tabId, tabNameElement) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        const currentName = tab.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tab-name-input';
        input.value = currentName;
        input.style.width = '100%';
        input.style.background = 'var(--bg-tertiary)';
        input.style.border = '1px solid var(--neon-purple)';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.color = 'var(--text-primary)';
        input.style.fontSize = '13px';
        input.style.fontFamily = 'inherit';
        input.style.outline = 'none';
        
        // Replace tab name with input
        const parent = tabNameElement.parentElement;
        parent.replaceChild(input, tabNameElement);
        
        // Select all text
        input.select();
        input.focus();
        
        // Save on Enter or blur
        const saveName = () => {
            const newName = input.value.trim() || currentName;
            
            // Update tab data
            tab.name = newName;
            
            // Restore tab name element
            const newTabNameElement = document.createElement('span');
            newTabNameElement.className = 'tab-name';
            newTabNameElement.textContent = newName;
            
            // Re-attach double-click handler
            newTabNameElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.editTabName(tabId, newTabNameElement);
            });
            
            parent.replaceChild(newTabNameElement, input);
        };
        
        // Cancel on Escape
        const cancelEdit = () => {
            const newTabNameElement = document.createElement('span');
            newTabNameElement.className = 'tab-name';
            newTabNameElement.textContent = currentName;
            
            // Re-attach double-click handler
            newTabNameElement.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.editTabName(tabId, newTabNameElement);
            });
            
            parent.replaceChild(newTabNameElement, input);
        };
        
        input.addEventListener('blur', saveName);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            } else if (e.key === 'Tab') {
                // Allow tab to work normally (switch focus)
                return;
            }
            e.stopPropagation(); // Prevent tab switching while editing
        });
        
        // Prevent tab switching while editing
        input.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    switchToTab(tabId) {
        if (!this.tabs.has(tabId)) return;
        
        // Save current tab content
        if (this.activeTabId) {
            this.saveCurrentTab();
        }
        
        // Update active tab
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Load tab content
        this.activeTabId = tabId;
        const tab = this.tabs.get(tabId);
        
        // Initialize history if not exists
        if (!this.history.has(tabId)) {
            this.history.set(tabId, {
                undo: [tab.content],
                redo: [],
                currentIndex: 0
            });
        }
        
        this.editor.value = tab.content;
        this.updateHighlight();
        this.updateLineNumbers();
        this.updateCursorPosition();
        this.editor.focus();
        this.notifyCodeChanged();
    }

    closeTab(tabId) {
        if (this.tabs.size === 1) {
            // Don't close the last tab, just clear it
            this.tabs.get(tabId).content = '';
            this.editor.value = '';
            this.updateHighlight();
            this.updateLineNumbers();
            return;
        }
        
        // Remove tab from sidebar
        const tabItem = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (!tabItem) {
            // Tab element not found, just remove from Map
            this.tabs.delete(tabId);
            this.history.delete(tabId);
            if (this.activeTabId === tabId) {
                const remainingTabs = Array.from(this.tabs.keys());
                if (remainingTabs.length > 0) {
                    this.activeTabId = null; // Clear active tab before switching
                    this.switchToTab(remainingTabs[0]);
                } else {
                    this.activeTabId = null;
                    this.editor.value = '';
                    this.updateHighlight();
                    this.updateLineNumbers();
                }
            }
            return;
        }
        
        // Save content of the tab being closed if it's currently active
        const isActiveTab = (this.activeTabId === tabId);
        if (isActiveTab) {
            // Save current content before removing
            this.saveCurrentTab();
        }
        
        // Find next tab to switch to (use DOM order, not Map order)
        let nextTabId = null;
        if (isActiveTab) {
            // Try to find next sibling tab
            const nextSibling = tabItem.nextElementSibling;
            if (nextSibling && nextSibling.dataset.tabId && this.tabs.has(nextSibling.dataset.tabId)) {
                nextTabId = nextSibling.dataset.tabId;
            } else {
                // If no next sibling, try previous sibling
                const prevSibling = tabItem.previousElementSibling;
                if (prevSibling && prevSibling.dataset.tabId && this.tabs.has(prevSibling.dataset.tabId)) {
                    nextTabId = prevSibling.dataset.tabId;
                } else {
                    // Fallback: get any remaining tab from DOM
                    const remainingTabItems = Array.from(this.tabsList.querySelectorAll('.tab-item'));
                    const validRemaining = remainingTabItems.find(item => 
                        item.dataset.tabId && 
                        item.dataset.tabId !== tabId && 
                        this.tabs.has(item.dataset.tabId)
                    );
                    if (validRemaining) {
                        nextTabId = validRemaining.dataset.tabId;
                    }
                    // Last resort: get from Map
                    if (!nextTabId) {
                        const remainingTabs = Array.from(this.tabs.keys()).filter(id => id !== tabId);
                        if (remainingTabs.length > 0) {
                            nextTabId = remainingTabs[0];
                        }
                    }
                }
            }
        }
        
        // Remove tab element from DOM
        tabItem.remove();
        
        // Remove tab from Map
        this.tabs.delete(tabId);
        
        // Remove tab history
        this.history.delete(tabId);
        
        // Switch to another tab if needed
        if (isActiveTab) {
            // Clear activeTabId before switching to prevent saveCurrentTab() from trying to save to deleted tab
            this.activeTabId = null;
            
            if (nextTabId && this.tabs.has(nextTabId)) {
                this.switchToTab(nextTabId);
            } else {
                // If we couldn't find a valid next tab, clear editor
                this.editor.value = '';
                this.updateHighlight();
                this.updateLineNumbers();
            }
        }
    }

    saveCurrentTab() {
        if (!this.activeTabId) return;
        
        const tab = this.tabs.get(this.activeTabId);
        tab.content = this.editor.value;
    }

    onEditorInput() {
        this.updateHighlight();
        this.updateLineNumbers();
        this.saveCurrentTab();
        
        // Save to history (with debounce to avoid too many entries)
        if (!this.isUndoRedo) {
            clearTimeout(this.historyTimeout);
            this.historyTimeout = setTimeout(() => {
                this.saveToHistory();
            }, 300);
        }
        
        // Уведомление родителя об изменении кода (для сохранения в БД), debounce 600 ms
        if (window.parent && window.parent !== window) {
            clearTimeout(this.codeChangeNotifyTimeout);
            this.codeChangeNotifyTimeout = setTimeout(() => {
                this.notifyCodeChanged();
            }, 600);
        }
        
        this.updateAutocomplete();
    }

    onEditorScroll() {
        const scrollTop = this.editor.scrollTop;
        const scrollLeft = this.editor.scrollLeft;
        
        this.highlight.scrollTop = scrollTop;
        this.highlight.scrollLeft = scrollLeft;
        this.lineNumbers.scrollTop = scrollTop;
    }

    onEditorKeyDown(e) {
        // Auto-closing brackets and quotes - handle first to avoid conflicts
        // Handle brackets: (, [, {
        if ((e.key === '(' || e.key === '[' || e.key === '{') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const value = this.editor.value;
            
            if (start === end) {
                const bracketPairs = {
                    '(': ')',
                    '[': ']',
                    '{': '}'
                };
                const closing = bracketPairs[e.key];
                // Insert both opening and closing bracket
                this.editor.value = value.substring(0, start) + e.key + closing + value.substring(end);
                this.editor.setSelectionRange(start + 1, start + 1);
                e.preventDefault();
                this.onEditorInput();
                return;
            }
        }
        
        // Handle quotes: ", '
        if ((e.key === '"' || e.key === "'") && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const value = this.editor.value;
            
            if (start === end) {
                const nextChar = value.charAt(start);
                const closing = e.key; // For quotes, closing is the same as opening
                
                // If next character is already the closing quote, just move cursor forward
                if (nextChar === closing) {
                    this.editor.setSelectionRange(start + 1, start + 1);
                    e.preventDefault();
                    return;
                }
                
                // Check if we're in the middle of a word - don't auto-close if it's part of a word
                const charBefore = start > 0 ? value.charAt(start - 1) : '';
                const charAfter = value.charAt(start);
                
                // If before and after are word characters, don't auto-close
                if (/\w/.test(charBefore) && /\w/.test(charAfter)) {
                    // Just insert the quote, don't auto-close
                    this.editor.value = value.substring(0, start) + e.key + value.substring(end);
                    this.editor.setSelectionRange(start + 1, start + 1);
                    e.preventDefault();
                    this.onEditorInput();
                    return;
                }
                
                // Insert both opening and closing quote
                this.editor.value = value.substring(0, start) + e.key + closing + value.substring(end);
                this.editor.setSelectionRange(start + 1, start + 1);
                e.preventDefault();
                this.onEditorInput();
                return;
            }
        }
        
        // Handle construct autocompletion on space/enter after keywords
        if (e.key === ' ' || e.key === 'Enter') {
            const cursorPos = this.editor.selectionStart;
            const value = this.editor.value;
            const textBeforeCursor = value.substring(0, cursorPos);
            
            // Check for construct keywords at word boundary
            const constructMatch = textBeforeCursor.match(/\b(for|if|else|function)\s*$/i);
            if (constructMatch && !this.autocompleteVisible) {
                const keyword = constructMatch[1].toLowerCase();
                e.preventDefault();
                
                let snippet = '';
                if (keyword === 'for') {
                    snippet = 'for ${1:item} in ${2:iterable} do\n    ${3:// code}\nnext ${1:item}';
                } else if (keyword === 'if') {
                    snippet = 'if ${1:condition} do\n    ${2:// code}\nendif';
                } else if (keyword === 'else') {
                    // Check if we're after an if/else if
                    const beforeKeyword = textBeforeCursor.substring(0, textBeforeCursor.length - keyword.length - 1);
                    if (beforeKeyword.match(/\b(if|else)\s*$/i)) {
                        snippet = 'else if ${1:condition} do\n    ${2:// code}';
                    } else {
                        snippet = 'else\n    ${1:// code}';
                    }
                } else if (keyword === 'function') {
                    snippet = 'function ${1:name}(${2:parameters}) do\n    ${3:// code}\n    return ${4:value}\nendfunction';
                }
                
                if (snippet) {
                    const lines = textBeforeCursor.split('\n');
                    const currentLine = lines.length - 1;
                    const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
                    const indent = textBeforeCursor.substring(lineStart).match(/^(\s*)/)[1];
                    
                    const snippetLines = snippet.split('\n');
                    const processedSnippet = snippetLines.map((line, idx) => {
                        if (idx === 0) {
                            return line;
                        }
                        return indent + '    ' + line;
                    }).join('\n');
                    
                    // Replace placeholders
                    let finalSnippet = processedSnippet.replace(/\$\{(\d+):([^}]+)\}/g, '$2');
                    
                    const startPos = cursorPos - keyword.length;
                    this.editor.value = value.substring(0, startPos) + finalSnippet + value.substring(cursorPos);
                    
                    // Position cursor at first placeholder
                    const firstPlaceholder = processedSnippet.match(/\$\{1:([^}]+)\}/);
                    if (firstPlaceholder) {
                        const cursorOffset = startPos + processedSnippet.indexOf(firstPlaceholder[0]) + firstPlaceholder[1].length;
                        this.editor.setSelectionRange(cursorOffset, cursorOffset);
                    }
                    
                    this.onEditorInput();
                    return;
                }
            }
        }
        
        // Tab key - insert spaces
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const value = this.editor.value;
            
            if (e.shiftKey) {
                // Shift+Tab: remove indentation
                const lineStart = value.lastIndexOf('\n', start - 1) + 1;
                const lineEnd = value.indexOf('\n', end);
                const line = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);
                
                if (line.startsWith('    ')) {
                    this.editor.value = value.substring(0, lineStart) + line.substring(4) + value.substring(lineEnd === -1 ? value.length : lineEnd);
                    this.editor.setSelectionRange(start - 4, end - 4);
                }
            } else {
                // Tab: insert 4 spaces
                this.editor.value = value.substring(0, start) + '    ' + value.substring(end);
                this.editor.setSelectionRange(start + 4, start + 4);
            }
            
            this.onEditorInput();
            return;
        }
        
        // Handle auto-deletion of closing brackets/quotes when deleting opening ones
        if (e.key === 'Backspace' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const value = this.editor.value;
            
            if (start === end && start > 0) {
                const charBefore = value.charAt(start - 1);
                const charAfter = value.charAt(start);
                const allPairs = {
                    '(': ')',
                    '[': ']',
                    '{': '}',
                    "'": "'",
                    '"': '"'
                };
                
                // If deleting opening bracket/quote and next char is matching closing, delete both
                if (allPairs[charBefore] === charAfter) {
                    this.editor.value = value.substring(0, start - 1) + value.substring(start + 1);
                    this.editor.setSelectionRange(start - 1, start - 1);
                    e.preventDefault();
                    this.onEditorInput();
                    return;
                }
            }
        }
        
        // Undo/Redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            this.redo();
            return;
        }
        
        // Autocomplete navigation
        if (this.autocompleteVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.autocompleteIndex = Math.min(this.autocompleteIndex + 1, this.autocompleteItems.length - 1);
                this.updateAutocompleteSelection();
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.autocompleteIndex = Math.max(this.autocompleteIndex - 1, -1);
                this.updateAutocompleteSelection();
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.acceptAutocomplete();
                return;
            }
            if (e.key === 'Escape') {
                this.hideAutocomplete();
                return;
            }
        }
    }

    onEditorKeyUp(e) {
        this.updateCursorPosition();
    }

    updateCursorPosition() {
        const cursorPos = this.editor.selectionStart;
        const selectionEnd = this.editor.selectionEnd;
        const value = this.editor.value;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length - 1;

        // Hide native caret endpoints while text is selected (avoids "double caret" look)
        this.editor.style.caretColor = cursorPos !== selectionEnd
            ? 'transparent'
            : 'var(--neon-cyan)';
        
        this.updateCurrentLineHighlight(currentLine);
    }

    updateHighlight() {
        const code = this.editor.value;
        const scrollTop = this.editor.scrollTop;
        const scrollLeft = this.editor.scrollLeft;
        const highlighted = this.highlighter.highlight(code);
        
        // Wrap each line in a div for line highlighting
        const lines = highlighted.split('\n');
        const wrappedLines = lines.map((line, index) => 
            `<div class="code-line" data-line="${index}">${line || ' '}</div>`
        ).join('');
        
        this.highlight.innerHTML = wrappedLines;
        this.highlight.scrollTop = scrollTop;
        this.highlight.scrollLeft = scrollLeft;
        
        // Note: Visual hover effects are handled by CSS, no need to add event listeners here
        
        // Update current line highlight
        const cursorPos = this.editor.selectionStart;
        const textBeforeCursor = code.substring(0, cursorPos);
        const currentLine = textBeforeCursor.split('\n').length - 1;
        this.updateCurrentLineHighlight(currentLine);
    }

    updateCurrentLineHighlight(lineNumber) {
        // Remove old highlight
        document.querySelectorAll('.code-line.current-line').forEach(line => {
            line.classList.remove('current-line');
        });
        
        // Add highlight to current line
        const line = this.highlight.querySelector(`[data-line="${lineNumber}"]`);
        if (line) {
            line.classList.add('current-line');
        }
    }

    updateLineNumbers() {
        const lines = this.editor.value.split('\n');
        const lineNumbersHtml = lines.map((_, i) => 
            `<div>${i + 1}</div>`
        ).join('');
        this.lineNumbers.innerHTML = lineNumbersHtml;
    }

    // ============================================
    // Autocomplete
    // ============================================

    updateAutocomplete() {
        const cursorPos = this.editor.selectionStart;
        const value = this.editor.value;
        const textBeforeCursor = value.substring(0, cursorPos);
        
        // Find the current word being typed
        const wordMatch = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (!wordMatch) {
            this.hideAutocomplete();
            return;
        }
        
        const currentWord = wordMatch[1].toLowerCase();
        const suggestions = this.getAutocompleteSuggestions(currentWord, value);
        
        if (suggestions.length === 0) {
            this.hideAutocomplete();
            return;
        }
        
        this.autocompleteItems = suggestions;
        this.autocompleteIndex = -1;
        this.showAutocomplete(suggestions, cursorPos);
    }

    getAutocompleteSuggestions(currentWord, fullCode) {
        const suggestions = [];
        
        // Keywords with special handling for constructs
        this.highlighter.keywords.forEach(keyword => {
            if (keyword.toLowerCase().startsWith(currentWord)) {
                let description = 'Ключевое слово';
                let snippet = keyword;
                
                // Special snippets for constructs
                if (keyword === 'for') {
                    snippet = 'for ${1:item} in ${2:iterable} do\n    ${3:// code}\nnext ${1:item}';
                    description = 'Цикл for...in';
                } else if (keyword === 'if') {
                    snippet = 'if ${1:condition} do\n    ${2:// code}\nendif';
                    description = 'Условная конструкция if';
                } else if (keyword === 'else') {
                    // Check if we're after an if/else if
                    snippet = 'else\n    ${1:// code}';
                    description = 'Блок else';
                } else if (keyword === 'function') {
                    snippet = 'function ${1:name}(${2:parameters}) do\n    ${3:// code}\n    return ${4:value}\nendfunction';
                    description = 'Определение функции';
                }
                
                suggestions.push({
                    name: keyword,
                    type: 'keyword',
                    description: description,
                    snippet: snippet
                });
            }
        });
        
        // Add "else if" as a special suggestion when typing "else"
        if (currentWord === 'else' || currentWord.startsWith('else ')) {
            suggestions.push({
                name: 'else if',
                type: 'keyword',
                description: 'Условная конструкция else if',
                snippet: 'else if ${1:condition} do\n    ${2:// code}'
            });
        }
        
        // Built-in functions with parameter information
        this.highlighter.builtinFunctions.forEach(func => {
            if (func.toLowerCase().startsWith(currentWord)) {
                const funcDef = this.highlighter.getFunctionDefinition(func);
                let description = 'Встроенная функция';
                let signature = func + '()';
                
                if (funcDef) {
                    description = funcDef.description;
                    signature = funcDef.signature;
                    
                    // Create snippet with named parameters
                    if (funcDef.parameters.length > 0) {
                        const params = funcDef.parameters.map((param) => {
                            return `${param.name}=`;
                        }).join(', ');
                        signature = `${func}(${params})`;
                    }
                }
                
                suggestions.push({
                    name: func,
                    type: 'function',
                    description: description,
                    signature: signature,
                    funcDef: funcDef
                });
            }
        });
        
        // Variables from current code
        const tokens = this.highlighter.getTokens(fullCode);
        tokens.forEach(token => {
            if (token.toLowerCase().startsWith(currentWord) && 
                !suggestions.find(s => s.name.toLowerCase() === token.toLowerCase())) {
                suggestions.push({
                    name: token,
                    type: 'variable',
                    description: 'Переменная'
                });
            }
        });
        
        // Sort: keywords first, then functions, then variables
        suggestions.sort((a, b) => {
            const typeOrder = { keyword: 0, function: 1, variable: 2 };
            const orderA = typeOrder[a.type] || 3;
            const orderB = typeOrder[b.type] || 3;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });
        
        return suggestions.slice(0, 20);
    }

    showAutocomplete(suggestions, cursorPos) {
        this.autocompleteVisible = true;
        this.autocompleteList.innerHTML = '';
        
        suggestions.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.dataset.index = index;
            
            const icon = item.type === 'keyword' ? '🔑' : 
                        item.type === 'function' ? '⚙️' : '📝';
            
            // Show signature for functions
            let displayText = item.name;
            if (item.type === 'function' && item.signature) {
                displayText = item.signature;
            }
            
            div.innerHTML = `
                <span class="autocomplete-item-icon">${icon}</span>
                <div class="autocomplete-item-content">
                    <span class="autocomplete-item-name">${this.escapeHtml(displayText)}</span>
                    <span class="autocomplete-item-desc">${this.escapeHtml(item.description)}</span>
                    ${item.funcDef && item.funcDef.parameters.length > 0 ? 
                        `<div class="autocomplete-item-params">${item.funcDef.parameters.map(p => 
                            `${p.name}: ${p.type}${p.optional ? '?' : ''}`
                        ).join(', ')}</div>` : ''}
                </div>
            `;
            
            div.addEventListener('click', () => {
                this.autocompleteIndex = index;
                this.acceptAutocomplete();
            });
            
            // Add hover tooltip for functions
            if (item.type === 'function' && item.funcDef) {
                let tooltipTimeout = null;
                div.addEventListener('mouseenter', (e) => {
                    clearTimeout(tooltipTimeout);
                    tooltipTimeout = setTimeout(() => {
                        this.showFunctionTooltip(e.target, item.funcDef);
                    }, 300);
                });
                div.addEventListener('mouseleave', () => {
                    clearTimeout(tooltipTimeout);
                    tooltipTimeout = setTimeout(() => {
                        if (!this.functionTooltip || !this.functionTooltip.matches(':hover')) {
                            this.hideFunctionTooltip();
                        }
                    }, 200);
                });
            }
            
            this.autocompleteList.appendChild(div);
        });
        
        // Position autocomplete panel near cursor
        this.positionAutocomplete(cursorPos);
        this.autocompletePanel.classList.add('visible');
    }

    positionAutocomplete(cursorPos) {
        const value = this.editor.value;
        const textBeforeCursor = value.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length - 1;
        const lineText = lines[currentLine];
        
        // Calculate approximate cursor position
        const lineHeight = 22.4;
        const charWidth = 8.4;
        
        const rect = this.editor.getBoundingClientRect();
        const scrollTop = this.editor.scrollTop;
        const scrollLeft = this.editor.scrollLeft;
        
        // Calculate position
        const top = rect.top + (currentLine * lineHeight) - scrollTop + lineHeight + 4;
        const left = rect.left + (lineText.length * charWidth) - scrollLeft + 16;
        
        this.autocompletePanel.style.top = `${top}px`;
        this.autocompletePanel.style.left = `${left}px`;
        
        // Adjust if goes off screen
        setTimeout(() => {
            const panelRect = this.autocompletePanel.getBoundingClientRect();
            if (panelRect.right > window.innerWidth) {
                this.autocompletePanel.style.left = `${rect.left + 16}px`;
            }
            if (panelRect.bottom > window.innerHeight) {
                this.autocompletePanel.style.top = `${rect.top + (currentLine * lineHeight) - scrollTop - 200}px`;
            }
        }, 0);
    }

    updateAutocompleteSelection() {
        document.querySelectorAll('.autocomplete-item').forEach((item, index) => {
            if (index === this.autocompleteIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    acceptAutocomplete() {
        if (this.autocompleteIndex < 0 || this.autocompleteIndex >= this.autocompleteItems.length) {
            if (this.autocompleteItems.length > 0) {
                this.autocompleteIndex = 0;
            } else {
                return;
            }
        }
        
        const item = this.autocompleteItems[this.autocompleteIndex];
        const cursorPos = this.editor.selectionStart;
        const value = this.editor.value;
        const textBeforeCursor = value.substring(0, cursorPos);
        
        // Find the current word
        const wordMatch = textBeforeCursor.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (!wordMatch) {
            this.hideAutocomplete();
            return;
        }
        
        const startPos = cursorPos - wordMatch[1].length;
        const endPos = cursorPos;
        
        // Handle snippets for constructs
        if (item.snippet) {
            // Replace with snippet (simple placeholder replacement)
            const lines = textBeforeCursor.split('\n');
            const currentLine = lines.length - 1;
            const lineStart = textBeforeCursor.lastIndexOf('\n') + 1;
            const indent = textBeforeCursor.substring(lineStart).match(/^(\s*)/)[1];
            
            // Process snippet with indentation
            const snippetLines = item.snippet.split('\n');
            const processedSnippet = snippetLines.map((line, idx) => {
                if (idx === 0) {
                    return line;
                }
                // For "else if", don't add extra indent on first line
                if (item.name === 'else if' && idx === 1) {
                    return indent + line;
                }
                return indent + '    ' + line;
            }).join('\n');
            
            // Replace placeholders with simple text (basic implementation)
            let finalSnippet = processedSnippet.replace(/\$\{(\d+):([^}]+)\}/g, '$2');
            
            // For "else if", we need to handle it specially
            if (item.name === 'else if') {
                // Check if we need to replace "else" with "else if"
                const beforeWord = textBeforeCursor.substring(0, startPos);
                if (beforeWord.trim().endsWith('else')) {
                    const elseStart = beforeWord.lastIndexOf('else');
                    this.editor.value = value.substring(0, elseStart) + finalSnippet + value.substring(endPos);
                    const cursorOffset = elseStart + finalSnippet.indexOf('if') + 2 + 1; // After "if "
                    this.editor.setSelectionRange(cursorOffset, cursorOffset);
                } else {
                    this.editor.value = value.substring(0, startPos) + finalSnippet + value.substring(endPos);
                    const cursorOffset = startPos + finalSnippet.length;
                    this.editor.setSelectionRange(cursorOffset, cursorOffset);
                }
            } else {
                this.editor.value = value.substring(0, startPos) + finalSnippet + value.substring(endPos);
                
                // Position cursor after first placeholder
                const firstPlaceholder = processedSnippet.match(/\$\{1:([^}]+)\}/);
                if (firstPlaceholder) {
                    const cursorOffset = startPos + processedSnippet.indexOf(firstPlaceholder[0]) + firstPlaceholder[1].length;
                    this.editor.setSelectionRange(cursorOffset, cursorOffset);
                } else {
                    this.editor.setSelectionRange(startPos + finalSnippet.length, startPos + finalSnippet.length);
                }
            }
        } else if (item.type === 'function' && item.funcDef && item.funcDef.parameters.length > 0) {
            // Insert function with named parameters
            const params = item.funcDef.parameters.map((param) => 
                `${param.name}=`
            ).join(', ');
            const snippet = `${item.name}(${params})`;
            this.editor.value = value.substring(0, startPos) + snippet + value.substring(endPos);
            
            // Position cursor after first parameter name and equals sign
            const firstParamName = item.funcDef.parameters[0].name;
            const firstParamPos = startPos + item.name.length + 1 + firstParamName.length + 1; // +1 for '=', +1 for '('
            this.editor.setSelectionRange(firstParamPos, firstParamPos);
        } else {
            // Simple replacement
            this.editor.value = value.substring(0, startPos) + item.name + value.substring(endPos);
            this.editor.setSelectionRange(startPos + item.name.length, startPos + item.name.length);
        }
        
        this.hideAutocomplete();
        this.updateHighlight();
        this.updateLineNumbers();
        this.saveCurrentTab();
    }

    hideAutocomplete() {
        this.autocompleteVisible = false;
        this.autocompletePanel.classList.remove('visible');
        this.autocompleteIndex = -1;
    }

    // ============================================
    // Function Tooltip (Hover)
    // ============================================

    handleFunctionHover(e) {
        // Get mouse position relative to textarea
        const rect = this.editor.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate character position from mouse coordinates
        const scrollTop = this.editor.scrollTop;
        const scrollLeft = this.editor.scrollLeft;
        
        // Get computed styles for accurate measurements
        const computedStyle = getComputedStyle(this.editor);
        const lineHeight = parseFloat(computedStyle.lineHeight) || 22.4;
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 16;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 16;
        const fontSize = parseFloat(computedStyle.fontSize) || 14;
        
        // Approximate character width for monospace font
        const charWidth = fontSize * 0.6; // More accurate for monospace
        
        // Calculate which line we're on
        const relativeY = y + scrollTop - paddingTop;
        const lineIndex = Math.max(0, Math.floor(relativeY / lineHeight));
        const lines = this.editor.value.split('\n');
        
        if (lineIndex < 0 || lineIndex >= lines.length) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = setTimeout(() => {
                this.hideFunctionTooltip();
            }, 200);
            return;
        }
        
        const line = lines[lineIndex];
        
        // Calculate character position in line
        const relativeX = x + scrollLeft - paddingLeft;
        const charIndex = Math.max(0, Math.floor(relativeX / charWidth));
        
        if (charIndex < 0 || charIndex > line.length) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = setTimeout(() => {
                this.hideFunctionTooltip();
            }, 200);
            return;
        }
        
        // Find the word at this position
        const textBefore = line.substring(0, charIndex);
        const textAfter = line.substring(charIndex);
        
        // Match identifier before cursor (must start with letter or underscore)
        const beforeMatch = textBefore.match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
        // Match identifier after cursor (can continue with letters, numbers, underscore)
        const afterMatch = textAfter.match(/^([a-zA-Z0-9_]*)/);
        
        let word = '';
        let wordStart = -1;
        
        if (beforeMatch && afterMatch) {
            word = beforeMatch[1] + afterMatch[1];
            wordStart = charIndex - beforeMatch[1].length;
        } else if (beforeMatch) {
            word = beforeMatch[1];
            wordStart = charIndex - beforeMatch[1].length;
        } else if (afterMatch && /^[a-zA-Z_]/.test(afterMatch[1])) {
            // Only if it starts with letter or underscore
            word = afterMatch[1];
            wordStart = charIndex;
        }
        
        // Check if it's a built-in function
        if (word && wordStart >= 0) {
            const funcName = word.toLowerCase();
            const funcDef = this.highlighter.getFunctionDefinition(funcName);
            
            if (funcDef) {
                clearTimeout(this.tooltipTimeout);
                
                // Find the corresponding element in highlight for positioning
                const highlightLines = this.highlight.querySelectorAll('.code-line');
                const highlightLine = highlightLines[lineIndex];
                
                if (highlightLine) {
                    // Find the builtin span in this line that matches our word position
                    const builtinSpans = highlightLine.querySelectorAll('.builtin');
                    let targetSpan = null;
                    
                    for (const span of builtinSpans) {
                        const spanText = span.textContent.trim();
                        const spanFuncName = span.getAttribute('data-function') || spanText.toLowerCase();
                        
                        // Check if this span contains our word and is at the right position
                        if (spanFuncName === funcName) {
                            // Verify position by checking if the span starts at our word position
                            const spanParent = span.parentElement;
                            if (spanParent) {
                                const spanIndex = Array.from(spanParent.childNodes).indexOf(span);
                                // Simple check: if span contains the function name, use it
                                targetSpan = span;
                                break;
                            }
                        }
                    }
                    
                    if (targetSpan) {
                        this.tooltipTimeout = setTimeout(() => {
                            this.showFunctionTooltip(targetSpan, funcDef);
                        }, 300);
                        return;
                    }
                }
                
                // Fallback: create a temporary element for positioning based on calculated position
                const tempElement = document.createElement('span');
                tempElement.style.position = 'absolute';
                tempElement.style.left = `${rect.left + paddingLeft + (wordStart * charWidth) - scrollLeft}px`;
                tempElement.style.top = `${rect.top + paddingTop + (lineIndex * lineHeight) - scrollTop}px`;
                tempElement.style.visibility = 'hidden';
                tempElement.style.pointerEvents = 'none';
                document.body.appendChild(tempElement);
                
                this.tooltipTimeout = setTimeout(() => {
                    this.showFunctionTooltip(tempElement, funcDef);
                    setTimeout(() => tempElement.remove(), 100);
                }, 300);
            } else {
                clearTimeout(this.tooltipTimeout);
                this.tooltipTimeout = setTimeout(() => {
                    this.hideFunctionTooltip();
                }, 200);
            }
        } else {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = setTimeout(() => {
                this.hideFunctionTooltip();
            }, 200);
        }
    }

    getCategoryName(category) {
        const categoryNames = {
            'system': 'Система',
            'file': 'Файлы',
            'math': 'Математика',
            'array': 'Массивы',
            'string': 'Строки',
            'table': 'Таблицы',
            'filter': 'Фильтрация',
            'iteration': 'Итерация'
        };
        return categoryNames[category] || category;
    }

    showFunctionTooltip(element, funcDef) {
        // Remove existing tooltip
        this.hideFunctionTooltip();
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'function-tooltip';
        const categoryName = this.getCategoryName(funcDef.category);
        tooltip.innerHTML = `
            <div class="function-tooltip-header">
                <span class="function-tooltip-name">${this.escapeHtml(funcDef.signature)}</span>
                <span class="function-tooltip-category">${this.escapeHtml(categoryName)}</span>
            </div>
            <div class="function-tooltip-description">${this.escapeHtml(funcDef.description)}</div>
            ${funcDef.parameters.length > 0 ? `
                <div class="function-tooltip-params">
                    <div class="function-tooltip-params-title">Параметры:</div>
                    ${funcDef.parameters.map(param => `
                        <div class="function-tooltip-param">
                            <span class="function-tooltip-param-name">${this.escapeHtml(param.name)}</span>
                            <span class="function-tooltip-param-type">${this.escapeHtml(param.type)}${param.optional ? ' (опционально)' : ''}</span>
                            <div class="function-tooltip-param-desc">${this.escapeHtml(param.description)}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="function-tooltip-return">
                <span class="function-tooltip-return-label">Возвращает:</span>
                <span class="function-tooltip-return-type">${this.escapeHtml(funcDef.returnType)}</span>
            </div>
        `;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip relative to the function element
        const rect = element.getBoundingClientRect();
        
        // Position below the element by default (position: fixed uses viewport coordinates)
        tooltip.style.position = 'fixed';
        tooltip.style.top = `${rect.bottom + 8}px`;
        tooltip.style.left = `${rect.left}px`;
        
        // Adjust if goes off screen
        setTimeout(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Adjust horizontal position
            if (tooltipRect.right > viewportWidth) {
                tooltip.style.left = `${viewportWidth - tooltipRect.width - 16}px`;
            }
            if (tooltipRect.left < 0) {
                tooltip.style.left = '16px';
            }
            
            // Adjust vertical position
            if (tooltipRect.bottom > viewportHeight) {
                // Show above the element instead
                tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
            }
            if (tooltipRect.top < 0) {
                tooltip.style.top = '16px';
            }
        }, 0);
        
        // Keep tooltip visible when hovering over it
        tooltip.addEventListener('mouseenter', () => {
            clearTimeout(this.tooltipTimeout);
        });
        
        tooltip.addEventListener('mouseleave', () => {
            this.tooltipTimeout = setTimeout(() => {
                this.hideFunctionTooltip();
            }, 200);
        });
        
        this.functionTooltip = tooltip;
    }

    hideFunctionTooltip() {
        clearTimeout(this.tooltipTimeout);
        if (this.functionTooltip) {
            this.functionTooltip.remove();
            this.functionTooltip = null;
        }
    }

    // ============================================
    // History (Undo/Redo)
    // ============================================

    saveToHistory() {
        if (!this.activeTabId || this.isUndoRedo) return;
        
        const content = this.editor.value;
        const tabHistory = this.history.get(this.activeTabId);
        
        if (!tabHistory) {
            this.history.set(this.activeTabId, {
                undo: [content],
                redo: [],
                currentIndex: 0
            });
            return;
        }
        
        // Don't save if same as current
        if (tabHistory.undo[tabHistory.currentIndex] === content) {
            return;
        }
        
        // Remove any future history if we're not at the end
        if (tabHistory.currentIndex < tabHistory.undo.length - 1) {
            tabHistory.undo = tabHistory.undo.slice(0, tabHistory.currentIndex + 1);
        }
        
        // Add new state
        tabHistory.undo.push(content);
        tabHistory.currentIndex = tabHistory.undo.length - 1;
        tabHistory.redo = []; // Clear redo stack
        
        // Limit history size (keep last 50 states)
        if (tabHistory.undo.length > 50) {
            tabHistory.undo.shift();
            tabHistory.currentIndex = tabHistory.undo.length - 1;
        }
    }

    undo() {
        if (!this.activeTabId) return;
        
        const tabHistory = this.history.get(this.activeTabId);
        if (!tabHistory || tabHistory.currentIndex <= 0) {
            return; // Nothing to undo
        }
        
        // Save current state to redo
        const currentContent = this.editor.value;
        if (tabHistory.undo[tabHistory.currentIndex] !== currentContent) {
            // Current content differs from history, save it first
            tabHistory.undo.push(currentContent);
            tabHistory.currentIndex = tabHistory.undo.length - 1;
        }
        
        // Move to previous state
        tabHistory.currentIndex--;
        const previousContent = tabHistory.undo[tabHistory.currentIndex];
        
        // Add to redo stack
        if (currentContent !== previousContent) {
            tabHistory.redo.push(currentContent);
        }
        
        // Restore previous state
        this.isUndoRedo = true;
        this.editor.value = previousContent;
        this.updateHighlight();
        this.updateLineNumbers();
        this.saveCurrentTab();
        this.isUndoRedo = false;
    }

    redo() {
        if (!this.activeTabId) return;
        
        const tabHistory = this.history.get(this.activeTabId);
        if (!tabHistory || tabHistory.redo.length === 0) {
            return; // Nothing to redo
        }
        
        // Save current state
        const currentContent = this.editor.value;
        
        // Get next state from redo stack
        const nextContent = tabHistory.redo.pop();
        
        // Add current to undo if different
        if (currentContent !== tabHistory.undo[tabHistory.currentIndex]) {
            tabHistory.undo.push(currentContent);
            tabHistory.currentIndex = tabHistory.undo.length - 1;
        }
        
        // Add next state to undo
        tabHistory.undo.push(nextContent);
        tabHistory.currentIndex = tabHistory.undo.length - 1;
        
        // Restore next state
        this.isUndoRedo = true;
        this.editor.value = nextContent;
        this.updateHighlight();
        this.updateLineNumbers();
        this.saveCurrentTab();
        this.isUndoRedo = false;
    }

    // ============================================
    // Search
    // ============================================

    showSearchPanel() {
        this.searchPanel.classList.add('visible');
        this.searchInput.focus();
        this.searchInput.select();
    }

    hideSearchPanel() {
        this.searchPanel.classList.remove('visible');
        this.editor.focus();
    }

    performSearch() {
        const query = this.searchInput.value;
        if (!query) {
            this.updateHighlight();
            return;
        }
        // Simple search - just update highlight
        this.updateHighlight();
    }

    searchNext() {
        // Implementation for next search result
    }

    searchPrev() {
        // Implementation for previous search result
    }

    // ============================================
    // Console
    // ============================================

    toggleConsole() {
        this.consolePanel.classList.toggle('hidden');
    }

    resizeConsole(delta) {
        const minHeight = 100;
        const maxHeight = window.innerHeight * 0.8; // Max 80% of viewport height
        
        this.consoleHeight = Math.max(minHeight, Math.min(maxHeight, this.consoleHeight + delta));
        this.consolePanel.style.height = `${this.consoleHeight}px`;
        
        // Save preference to localStorage
        try {
            localStorage.setItem('datacode_console_height', this.consoleHeight.toString());
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    startResizeConsole(e) {
        e.preventDefault();
        this.isResizing = true;
        if (this.consoleResizeHandle) this.consoleResizeHandle.style.cursor = 'row-resize';
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    }

    onResizeConsole(e) {
        if (!this.isResizing) return;
        
        e.preventDefault();
        const viewportHeight = window.innerHeight;
        const mouseY = e.clientY;
        const panelRect = this.consolePanel.getBoundingClientRect();
        const newHeight = viewportHeight - mouseY;
        
        const minHeight = 100;
        const maxHeight = viewportHeight * 0.8;
        
        this.consoleHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
        this.consolePanel.style.height = `${this.consoleHeight}px`;
    }

    stopResizeConsole() {
        if (!this.isResizing) return;
        
        this.isResizing = false;
        if (this.consoleResizeHandle) this.consoleResizeHandle.style.cursor = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Save preference to localStorage
        try {
            localStorage.setItem('datacode_console_height', this.consoleHeight.toString());
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    loadConsoleHeight() {
        try {
            const savedHeight = localStorage.getItem('datacode_console_height');
            if (savedHeight) {
                const height = parseInt(savedHeight, 10);
                if (height >= 100 && height <= window.innerHeight * 0.8) {
                    this.consoleHeight = height;
                    this.consolePanel.style.height = `${this.consoleHeight}px`;
                }
            }
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    logToConsole(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = message;
        this.consoleContent.appendChild(line);
        this.consoleContent.scrollTop = this.consoleContent.scrollHeight;
    }

    // ============================================
    // Compilation
    // ============================================

    async compileCode() {
        // Save current tab content before compiling
        if (this.activeTabId) {
            this.saveCurrentTab();
        }

        // Get all tabs in DOM order (this is the order they appear in the sidebar)
        const tabItems = Array.from(this.tabsList.querySelectorAll('.tab-item'));
        const tabIdsInOrder = tabItems
            .map(item => item.dataset.tabId)
            .filter(tabId => this.tabs.has(tabId));

        if (tabIdsInOrder.length === 0) {
            this.logToConsole('Нет вкладок для компиляции', 'warning');
            return;
        }

        const activeIndex = this.activeTabId ? tabIdsInOrder.indexOf(this.activeTabId) : 0;
        const endIndex = activeIndex >= 0 ? activeIndex : tabIdsInOrder.length - 1;
        const compiledCode = this.getCompiledCodeFromTabs(true);
        const activeTab = this.tabs.get(tabIdsInOrder[endIndex]);
        const compileRangeLabel = tabIdsInOrder.length > 1
            ? `вкладки 1–${endIndex + 1} («${activeTab?.name || ''}»)`
            : (activeTab?.name || 'активная вкладка');

        // Show console if hidden
        if (this.consolePanel.classList.contains('hidden')) {
            this.consolePanel.classList.remove('hidden');
        }

        // Show loading state
        this.logToConsole(`=== Компиляция: ${compileRangeLabel} ===`, 'info');
        this.logToConsole('Ожидание ответа от сервера...', 'info');
        this.logToConsole('', 'info');

        // Disable compile button during execution
        const compileBtn = this.compileBtn;
        const originalText = compileBtn.innerHTML;
        compileBtn.disabled = true;
        compileBtn.style.opacity = '0.6';
        compileBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>';

        try {
            // ✅ Безопасный метод: используем прокси вместо прямой передачи токена
            const payload = {
                code: compiledCode
            };
            
            // Добавляем файлы для загрузки, если они были установлены
            if (this.filesToUpload && this.filesToUpload.length > 0) {
                payload.files = this.filesToUpload;
                            } else if (this.fileToUpload) {
                payload.files = [this.fileToUpload];
                            }
            
            let result;
            if (this.modelId != null && window.parent && window.parent !== window) {
                const requestId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const response = await new Promise((resolve, reject) => {
                    this.executeForModelPending.set(requestId, { resolve, reject });
                    window.parent.postMessage({
                        type: 'EXECUTE_FOR_MODEL',
                        requestId: requestId,
                        modelId: this.modelId,
                        code: payload.code,
                        files: payload.files || null
                    }, window.location.origin);
                    setTimeout(() => {
                        if (this.executeForModelPending.has(requestId)) {
                            this.executeForModelPending.delete(requestId);
                            reject(new Error('Request timeout'));
                        }
                    }, 30000);
                });
                result = response.data;
            } else {
                const res = await this.makeApiRequest('POST', '/api/datacode/execute', payload);
                result = res.data;
            }

            // Clear previous output
            this.consoleContent.innerHTML = '';

            if (result.success) {
                this.logToConsole('=== Выполнение завершено успешно ===', 'success');
                this.logToConsole('', 'info');
                
                if (result.output) {
                    this.logToConsole('--- Вывод ---', 'info');
                    const outputLines = result.output.split('\n');
                    outputLines.forEach(line => {
                        this.logToConsole(line, 'info');
                    });
                    this.logToConsole('', 'info');
                }
            } else {
                this.logToConsole('=== Ошибка выполнения ===', 'error');
                this.logToConsole('', 'error');
                
                if (result.error) {
                    this.logToConsole(`Ошибка: ${result.error}`, 'error');
                }
                
                if (result.output) {
                    this.logToConsole('', 'error');
                    this.logToConsole('--- Вывод (может содержать ошибки) ---', 'error');
                    const outputLines = result.output.split('\n');
                    outputLines.forEach(line => {
                        this.logToConsole(line, 'error');
                    });
                }
            }

            this.logToConsole('', 'info');
            this.logToConsole('=== Конец выполнения ===', 'info');

        } catch (error) {
            this.logToConsole('=== Ошибка при отправке запроса ===', 'error');
            this.logToConsole(`Ошибка: ${error.message}`, 'error');
            this.logToConsole('', 'error');
            this.logToConsole('Проверьте подключение к серверу и настройки API', 'error');
        } finally {
            // Re-enable compile button
            compileBtn.disabled = false;
            compileBtn.style.opacity = '1';
            compileBtn.innerHTML = originalText;
        }
    }

    /**
     * Get authentication token from parent memory bridge.
     * Works with parent window if in iframe.
     */
    getAuthToken() {
        try {
            if (typeof window.__getAccessToken__ === 'function') {
                const t = window.__getAccessToken__();
                if (t) return t;
            }
            if (window.parent && window.parent !== window) {
                try {
                    if (typeof window.parent.__getAccessToken__ === 'function') {
                        const t = window.parent.__getAccessToken__();
                        if (t) return t;
                    }
                } catch (e) {
                    return null;
                }
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    // ============================================
    // Utilities
    // ============================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    onResize() {
        this.syncEditorLayout();
        this.updateLineNumbers();
    }
}

// Initialize editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new DataCodeEditor();
    
    // Example: log welcome message
    setTimeout(() => {
        window.editor.logToConsole('DataCode Editor готов к работе', 'info');
        window.editor.logToConsole('Нажмите Ctrl+F для поиска', 'info');
        window.editor.logToConsole('Нажмите Ctrl+Z для отмены', 'info');
        window.editor.logToConsole('Нажмите Ctrl+Y для повтора', 'info');
        window.editor.logToConsole('Используйте кнопки ↑/↓ или перетаскивайте верхнюю границу для изменения высоты консоли', 'info');
    }, 500);
});
