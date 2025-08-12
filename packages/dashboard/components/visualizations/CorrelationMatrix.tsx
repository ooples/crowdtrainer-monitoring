'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface MetricData {
  name: string;
  values: number[];
  timestamps: number[];
  unit?: string;
  description?: string;
}

interface CorrelationResult {
  metric1: string;
  metric2: string;
  coefficient: number;
  pValue: number;
  strength: 'very-weak' | 'weak' | 'moderate' | 'strong' | 'very-strong';
  direction: 'positive' | 'negative';
}

interface CorrelationMatrixProps {
  metrics: MetricData[];
  width?: number;
  height?: number;
  showValues?: boolean;
  threshold?: number;
  onCorrelationClick?: (correlation: CorrelationResult) => void;
  autoDiscover?: boolean;
  className?: string;
}

// Pearson correlation coefficient calculation
const calculateCorrelation = (x: number[], y: number[]): { coefficient: number; pValue: number } => {
  const n = Math.min(x.length, y.length);
  if (n < 3) return { coefficient: 0, pValue: 1 };

  // Align arrays to same length
  const xAligned = x.slice(0, n);
  const yAligned = y.slice(0, n);

  // Calculate means
  const meanX = d3.mean(xAligned) || 0;
  const meanY = d3.mean(yAligned) || 0;

  // Calculate correlation coefficient
  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;

  for (let i = 0; i < n; i++) {
    const deltaX = xAligned[i] - meanX;
    const deltaY = yAligned[i] - meanY;
    
    numerator += deltaX * deltaY;
    sumXSquared += deltaX * deltaX;
    sumYSquared += deltaY * deltaY;
  }

  const denominator = Math.sqrt(sumXSquared * sumYSquared);
  const coefficient = denominator === 0 ? 0 : numerator / denominator;

  // Simple p-value approximation using t-distribution
  const tStat = coefficient * Math.sqrt((n - 2) / (1 - coefficient * coefficient));
  const pValue = 2 * (1 - 0.95); // Simplified - in production use proper t-distribution

  return { coefficient, pValue };
};

// Determine correlation strength
const getCorrelationStrength = (coefficient: number): 'very-weak' | 'weak' | 'moderate' | 'strong' | 'very-strong' => {
  const abs = Math.abs(coefficient);
  if (abs < 0.2) return 'very-weak';
  if (abs < 0.4) return 'weak';
  if (abs < 0.6) return 'moderate';
  if (abs < 0.8) return 'strong';
  return 'very-strong';
};

// Auto-discover interesting correlations
const autoDiscoverCorrelations = (
  correlations: CorrelationResult[],
  threshold: number = 0.5
): CorrelationResult[] => {
  return correlations
    .filter(c => Math.abs(c.coefficient) >= threshold && c.pValue < 0.05)
    .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
};

