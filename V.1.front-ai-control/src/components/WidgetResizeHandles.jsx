import React from 'react';

const HANDLES = [
  {
    dir: 's',
    className: 'widget-resize-handle--s',
    cursor: 'ns-resize',
    label: 'Потяните вниз или вверх, чтобы изменить высоту',
    show: () => true,
  },
  {
    dir: 'e',
    className: 'widget-resize-handle--e',
    cursor: 'ew-resize',
    label: 'Потяните вправо или влево, чтобы изменить ширину',
    show: (gridColumns) => gridColumns > 1,
  },
  {
    dir: 'se',
    className: 'widget-resize-handle--se',
    cursor: 'nwse-resize',
    label: 'Потяните угол, чтобы изменить ширину и высоту',
    show: (gridColumns) => gridColumns > 1,
  },
];

export default function WidgetResizeHandles({ enabled, gridColumns = 1, onResizeStart }) {
  if (!enabled) return null;

  return (
    <>
      {HANDLES.filter((handle) => handle.show(gridColumns)).map(({ dir, className, cursor, label }) => (
        <div
          key={dir}
          role="button"
          aria-label={label}
          title={label}
          className={`widget-resize-handle ${className}`}
          style={{ cursor, touchAction: 'none' }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onResizeStart(dir, event);
          }}
        >
          {dir === 'se' && (
            <svg className="widget-resize-grip" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M14 14H9V9H14V14ZM14 8H9V3H14V8ZM8 14H3V9H8V14Z" fill="currentColor" opacity="0.55" />
            </svg>
          )}
        </div>
      ))}
    </>
  );
}
