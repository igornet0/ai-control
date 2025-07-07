import { WidthProvider, Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import ChartWidget from './widgets/ChartWidget';
import TableWidget from './widgets/TableWidget';
import KPIWidget from './widgets/KPIWidget';
import WidgetContainer from './widgets/WidgetContainer';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function Canvas() {
  const widgets = useSelector((state: RootState) => state.dashboard.widgets);

  const layout = widgets.map(w => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }));

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      breakpoints={{ lg: 1200 }}
      cols={{ lg: 12 }}
      rowHeight={30}
      isResizable
      isDraggable
    >
      {widgets.map(widget => (
        <div key={widget.id} data-grid={{ x: widget.x, y: widget.y, w: widget.w, h: widget.h }}>
          <WidgetContainer widgetId={widget.id}>
            {widget.type === 'chart' && <ChartWidget widgetId={widget.id} />}
            {widget.type === 'table' && <TableWidget />}
            {widget.type === 'kpi' && <KPIWidget />}
        </WidgetContainer>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
}