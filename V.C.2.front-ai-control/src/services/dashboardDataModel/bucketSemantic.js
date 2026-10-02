import { resolveKpiWindowsForWidget } from '../../pages/dashboard_creater/src/widgets/kpi/kpiDataRange.js';
import { computeKpiSnapshot } from '../../pages/dashboard_creater/src/widgets/kpi/kpiCompute.js';

/**
 * @param {object} params
 */
export async function fetchKpiBucketSnapshot(params) {
  const {
    engine,
    modelId,
    table,
    formula,
    dateField,
    globalFilters,
    customRange,
    periodMode,
    deltaMode,
    deltaCustomRange,
    granularitySetting,
    kpiBucketMode,
    periodShift,
  } = params;
  const rw = await resolveKpiWindowsForWidget({
    engine,
    modelId,
    table,
    dateField,
    globalFilters,
    customRange: customRange || {},
    periodMode: periodMode === 'fallback' ? 'fallback' : 'auto',
    deltaMode: deltaMode || 'previous_period',
    deltaCustomRange: deltaCustomRange || {},
    granularitySetting: granularitySetting || 'auto',
    kpiBucketMode: kpiBucketMode || 'last_completed',
    periodShift: periodShift || 0,
  });
  const snap = await computeKpiSnapshot({
    engine,
    modelId,
    table,
    formula,
    dateField,
    currentRange: rw.currentRange,
    previousRange: rw.previousRange,
    globalFilters,
  });
  return { snapshot: snap, windows: rw };
}

