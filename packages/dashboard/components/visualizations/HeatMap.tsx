'use client';

import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface HeatMapDataPoint {
  x: number | string;
  y: number | string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface HeatMapProps {
  data: HeatMapDataPoint[];
  width?: number;
  height?: number;
  colorScale?: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'turbo' | 'rdylbu' | 'spectral';
  showValues?: boolean;
  showGrid?: boolean;
  onCellClick?: (point: HeatMapDataPoint) => void;
  onCellHover?: (point: HeatMapDataPoint | null) => void;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  className?: string;
}

// Color scale configurations
const colorScales = {
  viridis: d3.scaleSequential(d3.interpolateViridis),
  plasma: d3.scaleSequential(d3.interpolatePlasma),
  inferno: d3.scaleSequential(d3.interpolateInferno),
  magma: d3.scaleSequential(d3.interpolateMagma),
  turbo: d3.scaleSequential(d3.interpolateTurbo),
  rdylbu: d3.scaleSequential(d3.interpolateRdYlBu),
  spectral: d3.scaleSequential(d3.interpolateSpectral)
};

// Time-based aggregation for performance patterns
const aggregateByTime = (data: HeatMapDataPoint[], interval: 'minute' | 'hour' | 'day') => {
  const intervalMs = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000
  };

  const grouped = d3.group(data, d => {
    const time = new Date(d.timestamp);
    const rounded = Math.floor(time.getTime() / intervalMs[interval]) * intervalMs[interval];
    return rounded;
  });

  return Array.from(grouped.entries()).map(([timestamp, points]) => ({
    x: new Date(timestamp).toISOString(),
    y: 'aggregated',
    value: d3.mean(points, d => d.value) || 0,
    timestamp,
    metadata: { count: points.length, points }
  }));
};

