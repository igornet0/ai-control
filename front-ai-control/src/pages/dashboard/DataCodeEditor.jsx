import React, { useState, useEffect, useRef } from 'react';
import CodeMirrorEditor from './CodeMirrorEditor';
// import { dataCode } from './cm/dataCodeSupport';
import { DataCodeRuntime } from '../../grammar/DataCodeRuntime';
import { XMarkIcon, PlusIcon, PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import codeExecutionService from '../../services/codeExecutionService';

const DataCodeEditor = ({ isOpen, onClose, code, setCode }) => {
  const [tabs, setTabs] = useState([{ name: 'Tab 1', content: code }]);
  const [activeTab, setActiveTab] = useState(0);
  const [editingTabIndex, setEditingTabIndex] = useState(null);
  const [draggingTab, setDraggingTab] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, tabIndex: null });
  const [dragOverTabIndex, setDragOverTabIndex] = useState(null);
  const [script, setScript] = useState('');
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);

  // Code execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionId, setExecutionId] = useState(null);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  // Refs
  const logsEndRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu({ ...contextMenu, visible: false });
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
    }, [contextMenu]);

    useEffect(() => {
  const currentTab = tabs[activeTab];
  if (currentTab && currentTab.content !== code) {
    setCode(currentTab.content);
  }
}, [activeTab]);



  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionLogs]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      codeExecutionService.disconnectAll();
    };
  }, []);

    const run = () => {
    try {
      const rt = new DataCodeRuntime();
      const res = rt.run(script);
      setOutput({ globals: rt.globals, locals: rt.locals, return: res });
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };

  // Code execution functions
  const handleExecuteCode = async () => {
    if (isExecuting) return;

    try {
      setIsExecuting(true);
      setExecutionLogs([]);
      setShowLogs(true);
      setError(null);

      // Collect all tabs with content
      const tabsWithContent = tabs.filter(tab => tab.content && tab.content.trim());

      if (tabsWithContent.length === 0) {
        setError('No code found to execute. Please add some code to at least one tab.');
        return;
      }

      // Add initial log
      addExecutionLog({
        type: 'info',
        message: `Preparing to execute ${tabsWithContent.length} tab(s) with python...`,
        timestamp: new Date().toISOString()
      });

      // Submit code for execution
      const response = await codeExecutionService.executeCode({
        tabs: tabsWithContent,
        language: 'python'
      });

      const newExecutionId = response.execution_id;
      setExecutionId(newExecutionId);

      addExecutionLog({
        type: 'success',
        message: `Code execution queued with ID: ${newExecutionId}`,
        timestamp: new Date().toISOString()
      });

      // Connect to WebSocket for real-time updates
      wsRef.current = codeExecutionService.connectToExecution(newExecutionId, {
        onMessage: handleWebSocketMessage,
        onOpen: () => {
          addExecutionLog({
            type: 'info',
            message: 'Connected to execution stream',
            timestamp: new Date().toISOString()
          });
        },
        onClose: () => {
          addExecutionLog({
            type: 'info',
            message: 'Execution stream closed',
            timestamp: new Date().toISOString()
          });
          setIsExecuting(false);
        },
        onError: (error) => {
          addExecutionLog({
            type: 'error',
            message: `WebSocket error: ${error.message || 'Unknown error'}`,
            timestamp: new Date().toISOString()
          });
        }
      });

    } catch (error) {
      setError(error.response?.data?.detail || error.message || 'Failed to execute code');
      addExecutionLog({
        type: 'error',
        message: `Execution failed: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date().toISOString()
      });
      setIsExecuting(false);
    }
  };

  const handleStopExecution = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (executionId) {
      codeExecutionService.disconnectFromExecution(executionId);
    }
    setIsExecuting(false);
    addExecutionLog({
      type: 'warning',
      message: 'Execution stopped by user',
      timestamp: new Date().toISOString()
    });
  };

  const handleWebSocketMessage = (data) => {

    switch (data.type) {
      case 'connection_established':
        addExecutionLog({
          type: 'success',
          message: data.message,
          timestamp: data.timestamp || new Date().toISOString()
        });
        break;

      case 'execution_started':
        addExecutionLog({
          type: 'info',
          message: `Starting ${data.language} execution...`,
          timestamp: data.timestamp || new Date().toISOString()
        });
        break;

      case 'execution_update':
        handleExecutionUpdate(data);
        break;

      case 'execution_finished':
        addExecutionLog({
          type: 'success',
          message: 'Code execution completed successfully',
          timestamp: data.timestamp || new Date().toISOString()
        });
        setIsExecuting(false);
        break;

      case 'execution_error':
        addExecutionLog({
          type: 'error',
          message: `Execution error: ${data.error || data.message}`,
          timestamp: data.timestamp || new Date().toISOString()
        });
        setIsExecuting(false);
        break;

      default:
        // Handle unknown message types
        break;
    }
  };

  const handleExecutionUpdate = (data) => {
    switch (data.status) {
      case 'starting':
      case 'compiling':
      case 'executing':
        addExecutionLog({
          type: 'info',
          message: data.message,
          timestamp: data.timestamp
        });
        break;

      case 'compilation_success':
        addExecutionLog({
          type: 'success',
          message: data.message,
          timestamp: data.timestamp
        });
        break;

      case 'compilation_error':
        addExecutionLog({
          type: 'error',
          message: `Compilation Error: ${data.error}`,
          timestamp: data.timestamp,
          line: data.line,
          column: data.column
        });
        break;

      case 'output':
        addExecutionLog({
          type: data.stream === 'stderr' ? 'error' : 'output',
          message: data.content,
          timestamp: data.timestamp,
          stream: data.stream
        });
        break;

      case 'completed':
        addExecutionLog({
          type: data.return_code === 0 ? 'success' : 'error',
          message: data.message,
          timestamp: data.timestamp,
          returnCode: data.return_code
        });
        break;

      case 'timeout':
        addExecutionLog({
          type: 'error',
          message: data.error,
          timestamp: data.timestamp
        });
        break;

      case 'error':
        addExecutionLog({
          type: 'error',
          message: data.error || data.message,
          timestamp: data.timestamp
        });
        break;
    }
  };

  const addExecutionLog = (logEntry) => {
    setExecutionLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      ...logEntry
    }]);
  };

  const clearLogs = () => {
    setExecutionLogs([]);
  };

  // Helper functions for log styling
  const getLogClassName = (type) => {
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'success':
        return 'text-green-400';
      case 'output':
        return 'text-white';
      case 'info':
      default:
        return 'text-gray-300';
    }
  };

  const getLogTypeColor = (type) => {
    switch (type) {
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'success':
        return 'text-green-500';
      case 'output':
        return 'text-blue-400';
      case 'info':
      default:
        return 'text-gray-400';
    }
  };

  const handleTabDrop = (dropIndex) => {
    if (draggingTab === null || draggingTab === dropIndex) return;
    const updatedTabs = [...tabs];
    const [movedTab] = updatedTabs.splice(draggingTab, 1);
    updatedTabs.splice(dropIndex, 0, movedTab);
    setTabs(updatedTabs);
    setDraggingTab(null);
    setDragOverTabIndex(null);
    };

    const handleContextMenu = (e, index) => {
    e.preventDefault();
    setContextMenu({
        visible: true,
        x: e.pageX,
        y: e.pageY,
        tabIndex: index,
    });
    };

    const handleRenameFromContext = () => {
    setEditingTabIndex(contextMenu.tabIndex);
    setContextMenu({ ...contextMenu, visible: false });
    };

    const handleDeleteFromContext = () => {
    const updatedTabs = tabs.filter((_, i) => i !== contextMenu.tabIndex);
    setTabs(updatedTabs);

    const newActive = contextMenu.tabIndex >= updatedTabs.length
        ? updatedTabs.length - 1
        : contextMenu.tabIndex;
    setActiveTab(newActive >= 0 ? newActive : 0);

    setContextMenu({ ...contextMenu, visible: false });
    };

  if (!isOpen) return null;

  const handleAddTab = () => {
    const newTab = { name: `Tab ${tabs.length + 1}`, content: '' };
    setTabs([...tabs, newTab]);
    setActiveTab(tabs.length);
  };

  const handleTabClick = (index) => setActiveTab(index);

  const handleTabRename = (index, newName) => {
    const updatedTabs = [...tabs];
    updatedTabs[index].name = newName;
    setTabs(updatedTabs);
  };

  const handleTabContentChange = (value) => {
    const updatedTabs = [...tabs];
    updatedTabs[activeTab].content = value;
    setTabs(updatedTabs);
    setCode(value); 
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-md shadow-lg w-[1200px] h-[800px] max-w-full p-0 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            {/* Execution Controls */}
            <button
              onClick={isExecuting ? handleStopExecution : handleExecuteCode}
              disabled={tabs.every(tab => !tab.content?.trim())}
              className={`flex items-center px-4 py-2 rounded-md font-medium transition-colors ${
                isExecuting
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed'
              }`}
            >
              {isExecuting ? (
                <>
                  <StopIcon className="w-4 h-4 mr-2" />
                  Stop Execution
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4 mr-2" />
                  Execute Code
                </>
              )}
            </button>

            {/* Show/Hide Logs Toggle */}
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`px-3 py-2 rounded-md text-sm transition-colors ${
                showLogs
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
              {executionLogs.length > 0 && (
                <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {executionLogs.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Execution Status */}
            {isExecuting && (
              <div className="flex items-center text-yellow-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                <span className="text-sm">Executing...</span>
              </div>
            )}

            {executionId && (
              <span className="text-xs text-gray-400">
                ID: {executionId.slice(-8)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-1">
        {/* Tabs Panel */}
        <div className="w-48 bg-gray-900 border-r border-gray-700 p-3 flex flex-col">
          <button
            onClick={handleAddTab}
            className="flex items-center mb-3 text-white hover:text-green-400"
          >
            <PlusIcon className="h-5 w-5 mr-1" />
            Add Tab
          </button>
          <div className="flex-1 overflow-y-auto space-y-1 max-h-[400px] scrollbar-thin scrollbar-thumb-gray-600">
            {tabs.map((tab, index) => (
                <div
                    key={index}
                    className={`p-2 rounded cursor-pointer select-none relative transition-colors ${
                        activeTab === index
                        ? 'bg-green-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    draggable
                    onDragStart={() => setDraggingTab(index)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverTabIndex(index);
                    }}
                    onDragLeave={() => setDragOverTabIndex(null)}
                    onDrop={() => handleTabDrop(index)}
                    onClick={() => handleTabClick(index)}
                    onDoubleClick={() => setEditingTabIndex(index)}
                    onContextMenu={(e) => handleContextMenu(e, index)}
                    >
                    {dragOverTabIndex === index && (
                        <div className="absolute inset-0 border-2 border-blue-400 rounded z-10 pointer-events-none" />
                    )}

                    {editingTabIndex === index ? (
                        <input
                        type="text"
                        className="w-full px-1 py-0.5 text-sm rounded text-black"
                        defaultValue={tab.name}
                        autoFocus
                        onBlur={(e) => {
                            handleTabRename(index, e.target.value);
                            setEditingTabIndex(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                            handleTabRename(index, e.target.value);
                            setEditingTabIndex(null);
                            }
                        }}
                        />
                    ) : (
                        tab.name
                    )}
                    </div>
                ))}
          </div>
        </div>

        {/* Code Editor Area */}
        <div className="flex-1 flex flex-col">
          {/* Editor Section */}
          <div className={`flex flex-col p-6 ${showLogs ? 'h-1/2' : 'flex-1'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-green-400">
                {tabs[activeTab]?.name || 'Unnamed'}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200"
                title="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1">
              <CodeMirrorEditor
                key={activeTab}
                value={tabs[activeTab]?.content || ''}
                onChange={handleTabContentChange}
              />
            </div>
          </div>

          {/* Logs Section */}
          {showLogs && (
            <div className="h-1/2 border-t border-gray-700 flex flex-col">
              <div className="flex justify-between items-center p-4 bg-gray-800 border-b border-gray-700">
                <h4 className="text-lg font-medium text-green-400">Execution Logs</h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearLogs}
                    className="text-sm px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-900 font-mono text-sm">
                {executionLogs.length === 0 ? (
                  <div className="text-gray-500 italic">No logs yet. Execute some code to see output here.</div>
                ) : (
                  <div className="space-y-1">
                    {executionLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex items-start space-x-2 ${getLogClassName(log.type)}`}
                      >
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`text-xs font-bold ${getLogTypeColor(log.type)}`}>
                          [{log.type.toUpperCase()}]
                        </span>
                        <span className="flex-1 whitespace-pre-wrap break-words">
                          {log.message}
                          {log.line && (
                            <span className="text-yellow-400"> (Line: {log.line})</span>
                          )}
                          {log.returnCode !== undefined && (
                            <span className={`ml-2 ${log.returnCode === 0 ? 'text-green-400' : 'text-red-400'}`}>
                              [Exit: {log.returnCode}]
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
        {contextMenu.visible && (
            <div
                className="absolute bg-gray-800 border border-gray-700 rounded shadow-lg z-50"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <button
                className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-white"
                onClick={handleRenameFromContext}
                >
                ✏️ Изменить
                </button>
                <button
                className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-red-400"
                onClick={handleDeleteFromContext}
                >
                🗑 Удалить
                </button>
            </div>
            )}
      </div>
    </div>
  );
};

export default DataCodeEditor;