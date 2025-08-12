'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Command,
  Option,
  CornerDownLeft,
  CornerUpLeft,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Space,
  Delete,
  Search,
  Settings,
  HelpCircle,
  Eye,
  EyeOff,
  Play,
  Pause,
  Home,
  Plus,
  Minus,
  RotateCw,
  Save,
  Copy,
  Clipboard,
  Zap,
  Target,
  Filter,
  SortAsc,
  SortDesc,
  Maximize,
  Minimize,
  X,
  Check,
  AlertTriangle,
  Info,
  Star,
  BookOpen,
  Layout,
  Grid,
  List,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { useTheme } from '@/components/theme/ThemeProvider';

// Keyboard Shortcut Types
export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  key: string;
  modifiers: KeyModifier[];
  category: KeyboardCategory;
  action: (event?: KeyboardEvent) => void;
  enabled: boolean;
  global: boolean;
  preventDefault: boolean;
  stopPropagation: boolean;
  condition?: () => boolean;
  context?: string[];
  priority: number;
}

export type KeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta' | 'cmd';

export type KeyboardCategory =
  | 'navigation'
  | 'dashboard'
  | 'data'
  | 'view'
  | 'edit'
  | 'search'
  | 'alerts'
  | 'help'
  | 'accessibility'
  | 'system';

export interface KeyboardManagerConfig {
  enabled: boolean;
  showVisualFeedback: boolean;
  showHelpOnStartup: boolean;
  enableGlobalShortcuts: boolean;
  enableSequenceShortcuts: boolean;
  sequenceTimeout: number;
  visualFeedbackDuration: number;
  enableSounds: boolean;
  customKeybindings: Record<string, string>;
  disabledShortcuts: string[];
}

export interface KeySequence {
  keys: string[];
  timestamp: number;
  timeout: number;
}

export interface KeyboardStats {
  totalKeystrokes: number;
  shortcutsUsed: number;
  mostUsedShortcuts: Record<string, number>;
  averageResponseTime: number;
  sessionStartTime: number;
}

// Default Configuration
const DEFAULT_CONFIG: KeyboardManagerConfig = {
  enabled: true,
  showVisualFeedback: true,
  showHelpOnStartup: false,
  enableGlobalShortcuts: true,
  enableSequenceShortcuts: true,
  sequenceTimeout: 2000,
  visualFeedbackDuration: 1500,
  enableSounds: false,
  customKeybindings: {},
  disabledShortcuts: [],
};

