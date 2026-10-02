/**
 * Resolve the DataCode shown for one widget tab (saved code patched with current settings).
 */
import { generateDataCodeFromConfig, ensureInteractiveDataInputMerge } from './interactive/dataCodeSync.js';
import { createDefaultInteractiveConfig } from './interactive/schema.js';
import {
  generateDefaultFileSourceCode,
  generateDefaultFolderSourceCode,
  findReadAssignment,
  patchFileSourceInCode,
} from './interactive/fileSourceDataCodeSync.js';
import { generateFolderSourceCode } from './interactive/folderDataCodeSync.js';
import { isFolderConfigV2 } from './interactive/folderConfigSchema.js';
import {
  generateDefaultApiSourceCode,
  findSourceTableAssignment,
  patchApiSourceInCode,
} from './interactive/apiSourceDataCodeSync.js';
import {
  generateDefaultDatabaseSourceCode,
  patchDatabaseSourceInCode,
  resolveDatabaseDataCodeVariableName,
} from './interactive/databaseSourceDataCodeSync.js';
import {
  generateDefaultJsonSourceCode,
  patchJsonSourceInCode,
  findSourceTableAssignment as findJsonSourceTableAssignment,
} from './interactive/jsonSourceDataCodeSync.js';
import {
  generateDefaultDatabridgeSourceCode,
  patchDatabridgeSourceInCode,
} from './interactive/databridgeDataCodeSync.js';
import {
  generateFilterDataCode,
  patchFilterDataCodeInCode,
  resolveUpstreamDataCodeVariable,
} from './interactive/filterDataCodeSync.js';
import {
  generateTransformDataCode,
  patchTransformDataCodeInCode,
} from './interactive/transformDataCodeSync.js';
import {
  generateAggregateDataCode,
  patchAggregateDataCodeInCode,
} from './interactive/aggregateDataCodeSync.js';
import {
  generateFormulaDataCode,
  patchFormulaDataCodeInCode,
} from './interactive/formulaDataCodeSync.js';
import {
  generateRelationshipDataCode,
  patchRelationshipDataCodeInCode,
} from './interactive/relationshipDataCodeSync.js';
import { generateLinkedModelDataCode } from './interactive/linkedModelDataCodeSync.js';
import {
  collectJoinTableSources,
  generateJoinDataCode,
  patchJoinDataCodeInCode,
} from './interactive/joinDataCodeSync.js';
import { collectRelationshipTableSources } from './interactive/relationshipSources.js';
import { parseDbWidgetId } from './widgetDbSync.js';

function firstIncoming(widget) {
  const id = widget?.id;
  return (widget?.connections || []).find((c) => c && String(c.to) === String(id)) || null;
}

export function buildProcessingCodegenContext(widget, widgetManager) {
  const widgetId = widget?.id;
  const first = firstIncoming(widget);
  const codegenOptions = {
    widgetId,
    connections: widget?.connections || [],
    widgetManager,
  };
  if (!first?.from || !widgetManager) {
    return { inputVariable: 'data', connection: first || null, ...codegenOptions };
  }
  const source = widgetManager.getWidget(first.from);
  const inputVariable = resolveUpstreamDataCodeVariable(
    source,
    first.settings || {},
    codegenOptions,
  );
  return { inputVariable, connection: first, sourceWidget: source, ...codegenOptions };
}

function widgetColumns(settings) {
  return settings?.fileColumns || settings?.selectedColumns || [];
}

