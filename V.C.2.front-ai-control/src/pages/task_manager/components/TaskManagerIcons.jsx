import {
  AcademicCapIcon,
  ArchiveBoxIcon,
  ArrowDownIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  ArrowUpIcon,
  BeakerIcon,
  BellAlertIcon,
  BoltIcon,
  BookOpenIcon,
  BugAntIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftEllipsisIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  EyeIcon,
  FireIcon,
  FolderIcon,
  HandRaisedIcon,
  LightBulbIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PaintBrushIcon,
  PauseCircleIcon,
  PencilIcon,
  PencilSquareIcon,
  PlayIcon,
  PlusIcon,
  PresentationChartLineIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon as HeroStarOutlineIcon,
  TableCellsIcon,
  TrashIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  WrenchScrewdriverIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon, StarIcon as HeroStarSolidIcon } from '@heroicons/react/24/solid';

const SIZES = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-7 w-7',
  '2xl': 'h-8 w-8',
  '3xl': 'h-12 w-12',
  '4xl': 'h-16 w-16',
};

function createIcon(Icon) {
  return function TaskIcon({ className = '', size = 'sm' }) {
    const sizeClass = SIZES[size] || SIZES.sm;
    return (
      <Icon
        className={`${sizeClass} shrink-0 ${className}`.trim()}
        aria-hidden="true"
      />
    );
  };
}

export const FilesIcon = createIcon(FolderIcon);
export const OverviewIcon = createIcon(PresentationChartLineIcon);
export const StatisticsIcon = createIcon(ArrowTrendingUpIcon);
export const TeamsIcon = createIcon(UserGroupIcon);
export const UserSingleIcon = createIcon(UserIcon);
export const MyTasksIcon = createIcon(UserCircleIcon);
export const SearchIcon = createIcon(MagnifyingGlassIcon);
export const CreateIcon = createIcon(SparklesIcon);
export const TasksIcon = createIcon(ClipboardDocumentListIcon);
export const TableViewIcon = createIcon(TableCellsIcon);
export const KanbanIcon = createIcon(RectangleStackIcon);
export const CalendarViewIcon = createIcon(CalendarDaysIcon);
export const RefreshIcon = createIcon(ArrowPathIcon);
export const WarningIcon = createIcon(ExclamationTriangleIcon);
export const CleanIcon = createIcon(TrashIcon);
export const ChartIcon = createIcon(ChartBarIcon);
export const ProjectsIcon = createIcon(RocketLaunchIcon);
export const ReportIcon = createIcon(BellAlertIcon);
export const QuestionIcon = createIcon(QuestionMarkCircleIcon);
export const CheckIcon = createIcon(CheckCircleIcon);
export const ErrorIcon = createIcon(XCircleIcon);
export const CommentsIcon = createIcon(ChatBubbleLeftRightIcon);
export const EmptyCommentsIcon = createIcon(ChatBubbleLeftEllipsisIcon);
export const TimerIcon = createIcon(ClockIcon);
export const LightbulbIcon = createIcon(LightBulbIcon);
export const PlusIconSm = createIcon(PlusIcon);
export const EditIcon = createIcon(PencilIcon);
export const CloseIcon = createIcon(XMarkIcon);
export const PlayIconSm = createIcon(PlayIcon);
export const UploadingIcon = createIcon(ClockIcon);
export const StarFilledIcon = createIcon(HeroStarSolidIcon);
export const StarOutlineIcon = createIcon(HeroStarOutlineIcon);
export const IntegrationIcon = createIcon(LinkIcon);
export const HandshakeIcon = createIcon(HandRaisedIcon);

export const TEMPLATE_ICONS = {
  bug: createIcon(BugAntIcon),
  feature: createIcon(SparklesIcon),
  review: createIcon(ClipboardDocumentListIcon),
  testing: createIcon(BeakerIcon),
  documentation: createIcon(BookOpenIcon),
  release: createIcon(RocketLaunchIcon),
  refactoring: createIcon(WrenchScrewdriverIcon),
  security: createIcon(ShieldCheckIcon),
  analytics: createIcon(ChartBarIcon),
  design: createIcon(PaintBrushIcon),
  performance: createIcon(BoltIcon),
  integration: createIcon(LinkIcon),
  infrastructure: createIcon(BuildingOffice2Icon),
  mobile: createIcon(DevicePhoneMobileIcon),
  automation: createIcon(ArrowPathIcon),
  learning: createIcon(AcademicCapIcon),
};

const STATUS_ICONS = {
  created: PencilSquareIcon,
  in_progress: Cog6ToothIcon,
  review: EyeIcon,
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
  on_hold: PauseCircleIcon,
  blocked: NoSymbolIcon,
};

const PRIORITY_ICONS = {
  urgent: FireIcon,
  critical: ExclamationTriangleIcon,
  high: ArrowUpIcon,
  medium: ArrowRightIcon,
  low: ArrowDownIcon,
};

export function TaskStatusIcon({ status, className = '', size = 'sm' }) {
  const Icon = STATUS_ICONS[status] || PencilSquareIcon;
  const sizeClass = SIZES[size] || SIZES.sm;
  return <Icon className={`${sizeClass} shrink-0 ${className}`.trim()} aria-hidden="true" />;
}

export function TaskPriorityIcon({ priority, className = '', size = 'sm' }) {
  const Icon = PRIORITY_ICONS[priority] || ArrowDownIcon;
  const sizeClass = SIZES[size] || SIZES.sm;
  return <Icon className={`${sizeClass} shrink-0 ${className}`.trim()} aria-hidden="true" />;
}

const PROJECT_STATUS_ICONS = {
  planning: ClipboardDocumentListIcon,
  active: PlayIcon,
  on_hold: PauseCircleIcon,
  completed: CheckCircleIcon,
  cancelled: XCircleIcon,
  archived: ArchiveBoxIcon,
};

const PROJECT_STATUS_COLORS = {
  planning: 'text-slate-400',
  active: 'text-blue-400',
  on_hold: 'text-orange-400',
  completed: 'text-green-400',
  cancelled: 'text-red-400',
  archived: 'text-slate-500',
};

export function ProjectStatusIcon({ status, className = '', size = 'sm' }) {
  const Icon = PROJECT_STATUS_ICONS[status] || ClipboardDocumentListIcon;
  const sizeClass = SIZES[size] || SIZES.sm;
  const color = PROJECT_STATUS_COLORS[status] || 'text-slate-400';
  return <Icon className={`${sizeClass} shrink-0 ${color} ${className}`.trim()} aria-hidden="true" />;
}

export function TaskTemplateIcon({ icon, className = '', size = 'md' }) {
  const IconComponent = TEMPLATE_ICONS[icon];
  if (!IconComponent) return null;
  return <IconComponent className={className} size={size} />;
}

export function IconWithText({
  icon: Icon,
  children,
  className = '',
  iconClassName = '',
  iconSize = 'sm',
  gap = 'gap-1.5',
}) {
  return (
    <span className={`inline-flex items-center ${gap} ${className}`.trim()}>
      <Icon className={iconClassName} size={iconSize} />
      {children}
    </span>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
}) {
  return (
    <div className={`relative ${className}`.trim()}>
      <SearchIcon
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        size="sm"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputClassName}`.trim()}
      />
    </div>
  );
}
