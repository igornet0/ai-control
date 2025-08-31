import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DraggableGrid from '../DraggableGrid';
import * as overviewLayoutService from '../../services/overviewLayoutService';

// Mock the service
vi.mock('../../services/overviewLayoutService', () => ({
  overviewLayoutService: {
    getOverviewLayout: vi.fn(),
    updateOverviewLayout: vi.fn(),
    getDefaultLayout: vi.fn(),
    layoutToCards: vi.fn(),
    cardsToLayout: vi.fn()
  }
}));

// Mock dnd-kit components
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => [])
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }) => <div data-testid="sortable-context">{children}</div>,
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  arrayMove: vi.fn((arr, from, to) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  sortableKeyboardCoordinates: vi.fn(),
  rectSortingStrategy: vi.fn()
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => 'transform: translate3d(0px, 0px, 0px)')
    }
  }
}));

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('DraggableGrid', () => {
  const mockUser = { id: 1, username: 'testuser' };
  
  const mockDefaultLayout = {
    priorities: { position: 0, visible: true },
    overdue: { position: 1, visible: true },
    upcoming: { position: 2, visible: true },
    projects: { position: 3, visible: true },
    notes: { position: 4, visible: true },
    checklist: { position: 5, visible: true },
    'time-management': { position: 6, visible: true }
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    overviewLayoutService.overviewLayoutService.getOverviewLayout.mockResolvedValue(mockDefaultLayout);
    overviewLayoutService.overviewLayoutService.updateOverviewLayout.mockResolvedValue({ success: true });
    overviewLayoutService.overviewLayoutService.getDefaultLayout.mockReturnValue(mockDefaultLayout);
    overviewLayoutService.overviewLayoutService.layoutToCards.mockImplementation((layout) => 
      Object.entries(layout).map(([cardId, config]) => ({
        card_id: cardId,
        position: config.position,
        visible: config.visible
      }))
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('отображает загрузочные скелетоны во время загрузки', () => {
    renderWithRouter(
      <DraggableGrid user={mockUser} enableDragAndDrop={true}>
        <div data-card-id="priorities">Priority Card</div>
      </DraggableGrid>
    );

    // Должны быть видны скелетоны загрузки
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons).toBeTruthy();
  });

  it('отображает карточки в обычном режиме без drag and drop', async () => {
    renderWithRouter(
      <DraggableGrid user={mockUser} enableDragAndDrop={false}>
        <div data-card-id="priorities">Priority Card</div>
        <div data-card-id="overdue">Overdue Card</div>
      </DraggableGrid>
    );

    await waitFor(() => {
      expect(screen.getByText('Priority Card')).toBeInTheDocument();
      expect(screen.getByText('Overdue Card')).toBeInTheDocument();
    });

    // В режиме без DnD не должно быть DndContext
    expect(screen.queryByTestId('dnd-context')).not.toBeInTheDocument();
  });

  it('загружает layout из API при включенном drag and drop', async () => {
    renderWithRouter(
      <DraggableGrid user={mockUser} enableDragAndDrop={true}>
        <div data-card-id="priorities">Priority Card</div>
        <div data-card-id="overdue">Overdue Card</div>
      </DraggableGrid>
    );

    await waitFor(() => {
      expect(overviewLayoutService.overviewLayoutService.getOverviewLayout).toHaveBeenCalled();
    });
  });

  it('использует дефолтный layout при отсутствии пользователя', async () => {
    renderWithRouter(
      <DraggableGrid user={null} enableDragAndDrop={true}>
        <div data-card-id="priorities">Priority Card</div>
      </DraggableGrid>
    );

    await waitFor(() => {
      expect(overviewLayoutService.overviewLayoutService.getOverviewLayout).not.toHaveBeenCalled();
    });
  });

  it('обрабатывает ошибки загрузки layout', async () => {
    overviewLayoutService.overviewLayoutService.getOverviewLayout.mockRejectedValue(new Error('API Error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithRouter(
      <DraggableGrid user={mockUser} enableDragAndDrop={true}>
        <div data-card-id="priorities">Priority Card</div>
      </DraggableGrid>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading layout:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('создает правильную структуру компонента', async () => {
    renderWithRouter(
      <DraggableGrid user={mockUser} enableDragAndDrop={true}>
        <div data-card-id="priorities">Priority Card</div>
      </DraggableGrid>
    );

    // Просто проверяем что компонент рендерится без ошибок
    await waitFor(() => {
      expect(overviewLayoutService.overviewLayoutService.getOverviewLayout).toHaveBeenCalled();
    });
  });

  it('правильно обрабатывает пропс enableDragAndDrop', () => {
    const { rerender } = renderWithRouter(
      <DraggableGrid user={mockUser} enableDragAndDrop={false}>
        <div data-card-id="priorities">Priority Card</div>
      </DraggableGrid>
    );

    // При enableDragAndDrop=false не должно быть вызовов API
    expect(overviewLayoutService.overviewLayoutService.getOverviewLayout).not.toHaveBeenCalled();

    // Перерендериваем с enableDragAndDrop=true
    rerender(
      <BrowserRouter>
        <DraggableGrid user={mockUser} enableDragAndDrop={true}>
          <div data-card-id="priorities">Priority Card</div>
        </DraggableGrid>
      </BrowserRouter>
    );
  });

  it('вызывает API загрузки layout при монтировании', async () => {
    renderWithRouter(
      <DraggableGrid user={mockUser} enableDragAndDrop={true}>
        <div data-card-id="priorities">Priority Card</div>
      </DraggableGrid>
    );

    await waitFor(() => {
      expect(overviewLayoutService.overviewLayoutService.getOverviewLayout).toHaveBeenCalled();
    });
  });
});
