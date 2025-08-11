'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, 
  Upload, 
  Download, 
  RefreshCw, 
  Eye, 
  Code, 
  Save,
  Undo2,
  ImageIcon,
  Type,
  Paintbrush,
  Monitor
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { BrandConfig } from '@/types/monitoring';
import { getContrastColor } from '@/lib/utils';

interface BrandCustomizerProps {
  brandConfig: BrandConfig;
  onConfigChange: (config: BrandConfig) => void;
  onSave?: (config: BrandConfig) => Promise<void>;
  onReset?: () => void;
  className?: string;
}

const defaultColors = [
  '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#6366f1', '#84cc16', '#f97316'
];

const presetThemes = [
  {
    name: 'Ocean Blue',
    colors: { primary: '#0ea5e9', secondary: '#06b6d4', accent: '#3b82f6' }
  },
  {
    name: 'Sunset Orange',
    colors: { primary: '#f97316', secondary: '#fb923c', accent: '#ea580c' }
  },
  {
    name: 'Forest Green',
    colors: { primary: '#059669', secondary: '#10b981', accent: '#047857' }
  },
  {
    name: 'Purple Reign',
    colors: { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#7c3aed' }
  },
  {
    name: 'Rose Gold',
    colors: { primary: '#ec4899', secondary: '#f472b6', accent: '#db2777' }
  }
];

export function BrandCustomizer({
  brandConfig,
  onConfigChange,
  onSave,
  onReset,
  className = ""
}: BrandCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'colors' | 'logo' | 'fonts' | 'css' | 'preview'>('colors');
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [localConfig, setLocalConfig] = useState<BrandConfig>(brandConfig);

  useEffect(() => {
    setLocalConfig(brandConfig);
  }, [brandConfig]);

  useEffect(() => {
    const hasChanged = JSON.stringify(localConfig) !== JSON.stringify(brandConfig);
    setHasChanges(hasChanged);
  }, [localConfig, brandConfig]);

  const updateConfig = (updates: Partial<BrandConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const updateColors = (colors: Partial<BrandConfig['colors']>) => {
    updateConfig({
      colors: { ...localConfig.colors, ...colors }
    });
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    setSaving(true);
    try {
      await onSave(localConfig);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save brand config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
      setHasChanges(false);
    }
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(localConfig, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `brand-config-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        setLocalConfig(config);
        onConfigChange(config);
      } catch (error) {
        console.error('Failed to parse config file:', error);
      }
    };
    reader.readAsText(file);
  };

  const tabs = [
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'logo', label: 'Logo', icon: ImageIcon },
    { id: 'fonts', label: 'Fonts', icon: Type },
    { id: 'css', label: 'Custom CSS', icon: Code },
    { id: 'preview', label: 'Preview', icon: Eye }
  ];

  return (
    <div className={className}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Paintbrush className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-semibold text-white">Brand Customization</h2>
            {hasChanges && (
              <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm rounded-full">
                Unsaved Changes
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".json"
              onChange={importConfig}
              className="hidden"
              id="import-config"
            />
            <label
              htmlFor="import-config"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </label>
            
            <button
              onClick={exportConfig}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            
            {hasChanges && (
              <>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg transition-colors"
                >
                  <Undo2 className="w-4 h-4" />
                  Reset
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300 disabled:opacity-50"
                >
                  {saving ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'colors' && (
              <ColorsTab
                colors={localConfig.colors}
                onColorsChange={updateColors}
                presetThemes={presetThemes}
                defaultColors={defaultColors}
              />
            )}
            
            {activeTab === 'logo' && (
              <LogoTab
                logo={localConfig.logo}
                onLogoChange={(logo) => updateConfig({ logo })}
              />
            )}
            
            {activeTab === 'fonts' && (
              <FontsTab
                fonts={localConfig.fonts}
                onFontsChange={(fonts) => updateConfig({ fonts })}
              />
            )}
            
            {activeTab === 'css' && (
              <CustomCssTab
                customCss={localConfig.customCss}
                onCssChange={(customCss) => updateConfig({ customCss })}
              />
            )}
            
            {activeTab === 'preview' && (
              <PreviewTab brandConfig={localConfig} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// Colors Tab Component
function ColorsTab({ 
  colors, 
  onColorsChange, 
  presetThemes, 
  defaultColors 
}: {
  colors: BrandConfig['colors'];
  onColorsChange: (colors: Partial<BrandConfig['colors']>) => void;
  presetThemes: any[];
  defaultColors: string[];
}) {
  return (
    <div className="space-y-6">
      {/* Preset Themes */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-medium text-white mb-4">Preset Themes</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {presetThemes.map((theme, index) => (
            <motion.button
              key={theme.name}
              onClick={() => onColorsChange(theme.colors)}
              className="p-4 rounded-lg border border-white/10 hover:border-white/20 transition-all group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex gap-1 mb-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: theme.colors.secondary }}
                />
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: theme.colors.accent }}
                />
              </div>
              <p className="text-sm text-white font-medium group-hover:text-blue-300">
                {theme.name}
              </p>
            </motion.button>
          ))}
        </div>
      </GlassCard>

      {/* Custom Colors */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-medium text-white mb-4">Custom Colors</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <ColorPicker
            label="Primary Color"
            value={colors.primary}
            onChange={(color) => onColorsChange({ primary: color })}
            presets={defaultColors}
          />
          <ColorPicker
            label="Secondary Color"
            value={colors.secondary}
            onChange={(color) => onColorsChange({ secondary: color })}
            presets={defaultColors}
          />
          <ColorPicker
            label="Accent Color"
            value={colors.accent}
            onChange={(color) => onColorsChange({ accent: color })}
            presets={defaultColors}
          />
        </div>
      </GlassCard>
    </div>
  );
}

// Color Picker Component
function ColorPicker({ 
  label, 
  value, 
  onChange, 
  presets 
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presets: string[];
}) {
  const contrastColor = getContrastColor(value);
  
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-3">{label}</label>
      <div className="space-y-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-12 rounded-lg border border-white/10 bg-transparent cursor-pointer"
          />
          <div 
            className="absolute inset-1 rounded-md flex items-center justify-center text-sm font-mono pointer-events-none"
            style={{ backgroundColor: value, color: contrastColor }}
          >
            {value.toUpperCase()}
          </div>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          placeholder="#000000"
        />
        <div className="flex flex-wrap gap-2">
          {presets.map(preset => (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              className="w-6 h-6 rounded-full border-2 border-white/20 hover:border-white/40 transition-colors"
              style={{ backgroundColor: preset }}
              title={preset}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Logo Tab Component
function LogoTab({ 
  logo, 
  onLogoChange 
}: {
  logo?: BrandConfig['logo'];
  onLogoChange: (logo?: BrandConfig['logo']) => void;
}) {
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      onLogoChange({
        url,
        width: logo?.width || 120,
        height: logo?.height || 40
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-medium text-white mb-4">Logo Configuration</h3>
      <div className="space-y-6">
        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-white mb-3">Logo Image</label>
          <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
            {logo?.url ? (
              <div className="space-y-4">
                <img 
                  src={logo.url} 
                  alt="Logo preview"
                  className="max-h-24 mx-auto"
                  style={{ width: logo.width, height: logo.height }}
                />
                <button
                  onClick={() => onLogoChange(undefined)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove Logo
                </button>
              </div>
            ) : (
              <div>
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Upload your logo</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Choose File
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Logo URL */}
        <div>
          <label className="block text-sm font-medium text-white mb-2">Logo URL (Alternative)</label>
          <input
            type="url"
            value={logo?.url || ''}
            onChange={(e) => onLogoChange({ ...logo, url: e.target.value })}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>

        {/* Logo Dimensions */}
        {logo?.url && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Width (px)</label>
              <input
                type="number"
                value={logo.width || 120}
                onChange={(e) => onLogoChange({ ...logo, width: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Height (px)</label>
              <input
                type="number"
                value={logo.height || 40}
                onChange={(e) => onLogoChange({ ...logo, height: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// Fonts Tab Component
function FontsTab({ 
  fonts, 
  onFontsChange 
}: {
  fonts?: BrandConfig['fonts'];
  onFontsChange: (fonts: BrandConfig['fonts']) => void;
}) {
  const googleFonts = [
    'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro',
    'Nunito', 'Poppins', 'Raleway', 'Ubuntu', 'Playfair Display', 'Merriweather'
  ];

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-medium text-white mb-4">Typography</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-white mb-2">Heading Font</label>
          <select
            value={fonts?.heading || 'Inter, sans-serif'}
            onChange={(e) => onFontsChange({ ...fonts, heading: e.target.value })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {googleFonts.map(font => (
              <option key={font} value={`${font}, sans-serif`} className="bg-gray-800">
                {font}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">Body Font</label>
          <select
            value={fonts?.body || 'Inter, sans-serif'}
            onChange={(e) => onFontsChange({ ...fonts, body: e.target.value })}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {googleFonts.map(font => (
              <option key={font} value={`${font}, sans-serif`} className="bg-gray-800">
                {font}
              </option>
            ))}
          </select>
        </div>
      </div>
    </GlassCard>
  );
}

// Custom CSS Tab Component
function CustomCssTab({ 
  customCss, 
  onCssChange 
}: {
  customCss?: string;
  onCssChange: (css: string) => void;
}) {
  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-medium text-white mb-4">Custom CSS</h3>
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Additional CSS Styles
        </label>
        <textarea
          value={customCss || ''}
          onChange={(e) => onCssChange(e.target.value)}
          placeholder="/* Add your custom CSS here */&#10;.custom-class {&#10;  color: #ffffff;&#10;}"
          rows={12}
          className="w-full px-3 py-2 bg-black/20 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono text-sm"
        />
        <p className="text-xs text-gray-400 mt-2">
          Custom CSS will be applied to the dashboard. Use with caution.
        </p>
      </div>
    </GlassCard>
  );
}

// Preview Tab Component
function PreviewTab({ brandConfig }: { brandConfig: BrandConfig }) {
  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Monitor className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-medium text-white">Preview</h3>
        </div>
        
        {/* Brand Preview */}
        <div className="p-6 bg-black/20 rounded-lg border border-white/10">
          <div className="flex items-center gap-4 mb-6">
            {brandConfig.logo && (
              <img 
                src={brandConfig.logo.url} 
                alt="Logo"
                width={brandConfig.logo.width}
                height={brandConfig.logo.height}
                className="h-8 w-auto"
              />
            )}
            <h1 
              className="text-2xl font-bold"
              style={{ 
                color: brandConfig.colors.primary,
                fontFamily: brandConfig.fonts?.heading 
              }}
            >
              {brandConfig.name}
            </h1>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div 
              className="p-4 rounded-lg text-center text-white font-medium"
              style={{ backgroundColor: brandConfig.colors.primary }}
            >
              Primary Color
            </div>
            <div 
              className="p-4 rounded-lg text-center text-white font-medium"
              style={{ backgroundColor: brandConfig.colors.secondary }}
            >
              Secondary Color
            </div>
            <div 
              className="p-4 rounded-lg text-center text-white font-medium"
              style={{ backgroundColor: brandConfig.colors.accent }}
            >
              Accent Color
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 
              className="text-xl font-semibold text-white"
              style={{ fontFamily: brandConfig.fonts?.heading }}
            >
              Sample Heading
            </h2>
            <p 
              className="text-gray-300"
              style={{ fontFamily: brandConfig.fonts?.body }}
            >
              This is how your body text will look with the selected font family.
              The dashboard will use these styling choices throughout the interface.
            </p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">
            <strong>Note:</strong> Changes are applied in real-time to the dashboard.
            Use the Save button to persist your customizations.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}