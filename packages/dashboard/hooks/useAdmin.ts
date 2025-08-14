'use client';

import { useAdminMode } from '@/components/admin/AdminModeProvider';

// Re-export the hook with additional utilities
export function useAdmin() {
  const adminMode = useAdminMode();

  // Additional admin utilities
  const showAdminPanel = () => {
    if (adminMode.isAdminMode) {
      adminMode.setPanelVisible(true);
    }
  };

  const hideAdminPanel = () => {
    adminMode.setPanelVisible(false);
  };

  const togglePanel = () => {
    if (adminMode.isAdminMode) {
      adminMode.setPanelVisible(!adminMode.isPanelVisible);
    }
  };

  // System diagnostics helper
  const getSystemDiagnostics = () => {
    return {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      localStorage: {
        adminMode: localStorage.getItem('adminMode'),
        theme: localStorage.getItem('theme'),
        preferences: localStorage.getItem('preferences'),
      },
      performance: {
        memory: (performance as any).memory ? {
          used: Math.round(((performance as any).memory.usedJSHeapSize / 1024 / 1024) * 100) / 100,
          total: Math.round(((performance as any).memory.totalJSHeapSize / 1024 / 1024) * 100) / 100,
          limit: Math.round(((performance as any).memory.jsHeapSizeLimit / 1024 / 1024) * 100) / 100,
        } : null,
        timing: performance.timing ? {
          pageLoad: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        } : null,
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  };

  return {
    ...adminMode,
    showAdminPanel,
    hideAdminPanel,
    togglePanel,
    getSystemDiagnostics,
  };
}

// Helper hook for admin-only features
export function useAdminOnly() {
  const admin = useAdmin();
  
  if (!admin.isAdminMode) {
    return null;
  }
  
  return admin;
}