export default function HeatMap({
  data,
  width = 800,
  height = 500,
  colorScale = 'viridis',
  showValues = false,
  showGrid = true,
  onCellClick,
  onCellHover,
  title,
  xAxisLabel,
  yAxisLabel,
  className = ''
}: HeatMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCell, setSelectedCell] = useState<HeatMapDataPoint | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HeatMapDataPoint | null>(null);
  const [viewMode, setViewMode] = useState<'normal' | 'time-patterns' | 'error-analysis'>('normal');
  const [timeInterval, setTimeInterval] = useState<'minute' | 'hour' | 'day'>('hour');

  // Process data based on view mode
  const processedData = useMemo(() => {
    let processed = [...data];

    switch (viewMode) {
      case 'time-patterns':
        processed = aggregateByTime(data, timeInterval);
        break;
      case 'error-analysis':
        processed = data.filter(d => d.metadata?.isError || d.value > 0);
        break;
      default:
        break;
    }

    return processed;
  }, [data, viewMode, timeInterval]);

  // Extract unique x and y values
  const { xValues, yValues } = useMemo(() => {
    const xSet = new Set(processedData.map(d => String(d.x)));
    const ySet = new Set(processedData.map(d => String(d.y)));
    
    return {
      xValues: Array.from(xSet).sort((a, b) => {
        // Try to sort as dates first, then as numbers, finally as strings
        const aDate = new Date(a);
        const bDate = new Date(b);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return aDate.getTime() - bDate.getTime();
        }
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.localeCompare(b);
      }),
      yValues: Array.from(ySet).sort()
    };
  }, [processedData]);

  // Create value matrix
  const valueMatrix = useMemo(() => {
    const matrix = new Map<string, HeatMapDataPoint>();
    processedData.forEach(point => {
      const key = `${point.x}-${point.y}`;
      matrix.set(key, point);
    });
    return matrix;
  }, [processedData]);

  // Calculate scales and dimensions
  const margin = { top: 60, right: 100, bottom: 80, left: 120 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const cellWidth = innerWidth / xValues.length;
  const cellHeight = innerHeight / yValues.length;

  // Value extent for color scale
  const valueExtent = useMemo(() => {
    const values = processedData.map(d => d.value).filter(v => !isNaN(v));
    return d3.extent(values) as [number, number];
  }, [processedData]);

  const colorScaleFn = useMemo(() => {
    return colorScales[colorScale].domain(valueExtent);
  }, [colorScale, valueExtent]);

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
          saveAs(blob, `heatmap-${Date.now()}.png`);
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
      pdf.save(`heatmap-${Date.now()}.pdf`);
    },

    exportAsSVG(): void {
      if (!svgRef.current) return;
      
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(svgBlob, `heatmap-${Date.now()}.svg`);
    }
  };

  // Handle cell interactions
  const handleCellClick = useCallback((point: HeatMapDataPoint) => {
    setSelectedCell(point);
    onCellClick?.(point);
  }, [onCellClick]);

  const handleCellHover = useCallback((point: HeatMapDataPoint | null) => {
    setHoveredCell(point);
    onCellHover?.(point);
  }, [onCellHover]);

  // Render heatmap
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Background
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#1f2937')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1);

    // Grid lines
    if (showGrid) {
      // Vertical lines
      g.selectAll('.grid-v')
        .data(xValues)
        .join('line')
        .attr('class', 'grid-v')
        .attr('x1', (_, i) => (i + 1) * cellWidth)
        .attr('y1', 0)
        .attr('x2', (_, i) => (i + 1) * cellWidth)
        .attr('y2', innerHeight)
        .attr('stroke', '#374151')
        .attr('stroke-width', 0.5);

      // Horizontal lines
      g.selectAll('.grid-h')
        .data(yValues)
        .join('line')
        .attr('class', 'grid-h')
        .attr('x1', 0)
        .attr('y1', (_, i) => (i + 1) * cellHeight)
        .attr('x2', innerWidth)
        .attr('y2', (_, i) => (i + 1) * cellHeight)
        .attr('stroke', '#374151')
        .attr('stroke-width', 0.5);
    }

    // Heat cells
    const cells = g.selectAll('.cell')
      .data(yValues.flatMap((y, yi) => 
        xValues.map((x, xi) => ({
          x,
          y,
          xi,
          yi,
          point: valueMatrix.get(`${x}-${y}`)
        }))
      ))
      .join('rect')
      .attr('class', 'cell')
      .attr('x', d => d.xi * cellWidth)
      .attr('y', d => d.yi * cellHeight)
      .attr('width', cellWidth - 1)
      .attr('height', cellHeight - 1)
      .attr('fill', d => {
        if (!d.point || isNaN(d.point.value)) return '#374151';
        return colorScaleFn(d.point.value);
      })
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.point) {
          handleCellClick(d.point);
        }
      })
      .on('mouseover', function(event, d) {
        if (d.point) {
          handleCellHover(d.point);
          
          // Highlight cell
          d3.select(this)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2);

          // Show tooltip
          const tooltip = d3.select('body').append('div')
            .attr('class', 'heatmap-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.9)')
            .style('color', 'white')
            .style('padding', '12px')
            .style('border-radius', '8px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('max-width', '300px');

          tooltip.html(`
            <div><strong>X:</strong> ${d.point.x}</div>
            <div><strong>Y:</strong> ${d.point.y}</div>
            <div><strong>Value:</strong> ${d.point.value.toFixed(2)}</div>
            <div><strong>Time:</strong> ${new Date(d.point.timestamp).toLocaleString()}</div>
            ${d.point.metadata ? 
              Object.entries(d.point.metadata)
                .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
                .join('') 
              : ''
            }
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
        }
      })
      .on('mouseout', function(event, d) {
        if (d.point) {
          handleCellHover(null);
          
          // Remove highlight
          d3.select(this)
            .attr('stroke', '#1f2937')
            .attr('stroke-width', 1);
        }
        
        d3.selectAll('.heatmap-tooltip').remove();
      });

    // Cell values
    if (showValues) {
      g.selectAll('.cell-text')
        .data(yValues.flatMap((y, yi) => 
          xValues.map((x, xi) => ({
            x,
            y,
            xi,
            yi,
            point: valueMatrix.get(`${x}-${y}`)
          }))
        ))
        .join('text')
        .attr('class', 'cell-text')
        .attr('x', d => d.xi * cellWidth + cellWidth / 2)
        .attr('y', d => d.yi * cellHeight + cellHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('font-size', Math.min(10, cellWidth / 5, cellHeight / 3))
        .attr('fill', d => {
          if (!d.point || isNaN(d.point.value)) return '#9ca3af';
          // Choose text color based on background brightness
          const bgColor = d3.color(colorScaleFn(d.point.value));
          if (!bgColor) return '#ffffff';
          const brightness = (bgColor.r * 299 + bgColor.g * 587 + bgColor.b * 114) / 1000;
          return brightness > 128 ? '#000000' : '#ffffff';
        })
        .attr('pointer-events', 'none')
        .text(d => d.point && !isNaN(d.point.value) ? d.point.value.toFixed(1) : '');
    }

    // X-axis
    const xAxis = g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`);

    xAxis.selectAll('.x-tick')
      .data(xValues)
      .join('text')
      .attr('class', 'x-tick')
      .attr('x', (_, i) => i * cellWidth + cellWidth / 2)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#d1d5db')
      .text(d => {
        // Truncate long labels
        const str = String(d);
        return str.length > 10 ? str.substring(0, 10) + '...' : str;
      })
      .attr('transform', (_, i) => 
        xValues.length > 20 ? `rotate(-45, ${i * cellWidth + cellWidth / 2}, 15)` : ''
      );

    // Y-axis
    const yAxis = g.append('g');

    yAxis.selectAll('.y-tick')
      .data(yValues)
      .join('text')
      .attr('class', 'y-tick')
      .attr('x', -10)
      .attr('y', (_, i) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dy', '.35em')
      .attr('font-size', '11px')
      .attr('fill', '#d1d5db')
      .text(d => {
        const str = String(d);
        return str.length > 15 ? str.substring(0, 15) + '...' : str;
      });

    // Axis labels
    if (xAxisLabel) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .text(xAxisLabel);
    }

    if (yAxisLabel) {
      svg.append('text')
        .attr('transform', `rotate(-90)`)
        .attr('x', -height / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .text(yAxisLabel);
    }

    // Title
    if (title) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('font-weight', 'bold')
        .attr('fill', '#ffffff')
        .text(title);
    }

    // Color scale legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = width - margin.right + 20;
    const legendY = margin.top;

    const legendScale = d3.scaleLinear()
      .domain(valueExtent)
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format('.1f'));

    // Legend gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%');

    gradient.selectAll('stop')
      .data(d3.range(0, 1.01, 0.01))
      .join('stop')
      .attr('offset', d => `${d * 100}%`)
      .attr('stop-color', d => colorScaleFn(valueExtent[0] + d * (valueExtent[1] - valueExtent[0])));

    svg.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)');

    svg.append('g')
      .attr('transform', `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px');

    svg.append('text')
      .attr('x', legendX + legendWidth / 2)
      .attr('y', legendY - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#ffffff')
      .text('Value');

  }, [processedData, xValues, yValues, valueMatrix, colorScaleFn, showValues, showGrid, 
      cellWidth, cellHeight, innerWidth, innerHeight, margin, title, xAxisLabel, yAxisLabel]);

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
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as any)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
        >
          <option value="normal">Normal View</option>
          <option value="time-patterns">Time Patterns</option>
          <option value="error-analysis">Error Analysis</option>
        </select>

        {viewMode === 'time-patterns' && (
          <select
            value={timeInterval}
            onChange={(e) => setTimeInterval(e.target.value as any)}
            className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
          >
            <option value="minute">By Minute</option>
            <option value="hour">By Hour</option>
            <option value="day">By Day</option>
          </select>
        )}

        <select
          value={colorScale}
          onChange={(e) => setColorScale(e.target.value as any)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
        >
          <option value="viridis">Viridis</option>
          <option value="plasma">Plasma</option>
          <option value="inferno">Inferno</option>
          <option value="magma">Magma</option>
          <option value="turbo">Turbo</option>
          <option value="rdylbu">RdYlBu</option>
          <option value="spectral">Spectral</option>
        </select>

        <label className="flex items-center gap-1 text-white text-sm">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => setShowValues(e.target.checked)}
          />
          Values
        </label>

        <label className="flex items-center gap-1 text-white text-sm">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          Grid
        </label>

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

      {/* Statistics */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs">
        <div>Data points: {processedData.length}</div>
        <div>Min: {valueExtent[0]?.toFixed(2)}</div>
        <div>Max: {valueExtent[1]?.toFixed(2)}</div>
        <div>Cells: {xValues.length} × {yValues.length}</div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-crosshair"
      />

      {/* Selected Cell Details */}
      {selectedCell && (
        <motion.div
          className="absolute bottom-4 right-4 z-10 bg-black bg-opacity-90 rounded-lg p-4 text-white max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setSelectedCell(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            ×
          </button>
          <h3 className="font-bold text-sm mb-2">Selected Cell</h3>
          <div className="space-y-1 text-xs">
            <div>X: {selectedCell.x}</div>
            <div>Y: {selectedCell.y}</div>
            <div>Value: {selectedCell.value.toFixed(2)}</div>
            <div>Time: {new Date(selectedCell.timestamp).toLocaleString()}</div>
            {selectedCell.metadata && Object.entries(selectedCell.metadata).map(([key, value]) => (
              <div key={key}>{key}: {String(value)}</div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}