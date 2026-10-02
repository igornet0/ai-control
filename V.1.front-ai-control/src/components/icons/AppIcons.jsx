import {
  ArrowPathIcon,
  BoltIcon as HeroBoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CircleStackIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  HomeIcon as HeroHomeIcon,
  KeyIcon as HeroKeyIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  RocketLaunchIcon,
  SparklesIcon as HeroSparklesIcon,
  TagIcon as HeroTagIcon,
  UserIcon as HeroUserIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const SIZES = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-7 w-7',
};

function createIcon(Icon) {
  return function AppIcon({ className = '', size = 'sm' }) {
    const sizeClass = SIZES[size] || SIZES.sm;
    return (
      <Icon
        className={`${sizeClass} shrink-0 ${className}`.trim()}
        aria-hidden="true"
      />
    );
  };
}

export const WarningIcon = createIcon(ExclamationTriangleIcon);
export const UserIcon = createIcon(HeroUserIcon);
export const LockIcon = createIcon(LockClosedIcon);
export const EyeOpenIcon = createIcon(EyeIcon);
export const EyeClosedIcon = createIcon(EyeSlashIcon);
export const RocketIcon = createIcon(RocketLaunchIcon);
export const KeyIcon = createIcon(HeroKeyIcon);
export const SparklesIcon = createIcon(HeroSparklesIcon);
export const ChartIcon = createIcon(ChartBarIcon);
export const CheckIcon = createIcon(CheckCircleIcon);
export const EmailIcon = createIcon(EnvelopeIcon);
export const TagIcon = createIcon(HeroTagIcon);
export const HomeIcon = createIcon(HeroHomeIcon);
export const CloseIcon = createIcon(XMarkIcon);
export const RefreshIcon = createIcon(ArrowPathIcon);
export const SearchIcon = createIcon(MagnifyingGlassIcon);
export const DatabaseIcon = createIcon(CircleStackIcon);
export const DocumentIcon = createIcon(DocumentTextIcon);
export const BoltIcon = createIcon(HeroBoltIcon);
export const ErrorCircleIcon = createIcon(XCircleIcon);
export const QuestionIcon = createIcon(QuestionMarkCircleIcon);
