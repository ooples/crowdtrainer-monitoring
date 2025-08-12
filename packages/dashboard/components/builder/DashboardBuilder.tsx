'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import {
  Plus,
  Grid,
  Save,
  Undo,
  Redo,
  Download,
  Upload,
  Trash2,
  Copy,
  Settings,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Move,
  RotateCcw,
  Maximize2,
  Minimize2,
  BarChart3,
  LineChart,
  PieChart,
  Gauge,
  Activity,
  Users,
  Server,
  AlertTriangle,
  Clock,
  Zap,
  TrendingUp,
  Database,
  Wifi,
  Shield,
  Target
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { useTheme } from '@/components/theme/ThemeProvider';

// Widget Types
export type WidgetType =
  | 'metric-card'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'gauge'
  | 'activity-feed'
  | 'user-list'
  | 'system-status'
  | 'alerts-panel'
  | 'time-series'
  | 'performance-grid'
  | 'network-topology'
  | 'security-dashboard'
  | 'kpi-scorecard';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize?: { width: number; height: number };
  locked: boolean;
  visible: boolean;
  zIndex: number;
  props: Record<string, any>;
  dataSource?: string;
  refreshInterval?: number;
  themeOverrides?: Record<string, string>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  widgets: WidgetConfig[];
  grid: {
    columns: number;
    rows: number;
    gap: number;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    tags: string[];
  };
}

export interface HistoryState {
  layout: DashboardLayout;
  timestamp: number;
  action: string;
}

// Widget Templates
const WIDGET_TEMPLATES: Record<WidgetType, Omit<WidgetConfig, 'id' | 'position'>> = {
  'metric-card': {
    type: 'metric-card',
    title: 'Metric Card',
    size: { width: 300, height: 200 },
    minSize: { width: 200, height: 150 },
    maxSize: { width: 600, height: 400 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      metric: 'cpu_usage',
      value: 75,
      unit: '%',
      trend: 'up',
      color: 'blue',
      showChart: true,
    },
  },
  'line-chart': {
    type: 'line-chart',
    title: 'Line Chart',
    size: { width: 500, height: 300 },
    minSize: { width: 400, height: 200 },
    maxSize: { width: 1000, height: 600 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      datasets: [],
      timeRange: '24h',
      showLegend: true,
      animateOnLoad: true,
    },
  },
  'bar-chart': {
    type: 'bar-chart',
    title: 'Bar Chart',
    size: { width: 400, height: 300 },
    minSize: { width: 300, height: 200 },
    maxSize: { width: 800, height: 600 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      data: [],
      orientation: 'vertical',
      showValues: true,
      colorScheme: 'blue',
    },
  },
  'pie-chart': {
    type: 'pie-chart',
    title: 'Pie Chart',
    size: { width: 350, height: 350 },
    minSize: { width: 250, height: 250 },
    maxSize: { width: 500, height: 500 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      data: [],
      showLabels: true,
      showLegend: true,
      donutMode: false,
    },
  },
  'gauge': {
    type: 'gauge',
    title: 'Gauge',
    size: { width: 300, height: 250 },
    minSize: { width: 200, height: 200 },
    maxSize: { width: 400, height: 350 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      value: 65,
      min: 0,
      max: 100,
      threshold: 80,
      unit: '%',
      color: 'green',
    },
  },
  'activity-feed': {
    type: 'activity-feed',
    title: 'Activity Feed',
    size: { width: 400, height: 500 },
    minSize: { width: 300, height: 300 },
    maxSize: { width: 600, height: 800 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      maxItems: 50,
      autoRefresh: true,
      showTimestamps: true,
      filterSeverity: 'all',
    },
  },
  'user-list': {
    type: 'user-list',
    title: 'Active Users',
    size: { width: 350, height: 400 },
    minSize: { width: 250, height: 250 },
    maxSize: { width: 500, height: 600 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      showAvatars: true,
      showStatus: true,
      maxUsers: 100,
      sortBy: 'lastActive',
    },
  },
  'system-status': {
    type: 'system-status',
    title: 'System Status',
    size: { width: 450, height: 300 },
    minSize: { width: 350, height: 200 },
    maxSize: { width: 700, height: 500 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      showDetails: true,
      autoRefresh: true,
      alertThreshold: 80,
      services: ['api', 'database', 'cache', 'queue'],
    },
  },
  'alerts-panel': {
    type: 'alerts-panel',
    title: 'Alerts Panel',
    size: { width: 500, height: 350 },
    minSize: { width: 400, height: 250 },
    maxSize: { width: 800, height: 600 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      maxAlerts: 20,
      severityFilter: 'all',
      autoRefresh: true,
      playSound: true,
    },
  },
  'time-series': {
    type: 'time-series',
    title: 'Time Series',
    size: { width: 600, height: 300 },
    minSize: { width: 400, height: 200 },
    maxSize: { width: 1200, height: 600 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      metrics: ['cpu', 'memory', 'disk'],
      timeRange: '1h',
      aggregation: 'avg',
      showArea: false,
    },
  },
  'performance-grid': {
    type: 'performance-grid',
    title: 'Performance Grid',
    size: { width: 700, height: 400 },
    minSize: { width: 500, height: 300 },
    maxSize: { width: 1000, height: 700 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      metrics: ['latency', 'throughput', 'errors', 'availability'],
      layout: 'grid',
      updateInterval: 5000,
    },
  },
  'network-topology': {
    type: 'network-topology',
    title: 'Network Topology',
    size: { width: 800, height: 500 },
    minSize: { width: 600, height: 400 },
    maxSize: { width: 1200, height: 800 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      layout: 'force',
      showLabels: true,
      showMetrics: true,
      autoLayout: true,
    },
  },
  'security-dashboard': {
    type: 'security-dashboard',
    title: 'Security Dashboard',
    size: { width: 600, height: 450 },
    minSize: { width: 450, height: 350 },
    maxSize: { width: 900, height: 700 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      showThreats: true,
      showVulnerabilities: true,
      threatLevel: 'medium',
      alertsEnabled: true,
    },
  },
  'kpi-scorecard': {
    type: 'kpi-scorecard',
    title: 'KPI Scorecard',
    size: { width: 500, height: 350 },
    minSize: { width: 400, height: 250 },
    maxSize: { width: 800, height: 600 },
    locked: false,
    visible: true,
    zIndex: 1,
    props: {
      kpis: [],
      layout: 'cards',
      showTrends: true,
      period: 'monthly',
    },
  },
};

