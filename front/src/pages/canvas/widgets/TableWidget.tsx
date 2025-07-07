// /src/widgets/TableWidget.tsx
import React from 'react';

const sampleData = [
  { id: 1, name: 'Товар A', sales: 100 },
  { id: 2, name: 'Товар B', sales: 150 },
  { id: 3, name: 'Товар C', sales: 200 },
];

export default function TableWidget() {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th>ID</th><th>Название</th><th>Продажи</th>
        </tr>
      </thead>
      <tbody>
        {sampleData.map(item => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{item.name}</td>
            <td>{item.sales}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}