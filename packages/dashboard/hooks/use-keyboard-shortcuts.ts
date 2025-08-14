'use client';

import { useEffect, useCallback } from 'react';
import { useMode, DashboardMode } from '../components/providers/mode-provider';
import { useAdminMode } from '../components/providers/admin-mode-provider';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  mode?: DashboardMode;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const { mode } = useMode();

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target as HTMLElement)?.contentEditable === 'true'
    ) {
      return;
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      // Check if shortcut is available in current mode
      if (shortcut.mode && shortcut.mode !== mode) {
        return false;
      }

      return (
        event.key.toLowerCase() === shortcut.key.toLowerCase() &&
        !!event.ctrlKey === !!shortcut.ctrlKey &&
        !!event.shiftKey === !!shortcut.shiftKey &&
        !!event.altKey === !!shortcut.altKey &&
        !!event.metaKey === !!shortcut.metaKey
      );
    });

    if (matchingShortcut) {
      event.preventDefault();
      matchingShortcut.action();
    }
  }, [shortcuts, mode]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
}

// Common dashboard shortcuts
export function useDashboardShortcuts() {
  const { mode, setMode } = useMode();
  const { toggleAdminMode } = useAdminMode();

  const shortcuts: KeyboardShortcut[] = [
    // Mode switching
    {
      key: '1',
      ctrlKey: true,
      description: 'Switch to Simple mode',
      action: () => setMode('simple')
    },
    {
      key: '2',
      ctrlKey: true,
      description: 'Switch to Advanced mode',
      action: () => setMode('advanced')
    },
    {
      key: '3',
      ctrlKey: true,
      description: 'Switch to Expert mode',
      action: () => setMode('expert')
    },

    // Admin mode
    {
      key: 'a',
      ctrlKey: true,
      shiftKey: true,
      description: 'Toggle Admin mode',
      action: toggleAdminMode
    },

    // Refresh actions
    {
      key: 'r',
      ctrlKey: true,
      description: 'Refresh data',
      action: () => window.location.reload()
    },

    // Navigation
    {
      key: 'f',
      ctrlKey: true,
      description: 'Focus search',
      action: () => {
        const searchInput = document.querySelector('input[type="text"], input[placeholder*="search" i]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    },

    // Export (Expert mode only)
    {
      key: 'e',
      ctrlKey: true,
      shiftKey: true,
      mode: 'expert',
      description: 'Export data',
      action: () => {
        const exportButton = document.querySelector('[data-action="export"]') as HTMLButtonElement;
        if (exportButton) {
          exportButton.click();
        }
      }
    },

    // Navigation shortcuts
    {
      key: 'm',
      ctrlKey: true,
      description: 'Focus metrics section',
      action: () => {
        const metricsSection = document.querySelector('#metrics-section');
        if (metricsSection) {
          (metricsSection as HTMLElement).focus();
          metricsSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    
    {
      key: 'i',
      ctrlKey: true,
      description: 'Focus activity section',
      action: () => {
        const activitySection = document.querySelector('#activity-section');
        if (activitySection) {
          (activitySection as HTMLElement).focus();
          activitySection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    },
    
    // Chart navigation
    {
      key: 'ArrowRight',
      description: 'Next chart data point',
      action: () => {
        const focusedChart = document.activeElement?.closest('[role="img"]');
        if (focusedChart) {
          const event = new CustomEvent('chart-next-point');
          focusedChart.dispatchEvent(event);
        }
      }
    },
    
    {
      key: 'ArrowLeft',
      description: 'Previous chart data point',
      action: () => {
        const focusedChart = document.activeElement?.closest('[role="img"]');
        if (focusedChart) {
          const event = new CustomEvent('chart-prev-point');
          focusedChart.dispatchEvent(event);
        }
      }
    },

    // Help
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      action: () => {
        // This will be handled by the ShortcutHelper component
        const event = new CustomEvent('show-shortcuts');
        document.dispatchEvent(event);
      }
    }
  ];

  useKeyboardShortcuts(shortcuts);

  return shortcuts;
}