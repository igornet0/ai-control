import React from 'react';

export default function KPIWidget() {
  const value = 42;       // Пример значения
  const label = 'Новая метрика';

  return (
    <div style={{
      width: '100%', padding: '20px', textAlign: 'center',
      background: '#f9f9f9', borderRadius: '4px'
    }}>
      <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{value}</div>
      <div style={{ marginTop: '4px', color: '#555' }}>{label}</div>
    </div>
  );
}