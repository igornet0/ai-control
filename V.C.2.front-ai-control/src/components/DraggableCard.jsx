import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import WidgetResizeHandles from './WidgetResizeHandles';
import { formatWidgetSize } from './widgetLayoutUtils';
import { useProfileWidgets } from '../context/ProfileWidgetsContext';
import { getProfileWidgetTitle, isKnownProfileWidget } from '../services/profileWidgetCatalog';

const PINNABLE_LAYOUTS = new Set(['overview', 'statistics', 'task-widgets']);

const DraggableCard = ({
  id,
  children,
  className = '',
  dragHandle = true,
  colSpan = 1,
  rowSpan = 1,
  gridColumns = 3,
  enableResize = false,
  isResizing = false,
  onResizeStart,
  pinSource = null,
  onRemoveCard = null,
  moveTargets = null,
  onMoveCard = null,
  order = null,
  openHref = null,
}) => {
  const navigate = useNavigate();
  const profileWidgets = useProfileWidgets();
  const canPin = Boolean(
    pinSource
    && PINNABLE_LAYOUTS.has(pinSource)
    && isKnownProfileWidget(pinSource, id)
    && profileWidgets
  );
  const pinned = canPin && profileWidgets.isPinned(pinSource, id);
  const widgetTitle = canPin ? getProfileWidgetTitle(pinSource, id) : '';
  const canMove = Boolean(onMoveCard && Array.isArray(moveTargets) && moveTargets.length > 0);
  const canOpenSource = Boolean(openHref);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDraggingFromKit,
  } = useSortable({ id });

  React.useEffect(() => {
    if (!isDraggingFromKit) return undefined;
    document.body.classList.add('widget-dnd-active');
    return () => {
      document.body.classList.remove('widget-dnd-active');
    };
  }, [isDraggingFromKit]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isResizing ? 'none' : transition,
    opacity: isDraggingFromKit ? 0.5 : 1,
    zIndex: isDraggingFromKit || isResizing ? 100 : undefined,
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
    ...(Number.isFinite(order) ? { order } : {}),
  };

  const handlePinClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canPin) return;
    try {
      await profileWidgets.toggleWidget(pinSource, id);
    } catch {
      // toast is shown by the context
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`widget-grid__item ${className} ${isResizing ? 'is-resizing' : ''} ${isDraggingFromKit ? 'is-dragging' : ''}`.trim()}
    >
      {(canPin || onRemoveCard || canMove || canOpenSource || dragHandle) && (
        <div className={`widget-card-actions ${enableResize ? 'widget-card-actions--with-resize' : ''} ${pinned ? 'widget-card-actions--pinned' : ''}`.trim()}>
          {onRemoveCard && (
            <button
              type="button"
              className="widget-unpin-btn"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemoveCard(id);
              }}
              title="Убрать из профиля"
              aria-label="Убрать виджет из профиля"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}

          {canOpenSource && (
            <button
              type="button"
              className="widget-open-source-btn"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigate(openHref);
              }}
              title="Открыть дашборд с этим виджетом"
              aria-label="Открыть дашборд с этим виджетом"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round" />
              </svg>
            </button>
          )}

          {canMove && (
            <label className="widget-move-select" title="Переместить на другой экран">
              <span className="sr-only">Переместить на экран</span>
              <select
                aria-label="Переместить на экран"
                defaultValue=""
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const targetId = event.target.value;
                  event.target.value = '';
                  if (targetId) onMoveCard(id, targetId);
                }}
              >
                <option value="" disabled>
                  Экран…
                </option>
                {moveTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {canPin && (
            <button
              type="button"
              className={`widget-pin-btn ${pinned ? 'widget-pin-btn--active' : ''}`}
              disabled={profileWidgets.loading}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={handlePinClick}
              aria-pressed={pinned}
              title={pinned ? 'Убрать из профиля' : 'Показать в профиле'}
              aria-label={pinned ? `Убрать «${widgetTitle}» из профиля` : `Показать «${widgetTitle}» в профиле`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M16 3v4.5L19 12v2h-5v7l-2 1-2-1v-7H5v-2l3-4.5V3h8z" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          {dragHandle && (
            <div
              className="widget-drag-handle"
              style={{ touchAction: 'none' }}
              aria-label="Переместить карточку"
              title="Перетащите, чтобы переместить"
              {...attributes}
              {...listeners}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="pointer-events-none" aria-hidden>
                <circle cx="9" cy="6" r="1.6" />
                <circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" />
                <circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" />
                <circle cx="15" cy="18" r="1.6" />
              </svg>
            </div>
          )}
        </div>
      )}

      {isResizing && (
        <div className="widget-size-badge widget-size-badge--active">
          {colSpan}×{rowSpan}
          <span className="widget-size-badge__hint">{formatWidgetSize(colSpan, rowSpan)}</span>
        </div>
      )}

      <WidgetResizeHandles
        enabled={enableResize && !isDraggingFromKit}
        gridColumns={gridColumns}
        onResizeStart={(direction, event) => onResizeStart?.(id, direction, event)}
      />

      <div className="widget-grid__item-content">
        {children}
      </div>
    </div>
  );
};

export default DraggableCard;
