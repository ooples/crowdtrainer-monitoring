import React from 'react';
import { DashboardLayout } from '@/components/builder/DashboardBuilder';
import { configStorage } from '@/lib/config';

// Dashboard mode system
export type DashboardMode = 'basic' | 'advanced' | 'expert';

export interface DashboardSettings {
  mode: DashboardMode;
  autoSave: boolean;
  showGridlines: boolean;
  snapToGrid: boolean;
  enableAnimations: boolean;
  refreshInterval: number;
  maxHistoryStates: number;
  theme: {
    id: string;
    customizations?: Record<string, any>;
  };
  alerts: {
    enabled: boolean;
    soundEnabled: boolean;
    thresholds: Record<string, number>;
  };
  notifications: {
    enabled: boolean;
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    duration: number;
  };
}

export interface DashboardConfig {
  settings: DashboardSettings;
  layouts: Record<string, DashboardLayout>;
  currentLayout?: string;
  customViews: Array<{
    id: string;
    name: string;
    description: string;
    layout: DashboardLayout;
    metadata: {
      createdAt: string;
      updatedAt: string;
      tags: string[];
      starred: boolean;
    };
  }>;
  export?: {
    format: 'json' | 'png' | 'pdf';
    includeData: boolean;
    includeFilters: boolean;
  };
}

// Default dashboard settings
export const DEFAULT_SETTINGS: DashboardSettings = {
  mode: 'basic',
  autoSave: true,
  showGridlines: false,
  snapToGrid: true,
  enableAnimations: true,
  refreshInterval: 30000,
  maxHistoryStates: 50,
  theme: {
    id: 'dark-modern',
  },
  alerts: {
    enabled: true,
    soundEnabled: false,
    thresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      errorRate: 5,
      responseTime: 500,
    },
  },
  notifications: {
    enabled: true,
    position: 'top-right',
    duration: 5000,
  },
};

// Mode feature flags
export const MODE_FEATURES = {
  basic: {
    customization: false,
    advancedWidgets: false,
    layoutEditor: false,
    themeCustomization: false,
    savedViews: false,
    exportImport: false,
    apiConfiguration: false,
    webhooks: false,
    scripting: false,
    collaboration: false,
  },
  advanced: {
    customization: true,
    advancedWidgets: true,
    layoutEditor: true,
    themeCustomization: true,
    savedViews: true,
    exportImport: true,
    apiConfiguration: false,
    webhooks: false,
    scripting: false,
    collaboration: false,
  },
  expert: {
    customization: true,
    advancedWidgets: true,
    layoutEditor: true,
    themeCustomization: true,
    savedViews: true,
    exportImport: true,
    apiConfiguration: true,
    webhooks: true,
    scripting: true,
    collaboration: true,
  },
} as const;

