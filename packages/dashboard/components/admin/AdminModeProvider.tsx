'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AdminModeContextType {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  isPanelVisible: boolean;
  setPanelVisible: (visible: boolean) => void;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

interface AdminModeProviderProps {
  children: ReactNode;
}

export function AdminModeProvider({ children }: AdminModeProviderProps) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isPanelVisible, setPanelVisible] = useState(false);

  // Load admin mode preference from localStorage
  useEffect(() => {
    const savedAdminMode = localStorage.getItem('adminMode');
    if (savedAdminMode === 'true') {
      setIsAdminMode(true);
    }
  }, []);

  // Save admin mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('adminMode', isAdminMode.toString());
  }, [isAdminMode]);

  // Keyboard shortcut handler (Ctrl+Shift+A)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        event.preventDefault();
        toggleAdminMode();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  const toggleAdminMode = () => {
    setIsAdminMode(prev => {
      const newState = !prev;
      if (!newState) {
        setPanelVisible(false); // Hide panel when disabling admin mode
      }
      return newState;
    });
  };

  const value: AdminModeContextType = {
    isAdminMode,
    toggleAdminMode,
    isPanelVisible,
    setPanelVisible,
  };

  return (
    <AdminModeContext.Provider value={value}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error('useAdminMode must be used within an AdminModeProvider');
  }
  return context;
}