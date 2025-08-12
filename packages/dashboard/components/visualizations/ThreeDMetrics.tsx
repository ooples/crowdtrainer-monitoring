'use client';

import React, { useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, Cylinder } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface MetricDataPoint {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  category: 'performance' | 'error' | 'usage' | 'latency';
  color?: string;
}

interface ThreeDMetricsProps {
  data: MetricDataPoint[];
  width?: number;
  height?: number;
  autoRotate?: boolean;
  showLabels?: boolean;
  onMetricClick?: (metric: MetricDataPoint) => void;
  className?: string;
}

// 3D Bar component
function Bar3D({ 
  position, 
  height, 
  color, 
  metric,
  onMetricClick,
  showLabel 
}: { 
  position: [number, number, number];
  height: number;
  color: string;
  metric: MetricDataPoint;
  onMetricClick?: (metric: MetricDataPoint) => void;
  showLabel?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (meshRef.current && hovered) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const handleClick = useCallback(() => {
    onMetricClick?.(metric);
  }, [onMetricClick, metric]);

  return (
    <group>
      <Box
        ref={meshRef}
        position={position}
        args={[0.8, height, 0.8]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial 
          color={hovered ? '#ffffff' : color} 
          transparent 
          opacity={hovered ? 0.9 : 0.7}
        />
      </Box>
      
      {showLabel && (
        <Text
          position={[position[0], position[1] + height/2 + 1, position[2]]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {metric.name}
        </Text>
      )}
      
      <Text
        position={[position[0], position[1] + height/2 + 0.5, position[2]]}
        fontSize={0.2}
        color="#cccccc"
        anchorX="center"
        anchorY="middle"
      >
        {metric.value.toFixed(1)}
      </Text>
    </group>
  );
}

// 3D Sphere component for real-time metrics
function MetricSphere({ 
  position, 
  size, 
  color, 
  metric,
  onMetricClick 
}: { 
  position: [number, number, number];
  size: number;
  color: string;
  metric: MetricDataPoint;
  onMetricClick?: (metric: MetricDataPoint) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
      
      if (hovered) {
        meshRef.current.scale.setScalar(1.2);
      } else {
        meshRef.current.scale.setScalar(1.0);
      }
    }
  });

  const handleClick = useCallback(() => {
    onMetricClick?.(metric);
  }, [onMetricClick, metric]);

  return (
    <group>
      <Sphere
        ref={meshRef}
        position={position}
        args={[size, 32, 32]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={0.8}
          emissive={color}
          emissiveIntensity={hovered ? 0.3 : 0.1}
        />
      </Sphere>
      
      <Text
        position={[position[0], position[1] + size + 0.5, position[2]]}
        fontSize={0.25}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        {metric.name}
      </Text>
    </group>
  );
}

// Main 3D Scene component
function Scene3D({ 
  data, 
  autoRotate, 
  showLabels, 
  onMetricClick 
}: {
  data: MetricDataPoint[];
  autoRotate?: boolean;
  showLabels?: boolean;
  onMetricClick?: (metric: MetricDataPoint) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current && autoRotate) {
      groupRef.current.rotation.y += 0.005;
    }
  });

  const categoryColors = {
    performance: '#10b981',
    error: '#ef4444',
    usage: '#3b82f6',
    latency: '#f59e0b'
  };

  const maxValue = Math.max(...data.map(d => d.value));
  
  const positions = useMemo(() => {
    return data.map((_, index) => {
      const angle = (index / data.length) * Math.PI * 2;
      const radius = 4;
      return [
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ] as [number, number, number];
    });
  }, [data]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} />
      
      <group ref={groupRef}>
        {data.map((metric, index) => {
          const position = positions[index];
          const height = (metric.value / maxValue) * 4 + 0.5;
          const color = metric.color || categoryColors[metric.category];
          
          return metric.category === 'performance' || metric.category === 'usage' ? (
            <Bar3D
              key={metric.id}
              position={position}
              height={height}
              color={color}
              metric={metric}
              onMetricClick={onMetricClick}
              showLabel={showLabels}
            />
          ) : (
            <MetricSphere
              key={metric.id}
              position={[position[0], height/2, position[2]]}
              size={Math.max(0.3, (metric.value / maxValue) * 0.8)}
              color={color}
              metric={metric}
              onMetricClick={onMetricClick}
            />
          );
        })}
      </group>
      
      <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
    </>
  );
}

