// Customization Components Export
export { ThemeSelector } from './ThemeSelector';
export { LayoutManager } from './LayoutManager';
export { SavedViews } from './SavedViews';
export { CustomizationPanel } from './CustomizationPanel';
export { ModeAwareWrapper } from './ModeAwareWrapper';
export { CustomizationExample } from './ExampleUsage';

// Dashboard Configuration
export { 
  dashboardConfig,
  useDashboardConfig,
  DashboardConfigManager,
  MODE_FEATURES,
  DEFAULT_SETTINGS
} from '../../lib/dashboard-config';

export type { 
  DashboardMode,
  DashboardSettings,
  DashboardConfig
} from '../../lib/dashboard-config';

export type {
  ThemeSelectorProps
} from './ThemeSelector';

export type {
  LayoutManagerProps
} from './LayoutManager';

export type {
  SavedViewsProps,
  DashboardView
} from './SavedViews';

export type {
  CustomizationPanelProps
} from './CustomizationPanel';

export type {
  ModeAwareWrapperProps
} from './ModeAwareWrapper';