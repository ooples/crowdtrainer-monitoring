'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from 'd3-sankey';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface FlowNode {
  id: string;
  name: string;
  category: string;
  value?: number;
  metadata?: Record<string, any>;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

interface SankeyData {
  nodes: FlowNode[];
  links: FlowLink[];
}

interface SankeyFlowProps {
  data: SankeyData;
  width?: number;
  height?: number;
  nodeWidth?: number;
  nodePadding?: number;
  onNodeClick?: (node: FlowNode) => void;
  onLinkClick?: (link: FlowLink) => void;
  showLabels?: boolean;
  showValues?: boolean;
  colorScheme?: 'category' | 'value' | 'flow';
  className?: string;
}

// Color schemes
const categoryColors = d3.scaleOrdinal(d3.schemeSet3);
const valueColors = d3.scaleSequential(d3.interpolateViridis);
const flowColors = d3.scaleSequential(d3.interpolatePlasma);

// Format numbers for display
const formatNumber = d3.format(',.0f');
const formatPercent = d3.format('.1%');

export default function SankeyFlow({
  data,
  width = 1000,
  height = 600,
  nodeWidth = 15,
  nodePadding = 10,
  onNodeClick,
  onLinkClick,
  showLabels = true,
  showValues = true,
  colorScheme = 'category',
  className = ''
}: SankeyFlowProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<FlowLink | null>(null);
  const [hoveredElement, setHoveredElement] = useState<{ type: 'node' | 'link'; data: any } | null>(null);

  // Process Sankey data
  const sankeyData = useMemo(() => {
    const nodeMap = new Map(data.nodes.map(node => [node.id, { ...node }]));
    const nodes = Array.from(nodeMap.values());
    
    const links = data.links.map(link => ({
      ...link,
      source: link.source,
      target: link.target
    }));

    // Calculate total values for color scaling
    const maxValue = Math.max(...nodes.map(n => n.value || 0));
    const maxLinkValue = Math.max(...links.map(l => l.value));

    // Set up color scales
    valueColors.domain([0, maxValue]);
    flowColors.domain([0, maxLinkValue]);

    return { nodes, links, maxValue, maxLinkValue };
  }, [data]);

  // Create Sankey layout
  const sankeyLayout = useMemo(() => {
    const layout = sankey<FlowNode, FlowLink>()
      .nodeWidth(nodeWidth)
      .nodePadding(nodePadding)
      .extent([[1, 1], [width - 1, height - 6]]);

    const { nodes, links } = sankeyData;
    const graph = layout({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d }))
    });

    return graph;
  }, [sankeyData, width, height, nodeWidth, nodePadding]);

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
          saveAs(blob, `sankey-flow-${Date.now()}.png`);
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
      pdf.save(`sankey-flow-${Date.now()}.pdf`);
    },

    exportAsSVG(): void {
      if (!svgRef.current) return;
      
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(svgBlob, `sankey-flow-${Date.now()}.svg`);
    }
  };

  // Handle interactions
  const handleNodeClick = useCallback((node: any) => {
    const originalNode = data.nodes.find(n => n.id === node.id);
    if (originalNode) {
      setSelectedNode(originalNode);
      onNodeClick?.(originalNode);
    }
  }, [data.nodes, onNodeClick]);

  const handleLinkClick = useCallback((link: any) => {
    const originalLink = data.links.find(l => 
      l.source === link.source.id && l.target === link.target.id
    );
    if (originalLink) {
      setSelectedLink(originalLink);
      onLinkClick?.(originalLink);
    }
  }, [data.links, onLinkClick]);

  const handleElementHover = useCallback((type: 'node' | 'link', element: any) => {
    setHoveredElement({ type, data: element });
  }, []);

  // Get color for node
  const getNodeColor = useCallback((node: any) => {
    switch (colorScheme) {
      case 'value':
        return valueColors(node.value || 0);
      case 'flow':
        const totalFlow = (node.sourceLinks?.reduce((sum: number, link: any) => sum + link.value, 0) || 0) +
                         (node.targetLinks?.reduce((sum: number, link: any) => sum + link.value, 0) || 0);
        return flowColors(totalFlow);
      case 'category':
      default:
        const originalNode = data.nodes.find(n => n.id === node.id);
        return categoryColors(originalNode?.category || 'default');
    }
  }, [colorScheme, data.nodes]);

  // Get color for link
  const getLinkColor = useCallback((link: any) => {
    switch (colorScheme) {
      case 'value':
      case 'flow':
        return flowColors(link.value);
      case 'category':
      default:
        const sourceNode = data.nodes.find(n => n.id === link.source.id);
        return categoryColors(sourceNode?.category || 'default');
    }
  }, [colorScheme, data.nodes]);

  // Render Sankey diagram
  useEffect(() => {
    if (!svgRef.current || !sankeyLayout) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create main group
    const g = svg.append('g');

    // Add links
    const links = g.append('g')
      .selectAll('.link')
      .data(sankeyLayout.links)
      .join('path')
      .attr('class', 'link')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => getLinkColor(d))
      .attr('stroke-width', d => Math.max(1, d.width || 0))
      .attr('stroke-opacity', 0.7)
      .attr('fill', 'none')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        handleLinkClick(d);
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', Math.max(2, (d.width || 0) * 1.2));

        handleElementHover('link', d);

        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'sankey-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '12px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        const sourceNode = data.nodes.find(n => n.id === d.source.id);
        const targetNode = data.nodes.find(n => n.id === d.target.id);
        const originalLink = data.links.find(l => 
          l.source === d.source.id && l.target === d.target.id
        );

        tooltip.html(`
          <div><strong>${sourceNode?.name || d.source.id} → ${targetNode?.name || d.target.id}</strong></div>
          <div>Flow: ${formatNumber(d.value)}</div>
          ${originalLink?.label ? `<div>Type: ${originalLink.label}</div>` : ''}
          ${originalLink?.metadata ? 
            Object.entries(originalLink.metadata)
              .map(([key, value]) => `<div>${key}: ${value}</div>`)
              .join('') 
            : ''
          }
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 0.7)
          .attr('stroke-width', Math.max(1, d.width || 0));

        setHoveredElement(null);
        d3.selectAll('.sankey-tooltip').remove();
      });

    // Add nodes
    const nodes = g.append('g')
      .selectAll('.node')
      .data(sankeyLayout.nodes)
      .join('rect')
      .attr('class', 'node')
      .attr('x', d => d.x0 || 0)
      .attr('y', d => d.y0 || 0)
      .attr('width', d => (d.x1 || 0) - (d.x0 || 0))
      .attr('height', d => (d.y1 || 0) - (d.y0 || 0))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        handleNodeClick(d);
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke-width', 2);

        handleElementHover('node', d);

        // Highlight connected links
        links
          .attr('stroke-opacity', link => 
            link.source === d || link.target === d ? 1 : 0.3
          );

        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'sankey-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '12px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000');

        const originalNode = data.nodes.find(n => n.id === d.id);
        const totalInflow = d.targetLinks?.reduce((sum, link) => sum + link.value, 0) || 0;
        const totalOutflow = d.sourceLinks?.reduce((sum, link) => sum + link.value, 0) || 0;

        tooltip.html(`
          <div><strong>${originalNode?.name || d.id}</strong></div>
          <div>Category: ${originalNode?.category || 'N/A'}</div>
          <div>Total Inflow: ${formatNumber(totalInflow)}</div>
          <div>Total Outflow: ${formatNumber(totalOutflow)}</div>
          ${originalNode?.value ? `<div>Value: ${formatNumber(originalNode.value)}</div>` : ''}
          ${originalNode?.metadata ? 
            Object.entries(originalNode.metadata)
              .map(([key, value]) => `<div>${key}: ${value}</div>`)
              .join('') 
            : ''
          }
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('opacity', 0.8)
          .attr('stroke-width', 1);

        setHoveredElement(null);
        
        // Reset link opacity
        links.attr('stroke-opacity', 0.7);
        
        d3.selectAll('.sankey-tooltip').remove();
      });

    // Add node labels
    if (showLabels) {
      g.append('g')
        .selectAll('.label')
        .data(sankeyLayout.nodes)
        .join('text')
        .attr('class', 'label')
        .attr('x', d => {
          const nodeWidth = (d.x1 || 0) - (d.x0 || 0);
          return (d.x0 || 0) + (nodeWidth > 50 ? nodeWidth / 2 : -5);
        })
        .attr('y', d => ((d.y0 || 0) + (d.y1 || 0)) / 2)
        .attr('text-anchor', d => {
          const nodeWidth = (d.x1 || 0) - (d.x0 || 0);
          return nodeWidth > 50 ? 'middle' : 'end';
        })
        .attr('dy', '.35em')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .attr('pointer-events', 'none')
        .text(d => {
          const originalNode = data.nodes.find(n => n.id === d.id);
          const name = originalNode?.name || d.id;
          return name.length > 15 ? name.substring(0, 15) + '...' : name;
        });
    }

    // Add node values
    if (showValues) {
      g.append('g')
        .selectAll('.value')
        .data(sankeyLayout.nodes)
        .join('text')
        .attr('class', 'value')
        .attr('x', d => {
          const nodeWidth = (d.x1 || 0) - (d.x0 || 0);
          return (d.x0 || 0) + (nodeWidth > 50 ? nodeWidth / 2 : -5);
        })
        .attr('y', d => ((d.y0 || 0) + (d.y1 || 0)) / 2 + (showLabels ? 15 : 0))
        .attr('text-anchor', d => {
          const nodeWidth = (d.x1 || 0) - (d.x0 || 0);
          return nodeWidth > 50 ? 'middle' : 'end';
        })
        .attr('dy', '.35em')
        .attr('font-size', '9px')
        .attr('fill', '#cccccc')
        .attr('pointer-events', 'none')
        .text(d => {
          const totalValue = (d.sourceLinks?.reduce((sum, link) => sum + link.value, 0) || 0) +
                            (d.targetLinks?.reduce((sum, link) => sum + link.value, 0) || 0);
          return formatNumber(totalValue);
        });
    }

  }, [sankeyLayout, showLabels, showValues, data, getLinkColor, getNodeColor, 
      handleNodeClick, handleLinkClick, handleElementHover]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalFlow = sankeyData.links.reduce((sum, link) => sum + link.value, 0);
    const avgNodeValue = sankeyData.nodes.reduce((sum, node) => sum + (node.value || 0), 0) / sankeyData.nodes.length;
    const maxFlow = Math.max(...sankeyData.links.map(l => l.value));
    const categories = [...new Set(sankeyData.nodes.map(n => n.category))];

    return {
      totalFlow: formatNumber(totalFlow),
      avgNodeValue: formatNumber(avgNodeValue),
      maxFlow: formatNumber(maxFlow),
      nodeCount: sankeyData.nodes.length,
      linkCount: sankeyData.links.length,
      categoryCount: categories.length
    };
  }, [sankeyData]);

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
        <select
          value={colorScheme}
          onChange={(e) => setColorScheme(e.target.value as any)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
        >
          <option value="category">By Category</option>
          <option value="value">By Value</option>
          <option value="flow">By Flow</option>
        </select>

        <label className="flex items-center gap-1 text-white text-sm">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          Labels
        </label>

        <label className="flex items-center gap-1 text-white text-sm">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => setShowValues(e.target.checked)}
          />
          Values
        </label>

        <button
          onClick={() => exportUtils.exportAsPNG()}
          className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          PNG
        </button>
        
        <button
          onClick={() => exportUtils.exportAsPDF()}
          className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          PDF
        </button>
        
        <button
          onClick={() => exportUtils.exportAsSVG()}
          className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          SVG
        </button>
      </div>

      {/* Statistics */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs space-y-1">
        <div>Nodes: {statistics.nodeCount}</div>
        <div>Links: {statistics.linkCount}</div>
        <div>Categories: {statistics.categoryCount}</div>
        <div>Total Flow: {statistics.totalFlow}</div>
        <div>Max Flow: {statistics.maxFlow}</div>
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
        <div className="text-white text-sm space-y-1">
          <div className="font-semibold">Categories</div>
          {[...new Set(data.nodes.map(n => n.category))].map(category => (
            <div key={category} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: categoryColors(category) }}
              ></div>
              <span className="capitalize">{category}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Element Details */}
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
          <h3 className="font-bold text-sm mb-2">Node Details</h3>
          <div className="space-y-1 text-xs">
            <div><strong>Name:</strong> {selectedNode.name}</div>
            <div><strong>Category:</strong> {selectedNode.category}</div>
            {selectedNode.value && <div><strong>Value:</strong> {formatNumber(selectedNode.value)}</div>}
            {selectedNode.metadata && Object.entries(selectedNode.metadata).map(([key, value]) => (
              <div key={key}><strong>{key}:</strong> {String(value)}</div>
            ))}
          </div>
        </motion.div>
      )}

      {selectedLink && (
        <motion.div
          className="absolute bottom-4 right-4 z-10 bg-black bg-opacity-90 rounded-lg p-4 text-white max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setSelectedLink(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            ×
          </button>
          <h3 className="font-bold text-sm mb-2">Flow Details</h3>
          <div className="space-y-1 text-xs">
            <div><strong>From:</strong> {data.nodes.find(n => n.id === selectedLink.source)?.name}</div>
            <div><strong>To:</strong> {data.nodes.find(n => n.id === selectedLink.target)?.name}</div>
            <div><strong>Value:</strong> {formatNumber(selectedLink.value)}</div>
            {selectedLink.label && <div><strong>Type:</strong> {selectedLink.label}</div>}
            {selectedLink.metadata && Object.entries(selectedLink.metadata).map(([key, value]) => (
              <div key={key}><strong>{key}:</strong> {String(value)}</div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs">
        <div>Click nodes/flows for details</div>
        <div>Hover for connections</div>
      </div>
    </motion.div>
  );
}