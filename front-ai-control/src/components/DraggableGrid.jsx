import React, { useState, useEffect } from 'react';
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
import CardVisibilitySettings from './CardVisibilitySettings';

const DraggableGrid = ({ 
  children, 
  className = "", 
  user,
  onLayoutChange = null,
  enableDragAndDrop = true,
  layoutType = "overview" // "overview" или "statistics"
}) => {
  const [cards, setCards] = useState([]);
  const [layout, setLayout] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showVisibilitySettings, setShowVisibilitySettings] = useState(false);

  // Определяем порядок карточек по умолчанию в зависимости от типа layout
  const getDefaultCards = () => {
    if (layoutType === "statistics") {
      return [
        { id: 'completed-tasks', title: 'Выполненные задачи' },
        { id: 'overdue-tasks', title: 'Просрочки' },
        { id: 'user-teams', title: 'Команды пользователя' },
        { id: 'user-projects', title: 'Проекты пользователя' },
        { id: 'feedback', title: 'Жалобы и похвалы' }
      ];
    }
    // Дефолтный overview layout
    return [
      { id: 'priorities', title: 'Мои приоритеты на сегодня' },
      { id: 'overdue', title: 'Просроченные задачи' },
      { id: 'upcoming', title: 'Предстоящие дедлайны' },
      { id: 'projects', title: 'Статусы проектов' },
      { id: 'notes', title: 'Заметки' },
      { id: 'checklist', title: 'Чек-лист' },
      { id: 'time-management', title: 'Тайм-менеджмент на сегодня' }
    ];
  };

  const defaultCards = getDefaultCards();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Минимальная дистанция для активации drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Загружаем layout при изменении пользователя
  useEffect(() => {
    loadLayout();
  }, [user]);

  const getLayoutService = () => {
    return layoutType === "statistics" ? statisticsLayoutService : overviewLayoutService;
  };

  const loadLayout = async () => {
    if (!user || !enableDragAndDrop) {
      // Если drag and drop отключен или нет пользователя, используем дефолтный порядок
      setCards(defaultCards);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const layoutService = getLayoutService();
      const savedLayout = layoutType === "statistics" 
        ? await layoutService.getStatisticsLayout()
        : await layoutService.getOverviewLayout();
      setLayout(savedLayout);
      
      // Сортируем карточки по позициям из layout
      const sortedCards = defaultCards
        .filter(card => savedLayout[card.id]?.visible !== false)
        .sort((a, b) => {
          const posA = savedLayout[a.id]?.position ?? 999;
          const posB = savedLayout[b.id]?.position ?? 999;
          return posA - posB;
        });
      
      setCards(sortedCards);
    } catch (error) {
      console.error('Error loading layout:', error);
      // В случае ошибки используем дефолтный порядок
      setCards(defaultCards);
      const defaultLayout = {};
      defaultCards.forEach((card, index) => {
        defaultLayout[card.id] = { position: index, visible: true };
      });
      setLayout(defaultLayout);
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = async (newCards) => {
    if (!user || !enableDragAndDrop || saving) {
      return;
    }

    try {
      setSaving(true);
      
      // Создаем новый layout с обновленными позициями
      const newLayout = { ...layout };
      newCards.forEach((card, index) => {
        newLayout[card.id] = {
          position: index,
          visible: true
        };
      });

      // Преобразуем в формат для API и сохраняем
      const layoutService = getLayoutService();
      if (layoutType === "statistics") {
        const cardsForApi = Object.keys(newLayout).map(cardId => ({
          card_id: cardId,
          position: newLayout[cardId].position,
          visible: newLayout[cardId].visible
        }));
        await layoutService.updateStatisticsLayout(cardsForApi);
      } else {
        const cardsForApi = overviewLayoutService.layoutToCards(newLayout);
        await layoutService.updateOverviewLayout(cardsForApi);
      }
      
      setLayout(newLayout);
      
      // Вызываем callback если есть
      if (onLayoutChange) {
        onLayoutChange(newLayout);
      }
      
    } catch (error) {
      console.error('Error saving layout:', error);
      // В случае ошибки откатываем изменения
      loadLayout();
    } finally {
      setSaving(false);
    }
  };

  const handleVisibilityUpdate = async (visibility) => {
    try {
      setSaving(true);
      
      // Создаем новый layout с обновленной видимостью
      const newLayout = { ...layout };
      
      // Обновляем видимость для всех карточек
      Object.keys(visibility).forEach(cardId => {
        if (!newLayout[cardId]) {
          newLayout[cardId] = { position: 999, visible: true };
        }
        newLayout[cardId].visible = visibility[cardId];
      });
      
      // Фильтруем и пересортировываем карточки
      const filteredCards = defaultCards
        .filter(card => newLayout[card.id]?.visible !== false)
        .sort((a, b) => {
          const posA = newLayout[a.id]?.position ?? 999;
          const posB = newLayout[b.id]?.position ?? 999;
          return posA - posB;
        });
      
      // Пересчитываем позиции для видимых карточек
      filteredCards.forEach((card, index) => {
        newLayout[card.id] = {
          ...newLayout[card.id],
          position: index
        };
      });
      
      // Сохраняем в API
      const layoutService = getLayoutService();
      if (layoutType === "statistics") {
        const cardsForApi = Object.keys(newLayout).map(cardId => ({
          card_id: cardId,
          position: newLayout[cardId].position,
          visible: newLayout[cardId].visible
        }));
        await layoutService.updateStatisticsLayout(cardsForApi);
      } else {
        const cardsForApi = overviewLayoutService.layoutToCards(newLayout);
        await layoutService.updateOverviewLayout(cardsForApi);
      }
      
      // Обновляем состояние
      setLayout(newLayout);
      setCards(filteredCards);
      
      // Вызываем callback если есть
      if (onLayoutChange) {
        onLayoutChange(newLayout);
      }
      
    } catch (error) {
      console.error('Error updating card visibility:', error);
      // В случае ошибки перезагружаем layout
      loadLayout();
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setCards((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Сохраняем новый порядок
        saveLayout(newItems);
        
        return newItems;
      });
    }
  };

  if (loading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 ${className}`}>
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="bg-[#0F1717] rounded-xl p-4 border border-gray-700 animate-pulse">
            <div className="h-6 bg-gray-700 rounded mb-3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!enableDragAndDrop) {
    // Режим без drag and drop - просто рендерим карточки
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 ${className}`}>
        {children}
      </div>
    );
  }

  // Режим с drag and drop
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cards.map(card => card.id)} strategy={rectSortingStrategy}>
        <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 ${className}`}>
          {cards.map((cardInfo) => {
            // Находим соответствующий child элемент по data-card-id
            const cardChild = React.Children.toArray(children).find(child => 
              child.props && child.props['data-card-id'] === cardInfo.id
            );
            
            if (!cardChild) {
              return null;
            }

            return (
              <DraggableCard
                key={cardInfo.id}
                id={cardInfo.id}
                className="group"
                dragHandle={true}
              >
                {cardChild}
              </DraggableCard>
            );
          })}
        </div>
      </SortableContext>
      
      {/* Индикатор сохранения */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
          Сохранение layout...
        </div>
      )}

      {/* Кнопка настроек карточек */}
      {enableDragAndDrop && user && (
        <button
          onClick={() => setShowVisibilitySettings(true)}
          className="fixed bottom-4 left-4 bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-full shadow-lg transition-colors"
          title="Настроить карточки"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L19 7.5C18.8 6.9 18.6 6.4 18.3 5.9L19.5 4.5L18 3L16.6 4.2C16.1 3.9 15.6 3.7 15 3.5L14.5 1.5H12.5L12 3.5C11.4 3.7 10.9 3.9 10.4 4.2L9 3L7.5 4.5L8.7 5.9C8.4 6.4 8.2 6.9 8 7.5L6 7V9L8 8.5C8.2 9.1 8.4 9.6 8.7 10.1L7.5 11.5L9 13L10.4 11.8C10.9 12.1 11.4 12.3 12 12.5L12.5 14.5H14.5L15 12.5C15.6 12.3 16.1 12.1 16.6 11.8L18 13L19.5 11.5L18.3 10.1C18.6 9.6 18.8 9.1 19 8.5L21 9Z"/>
          </svg>
        </button>
      )}

      {/* Модальное окно настроек */}
      {showVisibilitySettings && (
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
