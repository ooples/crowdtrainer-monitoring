'use client';

import React from 'react';
import { useDashboardConfig } from '@/lib/dashboard-config';

export interface ModeAwareWrapperProps {
  children: React.ReactNode;
  requiredMode?: 'basic' | 'advanced' | 'expert';
  requiredFeature?: 'customization' | 'advancedWidgets' | 'layoutEditor' | 
                    'themeCustomization' | 'savedViews' | 'exportImport' | 
                    'apiConfiguration' | 'webhooks' | 'scripting' | 'collaboration';
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * Wrapper component that conditionally renders children based on dashboard mode and features.
 * Use this to show customization features only when appropriate mode is active.
 */
export const ModeAwareWrapper: React.FC<ModeAwareWrapperProps> = ({
  children,
  requiredMode,
  requiredFeature,
  fallback = null,
  className = '',
}) => {
  const { mode, isFeatureAvailable } = useDashboardConfig();

  // Check mode requirement
  if (requiredMode) {
    const modeOrder = { basic: 0, advanced: 1, expert: 2 };
    const currentModeLevel = modeOrder[mode];
    const requiredModeLevel = modeOrder[requiredMode];
    
    if (currentModeLevel < requiredModeLevel) {
      return <>{fallback}</>;
    }
  }

  // Check feature requirement
  if (requiredFeature && !isFeatureAvailable(requiredFeature)) {
    return <>{fallback}</>;
  }

  return <div className={className}>{children}</div>;
};

export default ModeAwareWrapper;