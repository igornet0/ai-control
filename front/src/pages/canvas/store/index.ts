import { configureStore } from '@reduxjs/toolkit';
import dashboardReducer from './dashboardSlice';
import dataSourceReducer from './dataSourceSlice';
import filterReducer from './filterSlice';

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    dataSource: dataSourceReducer,
    filter: filterReducer, 
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;