'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor, Palette, Sparkles, Zap, Shield, Heart, Leaf, Flame } from 'lucide-react';

// Theme Types
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  border: {
    primary: string;
    secondary: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  type: 'light' | 'dark' | 'auto';
  colors: ThemeColors;
  cssVariables: Record<string, string>;
  animations?: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
}

export interface ThemeContextType {
  currentTheme: Theme;
  themes: Theme[];
  setTheme: (themeId: string) => void;
  toggleTheme: () => void;
  systemPreference: 'light' | 'dark';
  customTheme?: Partial<Theme>;
  setCustomTheme: (theme: Partial<Theme>) => void;
  resetToDefault: () => void;
  exportTheme: (theme?: Theme) => string;
  importTheme: (themeJson: string) => boolean;
}

// Default Themes (10+ themes as requested)
const defaultThemes: Theme[] = [
  {
    id: 'dark-modern',
    name: 'Dark Modern',
    description: 'Sleek dark theme with blue accents',
    icon: Moon,
    type: 'dark',
    colors: {
      primary: '#3b82f6',
      secondary: '#06b6d4',
      accent: '#8b5cf6',
      background: {
        primary: '#0f172a',
        secondary: '#1e293b',
        tertiary: '#334155',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#64748b',
      },
      border: {
        primary: '#334155',
        secondary: '#475569',
      },
      status: {
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        secondary: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        accent: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#3b82f6',
      '--theme-secondary': '#06b6d4',
      '--theme-accent': '#8b5cf6',
      '--theme-bg-primary': '#0f172a',
      '--theme-bg-secondary': '#1e293b',
      '--theme-bg-tertiary': '#334155',
      '--theme-text-primary': '#f8fafc',
      '--theme-text-secondary': '#cbd5e1',
      '--theme-text-muted': '#64748b',
      '--theme-border-primary': '#334155',
      '--theme-border-secondary': '#475569',
      '--theme-shadow': 'rgba(0, 0, 0, 0.5)',
      '--theme-glass': 'rgba(255, 255, 255, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 300,
      easing: 'easeInOut',
    },
  },
  {
    id: 'light-clean',
    name: 'Light Clean',
    description: 'Clean light theme with subtle shadows',
    icon: Sun,
    type: 'light',
    colors: {
      primary: '#2563eb',
      secondary: '#0891b2',
      accent: '#7c3aed',
      background: {
        primary: '#ffffff',
        secondary: '#f8fafc',
        tertiary: '#e2e8f0',
      },
      text: {
        primary: '#1e293b',
        secondary: '#475569',
        muted: '#64748b',
      },
      border: {
        primary: '#e2e8f0',
        secondary: '#cbd5e1',
      },
      status: {
        success: '#16a34a',
        warning: '#d97706',
        error: '#dc2626',
        info: '#2563eb',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
        secondary: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        accent: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#2563eb',
      '--theme-secondary': '#0891b2',
      '--theme-accent': '#7c3aed',
      '--theme-bg-primary': '#ffffff',
      '--theme-bg-secondary': '#f8fafc',
      '--theme-bg-tertiary': '#e2e8f0',
      '--theme-text-primary': '#1e293b',
      '--theme-text-secondary': '#475569',
      '--theme-text-muted': '#64748b',
      '--theme-border-primary': '#e2e8f0',
      '--theme-border-secondary': '#cbd5e1',
      '--theme-shadow': 'rgba(0, 0, 0, 0.1)',
      '--theme-glass': 'rgba(255, 255, 255, 0.8)',
    },
    animations: {
      enabled: true,
      duration: 250,
      easing: 'easeInOut',
    },
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    description: 'Deep blue theme inspired by ocean depths',
    icon: Sparkles,
    type: 'dark',
    colors: {
      primary: '#0ea5e9',
      secondary: '#06b6d4',
      accent: '#22d3ee',
      background: {
        primary: '#082f49',
        secondary: '#0c4a6e',
        tertiary: '#075985',
      },
      text: {
        primary: '#f0f9ff',
        secondary: '#bae6fd',
        muted: '#7dd3fc',
      },
      border: {
        primary: '#075985',
        secondary: '#0284c7',
      },
      status: {
        success: '#06d6a0',
        warning: '#ffd60a',
        error: '#ef476f',
        info: '#0ea5e9',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #22d3ee 100%)',
        secondary: 'linear-gradient(135deg, #082f49 0%, #0c4a6e 100%)',
        accent: 'linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#0ea5e9',
      '--theme-secondary': '#06b6d4',
      '--theme-accent': '#22d3ee',
      '--theme-bg-primary': '#082f49',
      '--theme-bg-secondary': '#0c4a6e',
      '--theme-bg-tertiary': '#075985',
      '--theme-text-primary': '#f0f9ff',
      '--theme-text-secondary': '#bae6fd',
      '--theme-text-muted': '#7dd3fc',
      '--theme-border-primary': '#075985',
      '--theme-border-secondary': '#0284c7',
      '--theme-shadow': 'rgba(8, 47, 73, 0.6)',
      '--theme-glass': 'rgba(34, 211, 238, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 400,
      easing: 'easeOut',
    },
  },
  {
    id: 'sunset-vibes',
    name: 'Sunset Vibes',
    description: 'Warm sunset colors with orange and pink tones',
    icon: Flame,
    type: 'dark',
    colors: {
      primary: '#f97316',
      secondary: '#fb923c',
      accent: '#ec4899',
      background: {
        primary: '#431407',
        secondary: '#7c2d12',
        tertiary: '#9a3412',
      },
      text: {
        primary: '#fff7ed',
        secondary: '#fed7aa',
        muted: '#fdba74',
      },
      border: {
        primary: '#9a3412',
        secondary: '#c2410c',
      },
      status: {
        success: '#16a34a',
        warning: '#eab308',
        error: '#dc2626',
        info: '#f97316',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #f97316 0%, #fb923c 50%, #ec4899 100%)',
        secondary: 'linear-gradient(135deg, #431407 0%, #7c2d12 100%)',
        accent: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#f97316',
      '--theme-secondary': '#fb923c',
      '--theme-accent': '#ec4899',
      '--theme-bg-primary': '#431407',
      '--theme-bg-secondary': '#7c2d12',
      '--theme-bg-tertiary': '#9a3412',
      '--theme-text-primary': '#fff7ed',
      '--theme-text-secondary': '#fed7aa',
      '--theme-text-muted': '#fdba74',
      '--theme-border-primary': '#9a3412',
      '--theme-border-secondary': '#c2410c',
      '--theme-shadow': 'rgba(67, 20, 7, 0.6)',
      '--theme-glass': 'rgba(249, 115, 22, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 350,
      easing: 'easeInOut',
    },
  },
  {
    id: 'forest-guardian',
    name: 'Forest Guardian',
    description: 'Nature-inspired green theme with earth tones',
    icon: Leaf,
    type: 'dark',
    colors: {
      primary: '#16a34a',
      secondary: '#15803d',
      accent: '#84cc16',
      background: {
        primary: '#14532d',
        secondary: '#166534',
        tertiary: '#15803d',
      },
      text: {
        primary: '#f0fdf4',
        secondary: '#bbf7d0',
        muted: '#86efac',
      },
      border: {
        primary: '#15803d',
        secondary: '#16a34a',
      },
      status: {
        success: '#16a34a',
        warning: '#eab308',
        error: '#dc2626',
        info: '#06b6d4',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #16a34a 0%, #15803d 50%, #84cc16 100%)',
        secondary: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
        accent: 'linear-gradient(135deg, #84cc16 0%, #16a34a 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#16a34a',
      '--theme-secondary': '#15803d',
      '--theme-accent': '#84cc16',
      '--theme-bg-primary': '#14532d',
      '--theme-bg-secondary': '#166534',
      '--theme-bg-tertiary': '#15803d',
      '--theme-text-primary': '#f0fdf4',
      '--theme-text-secondary': '#bbf7d0',
      '--theme-text-muted': '#86efac',
      '--theme-border-primary': '#15803d',
      '--theme-border-secondary': '#16a34a',
      '--theme-shadow': 'rgba(20, 83, 45, 0.6)',
      '--theme-glass': 'rgba(22, 163, 74, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 300,
      easing: 'easeInOut',
    },
  },
  {
    id: 'purple-haze',
    name: 'Purple Haze',
    description: 'Rich purple theme with mystical vibes',
    icon: Sparkles,
    type: 'dark',
    colors: {
      primary: '#8b5cf6',
      secondary: '#a78bfa',
      accent: '#ec4899',
      background: {
        primary: '#3c1361',
        secondary: '#581c87',
        tertiary: '#7c3aed',
      },
      text: {
        primary: '#faf5ff',
        secondary: '#ddd6fe',
        muted: '#c4b5fd',
      },
      border: {
        primary: '#7c3aed',
        secondary: '#8b5cf6',
      },
      status: {
        success: '#16a34a',
        warning: '#eab308',
        error: '#dc2626',
        info: '#8b5cf6',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #ec4899 100%)',
        secondary: 'linear-gradient(135deg, #3c1361 0%, #581c87 100%)',
        accent: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#8b5cf6',
      '--theme-secondary': '#a78bfa',
      '--theme-accent': '#ec4899',
      '--theme-bg-primary': '#3c1361',
      '--theme-bg-secondary': '#581c87',
      '--theme-bg-tertiary': '#7c3aed',
      '--theme-text-primary': '#faf5ff',
      '--theme-text-secondary': '#ddd6fe',
      '--theme-text-muted': '#c4b5fd',
      '--theme-border-primary': '#7c3aed',
      '--theme-border-secondary': '#8b5cf6',
      '--theme-shadow': 'rgba(60, 19, 97, 0.6)',
      '--theme-glass': 'rgba(139, 92, 246, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 350,
      easing: 'easeInOut',
    },
  },
  {
    id: 'crimson-strike',
    name: 'Crimson Strike',
    description: 'Bold red theme for high-intensity monitoring',
    icon: Zap,
    type: 'dark',
    colors: {
      primary: '#dc2626',
      secondary: '#ef4444',
      accent: '#f97316',
      background: {
        primary: '#450a0a',
        secondary: '#7f1d1d',
        tertiary: '#991b1b',
      },
      text: {
        primary: '#fef2f2',
        secondary: '#fecaca',
        muted: '#fca5a5',
      },
      border: {
        primary: '#991b1b',
        secondary: '#dc2626',
      },
      status: {
        success: '#16a34a',
        warning: '#eab308',
        error: '#dc2626',
        info: '#3b82f6',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f97316 100%)',
        secondary: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
        accent: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#dc2626',
      '--theme-secondary': '#ef4444',
      '--theme-accent': '#f97316',
      '--theme-bg-primary': '#450a0a',
      '--theme-bg-secondary': '#7f1d1d',
      '--theme-bg-tertiary': '#991b1b',
      '--theme-text-primary': '#fef2f2',
      '--theme-text-secondary': '#fecaca',
      '--theme-text-muted': '#fca5a5',
      '--theme-border-primary': '#991b1b',
      '--theme-border-secondary': '#dc2626',
      '--theme-shadow': 'rgba(69, 10, 10, 0.6)',
      '--theme-glass': 'rgba(220, 38, 38, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 200,
      easing: 'easeInOut',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Warm golden theme with amber highlights',
    icon: Sun,
    type: 'dark',
    colors: {
      primary: '#f59e0b',
      secondary: '#fbbf24',
      accent: '#f97316',
      background: {
        primary: '#451a03',
        secondary: '#78350f',
        tertiary: '#92400e',
      },
      text: {
        primary: '#fffbeb',
        secondary: '#fde68a',
        muted: '#fcd34d',
      },
      border: {
        primary: '#92400e',
        secondary: '#d97706',
      },
      status: {
        success: '#16a34a',
        warning: '#f59e0b',
        error: '#dc2626',
        info: '#06b6d4',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f97316 100%)',
        secondary: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)',
        accent: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#f59e0b',
      '--theme-secondary': '#fbbf24',
      '--theme-accent': '#f97316',
      '--theme-bg-primary': '#451a03',
      '--theme-bg-secondary': '#78350f',
      '--theme-bg-tertiary': '#92400e',
      '--theme-text-primary': '#fffbeb',
      '--theme-text-secondary': '#fde68a',
      '--theme-text-muted': '#fcd34d',
      '--theme-border-primary': '#92400e',
      '--theme-border-secondary': '#d97706',
      '--theme-shadow': 'rgba(69, 26, 3, 0.6)',
      '--theme-glass': 'rgba(245, 158, 11, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 300,
      easing: 'easeInOut',
    },
  },
  {
    id: 'cyber-security',
    name: 'Cyber Security',
    description: 'High-contrast theme for security operations',
    icon: Shield,
    type: 'dark',
    colors: {
      primary: '#00ff00',
      secondary: '#00cc00',
      accent: '#ffff00',
      background: {
        primary: '#000000',
        secondary: '#111111',
        tertiary: '#222222',
      },
      text: {
        primary: '#00ff00',
        secondary: '#00cc00',
        muted: '#009900',
      },
      border: {
        primary: '#333333',
        secondary: '#00ff00',
      },
      status: {
        success: '#00ff00',
        warning: '#ffff00',
        error: '#ff0000',
        info: '#00ffff',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #00ff00 0%, #00cc00 50%, #ffff00 100%)',
        secondary: 'linear-gradient(135deg, #000000 0%, #111111 100%)',
        accent: 'linear-gradient(135deg, #ffff00 0%, #00ff00 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#00ff00',
      '--theme-secondary': '#00cc00',
      '--theme-accent': '#ffff00',
      '--theme-bg-primary': '#000000',
      '--theme-bg-secondary': '#111111',
      '--theme-bg-tertiary': '#222222',
      '--theme-text-primary': '#00ff00',
      '--theme-text-secondary': '#00cc00',
      '--theme-text-muted': '#009900',
      '--theme-border-primary': '#333333',
      '--theme-border-secondary': '#00ff00',
      '--theme-shadow': 'rgba(0, 0, 0, 0.8)',
      '--theme-glass': 'rgba(0, 255, 0, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 150,
      easing: 'linear',
    },
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    description: 'Vibrant neon theme with electric colors',
    icon: Zap,
    type: 'dark',
    colors: {
      primary: '#ff00ff',
      secondary: '#00ffff',
      accent: '#ffff00',
      background: {
        primary: '#0a0a0a',
        secondary: '#1a1a2e',
        tertiary: '#16213e',
      },
      text: {
        primary: '#ffffff',
        secondary: '#e0e0ff',
        muted: '#b0b0ff',
      },
      border: {
        primary: '#16213e',
        secondary: '#0f3460',
      },
      status: {
        success: '#00ff88',
        warning: '#ffaa00',
        error: '#ff0066',
        info: '#00aaff',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #ff00ff 0%, #00ffff 50%, #ffff00 100%)',
        secondary: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
        accent: 'linear-gradient(135deg, #ffff00 0%, #ff00ff 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#ff00ff',
      '--theme-secondary': '#00ffff',
      '--theme-accent': '#ffff00',
      '--theme-bg-primary': '#0a0a0a',
      '--theme-bg-secondary': '#1a1a2e',
      '--theme-bg-tertiary': '#16213e',
      '--theme-text-primary': '#ffffff',
      '--theme-text-secondary': '#e0e0ff',
      '--theme-text-muted': '#b0b0ff',
      '--theme-border-primary': '#16213e',
      '--theme-border-secondary': '#0f3460',
      '--theme-shadow': 'rgba(10, 10, 10, 0.8)',
      '--theme-glass': 'rgba(255, 0, 255, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 200,
      easing: 'backOut',
    },
  },
  {
    id: 'valentine-romance',
    name: 'Valentine Romance',
    description: 'Romantic theme with pink and red tones',
    icon: Heart,
    type: 'dark',
    colors: {
      primary: '#ec4899',
      secondary: '#f472b6',
      accent: '#fbbf24',
      background: {
        primary: '#4c0519',
        secondary: '#831843',
        tertiary: '#be185d',
      },
      text: {
        primary: '#fdf2f8',
        secondary: '#fce7f3',
        muted: '#fbcfe8',
      },
      border: {
        primary: '#be185d',
        secondary: '#db2777',
      },
      status: {
        success: '#16a34a',
        warning: '#f59e0b',
        error: '#dc2626',
        info: '#ec4899',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #ec4899 0%, #f472b6 50%, #fbbf24 100%)',
        secondary: 'linear-gradient(135deg, #4c0519 0%, #831843 100%)',
        accent: 'linear-gradient(135deg, #fbbf24 0%, #ec4899 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#ec4899',
      '--theme-secondary': '#f472b6',
      '--theme-accent': '#fbbf24',
      '--theme-bg-primary': '#4c0519',
      '--theme-bg-secondary': '#831843',
      '--theme-bg-tertiary': '#be185d',
      '--theme-text-primary': '#fdf2f8',
      '--theme-text-secondary': '#fce7f3',
      '--theme-text-muted': '#fbcfe8',
      '--theme-border-primary': '#be185d',
      '--theme-border-secondary': '#db2777',
      '--theme-shadow': 'rgba(76, 5, 25, 0.6)',
      '--theme-glass': 'rgba(236, 72, 153, 0.05)',
    },
    animations: {
      enabled: true,
      duration: 400,
      easing: 'easeInOut',
    },
  },
  {
    id: 'system-auto',
    name: 'System Auto',
    description: 'Automatically switches between light and dark',
    icon: Monitor,
    type: 'auto',
    colors: {
      primary: '#3b82f6',
      secondary: '#06b6d4',
      accent: '#8b5cf6',
      background: {
        primary: 'var(--system-bg-primary)',
        secondary: 'var(--system-bg-secondary)',
        tertiary: 'var(--system-bg-tertiary)',
      },
      text: {
        primary: 'var(--system-text-primary)',
        secondary: 'var(--system-text-secondary)',
        muted: 'var(--system-text-muted)',
      },
      border: {
        primary: 'var(--system-border-primary)',
        secondary: 'var(--system-border-secondary)',
      },
      status: {
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        secondary: 'var(--system-gradient-secondary)',
        accent: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      },
    },
    cssVariables: {
      '--theme-primary': '#3b82f6',
      '--theme-secondary': '#06b6d4',
      '--theme-accent': '#8b5cf6',
      '--theme-bg-primary': 'var(--system-bg-primary)',
      '--theme-bg-secondary': 'var(--system-bg-secondary)',
      '--theme-bg-tertiary': 'var(--system-bg-tertiary)',
      '--theme-text-primary': 'var(--system-text-primary)',
      '--theme-text-secondary': 'var(--system-text-secondary)',
      '--theme-text-muted': 'var(--system-text-muted)',
      '--theme-border-primary': 'var(--system-border-primary)',
      '--theme-border-secondary': 'var(--system-border-secondary)',
      '--theme-shadow': 'var(--system-shadow)',
      '--theme-glass': 'var(--system-glass)',
    },
    animations: {
      enabled: true,
      duration: 300,
      easing: 'easeInOut',
    },
  },
];

// Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Hook
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme Provider Component
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
  enableAnimations?: boolean;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'dark-modern',
  storageKey = 'monitoring-theme',
  enableAnimations = true,
}) => {
  const [currentThemeId, setCurrentThemeId] = useState<string>(defaultTheme);
  const [customTheme, setCustomTheme] = useState<Partial<Theme> | undefined>();
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  // Get current theme
  const currentTheme = customTheme?.id === currentThemeId 
    ? { ...defaultThemes.find(t => t.id === defaultTheme)!, ...customTheme } as Theme
    : defaultThemes.find(t => t.id === currentThemeId) || defaultThemes[0];

  // System preference detection
  useEffect(() => {
    const updateSystemPreference = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setSystemPreference(isDark ? 'dark' : 'light');
    };

    updateSystemPreference();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateSystemPreference);

    return () => mediaQuery.removeEventListener('change', updateSystemPreference);
  }, []);

  // Load theme from storage
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { themeId, customTheme: storedCustom } = JSON.parse(stored);
        setCurrentThemeId(themeId || defaultTheme);
        if (storedCustom) {
          setCustomTheme(storedCustom);
        }
      }
    } catch (error) {
      console.warn('Failed to load theme from storage:', error);
    }
  }, [storageKey, defaultTheme]);

  // Save theme to storage
  const saveTheme = useCallback((themeId: string, custom?: Partial<Theme>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        themeId,
        customTheme: custom,
      }));
    } catch (error) {
      console.warn('Failed to save theme to storage:', error);
    }
  }, [storageKey]);

  // Apply CSS variables
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    let themeToApply = currentTheme;

    // Handle auto theme
    if (currentTheme.type === 'auto') {
      const baseTheme = systemPreference === 'dark' 
        ? defaultThemes.find(t => t.id === 'dark-modern')!
        : defaultThemes.find(t => t.id === 'light-clean')!;
      
      // Set system variables
      Object.entries(baseTheme.cssVariables).forEach(([key, value]) => {
        const systemKey = key.replace('--theme-', '--system-');
        root.style.setProperty(systemKey, value);
      });
      
      themeToApply = { ...currentTheme, colors: baseTheme.colors };
    }

    // Apply theme variables
    Object.entries(themeToApply.cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Animation settings
    if (enableAnimations && themeToApply.animations) {
      root.style.setProperty('--theme-animation-duration', `${themeToApply.animations.duration}ms`);
      root.style.setProperty('--theme-animation-easing', themeToApply.animations.easing);
    }

  }, [currentTheme, systemPreference, mounted, enableAnimations]);

  // Theme functions
  const setTheme = useCallback((themeId: string) => {
    setCurrentThemeId(themeId);
    setCustomTheme(undefined);
    saveTheme(themeId);
  }, [saveTheme]);

  const toggleTheme = useCallback(() => {
    const currentIndex = defaultThemes.findIndex(t => t.id === currentThemeId);
    const nextIndex = (currentIndex + 1) % defaultThemes.length;
    setTheme(defaultThemes[nextIndex].id);
  }, [currentThemeId, setTheme]);

  const handleSetCustomTheme = useCallback((theme: Partial<Theme>) => {
    setCustomTheme(theme);
    if (theme.id) {
      setCurrentThemeId(theme.id);
      saveTheme(theme.id, theme);
    }
  }, [saveTheme]);

  const resetToDefault = useCallback(() => {
    setTheme(defaultTheme);
    setCustomTheme(undefined);
  }, [setTheme, defaultTheme]);

  const exportTheme = useCallback((theme?: Theme) => {
    const themeToExport = theme || currentTheme;
    return JSON.stringify(themeToExport, null, 2);
  }, [currentTheme]);

  const importTheme = useCallback((themeJson: string): boolean => {
    try {
      const importedTheme = JSON.parse(themeJson) as Theme;
      
      // Basic validation
      if (!importedTheme.id || !importedTheme.name || !importedTheme.colors) {
        return false;
      }

      handleSetCustomTheme(importedTheme);
      return true;
    } catch (error) {
      console.error('Failed to import theme:', error);
      return false;
    }
  }, [handleSetCustomTheme]);

  const contextValue: ThemeContextType = {
    currentTheme,
    themes: defaultThemes,
    setTheme,
    toggleTheme,
    systemPreference,
    customTheme,
    setCustomTheme: handleSetCustomTheme,
    resetToDefault,
    exportTheme,
    importTheme,
  };

  if (!mounted) {
    // Prevent hydration mismatch
    return null;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTheme.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: enableAnimations ? (currentTheme.animations?.duration || 300) / 1000 : 0,
            ease: currentTheme.animations?.easing || 'easeInOut'
          }}
          className="theme-container"
          data-theme={currentTheme.id}
          style={{
            '--current-theme-primary': currentTheme.colors.primary,
            '--current-theme-secondary': currentTheme.colors.secondary,
            '--current-theme-accent': currentTheme.colors.accent,
          } as React.CSSProperties}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </ThemeContext.Provider>
  );
};

