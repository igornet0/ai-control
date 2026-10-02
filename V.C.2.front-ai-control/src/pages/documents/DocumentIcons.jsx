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

/** Шаблон документа — лист с текстом */
export function IconTemplateDocument({ className, size }) {
  return (
    <Svg className={className} size={size}>
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

/** Шаблон таблицы — сетка с данными */
export function IconTemplateTable({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18M3 14h18M9 4v16M15 4v16" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

/** Экземпляр документа — стопка листов */
export function IconDocumentStack({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 6h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 11h4M12 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Таблица-сетка */
export function IconGrid({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

/** Конструктор структуры */
export function IconStructure({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="9" y="3" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="16" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="15" y="16" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v3M6 16v-3l6-3M18 16v-3l-6-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Автозаполнение — искры */
export function IconAutofill({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M12 3l.9 2.7L15.6 6l-2.7.9L12 9.6 10.1 6.9 7.4 6l2.7-.9L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5 14l.6 1.8L7.4 16l-1.8.6L5 18.4 4.4 16.6 2.6 16l1.8-.6L5 14z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M19 13l.5 1.5L21 15l-1.5.5L19 17l-.5-1.5L17 15l1.5-.5L19 13z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Параметры — шестерёнка */
export function IconSettings({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 4.5l.8 1.9M14.7 4.5l-.8 1.9M19.5 8.5l-1.9.8M19.5 15.5l-1.9-.8M15.5 19.5l-.8-1.9M8.5 19.5l.8-1.9M4.5 15.5l1.9-.8M4.5 8.5l1.9.8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Вид документа — метка */
export function IconTag({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M20 12l-8 8-9-9V4h7l10 8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" />
    </Svg>
  );
}

/** Пустой список — буфер обмена */
export function IconClipboard({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="5" y="4" width="14" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 4V3a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3v1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Загрузка — спиннер */
export function IconLoading({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Поиск */
export function IconSearch({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconAlignLeft({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M4 6h16M4 10h10M4 14h14M4 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconAlignCenter({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M4 6h16M7 10h10M5 14h14M8 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconAlignRight({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M4 6h16M10 10h10M6 14h14M12 18h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconClose({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconFilterOff({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

export function IconChevronUp({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconChevronDown({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconChevronLeft({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconChevronRight({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Блок текста на листе */
export function IconSheetText({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M6 7h12M6 11h9M6 15h11M6 19h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Поле заполнения */
export function IconSheetField({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Разрыв страницы */
export function IconPageBreak({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M5 4h6v16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6V4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" />
    </Svg>
  );
}

/** Печать / штамп */
export function IconStamp({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.25" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </Svg>
  );
}

/** Изображение на листе */
export function IconSheetImage({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <path d="M6 16l4-3 3 2 5-5 2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Сохранить */
export function IconSave({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </Svg>
  );
}

/** Печать */
export function IconPrint({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="6" y="13" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="9" width="16" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="12" r="0.75" fill="currentColor" />
    </Svg>
  );
}

/** Экспорт PDF */
export function IconPdf({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 13h1.5v3H9a1.5 1.5 0 0 1 0-3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M13 13h2a1.5 1.5 0 1 1 0 3h-2v-3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
    </Svg>
  );
}

/** Экспорт JSON */
export function IconJsonExport({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M8 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 9h2v6H9V9zm4 0h2v4h-2V9z" fill="currentColor" />
      <path d="M10 16h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </Svg>
  );
}

/** Экспорт CSV / таблицы */
export function IconCsvExport({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M12 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 9l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="15" width="16" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 18h3M13 18h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </Svg>
  );
}

/** Импорт данных */
export function IconImport({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M12 21V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 15l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5 5h14a2 2 0 0 1 2 2v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Удалить */
export function IconTrash({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M7 7l1 12a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9l1-12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 11v5M14 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** Создать документ */
export function IconFilePlus({ className, size }) {
  return (
    <Svg className={className} size={size}>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 13v5M9.5 15.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

const DOC_ICONS = {
  templateDocument: IconTemplateDocument,
  templateTable: IconTemplateTable,
  documentStack: IconDocumentStack,
  grid: IconGrid,
  structure: IconStructure,
  autofill: IconAutofill,
  settings: IconSettings,
  tag: IconTag,
  clipboard: IconClipboard,
  loading: IconLoading,
  search: IconSearch,
  alignLeft: IconAlignLeft,
  alignCenter: IconAlignCenter,
  alignRight: IconAlignRight,
  close: IconClose,
  filterOff: IconFilterOff,
  chevronUp: IconChevronUp,
  chevronDown: IconChevronDown,
  chevronLeft: IconChevronLeft,
  chevronRight: IconChevronRight,
  sheetText: IconSheetText,
  sheetField: IconSheetField,
  pageBreak: IconPageBreak,
  stamp: IconStamp,
  sheetImage: IconSheetImage,
  save: IconSave,
  print: IconPrint,
  pdf: IconPdf,
  csvExport: IconCsvExport,
  trash: IconTrash,
  filePlus: IconFilePlus,
};

export function IconWrapText({ className, size = 16 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 3.5h12M2 7.5h9M2 11.5h11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M12.5 6v4M10.5 8h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export const ALIGN_ICONS = {
  left: IconAlignLeft,
  center: IconAlignCenter,
  right: IconAlignRight,
};

/** Иконка по ключу (для навигации, карточек, статистики) */
export function DocIcon({ name, className, size = 20 }) {
  const Icon = DOC_ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} size={size} />;
}
