'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface ServiceNode {
  id: string;
  name: string;
  type: 'service' | 'database' | 'external' | 'cache';
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    cpu: number;
    memory: number;
  };
  version?: string;
  environment?: string;
  group?: string;
}

interface ServiceLink {
  source: string;
  target: string;
  type: 'http' | 'grpc' | 'database' | 'message_queue' | 'cache';
  weight: number;
  latency: number;
  errorRate: number;
  status: 'healthy' | 'degraded' | 'failed';
}

interface DependencyGraphProps {
  nodes: ServiceNode[];
  links: ServiceLink[];
  width?: number;
  height?: number;
  onNodeClick?: (node: ServiceNode) => void;
  onLinkClick?: (link: ServiceLink) => void;
  showMetrics?: boolean;
  autoLayout?: boolean;
  className?: string;
}

// Color schemes for different node types and statuses
const nodeColors = {
  service: '#3b82f6',
  database: '#10b981',
  external: '#f59e0b',
  cache: '#8b5cf6'
};

const statusColors = {
  healthy: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  unknown: '#6b7280'
};

const linkColors = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  failed: '#ef4444'
};

export default function DependencyGraph({
  nodes,
  links,
  width = 1000,
  height = 600,
  onNodeClick,
  onLinkClick,
  showMetrics = true,
  autoLayout = true,
  className = ''
}: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<ServiceNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<ServiceLink | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState(1);

  // Filter nodes and links based on search and type
  const filteredData = useMemo(() => {
    let filteredNodes = nodes;
    let filteredLinks = links;

    if (searchTerm) {
      filteredNodes = nodes.filter(node => 
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = links.filter(link => 
        nodeIds.has(link.source) && nodeIds.has(link.target)
      );
    }

    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter(node => node.type === filterType);
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link => 
        nodeIds.has(link.source) && nodeIds.has(link.target)
      );
    }

    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, links, searchTerm, filterType]);

  // D3 force simulation
  const simulation = useMemo(() => {
    return d3.forceSimulation()
      .force('link', d3.forceLink().id((d: any) => d.id).distance(100).strength(0.1))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));
  }, [width, height]);

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
          saveAs(blob, `dependency-graph-${Date.now()}.png`);
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
      pdf.save(`dependency-graph-${Date.now()}.pdf`);
    },

    exportAsSVG(): void {
      if (!svgRef.current) return;
      
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(svgBlob, `dependency-graph-${Date.now()}.svg`);
    }
  };

  // Handle node drag
  const handleDrag = useMemo(() => {
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }, [simulation]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        setZoomLevel(event.transform.k);
        svg.select('g').attr('transform', event.transform);
      });

    svg.call(zoom as any);

    const g = svg.append('g');

    // Create arrow markers for directed edges
    svg.append('defs').selectAll('marker')
      .data(['healthy', 'degraded', 'failed'])
      .join('marker')
      .attr('id', d => `arrow-${d}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', d => linkColors[d as keyof typeof linkColors]);

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(filteredData.links)
      .join('line')
      .attr('stroke', d => linkColors[d.status])
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.max(1, d.weight * 3))
      .attr('marker-end', d => `url(#arrow-${d.status})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedLink(d);
        onLinkClick?.(d);
      })
      .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke-width', Math.max(2, d.weight * 4));
        
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        tooltip.html(`
          <strong>${d.type.toUpperCase()}</strong><br/>
          Latency: ${d.latency}ms<br/>
          Error Rate: ${d.errorRate}%<br/>
          Status: ${d.status}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('stroke-width', Math.max(1, d.weight * 3));
        d3.selectAll('.tooltip').remove();
      });

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(filteredData.nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(handleDrag as any);

    // Node circles
    node.append('circle')
      .attr('r', d => {
        // Size based on throughput
        const baseSize = 15;
        const maxSize = 30;
        const throughputFactor = Math.min(1, d.metrics.throughput / 1000);
        return baseSize + (maxSize - baseSize) * throughputFactor;
      })
      .attr('fill', d => nodeColors[d.type])
      .attr('stroke', d => statusColors[d.status])
      .attr('stroke-width', 3)
      .attr('opacity', 0.8)
      .on('click', (event, d) => {
        setSelectedNode(d);
        onNodeClick?.(d);
      })
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke-width', 5);
        
        // Show detailed tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '12px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        tooltip.html(`
          <strong>${d.name}</strong><br/>
          <em>${d.type} - ${d.status}</em><br/>
          <hr style="margin: 4px 0; border-color: #444;">
          Response Time: ${d.metrics.responseTime}ms<br/>
          Error Rate: ${d.metrics.errorRate}%<br/>
          Throughput: ${d.metrics.throughput}/min<br/>
          CPU: ${d.metrics.cpu}%<br/>
          Memory: ${d.metrics.memory}%
          ${d.version ? `<br/>Version: ${d.version}` : ''}
          ${d.environment ? `<br/>Env: ${d.environment}` : ''}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('opacity', 0.8).attr('stroke-width', 3);
        d3.selectAll('.tooltip').remove();
      });

    // Node labels
    node.append('text')
      .text(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .attr('pointer-events', 'none');

    // Show metrics on nodes if enabled
    if (showMetrics) {
      node.append('text')
        .text(d => `${d.metrics.responseTime}ms`)
        .attr('text-anchor', 'middle')
        .attr('dy', '1.8em')
        .attr('font-size', '9px')
        .attr('fill', '#ccc')
        .attr('pointer-events', 'none');
    }

    // Update simulation
    simulation.nodes(filteredData.nodes as any);
    simulation.force<d3.ForceLink<any, any>>('link')?.links(filteredData.links as any);
    
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    simulation.restart();

    return () => {
      simulation.stop();
      d3.selectAll('.tooltip').remove();
    };
  }, [filteredData, handleDrag, simulation, showMetrics, onNodeClick, onLinkClick]);

  // Auto-layout when enabled
  useEffect(() => {
    if (autoLayout && nodes.length > 0) {
      simulation.alpha(1).restart();
    }
  }, [autoLayout, nodes.length, simulation]);

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
          placeholder="Search services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
        />
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
        >
          <option value="all">All Types</option>
          <option value="service">Services</option>
          <option value="database">Databases</option>
          <option value="external">External</option>
          <option value="cache">Cache</option>
        </select>

        <button
          onClick={() => exportUtils.exportAsPNG()}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          PNG
        </button>
        
        <button
          onClick={() => exportUtils.exportAsPDF()}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          PDF
        </button>
        
        <button
          onClick={() => exportUtils.exportAsSVG()}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          SVG
        </button>
      </div>

      {/* Stats */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs">
        <div>Nodes: {filteredData.nodes.length}</div>
        <div>Links: {filteredData.links.length}</div>
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
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
              <span className="capitalize">{type}</span>
            </div>
          ))}
          
          <div className="font-semibold mt-3">Status</div>
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-3 h-3 border-2" style={{ borderColor: color }}></div>
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <motion.div
          className="absolute top-16 right-4 z-10 bg-black bg-opacity-90 rounded-lg p-4 text-white max-w-xs"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <button
            onClick={() => setSelectedNode(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            ×
          </button>
          <h3 className="font-bold text-lg mb-2">{selectedNode.name}</h3>
          <div className="space-y-1 text-sm">
            <div>Type: <span className="capitalize">{selectedNode.type}</span></div>
            <div>Status: <span className="capitalize">{selectedNode.status}</span></div>
            <div>Response Time: {selectedNode.metrics.responseTime}ms</div>
            <div>Error Rate: {selectedNode.metrics.errorRate}%</div>
            <div>Throughput: {selectedNode.metrics.throughput}/min</div>
            <div>CPU: {selectedNode.metrics.cpu}%</div>
            <div>Memory: {selectedNode.metrics.memory}%</div>
            {selectedNode.version && <div>Version: {selectedNode.version}</div>}
            {selectedNode.environment && <div>Environment: {selectedNode.environment}</div>}
          </div>
        </motion.div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs">
        <div>Click + drag to pan</div>
        <div>Scroll to zoom</div>
        <div>Click nodes/links for details</div>
      </div>
    </motion.div>
  );
}