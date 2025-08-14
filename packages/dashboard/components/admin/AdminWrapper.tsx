'use client';

import React from 'react';
import { AdminModeProvider } from './AdminModeProvider';
import { AdminToggle } from './AdminToggle';
import { AdminPanel } from './AdminPanel';

interface AdminWrapperProps {
  children: React.ReactNode;
  apiUrl: string;
  apiKey?: string;
}

/**
 * AdminWrapper provides admin functionality with keyboard shortcuts and floating controls
 * 
 * Features:
 * - Hidden by default
 * - Keyboard shortcut (Ctrl+Shift+A) to toggle admin mode
 * - Floating toggle button in bottom-right corner
 * - Admin panel slides in from bottom when activated
 * - Test data generators
 * - System diagnostics
 * - Data management tools
 * - Remembers admin mode preference in localStorage
 */
export function AdminWrapper({ children, apiUrl, apiKey }: AdminWrapperProps) {
  return (
    <AdminModeProvider>
      {children}
      <AdminToggle />
      <AdminPanel apiUrl={apiUrl} apiKey={apiKey} />
    </AdminModeProvider>
  );
}

export default AdminWrapper;