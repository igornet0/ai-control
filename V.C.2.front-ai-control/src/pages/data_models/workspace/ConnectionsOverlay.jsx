import React, { useEffect, useState, useRef, useId } from 'react';
import { eventBus } from './core/EventBus.js';
import { connectionPointKey, normalizeConnection } from './widgetIdUtils.js';
import styles from './ConnectionsOverlay.module.css';

/**
 * ConnectionsOverlay - Компонент для отрисовки соединений между виджетами
 */
const ConnectionsOverlay = ({ workspaceRef, viewportRef, engineRef, engineReady = false }) => {
  const svgRef = useRef(null);
  const arrowMarkerId = useId().replace(/:/g, '');
  const [connections, setConnections] = useState([]);
  const [tempConnection, setTempConnection] = useState(null);
  const [connectionPoints, setConnectionPoints] = useState(new Map());
  const [isConnecting, setIsConnecting] = useState(false);

  // Обновление позиций точек подключения
  const updateConnectionPoints = () => {
    if (!workspaceRef.current || !engineRef.current || !viewportRef.current) return;

    const points = new Map();
    const widgets = engineRef.current.widgetManager.getAllWidgets();
    const viewportRect = viewportRef.current.getBoundingClientRect();

    widgets.forEach(widget => {
      if (!widget.element) return;

      // Находим handles
      const inputHandle = widget.element.querySelector('.connection-handle.input-handle');
      const outputHandle = widget.element.querySelector('.connection-handle.output-handle');

      if (inputHandle) {
        const handleRect = inputHandle.getBoundingClientRect();
        // Позиция относительно viewport
        const x = handleRect.left + handleRect.width / 2 - viewportRect.left;
        const y = handleRect.top + handleRect.height / 2 - viewportRect.top;
        points.set(connectionPointKey(widget.id, 'input'), { x, y, widgetId: widget.id, type: 'input' });
      }

      if (outputHandle) {
        const handleRect = outputHandle.getBoundingClientRect();
        // Позиция относительно viewport
        const x = handleRect.left + handleRect.width / 2 - viewportRect.left;
        const y = handleRect.top + handleRect.height / 2 - viewportRect.top;
        points.set(connectionPointKey(widget.id, 'output'), { x, y, widgetId: widget.id, type: 'output' });
      }
    });

    setConnectionPoints(points);
  };

  // Загрузка соединений из движка
  const loadConnections = () => {
    if (!engineRef.current) return;

    const allConnections = engineRef.current.getAllConnections().map(normalizeConnection);
    setConnections(allConnections);
  };

  // Отрисовка линии соединения
  const renderConnection = (connection) => {
    const fromPoint = connectionPoints.get(connectionPointKey(connection.from, 'output'));
    const toPoint = connectionPoints.get(connectionPointKey(connection.to, 'input'));

    if (!fromPoint || !toPoint) return null;

    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Кривая Безье для плавной линии
    const cp1x = fromPoint.x + distance * 0.5;
    const cp1y = fromPoint.y;
    const cp2x = toPoint.x - distance * 0.5;
    const cp2y = toPoint.y;

    const path = `M ${fromPoint.x} ${fromPoint.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPoint.x} ${toPoint.y}`;

    return (
      <g key={connection.id} className={styles.connectionGroup}>
        <path
          d={path}
          className={styles.connectionPath}
          stroke="#00E0FF"
          strokeWidth="2"
          fill="none"
          markerEnd={`url(#${arrowMarkerId})`}
          title="Правый клик — удалить соединение"
        />
        {/* Hitbox только для удаления (ПКМ). Настройки соединения убраны. */}
        {!isConnecting && (
          <g style={{ pointerEvents: 'all' }}>
            <path
              d={path}
              className={styles.connectionHitbox}
              strokeWidth="20"
              fill="none"
              style={{ 
                cursor: 'context-menu',
                opacity: 0
              }}
              onContextMenu={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Правый клик - удаление соединения
                if (engineRef.current && window.confirm('Удалить соединение?')) {
                  const fromWidget = engineRef.current.widgetManager.getWidget(connection.from);
                  const toWidget = engineRef.current.widgetManager.getWidget(connection.to);
                  if (fromWidget) fromWidget.removeConnection(connection.id);
                  if (toWidget) toWidget.removeConnection(connection.id);
                  loadConnections();
                  eventBus.emit('connection:deleted', { connection });
                }
              }}
            />
          </g>
        )}
      </g>
    );
  };

  // Отрисовка временной линии при перетаскивании
  const renderTempConnection = () => {
    if (!tempConnection || !isConnecting) return null;

    const startPoint = connectionPoints.get(connectionPointKey(tempConnection.fromWidget, tempConnection.fromType));
    if (!startPoint) return null;

    const endPoint = tempConnection.mousePos || startPoint;

    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const cp1x = startPoint.x + distance * 0.5;
    const cp1y = startPoint.y;
    const cp2x = endPoint.x - distance * 0.5;
    const cp2y = endPoint.y;

    const path = `M ${startPoint.x} ${startPoint.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endPoint.x} ${endPoint.y}`;

    return (
      <path
        d={path}
        className={styles.tempConnectionPath}
        strokeWidth="2"
        fill="none"
        strokeDasharray="5,5"
      />
    );
  };

  useEffect(() => {
    if (!engineReady || !workspaceRef.current || !engineRef.current) return;

    // Загружаем соединения при монтировании
    loadConnections();

    // Обновляем позиции точек подключения
    const updateInterval = setInterval(updateConnectionPoints, 100);

    // Подписка на события
    const unsubscribeWidgetAdded = eventBus.on('widget:added', () => {
      setTimeout(() => {
        updateConnectionPoints();
        loadConnections();
      }, 100);
    });

    const unsubscribeWidgetDeleted = eventBus.on('widget:deleted', () => {
      setTimeout(() => {
        updateConnectionPoints();
        loadConnections();
      }, 100);
    });

    const unsubscribeWidgetMoved = eventBus.on('widget:moved', () => {
      updateConnectionPoints();
    });

    const unsubscribeViewportPan = eventBus.on('viewport:pan', () => {
      updateConnectionPoints();
    });

    const unsubscribeViewportZoom = eventBus.on('viewport:zoom', () => {
      updateConnectionPoints();
    });

    const unsubscribeConnectionAdded = eventBus.on('connection:added', () => {
      loadConnections();
    });

    const unsubscribeConnectionDeleted = eventBus.on('connection:deleted', () => {
      loadConnections();
    });

    const unsubscribeConnectionsLoaded = eventBus.on('connections:loaded', () => {
      setTimeout(() => {
        updateConnectionPoints();
        loadConnections();
      }, 200);
    });

    // Обработка начала создания соединения
    const handleConnectionStart = (data) => {
      const { widget, handleType } = data;
      setTempConnection({
        fromWidget: widget.id,
        fromType: handleType,
        mousePos: null
      });
    };

    // Обработка перемещения мыши при создании соединения
    const handleMouseMove = (e) => {
      if (!tempConnection || !viewportRef.current) return;

      const viewportRect = viewportRef.current.getBoundingClientRect();
      const mouseX = e.clientX - viewportRect.left;
      const mouseY = e.clientY - viewportRect.top;

      setTempConnection(prev => ({
        ...prev,
        mousePos: { x: mouseX, y: mouseY }
      }));
    };

    // Обработка окончания создания соединения
    const handleConnectionEnd = () => {
      setTempConnection(null);
    };

    const unsubscribeConnectionStart = eventBus.on('connection:start', handleConnectionStart);
    const unsubscribeConnectionEnd = eventBus.on('connection:end', handleConnectionEnd);

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearInterval(updateInterval);
      unsubscribeWidgetAdded();
      unsubscribeWidgetDeleted();
      unsubscribeWidgetMoved();
      unsubscribeViewportPan();
      unsubscribeViewportZoom();
      unsubscribeConnectionAdded();
      unsubscribeConnectionDeleted();
      unsubscribeConnectionsLoaded();
      unsubscribeConnectionStart();
      unsubscribeConnectionEnd();
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [engineReady, workspaceRef, viewportRef, engineRef]);

  // Обновление размеров SVG
  useEffect(() => {
    if (!svgRef.current || !viewportRef.current) return;

    const updateSVGSize = () => {
      const viewportRect = viewportRef.current.getBoundingClientRect();
      svgRef.current.setAttribute('width', viewportRect.width);
      svgRef.current.setAttribute('height', viewportRect.height);
    };

    updateSVGSize();
    const resizeObserver = new ResizeObserver(updateSVGSize);
    resizeObserver.observe(viewportRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [viewportRef]);

  if (!engineReady) return null;

  return (
    <svg
      ref={svgRef}
      className={styles.connectionsOverlay}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 3,
        overflow: 'visible'
      }}
    >
      <defs>
        {/* Стрелка для конца линии */}
        <marker
          id={arrowMarkerId}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polygon
            points="0 0, 10 3, 0 6"
            fill="#00E0FF"
            stroke="none"
          />
        </marker>
      </defs>
      
      {/* Постоянные соединения */}
      {connections.map(connection => renderConnection(connection))}
      
      {/* Временное соединение при перетаскивании */}
      {renderTempConnection()}
    </svg>
  );
};

export default ConnectionsOverlay;
