import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CardVisibilitySettings from '../CardVisibilitySettings';

describe('CardVisibilitySettings', () => {
  const mockCards = [
    { id: 'card1', title: 'Карточка 1' },
    { id: 'card2', title: 'Карточка 2' },
    { id: 'card3', title: 'Карточка 3' }
  ];

  const mockLayout = {
    card1: { position: 0, visible: true },
    card2: { position: 1, visible: false },
    card3: { position: 2, visible: true }
  };

  const defaultProps = {
    availableCards: mockCards,
    currentLayout: mockLayout,
    onUpdateVisibility: vi.fn(),
    onClose: vi.fn(),
    layoutType: 'overview'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with correct title for overview', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    expect(screen.getByText('Настройка карточек')).toBeInTheDocument();
    expect(screen.getByText(/Выберите карточки для отображения на странице Обзор/)).toBeInTheDocument();
  });

  it('should render with correct title for statistics', () => {
    render(<CardVisibilitySettings {...defaultProps} layoutType="statistics" />);
    
    expect(screen.getByText(/Выберите карточки для отображения на странице Статистика/)).toBeInTheDocument();
  });

  it('should display all available cards', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    expect(screen.getByText('Карточка 1')).toBeInTheDocument();
    expect(screen.getByText('Карточка 2')).toBeInTheDocument();
    expect(screen.getByText('Карточка 3')).toBeInTheDocument();
  });

  it('should show correct initial visibility state', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // card1: visible true
    expect(checkboxes[1]).not.toBeChecked(); // card2: visible false
    expect(checkboxes[2]).toBeChecked(); // card3: visible true
  });

  it('should show visible count correctly', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    expect(screen.getByText('Показано: 2 из 3 карточек')).toBeInTheDocument();
  });

  it('should toggle card visibility on checkbox change', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // toggle card2 from false to true
    
    expect(checkboxes[1]).toBeChecked();
    expect(screen.getByText('Показано: 3 из 3 карточек')).toBeInTheDocument();
  });

  it('should call onUpdateVisibility when save button is clicked', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    const saveButton = screen.getByText('Сохранить');
    fireEvent.click(saveButton);
    
    expect(defaultProps.onUpdateVisibility).toHaveBeenCalledWith({
      card1: true,
      card2: false,
      card3: true
    });
  });

  it('should call onClose when save button is clicked', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    const saveButton = screen.getByText('Сохранить');
    fireEvent.click(saveButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose when X button is clicked', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should reset all cards to visible when "Показать все" is clicked', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    const resetButton = screen.getByText('Показать все');
    fireEvent.click(resetButton);
    
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).toBeChecked();
    expect(screen.getByText('Показано: 3 из 3 карточек')).toBeInTheDocument();
  });

  it('should disable save button when no cards are visible', () => {
    render(<CardVisibilitySettings {...defaultProps} />);
    
    // Uncheck all cards
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        fireEvent.click(checkbox);
      }
    });
    
    const saveButton = screen.getByText('Сохранить');
    expect(saveButton).toBeDisabled();
    expect(screen.getByText('Необходимо выбрать хотя бы одну карточку')).toBeInTheDocument();
  });

  it('should handle cards not in current layout', () => {
    const layoutWithMissingCard = {
      card1: { position: 0, visible: true }
      // card2 and card3 missing
    };
    
    render(
      <CardVisibilitySettings 
        {...defaultProps} 
        currentLayout={layoutWithMissingCard} 
      />
    );
    
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // card1: visible true
    expect(checkboxes[1]).toBeChecked(); // card2: default true (missing from layout)
    expect(checkboxes[2]).toBeChecked(); // card3: default true (missing from layout)
  });
});
