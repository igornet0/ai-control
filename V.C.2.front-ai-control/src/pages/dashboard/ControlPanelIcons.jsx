import React from 'react';

const Svg = ({ className, size = 20, children, ...rest }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    {...rest}
  >
    {children}
  </svg>
);

/** Бренд workspace — канвас панели управления с виджетами аналитики */
export function IconControlPanelWorkspace({ className, size = 18 }) {
  return (
    <Svg className={className} size={size}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="5.5"
        y="5.5"
        width="6"
        height="5.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M7 9.5V8.25M8.75 9.5V7M10.5 9.5V8.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <rect
        x="13.5"
        y="5.5"
        width="5"
        height="5.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M14.25 9.25l1.1-1.35 1.15.55 1.85-2.1"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5.5"
        y="13"
        width="13"
        height="5.5"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M7 16.75h1.75M10 15.5h1.75M13 16.25h1.75M16 14.75h1.75"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="18.25" cy="6.25" r="0.75" fill="currentColor" />
    </Svg>
  );
}

/** Панели — сетка дашбордов */
export function IconPanels({ className, size = 16 }) {
  return (
    <Svg className={className} size={size}>
      <rect x="3" y="4" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="4" width="8" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="10" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 8.5V6.5M7.5 8.5V5.5M9.5 8.5V7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </Svg>
  );
}

/** Потоки — направленный поток панелей */
export function IconFlows({ className, size = 16 }) {
  return (
    <Svg className={className} size={size}>
      <rect x="3" y="5" width="6" height="5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15" y="5" width="6" height="5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="14" width="6" height="5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 7.5H12M12 7.5V11M12 11H12.5M15 7.5H12"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 16.5V11"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Модели данных — стек таблиц с связью */
export function IconDataModels({ className, size = 16 }) {
  return (
    <Svg className={className} size={size}>
      <ellipse cx="9" cy="7" rx="5.5" ry="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 7v5c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 10c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="16" cy="15.5" rx="4" ry="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 15.5v2.5c0 .83 1.79 1.5 4 1.5s4-.67 4-1.5v-2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M14.5 9.5c1.2.8 2.2 2.2 2.5 4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </Svg>
  );
}
