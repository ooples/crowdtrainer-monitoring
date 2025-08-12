// Advanced Visualization Components for Monitoring Dashboard
// Created for comprehensive data visualization and analysis

export { default as ThreeDMetrics } from './ThreeDMetrics';
export { default as DependencyGraph } from './DependencyGraph';
export { default as HeatMap } from './HeatMap';
export { default as CorrelationMatrix } from './CorrelationMatrix';
export { default as SankeyFlow } from './SankeyFlow';
export { default as NetworkTopology } from './NetworkTopology';

// Type exports for better TypeScript support
export type {
  // ThreeDMetrics types
  MetricDataPoint as ThreeDMetricDataPoint,
  ThreeDMetricsProps
} from './ThreeDMetrics';

export type {
  // DependencyGraph types
  ServiceNode,
  ServiceLink,
  DependencyGraphProps
} from './DependencyGraph';

export type {
  // HeatMap types
  HeatMapDataPoint,
  HeatMapProps
} from './HeatMap';

export type {
  // CorrelationMatrix types
  MetricData as CorrelationMetricData,
  CorrelationResult,
  CorrelationMatrixProps
} from './CorrelationMatrix';

export type {
  // SankeyFlow types
  FlowNode,
  FlowLink,
  SankeyData,
  SankeyFlowProps
} from './SankeyFlow';

export type {
  // NetworkTopology types
  NetworkNode,
  NetworkLink,
  NetworkTopologyProps
} from './NetworkTopology';

