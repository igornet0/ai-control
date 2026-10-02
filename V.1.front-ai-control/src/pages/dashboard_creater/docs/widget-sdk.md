# Dashboard Creator Widget SDK

Developer-facing API for custom widgets inside the dashboard canvas engine.

## Package boundaries

| Belongs in SDK | Stays in app host (`DashboardCreaterApp`) |
|----------------|-------------------------------------------|
| `WidgetBase`, `WorkspaceEngine`, `WidgetManager`, `EventBus`, `Serializer` | React shell, routing, auth, autosave, WebSocket |
| `defineWidget`, registry, settings panel contributions | `sheetService` / `widgetService` / HTTP API |
| Formula core (`src/formula/*`) | Share links, navigation chrome |
| Built-in widgets + `widgets/common/*` | Concrete data/navigation adapter implementations |

## Forbidden in widget / definition code

Do **not** rely on these from new widgets (legacy builtins may still use them until migrated):

- `window.engine` — use `WidgetContext` / `reloadFromDataModel(ctx)` instead
- Direct imports from `front-ai-control/src/services/*` — use `ctx.data` / `ctx.navigation` adapters
- Editing `main/widget-style-panel.js` for type-specific UI — use `settingsPanel` on the definition

## Runtime contract (`WidgetBase`)

| Member | Role |
|--------|------|
| `constructor(config)` | Sets `id`, `type`, `x/y/width/height`, `settings`, `dataSource`, `styles`; builds DOM |
| `render()` | Paint into `.widget-content` |
| `update()` | `render()` + `applyStyles()` |
| `reloadFromDataModel(ctx)` | Async data refresh (`ctx` is engine or WidgetContext; prefer `ctx`) |
| `toJSON()` / `fromJSON(json)` | Persist `{ id, type, x, y, width, height, zIndex, settings, dataSource, styles }` |
| `destroy()` | Remove DOM / timers / controllers |
| `setStyles` / `getStyles` / `applyStyles` | Shared appearance model |

Wire format is stable — SDK changes author API only, not saved JSON shape.

## Defining a widget

```js
import { defineWidget, WidgetBase } from '../src/sdk/index.js';

export default defineWidget({
  type: 'my-widget',
  displayName: 'My Widget',
  category: 'custom',
  defaultSize: { width: 280, height: 160 },
  defaultSettings: () => ({ label: 'Hello' }),
  defaultStyles: () => ({}),
  capabilities: {
    dataBinding: 'none', // 'none' | 'single-field' | 'dim-measure' | 'multi-field'
    formulas: false,
    reloadable: false,
  },
  WidgetClass: class extends WidgetBase {
    render() {
      const el = this.element.querySelector('.widget-content');
      if (el) el.textContent = this.settings.label || '';
    }
  },
  settingsPanel: {
    sections: [
      {
        id: 'content',
        title: 'Содержимое',
        render(api) {
          const wrap = document.createElement('div');
          wrap.className = 'style-section-inner';
          const input = document.createElement('input');
          input.className = 'style-input';
          input.value = api.getSettings().label || '';
          input.addEventListener('input', () => {
            api.patchSettings({ label: input.value });
            api.requestReload();
          });
          wrap.appendChild(input);
          return wrap;
        },
      },
    ],
  },
  applyDataField(settings, dataSource, fieldPayload) {
    return { settings, dataSource };
  },
  paletteDefaults: () => ({ settings: { label: 'Demo' } }),
});
```

Register on the host:

```js
engine.register(myWidgetDefinition);
// or legacy: engine.registerWidget('my-widget', MyWidgetClass);
```

## Settings panel API

Passed to `settingsPanel.sections[].render(api)`:

| Method | Description |
|--------|-------------|
| `widget` / `engine` | Current instance and host engine |
| `getSettings()` / `setSettings(s)` / `patchSettings(partial)` | Settings access |
| `getStyles()` / `setStyles(s)` | Shared style model |
| `openFormulaEditor(opts)` | Opens formula modal when host supports it |
| `requestReload()` | Calls `reloadFromDataModel` + `update` |
| `onChange(cb)` / `destroy()` | Lifecycle for the contribution |

Custom widgets receive the same shared chrome (layout, appearance, typography, borders, shadows, animations, advanced CSS) plus their contributed sections.

## WidgetContext

```js
ctx = {
  mode,           // 'editor' | 'viewer'
  eventBus,
  engine,         // transitional shim — prefer adapters
  data: { … },    // query / schema / filters (host-injected)
  navigation: { … },
  ui: { notify, openModal },
};
```

Host sets adapters via `engine.setWidgetAdapters({ data, navigation, ui })`.

## Forking a built-in

Import the definition and class, then extend:

```js
import { htmlDefinition } from '../src/widgets/html/htmlDefinition.js';
import { CustomHTMLWidget } from '../src/widgets/CustomHTMLWidget.js';

export default defineWidget({
  ...htmlDefinition,
  type: 'my-html',
  displayName: 'My HTML',
  WidgetClass: class extends CustomHTMLWidget { /* … */ },
});
```

See `examples/custom-widget-minimal` and `examples/fork-html`.
