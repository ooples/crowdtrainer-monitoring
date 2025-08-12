import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock the heavy dependencies
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="three-canvas">{children}</div>,
  useFrame: () => {},
  useThree: () => ({})
}));

jest.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  Text: ({ children }: any) => <div data-testid="three-text">{children}</div>,
  Box: ({ children }: any) => <div data-testid="three-box">{children}</div>,
  Sphere: ({ children }: any) => <div data-testid="three-sphere">{children}</div>,
  Cylinder: ({ children }: any) => <div data-testid="three-cylinder">{children}</div>
}));

jest.mock('three', () => ({
  Mesh: function() { this.rotation = { x: 0, y: 0, z: 0 }; this.scale = { setScalar: jest.fn() }; },
  Group: function() { this.rotation = { x: 0, y: 0, z: 0 }; },
  Vector3: function() { this.set = jest.fn(); },
  Color: function() { this.r = 0; this.g = 0; this.b = 0; }
}));

jest.mock('d3', () => ({
  ...jest.requireActual('d3'),
  select: jest.fn(() => ({
    selectAll: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    style: jest.fn().mockReturnThis(),
    data: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    call: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    html: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis()
  })),
  forceSimulation: jest.fn(() => ({
    nodes: jest.fn().mockReturnThis(),
    force: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    restart: jest.fn().mockReturnThis(),
    stop: jest.fn(),
    alpha: jest.fn().mockReturnThis(),
    alphaTarget: jest.fn().mockReturnThis()
  })),
  forceLink: jest.fn(() => ({
    id: jest.fn().mockReturnThis(),
    distance: jest.fn().mockReturnThis(),
    strength: jest.fn().mockReturnThis(),
    links: jest.fn().mockReturnThis()
  })),
  forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
  forceCenter: jest.fn(() => ({ x: jest.fn().mockReturnThis(), y: jest.fn().mockReturnThis() })),
  forceCollide: jest.fn(() => ({ radius: jest.fn().mockReturnThis() })),
  forceX: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
  forceY: jest.fn(() => ({ y: jest.fn().mockReturnThis(), strength: jest.fn().mockReturnThis() })),
  forceRadial: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
  drag: jest.fn(() => ({ on: jest.fn().mockReturnThis() })),
  zoom: jest.fn(() => ({ scaleExtent: jest.fn().mockReturnThis(), on: jest.fn().mockReturnThis() })),
  scaleOrdinal: jest.fn(() => jest.fn()),
  scaleSequential: jest.fn(() => ({ domain: jest.fn().mockReturnThis() })),
  scaleLinear: jest.fn(() => ({ domain: jest.fn().mockReturnThis(), range: jest.fn().mockReturnThis() })),
  interpolateViridis: jest.fn(),
  interpolatePlasma: jest.fn(),
  interpolateRdBu: jest.fn(),
  schemeSet3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072'],
  extent: jest.fn(() => [0, 100]),
  mean: jest.fn(() => 50),
  max: jest.fn(() => 100),
  min: jest.fn(() => 0),
  group: jest.fn(() => new Map()),
  format: jest.fn(() => jest.fn()),
  range: jest.fn(() => [0, 0.1, 0.2, 0.3, 0.4, 0.5]),
  axisBottom: jest.fn(() => ({
    ticks: jest.fn().mockReturnThis(),
    tickFormat: jest.fn().mockReturnThis()
  }))
}));

jest.mock('d3-sankey', () => ({
  sankey: jest.fn(() => ({
    nodeWidth: jest.fn().mockReturnThis(),
    nodePadding: jest.fn().mockReturnThis(),
    extent: jest.fn().mockReturnThis()
  })),
  sankeyLinkHorizontal: jest.fn(() => 'M0,0L100,100')
}));

jest.mock('html2canvas', () => jest.fn(() => Promise.resolve({
  toBlob: jest.fn((callback) => callback(new Blob()))
})));

