import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import DraggableCard from './DraggableCard';
import { overviewLayoutService } from '../services/overviewLayoutService';
import { statisticsLayoutService } from '../services/statisticsLayoutService';
import { taskWidgetsLayoutService } from '../services/taskWidgetsLayoutService';
import CardVisibilitySettings from './CardVisibilitySettings';
import {
  getGridColumnCount,
  getColumnUnitPx,
  spansFromDrag,
  mergeLayoutEntry,
  normalizeCardSize,
} from './widgetLayoutUtils';
import './DraggableGrid.css';

function applyWidgetSizeToCardChild(element, widgetSize) {
  if (!React.isValidElement(element)) return element;

  if (typeof element.type === 'string') {
    const nextChildren = React.Children.map(element.props.children, (child) =>
      applyWidgetSizeToCardChild(child, widgetSize)
    );
    return React.cloneElement(element, undefined, nextChildren);
  }

  return React.cloneElement(element, { widgetSize });
}

const DraggableGrid = ({
  children,
  className = '',
  user,
  onLayoutChange = null,
  enableDragAndDrop = true,
  enableResize = true,
  layoutType = 'overview',
  availableCards = null,
  controlledLayout = null,
  onPersistLayout = null,
  hideVisibilitySettings = false,
  enablePin = true,
  onRemoveCard = null,
  moveTargets = null,
  onMoveCard = null,
}) => {
  const resolveCardId = (child) => {
    const props = child?.props;
    if (!props) return null;
    return props['data-card-id'] ?? props.cardId ?? null;
  };

  const resolveOpenHref = (child) => {
    const props = child?.props;
    if (!props) return null;
    const href = props['data-open-href'] ?? props.dataOpenHref ?? null;
    return href ? String(href) : null;
  };

  const findChildByCardId = (cardId) =>
    React.Children.toArray(children).find(
      (child) => resolveCardId(child) === cardId
    );

  const [cards, setCards] = useState([]);
  const [layout, setLayout] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showVisibilitySettings, setShowVisibilitySettings] = useState(false);
  const [gridColumns, setGridColumns] = useState(() => getGridColumnCount());
  const [resizePreview, setResizePreview] = useState(null);
  const [activeResizeId, setActiveResizeId] = useState(null);

  const gridRef = useRef(null);
  const resizeSessionRef = useRef(null);
  const resizePreviewRef = useRef(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const getDefaultCards = () => {
    if (layoutType === 'statistics') {
      return [
        { id: 'completed-tasks', title: 'Выполненные задачи' },
        { id: 'overdue-tasks', title: 'Просрочки' },
        { id: 'user-teams', title: 'Команды пользователя' },
        { id: 'user-projects', title: 'Проекты пользователя' },
        { id: 'feedback', title: 'Жалобы и похвалы' },
      ];
    }
    if (layoutType === 'task-widgets') {
      return [
        { id: 'progress-chart', title: 'Обзор задач' },
        { id: 'bar-chart', title: 'Приоритеты' },
        { id: 'team-ratings', title: 'Производительность' },
      ];
    }
    return [
      { id: 'priorities', title: 'Мои приоритеты на сегодня' },
      { id: 'overdue', title: 'Просроченные задачи' },
      { id: 'upcoming', title: 'Предстоящие дедлайны' },
      { id: 'projects', title: 'Статусы проектов' },
      { id: 'notes', title: 'Заметки' },
      { id: 'checklist', title: 'Чек-лист' },
      { id: 'time-management', title: 'Тайм-менеджмент на сегодня' },
      { id: 'ai-analysis', title: 'AI анализ' },
      { id: 'ai-chat', title: 'AI чат' },
    ];
  };

  const defaultCards = availableCards ?? getDefaultCards();
  const resizeEnabled = enableResize
    && (layoutType === 'overview' || layoutType === 'task-widgets' || layoutType === 'profile-widgets')
    && enableDragAndDrop;
  const widgetIdsKey = defaultCards.map((card) => card.id).join('|');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const updateColumns = () => setGridColumns(getGridColumnCount());
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  useEffect(() => {
    if (!layout || Object.keys(layout).length === 0) return;
    setLayout((prev) => {
      if (!prev || Object.keys(prev).length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        const normalized = normalizeCardSize(next[key], gridColumns);
        if (
          normalized.col_span !== (next[key]?.col_span ?? 1)
          || normalized.row_span !== (next[key]?.row_span ?? 1)
        ) {
          next[key] = { ...next[key], ...normalized };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [gridColumns]);

  useEffect(() => {
    loadLayout();
  }, [user, layoutType, widgetIdsKey]);

  const getLayoutService = () => {
    if (layoutType === 'statistics') return statisticsLayoutService;
    if (layoutType === 'task-widgets') return taskWidgetsLayoutService;
    return overviewLayoutService;
  };

  const fetchSavedLayout = async (layoutService) => {
    if (layoutType === 'statistics') {
      return layoutService.getStatisticsLayout();
    }
    if (layoutType === 'task-widgets') {
      return layoutService.getTaskWidgetsLayout();
    }
    return layoutService.getOverviewLayout();
  };

  const persistLayoutPayload = async (layoutService, nextLayout) => {
    if (onPersistLayout) {
      await onPersistLayout(nextLayout);
      return;
    }
    if (layoutType === 'overview') {
      await layoutService.updateOverviewLayout(overviewLayoutService.layoutToCards(nextLayout));
      return;
    }
    const cardsForApi = Object.keys(nextLayout).map((cardId) => ({
      card_id: cardId,
      position: nextLayout[cardId].position,
      visible: nextLayout[cardId].visible,
      col_span: nextLayout[cardId].col_span ?? 1,
      row_span: nextLayout[cardId].row_span ?? 1,
    }));
    if (layoutType === 'statistics') {
      await layoutService.updateStatisticsLayout(cardsForApi);
    } else {
      await layoutService.updateTaskWidgetsLayout(cardsForApi);
    }
  };

  const getLayoutDefaults = () => {
    if (layoutType === 'overview') return overviewLayoutService.getDefaultLayout();
    if (layoutType === 'task-widgets') return taskWidgetsLayoutService.getDefaultLayout();
    if (layoutType === 'profile-widgets') {
      const defaults = {};
      defaultCards.forEach((card, index) => {
        defaults[card.id] = {
          position: index,
          visible: true,
          col_span: card.colSpan ?? 1,
          row_span: card.rowSpan ?? 2,
        };
      });
      return defaults;
    }
    return null;
  };

  const normalizeLayout = (rawLayout) => {
    const layoutDefaults = getLayoutDefaults();
    const normalized = {};
    defaultCards.forEach((card, index) => {
      const entry = rawLayout?.[card.id] ?? {};
      const cardDefaults = layoutDefaults?.[card.id] ?? {
        position: index,
        visible: true,
        col_span: 1,
        row_span: 1,
      };
      let rowSpan = entry.row_span ?? cardDefaults.row_span ?? 1;
      const colSpan = entry.col_span ?? cardDefaults.col_span ?? 1;
      // Legacy task-widgets used fixed CSS height with row_span: 1
      if (
        layoutType === 'task-widgets'
        && rowSpan === 1
        && colSpan === 1
        && (cardDefaults.row_span ?? 1) > 1
      ) {
        rowSpan = cardDefaults.row_span;
      }
      const merged = mergeLayoutEntry(cardDefaults, {
        position: entry.position ?? cardDefaults.position ?? index,
        visible: entry.visible ?? cardDefaults.visible ?? true,
        col_span: colSpan,
        row_span: rowSpan,
      });
      normalized[card.id] = {
        ...merged,
        ...normalizeCardSize(merged, gridColumns),
      };
    });
    Object.keys(rawLayout || {}).forEach((cardId) => {
      if (!normalized[cardId]) {
        const entry = rawLayout[cardId];
        normalized[cardId] = mergeLayoutEntry({}, {
          position: entry.position ?? 999,
          visible: entry.visible ?? false,
          col_span: normalizeCardSize(entry, gridColumns).col_span,
          row_span: normalizeCardSize(entry, gridColumns).row_span,
        });
      }
    });
    return normalized;
  };

  const canResetLayout = useMemo(() => {
    if (!resizeEnabled || !layout || Object.keys(layout).length === 0) {
      return false;
    }
    const defaults = getLayoutDefaults();
    if (!defaults) return false;

    const normalizedDefaults = normalizeLayout(defaults);
    return defaultCards.some((card) => {
      const current = layout[card.id];
      const def = normalizedDefaults[card.id];
      if (!def) return false;
      const currentSize = normalizeCardSize(current ?? {}, gridColumns);
      const defaultSize = normalizeCardSize(def, gridColumns);
      return (
        currentSize.col_span !== defaultSize.col_span
        || currentSize.row_span !== defaultSize.row_span
      );
    });
  }, [layout, gridColumns, resizeEnabled, layoutType]);

  const loadLayout = async () => {
    if (controlledLayout != null) {
      const normalized = normalizeLayout(controlledLayout);
      setLayout(normalized);
      layoutRef.current = normalized;
      const sortedCards = defaultCards
        .filter((card) => normalized[card.id]?.visible !== false)
        .sort((a, b) => {
          const posA = normalized[a.id]?.position ?? 999;
          const posB = normalized[b.id]?.position ?? 999;
          return posA - posB;
        });
      setCards(sortedCards);
      setLoading(false);
      return;
    }

    if (!user || !enableDragAndDrop) {
      setCards(defaultCards);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const layoutService = getLayoutService();
      const savedLayout = await fetchSavedLayout(layoutService);
      const normalized = normalizeLayout(savedLayout);
      setLayout(normalized);

      const sortedCards = defaultCards
        .filter((card) => normalized[card.id]?.visible !== false)
        .sort((a, b) => {
          const posA = normalized[a.id]?.position ?? 999;
          const posB = normalized[b.id]?.position ?? 999;
          return posA - posB;
        });

      setCards(sortedCards);
    } catch (error) {
      console.error('Error loading layout:', error);
      setCards(defaultCards);
      const defaults = getLayoutDefaults();
      if (defaults) {
        setLayout(defaults);
      } else {
        const fallback = {};
        defaultCards.forEach((card, index) => {
          fallback[card.id] = { position: index, visible: true, col_span: 1, row_span: 1 };
        });
        setLayout(fallback);
      }
    } finally {
      setLoading(false);
    }
  };

  const commitLayout = useCallback(async (nextLayout) => {
    if (!user || !enableDragAndDrop) return;

    setLayout(nextLayout);
    layoutRef.current = nextLayout;

    try {
      setSaving(true);
      const layoutService = getLayoutService();
      await persistLayoutPayload(layoutService, nextLayout);
      if (onLayoutChange) {
        onLayoutChange(nextLayout);
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      loadLayout();
    } finally {
      setSaving(false);
    }
  }, [user, enableDragAndDrop, layoutType, onLayoutChange, onPersistLayout]);

  const saveLayout = async (newCards) => {
    const nextLayout = { ...layoutRef.current };
    newCards.forEach((card, index) => {
      nextLayout[card.id] = mergeLayoutEntry(nextLayout[card.id], {
        position: index,
        visible: nextLayout[card.id]?.visible !== false,
      });
    });
    await commitLayout(nextLayout);
  };

  const handleVisibilityUpdate = async (visibility) => {
    try {
      setSaving(true);
      const nextLayout = { ...layoutRef.current };

      Object.keys(visibility).forEach((cardId) => {
        nextLayout[cardId] = mergeLayoutEntry(nextLayout[cardId], {
          visible: visibility[cardId],
        });
      });

      const filteredCards = defaultCards
        .filter((card) => nextLayout[card.id]?.visible !== false)
        .sort((a, b) => {
          const posA = nextLayout[a.id]?.position ?? 999;
          const posB = nextLayout[b.id]?.position ?? 999;
          return posA - posB;
        });

      filteredCards.forEach((card, index) => {
        nextLayout[card.id] = mergeLayoutEntry(nextLayout[card.id], { position: index });
      });

      const layoutService = getLayoutService();
      await persistLayoutPayload(layoutService, nextLayout);
      setLayout(nextLayout);
      setCards(filteredCards);
      if (onLayoutChange) {
        onLayoutChange(nextLayout);
      }
    } catch (error) {
      console.error('Error updating card visibility:', error);
      loadLayout();
    } finally {
      setSaving(false);
    }
  };

  const handleResetLayout = async () => {
    const defaults = getLayoutDefaults();
    if (!defaults) return;

    const nextLayout = normalizeLayout(defaults);
    const sortedCards = defaultCards
      .filter((card) => nextLayout[card.id]?.visible !== false)
      .sort((a, b) => {
        const posA = nextLayout[a.id]?.position ?? 999;
        const posB = nextLayout[b.id]?.position ?? 999;
        return posA - posB;
      });

    setCards(sortedCards);
    await commitLayout(nextLayout);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setCards((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;

      const newItems = arrayMove(items, oldIndex, newIndex);
      saveLayout(newItems);
      return newItems;
    });
  };

  const getCardSize = useCallback((cardId) => {
    if (resizePreview?.cardId === cardId) {
      return {
        col_span: resizePreview.col_span,
        row_span: resizePreview.row_span,
      };
    }
    const entry = layoutRef.current[cardId] ?? {};
    return normalizeCardSize(entry, gridColumns);
  }, [resizePreview, gridColumns]);

  const commitLayoutRef = useRef(commitLayout);
  commitLayoutRef.current = commitLayout;

  const getResizeCursor = (direction) => {
    if (direction === 's') return 'ns-resize';
    if (direction === 'e') return 'ew-resize';
    return 'nwse-resize';
  };

  const handleResizeMove = useCallback((event) => {
    const session = resizeSessionRef.current;
    if (!session) return;

    const containerWidth = gridRef.current?.clientWidth ?? window.innerWidth;
    const columnUnitPx = getColumnUnitPx(containerWidth, session.gridColumns);
    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;
    const next = spansFromDrag({
      direction: session.direction,
      startColSpan: session.startColSpan,
      startRowSpan: session.startRowSpan,
      deltaX,
      deltaY,
      columnUnitPx,
      gridColumns: session.gridColumns,
    });

    setResizePreview({ cardId: session.cardId, ...next });
    resizePreviewRef.current = { cardId: session.cardId, ...next };
  }, []);

  const handleResizeEnd = useCallback(async () => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.classList.remove('widget-resize-active');
    document.body.style.cursor = '';

    const session = resizeSessionRef.current;
    resizeSessionRef.current = null;
    setActiveResizeId(null);

    if (!session) {
      setResizePreview(null);
      return;
    }

    const preview = resizePreviewRef.current;
    resizePreviewRef.current = null;
    setResizePreview(null);

    if (!preview || preview.cardId !== session.cardId) return;

    const nextLayout = {
      ...layoutRef.current,
      [session.cardId]: mergeLayoutEntry(layoutRef.current[session.cardId], {
        col_span: preview.col_span,
        row_span: preview.row_span,
      }),
    };

    await commitLayoutRef.current(nextLayout);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((cardId, direction, event) => {
    if (!resizeEnabled) return;

    const size = normalizeCardSize(layoutRef.current[cardId], gridColumns);
    resizeSessionRef.current = {
      cardId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      startColSpan: size.col_span,
      startRowSpan: size.row_span,
      gridColumns,
    };

    setActiveResizeId(cardId);
    setResizePreview({ cardId, ...size });
    resizePreviewRef.current = { cardId, ...size };
    document.body.classList.add('widget-resize-active');
    document.body.style.cursor = getResizeCursor(direction);
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [resizeEnabled, gridColumns, handleResizeMove, handleResizeEnd]);

  useEffect(() => () => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.classList.remove('widget-resize-active');
    document.body.style.cursor = '';
  }, [handleResizeMove, handleResizeEnd]);

  const gridClassName = [
    'widget-grid',
    layoutType === 'task-widgets' ? 'widget-grid--task-widgets' : '',
    layoutType === 'statistics' ? 'widget-grid--statistics' : '',
    layoutType === 'profile-widgets' ? 'widget-grid--profile-widgets' : '',
    className,
  ].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={gridClassName}>
        {Array.from({ length: Math.max(defaultCards.length, 1) }).map((_, index) => (
          <div key={index} className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 animate-pulse">
            <div className="h-6 bg-gray-700 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4" />
              <div className="h-4 bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!enableDragAndDrop) {
    return (
      <div className={gridClassName}>
        {children}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {enableDragAndDrop && user && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {resizeEnabled ? (
            <p className="text-xs text-slate-400">
              ⋮ — переместить. Нижний/правый край или угол — изменить размер.
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              ⋮ — переместить виджет.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {canResetLayout && (
              <button
                type="button"
                onClick={handleResetLayout}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-500/40 bg-slate-800/80 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/80 disabled:cursor-not-allowed disabled:opacity-50"
                title="Вернуть размеры и порядок виджетов к значениям по умолчанию"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Сбросить размеры
              </button>
            )}
            {!hideVisibilitySettings && (
            <button
              type="button"
              onClick={() => setShowVisibilitySettings(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/35 bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-900/30 transition-colors hover:bg-indigo-500"
              title="Настроить виджеты"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L19 7.5C18.8 6.9 18.6 6.4 18.3 5.9L19.5 4.5L18 3L16.6 4.2C16.1 3.9 15.6 3.7 15 3.5L14.5 1.5H12.5L12 3.5C11.4 3.7 10.9 3.9 10.4 4.2L9 3L7.5 4.5L8.7 5.9C8.4 6.4 8.2 6.9 8 7.5L6 7V9L8 8.5C8.2 9.1 8.4 9.6 8.7 10.1L7.5 11.5L9 13L10.4 11.8C10.9 12.1 11.4 12.3 12 12.5L12.5 14.5H14.5L15 12.5C15.6 12.3 16.1 12.1 16.6 11.8L18 13L19.5 11.5L18.3 10.1C18.6 9.6 18.8 9.1 19 8.5L21 9Z" />
              </svg>
              Настроить виджеты
            </button>
            )}
          </div>
        </div>
      )}

      <SortableContext items={cards.map((card) => card.id)} strategy={rectSortingStrategy}>
        <div ref={gridRef} className={gridClassName}>
          {(() => {
            const orderById = Object.fromEntries(cards.map((card, index) => [card.id, index]));
            const renderCards = layoutType === 'profile-widgets'
              ? [...cards].sort((a, b) => String(a.id).localeCompare(String(b.id)))
              : cards;
            return renderCards.map((cardInfo) => {
              const cardChild = findChildByCardId(cardInfo.id);
              if (!cardChild) return null;

              const size = getCardSize(cardInfo.id);

              return (
                <DraggableCard
                  key={cardInfo.id}
                  id={cardInfo.id}
                  className="group"
                  dragHandle={true}
                  colSpan={size.col_span}
                  rowSpan={size.row_span}
                  gridColumns={gridColumns}
                  enableResize={resizeEnabled}
                  isResizing={activeResizeId === cardInfo.id}
                  onResizeStart={handleResizeStart}
                  pinSource={enablePin ? layoutType : null}
                  onRemoveCard={onRemoveCard}
                  moveTargets={moveTargets}
                  onMoveCard={onMoveCard}
                  order={layoutType === 'profile-widgets' ? orderById[cardInfo.id] : null}
                  openHref={resolveOpenHref(cardChild)}
                >
                  {applyWidgetSizeToCardChild(cardChild, {
                    colSpan: size.col_span,
                    rowSpan: size.row_span,
                  })}
                </DraggableCard>
              );
            });
          })()}
        </div>
      </SortableContext>

      {saving && (
        <div className="fixed bottom-4 right-4 z-[100] bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
          Сохранение layout...
        </div>
      )}

      {showVisibilitySettings && !hideVisibilitySettings && (
        <CardVisibilitySettings
          availableCards={defaultCards}
          currentLayout={layout}
          onUpdateVisibility={handleVisibilityUpdate}
          onClose={() => setShowVisibilitySettings(false)}
          layoutType={layoutType}
        />
      )}
    </DndContext>
  );
};

export default DraggableGrid;