// Widget Icons
const WIDGET_ICONS: Record<WidgetType, React.ComponentType<any>> = {
  'metric-card': BarChart3,
  'line-chart': LineChart,
  'bar-chart': BarChart3,
  'pie-chart': PieChart,
  'gauge': Gauge,
  'activity-feed': Activity,
  'user-list': Users,
  'system-status': Server,
  'alerts-panel': AlertTriangle,
  'time-series': Clock,
  'performance-grid': Zap,
  'network-topology': Wifi,
  'security-dashboard': Shield,
  'kpi-scorecard': Target,
};

// Dashboard Builder Component
export interface DashboardBuilderProps {
  initialLayout?: DashboardLayout;
  onSave?: (layout: DashboardLayout) => Promise<void>;
  onLoad?: (layoutId: string) => Promise<DashboardLayout>;
  className?: string;
  readOnly?: boolean;
  showGrid?: boolean;
}

export const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  initialLayout,
  onSave,
  onLoad,
  className = '',
  readOnly = false,
  showGrid = true,
}) => {
  const { currentTheme } = useTheme();
  const [layout, setLayout] = useState<DashboardLayout>(
    initialLayout || {
      id: `layout-${Date.now()}`,
      name: 'New Dashboard',
      description: 'Custom dashboard layout',
      widgets: [],
      grid: { columns: 24, rows: 16, gap: 10 },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        tags: [],
      },
    }
  );
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [isGridMode, setIsGridMode] = useState(showGrid);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Save to history
  const saveToHistory = useCallback((action: string) => {
    const newState: HistoryState = {
      layout: JSON.parse(JSON.stringify(layout)),
      timestamp: Date.now(),
      action,
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [layout, history, historyIndex]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setLayout(history[historyIndex - 1].layout);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setLayout(history[historyIndex + 1].layout);
    }
  }, [history, historyIndex]);

  // Add widget
  const addWidget = useCallback((type: WidgetType, position?: { x: number; y: number }) => {
    if (readOnly) return;
    
    const template = WIDGET_TEMPLATES[type];
    const newWidget: WidgetConfig = {
      ...template,
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: position || { x: 50, y: 50 },
      zIndex: Math.max(...layout.widgets.map(w => w.zIndex), 0) + 1,
    };
    
    const newLayout = {
      ...layout,
      widgets: [...layout.widgets, newWidget],
      metadata: {
        ...layout.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
    
    setLayout(newLayout);
    setSelectedWidget(newWidget.id);
    saveToHistory(`Add ${template.title}`);
  }, [layout, readOnly, saveToHistory]);

  // Remove widget
  const removeWidget = useCallback((widgetId: string) => {
    if (readOnly) return;
    
    const widget = layout.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    
    const newLayout = {
      ...layout,
      widgets: layout.widgets.filter(w => w.id !== widgetId),
      metadata: {
        ...layout.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
    
    setLayout(newLayout);
    setSelectedWidget(null);
    saveToHistory(`Remove ${widget.title}`);
  }, [layout, readOnly, saveToHistory]);

  // Update widget
  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetConfig>) => {
    if (readOnly) return;
    
    const newLayout = {
      ...layout,
      widgets: layout.widgets.map(w => 
        w.id === widgetId ? { ...w, ...updates } : w
      ),
      metadata: {
        ...layout.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
    
    setLayout(newLayout);
  }, [layout, readOnly]);

  // Duplicate widget
  const duplicateWidget = useCallback((widgetId: string) => {
    if (readOnly) return;
    
    const widget = layout.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    
    const newWidget: WidgetConfig = {
      ...widget,
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      position: { x: widget.position.x + 20, y: widget.position.y + 20 },
      title: `${widget.title} (Copy)`,
      zIndex: Math.max(...layout.widgets.map(w => w.zIndex), 0) + 1,
    };
    
    const newLayout = {
      ...layout,
      widgets: [...layout.widgets, newWidget],
      metadata: {
        ...layout.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
    
    setLayout(newLayout);
    setSelectedWidget(newWidget.id);
    saveToHistory(`Duplicate ${widget.title}`);
  }, [layout, readOnly, saveToHistory]);

  // Handle widget drag
  const handleWidgetDrag = useCallback((widgetId: string, info: PanInfo) => {
    if (readOnly) return;
    
    const widget = layout.widgets.find(w => w.id === widgetId);
    if (!widget || widget.locked) return;
    
    updateWidget(widgetId, {
      position: {
        x: Math.max(0, widget.position.x + info.delta.x),
        y: Math.max(0, widget.position.y + info.delta.y),
      },
    });
  }, [layout, readOnly, updateWidget]);

  // Handle widget resize
  const handleWidgetResize = useCallback((widgetId: string, newSize: { width: number; height: number }) => {
    if (readOnly) return;
    
    const widget = layout.widgets.find(w => w.id === widgetId);
    if (!widget || widget.locked) return;
    
    const constrainedSize = {
      width: Math.max(
        widget.minSize.width,
        Math.min(newSize.width, widget.maxSize?.width || Number.MAX_SAFE_INTEGER)
      ),
      height: Math.max(
        widget.minSize.height,
        Math.min(newSize.height, widget.maxSize?.height || Number.MAX_SAFE_INTEGER)
      ),
    };
    
    updateWidget(widgetId, { size: constrainedSize });
  }, [layout, readOnly, updateWidget]);

  // Save dashboard
  const saveDashboard = useCallback(async () => {
    if (!onSave || readOnly) return;
    
    setSaving(true);
    try {
      await onSave(layout);
      saveToHistory('Save dashboard');
    } catch (error) {
      console.error('Failed to save dashboard:', error);
    } finally {
      setSaving(false);
    }
  }, [layout, onSave, readOnly, saveToHistory]);

  // Export dashboard
  const exportDashboard = useCallback(() => {
    const dataStr = JSON.stringify(layout, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${layout.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [layout]);

  // Import dashboard
  const importDashboard = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedLayout = JSON.parse(e.target?.result as string) as DashboardLayout;
        setLayout(importedLayout);
        saveToHistory('Import dashboard');
      } catch (error) {
        console.error('Failed to import dashboard:', error);
      }
    };
    reader.readAsText(file);
  }, [readOnly, saveToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            saveDashboard();
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'd':
            e.preventDefault();
            if (selectedWidget) {
              duplicateWidget(selectedWidget);
            }
            break;
        }
      } else {
        switch (e.key) {
          case 'Delete':
          case 'Backspace':
            if (selectedWidget) {
              e.preventDefault();
              removeWidget(selectedWidget);
            }
            break;
          case 'Escape':
            setSelectedWidget(null);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly, selectedWidget, saveDashboard, undo, redo, duplicateWidget, removeWidget]);

  return (
    <div className={`dashboard-builder ${className}`}>
      {/* Toolbar */}
      {!readOnly && (
        <DashboardToolbar
          layout={layout}
          onAddWidget={addWidget}
          onSave={saveDashboard}
          onExport={exportDashboard}
          onImport={importDashboard}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          saving={saving}
          isGridMode={isGridMode}
          onToggleGrid={() => setIsGridMode(!isGridMode)}
          previewMode={previewMode}
          onTogglePreview={() => setPreviewMode(!previewMode)}
        />
      )}

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        <motion.div
          ref={canvasRef}
          className={`dashboard-canvas relative w-full h-full overflow-auto ${
            isGridMode ? 'grid-background' : ''
          } ${previewMode ? 'preview-mode' : ''}`}
          style={{
            backgroundImage: isGridMode
              ? `radial-gradient(circle, ${currentTheme.colors.border.primary} 1px, transparent 1px)`
              : undefined,
            backgroundSize: isGridMode ? `${layout.grid.gap}px ${layout.grid.gap}px` : undefined,
          }}
        >
          <AnimatePresence>
            {layout.widgets
              .filter(widget => widget.visible || !previewMode)
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((widget) => (
                <DashboardWidget
                  key={widget.id}
                  widget={widget}
                  selected={selectedWidget === widget.id}
                  onSelect={() => !readOnly && setSelectedWidget(widget.id)}
                  onDrag={(info) => handleWidgetDrag(widget.id, info)}
                  onResize={(size) => handleWidgetResize(widget.id, size)}
                  onUpdate={(updates) => updateWidget(widget.id, updates)}
                  onRemove={() => removeWidget(widget.id)}
                  onDuplicate={() => duplicateWidget(widget.id)}
                  readOnly={readOnly || previewMode}
                  showControls={!previewMode}
                />
              ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Properties Panel */}
      {selectedWidget && !previewMode && !readOnly && (
        <WidgetPropertiesPanel
          widget={layout.widgets.find(w => w.id === selectedWidget)!}
          onUpdate={(updates) => updateWidget(selectedWidget, updates)}
          onClose={() => setSelectedWidget(null)}
        />
      )}
    </div>
  );
};

// Dashboard Toolbar Component
interface DashboardToolbarProps {
  layout: DashboardLayout;
  onAddWidget: (type: WidgetType, position?: { x: number; y: number }) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saving: boolean;
  isGridMode: boolean;
  onToggleGrid: () => void;
  previewMode: boolean;
  onTogglePreview: () => void;
}

const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  layout,
  onAddWidget,
  onSave,
  onExport,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saving,
  isGridMode,
  onToggleGrid,
  previewMode,
  onTogglePreview,
}) => {
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);

  return (
    <GlassCard className="p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">{layout.name}</h2>
            <span className="text-sm text-gray-400">({layout.widgets.length} widgets)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Widget Menu */}
          <div className="relative">
            <motion.button
              onClick={() => setShowWidgetMenu(!showWidgetMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </motion.button>

            <AnimatePresence>
              {showWidgetMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setShowWidgetMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full mt-2 right-0 z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-2xl min-w-[300px]"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(WIDGET_TEMPLATES) as [WidgetType, any][]).map(([type, template]) => {
                        const Icon = WIDGET_ICONS[type];
                        return (
                          <motion.button
                            key={type}
                            onClick={() => {
                              onAddWidget(type);
                              setShowWidgetMenu(false);
                            }}
                            className="flex items-center gap-2 p-3 rounded-lg hover:bg-white/10 transition-colors text-left"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Icon className="w-5 h-5 text-blue-400" />
                            <span className="text-sm text-white">{template.title}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* History Controls */}
          <motion.button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: canUndo ? 1.05 : 1 }}
            whileTap={{ scale: canUndo ? 0.95 : 1 }}
          >
            <Undo className="w-4 h-4 text-white" />
          </motion.button>

          <motion.button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: canRedo ? 1.05 : 1 }}
            whileTap={{ scale: canRedo ? 0.95 : 1 }}
          >
            <Redo className="w-4 h-4 text-white" />
          </motion.button>

          {/* View Controls */}
          <motion.button
            onClick={onToggleGrid}
            className={`p-2 rounded-lg transition-colors ${
              isGridMode ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Grid className="w-4 h-4" />
          </motion.button>

          <motion.button
            onClick={onTogglePreview}
            className={`p-2 rounded-lg transition-colors ${
              previewMode ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </motion.button>

          {/* File Operations */}
          <input
            type="file"
            accept=".json"
            onChange={onImport}
            className="hidden"
            id="import-dashboard"
          />
          <label
            htmlFor="import-dashboard"
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </label>

          <motion.button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download className="w-4 h-4" />
            Export
          </motion.button>

          <motion.button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300 disabled:opacity-50"
            whileHover={{ scale: saving ? 1 : 1.02 }}
            whileTap={{ scale: saving ? 1 : 0.98 }}
          >
            {saving ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RotateCcw className="w-4 h-4" />
              </motion.div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save'}
          </motion.button>
        </div>
      </div>
    </GlassCard>
  );
};

// Dashboard Widget Component
interface DashboardWidgetProps {
  widget: WidgetConfig;
  selected: boolean;
  onSelect: () => void;
  onDrag: (info: PanInfo) => void;
  onResize: (size: { width: number; height: number }) => void;
  onUpdate: (updates: Partial<WidgetConfig>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  readOnly: boolean;
  showControls: boolean;
}

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  widget,
  selected,
  onSelect,
  onDrag,
  onResize,
  onUpdate,
  onRemove,
  onDuplicate,
  readOnly,
  showControls,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const dragControls = useDragControls();
  const Icon = WIDGET_ICONS[widget.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`absolute select-none group ${
        selected ? 'z-50' : ''
      } ${widget.locked ? 'cursor-not-allowed' : 'cursor-move'}`}
      style={{
        left: widget.position.x,
        top: widget.position.y,
        width: widget.size.width,
        height: widget.size.height,
        zIndex: selected ? 1000 : widget.zIndex,
      }}
      drag={!readOnly && !widget.locked && !isResizing}
      dragControls={dragControls}
      onDrag={(_, info) => onDrag(info)}
      dragMomentum={false}
      dragElastic={0}
      whileDrag={{ scale: 1.02, rotate: 1 }}
      onClick={onSelect}
    >
      <GlassCard
        className={`w-full h-full border-2 transition-all duration-200 ${
          selected
            ? 'border-blue-500 shadow-lg shadow-blue-500/25'
            : 'border-white/10 hover:border-white/20'
        } ${widget.locked ? 'opacity-75' : ''}`}
      >
        {/* Widget Header */}
        {showControls && (
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <input
                value={widget.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-sm text-white font-medium outline-none"
                disabled={readOnly || widget.locked}
              />
              {widget.locked && <Lock className="w-3 h-3 text-gray-400" />}
            </div>

            {!readOnly && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ locked: !widget.locked });
                  }}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {widget.locked ? <Lock className="w-3 h-3 text-gray-400" /> : <Unlock className="w-3 h-3 text-gray-400" />}
                </motion.button>
                
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ visible: !widget.visible });
                  }}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {widget.visible ? <Eye className="w-3 h-3 text-gray-400" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                </motion.button>
                
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Copy className="w-3 h-3 text-gray-400" />
                </motion.button>
                
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                  className="p-1 rounded hover:bg-red-500/20 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </motion.button>
              </div>
            )}
          </div>
        )}

        {/* Widget Content */}
        <div className="flex-1 p-4">
          <WidgetContent widget={widget} />
        </div>

        {/* Resize Handle */}
        {!readOnly && !widget.locked && showControls && selected && (
          <motion.div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: 'linear-gradient(-45deg, transparent 30%, currentColor 30%, currentColor 70%, transparent 70%)',
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setIsResizing(true);
              
              const startX = e.clientX;
              const startY = e.clientY;
              const startWidth = widget.size.width;
              const startHeight = widget.size.height;
              
              const handleMouseMove = (e: MouseEvent) => {
                const newWidth = startWidth + (e.clientX - startX);
                const newHeight = startHeight + (e.clientY - startY);
                onResize({ width: newWidth, height: newHeight });
              };
              
              const handleMouseUp = () => {
                setIsResizing(false);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />
        )}
      </GlassCard>
    </motion.div>
  );
};

