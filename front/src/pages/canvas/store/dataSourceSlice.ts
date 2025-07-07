// src/store/dataSourceSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DataSource {
  id: string;               // Уникальный ID
  name: string;             // Название файла
  type: 'csv' | 'json' | 'rest'; // Тип источника
  data: any[];              // Сырые данные (массив объектов)
}

interface DataSourceState {
  sources: DataSource[];    // Массив всех источников
}

const initialState: DataSourceState = {
  sources: [],
};

export const dataSourceSlice = createSlice({
  name: 'dataSource',
  initialState,
  reducers: {
    addDataSource(state, action: PayloadAction<DataSource>) {
      state.sources.push(action.payload);
    },
    setDataSources(state, action: PayloadAction<DataSource[]>) {
        state.sources = action.payload;
    }
  },
});

export const { addDataSource, setDataSources } = dataSourceSlice.actions;
export default dataSourceSlice.reducer;