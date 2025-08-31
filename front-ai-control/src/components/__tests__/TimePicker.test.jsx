import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import TimePicker from '../TimePicker';

describe('TimePicker Component', () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Форматирование ввода времени', () => {
    it('должен правильно форматировать 4 цифры: 1256 → 12:56', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '1256' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('12:56');
    });

    it('должен правильно форматировать 4 цифры: 0101 → 01:01', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '0101' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('01:01');
    });

    it('должен правильно форматировать 4 цифры: 3333 → 23:33', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '3333' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('23:33');
    });

    it('не должен форматировать 3 цифры преждевременно: 125 → 125 (НЕ 01:25)', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '125' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('125');
      expect(mockOnChange).not.toHaveBeenCalledWith('01:25');
    });

    it('не должен форматировать 2 цифры: 12 → 12', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '12' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('12');
    });

    it('не должен форматировать 1 цифру: 1 → 1', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '1' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('1');
    });

    it('должен ограничивать часы до 23: 2599 → 23:59', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '2599' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('23:59');
    });

    it('должен ограничивать минуты до 59: 1299 → 12:59', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '1299' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('12:59');
    });

    it('должен ограничивать максимальные значения: 9999 → 23:59', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '9999' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('23:59');
    });

    it('должен игнорировать не-цифровые символы', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: 'ab12cd34ef' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('12:34');
    });

    it('должен обрабатывать уже отформатированное время: 12:34 → 12:34', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '12:34' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('12:34');
    });

    it('должен обрабатывать некорректное отформатированное время: 25:99 → 23:59', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '25:99' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('23:59');
    });
  });

  describe('Dropdown функциональность', () => {
    it('должен открывать dropdown при клике на иконку времени', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      expect(screen.getByText('Выберите время')).toBeInTheDocument();
    });

    it('должен отображать кнопки быстрого выбора времени', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('12:00')).toBeInTheDocument();
      expect(screen.getByText('19:00')).toBeInTheDocument();
    });

    it('должен устанавливать время при клике на быстрый выбор', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      const timeButton = screen.getByText('09:00');
      fireEvent.click(timeButton);
      
      expect(mockOnChange).toHaveBeenCalledWith('09:00');
    });

    it('должен закрывать dropdown после выбора времени из быстрого выбора', async () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      // Открываем dropdown
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      // Выбираем время
      const timeButton = screen.getByText('09:00');
      fireEvent.click(timeButton);
      
      // Dropdown должен закрыться
      await waitFor(() => {
        expect(screen.queryByText('Выберите время')).not.toBeInTheDocument();
      });
    });

    it('должен отображать поля ручного ввода часов и минут', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      expect(screen.getByPlaceholderText('ЧЧ')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('ММ')).toBeInTheDocument();
    });

    it('НЕ должен закрывать dropdown при ручном вводе часов', async () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      // Открываем dropdown
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      // Вводим в поле часов
      const hoursInput = screen.getByPlaceholderText('ЧЧ');
      fireEvent.change(hoursInput, { target: { value: '14' } });
      
      // Dropdown должен остаться открытым
      expect(screen.getByText('Выберите время')).toBeInTheDocument();
    });

    it('НЕ должен закрывать dropdown при ручном вводе минут', async () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      // Открываем dropdown
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      // Вводим в поле минут
      const minutesInput = screen.getByPlaceholderText('ММ');
      fireEvent.change(minutesInput, { target: { value: '30' } });
      
      // Dropdown должен остаться открытым
      expect(screen.getByText('Выберите время')).toBeInTheDocument();
    });

    it('должен правильно обновлять время при ручном вводе часов', () => {
      render(<TimePicker value="09:30" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      const hoursInput = screen.getByPlaceholderText('ЧЧ');
      fireEvent.change(hoursInput, { target: { value: '14' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('14:30');
    });

    it('должен правильно обновлять время при ручном вводе минут', () => {
      render(<TimePicker value="09:30" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      const minutesInput = screen.getByPlaceholderText('ММ');
      fireEvent.change(minutesInput, { target: { value: '45' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('09:45');
    });
  });

  describe('Валидация dropdown полей', () => {
    it('должен ограничивать часы в dropdown до 23', () => {
      render(<TimePicker value="09:30" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      const hoursInput = screen.getByPlaceholderText('ЧЧ');
      fireEvent.change(hoursInput, { target: { value: '23' } });
      
      // Должно обновить время с максимальными часами
      expect(mockOnChange).toHaveBeenCalledWith('23:30');
    });

    it('должен ограничивать минуты в dropdown до 59', () => {
      render(<TimePicker value="09:30" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      const minutesInput = screen.getByPlaceholderText('ММ');
      fireEvent.change(minutesInput, { target: { value: '59' } });
      
      // Должно обновить время с максимальными минутами
      expect(mockOnChange).toHaveBeenCalledWith('09:59');
    });

    it('должен отображать текущие значения в полях dropdown', () => {
      render(<TimePicker value="14:25" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      const hoursInput = screen.getByPlaceholderText('ЧЧ');
      const minutesInput = screen.getByPlaceholderText('ММ');
      
      expect(hoursInput.value).toBe('14');
      expect(minutesInput.value).toBe('25');
    });
  });

  describe('Закрытие dropdown', () => {
    it('должен закрываться при клике вне области', async () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      // Открываем dropdown
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      expect(screen.getByText('Выберите время')).toBeInTheDocument();
      
      // Кликаем вне области
      fireEvent.mouseDown(document.body);
      
      await waitFor(() => {
        expect(screen.queryByText('Выберите время')).not.toBeInTheDocument();
      });
    });
  });

  describe('Состояния disabled', () => {
    it('не должен открывать dropdown когда disabled', () => {
      render(<TimePicker value="" onChange={mockOnChange} disabled={true} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      expect(screen.queryByText('Выберите время')).not.toBeInTheDocument();
    });

    it('должен отображать disabled состояние для основного поля', () => {
      render(<TimePicker value="12:30" onChange={mockOnChange} disabled={true} />);
      
      const input = screen.getByPlaceholderText('09:30');
      expect(input).toBeDisabled();
    });

    it('должен отображать disabled состояние для кнопки', () => {
      render(<TimePicker value="12:30" onChange={mockOnChange} disabled={true} />);
      
      const button = screen.getByTitle('Выбрать время');
      expect(button).toBeDisabled();
    });
  });

  describe('Кастомные placeholder и value', () => {
    it('должен отображать кастомный placeholder', () => {
      render(<TimePicker value="" onChange={mockOnChange} placeholder="Введите время" />);
      
      expect(screen.getByPlaceholderText('Введите время')).toBeInTheDocument();
    });

    it('должен отображать переданное значение', () => {
      render(<TimePicker value="15:45" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      expect(input.value).toBe('15:45');
    });
  });

  describe('Выделение активного времени в быстром выборе', () => {
    it('должен выделять текущее время в быстром выборе', () => {
      render(<TimePicker value="12:00" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      const activeButton = screen.getByText('12:00');
      expect(activeButton).toHaveClass('bg-blue-600');
    });

    it('не должен выделять время, которого нет в быстром выборе', () => {
      render(<TimePicker value="12:30" onChange={mockOnChange} />);
      
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      // Проверяем что ни одна кнопка не выделена
      const buttons = screen.getAllByRole('button');
      const quickTimeButtons = buttons.filter(btn => /^\d{2}:\d{2}$/.test(btn.textContent || ''));
      
      quickTimeButtons.forEach(btn => {
        expect(btn).not.toHaveClass('bg-blue-600');
      });
    });
  });
});
