import React, { useState } from 'react';
import { WidgetFilter } from '../core/widgets/WidgetFilter';
import { WidgetBase } from '../core/WidgetBase';

type Props = {
  widget: WidgetFilter;
  setWidgets: React.Dispatch<React.SetStateAction<WidgetBase[]>>;
};

export const EditFilterWidget: React.FC<Props> = ({ widget, setWidgets }) => {
  const [col, setCol] = useState('');
  const [op, setOp] = useState('=');
  const [val, setVal] = useState('');

  const apply = () => {
    widget.setOption({ column: col, operator: op, value: isNaN(Number(val)) ? val : Number(val) });
    setWidgets(ws =>
      ws.map(w => (w.id === widget.id ? widget : w))
    );
  };

  return (
    <div style={{
      position: 'absolute', 
      top: widget.y + widget.height + 10, 
      left: widget.x,
      background: '#333',
      color: '#fff',
      padding: '10px',
      borderRadius: '5px'
    }}>
      <h4>Настройка фильтра</h4>
      <input placeholder="Column" value={col} onChange={e => setCol(e.target.value)} style={{ width: 100 }} />
      <select value={op} onChange={e => setOp(e.target.value)}>
        <option value="=">=</option>
        <option value="!=">!=</option>
        <option value=">">&gt;</option>
        <option value="<">&lt;</option>
        <option value="contains">contains</option>
      </select>
      <input placeholder="Value" value={val} onChange={e => setVal(e.target.value)} style={{ width: 100 }} />
      <button onClick={apply}>Добавить</button>
    </div>
  );
};