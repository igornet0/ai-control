import api from './api';

class OverviewLayoutService {
  /**
   * Получить layout карточек обзора
   */
  async getOverviewLayout() {
    try {
      const response = await api.get('/api/personal-dashboard/overview-layout');
      return response.data?.layout ?? this.getDefaultLayout();
    } catch (error) {
      console.error('Error getting overview layout:', error);
      return this.getDefaultLayout();
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
      priorities: { position: 0, visible: true, col_span: 1, row_span: 2 },
      overdue: { position: 1, visible: true, col_span: 1, row_span: 4 },
      upcoming: { position: 2, visible: true, col_span: 1, row_span: 4 },
      projects: { position: 3, visible: true, col_span: 1, row_span: 2 },
      notes: { position: 4, visible: true, col_span: 1, row_span: 2 },
      checklist: { position: 5, visible: true, col_span: 1, row_span: 2 },
      'time-management': { position: 6, visible: true, col_span: 1, row_span: 2 },
      'ai-analysis': { position: 7, visible: true, col_span: 1, row_span: 3 },
      'ai-chat': { position: 8, visible: true, col_span: 2, row_span: 4 },
    };
  }

  layoutToCards(layout) {
    return Object.entries(layout).map(([cardId, config]) => ({
      card_id: cardId,
      position: config.position,
      visible: config.visible,
      col_span: config.col_span ?? 1,
      row_span: config.row_span ?? 1,
    }));
  }

  cardsToLayout(cards) {
    const layout = {};
    cards.forEach((card) => {
      layout[card.card_id] = {
        position: card.position,
        visible: card.visible,
        col_span: card.col_span ?? 1,
        row_span: card.row_span ?? 1,
      };
    });
    return layout;
  }
}

export const overviewLayoutService = new OverviewLayoutService();
export default overviewLayoutService;
