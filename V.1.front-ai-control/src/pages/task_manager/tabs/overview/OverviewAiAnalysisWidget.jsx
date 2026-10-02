import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MarkdownContent from '../../../../components/MarkdownContent';
import { employeeService } from '../../../../services/employeeService';
import { taskManagerAiService } from '../../../../services/taskManagerAiService';
import { OverviewEmpty, OverviewWidget, WidgetIcons } from './OverviewWidget';

const TARGET_OPTIONS = {
  self: { value: 'self', label: 'Мои задачи' },
  employee: { value: 'employee', label: 'Сотрудник' },
  department: { value: 'department', label: 'Отдел' },
  company: { value: 'company', label: 'Компания' },
};

function targetsForTier(tier) {
  if (tier === 'platform_admin' || tier === 'executive') {
    return [TARGET_OPTIONS.self, TARGET_OPTIONS.employee, TARGET_OPTIONS.department, TARGET_OPTIONS.company];
  }
  if (tier === 'management') {
    return [TARGET_OPTIONS.self, TARGET_OPTIONS.employee, TARGET_OPTIONS.department];
  }
  return [TARGET_OPTIONS.self];
}

export function OverviewAiAnalysisWidget({ model, cardId = 'ai-analysis' }) {
  const [tier, setTier] = useState('employee');
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [target, setTarget] = useState('self');
  const [employeeId, setEmployeeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [lastMode, setLastMode] = useState('summary');

  const options = useMemo(() => targetsForTier(tier), [tier]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ctx, depts] = await Promise.all([
          employeeService.getContext(),
          employeeService.getDepartments().catch(() => []),
        ]);
        if (cancelled) return;
        const nextTier = ctx?.tier || 'employee';
        setTier(nextTier);
        const deptList = Array.isArray(depts) ? depts : [];
        setDepartments(deptList);
        if (ctx?.department_id) {
          setDepartmentId(String(ctx.department_id));
        } else if (deptList[0]?.id) {
          setDepartmentId(String(deptList[0].id));
        }
      } catch {
        if (!cancelled) setTier('employee');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (target !== 'employee') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await employeeService.getEmployees({ limit: 200 });
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (!cancelled) setEmployees(list);
      } catch {
        if (!cancelled) setEmployees([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!options.some((o) => o.value === target)) {
      setTarget('self');
    }
  }, [options, target]);

  const runAnalyze = useCallback(
    async (mode, { forceRefresh = false } = {}) => {
      setLoading(true);
      setError('');
      setLastMode(mode);
      try {
        const data = await taskManagerAiService.analyze({
          mode,
          target,
          employeeId: target === 'employee' && employeeId ? Number(employeeId) : null,
          departmentId: target === 'department' && departmentId ? Number(departmentId) : null,
          forceRefresh,
        });
        setReport(data);
      } catch (err) {
        setError(taskManagerAiService.formatError(err, 'Не удалось выполнить анализ'));
      } finally {
        setLoading(false);
      }
    },
    [target, employeeId, departmentId]
  );

  const canRun =
    !loading &&
    !(target === 'employee' && !employeeId) &&
    !(target === 'department' && !departmentId);

  return (
    <OverviewWidget
      cardId={cardId}
      accent="purple"
      icon={WidgetIcons.aiAnalysis}
      title="AI анализ"
      subtitle="Независимый отчёт по задачам"
      className="overview-widget--fill"
    >
      <div className="ow-ai-analysis">
        <div className="ow-ai-analysis__controls">
          <label className="ow-ai-analysis__field">
            <span>Область</span>
            <select
              className="form-input text-sm"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={loading}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {target === 'employee' && (
            <label className="ow-ai-analysis__field">
              <span>Сотрудник</span>
              <select
                className="form-input text-sm"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={loading}
              >
                <option value="">Выберите…</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email || `#${u.id}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {target === 'department' && (
            <label className="ow-ai-analysis__field">
              <span>Отдел</span>
              <select
                className="form-input text-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={loading}
              >
                <option value="">Выберите…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name || `#${d.id}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="ow-ai-analysis__actions">
          <button
            type="button"
            className="ow-ai-btn ow-ai-btn--secondary"
            disabled={!canRun}
            onClick={() => runAnalyze('summary')}
          >
            Краткий анализ
          </button>
          <button
            type="button"
            className="ow-ai-btn ow-ai-btn--primary"
            disabled={!canRun}
            onClick={() => runAnalyze('full')}
          >
            Полный анализ
          </button>
          {report && (
            <button
              type="button"
              className="ow-ai-btn ow-ai-btn--ghost"
              disabled={!canRun}
              title="Пересчитать в модели, игнорируя кэш"
              onClick={() =>
                runAnalyze(lastMode || report?.scope?.mode || 'summary', {
                  forceRefresh: true,
                })
              }
            >
              Обновить
            </button>
          )}
        </div>

        {error && <div className="ow-ai-error">{error}</div>}
        {loading && <OverviewEmpty iconKey="loading" text="Анализируем данные…" />}

        {!loading && report && (
          <div className="ow-ai-analysis__report">
            {report.cache?.hit ? (
              <div className="ow-ai-cache-hint">
                Из кэша — задачи не менялись. Нажмите «Обновить», чтобы пересчитать в ИИ.
              </div>
            ) : (
              <div className="ow-ai-cache-hint ow-ai-cache-hint--fresh">Свежий анализ модели</div>
            )}
            {(report.insights || []).length > 0 && (
              <ul className="ow-ai-insights">
                {report.insights.map((insight, idx) => (
                  <li
                    key={`${insight.title}-${idx}`}
                    className={`ow-ai-insight ow-ai-insight--${insight.level || 'info'}`}
                  >
                    <strong>{insight.title}</strong>
                    {insight.detail ? <span>{insight.detail}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <div className="ow-ai-analysis__summary">
              <MarkdownContent>{report.summary || report.content || ''}</MarkdownContent>
            </div>
          </div>
        )}

        {!loading && !report && !error && (
          <OverviewEmpty iconKey="empty" text="Выберите область и запустите анализ" />
        )}
      </div>
    </OverviewWidget>
  );
}

export default OverviewAiAnalysisWidget;