// Utility functions for data processing and visualization
export const visualizationUtils = {
  // Color palette for consistent theming
  colors: {
    primary: '#3b82f6',
    secondary: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#8b5cf6',
    gray: '#6b7280',
    success: '#10b981',
    background: '#1f2937'
  },

  // Format numbers for display
  formatters: {
    number: (value: number, decimals = 2) => value.toFixed(decimals),
    percentage: (value: number) => `${(value * 100).toFixed(1)}%`,
    bytes: (bytes: number) => {
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 B';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    },
    duration: (ms: number) => {
      if (ms < 1000) return `${ms}ms`;
      if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
      if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
      return `${(ms / 3600000).toFixed(1)}h`;
    }
  },

  // Generate sample data for testing
  generators: {
    metricData: (count: number = 10) => Array.from({ length: count }, (_, i) => ({
      id: `metric-${i}`,
      name: `Metric ${i}`,
      value: Math.random() * 100,
      timestamp: Date.now() + i * 1000,
      category: ['performance', 'error', 'usage', 'latency'][i % 4] as any
    })),

    heatMapData: (xCount: number = 10, yCount: number = 10) => 
      Array.from({ length: xCount * yCount }, (_, i) => ({
        x: `X${i % xCount}`,
        y: `Y${Math.floor(i / xCount)}`,
        value: Math.random() * 100,
        timestamp: Date.now() + i * 1000
      })),

    networkData: (nodeCount: number = 10) => {
      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `node-${i}`,
        name: `Node ${i}`,
        type: ['server', 'database', 'load_balancer', 'cdn'][i % 4] as any,
        status: ['healthy', 'warning', 'error'][Math.floor(Math.random() * 3)] as any,
        metrics: {
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          network: Math.random() * 100,
          connections: Math.floor(Math.random() * 1000),
          responseTime: Math.random() * 500
        }
      }));

      const links = nodes.slice(1).map((node, i) => ({
        source: nodes[Math.floor(Math.random() * (i + 1))].id,
        target: node.id,
        type: ['primary', 'backup', 'api'][Math.floor(Math.random() * 3)] as any,
        bandwidth: Math.random() * 1000,
        latency: Math.random() * 100,
        utilization: Math.random(),
        status: ['active', 'standby'][Math.floor(Math.random() * 2)] as any
      }));

      return { nodes, links };
    }
  },

  // Performance optimization utilities
  performance: {
    // Debounce function for real-time updates
    debounce: <T extends (...args: any[]) => any>(
      func: T,
      delay: number
    ): T => {
      let timeoutId: NodeJS.Timeout;
      return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(null, args), delay);
      }) as T;
    },

    // Throttle function for frequent events
    throttle: <T extends (...args: any[]) => any>(
      func: T,
      delay: number
    ): T => {
      let lastCall = 0;
      return ((...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          return func.apply(null, args);
        }
      }) as T;
    },

    // Sample large datasets for performance
    sampleData: <T>(data: T[], maxSize: number): T[] => {
      if (data.length <= maxSize) return data;
      const step = Math.ceil(data.length / maxSize);
      return data.filter((_, index) => index % step === 0);
    }
  },

  // Export utilities
  export: {
    // Convert component to data URL
    componentToDataURL: async (element: HTMLElement): Promise<string> => {
      // This would use html2canvas in the actual implementation
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    },

    // Generate CSV from data
    generateCSV: (data: any[], headers?: string[]): string => {
      if (data.length === 0) return '';
      
      const keys = headers || Object.keys(data[0]);
      const csvHeaders = keys.join(',');
      const csvRows = data.map(row => 
        keys.map(key => {
          const value = row[key];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      );
      
      return [csvHeaders, ...csvRows].join('\n');
    }
  }
};

// Default configurations for each visualization type
export const defaultConfigs = {
  threeDMetrics: {
    width: 800,
    height: 600,
    autoRotate: true,
    showLabels: true
  },
  
  dependencyGraph: {
    width: 1000,
    height: 600,
    showMetrics: true,
    autoLayout: true
  },
  
  heatMap: {
    width: 800,
    height: 500,
    colorScale: 'viridis' as const,
    showValues: false,
    showGrid: true
  },
  
  correlationMatrix: {
    width: 800,
    height: 800,
    showValues: true,
    threshold: 0.3,
    autoDiscover: true
  },
  
  sankeyFlow: {
    width: 1000,
    height: 600,
    nodeWidth: 15,
    nodePadding: 10,
    showLabels: true,
    showValues: true,
    colorScheme: 'category' as const
  },
  
  networkTopology: {
    width: 1200,
    height: 800,
    realTimeUpdates: false,
    showMetrics: true,
    layoutType: 'force' as const
  }
};

// Performance benchmarking utilities
export const performanceBenchmark = {
  // Measure render time
  measureRenderTime: async (renderFunction: () => void): Promise<number> => {
    const start = performance.now();
    renderFunction();
    const end = performance.now();
    return end - start;
  },

  // Measure memory usage
  measureMemoryUsage: (): number => {
    return (performance as any).memory?.usedJSHeapSize || 0;
  },

  // Run comprehensive benchmark
  runBenchmark: async (components: Array<() => void>): Promise<{
    avgRenderTime: number;
    memoryUsage: number;
    componentsCount: number;
  }> => {
    const renderTimes: number[] = [];
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    for (const component of components) {
      const renderTime = await performanceBenchmark.measureRenderTime(component);
      renderTimes.push(renderTime);
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;

    return {
      avgRenderTime,
      memoryUsage: finalMemory - initialMemory,
      componentsCount: components.length
    };
  }
};

// Accessibility utilities
export const accessibilityUtils = {
  // ARIA label generators
  generateAriaLabel: (type: string, data: any): string => {
    switch (type) {
      case '3d-metric':
        return `3D visualization showing ${data.name} with value ${data.value}`;
      case 'dependency-node':
        return `Service ${data.name} of type ${data.type} with status ${data.status}`;
      case 'heat-cell':
        return `Heat map cell at position ${data.x}, ${data.y} with value ${data.value}`;
      case 'network-node':
        return `Network node ${data.name} running at ${data.metrics.cpu}% CPU usage`;
      default:
        return 'Interactive visualization element';
    }
  },

  // Color contrast checker
  checkColorContrast: (foreground: string, background: string): number => {
    // Simplified contrast calculation
    // In production, use a proper contrast calculation library
    return 4.5; // Placeholder
  },

  // Keyboard navigation helpers
  keyboardNavigation: {
    handleKeyDown: (event: KeyboardEvent, actions: Record<string, () => void>) => {
      const action = actions[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    }
  }
};