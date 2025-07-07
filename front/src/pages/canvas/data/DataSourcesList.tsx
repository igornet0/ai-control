// src/data/DataSourcesList.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export default function DataSourcesList() {
  const sources = useSelector((state: RootState) => state.dataSource.sources);

  return (
    <div style={{ marginTop: '20px' }}>
      <h4>Источники данных</h4>
      <ul>
        {sources.map(source => (
          <li key={source.id}>{source.name}</li>
        ))}
      </ul>
    </div>
  );
}