// src/data/DataSourceManager.tsx
import React, { useRef } from 'react';
import { useDispatch } from 'react-redux';
import { addDataSource } from '../store/dataSourceSlice';
import { v4 as uuidv4 } from 'uuid';
import Papa, { ParseResult } from 'papaparse';

export default function DataSourceManager() {
  const dispatch = useDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        complete: (results: ParseResult<Record<string, unknown>>) => {
          dispatch(addDataSource({
            id: uuidv4(),
            name: file.name,
            type: 'csv',
            data: results.data,
          }));
        },
      });
    } else if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const json = JSON.parse(event.target.result as string);
          dispatch(addDataSource({
            id: uuidv4(),
            name: file.name,
            type: 'json',
            data: json,
          }));
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <h4>Добавить источник данных</h4>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} />
    </div>
  );
}