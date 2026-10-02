# Widget examples

## custom-widget-minimal

From-scratch widget with `settingsPanel` contribution.

```js
import counterDefinition from './examples/custom-widget-minimal/counterWidget.js';
engine.register(counterDefinition);
```

## fork-html

Extends built-in `CustomHTMLWidget` / `htmlDefinition`.

```js
import forkedHtmlDefinition from './examples/fork-html/forkedHtmlWidget.js';
engine.register(forkedHtmlDefinition);
```

## Scaffold

```bash
node scripts/create-widget.mjs my-widget
node scripts/create-widget.mjs my-html --from html
node scripts/create-widget.mjs demo --example
```

See [docs/widget-sdk.md](../docs/widget-sdk.md).