// Dashboard configuration manager
export class DashboardConfigManager {
  private static instance: DashboardConfigManager;
  private config: DashboardConfig;
  private listeners: Set<(config: DashboardConfig) => void> = new Set();

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): DashboardConfigManager {
    if (!DashboardConfigManager.instance) {
      DashboardConfigManager.instance = new DashboardConfigManager();
    }
    return DashboardConfigManager.instance;
  }

  // Load configuration from storage
  private loadConfig(): DashboardConfig {
    const stored = configStorage.load<DashboardConfig>('dashboard-config');
    
    if (stored) {
      // Migrate old configurations if needed
      return this.migrateConfig(stored);
    }

    return {
      settings: { ...DEFAULT_SETTINGS },
      layouts: {},
      customViews: [],
    };
  }

  // Migrate old configuration format
  private migrateConfig(config: any): DashboardConfig {
    // Handle version migrations here
    if (!config.settings) {
      config.settings = { ...DEFAULT_SETTINGS };
    }

    // Merge with defaults to ensure all properties exist
    config.settings = { ...DEFAULT_SETTINGS, ...config.settings };

    return config;
  }

  // Save configuration to storage
  private saveConfig(): void {
    configStorage.save('dashboard-config', this.config);
    this.notifyListeners();
  }

  // Notify all listeners of configuration changes
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.config));
  }

  // Subscribe to configuration changes
  subscribe(listener: (config: DashboardConfig) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get current configuration
  getConfig(): DashboardConfig {
    return { ...this.config };
  }

  // Get current settings
  getSettings(): DashboardSettings {
    return { ...this.config.settings };
  }

  // Update settings
  updateSettings(updates: Partial<DashboardSettings>): void {
    this.config.settings = { ...this.config.settings, ...updates };
    this.saveConfig();
  }

  // Get current mode
  getMode(): DashboardMode {
    return this.config.settings.mode;
  }

  // Set dashboard mode
  setMode(mode: DashboardMode): void {
    this.updateSettings({ mode });
  }

  // Check if feature is available in current mode
  isFeatureAvailable(feature: keyof typeof MODE_FEATURES.basic): boolean {
    const mode = this.getMode();
    return MODE_FEATURES[mode][feature];
  }

  // Get mode features
  getModeFeatures() {
    const mode = this.getMode();
    return MODE_FEATURES[mode];
  }

  // Layout management
  saveLayout(id: string, layout: DashboardLayout): void {
    this.config.layouts[id] = layout;
    this.saveConfig();
  }

  getLayout(id: string): DashboardLayout | undefined {
    return this.config.layouts[id];
  }

  deleteLayout(id: string): void {
    delete this.config.layouts[id];
    if (this.config.currentLayout === id) {
      this.config.currentLayout = undefined;
    }
    this.saveConfig();
  }

  setCurrentLayout(id: string): void {
    if (this.config.layouts[id]) {
      this.config.currentLayout = id;
      this.saveConfig();
    }
  }

  getCurrentLayout(): DashboardLayout | undefined {
    if (this.config.currentLayout) {
      return this.config.layouts[this.config.currentLayout];
    }
    return undefined;
  }

  // Custom views management
  saveView(view: DashboardConfig['customViews'][0]): void {
    const existingIndex = this.config.customViews.findIndex(v => v.id === view.id);
    if (existingIndex >= 0) {
      this.config.customViews[existingIndex] = view;
    } else {
      this.config.customViews.push(view);
    }
    this.saveConfig();
  }

  getView(id: string): DashboardConfig['customViews'][0] | undefined {
    return this.config.customViews.find(v => v.id === id);
  }

  deleteView(id: string): void {
    this.config.customViews = this.config.customViews.filter(v => v.id !== id);
    this.saveConfig();
  }

  getViews(): DashboardConfig['customViews'] {
    return [...this.config.customViews];
  }

  // Theme management
  setTheme(themeId: string, customizations?: Record<string, any>): void {
    this.updateSettings({
      theme: { id: themeId, customizations }
    });
  }

  getTheme(): { id: string; customizations?: Record<string, any> } {
    return this.config.settings.theme;
  }

  // Alert thresholds management
  setAlertThreshold(metric: string, value: number): void {
    this.updateSettings({
      alerts: {
        ...this.config.settings.alerts,
        thresholds: {
          ...this.config.settings.alerts.thresholds,
          [metric]: value,
        },
      },
    });
  }

  getAlertThreshold(metric: string): number | undefined {
    return this.config.settings.alerts.thresholds[metric];
  }

  getAlertThresholds(): Record<string, number> {
    return { ...this.config.settings.alerts.thresholds };
  }

  // Export configuration
  exportConfig(options?: {
    includeLayouts?: boolean;
    includeViews?: boolean;
    includeSettings?: boolean;
  }): string {
    const exportData: any = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
    };

    if (options?.includeSettings !== false) {
      exportData.settings = this.config.settings;
    }

    if (options?.includeLayouts !== false) {
      exportData.layouts = this.config.layouts;
    }

    if (options?.includeViews !== false) {
      exportData.customViews = this.config.customViews;
    }

    return JSON.stringify(exportData, null, 2);
  }

  // Import configuration
  importConfig(configJson: string): {
    success: boolean;
    message: string;
    imported: {
      settings: boolean;
      layouts: number;
      views: number;
    };
  } {
    try {
      const importData = JSON.parse(configJson);
      const result = {
        success: true,
        message: 'Configuration imported successfully',
        imported: {
          settings: false,
          layouts: 0,
          views: 0,
        },
      };

      // Import settings
      if (importData.settings) {
        this.config.settings = { ...DEFAULT_SETTINGS, ...importData.settings };
        result.imported.settings = true;
      }

      // Import layouts
      if (importData.layouts && typeof importData.layouts === 'object') {
        Object.entries(importData.layouts).forEach(([id, layout]: [string, any]) => {
          if (layout && typeof layout === 'object' && layout.id && layout.widgets) {
            this.config.layouts[id] = layout;
            result.imported.layouts++;
          }
        });
      }

      // Import custom views
      if (importData.customViews && Array.isArray(importData.customViews)) {
        importData.customViews.forEach((view: any) => {
          if (view && typeof view === 'object' && view.id && view.name && view.layout) {
            // Generate new ID to avoid conflicts
            const newView = {
              ...view,
              id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              metadata: {
                ...view.metadata,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            };
            this.config.customViews.push(newView);
            result.imported.views++;
          }
        });
      }

      this.saveConfig();
      return result;
    } catch (error) {
      return {
        success: false,
        message: 'Failed to import configuration: Invalid JSON format',
        imported: {
          settings: false,
          layouts: 0,
          views: 0,
        },
      };
    }
  }

  // Reset configuration
  resetConfig(): void {
    this.config = {
      settings: { ...DEFAULT_SETTINGS },
      layouts: {},
      customViews: [],
    };
    this.saveConfig();
  }

  // Reset settings only
  resetSettings(): void {
    this.config.settings = { ...DEFAULT_SETTINGS };
    this.saveConfig();
  }
}

