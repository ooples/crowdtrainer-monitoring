'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface NetworkNode {
  id: string;
  name: string;
  type: 'server' | 'database' | 'load_balancer' | 'cdn' | 'external' | 'client';
  status: 'healthy' | 'warning' | 'error' | 'unknown' | 'offline';
  metrics: {
    cpu: number;
    memory: number;
    network: number;
    connections: number;
    responseTime: number;
  };
  location?: {
    region: string;
    datacenter: string;
    coordinates?: [number, number];
  };
  metadata?: Record<string, any>;
  group?: string;
}

interface NetworkLink {
  source: string;
  target: string;
  type: 'primary' | 'backup' | 'sync' | 'api' | 'data';
  bandwidth: number;
  latency: number;
  utilization: number;
  status: 'active' | 'standby' | 'failed';
  protocol?: string;
  metadata?: Record<string, any>;
}

interface NetworkTopologyProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  onLinkClick?: (link: NetworkLink) => void;
  realTimeUpdates?: boolean;
  showMetrics?: boolean;
  layoutType?: 'force' | 'hierarchical' | 'circular' | 'geographic';
  className?: string;
}

// Node type configurations
const nodeConfig = {
  server: { radius: 20, color: '#3b82f6', icon: '🖥️' },
  database: { radius: 18, color: '#10b981', icon: '🗄️' },
  load_balancer: { radius: 16, color: '#f59e0b', icon: '⚖️' },
  cdn: { radius: 14, color: '#8b5cf6', icon: '🌐' },
  external: { radius: 12, color: '#ef4444', icon: '🔗' },
  client: { radius: 10, color: '#6b7280', icon: '👤' }
};

const statusColors = {
  healthy: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  unknown: '#6b7280',
  offline: '#374151'
};

const linkTypeStyles = {
  primary: { strokeWidth: 3, strokeDasharray: 'none', color: '#10b981' },
  backup: { strokeWidth: 2, strokeDasharray: '5,5', color: '#f59e0b' },
  sync: { strokeWidth: 2, strokeDasharray: '2,2', color: '#8b5cf6' },
  api: { strokeWidth: 1.5, strokeDasharray: 'none', color: '#3b82f6' },
  data: { strokeWidth: 2.5, strokeDasharray: 'none', color: '#ef4444' }
};

