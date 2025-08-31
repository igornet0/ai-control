import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { overviewLayoutService } from '../overviewLayoutService';
import api from '../api';

// Mock the api module
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

describe('OverviewLayoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getOverviewLayout', () => {
    it('успешно получает layout карточек', async () => {
      const mockLayout = {
        priorities: { position: 0, visible: true },
        overdue: { position: 1, visible: true }
      };

      api.get.mockResolvedValue({
        data: { layout: mockLayout }
      });

      const result = await overviewLayoutService.getOverviewLayout();

      expect(api.get).toHaveBeenCalledWith('/api/personal-dashboard/overview-layout');
      expect(result).toEqual(mockLayout);
    });

    it('обрабатывает ошибки API', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.get.mockRejectedValue(new Error('API Error'));

      await expect(overviewLayoutService.getOverviewLayout()).rejects.toThrow('API Error');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error getting overview layout:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updateOverviewLayout', () => {
    it('успешно обновляет layout карточек', async () => {
      const mockCards = [
        { card_id: 'priorities', position: 0, visible: true },
        { card_id: 'overdue', position: 1, visible: true }
      ];

      const mockResponse = {
        message: 'Layout updated successfully',
        layout: {}
      };

      api.post.mockResolvedValue({
        data: mockResponse
      });

      const result = await overviewLayoutService.updateOverviewLayout(mockCards);

      expect(api.post).toHaveBeenCalledWith('/api/personal-dashboard/overview-layout', {
        cards: mockCards
      });
      expect(result).toEqual(mockResponse);
    });

    it('обрабатывает ошибки при обновлении', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.post.mockRejectedValue(new Error('Update Error'));

      const mockCards = [
        { card_id: 'priorities', position: 0, visible: true }
      ];

      await expect(overviewLayoutService.updateOverviewLayout(mockCards)).rejects.toThrow('Update Error');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error updating overview layout:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getDefaultLayout', () => {
    it('возвращает корректный дефолтный layout', () => {
      const defaultLayout = overviewLayoutService.getDefaultLayout();

      expect(defaultLayout).toEqual({
        "priorities": { "position": 0, "visible": true },
        "overdue": { "position": 1, "visible": true },
        "upcoming": { "position": 2, "visible": true },
        "projects": { "position": 3, "visible": true },
        "notes": { "position": 4, "visible": true },
        "checklist": { "position": 5, "visible": true },
        "time-management": { "position": 6, "visible": true }
      });
    });
  });

  describe('layoutToCards', () => {
    it('конвертирует layout объект в массив карточек', () => {
      const layout = {
        priorities: { position: 0, visible: true },
        overdue: { position: 1, visible: false }
      };

      const cards = overviewLayoutService.layoutToCards(layout);

      expect(cards).toEqual([
        { card_id: 'priorities', position: 0, visible: true },
        { card_id: 'overdue', position: 1, visible: false }
      ]);
    });

    it('обрабатывает пустой layout', () => {
      const cards = overviewLayoutService.layoutToCards({});
      expect(cards).toEqual([]);
    });
  });

  describe('cardsToLayout', () => {
    it('конвертирует массив карточек в layout объект', () => {
      const cards = [
        { card_id: 'priorities', position: 0, visible: true },
        { card_id: 'overdue', position: 1, visible: false }
      ];

      const layout = overviewLayoutService.cardsToLayout(cards);

      expect(layout).toEqual({
        priorities: { position: 0, visible: true },
        overdue: { position: 1, visible: false }
      });
    });

    it('обрабатывает пустой массив', () => {
      const layout = overviewLayoutService.cardsToLayout([]);
      expect(layout).toEqual({});
    });
  });

  describe('интеграционные тесты', () => {
    it('правильно преобразует layout туда и обратно', () => {
      const originalLayout = {
        priorities: { position: 0, visible: true },
        overdue: { position: 1, visible: false },
        upcoming: { position: 2, visible: true }
      };

      const cards = overviewLayoutService.layoutToCards(originalLayout);
      const convertedLayout = overviewLayoutService.cardsToLayout(cards);

      expect(convertedLayout).toEqual(originalLayout);
    });

    it('сохраняет порядок карточек при конвертации', () => {
      const layout = {
        checklist: { position: 5, visible: true },
        priorities: { position: 0, visible: true },
        notes: { position: 4, visible: true }
      };

      const cards = overviewLayoutService.layoutToCards(layout);
      
      // Карточки должны быть в том же порядке, что и ключи в объекте
      expect(cards[0].card_id).toBe('checklist');
      expect(cards[1].card_id).toBe('priorities');
      expect(cards[2].card_id).toBe('notes');
    });
  });
});
