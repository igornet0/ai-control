#!/usr/bin/env node
/**
 * Scaffold a new widget definition file.
 *
 * Usage:
 *   node scripts/create-widget.mjs my-widget
 *   node scripts/create-widget.mjs my-html --from html
 *
 * Writes to src/widgets/<type>/<type>Definition.js (or examples/ if --example).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const typeArg = args.find((a) => !a.startsWith('--'));
const fromIdx = args.indexOf('--from');
const from = fromIdx >= 0 ? args[fromIdx + 1] : null;
const asExample = args.includes('--example');

if (!typeArg || !/^[a-z][a-z0-9_-]*$/i.test(typeArg)) {
  console.error('Usage: node scripts/create-widget.mjs <type> [--from html|kpi] [--example]');
  process.exit(1);
}

const type = typeArg;
const className = type
  .split(/[-_]/)
  .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
  .join('') + 'Widget';
const displayName = type
  .split(/[-_]/)
  .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
  .join(' ');

const outDir = asExample
  ? path.join(root, 'examples', type)
  : path.join(root, 'src', 'widgets', type);
const outFile = path.join(outDir, `${type.replace(/-/g, '_')}Definition.js`);

if (fs.existsSync(outFile)) {
  console.error(`Already exists: ${outFile}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

let contents;
if (from === 'html') {
  contents = `import { defineWidget, CustomHTMLWidget, htmlDefinition } from '${asExample ? '../../src/sdk/index.js' : '../../sdk/index.js'}';

class ${className} extends CustomHTMLWidget {
  constructor(config = {}) {
    super({ ...config, type: '${type}' });
  }
}

export default defineWidget({
  ...htmlDefinition,
  type: '${type}',
  displayName: '${displayName}',
  category: 'custom',
  WidgetClass: ${className},
});
`;
} else if (from === 'kpi') {
  contents = `import { defineWidget, WidgetBase } from '${asExample ? '../../src/sdk/index.js' : '../../sdk/index.js'}';
import { KpiWidget } from '${asExample ? '../../src/widgets/KpiWidget.js' : '../KpiWidget.js'}';

class ${className} extends KpiWidget {
  constructor(config = {}) {
    super({ ...config, type: '${type}' });
  }
}

export default defineWidget({
  type: '${type}',
  displayName: '${displayName}',
  category: 'custom',
  defaultSize: { width: 280, height: 160 },
  capabilities: { dataBinding: 'single-field', formulas: true, reloadable: true },
  WidgetClass: ${className},
  // Add settingsPanel.sections to contribute editor UI without editing widget-style-panel.js
});
`;
} else {
  contents = `import { defineWidget, WidgetBase } from '${asExample ? '../../src/sdk/index.js' : '../../sdk/index.js'}';

class ${className} extends WidgetBase {
  constructor(config = {}) {
    super({
      ...config,
      type: '${type}',
      width: config.width || 280,
      height: config.height || 160,
    });
    this.settings = {
      label: 'Hello',
      ...(config.settings || {}),
    };
  }

  render() {
    const content = this.element?.querySelector('.widget-content');
    if (!content) return;
    content.textContent = this.settings.label || '';
  }
}

export default defineWidget({
  type: '${type}',
  displayName: '${displayName}',
  category: 'custom',
  defaultSize: { width: 280, height: 160 },
  defaultSettings: () => ({ label: 'Hello' }),
  capabilities: { dataBinding: 'none', formulas: false, reloadable: false },
  WidgetClass: ${className},
  settingsPanel: {
    sections: [
      {
        id: 'content',
        title: '${displayName}',
        render(api) {
          const wrap = document.createElement('div');
          wrap.className = 'style-control-group';
          const input = document.createElement('input');
          input.className = 'style-input';
          input.value = api.getSettings().label || '';
          input.addEventListener('input', () => {
            api.patchSettings({ label: input.value });
            api.widget.render();
          });
          wrap.appendChild(input);
          return wrap;
        },
      },
    ],
  },
  paletteDefaults: () => ({ settings: { label: 'Hello' } }),
});
`;
}

fs.writeFileSync(outFile, contents, 'utf8');
console.log(`Created ${outFile}`);
console.log(`Register with: engine.register(await import('${path.relative(root, outFile)}').then(m => m.default));`);
