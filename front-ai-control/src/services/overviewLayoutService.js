import api from './api';

class OverviewLayoutService {
  /**
   * Получить layout карточек обзора
   */
  async getOverviewLayout() {
    try {
      const response = await api.get('/api/personal-dashboard/overview-layout');
      return response.data.layout;
    } catch (error) {
      console.error('Error getting overview layout:', error);
      throw error;
    }
  }

  /**
   * Обновить layout карточек обзора
   * @param {Array} cards - Массив карточек с их позициями
   */
  async updateOverviewLayout(cards) {
    try {
      const response = await api.post('/api/personal-dashboard/overview-layout', {
        cards: cards
      });
      return response.data;
    } catch (error) {
      console.error('Error updating overview layout:', error);
      throw error;
    }
  }

  /**
   * Получить дефолтный layout карточек
   */
  getDefaultLayout() {
    return {
      "priorities": { "position": 0, "visible": true },
      "overdue": { "position": 1, "visible": true },
      "upcoming": { "position": 2, "visible": true },
      "projects": { "position": 3, "visible": true },
      "notes": { "position": 4, "visible": true },
      "checklist": { "position": 5, "visible": true },
      "time-management": { "position": 6, "visible": true }
    };
  }

  /**
   * Конвертировать layout объект в массив карточек для API
   * @param {Object} layout - Layout объект
   */
  layoutToCards(layout) {
    return Object.entries(layout).map(([cardId, config]) => ({
      card_id: cardId,
      position: config.position,
      visible: config.visible
    }));
  }

  /**
   * Конвертировать массив карточек в layout объект
   * @param {Array} cards - Массив карточек
   */
  cardsToLayout(cards) {
    const layout = {};
    cards.forEach(card => {
      layout[card.card_id] = {
        position: card.position,
        visible: card.visible
      };
    });
    return layout;
  }
}

export const overviewLayoutService = new OverviewLayoutService();
export default overviewLayoutService;
