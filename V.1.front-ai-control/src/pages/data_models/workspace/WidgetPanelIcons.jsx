import React from 'react';

const Svg = ({ className, children }) => (
  <svg
    className={className}
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {children}
  </svg>
);

/** Источник данных — документ */
export function IconDataSource({ className }) {
  return (
    <Svg className={className}>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Модель данных — слои / схема */
export function IconDataModel({ className }) {
  return (
    <Svg className={className}>
      <ellipse cx="12" cy="5" rx="7" ry="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 5v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 9v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V9"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 13v4c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </Svg>
  );
}

/** Фильтр — воронка */
export function IconFilter({ className }) {
  return (
    <Svg className={className}>
      <path
        d="M4 5h16l-5.5 7.2V19l-5 2v-8.8L4 5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Трансформация — циклические стрелки */
export function IconTransform({ className }) {
  return (
    <Svg className={className}>
      <path
        d="M5.5 9.5A7 7 0 0 1 12 5h.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M9 5h3.5V8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M18.5 14.5A7 7 0 0 1 12 19h-.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M15 19h-3.5v-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Объединение — два пересекающихся набора */
export function IconJoin({ className }) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

/** Формула — стилизованная ∑ */
export function IconFormula({ className }) {
  return (
    <Svg className={className}>
      <path
        d="M10.5 4.5L6 12l4.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 4.5h7.5M6 19.5h7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Агрегация — столбчатая диаграмма */
export function IconAggregate({ className }) {
  return (
    <Svg className={className}>
      <path d="M4 19V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6" y="12" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="8" width="3" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="16" y="14" width="3" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

/** Связь — два узла и линия */
export function IconRelationship({ className }) {
  return (
    <Svg className={className}>
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 10l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Папка */
export function IconFolder({ className }) {
  return (
    <Svg className={className}>
      <path
        d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2H18.5a2 2 0 0 1 2 2V18.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2v-11z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Архив (zip) */
export function IconArchive({ className }) {
  return (
    <Svg className={className}>
      <path
        d="M6.5 7.5h11v13h-11v-13z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M6.5 7.5l2-3h7l2 3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 9.5v2M12 13v2M12 16.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Файл */
export function IconFile({ className }) {
  return <IconDataSource className={className} />;
}

/** Таблица (CSV/Excel) */
export function IconTable({ className }) {
  return (
    <Svg className={className}>
      <rect x="4.5" y="5.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 9.5h15M9 5.5v13M14.5 5.5v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
