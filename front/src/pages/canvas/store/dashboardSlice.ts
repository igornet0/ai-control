import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type WidgetType = 'chart' | 'table' | 'kpi';

export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  dataSourceId?: string;
  title?: string;       // Новое поле
  chartType?: string;   // Для графиков
}

interface DashboardState {
  widgets: Widget[];
  selectedWidgetId?: string;
}

const initialState: DashboardState = {
  widgets: [],
};

export const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setDashboard(state, action: PayloadAction<Widget[]>) {
        state.widgets = action.payload;
        state.selectedWidgetId = undefined;
    },
    addWidget(state, action: PayloadAction<Widget>) {
      state.widgets.push(action.payload);
    },
    selectWidget(state, action: PayloadAction<string>) {
      state.selectedWidgetId = action.payload;
    },
    updateWidget(state, action: PayloadAction<Partial<Widget> & { id: string }>) {
        const widget = state.widgets.find(w => w.id === action.payload.id);
        if (widget) {
            Object.assign(widget, action.payload);
        }
    },
  },
});

export const { setDashboard, addWidget, selectWidget, updateWidget } = dashboardSlice.actions;
export default dashboardSlice.reducer;