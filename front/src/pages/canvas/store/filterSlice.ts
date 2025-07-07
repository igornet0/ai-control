import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Filter {
  id: string;
  field: string;
  value: string | number | [number, number];
}

interface FilterState {
  filters: Filter[];
}

const initialState: FilterState = {
  filters: [],
};

export const filterSlice = createSlice({
  name: 'filter',
  initialState,
  reducers: {
    addFilter(state, action: PayloadAction<Filter>) {
      state.filters.push(action.payload);
    },
    updateFilter(state, action: PayloadAction<Filter>) {
      const idx = state.filters.findIndex(f => f.id === action.payload.id);
      if (idx !== -1) state.filters[idx] = action.payload;
    },
    removeFilter(state, action: PayloadAction<string>) {
      state.filters = state.filters.filter(f => f.id !== action.payload);
    },
    clearFilters(state) {
      state.filters = [];
    },
  },
});

export const { addFilter, updateFilter, removeFilter, clearFilters } = filterSlice.actions;
export default filterSlice.reducer;