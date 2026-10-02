import { useEffect, useMemo, useState } from 'react';
import { resolveWidgetLayoutProfile } from '../utils/widgetLayoutProfile';

export function useWidgetLayoutProfile(containerRef, widgetSize) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  return useMemo(
    () => resolveWidgetLayoutProfile({
      width: dimensions.width,
      height: dimensions.height,
      colSpan: widgetSize?.colSpan ?? 1,
      rowSpan: widgetSize?.rowSpan ?? 1,
    }),
    [dimensions.width, dimensions.height, widgetSize?.colSpan, widgetSize?.rowSpan],
  );
}
