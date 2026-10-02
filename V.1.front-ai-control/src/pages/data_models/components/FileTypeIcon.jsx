import React, { useMemo } from 'react';

const Svg = ({ className, children, size = 24 }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    {children}
  </svg>
);

const IconGenericFile = ({ className, size }) => (
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

const IconTable = ({ className, size }) => (
  <Svg className={className} size={size}>
    <rect x="4.5" y="5.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M4.5 9.5h15M9 5.5v13M14.5 5.5v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const IconPdf = ({ className, size }) => (
  <Svg className={className} size={size}>
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const IconText = ({ className, size }) => (
  <Svg className={className} size={size}>
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8 12h8M8 15h7M8 18h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const IconImage = ({ className, size }) => (
  <Svg className={className} size={size}>
    <rect x="4.5" y="6" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 14l2.5-2.5L14 15l2-2 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 10h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </Svg>
);

export default function FileTypeIcon({ filename, className = '', size = 24 }) {
  const ext = useMemo(() => {
    if (!filename || typeof filename !== 'string') return '';
    const parts = filename.split('.');
    return (parts[parts.length - 1] || '').toLowerCase();
  }, [filename]);

  const Comp =
    ext === 'csv' || ext === 'xlsx' || ext === 'xls'
      ? IconTable
      : ext === 'pdf'
        ? IconPdf
        : ext === 'txt' || ext === 'json'
          ? IconText
          : ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)
            ? IconImage
            : IconGenericFile;

  return <Comp className={className} size={size} />;
}

export function ImagePlaceholderIcon({ className = '', size = 28 }) {
  return <IconImage className={className} size={size} />;
}

