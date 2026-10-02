import api from './api';

const DEFAULT_TASK_WIDGET_ROW_SPAN = 4;

const getDefaultTaskWidgetsLayout = () => ({
  'progress-chart': { position: 0, visible: true, col_span: 1, row_span: DEFAULT_TASK_WIDGET_ROW_SPAN },
  'bar-chart': { position: 1, visible: true, col_span: 1, row_span: DEFAULT_TASK_WIDGET_ROW_SPAN },
  'team-ratings': { position: 2, visible: true, col_span: 1, row_span: DEFAULT_TASK_WIDGET_ROW_SPAN },
});

export const taskWidgetsLayoutService = {
  getDefaultLayout: getDefaultTaskWidgetsLayout,

  getTaskWidgetsLayout: async () => {
    try {
      const response = await api.get('/api/personal-dashboard/task-widgets-layout');
      return response.data?.layout ?? getDefaultTaskWidgetsLayout();
    } catch (error) {
      console.error('Error fetching task widgets layout:', error);
      return getDefaultTaskWidgetsLayout();
    }
  },

  updateTaskWidgetsLayout: async (layout) => {
    try {
      const response = await api.post('/api/personal-dashboard/task-widgets-layout', { cards: layout });
      return response.data.layout;
    } catch (error) {
      console.error('Error updating task widgets layout:', error);
      throw error;
    }
  },
};
