'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type DashboardMode = 'simple' | 'advanced' | 'expert';

interface ModeContextType {
  mode: DashboardMode;
  setMode: (mode: DashboardMode) => void;
  isSimpleMode: boolean;
  isAdvancedMode: boolean;
  isExpertMode: boolean;
  canShowFeature: (requiredMode: DashboardMode) => boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}

interface ModeProviderProps {
  children: ReactNode;
  defaultMode?: DashboardMode;
}

export function ModeProvider({ children, defaultMode = 'simple' }: ModeProviderProps) {
  const [mode, setModeState] = useState<DashboardMode>(defaultMode);

  // Load mode from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('dashboard-mode') as DashboardMode;
    if (savedMode && ['simple', 'advanced', 'expert'].includes(savedMode)) {
      setModeState(savedMode);
    }
  }, []);

  // Save mode to localStorage when it changes
  const setMode = useCallback((newMode: DashboardMode) => {
    setModeState(newMode);
    localStorage.setItem('dashboard-mode', newMode);
  }, []);

  const canShowFeature = useCallback((requiredMode: DashboardMode) => {
    const modeHierarchy = { simple: 1, advanced: 2, expert: 3 };
    return modeHierarchy[mode] >= modeHierarchy[requiredMode];
  }, [mode]);

  const value: ModeContextType = {
    mode,
    setMode,
    isSimpleMode: mode === 'simple',
    isAdvancedMode: mode === 'advanced',
    isExpertMode: mode === 'expert',
    canShowFeature,
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}