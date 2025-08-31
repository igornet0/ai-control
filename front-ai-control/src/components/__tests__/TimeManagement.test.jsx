import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TimePicker from '../TimePicker';

describe('Time Management Integration Tests', () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe('Интеграция TimePicker с тайм-менеджментом', () => {
    it('должен правильно обрабатывать логику валидации времени как в тайм-менеджменте', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      
      // Тест последовательности ввода как в реальном использовании
      fireEvent.change(input, { target: { value: '1' } });
      expect(mockOnChange).toHaveBeenLastCalledWith('1');
      
      fireEvent.change(input, { target: { value: '12' } });
      expect(mockOnChange).toHaveBeenLastCalledWith('12');
      
      fireEvent.change(input, { target: { value: '125' } });
      expect(mockOnChange).toHaveBeenLastCalledWith('125');
      
      fireEvent.change(input, { target: { value: '1256' } });
      expect(mockOnChange).toHaveBeenLastCalledWith('12:56');
    });

    it('должен сохранять данные в формате для тайм-менеджмента', () => {
      // Имитируем объект расписания как в тайм-менеджменте
      const scheduleItem = { time: '', activity: 'Встреча' };
      
      const updateScheduleItem = (field, value) => {
        scheduleItem[field] = value;
      };

      render(
        <TimePicker 
          value={scheduleItem.time} 
          onChange={(value) => updateScheduleItem('time', value)} 
        />
      );
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '1430' } });
      
      expect(scheduleItem.time).toBe('14:30');
      expect(scheduleItem.activity).toBe('Встреча');
    });

    it('должен работать с dropdown как в тайм-менеджменте', async () => {
      render(<TimePicker value="09:00" onChange={mockOnChange} />);
      
      // Открываем dropdown
      const button = screen.getByTitle('Выбрать время');
      fireEvent.click(button);
      
      // Проверяем что есть популярные времена для рабочего дня
      expect(screen.getByText('08:00')).toBeInTheDocument();
      expect(screen.getByText('09:00')).toBeInTheDocument();
      expect(screen.getByText('12:00')).toBeInTheDocument();
      expect(screen.getByText('14:00')).toBeInTheDocument();
      expect(screen.getByText('17:00')).toBeInTheDocument();
      
      // Выбираем время
      fireEvent.click(screen.getByText('14:00'));
      expect(mockOnChange).toHaveBeenCalledWith('14:00');
      
      // Dropdown должен закрыться
      await waitFor(() => {
        expect(screen.queryByText('Выберите время')).not.toBeInTheDocument();
      });
    });

    it('должен корректно работать в disabled состоянии', () => {
      render(<TimePicker value="12:30" onChange={mockOnChange} disabled={true} />);
      
      const input = screen.getByPlaceholderText('09:30');
      const button = screen.getByTitle('Выбрать время');
      
      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
      
      // Не должен реагировать на клики
      fireEvent.click(button);
      expect(screen.queryByText('Выберите время')).not.toBeInTheDocument();
    });

    it('должен корректно отображать текущее значение', () => {
      render(<TimePicker value="15:45" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      expect(input.value).toBe('15:45');
    });

    it('должен обрабатывать пустые значения', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      expect(input.value).toBe('');
      
      // Вводим время
      fireEvent.change(input, { target: { value: '0900' } });
      expect(mockOnChange).toHaveBeenCalledWith('09:00');
    });
  });

  describe('Тестирование всех кейсов валидации как в реальном использовании', () => {
    const testCases = [
      { input: '1256', expected: '12:56', description: 'Корректное 4-значное время' },
      { input: '0101', expected: '01:01', description: 'Время с ведущими нулями' },
      { input: '3333', expected: '23:33', description: 'Время с ограничением часов' },
      { input: '9999', expected: '23:59', description: 'Максимальные ограничения' },
      { input: '2499', expected: '23:59', description: 'Ограничения часов и минут' },
      { input: '123', expected: '123', description: '3 цифры не форматируются' },
      { input: '12', expected: '12', description: '2 цифры не форматируются' },
      { input: '1', expected: '1', description: '1 цифра не форматируется' },
      { input: '12:34', expected: '12:34', description: 'Уже отформатированное время' },
      { input: '25:99', expected: '23:59', description: 'Некорректное отформатированное время' },
    ];

    testCases.forEach(({ input, expected, description }) => {
      it(`должен правильно обрабатывать: ${description}`, () => {
        render(<TimePicker value="" onChange={mockOnChange} />);
        
        const inputElement = screen.getByPlaceholderText('09:30');
        fireEvent.change(inputElement, { target: { value: input } });
        
        expect(mockOnChange).toHaveBeenCalledWith(expected);
      });
    });
  });

  describe('Производительность и edge cases', () => {
    it('должен обрабатывать быстрый ввод', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      
      // Быстрая последовательность вводов
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.change(input, { target: { value: '125' } });
      fireEvent.change(input, { target: { value: '1256' } });
      
      // Последний вызов должен быть с отформатированным временем
      expect(mockOnChange).toHaveBeenLastCalledWith('12:56');
    });

    it('должен правильно работать с символами и буквами', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: 'ab12cd56ef' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('12:56');
    });

    it('должен обрабатывать очень длинные строки', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '123456789012345' } });
      
      // Должно взять только первые 4 цифры
      expect(mockOnChange).toHaveBeenCalledWith('12:34');
    });

    it('должен обрабатывать специальные символы', () => {
      render(<TimePicker value="" onChange={mockOnChange} />);
      
      const input = screen.getByPlaceholderText('09:30');
      fireEvent.change(input, { target: { value: '!@#12$%^34&*()' } });
      
      expect(mockOnChange).toHaveBeenCalledWith('12:34');
    });
  });
});
