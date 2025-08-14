'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings,
  Palette,
  Layout,
  Bookmark,
  Zap,
  Bell,
  Download,
  Upload,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  AlertTriangle,
  Sparkles,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { ThemeSelector } from './ThemeSelector';
import { LayoutManager } from './LayoutManager';
import { SavedViews } from './SavedViews';
import { useDashboardConfig, DashboardMode } from '@/lib/dashboard-config';
import { DashboardLayout } from '@/components/builder/DashboardBuilder';

export interface CustomizationPanelProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  currentLayout?: DashboardLayout;
  onLayoutChange?: (layout: DashboardLayout) => void;
}

type CustomizationTab = 'general' | 'theme' | 'layout' | 'views' | 'alerts' | 'export';

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({
  className = '',
  isOpen = true,
  onClose,
  currentLayout,
  onLayoutChange,
}) => {
  const {
    config,
    settings,
    mode,
    setMode,
    isFeatureAvailable,
    updateSettings,
    setAlertThreshold,
    getAlertThresholds,
    exportConfig,
    importConfig,
    resetSettings,
  } = useDashboardConfig();

  const [activeTab, setActiveTab] = useState<CustomizationTab>('general');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    display: true,
    behavior: true,
    alerts: false,
    notifications: false,
  });
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const showNotification = useCallback((type: 'success' | 'error' | 'warning', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleModeChange = useCallback((newMode: DashboardMode) => {
    setMode(newMode);
    showNotification('success', `Switched to ${newMode} mode`);
  }, [setMode, showNotification]);

  const handleSettingsUpdate = useCallback((updates: Partial<typeof settings>) => {
    updateSettings(updates);
    showNotification('success', 'Settings updated');
  }, [updateSettings, showNotification]);

  const handleAlertThresholdChange = useCallback((metric: string, value: number) => {
    setAlertThreshold(metric, value);
    showNotification('success', `Alert threshold for ${metric} updated`);
  }, [setAlertThreshold, showNotification]);

  const handleExportConfig = useCallback(() => {
    try {
      const configData = exportConfig();
      const blob = new Blob([configData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-config-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('success', 'Configuration exported successfully');
    } catch (error) {
      showNotification('error', 'Failed to export configuration');
    }
  }, [exportConfig, showNotification]);

  const handleImportConfig = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const configJson = e.target?.result as string;
        const result = importConfig(configJson);
        
        if (result.success) {
          showNotification('success', result.message);
        } else {
          showNotification('error', result.message);
        }
      } catch (error) {
        showNotification('error', 'Failed to import configuration');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [importConfig, showNotification]);

  const handleResetSettings = useCallback(() => {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      resetSettings();
      showNotification('success', 'Settings reset to defaults');
    }
  }, [resetSettings, showNotification]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings, available: true },
    { id: 'theme' as const, label: 'Theme', icon: Palette, available: isFeatureAvailable('themeCustomization') },
    { id: 'layout' as const, label: 'Layout', icon: Layout, available: isFeatureAvailable('layoutEditor') },
    { id: 'views' as const, label: 'Views', icon: Bookmark, available: isFeatureAvailable('savedViews') },
    { id: 'alerts' as const, label: 'Alerts', icon: Bell, available: true },
    { id: 'export' as const, label: 'Export', icon: Download, available: isFeatureAvailable('exportImport') },
  ].filter(tab => tab.available);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 400 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 400 }}
      className={`fixed top-0 right-0 h-full w-96 z-50 ${className}`}
    >
      <GlassCard className="h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Customization</h2>
                <p className="text-sm text-gray-400 capitalize">{mode} mode</p>
              </div>
            </div>
            
            {onClose && (
              <motion.button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5 text-gray-400" />
              </motion.button>
            )}
          </div>

          {/* Mode Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-white mb-2">Dashboard Mode</label>
            <div className="flex gap-1 p-1 bg-white/10 rounded-lg">
              {(['basic', 'advanced', 'expert'] as DashboardMode[]).map((modeOption) => (
                <motion.button
                  key={modeOption}
                  onClick={() => handleModeChange(modeOption)}
                  className={`flex-1 py-2 px-3 text-sm rounded transition-colors capitalize ${
                    mode === modeOption
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {modeOption}
                  {modeOption === 'expert' && <Shield className="w-3 h-3 ml-1 inline" />}
                  {modeOption === 'advanced' && <Sparkles className="w-3 h-3 ml-1 inline" />}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mx-4 mt-4 p-3 rounded-lg border flex items-center gap-2 ${
                notification.type === 'success'
                  ? 'bg-green-500/20 border-green-500/40 text-green-300'
                  : notification.type === 'error'
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
              }`}
            >
              {notification.type === 'success' && <Check className="w-4 h-4" />}
              {notification.type === 'error' && <AlertTriangle className="w-4 h-4" />}
              {notification.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
              <span className="text-sm">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'general' && (
                <GeneralSettings
                  settings={settings}
                  onUpdate={handleSettingsUpdate}
                  expandedSections={expandedSections}
                  onToggleSection={toggleSection}
                />
              )}

              {activeTab === 'theme' && (
                <ThemeSelector showPreview={true} />
              )}

              {activeTab === 'layout' && currentLayout && (
                <LayoutManager
                  initialLayout={currentLayout}
                  onLayoutChange={onLayoutChange}
                  className="h-full"
                />
              )}

              {activeTab === 'views' && (
                <SavedViews
                  currentLayout={currentLayout}
                  onLoadView={(view) => {
                    onLayoutChange?.(view.layout);
                    showNotification('success', `Loaded view: ${view.name}`);
                  }}
                />
              )}

              {activeTab === 'alerts' && (
                <AlertsSettings
                  settings={settings}
                  thresholds={getAlertThresholds()}
                  onUpdateSettings={handleSettingsUpdate}
                  onUpdateThreshold={handleAlertThresholdChange}
                  expandedSections={expandedSections}
                  onToggleSection={toggleSection}
                />
              )}

              {activeTab === 'export' && (
                <ExportSettings
                  onExport={handleExportConfig}
                  onImport={handleImportConfig}
                  onReset={handleResetSettings}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </GlassCard>
    </motion.div>
  );
};

// General Settings Component
const GeneralSettings: React.FC<{
  settings: any;
  onUpdate: (updates: any) => void;
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
}> = ({ settings, onUpdate, expandedSections, onToggleSection }) => (
  <div className="space-y-4">
    {/* Display Settings */}
    <div>
      <motion.button
        onClick={() => onToggleSection('display')}
        className="flex items-center justify-between w-full p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        whileHover={{ scale: 1.01 }}
      >
        <span className="font-medium text-white">Display Settings</span>
        {expandedSections.display ? 
          <ChevronDown className="w-5 h-5 text-gray-400" /> :
          <ChevronRight className="w-5 h-5 text-gray-400" />
        }
      </motion.button>

      <AnimatePresence>
        {expandedSections.display && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <label className="text-sm text-white">Show Gridlines</label>
              <button
                onClick={() => onUpdate({ showGridlines: !settings.showGridlines })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.showGridlines ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full"
                  animate={{ left: settings.showGridlines ? 26 : 2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-white">Snap to Grid</label>
              <button
                onClick={() => onUpdate({ snapToGrid: !settings.snapToGrid })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.snapToGrid ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full"
                  animate={{ left: settings.snapToGrid ? 26 : 2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-white">Enable Animations</label>
              <button
                onClick={() => onUpdate({ enableAnimations: !settings.enableAnimations })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.enableAnimations ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full"
                  animate={{ left: settings.enableAnimations ? 26 : 2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* Behavior Settings */}
    <div>
      <motion.button
        onClick={() => onToggleSection('behavior')}
        className="flex items-center justify-between w-full p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
        whileHover={{ scale: 1.01 }}
      >
        <span className="font-medium text-white">Behavior Settings</span>
        {expandedSections.behavior ? 
          <ChevronDown className="w-5 h-5 text-gray-400" /> :
          <ChevronRight className="w-5 h-5 text-gray-400" />
        }
      </motion.button>

      <AnimatePresence>
        {expandedSections.behavior && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <label className="text-sm text-white">Auto-save Changes</label>
              <button
                onClick={() => onUpdate({ autoSave: !settings.autoSave })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.autoSave ? 'bg-blue-500' : 'bg-white/20'
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full"
                  animate={{ left: settings.autoSave ? 26 : 2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">Refresh Interval (seconds)</label>
              <input
                type="range"
                min="5"
                max="300"
                value={settings.refreshInterval / 1000}
                onChange={(e) => onUpdate({ refreshInterval: parseInt(e.target.value) * 1000 })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5s</span>
                <span>{settings.refreshInterval / 1000}s</span>
                <span>5min</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-white mb-2">History States</label>
              <input
                type="range"
                min="10"
                max="100"
                value={settings.maxHistoryStates}
                onChange={(e) => onUpdate({ maxHistoryStates: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10</span>
                <span>{settings.maxHistoryStates}</span>
                <span>100</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);

// Alerts Settings Component
const AlertsSettings: React.FC<{
  settings: any;
  thresholds: Record<string, number>;
  onUpdateSettings: (updates: any) => void;
  onUpdateThreshold: (metric: string, value: number) => void;
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
}> = ({ settings, thresholds, onUpdateSettings, onUpdateThreshold, expandedSections, onToggleSection }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <label className="text-sm text-white">Enable Alerts</label>
      <button
        onClick={() => onUpdateSettings({ 
          alerts: { ...settings.alerts, enabled: !settings.alerts.enabled } 
        })}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          settings.alerts.enabled ? 'bg-blue-500' : 'bg-white/20'
        }`}
      >
        <motion.div
          className="absolute top-1 w-4 h-4 bg-white rounded-full"
          animate={{ left: settings.alerts.enabled ? 26 : 2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </button>
    </div>

    <div className="flex items-center justify-between">
      <label className="text-sm text-white">Sound Notifications</label>
      <button
        onClick={() => onUpdateSettings({ 
          alerts: { ...settings.alerts, soundEnabled: !settings.alerts.soundEnabled } 
        })}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          settings.alerts.soundEnabled ? 'bg-blue-500' : 'bg-white/20'
        }`}
      >
        <motion.div
          className="absolute top-1 w-4 h-4 bg-white rounded-full"
          animate={{ left: settings.alerts.soundEnabled ? 26 : 2 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </button>
    </div>

    <div>
      <h4 className="font-medium text-white mb-3">Alert Thresholds</h4>
      <div className="space-y-3">
        {Object.entries(thresholds).map(([metric, value]) => (
          <div key={metric}>
            <label className="block text-sm text-white mb-2 capitalize">
              {metric.replace(/([A-Z])/g, ' $1')}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => onUpdateThreshold(metric, parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Export Settings Component
const ExportSettings: React.FC<{
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}> = ({ onExport, onImport, onReset }) => (
  <div className="space-y-4">
    <div>
      <h4 className="font-medium text-white mb-3">Configuration</h4>
      <div className="space-y-3">
        <motion.button
          onClick={onExport}
          className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Download className="w-4 h-4" />
          Export Configuration
        </motion.button>

        <input
          type="file"
          accept=".json"
          onChange={onImport}
          className="hidden"
          id="config-import"
        />
        <label
          htmlFor="config-import"
          className="w-full py-3 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Import Configuration
        </label>

        <motion.button
          onClick={onReset}
          className="w-full py-3 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </motion.button>
      </div>
    </div>
  </div>
);

export default CustomizationPanel;