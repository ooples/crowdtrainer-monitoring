'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { 
  Layout,
  Grid,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  Download,
  Upload,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Settings,
  Plus,
  Move,
  X,
  Check,
  AlertTriangle
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { DashboardBuilder, WidgetConfig, DashboardLayout } from '@/components/builder/DashboardBuilder';

export interface LayoutManagerProps {
  className?: string;
  onLayoutChange?: (layout: DashboardLayout) => void;
  onSave?: (layout: DashboardLayout) => Promise<void>;
  initialLayout?: DashboardLayout;
  readOnly?: boolean;
}

interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  layout: DashboardLayout;
  preview: string; // Base64 image or SVG
  category: 'default' | 'monitoring' | 'analytics' | 'security' | 'custom';
}

// Predefined layout presets
const DEFAULT_PRESETS: LayoutPreset[] = [
  {
    id: 'minimal-monitoring',
    name: 'Minimal Monitoring',
    description: 'Clean layout with essential metrics',
    category: 'monitoring',
    preview: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', // Placeholder
    layout: {
      id: 'minimal-monitoring',
      name: 'Minimal Monitoring',
      description: 'Essential monitoring metrics in a clean layout',
      widgets: [
        {
          id: 'system-status',
          type: 'system-status',
          title: 'System Status',
          position: { x: 50, y: 50 },
          size: { width: 400, height: 200 },
          minSize: { width: 300, height: 150 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: {},
        },
        {
          id: 'active-users',
          type: 'user-list',
          title: 'Active Users',
          position: { x: 470, y: 50 },
          size: { width: 300, height: 200 },
          minSize: { width: 250, height: 150 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: {},
        },
      ],
      grid: { columns: 24, rows: 16, gap: 10 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        tags: ['minimal', 'monitoring'],
      },
    },
  },
  {
    id: 'comprehensive-dashboard',
    name: 'Comprehensive Dashboard',
    description: 'Full-featured monitoring dashboard',
    category: 'monitoring',
    preview: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    layout: {
      id: 'comprehensive-dashboard',
      name: 'Comprehensive Dashboard',
      description: 'Complete monitoring setup with all widgets',
      widgets: [
        {
          id: 'metrics-row-1',
          type: 'metric-card',
          title: 'CPU Usage',
          position: { x: 50, y: 50 },
          size: { width: 250, height: 150 },
          minSize: { width: 200, height: 120 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: { metric: 'cpu' },
        },
        {
          id: 'metrics-row-2',
          type: 'metric-card',
          title: 'Memory Usage',
          position: { x: 320, y: 50 },
          size: { width: 250, height: 150 },
          minSize: { width: 200, height: 120 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: { metric: 'memory' },
        },
        {
          id: 'metrics-row-3',
          type: 'metric-card',
          title: 'Disk Usage',
          position: { x: 590, y: 50 },
          size: { width: 250, height: 150 },
          minSize: { width: 200, height: 120 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: { metric: 'disk' },
        },
        {
          id: 'chart-main',
          type: 'line-chart',
          title: 'Performance Trends',
          position: { x: 50, y: 220 },
          size: { width: 600, height: 300 },
          minSize: { width: 400, height: 200 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: {},
        },
        {
          id: 'alerts-panel',
          type: 'alerts-panel',
          title: 'Active Alerts',
          position: { x: 670, y: 220 },
          size: { width: 350, height: 300 },
          minSize: { width: 300, height: 250 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: {},
        },
      ],
      grid: { columns: 24, rows: 16, gap: 10 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        tags: ['comprehensive', 'monitoring', 'dashboard'],
      },
    },
  },
  {
    id: 'security-focused',
    name: 'Security Dashboard',
    description: 'Security monitoring and threat detection',
    category: 'security',
    preview: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    layout: {
      id: 'security-focused',
      name: 'Security Dashboard',
      description: 'Focused on security metrics and threat detection',
      widgets: [
        {
          id: 'security-overview',
          type: 'security-dashboard',
          title: 'Security Overview',
          position: { x: 50, y: 50 },
          size: { width: 500, height: 300 },
          minSize: { width: 400, height: 250 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: {},
        },
        {
          id: 'threat-alerts',
          type: 'alerts-panel',
          title: 'Security Alerts',
          position: { x: 570, y: 50 },
          size: { width: 350, height: 300 },
          minSize: { width: 300, height: 250 },
          locked: false,
          visible: true,
          zIndex: 1,
          props: { severityFilter: 'error' },
        },
      ],
      grid: { columns: 24, rows: 16, gap: 10 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        tags: ['security', 'threats', 'monitoring'],
      },
    },
  },
];

export const LayoutManager: React.FC<LayoutManagerProps> = ({
  className = '',
  onLayoutChange,
  onSave,
  initialLayout,
  readOnly = false,
}) => {
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout>(
    initialLayout || DEFAULT_PRESETS[0].layout
  );
  const [presets, setPresets] = useState<LayoutPreset[]>(DEFAULT_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayout: DashboardLayout) => {
    setCurrentLayout(newLayout);
    onLayoutChange?.(newLayout);
  }, [onLayoutChange]);

  // Save current layout as preset
  const saveAsPreset = useCallback(() => {
    const name = prompt('Enter a name for this layout preset:');
    if (!name) return;

    const newPreset: LayoutPreset = {
      id: `custom-${Date.now()}`,
      name,
      description: `Custom layout created on ${new Date().toLocaleDateString()}`,
      category: 'custom',
      preview: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', // Could generate actual preview
      layout: { ...currentLayout, id: `custom-${Date.now()}`, name },
    };

    setPresets(prev => [...prev, newPreset]);
  }, [currentLayout]);

  // Load preset
  const loadPreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      handleLayoutChange(preset.layout);
      setSelectedPreset(presetId);
    }
  }, [presets, handleLayoutChange]);

  // Delete custom preset
  const deletePreset = useCallback((presetId: string) => {
    if (confirm('Are you sure you want to delete this preset?')) {
      setPresets(prev => prev.filter(p => p.id !== presetId));
      if (selectedPreset === presetId) {
        setSelectedPreset(null);
      }
    }
  }, [selectedPreset]);

  // Export layout
  const exportLayout = useCallback(() => {
    const dataStr = JSON.stringify(currentLayout, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${currentLayout.name.replace(/\s+/g, '-').toLowerCase()}-layout.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [currentLayout]);

  // Import layout
  const importLayout = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedLayout = JSON.parse(e.target?.result as string) as DashboardLayout;
        
        // Basic validation
        if (!importedLayout.id || !importedLayout.widgets || !Array.isArray(importedLayout.widgets)) {
          throw new Error('Invalid layout format');
        }

        handleLayoutChange(importedLayout);
        setImportError(null);
      } catch (error) {
        setImportError('Failed to import layout: Invalid format');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  }, [handleLayoutChange]);

  // Save layout
  const saveLayout = useCallback(async () => {
    if (!onSave) return;
    
    setSaving(true);
    try {
      await onSave(currentLayout);
    } catch (error) {
      console.error('Failed to save layout:', error);
    } finally {
      setSaving(false);
    }
  }, [currentLayout, onSave]);

  return (
    <div className={`layout-manager ${className}`}>
      <div className="flex h-full">
        {/* Sidebar with presets and controls */}
        <AnimatePresence>
          {showPresets && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-white/10 bg-white/5 backdrop-blur-sm overflow-y-auto"
            >
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                      <Layout className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Layout Manager</h3>
                      <p className="text-xs text-gray-400">Drag & drop widgets</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowPresets(false)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Controls */}
                <div className="space-y-3 mb-6">
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`flex-1 py-2 px-3 text-sm rounded-lg transition-colors ${
                        isEditMode
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isEditMode ? 'Exit Edit' : 'Edit Mode'}
                    </motion.button>
                    
                    {onSave && (
                      <motion.button
                        onClick={saveLayout}
                        disabled={saving}
                        className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                        whileHover={{ scale: saving ? 1 : 1.02 }}
                        whileTap={{ scale: saving ? 1 : 0.98 }}
                      >
                        {saving ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </motion.button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      onClick={exportLayout}
                      className="flex-1 py-2 px-3 bg-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </motion.button>
                    
                    <input
                      type="file"
                      accept=".json"
                      onChange={importLayout}
                      className="hidden"
                      id="layout-import"
                    />
                    <label
                      htmlFor="layout-import"
                      className="flex-1 py-2 px-3 bg-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/20 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Upload className="w-3 h-3" />
                      Import
                    </label>
                  </div>

                  <motion.button
                    onClick={saveAsPreset}
                    className="w-full py-2 px-3 bg-purple-500 text-white rounded-lg text-sm hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Plus className="w-3 h-3" />
                    Save as Preset
                  </motion.button>
                </div>

                {/* Import Error */}
                {importError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-300">{importError}</span>
                    <button 
                      onClick={() => setImportError(null)}
                      className="ml-auto text-red-400 hover:text-red-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                )}

                {/* Layout Presets */}
                <div>
                  <h4 className="font-medium text-white mb-3">Layout Presets</h4>
                  <div className="space-y-2">
                    {presets.map((preset) => (
                      <motion.div
                        key={preset.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all group ${
                          selectedPreset === preset.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        }`}
                        onClick={() => loadPreset(preset.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-white text-sm truncate">
                            {preset.name}
                          </h5>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-1 text-xs rounded ${
                              preset.category === 'custom' 
                                ? 'bg-purple-500/20 text-purple-300' 
                                : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {preset.category}
                            </span>
                            {preset.category === 'custom' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePreset(preset.id);
                                }}
                                className="p-1 hover:bg-red-500/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{preset.description}</p>
                        <div className="text-xs text-gray-500">
                          {preset.layout.widgets.length} widgets
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="flex-1 relative">
          {!showPresets && (
            <motion.button
              onClick={() => setShowPresets(true)}
              className="absolute top-4 left-4 z-10 p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Layout className="w-4 h-4 text-gray-300" />
            </motion.button>
          )}

          <DashboardBuilder
            initialLayout={currentLayout}
            onSave={async (layout) => {
              handleLayoutChange(layout);
              if (onSave) await onSave(layout);
            }}
            readOnly={readOnly || !isEditMode}
            showGrid={isEditMode}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default LayoutManager;