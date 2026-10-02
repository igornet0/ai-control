import React, { useEffect, useMemo, useState } from 'react';
import { ChartPieIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { dataModelService } from '../../../services/dataModelService';
import styles from './OverviewTablesPanel.module.css';

const HIDDEN_PREFIX = '_datacode';
const HIDDEN = new Set(['_datacode_variables']);

const PIE_COLORS = [
  '#f59e0b',
  '#60a5fa',
  '#34d399',
  '#f472b6',
  '#a78bfa',
  '#fb923c',
  '#22d3ee',
  '#f87171',
  '#c084fc',
  '#4ade80',
];

function isHiddenTable(name) {
  if (!name) return true;
  if (HIDDEN.has(name)) return true;
  return String(name).startsWith(HIDDEN_PREFIX);
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

/**
 * Overview panel: table names + row counts, pie breakdown, open schema viewer.
 */
const OverviewTablesPanel = ({ modelId, onOpenSchema }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tables, setTables] = useState([]);
  const [mode, setMode] = useState('count'); // count | percent

  useEffect(() => {
    if (!modelId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const schema = await dataModelService.getModelSqliteSchema(modelId, null, {
          includeRowCount: true,
        });
        if (cancelled) return;
        const list = (schema.tables || [])
          .filter((t) => !t.skipped && !isHiddenTable(t.name))
          .map((t) => ({
            name: t.name,
            rowCount: t.row_count != null && Number.isFinite(Number(t.row_count))
              ? Number(t.row_count)
              : 0,
          }))
          .sort((a, b) => b.rowCount - a.rowCount || a.name.localeCompare(b.name));
        setTables(list);
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404) {
          setError('Нет скомпилированной базы');
        } else {
          setError(err?.response?.data?.detail || err?.message || 'Не удалось загрузить таблицы');
        }
        setTables([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const totalRows = useMemo(
    () => tables.reduce((s, t) => s + (t.rowCount || 0), 0),
    [tables],
  );

  const slices = useMemo(() => {
    if (!tables.length || totalRows <= 0) {
      return tables.map((t, i) => ({
        ...t,
        pct: 0,
        color: PIE_COLORS[i % PIE_COLORS.length],
        start: 0,
        end: 0,
      }));
    }
    let angle = 0;
    return tables.map((t, i) => {
      const pct = (t.rowCount / totalRows) * 100;
      const span = (t.rowCount / totalRows) * 360;
      const start = angle;
      const end = angle + span;
      angle = end;
      return {
        ...t,
        pct,
        color: PIE_COLORS[i % PIE_COLORS.length],
        start,
        end: Math.min(end, 360),
      };
    });
  }, [tables, totalRows]);

  return (
    <div className={styles.wrap}>
      <div className={styles.summaryCard}>
        <div className={styles.summaryHead}>
          <TableCellsIcon className={styles.summaryIcon} />
          <h3 className={styles.summaryTitle}>Данные</h3>
        </div>
        {loading ? (
          <p className={styles.muted}>Загрузка…</p>
        ) : error ? (
          <>
            <p className={styles.summaryValue}>—</p>
            <p className={styles.muted}>{error}</p>
          </>
        ) : (
          <>
            <p className={styles.summaryValue}>{tables.length}</p>
            <p className={styles.muted}>
              {tables.length === 1 ? 'таблица в модели' : 'таблиц в модели'}
              {totalRows > 0 ? ` · ${totalRows.toLocaleString('ru-RU')} строк` : ''}
            </p>
          </>
        )}
        <button type="button" className={styles.schemaBtn} onClick={onOpenSchema}>
          Открыть схему
        </button>
      </div>

      <div className={styles.breakdownCard}>
        <div className={styles.breakdownHeader}>
          <div className={styles.breakdownTitleRow}>
            <ChartPieIcon className={styles.breakdownIcon} />
            <h3 className={styles.breakdownTitle}>Разрез по таблицам</h3>
          </div>
          <div className={styles.modeToggle} role="group" aria-label="Режим отображения">
            <button
              type="button"
              className={`${styles.modeBtn}${mode === 'count' ? ` ${styles.modeBtnActive}` : ''}`}
              onClick={() => setMode('count')}
            >
              Число
            </button>
            <button
              type="button"
              className={`${styles.modeBtn}${mode === 'percent' ? ` ${styles.modeBtnActive}` : ''}`}
              onClick={() => setMode('percent')}
            >
              %
            </button>
          </div>
        </div>

        {loading && <p className={styles.muted}>Загрузка схемы…</p>}
        {!loading && error && <p className={styles.errorText}>{error}</p>}
        {!loading && !error && tables.length === 0 && (
          <p className={styles.muted}>Таблиц пока нет — скомпилируйте модель</p>
        )}

        {!loading && !error && tables.length > 0 && (
          <div className={styles.breakdownBody}>
            <div className={styles.pieWrap} aria-hidden={totalRows <= 0}>
              {totalRows <= 0 ? (
                <div className={styles.pieEmpty}>Нет строк</div>
              ) : (
                <svg viewBox="0 0 120 120" className={styles.pieSvg}>
                  {slices.map((s) => {
                    if (s.rowCount <= 0) return null;
                    if (s.end - s.start >= 359.99) {
                      return (
                        <circle
                          key={s.name}
                          cx="60"
                          cy="60"
                          r="52"
                          fill={s.color}
                        />
                      );
                    }
                    return (
                      <path
                        key={s.name}
                        d={describeArc(60, 60, 52, s.start, s.end)}
                        fill={s.color}
                      />
                    );
                  })}
                  <circle cx="60" cy="60" r="28" fill="#1a1f27" />
                  <text
                    x="60"
                    y="58"
                    textAnchor="middle"
                    className={styles.pieCenterValue}
                  >
                    {tables.length}
                  </text>
                  <text
                    x="60"
                    y="72"
                    textAnchor="middle"
                    className={styles.pieCenterLabel}
                  >
                    табл.
                  </text>
                </svg>
              )}
            </div>

            <ul className={styles.tableList}>
              {slices.map((t) => (
                <li key={t.name} className={styles.tableRow}>
                  <span className={styles.swatch} style={{ background: t.color }} />
                  <span className={styles.tableName} title={t.name}>
                    {t.name}
                  </span>
                  <span className={styles.tableMeta}>
                    {mode === 'percent'
                      ? `${t.pct.toFixed(1)}%`
                      : t.rowCount.toLocaleString('ru-RU')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewTablesPanel;
