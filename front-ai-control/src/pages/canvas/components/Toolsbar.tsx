import React from 'react';
import { WidgetRect } from '../core/widgets/WidgetRect';
import { WidgetBase } from '../core/WidgetBase';
import { WidgetBarChart } from '../core/widgets/WidgetBarChart';
import { WidgetLineChart } from '../core/widgets/WidgetLineChart';
import { WidgetPieChart } from '../core/widgets/WidgetPieChart';
import { WidgetTable } from '../core/widgets/WidgetTable';
import { WidgetContainer } from '../core/widgets/WidgetContainer';
import { WidgetFilter } from '../core/widgets/WidgetFilter';
import {GRID_SIZE} from '../CanvasApp';

type ToolsbarProps = {
  widgets: WidgetBase[];
  setWidgets: React.Dispatch<React.SetStateAction<WidgetBase[]>>;
  canvasSize: { width: number; height: number };
};

const Toolsbar: React.FC<ToolsbarProps> = ({ widgets, setWidgets, canvasSize }) => {

  const findFreeSpot = (type: string): { x: number; y: number } => {
    const width = type === 'rect' ? GRID_SIZE * 5 : GRID_SIZE * 10;
    const height = type === 'rect' ? GRID_SIZE * 5 : GRID_SIZE * 10;

    for (let y = 0; y < canvasSize.height; y += GRID_SIZE) {
      for (let x = 0; x < canvasSize.width; x += GRID_SIZE) {
        const tempWidget = new WidgetRect({
          id: '1',
          x,
          y,
          width: width,
          height: height,
          type: 'rect',
        });

        const collides = widgets.some(widget => {
          return !(
            tempWidget.x + tempWidget.width <= widget.x ||
            tempWidget.x >= widget.x + widget.width ||
            tempWidget.y + tempWidget.height <= widget.y ||
            tempWidget.y >= widget.y + widget.height
          );
        });

        if (!collides) {
          return { x, y };
        }
      }
    }
    return { x: 0, y: 0 }; 
  };

  const addWidget = (type: string) => {
    const id = Date.now().toString();
    const { x, y } = findFreeSpot(type);
    let widget: WidgetBase;

    switch (type) {
      case 'rect':
        widget = new WidgetRect({ id, x, y, width: GRID_SIZE * 5, height: GRID_SIZE * 5, type });
        break;
      case 'bar-chart':
        widget = new WidgetBarChart({ id, x, y, width: GRID_SIZE * 10, height: GRID_SIZE * 10, type, 
          data: [5, 15, 25], labels: ['X', 'Y', 'Z'] });
        break;
      case 'line-chart':
        widget = new WidgetLineChart({ id, x, y, width: GRID_SIZE * 10, height: GRID_SIZE * 10, type, 
          data: [10, 40, 30, 60], labels: ['Q1', 'Q2', 'Q3', 'Q4'] });
        break;
      case 'pie-chart':
        widget = new WidgetPieChart({ id, x, y, width: GRID_SIZE * 10, height: GRID_SIZE * 10, type, 
          data: [20, 30, 10], labels: ['Apples', 'Bananas', 'Cherries'] });
        break;
      case 'table':
        widget = new WidgetTable({ id, x, y, width: GRID_SIZE * 10, height: GRID_SIZE * 10, type, 
          columns: ['Name', 'Value'], data: [['Alpha', '100'], ['Beta', '200'], ['Gamma', '300']] });
        break;
      case 'container':
        widget = new WidgetContainer({ id, x, y, width: GRID_SIZE * 10, height: GRID_SIZE * 10, type });
        break;
      case 'filter':
        widget = new WidgetFilter({ id, x, y, width: GRID_SIZE * 10, height: GRID_SIZE * 6, type, options: [] });
        break;
      default:
        return;
    }
    setWidgets(prev => [...prev, widget]);
  };

  return (
    <div className="bg-gradient-to-b from-[#0D1414] to-[#16251C] text-white rounded-md shadow-md w-full flex flex-wrap items-center gap-3">
      <button onClick={() => addWidget('rect')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm">➕ Rect</button>
      <button onClick={() => addWidget('filter')} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded text-sm">🔍 Filter</button>
      <button onClick={() => addWidget('bar-chart')} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm">📊 Bar</button>
      <button onClick={() => addWidget('line-chart')} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm">📈 Line</button>
      <button onClick={() => addWidget('pie-chart')} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 rounded text-sm">🥧 Pie</button>
      <button onClick={() => addWidget('table')} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded text-sm">📋 Table</button>
      <button onClick={() => addWidget('container')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm">📦 Container</button>
    </div>
  );
};

export default Toolsbar;