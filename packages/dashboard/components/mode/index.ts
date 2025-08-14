/**
 * Mode System Components
 * Comprehensive mode toggle system for the monitoring dashboard
 */

export { ModeProvider, useModeContext, withModeProvider, ModeGuard } from './ModeProvider';
export { ModeToggle } from './ModeToggle';
export { 
  ModeKeyboardIntegration, 
  useModeKeyboardHandlers,
  ModeStatusIndicator 
} from './ModeKeyboardIntegration';

// Re-export types and utilities from hooks and lib
export { useMode } from '@/hooks/useMode';
export type { DashboardMode, ModePreferences } from '@/lib/mode-storage';
export type { ModeConfig, ModeChangeEvent, UseModeReturn } from '@/hooks/useMode';

// Constants for easy access
export const DASHBOARD_MODES = ['simple', 'advanced', 'expert'] as const;

// Keyboard shortcuts constants
export const MODE_SHORTCUTS = {
  CYCLE: 'Ctrl+M',
  CYCLE_REVERSE: 'Ctrl+Shift+M', 
  ADMIN_TOGGLE: 'Ctrl+Shift+A',
  SET_SIMPLE: 'Ctrl+Alt+1',
  SET_ADVANCED: 'Ctrl+Alt+2',
  SET_EXPERT: 'Ctrl+Alt+3',
} as const;