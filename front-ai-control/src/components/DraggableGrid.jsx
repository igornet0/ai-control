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

const DraggableGrid = ({ 
  children, 
  className = "", 
  user,
  onLayoutChange = null,
  enableDragAndDrop = true 
}) => {
  const [cards, setCards] = useState([]);
  const [layout, setLayout] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Определяем порядок карточек по умолчанию
  const defaultCards = [
    { id: 'priorities', title: 'Мои приоритеты на сегодня' },
    { id: 'overdue', title: 'Просроченные задачи' },
    { id: 'upcoming', title: 'Предстоящие дедлайны' },
    { id: 'projects', title: 'Статусы проектов' },
    { id: 'notes', title: 'Заметки' },
    { id: 'checklist', title: 'Чек-лист' },
    { id: 'time-management', title: 'Тайм-менеджмент на сегодня' }
  ];

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

  const loadLayout = async () => {
    if (!user || !enableDragAndDrop) {
      // Если drag and drop отключен или нет пользователя, используем дефолтный порядок
      setCards(defaultCards);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const savedLayout = await overviewLayoutService.getOverviewLayout();
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
      setLayout(overviewLayoutService.getDefaultLayout());
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

      // Преобразуем в формат для API
      const cardsForApi = overviewLayoutService.layoutToCards(newLayout);
      
      // Сохраняем в API
      await overviewLayoutService.updateOverviewLayout(cardsForApi);
      
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
    </DndContext>
  );
};

export default DraggableGrid;