// Singleton instance
export const dashboardConfig = DashboardConfigManager.getInstance();

// React hook for using dashboard configuration
export function useDashboardConfig() {
  const [config, setConfig] = React.useState(dashboardConfig.getConfig());

  React.useEffect(() => {
    const unsubscribe = dashboardConfig.subscribe(setConfig);
    return unsubscribe;
  }, []);

  return {
    config,
    settings: config.settings,
    mode: config.settings.mode,
    
    // Mode utilities
    setMode: (mode: DashboardMode) => dashboardConfig.setMode(mode),
    isFeatureAvailable: (feature: keyof typeof MODE_FEATURES.basic) => 
      dashboardConfig.isFeatureAvailable(feature),
    getModeFeatures: () => dashboardConfig.getModeFeatures(),
    
    // Settings
    updateSettings: (updates: Partial<DashboardSettings>) => 
      dashboardConfig.updateSettings(updates),
    
    // Layouts
    saveLayout: (id: string, layout: DashboardLayout) => 
      dashboardConfig.saveLayout(id, layout),
    getLayout: (id: string) => dashboardConfig.getLayout(id),
    deleteLayout: (id: string) => dashboardConfig.deleteLayout(id),
    setCurrentLayout: (id: string) => dashboardConfig.setCurrentLayout(id),
    getCurrentLayout: () => dashboardConfig.getCurrentLayout(),
    
    // Views
    saveView: (view: DashboardConfig['customViews'][0]) => 
      dashboardConfig.saveView(view),
    getView: (id: string) => dashboardConfig.getView(id),
    deleteView: (id: string) => dashboardConfig.deleteView(id),
    getViews: () => dashboardConfig.getViews(),
    
    // Theme
    setTheme: (themeId: string, customizations?: Record<string, any>) => 
      dashboardConfig.setTheme(themeId, customizations),
    getTheme: () => dashboardConfig.getTheme(),
    
    // Alerts
    setAlertThreshold: (metric: string, value: number) => 
      dashboardConfig.setAlertThreshold(metric, value),
    getAlertThreshold: (metric: string) => dashboardConfig.getAlertThreshold(metric),
    getAlertThresholds: () => dashboardConfig.getAlertThresholds(),
    
    // Import/Export
    exportConfig: (options?: Parameters<typeof dashboardConfig.exportConfig>[0]) => 
      dashboardConfig.exportConfig(options),
    importConfig: (configJson: string) => dashboardConfig.importConfig(configJson),
    
    // Reset
    resetConfig: () => dashboardConfig.resetConfig(),
    resetSettings: () => dashboardConfig.resetSettings(),
  };
}

export default dashboardConfig;