// Create default shortcuts
const createDefaultShortcuts = (handlers: Record<string, () => void>): KeyboardShortcut[] => [
  // Navigation Shortcuts
  {
    id: 'navigate-dashboard',
    name: 'Go to Dashboard',
    description: 'Navigate to the main dashboard',
    key: 'd',
    modifiers: ['ctrl', 'shift'],
    category: 'navigation',
    action: handlers.goToDashboard || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'navigate-alerts',
    name: 'Go to Alerts',
    description: 'Navigate to alerts panel',
    key: 'a',
    modifiers: ['ctrl', 'shift'],
    category: 'navigation',
    action: handlers.goToAlerts || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'navigate-settings',
    name: 'Go to Settings',
    description: 'Open settings panel',
    key: 's',
    modifiers: ['ctrl', 'shift'],
    category: 'navigation',
    action: handlers.goToSettings || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'navigate-home',
    name: 'Go Home',
    description: 'Navigate to home page',
    key: 'h',
    modifiers: ['ctrl'],
    category: 'navigation',
    action: handlers.goHome || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },

  // Dashboard Controls
  {
    id: 'refresh-data',
    name: 'Refresh Data',
    description: 'Refresh dashboard data',
    key: 'r',
    modifiers: ['ctrl'],
    category: 'dashboard',
    action: handlers.refreshData || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
  {
    id: 'toggle-auto-refresh',
    name: 'Toggle Auto Refresh',
    description: 'Enable/disable automatic data refresh',
    key: 'r',
    modifiers: ['ctrl', 'shift'],
    category: 'dashboard',
    action: handlers.toggleAutoRefresh || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
  {
    id: 'toggle-theme',
    name: 'Toggle Theme',
    description: 'Switch between light and dark themes',
    key: 't',
    modifiers: ['ctrl'],
    category: 'dashboard',
    action: handlers.toggleTheme || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
  {
    id: 'toggle-fullscreen',
    name: 'Toggle Fullscreen',
    description: 'Enter or exit fullscreen mode',
    key: 'f11',
    modifiers: [],
    category: 'dashboard',
    action: handlers.toggleFullscreen || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },

  // Search and Filter
  {
    id: 'global-search',
    name: 'Global Search',
    description: 'Open global search dialog',
    key: 'k',
    modifiers: ['ctrl'],
    category: 'search',
    action: handlers.globalSearch || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'search-alerts',
    name: 'Search Alerts',
    description: 'Search within alerts',
    key: 'f',
    modifiers: ['ctrl'],
    category: 'search',
    context: ['alerts'],
    action: handlers.searchAlerts || (() => {}),
    enabled: true,
    global: false,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
  {
    id: 'clear-filters',
    name: 'Clear Filters',
    description: 'Clear all active filters',
    key: 'x',
    modifiers: ['ctrl'],
    category: 'search',
    action: handlers.clearFilters || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },

  // View Controls
  {
    id: 'zoom-in',
    name: 'Zoom In',
    description: 'Increase UI scale',
    key: '=',
    modifiers: ['ctrl'],
    category: 'view',
    action: handlers.zoomIn || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 3,
  },
  {
    id: 'zoom-out',
    name: 'Zoom Out',
    description: 'Decrease UI scale',
    key: '-',
    modifiers: ['ctrl'],
    category: 'view',
    action: handlers.zoomOut || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 3,
  },
  {
    id: 'reset-zoom',
    name: 'Reset Zoom',
    description: 'Reset UI scale to default',
    key: '0',
    modifiers: ['ctrl'],
    category: 'view',
    action: handlers.resetZoom || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 3,
  },
  {
    id: 'toggle-grid',
    name: 'Toggle Grid View',
    description: 'Switch between grid and list views',
    key: 'g',
    modifiers: ['ctrl'],
    category: 'view',
    action: handlers.toggleGrid || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 3,
  },
  {
    id: 'toggle-sidebar',
    name: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    key: 'b',
    modifiers: ['ctrl'],
    category: 'view',
    action: handlers.toggleSidebar || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 3,
  },

  // Alert Management
  {
    id: 'acknowledge-all',
    name: 'Acknowledge All Alerts',
    description: 'Acknowledge all visible alerts',
    key: 'a',
    modifiers: ['ctrl', 'alt'],
    category: 'alerts',
    action: handlers.acknowledgeAll || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'filter-critical',
    name: 'Filter Critical Alerts',
    description: 'Show only critical alerts',
    key: '1',
    modifiers: ['ctrl'],
    category: 'alerts',
    action: handlers.filterCritical || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
  {
    id: 'filter-warning',
    name: 'Filter Warning Alerts',
    description: 'Show only warning alerts',
    key: '2',
    modifiers: ['ctrl'],
    category: 'alerts',
    action: handlers.filterWarning || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
  {
    id: 'filter-info',
    name: 'Filter Info Alerts',
    description: 'Show only info alerts',
    key: '3',
    modifiers: ['ctrl'],
    category: 'alerts',
    action: handlers.filterInfo || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },

  // Accessibility
  {
    id: 'focus-next',
    name: 'Focus Next Element',
    description: 'Move focus to next interactive element',
    key: 'Tab',
    modifiers: [],
    category: 'accessibility',
    action: handlers.focusNext || (() => {}),
    enabled: true,
    global: true,
    preventDefault: false,
    stopPropagation: false,
    priority: 1,
  },
  {
    id: 'focus-previous',
    name: 'Focus Previous Element',
    description: 'Move focus to previous interactive element',
    key: 'Tab',
    modifiers: ['shift'],
    category: 'accessibility',
    action: handlers.focusPrevious || (() => {}),
    enabled: true,
    global: true,
    preventDefault: false,
    stopPropagation: false,
    priority: 1,
  },
  {
    id: 'skip-to-content',
    name: 'Skip to Main Content',
    description: 'Jump to main content area',
    key: 'c',
    modifiers: ['alt'],
    category: 'accessibility',
    action: handlers.skipToContent || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'toggle-high-contrast',
    name: 'Toggle High Contrast',
    description: 'Enable high contrast mode for better visibility',
    key: 'c',
    modifiers: ['ctrl', 'alt'],
    category: 'accessibility',
    action: handlers.toggleHighContrast || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
  {
    id: 'increase-font-size',
    name: 'Increase Font Size',
    description: 'Make text larger for better readability',
    key: '+',
    modifiers: ['ctrl', 'alt'],
    category: 'accessibility',
    action: handlers.increaseFontSize || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 3,
  },
  {
    id: 'decrease-font-size',
    name: 'Decrease Font Size',
    description: 'Make text smaller',
    key: '-',
    modifiers: ['ctrl', 'alt'],
    category: 'accessibility',
    action: handlers.decreaseFontSize || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 3,
  },

  // Help and System
  {
    id: 'show-help',
    name: 'Show Help',
    description: 'Display keyboard shortcuts help',
    key: 'F1',
    modifiers: [],
    category: 'help',
    action: handlers.showHelp || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'show-shortcuts',
    name: 'Show Shortcuts',
    description: 'Display all available keyboard shortcuts',
    key: '?',
    modifiers: ['ctrl'],
    category: 'help',
    action: handlers.showShortcuts || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'escape',
    name: 'Escape/Cancel',
    description: 'Close dialogs or cancel current action',
    key: 'Escape',
    modifiers: [],
    category: 'system',
    action: handlers.escape || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 1,
  },
  {
    id: 'select-all',
    name: 'Select All',
    description: 'Select all items in current context',
    key: 'a',
    modifiers: ['ctrl'],
    category: 'system',
    action: handlers.selectAll || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    condition: () => !document.querySelector('input:focus, textarea:focus'),
    priority: 2,
  },
  {
    id: 'copy-data',
    name: 'Copy Data',
    description: 'Copy current data to clipboard',
    key: 'c',
    modifiers: ['ctrl', 'shift'],
    category: 'system',
    action: handlers.copyData || (() => {}),
    enabled: true,
    global: true,
    preventDefault: true,
    stopPropagation: true,
    priority: 2,
  },
];

// Keyboard Manager Hook
export const useKeyboardManager = () => {
  const [config, setConfig] = useState<KeyboardManagerConfig>(DEFAULT_CONFIG);
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([]);
  const [activeSequence, setActiveSequence] = useState<KeySequence | null>(null);
  const [lastExecuted, setLastExecuted] = useState<string | null>(null);
  const [stats, setStats] = useState<KeyboardStats>({
    totalKeystrokes: 0,
    shortcutsUsed: 0,
    mostUsedShortcuts: {},
    averageResponseTime: 0,
    sessionStartTime: Date.now(),
  });
  
  const sequenceTimeoutRef = useRef<NodeJS.Timeout>();
  const visualFeedbackTimeoutRef = useRef<NodeJS.Timeout>();
  const pressedKeys = useRef<Set<string>>(new Set());
  const currentContext = useRef<string[]>([]);

  // Key event handlers
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!config.enabled) return;
    
    const key = event.key;
    const modifiers: KeyModifier[] = [];
    
    if (event.ctrlKey || event.metaKey) modifiers.push(event.ctrlKey ? 'ctrl' : 'meta');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    
    pressedKeys.current.add(key.toLowerCase());
    
    // Update stats
    setStats(prev => ({ ...prev, totalKeystrokes: prev.totalKeystrokes + 1 }));
    
    // Find matching shortcuts
    const matchingShortcuts = shortcuts.filter(shortcut => {
      if (!shortcut.enabled || config.disabledShortcuts.includes(shortcut.id)) {
        return false;
      }
      
      // Check context if specified
      if (shortcut.context && shortcut.context.length > 0) {
        const hasContext = shortcut.context.some(ctx => 
          currentContext.current.includes(ctx)
        );
        if (!hasContext) return false;
      }
      
      // Check condition if specified
      if (shortcut.condition && !shortcut.condition()) {
        return false;
      }
      
      // Check key and modifiers
      const keyMatches = shortcut.key.toLowerCase() === key.toLowerCase();
      const modifiersMatch = 
        shortcut.modifiers.length === modifiers.length &&
        shortcut.modifiers.every(mod => modifiers.includes(mod));
      
      return keyMatches && modifiersMatch;
    });
    
    // Execute highest priority shortcut
    if (matchingShortcuts.length > 0) {
      const shortcut = matchingShortcuts.sort((a, b) => a.priority - b.priority)[0];
      
      if (shortcut.preventDefault) {
        event.preventDefault();
      }
      if (shortcut.stopPropagation) {
        event.stopPropagation();
      }
      
      const startTime = Date.now();
      
      try {
        shortcut.action(event);
        
        // Update stats
        const responseTime = Date.now() - startTime;
        setStats(prev => ({
          ...prev,
          shortcutsUsed: prev.shortcutsUsed + 1,
          mostUsedShortcuts: {
            ...prev.mostUsedShortcuts,
            [shortcut.id]: (prev.mostUsedShortcuts[shortcut.id] || 0) + 1,
          },
          averageResponseTime: 
            (prev.averageResponseTime * prev.shortcutsUsed + responseTime) / (prev.shortcutsUsed + 1),
        }));
        
        setLastExecuted(shortcut.id);
        
        // Clear visual feedback after duration
        if (visualFeedbackTimeoutRef.current) {
          clearTimeout(visualFeedbackTimeoutRef.current);
        }
        visualFeedbackTimeoutRef.current = setTimeout(() => {
          setLastExecuted(null);
        }, config.visualFeedbackDuration);
        
        // Play sound if enabled
        if (config.enableSounds) {
          playShortcutSound('success');
        }
      } catch (error) {
        console.error('Error executing shortcut:', error);
        if (config.enableSounds) {
          playShortcutSound('error');
        }
      }
    }
  }, [config, shortcuts]);
  
  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    pressedKeys.current.delete(event.key.toLowerCase());
  }, []);
  
  // Sound effects
  const playShortcutSound = (type: 'success' | 'error' | 'sequence') => {
    if (!config.enableSounds) return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const frequencies = {
      success: [800, 1000],
      error: [400, 300],
      sequence: [600, 800, 1000],
    };
    
    const freqs = frequencies[type];
    oscillator.frequency.setValueAtTime(freqs[0], audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
    
    if (freqs.length > 1) {
      freqs.slice(1).forEach((freq, index) => {
        setTimeout(() => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          
          osc.connect(gain);
          gain.connect(audioContext.destination);
          
          osc.frequency.setValueAtTime(freq, audioContext.currentTime);
          gain.gain.setValueAtTime(0, audioContext.currentTime);
          gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
          gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);
          
          osc.start(audioContext.currentTime);
          osc.stop(audioContext.currentTime + 0.15);
        }, (index + 1) * 100);
      });
    }
  };
  
  // Context management
  const setContext = useCallback((contexts: string[]) => {
    currentContext.current = contexts;
  }, []);
  
  const addContext = useCallback((context: string) => {
    if (!currentContext.current.includes(context)) {
      currentContext.current.push(context);
    }
  }, []);
  
  const removeContext = useCallback((context: string) => {
    currentContext.current = currentContext.current.filter(ctx => ctx !== context);
  }, []);
  
  // Setup event listeners
  useEffect(() => {
    if (config.enabled) {
      document.addEventListener('keydown', handleKeyDown, true);
      document.addEventListener('keyup', handleKeyUp, true);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown, true);
        document.removeEventListener('keyup', handleKeyUp, true);
      };
    }
  }, [config.enabled, handleKeyDown, handleKeyUp]);
  
  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (sequenceTimeoutRef.current) {
        clearTimeout(sequenceTimeoutRef.current);
      }
      if (visualFeedbackTimeoutRef.current) {
        clearTimeout(visualFeedbackTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    config,
    setConfig,
    shortcuts,
    setShortcuts,
    stats,
    lastExecuted,
    setContext,
    addContext,
    removeContext,
    playShortcutSound,
  };
};

