// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ContainerWidget } from '../src/widgets/ContainerWidget.js';

describe('ContainerWidget title layout', () => {
  it('getAvailableSize subtracts title reserve when showTitle is on (fallback path)', () => {
    const container = new ContainerWidget({
      width: 700,
      height: 340,
      settings: {
        showTitle: true,
        title: 'Container',
        titleSize: 14,
      },
    });
    // Без mounted content-area — fallback формула
    container.headerHeight = 80;
    container.contentPadding = 8;
    container.tabPosition = 'top';

    const withTitle = container.getAvailableSize();
    container.settings.showTitle = false;
    const withoutTitle = container.getAvailableSize();

    expect(withTitle.height).toBeLessThan(withoutTitle.height);
    // 340 - 80 - 16 - titleReserve(~14*1.25+8≈26) ≈ 218
    expect(withTitle.height).toBeLessThanOrEqual(340 - 80 - 16 - 20);
  });

  it('getAvailableSize prefers measured content-area size', () => {
    const container = new ContainerWidget({
      width: 700,
      height: 340,
      settings: { showTitle: true, title: 'Container' },
    });
    document.body.appendChild(container.element);
    container.createElement();

    const contentArea = container.element.querySelector('.container-content-area');
    expect(contentArea).toBeTruthy();
    Object.defineProperty(contentArea, 'clientWidth', { configurable: true, get: () => 684 });
    Object.defineProperty(contentArea, 'clientHeight', { configurable: true, get: () => 220 });

    const size = container.getAvailableSize();
    expect(size.width).toBe(684 - 16);
    expect(size.height).toBe(220 - 16);

    container.destroy();
  });

  it('tab label is independent from child widget title', () => {
    const container = new ContainerWidget({ width: 600, height: 400 });
    const child = {
      id: 'widget_child',
      type: 'table',
      settings: { title: 'Orders table heading', showTitle: true },
    };
    container.widgetReferences.set(child.id, child);
    container.containedWidgets = [child.id];
    container.tabGroups = [[child.id]];

    expect(container.getTabLabelForGroup([child.id])).toBe('Таблица');

    container.setCustomTabLabel(child.id, 'Customers');
    expect(container.getTabLabelForGroup([child.id])).toBe('Customers');
    expect(child.settings.title).toBe('Orders table heading');

    container.setCustomTabLabel(child.id, '  ');
    expect(container.getTabLabelForGroup([child.id])).toBe('Таблица');
  });

  it('reads viewer mode from engine so tab close buttons stay hidden after late load', () => {
    const prev = window.engine;
    window.engine = { mode: 'viewer' };

    const container = new ContainerWidget({ width: 600, height: 400 });
    expect(container._resolveMode()).toBe('viewer');

    const child = { id: 'widget_125', type: 'bar-chart', settings: {} };
    container.widgetReferences.set(child.id, child);
    container.containedWidgets = [child.id];
    container.tabGroups = [[child.id]];
    container.activeTabId = child.id;

    document.body.appendChild(container.element);
    container.createElement();
    container.render();

    const tab = container.element.querySelector('.container-tab');
    expect(tab).toBeTruthy();
    expect(tab.textContent).not.toContain('×');

    container.destroy();
    window.engine = prev;
  });
});
