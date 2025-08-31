import { describe, it, expect, beforeEach, vi } from 'vitest';
import { statisticsLayoutService } from '../statisticsLayoutService';
import api from '../api';

// Mock the api module
vi.mock('../api');

describe('statisticsLayoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getStatisticsLayout', () => {
    it('should fetch statistics layout successfully', async () => {
      const mockLayout = {
        'completed-tasks': { position: 0, visible: true },
        'overdue-tasks': { position: 1, visible: true },
        'user-teams': { position: 2, visible: true },
        'user-projects': { position: 3, visible: true },
        'feedback': { position: 4, visible: true }
      };
      
      api.get.mockResolvedValue({ data: { layout: mockLayout } });
      
      const result = await statisticsLayoutService.getStatisticsLayout();
      
      expect(api.get).toHaveBeenCalledWith('/api/personal-dashboard/statistics-layout');
      expect(result).toEqual(mockLayout);
    });

    it('should handle errors when fetching statistics layout', async () => {
      const mockError = new Error('Network error');
      api.get.mockRejectedValue(mockError);
      
      await expect(statisticsLayoutService.getStatisticsLayout()).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalledWith('Error fetching statistics layout:', mockError);
    });
  });

  describe('updateStatisticsLayout', () => {
    it('should update statistics layout successfully', async () => {
      const mockLayout = [
        { card_id: 'completed-tasks', position: 0, visible: true },
        { card_id: 'overdue-tasks', position: 1, visible: true }
      ];
      
      const mockResponse = {
        'completed-tasks': { position: 0, visible: true },
        'overdue-tasks': { position: 1, visible: true }
      };
      
      api.post.mockResolvedValue({ data: { layout: mockResponse } });
      
      const result = await statisticsLayoutService.updateStatisticsLayout(mockLayout);
      
      expect(api.post).toHaveBeenCalledWith('/api/personal-dashboard/statistics-layout', { cards: mockLayout });
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors when updating statistics layout', async () => {
      const mockError = new Error('Server error');
      const mockLayout = [{ card_id: 'completed-tasks', position: 0, visible: true }];
      
      api.post.mockRejectedValue(mockError);
      
      await expect(statisticsLayoutService.updateStatisticsLayout(mockLayout)).rejects.toThrow('Server error');
      expect(console.error).toHaveBeenCalledWith('Error updating statistics layout:', mockError);
    });
  });
});
