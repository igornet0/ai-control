/**
 * @typedef {'none' | 'single-field' | 'dim-measure' | 'multi-field'} DataBindingCapability
 *
 * @typedef {object} WidgetCapabilities
 * @property {DataBindingCapability} [dataBinding]
 * @property {boolean} [formulas]
 * @property {boolean} [reloadable]
 *
 * @typedef {object} SettingsPanelSection
 * @property {string} id
 * @property {string} [title]
 * @property {(api: import('./createSettingsPanelApi.js').SettingsPanelApi) => (HTMLElement|DocumentFragment|string|null|undefined)} render
 *
 * @typedef {object} SettingsPanelContribution
 * @property {SettingsPanelSection[]} sections
 *
 * @typedef {object} WidgetDefinition
 * @property {string} type
 * @property {string} [displayName]
 * @property {string} [category]
 * @property {string} [icon]
 * @property {{ width?: number, height?: number }} [defaultSize]
 * @property {() => object} [defaultSettings]
 * @property {() => object} [defaultStyles]
 * @property {WidgetCapabilities} [capabilities]
 * @property {typeof import('../core/WidgetBase.js').WidgetBase} WidgetClass
 * @property {SettingsPanelContribution} [settingsPanel]
 * @property {(settings: object, dataSource: object|null, fieldPayload: object) => { settings?: object, dataSource?: object|null } | void} [applyDataField]
 * @property {() => { settings?: object, styles?: object, dataSource?: object|null, width?: number, height?: number }} [paletteDefaults]
 * @property {boolean} [hideFromPalette]
 * @property {string[]} [aliases]
 */

/**
 * Validate and normalize a widget definition for the registry.
 * @param {WidgetDefinition} def
 * @returns {WidgetDefinition}
 */
export function defineWidget(def) {
  if (!def || typeof def !== 'object') {
    throw new Error('defineWidget: definition object is required');
  }
  if (!def.type || typeof def.type !== 'string') {
    throw new Error('defineWidget: `type` string is required');
  }
  if (!def.WidgetClass) {
    throw new Error(`defineWidget(${def.type}): WidgetClass is required`);
  }

  const capabilities = {
    dataBinding: 'none',
    formulas: false,
    reloadable: false,
    ...(def.capabilities || {}),
  };

  return {
    displayName: def.displayName || def.type,
    category: def.category || 'custom',
    icon: def.icon || '',
    defaultSize: def.defaultSize || { width: 300, height: 200 },
    defaultSettings: typeof def.defaultSettings === 'function' ? def.defaultSettings : () => ({}),
    defaultStyles: typeof def.defaultStyles === 'function' ? def.defaultStyles : () => ({}),
    hideFromPalette: !!def.hideFromPalette,
    aliases: Array.isArray(def.aliases) ? [...def.aliases] : [],
    ...def,
    capabilities,
    type: String(def.type),
  };
}