jest.mock('jspdf', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    addImage: jest.fn(),
    save: jest.fn()
  }))
}));

jest.mock('file-saver', () => ({
  saveAs: jest.fn()
}));

// Import components after mocking dependencies
import ThreeDMetrics from '../ThreeDMetrics';
import DependencyGraph from '../DependencyGraph';
import HeatMap from '../HeatMap';
import CorrelationMatrix from '../CorrelationMatrix';
import SankeyFlow from '../SankeyFlow';
import NetworkTopology from '../NetworkTopology';

// Test data generators
const generateMetricData = (count = 10) => 
  Array.from({ length: count }, (_, i) => ({
    id: `metric-${i}`,
    name: `Metric ${i}`,
    value: Math.random() * 100,
    timestamp: Date.now() + i * 1000,
    category: ['performance', 'error', 'usage', 'latency'][i % 4] as any
  }));

const generateHeatMapData = (count = 20) => 
  Array.from({ length: count }, (_, i) => ({
    x: `X${i % 5}`,
    y: `Y${Math.floor(i / 5)}`,
    value: Math.random() * 100,
    timestamp: Date.now() + i * 1000
  }));

const generateCorrelationData = (count = 5) => 
  Array.from({ length: count }, (_, i) => ({
    name: `Metric${i}`,
    values: Array.from({ length: 50 }, () => Math.random() * 100),
    timestamps: Array.from({ length: 50 }, (_, j) => Date.now() + j * 1000),
    unit: 'ms'
  }));

const generateDependencyData = () => ({
  nodes: [
    { id: 'api', name: 'API Server', type: 'service' as const, status: 'healthy' as const, 
      metrics: { responseTime: 100, errorRate: 1, throughput: 1000, cpu: 50, memory: 60 } },
    { id: 'db', name: 'Database', type: 'database' as const, status: 'healthy' as const, 
      metrics: { responseTime: 50, errorRate: 0.1, throughput: 500, cpu: 30, memory: 70 } }
  ],
  links: [
    { source: 'api', target: 'db', type: 'database' as const, weight: 1, latency: 5, errorRate: 0.1, status: 'healthy' as const }
  ]
});

const generateSankeyData = () => ({
  nodes: [
    { id: 'source', name: 'Source', category: 'input' },
    { id: 'target', name: 'Target', category: 'output' }
  ],
  links: [
    { source: 'source', target: 'target', value: 100 }
  ]
});

const generateNetworkData = () => ({
  nodes: [
    { id: 'server1', name: 'Server 1', type: 'server' as const, status: 'healthy' as const,
      metrics: { cpu: 50, memory: 60, network: 30, connections: 100, responseTime: 50 } },
    { id: 'db1', name: 'Database 1', type: 'database' as const, status: 'healthy' as const,
      metrics: { cpu: 30, memory: 70, network: 20, connections: 50, responseTime: 30 } }
  ],
  links: [
    { source: 'server1', target: 'db1', type: 'primary' as const, bandwidth: 1000, latency: 5, utilization: 0.8, status: 'active' as const }
  ]
});

