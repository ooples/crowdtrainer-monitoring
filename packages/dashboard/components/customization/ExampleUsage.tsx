'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Palette, Layout, Bookmark } from 'lucide-react';
import { 
  CustomizationPanel,
  ThemeSelector,
  LayoutManager,
  SavedViews,
  ModeAwareWrapper,
  useDashboardConfig
} from './index';
import { DashboardLayout } from '@/components/builder/DashboardBuilder';

/**
 * Example component showing how to integrate customization features
 * with the mode system in your dashboard.
 */
export const CustomizationExample: React.FC = () => {
  const [showCustomization, setShowCustomization] = useState(false);
  const [currentLayout, setCurrentLayout] = useState<DashboardLayout>({
    id: 'example',
    name: 'Example Dashboard',
    description: 'Example dashboard layout',
    widgets: [],
    grid: { columns: 24, rows: 16, gap: 10 },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
      tags: ['example'],
    },
  });

  const { mode } = useDashboardConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with mode-aware customization button */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Dashboard Customization Example</h1>
            <p className="text-gray-400">Current mode: <span className="capitalize text-blue-400">{mode}</span></p>
          </div>
          
          {/* Customization Button - Only show in Advanced/Expert mode */}
          <ModeAwareWrapper 
            requiredMode="advanced"
            fallback={
              <div className="text-gray-500 text-sm">
                Customization available in Advanced/Expert mode
              </div>
            }
          >
            <motion.button
              onClick={() => setShowCustomization(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Settings className="w-5 h-5" />
              Customize Dashboard
            </motion.button>
          </ModeAwareWrapper>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Theme Selector - Only in Advanced/Expert mode */}
          <ModeAwareWrapper requiredFeature="themeCustomization">
            <div className="lg:col-span-1">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Theme Selector
              </h3>
              <ThemeSelector compact />
            </div>
          </ModeAwareWrapper>

          {/* Layout Manager - Only in Advanced/Expert mode */}
          <ModeAwareWrapper requiredFeature="layoutEditor">
            <div className="lg:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Layout className="w-5 h-5" />
                Layout Manager
              </h3>
              <div className="h-64 bg-white/5 border border-white/10 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Layout manager would be embedded here</p>
              </div>
            </div>
          </ModeAwareWrapper>
        </div>

        {/* Saved Views - Only in Advanced/Expert mode */}
        <ModeAwareWrapper requiredFeature="savedViews">
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Bookmark className="w-5 h-5" />
              Saved Views
            </h3>
            <SavedViews
              currentLayout={currentLayout}
              onLoadView={(view) => {
                setCurrentLayout(view.layout);
                console.log('Loaded view:', view.name);
              }}
            />
          </div>
        </ModeAwareWrapper>

        {/* Feature Comparison Table */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Mode Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-white">Feature</th>
                  <th className="text-center py-2 text-white">Basic</th>
                  <th className="text-center py-2 text-white">Advanced</th>
                  <th className="text-center py-2 text-white">Expert</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-white/5">
                  <td className="py-2">Theme Customization</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">✅</td>
                  <td className="text-center py-2">✅</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2">Layout Editor</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">✅</td>
                  <td className="text-center py-2">✅</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2">Saved Views</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">✅</td>
                  <td className="text-center py-2">✅</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2">Export/Import</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">✅</td>
                  <td className="text-center py-2">✅</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2">API Configuration</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">✅</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2">Webhooks</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">✅</td>
                </tr>
                <tr>
                  <td className="py-2">Scripting</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">❌</td>
                  <td className="text-center py-2">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Full Customization Panel */}
        {showCustomization && (
          <CustomizationPanel
            isOpen={showCustomization}
            onClose={() => setShowCustomization(false)}
            currentLayout={currentLayout}
            onLayoutChange={setCurrentLayout}
          />
        )}
      </div>
    </div>
  );
};

export default CustomizationExample;