'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, 
  Sun, 
  Moon, 
  Monitor, 
  Download, 
  Upload, 
  Check,
  X,
  ChevronDown,
  Sparkles,
  Eye
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { useTheme } from '@/components/theme/ThemeProvider';

export interface ThemeSelectorProps {
  className?: string;
  compact?: boolean;
  showPreview?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  className = '',
  compact = false,
  showPreview = true,
}) => {
  const { 
    currentTheme, 
    themes, 
    setTheme, 
    systemPreference,
    exportTheme,
    importTheme,
    resetToDefault
  } = useTheme();
  
  const [isOpen, setIsOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);

  const handleExportTheme = () => {
    const themeData = exportTheme();
    const blob = new Blob([themeData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentTheme.name.toLowerCase().replace(/\s+/g, '-')}-theme.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const themeJson = e.target?.result as string;
        const success = importTheme(themeJson);
        
        if (success) {
          setImportError(null);
          setShowImportSuccess(true);
          setTimeout(() => setShowImportSuccess(false), 3000);
        } else {
          setImportError('Invalid theme file format');
        }
      } catch (error) {
        setImportError('Failed to import theme');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const getThemeIcon = (themeType: string) => {
    switch (themeType) {
      case 'light': return Sun;
      case 'dark': return Moon;
      case 'auto': return Monitor;
      default: return Sparkles;
    }
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Palette className="w-4 h-4 text-blue-400" />
          <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <QuickThemeGrid 
                themes={themes}
                currentTheme={currentTheme}
                onSelectTheme={(themeId) => {
                  setTheme(themeId);
                  setIsOpen(false);
                }}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <GlassCard className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Theme Selector</h3>
            <p className="text-sm text-gray-400">Customize your dashboard appearance</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Theme */}
          <motion.button
            onClick={handleExportTheme}
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Export Current Theme"
          >
            <Download className="w-4 h-4 text-gray-300" />
          </motion.button>

          {/* Import Theme */}
          <input
            type="file"
            accept=".json"
            onChange={handleImportTheme}
            className="hidden"
            id="theme-import"
          />
          <label
            htmlFor="theme-import"
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg cursor-pointer transition-colors inline-block"
            title="Import Theme"
          >
            <Upload className="w-4 h-4 text-gray-300" />
          </label>

          {/* Reset to Default */}
          <motion.button
            onClick={resetToDefault}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs text-gray-300 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Reset
          </motion.button>
        </div>
      </div>

      {/* Import Status */}
      <AnimatePresence>
        {importError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg flex items-center gap-2"
          >
            <X className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-300">{importError}</span>
            <button 
              onClick={() => setImportError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {showImportSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3 bg-green-500/20 border border-green-500/40 rounded-lg flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300">Theme imported successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Theme Info */}
      <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
        <div className="flex items-center gap-3 mb-3">
          {React.createElement(currentTheme.icon, { 
            className: "w-5 h-5",
            style: { color: currentTheme.colors.primary }
          })}
          <div>
            <h4 className="font-medium text-white">{currentTheme.name}</h4>
            <p className="text-sm text-gray-400">{currentTheme.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-400">Colors:</span>
          <div className="flex gap-1">
            <div 
              className="w-4 h-4 rounded border border-white/20"
              style={{ backgroundColor: currentTheme.colors.primary }}
              title="Primary"
            />
            <div 
              className="w-4 h-4 rounded border border-white/20"
              style={{ backgroundColor: currentTheme.colors.secondary }}
              title="Secondary"
            />
            <div 
              className="w-4 h-4 rounded border border-white/20"
              style={{ backgroundColor: currentTheme.colors.accent }}
              title="Accent"
            />
          </div>
        </div>

        {currentTheme.type === 'auto' && (
          <div className="text-xs text-blue-400">
            Auto-switching based on system preference: {systemPreference}
          </div>
        )}
      </div>

      {/* Theme Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isSelected = theme.id === currentTheme.id;
          
          return (
            <motion.div
              key={theme.id}
              className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all group ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10'
              }`}
              onClick={() => setTheme(theme.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" />
                </motion.div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <Icon 
                  className="w-5 h-5" 
                  style={{ color: theme.colors.primary }} 
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-white truncate">{theme.name}</h4>
                  <p className="text-xs text-gray-400 truncate">{theme.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <div 
                    className="w-3 h-3 rounded border border-white/20"
                    style={{ backgroundColor: theme.colors.primary }}
                  />
                  <div 
                    className="w-3 h-3 rounded border border-white/20"
                    style={{ backgroundColor: theme.colors.secondary }}
                  />
                  <div 
                    className="w-3 h-3 rounded border border-white/20"
                    style={{ backgroundColor: theme.colors.accent }}
                  />
                </div>

                <div className="text-xs text-gray-400 capitalize">
                  {theme.type}
                </div>
              </div>

              {showPreview && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-gray-400 mb-2">Preview</div>
                  <div 
                    className="h-16 rounded border border-white/20 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${theme.colors.background.primary} 0%, ${theme.colors.background.secondary} 100%)`
                    }}
                  >
                    <div 
                      className="absolute top-2 left-2 w-8 h-2 rounded"
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                    <div 
                      className="absolute top-2 right-2 w-6 h-2 rounded"
                      style={{ backgroundColor: theme.colors.secondary }}
                    />
                    <div 
                      className="absolute bottom-2 left-2 w-10 h-2 rounded"
                      style={{ backgroundColor: theme.colors.accent }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
};

// Quick Theme Grid for compact mode
const QuickThemeGrid: React.FC<{
  themes: any[];
  currentTheme: any;
  onSelectTheme: (themeId: string) => void;
}> = ({ themes, currentTheme, onSelectTheme }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.95 }}
    className="absolute top-full mt-2 right-0 z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-2xl min-w-[320px]"
  >
    <div className="grid grid-cols-3 gap-3">
      {themes.map((theme) => {
        const Icon = theme.icon;
        const isSelected = theme.id === currentTheme.id;
        
        return (
          <motion.button
            key={theme.id}
            onClick={() => onSelectTheme(theme.id)}
            className={`relative p-3 rounded-lg border-2 transition-all text-left ${
              isSelected
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
              >
                <Check className="w-2 h-2 text-white" />
              </motion.div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <span className="text-sm font-medium text-white truncate">
                {theme.name}
              </span>
            </div>
            
            <div className="flex gap-1">
              <div 
                className="w-2 h-2 rounded border border-white/20"
                style={{ backgroundColor: theme.colors.primary }}
              />
              <div 
                className="w-2 h-2 rounded border border-white/20"
                style={{ backgroundColor: theme.colors.secondary }}
              />
              <div 
                className="w-2 h-2 rounded border border-white/20"
                style={{ backgroundColor: theme.colors.accent }}
              />
            </div>
          </motion.button>
        );
      })}
    </div>
  </motion.div>
);

export default ThemeSelector;