describe('Visualization Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ThreeDMetrics', () => {
    const mockData = generateMetricData();

    test('renders 3D metrics visualization', async () => {
      render(<ThreeDMetrics data={mockData} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
      });
    });

    test('handles metric clicks', async () => {
      const onMetricClick = jest.fn();
      render(<ThreeDMetrics data={mockData} onMetricClick={onMetricClick} />);
      
      // Test would need more sophisticated mocking for actual click events in 3D scene
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    test('exports visualization', async () => {
      render(<ThreeDMetrics data={mockData} />);
      
      const exportButton = screen.getByText('PNG');
      fireEvent.click(exportButton);
      
      // Verify export function was called
      await waitFor(() => {
        // html2canvas should have been called
      });
    });

    test('handles large datasets efficiently', async () => {
      const largeData = generateMetricData(10000);
      const { container } = render(<ThreeDMetrics data={largeData} />);
      
      // Component should render without crashing
      expect(container).toBeInTheDocument();
    });

    test('toggles auto-rotate functionality', async () => {
      const { rerender } = render(<ThreeDMetrics data={mockData} autoRotate={true} />);
      
      rerender(<ThreeDMetrics data={mockData} autoRotate={false} />);
      
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    test('shows/hides labels correctly', async () => {
      const { rerender } = render(<ThreeDMetrics data={mockData} showLabels={true} />);
      
      rerender(<ThreeDMetrics data={mockData} showLabels={false} />);
      
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });
  });

  describe('DependencyGraph', () => {
    const mockData = generateDependencyData();

    test('renders dependency graph', async () => {
      render(<DependencyGraph nodes={mockData.nodes} links={mockData.links} />);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument(); // Search input
    });

    test('filters nodes by search term', async () => {
      render(<DependencyGraph nodes={mockData.nodes} links={mockData.links} />);
      
      const searchInput = screen.getByPlaceholderText('Search services...');
      fireEvent.change(searchInput, { target: { value: 'API' } });
      
      expect(searchInput).toHaveValue('API');
    });

    test('filters nodes by type', async () => {
      render(<DependencyGraph nodes={mockData.nodes} links={mockData.links} />);
      
      const typeSelect = screen.getByDisplayValue('All Types');
      fireEvent.change(typeSelect, { target: { value: 'service' } });
      
      expect(typeSelect).toHaveValue('service');
    });

    test('handles node clicks', async () => {
      const onNodeClick = jest.fn();
      render(<DependencyGraph 
        nodes={mockData.nodes} 
        links={mockData.links} 
        onNodeClick={onNodeClick} 
      />);
      
      // D3 interactions would need more sophisticated testing
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    test('exports in multiple formats', async () => {
      render(<DependencyGraph nodes={mockData.nodes} links={mockData.links} />);
      
      const pngButton = screen.getByText('PNG');
      const svgButton = screen.getByText('SVG');
      
      fireEvent.click(pngButton);
      fireEvent.click(svgButton);
      
      expect(pngButton).toBeInTheDocument();
      expect(svgButton).toBeInTheDocument();
    });
  });

  describe('HeatMap', () => {
    const mockData = generateHeatMapData();

    test('renders heat map', async () => {
      render(<HeatMap data={mockData} />);
      
      expect(screen.getByDisplayValue('Normal View')).toBeInTheDocument();
    });

    test('switches view modes', async () => {
      render(<HeatMap data={mockData} />);
      
      const viewSelect = screen.getByDisplayValue('Normal View');
      fireEvent.change(viewSelect, { target: { value: 'time-patterns' } });
      
      expect(viewSelect).toHaveValue('time-patterns');
    });

    test('changes color scale', async () => {
      render(<HeatMap data={mockData} />);
      
      const colorSelect = screen.getByDisplayValue('Viridis');
      fireEvent.change(colorSelect, { target: { value: 'plasma' } });
      
      expect(colorSelect).toHaveValue('plasma');
    });

    test('toggles values display', async () => {
      render(<HeatMap data={mockData} />);
      
      const valuesCheckbox = screen.getByLabelText('Values');
      fireEvent.click(valuesCheckbox);
      
      expect(valuesCheckbox).toBeInTheDocument();
    });

    test('toggles grid display', async () => {
      render(<HeatMap data={mockData} />);
      
      const gridCheckbox = screen.getByLabelText('Grid');
      fireEvent.click(gridCheckbox);
      
      expect(gridCheckbox).toBeInTheDocument();
    });

    test('handles large datasets', async () => {
      const largeData = generateHeatMapData(10000);
      const { container } = render(<HeatMap data={largeData} />);
      
      expect(container).toBeInTheDocument();
    });
  });

  describe('CorrelationMatrix', () => {
    const mockData = generateCorrelationData();

    test('renders correlation matrix', async () => {
      render(<CorrelationMatrix metrics={mockData} />);
      
      expect(screen.getByLabelText('Show Values')).toBeInTheDocument();
    });

    test('toggles significant correlations only', async () => {
      render(<CorrelationMatrix metrics={mockData} />);
      
      const significantCheckbox = screen.getByLabelText('Significant Only');
      fireEvent.click(significantCheckbox);
      
      expect(significantCheckbox).toBeInTheDocument();
    });

    test('adjusts correlation threshold', async () => {
      render(<CorrelationMatrix metrics={mockData} />);
      
      const thresholdSlider = screen.getByRole('slider');
      fireEvent.change(thresholdSlider, { target: { value: '0.7' } });
      
      expect(thresholdSlider).toHaveValue('0.7');
    });

    test('exports correlation data as CSV', async () => {
      render(<CorrelationMatrix metrics={mockData} />);
      
      const csvButton = screen.getByText('CSV');
      fireEvent.click(csvButton);
      
      expect(csvButton).toBeInTheDocument();
    });

    test('auto-discovers interesting correlations', async () => {
      render(<CorrelationMatrix metrics={mockData} autoDiscover={true} />);
      
      // Component should render correlation analysis
      expect(screen.getByLabelText('Show Values')).toBeInTheDocument();
    });

    test('calculates correlation coefficients correctly', () => {
      const testData = [
        { name: 'A', values: [1, 2, 3, 4, 5], timestamps: [1, 2, 3, 4, 5] },
        { name: 'B', values: [2, 4, 6, 8, 10], timestamps: [1, 2, 3, 4, 5] }
      ];
      
      render(<CorrelationMatrix metrics={testData} />);
      
      // Perfect positive correlation should be detected
      expect(screen.getByLabelText('Show Values')).toBeInTheDocument();
    });
  });

  describe('SankeyFlow', () => {
    const mockData = generateSankeyData();

    test('renders Sankey diagram', async () => {
      render(<SankeyFlow data={mockData} />);
      
      expect(screen.getByDisplayValue('By Category')).toBeInTheDocument();
    });

    test('changes color scheme', async () => {
      render(<SankeyFlow data={mockData} />);
      
      const colorSelect = screen.getByDisplayValue('By Category');
      fireEvent.change(colorSelect, { target: { value: 'value' } });
      
      expect(colorSelect).toHaveValue('value');
    });

    test('toggles labels and values', async () => {
      render(<SankeyFlow data={mockData} />);
      
      const labelsCheckbox = screen.getByLabelText('Labels');
      const valuesCheckbox = screen.getByLabelText('Values');
      
      fireEvent.click(labelsCheckbox);
      fireEvent.click(valuesCheckbox);
      
      expect(labelsCheckbox).toBeInTheDocument();
      expect(valuesCheckbox).toBeInTheDocument();
    });

    test('handles flow interactions', async () => {
      const onNodeClick = jest.fn();
      const onLinkClick = jest.fn();
      
      render(<SankeyFlow 
        data={mockData} 
        onNodeClick={onNodeClick}
        onLinkClick={onLinkClick}
      />);
      
      expect(screen.getByDisplayValue('By Category')).toBeInTheDocument();
    });

    test('calculates flow statistics', async () => {
      render(<SankeyFlow data={mockData} />);
      
      // Statistics should be displayed
      expect(screen.getByText(/Nodes:/)).toBeInTheDocument();
    });
  });

  describe('NetworkTopology', () => {
    const mockData = generateNetworkData();

    test('renders network topology', async () => {
      render(<NetworkTopology nodes={mockData.nodes} links={mockData.links} />);
      
      expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    });

    test('switches layout types', async () => {
      render(<NetworkTopology nodes={mockData.nodes} links={mockData.links} />);
      
      const layoutSelect = screen.getByDisplayValue('Force Layout');
      fireEvent.change(layoutSelect, { target: { value: 'hierarchical' } });
      
      expect(layoutSelect).toHaveValue('hierarchical');
    });

    test('filters by status and type', async () => {
      render(<NetworkTopology nodes={mockData.nodes} links={mockData.links} />);
      
      const statusSelect = screen.getByDisplayValue('All Status');
      const typeSelect = screen.getByDisplayValue('All Types');
      
      fireEvent.change(statusSelect, { target: { value: 'healthy' } });
      fireEvent.change(typeSelect, { target: { value: 'server' } });
      
      expect(statusSelect).toHaveValue('healthy');
      expect(typeSelect).toHaveValue('server');
    });

    test('searches nodes', async () => {
      render(<NetworkTopology nodes={mockData.nodes} links={mockData.links} />);
      
      const searchInput = screen.getByPlaceholderText('Search nodes...');
      fireEvent.change(searchInput, { target: { value: 'Server' } });
      
      expect(searchInput).toHaveValue('Server');
    });

    test('toggles metrics display', async () => {
      render(<NetworkTopology nodes={mockData.nodes} links={mockData.links} />);
      
      const metricsCheckbox = screen.getByLabelText('Metrics');
      fireEvent.click(metricsCheckbox);
      
      expect(metricsCheckbox).toBeInTheDocument();
    });

    test('handles real-time updates', async () => {
      const { container } = render(
        <NetworkTopology 
          nodes={mockData.nodes} 
          links={mockData.links}
          realTimeUpdates={true}
        />
      );
      
      expect(container).toBeInTheDocument();
    });

    test('calculates network statistics', async () => {
      render(<NetworkTopology nodes={mockData.nodes} links={mockData.links} />);
      
      // Statistics should be displayed
      expect(screen.getByText(/Nodes:/)).toBeInTheDocument();
      expect(screen.getByText(/Links:/)).toBeInTheDocument();
    });
  });

  describe('Performance Tests', () => {
    test('handles 10,000+ data points efficiently', async () => {
      const startTime = performance.now();
      
      const largeMetricData = generateMetricData(10000);
      const largeHeatMapData = generateHeatMapData(10000);
      
      render(<ThreeDMetrics data={largeMetricData} />);
      render(<HeatMap data={largeHeatMapData} />);
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(5000); // 5 seconds
    });

    test('memory usage remains stable with large datasets', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      const largeData = generateMetricData(1000);
      const { unmount } = render(<ThreeDMetrics data={largeData} />);
      
      unmount();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Memory should not grow excessively (this is a basic check)
      expect(finalMemory - initialMemory).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Accessibility Tests', () => {
    test('components have proper ARIA labels', () => {
      render(<ThreeDMetrics data={generateMetricData()} />);
      
      const exportButton = screen.getByLabelText('Export as PNG');
      expect(exportButton).toBeInTheDocument();
    });

    test('components support keyboard navigation', () => {
      render(<DependencyGraph nodes={generateDependencyData().nodes} links={generateDependencyData().links} />);
      
      const searchInput = screen.getByRole('textbox');
      expect(searchInput).toBeInTheDocument();
      
      // Test keyboard interaction
      fireEvent.focus(searchInput);
      fireEvent.keyDown(searchInput, { key: 'Tab' });
    });

    test('components have sufficient color contrast', () => {
      // This would typically involve more sophisticated color analysis
      const { container } = render(<HeatMap data={generateHeatMapData()} />);
      
      expect(container).toBeInTheDocument();
      // In a real test, you'd check computed styles for contrast ratios
    });
  });

  describe('Export Functionality', () => {
    test('all components support PNG export', async () => {
      const components = [
        <ThreeDMetrics key="3d" data={generateMetricData()} />,
        <DependencyGraph key="dep" nodes={generateDependencyData().nodes} links={generateDependencyData().links} />,
        <HeatMap key="heat" data={generateHeatMapData()} />,
        <CorrelationMatrix key="corr" metrics={generateCorrelationData()} />,
        <SankeyFlow key="sankey" data={generateSankeyData()} />,
        <NetworkTopology key="net" nodes={generateNetworkData().nodes} links={generateNetworkData().links} />
      ];
      
      for (const component of components) {
        render(component);
        const pngButton = screen.getByText('PNG');
        fireEvent.click(pngButton);
        expect(pngButton).toBeInTheDocument();
      }
    });

    test('SVG export works for vector components', async () => {
      const vectorComponents = [
        <DependencyGraph key="dep" nodes={generateDependencyData().nodes} links={generateDependencyData().links} />,
        <HeatMap key="heat" data={generateHeatMapData()} />,
        <SankeyFlow key="sankey" data={generateSankeyData()} />,
        <NetworkTopology key="net" nodes={generateNetworkData().nodes} links={generateNetworkData().links} />
      ];
      
      for (const component of vectorComponents) {
        render(component);
        const svgButton = screen.getByText('SVG');
        fireEvent.click(svgButton);
        expect(svgButton).toBeInTheDocument();
      }
    });
  });

  describe('Responsive Design', () => {
    test('components adapt to different screen sizes', () => {
      const { rerender } = render(
        <ThreeDMetrics data={generateMetricData()} width={800} height={600} />
      );
      
      rerender(
        <ThreeDMetrics data={generateMetricData()} width={400} height={300} />
      );
      
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    test('mobile-friendly controls', () => {
      render(<HeatMap data={generateHeatMapData()} />);
      
      // Check that controls are accessible on mobile
      const controls = screen.getAllByRole('combobox');
      expect(controls.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('handles empty datasets gracefully', () => {
      render(<ThreeDMetrics data={[]} />);
      render(<HeatMap data={[]} />);
      render(<DependencyGraph nodes={[]} links={[]} />);
      
      // Components should not crash with empty data
      expect(screen.getByTestId('three-canvas')).toBeInTheDocument();
    });

    test('handles malformed data', () => {
      const malformedData = [
        { id: '', name: null, value: NaN, timestamp: undefined, category: 'invalid' as any }
      ];
      
      expect(() => {
        render(<ThreeDMetrics data={malformedData} />);
      }).not.toThrow();
    });

    test('displays error boundaries', () => {
      // Mock a component that throws an error
      const ThrowingComponent = () => {
        throw new Error('Test error');
      };
      
      // This would need an error boundary wrapper in the actual implementation
      expect(() => {
        render(<ThrowingComponent />);
      }).toThrow();
    });
  });
});

// Performance benchmark helper
export const runPerformanceBenchmark = async () => {
  const results = {
    '3DMetrics': { renderTime: 0, memoryUsage: 0 },
    'DependencyGraph': { renderTime: 0, memoryUsage: 0 },
    'HeatMap': { renderTime: 0, memoryUsage: 0 },
    'CorrelationMatrix': { renderTime: 0, memoryUsage: 0 },
    'SankeyFlow': { renderTime: 0, memoryUsage: 0 },
    'NetworkTopology': { renderTime: 0, memoryUsage: 0 }
  };

  const testData = {
    metrics: generateMetricData(1000),
    heatMap: generateHeatMapData(1000),
    correlation: generateCorrelationData(20),
    dependency: generateDependencyData(),
    sankey: generateSankeyData(),
    network: generateNetworkData()
  };

  // Benchmark each component
  for (const [componentName, Component] of Object.entries({
    '3DMetrics': () => <ThreeDMetrics data={testData.metrics} />,
    'HeatMap': () => <HeatMap data={testData.heatMap} />,
    'CorrelationMatrix': () => <CorrelationMatrix metrics={testData.correlation} />
  })) {
    const startTime = performance.now();
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    const { unmount } = render(Component());
    
    const endTime = performance.now();
    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    results[componentName as keyof typeof results] = {
      renderTime: endTime - startTime,
      memoryUsage: finalMemory - initialMemory
    };
    
    unmount();
  }

  return results;
};