export default function NetworkTopology({
  nodes,
  links,
  width = 1200,
  height = 800,
  onNodeClick,
  onLinkClick,
  realTimeUpdates = false,
  showMetrics = true,
  layoutType = 'force',
  className = ''
}: NetworkTopologyProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<NetworkLink | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState(1);

  // Filter nodes and links
  const filteredData = useMemo(() => {
    let filteredNodes = nodes;
    let filteredLinks = links;

    if (searchTerm) {
      filteredNodes = nodes.filter(node =>
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (node.location?.region || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.status === filterStatus);
    }

    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.type === filterType);
    }

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredLinks = links.filter(link =>
      nodeIds.has(link.source) && nodeIds.has(link.target)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, links, searchTerm, filterStatus, filterType]);

  // Create layout simulation
  const createSimulation = useCallback((layoutType: string) => {
    const { nodes: filteredNodes, links: filteredLinks } = filteredData;
    
    let simulation = d3.forceSimulation(filteredNodes as any);

    switch (layoutType) {
      case 'hierarchical':
        simulation
          .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(100))
          .force('charge', d3.forceManyBody().strength(-500))
          .force('y', d3.forceY().y((d: any) => {
            const levels = { client: 100, load_balancer: 200, server: 300, database: 400, external: 500, cdn: 150 };
            return levels[d.type as keyof typeof levels] || 300;
          }).strength(0.5))
          .force('x', d3.forceX(width / 2).strength(0.1))
          .force('collision', d3.forceCollide().radius((d: any) => nodeConfig[d.type]?.radius + 5 || 15));
        break;
        
      case 'circular':
        simulation
          .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(80))
          .force('charge', d3.forceManyBody().strength(-200))
          .force('radial', d3.forceRadial(Math.min(width, height) / 3, width / 2, height / 2).strength(0.8))
          .force('collision', d3.forceCollide().radius((d: any) => nodeConfig[d.type]?.radius + 5 || 15));
        break;
        
      case 'geographic':
        // Use coordinates if available, otherwise fall back to force layout
        if (filteredNodes.some(n => n.location?.coordinates)) {
          simulation
            .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(50).strength(0.1))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('position', d3.forceCenter().x(width / 2).y(height / 2))
            .force('collision', d3.forceCollide().radius((d: any) => nodeConfig[d.type]?.radius + 5 || 15));
          
          // Position nodes based on coordinates
          simulation.on('tick', () => {
            filteredNodes.forEach((node: any) => {
              if (node.location?.coordinates) {
                // Simple coordinate mapping (in real app, use proper projection)
                node.fx = (node.location.coordinates[0] + 180) * width / 360;
                node.fy = (90 - node.location.coordinates[1]) * height / 180;
              }
            });
          });
        } else {
          // Fall back to force layout
          simulation
            .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius((d: any) => nodeConfig[d.type]?.radius + 5 || 15));
        }
        break;
        
      case 'force':
      default:
        simulation
          .force('link', d3.forceLink(filteredLinks).id((d: any) => d.id).distance(100).strength(0.1))
          .force('charge', d3.forceManyBody().strength(-300))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collision', d3.forceCollide().radius((d: any) => nodeConfig[d.type]?.radius + 5 || 15));
        break;
    }

    return simulation;
  }, [filteredData, width, height]);

  // Export utilities
  const exportUtils = {
    async exportAsPNG(): Promise<void> {
      if (!containerRef.current) return;
      
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#1f2937',
        scale: 2
      });
      
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `network-topology-${Date.now()}.png`);
        }
      });
    },

    async exportAsPDF(): Promise<void> {
      if (!containerRef.current) return;
      
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#1f2937',
        scale: 2
      });
      
      const pdf = new jsPDF('landscape');
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`network-topology-${Date.now()}.pdf`);
    },

    exportAsSVG(): void {
      if (!svgRef.current) return;
      
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(svgBlob, `network-topology-${Date.now()}.svg`);
    }
  };

  // Handle interactions
  const handleNodeClick = useCallback((node: NetworkNode) => {
    setSelectedNode(node);
    onNodeClick?.(node);
  }, [onNodeClick]);

  const handleLinkClick = useCallback((link: NetworkLink) => {
    setSelectedLink(link);
    onLinkClick?.(link);
  }, [onLinkClick]);

  // Drag behavior
  const drag = useMemo(() => {
    return d3.drag()
      .on('start', (event, d: any) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d: any) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d: any) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });
  }, []);

  // Main rendering effect
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        setZoomLevel(event.transform.k);
        svg.select('.main-group').attr('transform', event.transform);
      });

    svg.call(zoom as any);

    const g = svg.append('g').attr('class', 'main-group');

    // Create simulation
    const simulation = createSimulation(layoutType);
    simulationRef.current = simulation;

    // Create links
    const link = g.append('g')
      .selectAll('.link')
      .data(filteredData.links)
      .join('line')
      .attr('class', 'link')
      .attr('stroke', d => linkTypeStyles[d.type].color)
      .attr('stroke-width', d => linkTypeStyles[d.type].strokeWidth * Math.max(0.5, d.utilization))
      .attr('stroke-dasharray', d => linkTypeStyles[d.type].strokeDasharray)
      .attr('stroke-opacity', d => d.status === 'active' ? 0.8 : 0.4)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        const originalLink = links.find(l => l.source === d.source && l.target === d.target);
        if (originalLink) handleLinkClick(originalLink);
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-width', linkTypeStyles[d.type].strokeWidth * Math.max(1, d.utilization) * 1.5)
          .attr('stroke-opacity', 1);

        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'network-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '12px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        const sourceNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));

        tooltip.html(`
          <div><strong>${sourceNode?.name} → ${targetNode?.name}</strong></div>
          <div>Type: ${d.type.toUpperCase()}</div>
          <div>Bandwidth: ${d.bandwidth} Mbps</div>
          <div>Latency: ${d.latency}ms</div>
          <div>Utilization: ${(d.utilization * 100).toFixed(1)}%</div>
          <div>Status: ${d.status.toUpperCase()}</div>
          ${d.protocol ? `<div>Protocol: ${d.protocol}</div>` : ''}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke-width', linkTypeStyles[d.type].strokeWidth * Math.max(0.5, d.utilization))
          .attr('stroke-opacity', d.status === 'active' ? 0.8 : 0.4);
        
        d3.selectAll('.network-tooltip').remove();
      });

    // Create nodes
    const node = g.append('g')
      .selectAll('.node')
      .data(filteredData.nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(drag as any);

    // Node circles
    node.append('circle')
      .attr('r', d => nodeConfig[d.type]?.radius || 15)
      .attr('fill', d => nodeConfig[d.type]?.color || '#6b7280')
      .attr('stroke', d => statusColors[d.status])
      .attr('stroke-width', 3)
      .attr('opacity', 0.8)
      .on('click', (event, d) => {
        handleNodeClick(d);
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke-width', 5);

        // Highlight connected links
        link.attr('stroke-opacity', (l: any) => {
          const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
          const targetId = typeof l.target === 'string' ? l.target : l.target.id;
          return (sourceId === d.id || targetId === d.id) ? 1 : 0.2;
        });

        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'network-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '12px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        tooltip.html(`
          <div><strong>${d.name}</strong></div>
          <div>Type: ${d.type.toUpperCase()}</div>
          <div>Status: ${d.status.toUpperCase()}</div>
          <div>CPU: ${d.metrics.cpu}%</div>
          <div>Memory: ${d.metrics.memory}%</div>
          <div>Network: ${d.metrics.network}%</div>
          <div>Connections: ${d.metrics.connections}</div>
          <div>Response Time: ${d.metrics.responseTime}ms</div>
          ${d.location ? `<div>Location: ${d.location.region}/${d.location.datacenter}</div>` : ''}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('opacity', 0.8)
          .attr('stroke-width', 3);

        // Reset link opacity
        link.attr('stroke-opacity', (l: any) => l.status === 'active' ? 0.8 : 0.4);
        
        d3.selectAll('.network-tooltip').remove();
      });

    // Node labels
    node.append('text')
      .text(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeConfig[d.type]?.radius + 15 || 30)
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .attr('pointer-events', 'none');

    // Node type icons (using Unicode emojis)
    node.append('text')
      .text(d => nodeConfig[d.type]?.icon || '⚪')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', d => Math.max(8, (nodeConfig[d.type]?.radius || 15) * 0.8))
      .attr('pointer-events', 'none');

    // Metrics display
    if (showMetrics) {
      node.append('text')
        .text(d => `${d.metrics.cpu}%`)
        .attr('text-anchor', 'middle')
        .attr('dy', d => nodeConfig[d.type]?.radius + 28 || 43)
        .attr('font-size', '8px')
        .attr('fill', '#cccccc')
        .attr('pointer-events', 'none');
    }

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Real-time updates
    if (realTimeUpdates) {
      const interval = setInterval(() => {
        // Simulate real-time metric updates
        node.select('circle')
          .attr('stroke', (d: any) => statusColors[d.status])
          .attr('opacity', (d: any) => d.status === 'offline' ? 0.3 : 0.8);
        
        link
          .attr('stroke-width', (d: any) => linkTypeStyles[d.type].strokeWidth * Math.max(0.5, d.utilization))
          .attr('stroke-opacity', (d: any) => d.status === 'active' ? 0.8 : 0.4);
      }, 1000);

      return () => {
        clearInterval(interval);
        simulation.stop();
      };
    }

    return () => {
      simulation.stop();
    };
  }, [filteredData, layoutType, createSimulation, drag, handleNodeClick, handleLinkClick, 
      showMetrics, realTimeUpdates, nodes, links]);

  // Calculate network statistics
  const statistics = useMemo(() => {
    const healthyNodes = filteredData.nodes.filter(n => n.status === 'healthy').length;
    const activeLinks = filteredData.links.filter(l => l.status === 'active').length;
    const avgLatency = filteredData.links.reduce((sum, l) => sum + l.latency, 0) / filteredData.links.length || 0;
    const totalBandwidth = filteredData.links.reduce((sum, l) => sum + l.bandwidth, 0);

    return {
      healthyNodes,
      totalNodes: filteredData.nodes.length,
      activeLinks,
      totalLinks: filteredData.links.length,
      avgLatency: avgLatency.toFixed(1),
      totalBandwidth: totalBandwidth.toFixed(0),
      healthPercentage: ((healthyNodes / filteredData.nodes.length) * 100).toFixed(1)
    };
  }, [filteredData]);

  return (
    <motion.div
      ref={containerRef}
      className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}
      style={{ width, height }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600 w-32"
        />

        <select
          value={layoutType}
          onChange={(e) => setLayoutType(e.target.value as any)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
        >
          <option value="force">Force Layout</option>
          <option value="hierarchical">Hierarchical</option>
          <option value="circular">Circular</option>
          <option value="geographic">Geographic</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
        >
          <option value="all">All Status</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="offline">Offline</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
        >
          <option value="all">All Types</option>
          <option value="server">Servers</option>
          <option value="database">Databases</option>
          <option value="load_balancer">Load Balancers</option>
          <option value="cdn">CDN</option>
          <option value="external">External</option>
        </select>

        <label className="flex items-center gap-1 text-white text-sm">
          <input
            type="checkbox"
            checked={showMetrics}
            onChange={(e) => setShowMetrics(e.target.checked)}
          />
          Metrics
        </label>

        <button
          onClick={() => exportUtils.exportAsPNG()}
          className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          PNG
        </button>
        
        <button
          onClick={() => exportUtils.exportAsSVG()}
          className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          SVG
        </button>
      </div>

      {/* Network Statistics */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs space-y-1">
        <div>Nodes: {statistics.totalNodes} ({statistics.healthPercentage}% healthy)</div>
        <div>Links: {statistics.totalLinks} ({statistics.activeLinks} active)</div>
        <div>Avg Latency: {statistics.avgLatency}ms</div>
        <div>Total Bandwidth: {statistics.totalBandwidth} Mbps</div>
        <div>Zoom: {(zoomLevel * 100).toFixed(0)}%</div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-move"
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-70 rounded p-3">
        <div className="text-white text-sm space-y-2">
          <div className="font-semibold">Node Types</div>
          {Object.entries(nodeConfig).map(([type, config]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="text-sm">{config.icon}</div>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }}></div>
              <span className="capitalize text-xs">{type.replace('_', ' ')}</span>
            </div>
          ))}
          
          <div className="font-semibold mt-3">Status</div>
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 rounded-full" style={{ borderColor: color }}></div>
              <span className="capitalize text-xs">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <motion.div
          className="absolute bottom-4 right-4 z-10 bg-black bg-opacity-90 rounded-lg p-4 text-white max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            ×
          </button>
          <h3 className="font-bold text-sm mb-2">{selectedNode.name}</h3>
          <div className="space-y-1 text-xs">
            <div>Type: <span className="capitalize">{selectedNode.type.replace('_', ' ')}</span></div>
            <div>Status: <span className="capitalize">{selectedNode.status}</span></div>
            <div>CPU: {selectedNode.metrics.cpu}%</div>
            <div>Memory: {selectedNode.metrics.memory}%</div>
            <div>Network: {selectedNode.metrics.network}%</div>
            <div>Connections: {selectedNode.metrics.connections}</div>
            <div>Response Time: {selectedNode.metrics.responseTime}ms</div>
            {selectedNode.location && (
              <>
                <div>Region: {selectedNode.location.region}</div>
                <div>Datacenter: {selectedNode.location.datacenter}</div>
              </>
            )}
            {selectedNode.metadata && Object.entries(selectedNode.metadata).map(([key, value]) => (
              <div key={key}>{key}: {String(value)}</div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 center-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs text-center" style={{ left: '50%', transform: 'translateX(-50%)' }}>
        <div>Drag nodes • Click for details • Scroll to zoom • Pan to explore</div>
      </div>
    </motion.div>
  );
}