export function resolveWidgetDataCodeContent(widget, savedContent = '', widgetManager = null) {
  const s = widget?.settings || {};
  const saved = typeof savedContent === 'string' ? savedContent : '';
  const cols = widgetColumns(s);

  if (s.blockType === 'filter') {
    const ctx = buildProcessingCodegenContext(widget, widgetManager);
    if (saved.trim()) return patchFilterDataCodeInCode(saved, s, ctx).code;
    return generateFilterDataCode(s, ctx);
  }

  if (s.blockType === 'transform') {
    const ctx = buildProcessingCodegenContext(widget, widgetManager);
    if (saved.trim()) return patchTransformDataCodeInCode(saved, s, ctx).code;
    return generateTransformDataCode(s, ctx);
  }

  if (s.blockType === 'aggregate') {
    const ctx = buildProcessingCodegenContext(widget, widgetManager);
    if (saved.trim()) return patchAggregateDataCodeInCode(saved, s, ctx).code;
    return generateAggregateDataCode(s, ctx);
  }

  if (s.blockType === 'join') {
    const base = buildProcessingCodegenContext(widget, widgetManager);
    const sources = collectJoinTableSources(widget, widgetManager);
    const ctx = {
      ...base,
      sources,
      inputVariable: sources[0]?.tableVariable || base.inputVariable,
    };
    if (saved.trim()) return patchJoinDataCodeInCode(saved, s, ctx).code;
    return generateJoinDataCode(s, ctx);
  }

  // FormulaWidget (widget.type === 'formula') — dedicated handler
  if (widget?.type === 'formula') {
    const ctx = buildProcessingCodegenContext(widget, widgetManager);
    if (saved.trim()) return patchFormulaDataCodeInCode(saved, s, ctx).code;
    return generateFormulaDataCode(s, ctx);
  }

  if (widget?.type === 'relationship') {
    const sources = collectRelationshipTableSources(widget, widgetManager);
    const ctx = { sources, widgetManager };
    if (saved.trim()) return patchRelationshipDataCodeInCode(saved, s, ctx).code;
    return generateRelationshipDataCode(s, ctx);
  }

  if (widget?.type === 'data-model') {
    if (saved.trim()) return saved;
    return generateLinkedModelDataCode(s);
  }

  if (s.sourceType === 'interactive') {
    const config = s.interactiveConfig || createDefaultInteractiveConfig('table');
    if (saved.trim()) {
      return ensureInteractiveDataInputMerge(saved).code;
    }
    return generateDataCodeFromConfig(config, { mergeDataInputSource: true }).code;
  }

  if (
    (s.sourceType === 'folder' && s.selectedFolder)
    || (s.sourceType === 'archive' && s.selectedArchive)
  ) {
    if (s.folderConfig && isFolderConfigV2(s.folderConfig)) {
      return generateFolderSourceCode(s, s.folderConfig);
    }
    if (saved.trim()) return saved;
    return generateDefaultFolderSourceCode(s);
  }

  if (s.sourceType === 'api') {
    const found = findSourceTableAssignment(saved, s.dataCodeVariableName);
    if (saved.trim()) {
      return patchApiSourceInCode(saved, s, cols, {
        previousVariableName: found?.variableName,
      }).code;
    }
    return generateDefaultApiSourceCode(s, cols);
  }

  if (s.sourceType === 'databridge') {
    const found = findSourceTableAssignment(saved, s.dataCodeVariableName);
    if (saved.trim()) {
      return patchDatabridgeSourceInCode(saved, s, cols, {
        previousVariableName: found?.variableName,
      }).code;
    }
    return generateDefaultDatabridgeSourceCode(s, cols);
  }

  if (s.sourceType === 'database') {
    if (saved.trim()) {
      return patchDatabaseSourceInCode(saved, s, {
        previousVariableName: s.dataCodeVariableName
          || resolveDatabaseDataCodeVariableName(s),
      }).code;
    }
    return generateDefaultDatabaseSourceCode(s);
  }

  if (s.sourceType === 'json') {
    const found = findJsonSourceTableAssignment(saved, s.dataCodeVariableName);
    if (saved.trim()) {
      return patchJsonSourceInCode(saved, s, cols, {
        previousVariableName: found?.variableName,
      }).code;
    }
    return generateDefaultJsonSourceCode(s, cols);
  }

  if (s.sourceType === 'file') {
    const fileName = s.selectedFile?.name || s.sourcePath || '';
    if (!fileName && !saved.trim()) return '';
    if (saved.trim()) {
      const found = findReadAssignment(saved, s.dataCodeVariableName);
      return patchFileSourceInCode(saved, s, cols, {
        previousVariableName: found?.variableName,
      }).code;
    }
    return generateDefaultFileSourceCode(s, cols);
  }

  return saved;
}

export function widgetCodeStoragePayload(tab) {
  return {
    tabs: [{ name: tab?.name || 'Вкладка 1', content: tab?.content || '' }],
    activeTab: 0,
  };
}

export { parseDbWidgetId };
