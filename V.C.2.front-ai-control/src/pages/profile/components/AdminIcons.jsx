import React from 'react';
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  BeakerIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CircleStackIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  UsersIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

function PlugIcon(props) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18v3M8.25 7.5V4.875a3.375 3.375 0 016.75 0V7.5m-9 0h10.5A2.25 2.25 0 0121 9.75v1.5a6.75 6.75 0 01-13.5 0v-1.5A2.25 2.25 0 018.25 7.5z"
      />
    </svg>
  );
}

const ICON_MAP = {
  chartBar: ChartBarIcon,
  users: UsersIcon,
  dashboards: ChartBarIcon,
  dataModels: RectangleStackIcon,
  tasks: CheckCircleIcon,
  folder: FolderIcon,
  database: CircleStackIcon,
  file: DocumentTextIcon,
  plug: PlugIcon,
  test: BeakerIcon,
  edit: PencilIcon,
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
  unknown: QuestionMarkCircleIcon,
  externalLink: ArrowTopRightOnSquareIcon,
  export: ArrowDownTrayIcon,
  lock: LockClosedIcon,
  lockOpen: LockOpenIcon,
  plus: PlusIcon,
  close: XMarkIcon,
};

const SIZES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

const BOX_COLORS = {
  indigo: 'bg-indigo-500/15 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.15)]',
  violet: 'bg-violet-500/15 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.15)]',
  emerald: 'bg-emerald-500/15 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  amber: 'bg-amber-500/15 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  sky: 'bg-sky-500/15 text-sky-300 shadow-[0_0_20px_rgba(14,165,233,0.15)]',
  rose: 'bg-rose-500/15 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
  green: 'bg-green-500/15 text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.15)]',
  blue: 'bg-blue-500/15 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.15)]',
};

export function AdminIcon({ name, size = 'md', className = '', boxed = false, boxColor = 'indigo' }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;

  const iconEl = <Icon className={`${SIZES[size]} shrink-0 ${className}`} aria-hidden />;

  if (boxed) {
    return (
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${BOX_COLORS[boxColor] || BOX_COLORS.indigo}`}>
        {iconEl}
      </span>
    );
  }

  return iconEl;
}

export function AdminIconLabel({ name, label, size = 'sm', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <AdminIcon name={name} size={size} />
      <span>{label}</span>
    </span>
  );
}

export const CONNECTION_TYPE_ICONS = {
  smb: 'folder',
  database: 'database',
  api: 'plug',
};