export default function CorrelationMatrix({
  metrics,
  width = 800,
  height = 800,
  showValues = true,
  threshold = 0.3,
  onCorrelationClick,
  autoDiscover = true,
  className = ''
}: CorrelationMatrixProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedCorrelation, setSelectedCorrelation] = useState<CorrelationResult | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CorrelationResult | null>(null);
  const [showOnlySignificant, setShowOnlySignificant] = useState(false);

  // Calculate correlation matrix
  const correlationMatrix = useMemo(() => {
    const matrix: CorrelationResult[] = [];
    
    for (let i = 0; i < metrics.length; i++) {
      for (let j = 0; j < metrics.length; j++) {
        const metric1 = metrics[i];
        const metric2 = metrics[j];
        
        if (i === j) {
          // Self-correlation is always 1
          matrix.push({
            metric1: metric1.name,
            metric2: metric2.name,
            coefficient: 1,
            pValue: 0,
            strength: 'very-strong',
            direction: 'positive'
          });
        } else {
          const { coefficient, pValue } = calculateCorrelation(metric1.values, metric2.values);
          matrix.push({
            metric1: metric1.name,
            metric2: metric2.name,
            coefficient,
            pValue,
            strength: getCorrelationStrength(coefficient),
            direction: coefficient >= 0 ? 'positive' : 'negative'
          });
        }
      }
    }
    
    return matrix;
  }, [metrics]);

  // Auto-discovered interesting correlations
  const interestingCorrelations = useMemo(() => {
    if (!autoDiscover) return [];
    return autoDiscoverCorrelations(
      correlationMatrix.filter(c => c.metric1 !== c.metric2),
      threshold
    );
  }, [correlationMatrix, threshold, autoDiscover]);

  // Filter matrix based on significance
  const filteredMatrix = useMemo(() => {
    if (!showOnlySignificant) return correlationMatrix;
    return correlationMatrix.filter(c => 
      c.metric1 === c.metric2 || Math.abs(c.coefficient) >= threshold
    );
  }, [correlationMatrix, showOnlySignificant, threshold]);

  // Dimensions and scales
  const margin = { top: 100, right: 100, bottom: 100, left: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const cellSize = Math.min(innerWidth, innerHeight) / metrics.length;

  // Color scale for correlation coefficients
  const colorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateRdBu)
      .domain([1, -1]); // Reverse domain for red-blue scale
  }, []);

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
          saveAs(blob, `correlation-matrix-${Date.now()}.png`);
        }
      });
    },

    async exportAsPDF(): Promise<void> {
      if (!containerRef.current) return;
      
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#1f2937',
        scale: 2
      });
      
      const pdf = new jsPDF('square');
      const imgData = canvas.toDataURL('image/png');
      const size = 200;
      
      pdf.addImage(imgData, 'PNG', 5, 5, size, size);
      pdf.save(`correlation-matrix-${Date.now()}.pdf`);
    },

    exportAsSVG(): void {
      if (!svgRef.current) return;
      
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(svgBlob, `correlation-matrix-${Date.now()}.svg`);
    },

    exportCorrelationData(): void {
      const csvData = [
        ['Metric 1', 'Metric 2', 'Correlation', 'P-Value', 'Strength', 'Direction'],
        ...interestingCorrelations.map(c => [
          c.metric1,
          c.metric2,
          c.coefficient.toFixed(4),
          c.pValue.toFixed(4),
          c.strength,
          c.direction
        ])
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      saveAs(blob, `correlations-${Date.now()}.csv`);
    }
  };

  // Handle cell interactions
  const handleCellClick = useCallback((correlation: CorrelationResult) => {
    setSelectedCorrelation(correlation);
    onCorrelationClick?.(correlation);
  }, [onCorrelationClick]);

  const handleCellHover = useCallback((correlation: CorrelationResult | null) => {
    setHoveredCell(correlation);
  }, []);

  // Render correlation matrix
  useEffect(() => {
    if (!svgRef.current || metrics.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create matrix grid
    const matrixData = metrics.flatMap((metric1, i) => 
      metrics.map((metric2, j) => {
        const correlation = filteredMatrix.find(c => 
          c.metric1 === metric1.name && c.metric2 === metric2.name
        );
        return {
          i,
          j,
          metric1: metric1.name,
          metric2: metric2.name,
          correlation: correlation || {
            metric1: metric1.name,
            metric2: metric2.name,
            coefficient: 0,
            pValue: 1,
            strength: 'very-weak' as const,
            direction: 'positive' as const
          }
        };
      })
    );

    // Draw cells
    const cells = g.selectAll('.cell')
      .data(matrixData)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', d => d.j * cellSize)
      .attr('y', d => d.i * cellSize)
      .attr('width', cellSize - 1)
      .attr('height', cellSize - 1)
      .attr('fill', d => {
        if (showOnlySignificant && Math.abs(d.correlation.coefficient) < threshold && d.i !== d.j) {
          return '#374151';
        }
        return colorScale(d.correlation.coefficient);
      })
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        handleCellClick(d.correlation);
      })
      .on('mouseover', function(event, d) {
        handleCellHover(d.correlation);
        
        // Highlight cell
        d3.select(this)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2);

        // Highlight row and column
        g.selectAll('.cell')
          .filter((cell: any) => cell.i === d.i || cell.j === d.j)
          .attr('opacity', 1);
        
        g.selectAll('.cell')
          .filter((cell: any) => cell.i !== d.i && cell.j !== d.j)
          .attr('opacity', 0.5);

        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'correlation-tooltip')
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
          <div><strong>${d.correlation.metric1}</strong> vs <strong>${d.correlation.metric2}</strong></div>
          <div>Correlation: <span style="font-weight: bold; color: ${d.correlation.coefficient > 0 ? '#10b981' : '#ef4444'}">${d.correlation.coefficient.toFixed(3)}</span></div>
          <div>Strength: ${d.correlation.strength.replace('-', ' ').toUpperCase()}</div>
          <div>Direction: ${d.correlation.direction.toUpperCase()}</div>
          <div>P-value: ${d.correlation.pValue.toFixed(4)}</div>
          ${d.correlation.pValue < 0.05 ? '<div style="color: #10b981;">Statistically Significant ✓</div>' : '<div style="color: #f59e0b;">Not Significant</div>'}
        `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        handleCellHover(null);
        
        // Remove highlights
        d3.select(this)
          .attr('stroke', '#1f2937')
          .attr('stroke-width', 1);

        g.selectAll('.cell').attr('opacity', 1);
        
        d3.selectAll('.correlation-tooltip').remove();
      });

    // Add correlation values
    if (showValues) {
      g.selectAll('.cell-text')
        .data(matrixData)
        .join('text')
        .attr('class', 'cell-text')
        .attr('x', d => d.j * cellSize + cellSize / 2)
        .attr('y', d => d.i * cellSize + cellSize / 2)
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('font-size', Math.min(10, cellSize / 4))
        .attr('font-weight', 'bold')
        .attr('fill', d => {
          const bgColor = d3.color(colorScale(d.correlation.coefficient));
          if (!bgColor) return '#ffffff';
          const brightness = (bgColor.r * 299 + bgColor.g * 587 + bgColor.b * 114) / 1000;
          return brightness > 128 ? '#000000' : '#ffffff';
        })
        .attr('pointer-events', 'none')
        .text(d => {
          if (showOnlySignificant && Math.abs(d.correlation.coefficient) < threshold && d.i !== d.j) {
            return '';
          }
          return d.correlation.coefficient.toFixed(2);
        });
    }

    // Add metric labels
    const labelFontSize = Math.min(12, cellSize / 2);

    // X-axis labels
    g.selectAll('.x-label')
      .data(metrics)
      .join('text')
      .attr('class', 'x-label')
      .attr('x', (_, i) => i * cellSize + cellSize / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', labelFontSize)
      .attr('fill', '#ffffff')
      .attr('font-weight', 'bold')
      .text(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name)
      .attr('transform', (_, i) => 
        `rotate(-45, ${i * cellSize + cellSize / 2}, -10)`
      );

    // Y-axis labels
    g.selectAll('.y-label')
      .data(metrics)
      .join('text')
      .attr('class', 'y-label')
      .attr('x', -10)
      .attr('y', (_, i) => i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('dy', '.35em')
      .attr('font-size', labelFontSize)
      .attr('fill', '#ffffff')
      .attr('font-weight', 'bold')
      .text(d => d.name.length > 20 ? d.name.substring(0, 20) + '...' : d.name);

    // Color scale legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendX = margin.left;
    const legendY = height - margin.bottom + 40;

    const legendScale = d3.scaleLinear()
      .domain([-1, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format('.1f'));

    // Legend gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'correlation-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%');

    gradient.selectAll('stop')
      .data(d3.range(-1, 1.01, 0.1))
      .join('stop')
      .attr('offset', d => `${((d + 1) / 2) * 100}%`)
      .attr('stop-color', d => colorScale(d));

    svg.append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#correlation-gradient)');

    svg.append('g')
      .attr('transform', `translate(${legendX}, ${legendY + legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px');

    // Legend labels
    svg.append('text')
      .attr('x', legendX)
      .attr('y', legendY - 5)
      .attr('font-size', '10px')
      .attr('fill', '#ef4444')
      .attr('font-weight', 'bold')
      .text('Strong Negative');

    svg.append('text')
      .attr('x', legendX + legendWidth)
      .attr('y', legendY - 5)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('fill', '#10b981')
      .attr('font-weight', 'bold')
      .text('Strong Positive');

  }, [metrics, filteredMatrix, cellSize, colorScale, showValues, showOnlySignificant, 
      threshold, handleCellClick, handleCellHover]);

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
        <label className="flex items-center gap-1 text-white text-sm">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => setShowValues(e.target.checked)}
          />
          Show Values
        </label>

        <label className="flex items-center gap-1 text-white text-sm">
          <input
            type="checkbox"
            checked={showOnlySignificant}
            onChange={(e) => setShowOnlySignificant(e.target.checked)}
          />
          Significant Only
        </label>

        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          className="w-16"
          title={`Threshold: ${threshold}`}
        />
        <span className="text-white text-xs">{threshold.toFixed(1)}</span>

        <button
          onClick={() => exportUtils.exportAsPNG()}
          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
        >
          PNG
        </button>
        
        <button
          onClick={() => exportUtils.exportAsSVG()}
          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
        >
          SVG
        </button>

        <button
          onClick={() => exportUtils.exportCorrelationData()}
          className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700"
        >
          CSV
        </button>
      </div>

      {/* Statistics */}
      <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 rounded p-2 text-white text-xs space-y-1">
        <div>Metrics: {metrics.length}</div>
        <div>Correlations: {correlationMatrix.length}</div>
        <div>Significant: {interestingCorrelations.length}</div>
        <div>Threshold: ±{threshold.toFixed(1)}</div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-crosshair"
      />

      {/* Interesting Correlations Panel */}
      {interestingCorrelations.length > 0 && (
        <motion.div
          className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-90 rounded-lg p-4 text-white max-w-md max-h-64 overflow-y-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="font-bold text-sm mb-2">Interesting Correlations</h3>
          <div className="space-y-2">
            {interestingCorrelations.slice(0, 5).map((correlation, index) => (
              <div
                key={`${correlation.metric1}-${correlation.metric2}`}
                className="cursor-pointer hover:bg-gray-800 p-2 rounded text-xs border"
                style={{ 
                  borderColor: correlation.coefficient > 0 ? '#10b981' : '#ef4444' 
                }}
                onClick={() => handleCellClick(correlation)}
              >
                <div className="font-semibold">
                  {correlation.metric1} ↔ {correlation.metric2}
                </div>
                <div className="flex justify-between">
                  <span 
                    className="font-bold"
                    style={{ 
                      color: correlation.coefficient > 0 ? '#10b981' : '#ef4444' 
                    }}
                  >
                    {correlation.coefficient.toFixed(3)}
                  </span>
                  <span className="text-gray-400">{correlation.strength}</span>
                </div>
              </div>
            ))}
            {interestingCorrelations.length > 5 && (
              <div className="text-gray-400 text-center">
                +{interestingCorrelations.length - 5} more...
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Selected Correlation Details */}
      {selectedCorrelation && selectedCorrelation.metric1 !== selectedCorrelation.metric2 && (
        <motion.div
          className="absolute bottom-4 right-4 z-10 bg-black bg-opacity-90 rounded-lg p-4 text-white max-w-xs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => setSelectedCorrelation(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            ×
          </button>
          <h3 className="font-bold text-sm mb-2">Correlation Analysis</h3>
          <div className="space-y-2 text-xs">
            <div>
              <strong>{selectedCorrelation.metric1}</strong> vs <strong>{selectedCorrelation.metric2}</strong>
            </div>
            <div className="flex justify-between">
              <span>Coefficient:</span>
              <span 
                className="font-bold"
                style={{ 
                  color: selectedCorrelation.coefficient > 0 ? '#10b981' : '#ef4444' 
                }}
              >
                {selectedCorrelation.coefficient.toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Strength:</span>
              <span className="capitalize">{selectedCorrelation.strength.replace('-', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span>Direction:</span>
              <span className="capitalize">{selectedCorrelation.direction}</span>
            </div>
            <div className="flex justify-between">
              <span>P-value:</span>
              <span>{selectedCorrelation.pValue.toFixed(4)}</span>
            </div>
            <div className={`text-center p-2 rounded ${
              selectedCorrelation.pValue < 0.05 ? 'bg-green-800' : 'bg-yellow-800'
            }`}>
              {selectedCorrelation.pValue < 0.05 ? 'Statistically Significant' : 'Not Significant'}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}