// Keyboard Manager Component
export interface KeyboardManagerProps {
  onShortcut?: (shortcutId: string, event?: KeyboardEvent) => void;
  handlers?: Record<string, () => void>;
  className?: string;
  showStats?: boolean;
  showVisualFeedback?: boolean;
}

export const KeyboardManager: React.FC<KeyboardManagerProps> = ({
  onShortcut,
  handlers = {},
  className = '',
  showStats = false,
  showVisualFeedback = true,
}) => {
  const { currentTheme } = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  
  const keyboardManager = useKeyboardManager();
  
  // Initialize shortcuts with handlers
  useEffect(() => {
    const defaultHandlers = {
      goToDashboard: handlers.goToDashboard || (() => onShortcut?.('navigate-dashboard')),
      goToAlerts: handlers.goToAlerts || (() => onShortcut?.('navigate-alerts')),
      goToSettings: handlers.goToSettings || (() => onShortcut?.('navigate-settings')),
      goHome: handlers.goHome || (() => onShortcut?.('navigate-home')),
      refreshData: handlers.refreshData || (() => onShortcut?.('refresh-data')),
      toggleAutoRefresh: handlers.toggleAutoRefresh || (() => onShortcut?.('toggle-auto-refresh')),
      toggleTheme: handlers.toggleTheme || (() => onShortcut?.('toggle-theme')),
      toggleFullscreen: handlers.toggleFullscreen || (() => onShortcut?.('toggle-fullscreen')),
      globalSearch: handlers.globalSearch || (() => onShortcut?.('global-search')),
      searchAlerts: handlers.searchAlerts || (() => onShortcut?.('search-alerts')),
      clearFilters: handlers.clearFilters || (() => onShortcut?.('clear-filters')),
      zoomIn: handlers.zoomIn || (() => onShortcut?.('zoom-in')),
      zoomOut: handlers.zoomOut || (() => onShortcut?.('zoom-out')),
      resetZoom: handlers.resetZoom || (() => onShortcut?.('reset-zoom')),
      toggleGrid: handlers.toggleGrid || (() => onShortcut?.('toggle-grid')),
      toggleSidebar: handlers.toggleSidebar || (() => onShortcut?.('toggle-sidebar')),
      acknowledgeAll: handlers.acknowledgeAll || (() => onShortcut?.('acknowledge-all')),
      filterCritical: handlers.filterCritical || (() => onShortcut?.('filter-critical')),
      filterWarning: handlers.filterWarning || (() => onShortcut?.('filter-warning')),
      filterInfo: handlers.filterInfo || (() => onShortcut?.('filter-info')),
      focusNext: handlers.focusNext || (() => onShortcut?.('focus-next')),
      focusPrevious: handlers.focusPrevious || (() => onShortcut?.('focus-previous')),
      skipToContent: handlers.skipToContent || (() => onShortcut?.('skip-to-content')),
      toggleHighContrast: handlers.toggleHighContrast || (() => onShortcut?.('toggle-high-contrast')),
      increaseFontSize: handlers.increaseFontSize || (() => onShortcut?.('increase-font-size')),
      decreaseFontSize: handlers.decreaseFontSize || (() => onShortcut?.('decrease-font-size')),
      showHelp: () => setShowHelp(true),
      showShortcuts: () => setShowHelp(true),
      escape: handlers.escape || (() => {
        setShowHelp(false);
        setEditingShortcut(null);
        onShortcut?.('escape');
      }),
      selectAll: handlers.selectAll || (() => onShortcut?.('select-all')),
      copyData: handlers.copyData || (() => onShortcut?.('copy-data')),
    };
    
    const shortcuts = createDefaultShortcuts(defaultHandlers);
    keyboardManager.setShortcuts(shortcuts);
  }, [handlers, onShortcut]);
  
  // Filter shortcuts
  const filteredShortcuts = keyboardManager.shortcuts.filter(shortcut => {
    const matchesCategory = selectedCategory === 'all' || shortcut.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      shortcut.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });
  
  const categories = Array.from(new Set(keyboardManager.shortcuts.map(s => s.category)));
  
  // Format key combination
  const formatKeyCombo = (shortcut: KeyboardShortcut) => {
    const parts = [...shortcut.modifiers];
    parts.push(shortcut.key);
    
    return parts
      .map(part => {
        switch (part) {
          case 'ctrl': return '⌃';
          case 'alt': return '⌥';
          case 'shift': return '⇧';
          case 'meta': return '⌘';
          case 'cmd': return '⌘';
          case 'Tab': return '⇥';
          case 'Enter': return '↵';
          case 'Escape': return '⎋';
          case 'Backspace': return '⌫';
          case 'Delete': return '⌦';
          case ' ': return 'Space';
          case 'ArrowUp': return '↑';
          case 'ArrowDown': return '↓';
          case 'ArrowLeft': return '←';
          case 'ArrowRight': return '→';
          default: return part;
        }
      })
      .join(' + ');
  };
  
  const getCategoryIcon = (category: KeyboardCategory) => {
    switch (category) {
      case 'navigation': return Home;
      case 'dashboard': return Layout;
      case 'data': return Target;
      case 'view': return Eye;
      case 'edit': return Settings;
      case 'search': return Search;
      case 'alerts': return AlertTriangle;
      case 'help': return HelpCircle;
      case 'accessibility': return BookOpen;
      case 'system': return Command;
      default: return Keyboard;
    }
  };
  
  const getCategoryColor = (category: KeyboardCategory) => {
    switch (category) {
      case 'navigation': return '#3b82f6';
      case 'dashboard': return '#22c55e';
      case 'data': return '#8b5cf6';
      case 'view': return '#06b6d4';
      case 'edit': return '#f59e0b';
      case 'search': return '#ec4899';
      case 'alerts': return '#ef4444';
      case 'help': return '#6b7280';
      case 'accessibility': return '#10b981';
      case 'system': return '#84cc16';
      default: return '#6b7280';
    }
  };

  return (
    <div className={`keyboard-manager ${className}`}>
      {/* Visual Feedback */}
      <AnimatePresence>
        {showVisualFeedback && keyboardManager.lastExecuted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="fixed top-4 right-4 z-50 pointer-events-none"
          >
            <GlassCard className="p-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white font-medium">
                  {keyboardManager.shortcuts.find(s => s.id === keyboardManager.lastExecuted)?.name}
                </span>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Stats Panel */}
      {showStats && (
        <GlassCard className="p-4 mb-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            Keyboard Stats
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{keyboardManager.stats.totalKeystrokes}</div>
              <div className="text-sm text-gray-400">Total Keystrokes</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{keyboardManager.stats.shortcutsUsed}</div>
              <div className="text-sm text-gray-400">Shortcuts Used</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {Math.round(keyboardManager.stats.averageResponseTime)}ms
              </div>
              <div className="text-sm text-gray-400">Avg Response</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {keyboardManager.stats.shortcutsUsed > 0 
                  ? Math.round((keyboardManager.stats.shortcutsUsed / keyboardManager.stats.totalKeystrokes) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-gray-400">Efficiency</div>
            </div>
          </div>
        </GlassCard>
      )}
      
      {/* Help Button */}
      <motion.button
        onClick={() => setShowHelp(!showHelp)}
        className="fixed bottom-6 right-6 z-40 p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Keyboard className="w-6 h-6" />
      </motion.button>
      
      {/* Help Panel */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-6xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                    <Keyboard className="w-6 h-6 text-blue-400" />
                    Keyboard Shortcuts
                  </h2>
                  <button
                    onClick={() => setShowHelp(false)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Search and Filter */}
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search shortcuts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedCategory === 'all'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      All
                    </button>
                    {categories.map(category => {
                      const Icon = getCategoryIcon(category);
                      return (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2 capitalize ${
                            selectedCategory === category
                              ? 'text-white'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                          style={{
                            backgroundColor: selectedCategory === category ? getCategoryColor(category) : undefined
                          }}
                        >
                          <Icon className="w-4 h-4" />
                          {category}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Shortcuts Grid */}
                <div className="grid gap-3">
                  {filteredShortcuts.map((shortcut) => {
                    const Icon = getCategoryIcon(shortcut.category);
                    return (
                      <motion.div
                        key={shortcut.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border transition-all ${
                          shortcut.enabled
                            ? 'border-white/10 bg-white/5 hover:bg-white/10'
                            : 'border-gray-600 bg-gray-800/50 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Icon 
                              className="w-5 h-5" 
                              style={{ color: getCategoryColor(shortcut.category) }}
                            />
                            <div className="flex-1">
                              <h3 className="font-medium text-white">{shortcut.name}</h3>
                              <p className="text-sm text-gray-400">{shortcut.description}</p>
                              {shortcut.context && shortcut.context.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {shortcut.context.map(ctx => (
                                    <span 
                                      key={ctx}
                                      className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full"
                                    >
                                      {ctx}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 capitalize">
                              {shortcut.category}
                            </span>
                            <div className="bg-black/20 border border-white/10 px-3 py-1 rounded-lg font-mono text-sm text-white">
                              {formatKeyCombo(shortcut)}
                            </div>
                            {shortcut.enabled ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <X className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                
                {filteredShortcuts.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">No shortcuts found matching your criteria</p>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KeyboardManager;