// Theme Selector Component
export const ThemeSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { themes, currentTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all duration-200"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <currentTheme.icon className="w-4 h-4" />
        <span className="text-sm font-medium">{currentTheme.name}</span>
        <Palette className="w-4 h-4" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Theme Grid */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full mt-2 right-0 z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-2xl min-w-[400px]"
            >
              <div className="grid grid-cols-2 gap-3">
                {themes.map((theme) => {
                  const Icon = theme.icon;
                  const isSelected = theme.id === currentTheme.id;
                  
                  return (
                    <motion.button
                      key={theme.id}
                      onClick={() => {
                        setTheme(theme.id);
                        setIsOpen(false);
                      }}
                      className={`p-3 rounded-lg border-2 transition-all text-left group ${
                        isSelected
                          ? 'border-white/40 bg-white/10'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4" style={{ color: theme.colors.primary }} />
                        <span className="text-sm font-medium text-white truncate">
                          {theme.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mb-3 line-clamp-2">
                        {theme.description}
                      </p>
                      <div className="flex gap-1">
                        <div 
                          className="w-3 h-3 rounded-full border border-white/20"
                          style={{ backgroundColor: theme.colors.primary }}
                        />
                        <div 
                          className="w-3 h-3 rounded-full border border-white/20"
                          style={{ backgroundColor: theme.colors.secondary }}
                        />
                        <div 
                          className="w-3 h-3 rounded-full border border-white/20"
                          style={{ backgroundColor: theme.colors.accent }}
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Export default
export default ThemeProvider;