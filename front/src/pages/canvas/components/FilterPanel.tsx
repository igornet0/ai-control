import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { addFilter, removeFilter } from '../store/filterSlice';
import { v4 as uuidv4 } from 'uuid';

export default function FilterPanel() {
  const dispatch = useDispatch();
  const filters = useSelector((state: RootState) => state.filter.filters);
  const dataSources = useSelector((state: RootState) => state.dataSource.sources);

  const [field, setField] = useState('');
  const [value, setValue] = useState('');

  const handleAddFilter = () => {
    if (!field || !value) return;

    dispatch(addFilter({ id: uuidv4(), field, value }));
    setField('');
    setValue('');
  };

  return (
    <div style={{ padding: '10px' }}>
      <h4>Фильтры</h4>

      <input
        type="text"
        placeholder="Поле"
        value={field}
        onChange={(e) => setField(e.target.value)}
      />
      <input
        type="text"
        placeholder="Значение"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button onClick={handleAddFilter}>Добавить фильтр</button>

      <ul>
        {filters.map(f => (
          <li key={f.id}>
            {f.field} = {f.value}
            <button onClick={() => dispatch(removeFilter(f.id))}>❌</button>
          </li>
        ))}
      </ul>
    </div>
  );
}