// Export utilities
const exportUtils = {
  async exportAsPNG(canvasRef: React.RefObject<HTMLDivElement>): Promise<void> {
    if (!canvasRef.current) return;
    
    const canvas = await html2canvas(canvasRef.current, {
      backgroundColor: '#1f2937',
      scale: 2
    });
    
    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(blob, `3d-metrics-${Date.now()}.png`);
      }
    });
  },

  async exportAsPDF(canvasRef: React.RefObject<HTMLDivElement>): Promise<void> {
    if (!canvasRef.current) return;
    
    const canvas = await html2canvas(canvasRef.current, {
      backgroundColor: '#1f2937',
      scale: 2
    });
    
    const pdf = new jsPDF('landscape');
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`3d-metrics-${Date.now()}.pdf`);
  },

  async exportAsSVG(): Promise<void> {
    // Note: SVG export for 3D scenes requires more complex implementation
    // This is a placeholder for future enhancement
    console.warn('SVG export for 3D scenes not yet implemented');
  }
};

export default function ThreeDMetrics({
  data,
  width = 800,
  height = 600,
  autoRotate = true,
  showLabels = true,
  onMetricClick,
  className = ''
}: ThreeDMetricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'bars' | 'spheres' | 'mixed'>('mixed');

  const handleExport = async (format: 'png' | 'pdf' | 'svg') => {
    switch (format) {
      case 'png':
        await exportUtils.exportAsPNG(containerRef);
        break;
      case 'pdf':
        await exportUtils.exportAsPDF(containerRef);
        break;
      case 'svg':
        await exportUtils.exportAsSVG();
        break;
    }
  };

  // Performance optimization for large datasets
  const optimizedData = useMemo(() => {
    if (data.length > 100) {
      // Sample data for performance with >10k points
      const step = Math.ceil(data.length / 100);
      return data.filter((_, index) => index % step === 0);
    }
    return data;
  }, [data]);

  return (
    <motion.div
      ref={containerRef}
      className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}
      style={{ width, height }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={() => handleExport('png')}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          aria-label="Export as PNG"
        >
          PNG
        </button>
        <button
          onClick={() => handleExport('pdf')}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          aria-label="Export as PDF"
        >
          PDF
        </button>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as any)}
          className="px-2 py-1 bg-gray-800 text-white rounded text-sm border border-gray-600"
          aria-label="View mode"
        >
          <option value="mixed">Mixed</option>
          <option value="bars">Bars Only</option>
          <option value="spheres">Spheres Only</option>
        </select>
      </div>

      {/* Performance indicator for large datasets */}
      {data.length > 1000 && (
        <div className="absolute top-4 right-4 z-10 bg-yellow-600 text-white px-2 py-1 rounded text-xs">
          Rendering {optimizedData.length}/{data.length} points
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 5, 10], fov: 75 }}
        onCreated={() => setIsLoading(false)}
        className="cursor-grab active:cursor-grabbing"
      >
        <Suspense fallback={null}>
          <Scene3D
            data={optimizedData}
            autoRotate={autoRotate}
            showLabels={showLabels}
            onMetricClick={onMetricClick}
          />
        </Suspense>
      </Canvas>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center">
          <div className="text-white">Loading 3D visualization...</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-70 rounded p-3">
        <div className="text-white text-sm space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Performance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>Errors</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Usage</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>Latency</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}