// Widget Content Component (placeholder)
const WidgetContent: React.FC<{ widget: WidgetConfig }> = ({ widget }) => {
  const Icon = WIDGET_ICONS[widget.type];
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
      <Icon className="w-12 h-12 mb-2" />
      <h3 className="text-lg font-medium text-white mb-1">{widget.type}</h3>
      <p className="text-sm">Widget content will be rendered here</p>
      <div className="mt-4 text-xs space-y-1">
        <div>Size: {widget.size.width} × {widget.size.height}</div>
        <div>Position: {widget.position.x}, {widget.position.y}</div>
      </div>
    </div>
  );
};

// Widget Properties Panel (placeholder)
interface WidgetPropertiesPanelProps {
  widget: WidgetConfig;
  onUpdate: (updates: Partial<WidgetConfig>) => void;
  onClose: () => void;
}

const WidgetPropertiesPanel: React.FC<WidgetPropertiesPanelProps> = ({
  widget,
  onUpdate,
  onClose,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed top-0 right-0 w-80 h-full bg-white/10 backdrop-blur-md border-l border-white/20 z-50 overflow-y-auto"
    >
      <GlassCard className="m-4">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Widget Properties</h3>
            <motion.button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </motion.button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Title</label>
            <input
              value={widget.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Width</label>
              <input
                type="number"
                value={widget.size.width}
                onChange={(e) => onUpdate({ 
                  size: { ...widget.size, width: parseInt(e.target.value) || 0 } 
                })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Height</label>
              <input
                type="number"
                value={widget.size.height}
                onChange={(e) => onUpdate({ 
                  size: { ...widget.size, height: parseInt(e.target.value) || 0 } 
                })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-white mb-2">X Position</label>
              <input
                type="number"
                value={widget.position.x}
                onChange={(e) => onUpdate({ 
                  position: { ...widget.position, x: parseInt(e.target.value) || 0 } 
                })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Y Position</label>
              <input
                type="number"
                value={widget.position.y}
                onChange={(e) => onUpdate({ 
                  position: { ...widget.position, y: parseInt(e.target.value) || 0 } 
                })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widget.locked}
                onChange={(e) => onUpdate({ locked: e.target.checked })}
                className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="text-sm text-white">Locked</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={widget.visible}
                onChange={(e) => onUpdate({ visible: e.target.checked })}
                className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
              />
              <span className="text-sm text-white">Visible</span>
            </label>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default DashboardBuilder;