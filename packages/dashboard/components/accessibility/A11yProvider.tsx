'use client';

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useRef, 
  useCallback,
  ReactNode
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Type,
  Contrast,
  Focus,
  MousePointer,
  Keyboard,
  Headphones,
  Navigation,
  Target,
  Accessibility,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  HelpCircle,
  Gauge,
  Activity,
  Zap,
  Shield,
  Users,
  BookOpen,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { useTheme } from '@/components/theme/ThemeProvider';

// Accessibility Types
export interface A11ySettings {
  // Visual
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  fontSize: number;
  focusIndicator: 'default' | 'enhanced' | 'high-contrast';
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'monochrome';
  
  // Audio
  screenReader: boolean;
  audioDescriptions: boolean;
  soundEffects: boolean;
  voiceNavigation: boolean;
  audioFeedback: boolean;
  
  // Motor
  stickyKeys: boolean;
  slowKeys: boolean;
  bounceKeys: boolean;
  mouseKeys: boolean;
  clickAssist: boolean;
  dragAssist: boolean;
  
  // Cognitive
  simpleMode: boolean;
  readingGuide: boolean;
  focusMode: boolean;
  timeoutExtension: boolean;
  contentSummary: boolean;
  
  // Navigation
  skipLinks: boolean;
  landmarkNavigation: boolean;
  headingNavigation: boolean;
  keyboardNavigation: boolean;
  voiceCommands: boolean;
}

export interface A11yFeatures {
  announcer: (message: string, priority?: 'polite' | 'assertive') => void;
  skipToContent: () => void;
  skipToNavigation: () => void;
  announcePageChange: (pageName: string) => void;
  announceError: (error: string) => void;
  announceSuccess: (message: string) => void;
  setFocusToElement: (selector: string) => void;
  createLandmarkMap: () => void;
  validateAccessibility: () => A11yViolation[];
  generateAccessibilityReport: () => A11yReport;
}

export interface A11yViolation {
  id: string;
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  element: string;
  description: string;
  recommendation: string;
  wcagRule: string;
  level: 'A' | 'AA' | 'AAA';
}

export interface A11yReport {
  score: number;
  level: 'A' | 'AA' | 'AAA';
  violations: A11yViolation[];
  passed: number;
  failed: number;
  warnings: number;
  timestamp: string;
  summary: {
    perceivable: number;
    operable: number;
    understandable: number;
    robust: number;
  };
}

export interface A11yContextType {
  settings: A11ySettings;
  updateSettings: (settings: Partial<A11ySettings>) => void;
  features: A11yFeatures;
  isScreenReader: boolean;
  isHighContrast: boolean;
  isReducedMotion: boolean;
  currentFocus: string | null;
  landmarks: HTMLElement[];
  headings: HTMLElement[];
  report: A11yReport | null;
  violations: A11yViolation[];
}

// Default Settings
const DEFAULT_SETTINGS: A11ySettings = {
  // Visual
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  fontSize: 16,
  focusIndicator: 'default',
  colorBlindMode: 'none',
  
  // Audio
  screenReader: false,
  audioDescriptions: false,
  soundEffects: true,
  voiceNavigation: false,
  audioFeedback: false,
  
  // Motor
  stickyKeys: false,
  slowKeys: false,
  bounceKeys: false,
  mouseKeys: false,
  clickAssist: false,
  dragAssist: false,
  
  // Cognitive
  simpleMode: false,
  readingGuide: false,
  focusMode: false,
  timeoutExtension: false,
  contentSummary: false,
  
  // Navigation
  skipLinks: true,
  landmarkNavigation: true,
  headingNavigation: true,
  keyboardNavigation: true,
  voiceCommands: false,
};

// Accessibility Context
const A11yContext = createContext<A11yContextType | undefined>(undefined);

// Hook to use accessibility context
export const useAccessibility = (): A11yContextType => {
  const context = useContext(A11yContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an A11yProvider');
  }
  return context;
};

// Screen Reader Announcer Component
const ScreenReaderAnnouncer: React.FC = () => {
  const [announcements, setAnnouncements] = useState<{
    message: string;
    priority: 'polite' | 'assertive';
    id: string;
  }[]>([]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const id = `announcement-${Date.now()}`;
    setAnnouncements(prev => [...prev, { message, priority, id }]);
    
    // Remove announcement after it's been read
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 3000);
  }, []);

  return (
    <>
      {announcements.map(({ message, priority, id }) => (
        <div
          key={id}
          aria-live={priority}
          aria-atomic="true"
          className="sr-only"
        >
          {message}
        </div>
      ))}
    </>
  );
};

// Skip Links Component
const SkipLinks: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  if (!enabled) return null;

  const skipToContent = () => {
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) {
      (main as HTMLElement).focus();
      main.scrollIntoView();
    }
  };

  const skipToNavigation = () => {
    const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (nav) {
      (nav as HTMLElement).focus();
      nav.scrollIntoView();
    }
  };

  return (
    <div className="skip-links">
      <button
        onClick={skipToContent}
        className="absolute top-0 left-0 z-50 px-4 py-2 bg-blue-600 text-white rounded-b-md transform -translate-y-full focus:translate-y-0 transition-transform"
      >
        Skip to main content
      </button>
      <button
        onClick={skipToNavigation}
        className="absolute top-0 left-32 z-50 px-4 py-2 bg-blue-600 text-white rounded-b-md transform -translate-y-full focus:translate-y-0 transition-transform"
      >
        Skip to navigation
      </button>
    </div>
  );
};

// Focus Management
const useFocusManagement = () => {
  const [currentFocus, setCurrentFocus] = useState<string | null>(null);
  const focusHistoryRef = useRef<string[]>([]);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (target) {
        const selector = target.tagName.toLowerCase() + 
          (target.id ? `#${target.id}` : '') +
          (target.className ? `.${target.className.split(' ').join('.')}` : '');
        setCurrentFocus(selector);
        focusHistoryRef.current.push(selector);
        
        // Limit history to last 10 focuses
        if (focusHistoryRef.current.length > 10) {
          focusHistoryRef.current.shift();
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, []);

  const setFocusToElement = useCallback((selector: string) => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return { currentFocus, setFocusToElement };
};

// Accessibility Validator
const useA11yValidator = () => {
  const [violations, setViolations] = useState<A11yViolation[]>([]);
  const [report, setReport] = useState<A11yReport | null>(null);

  const validateAccessibility = useCallback((): A11yViolation[] => {
    const violations: A11yViolation[] = [];
    
    // Check for missing alt attributes
    const images = document.querySelectorAll('img:not([alt])');
    images.forEach((img, index) => {
      violations.push({
        id: `img-alt-${index}`,
        type: 'error',
        severity: 'serious',
        element: `img${img.id ? '#' + img.id : ''}${img.className ? '.' + img.className.split(' ').join('.') : ''}`,
        description: 'Image missing alt attribute',
        recommendation: 'Add descriptive alt text to images',
        wcagRule: 'WCAG 2.1 - 1.1.1 Non-text Content',
        level: 'A',
      });
    });
    
    // Check for missing form labels
    const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
    inputs.forEach((input, index) => {
      const hasLabel = document.querySelector(`label[for="${input.id}"]`);
      if (!hasLabel) {
        violations.push({
          id: `input-label-${index}`,
          type: 'error',
          severity: 'serious',
          element: `input${input.id ? '#' + input.id : ''}`,
          description: 'Form input missing accessible label',
          recommendation: 'Add label element or aria-label attribute',
          wcagRule: 'WCAG 2.1 - 3.3.2 Labels or Instructions',
          level: 'A',
        });
      }
    });
    
    // Check color contrast (simplified)
    const checkContrast = (element: Element) => {
      const style = window.getComputedStyle(element);
      const color = style.color;
      const backgroundColor = style.backgroundColor;
      
      // This is a simplified check - in production, you'd use a proper contrast ratio calculator
      if (color && backgroundColor && color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        // Assuming contrast ratio calculation would happen here
        // For demo purposes, we'll flag certain combinations
        if (color.includes('rgb(128') && backgroundColor.includes('rgb(255')) {
          violations.push({
            id: `contrast-${element.tagName}-${Math.random()}`,
            type: 'error',
            severity: 'serious',
            element: element.tagName.toLowerCase(),
            description: 'Insufficient color contrast ratio',
            recommendation: 'Increase color contrast to meet WCAG AA standards (4.5:1)',
            wcagRule: 'WCAG 2.1 - 1.4.3 Contrast (Minimum)',
            level: 'AA',
          });
        }
      }
    };
    
    // Check headings hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    headings.forEach((heading, index) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      if (currentLevel > previousLevel + 1) {
        violations.push({
          id: `heading-hierarchy-${index}`,
          type: 'warning',
          severity: 'moderate',
          element: heading.tagName.toLowerCase(),
          description: 'Heading levels should not skip',
          recommendation: 'Use heading levels sequentially (h1, h2, h3, etc.)',
          wcagRule: 'WCAG 2.1 - 1.3.1 Info and Relationships',
          level: 'A',
        });
      }
      previousLevel = currentLevel;
    });
    
    // Check for keyboard focus indicators
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements.forEach((element, index) => {
      const style = window.getComputedStyle(element, ':focus');
      if (style.outline === 'none' && !style.boxShadow && !style.border) {
        violations.push({
          id: `focus-indicator-${index}`,
          type: 'warning',
          severity: 'serious',
          element: element.tagName.toLowerCase(),
          description: 'Focusable element missing visible focus indicator',
          recommendation: 'Add visible focus indicator (outline, box-shadow, or border)',
          wcagRule: 'WCAG 2.1 - 2.4.7 Focus Visible',
          level: 'AA',
        });
      }
    });
    
    // Check for ARIA attributes
    const elementsWithRole = document.querySelectorAll('[role]');
    elementsWithRole.forEach((element, index) => {
      const role = element.getAttribute('role');
      if (role === 'button' && !element.hasAttribute('aria-label') && !element.textContent?.trim()) {
        violations.push({
          id: `aria-button-${index}`,
          type: 'error',
          severity: 'serious',
          element: element.tagName.toLowerCase(),
          description: 'Button with role="button" missing accessible name',
          recommendation: 'Add aria-label or ensure button has text content',
          wcagRule: 'WCAG 2.1 - 4.1.2 Name, Role, Value',
          level: 'A',
        });
      }
    });
    
    setViolations(violations);
    return violations;
  }, []);

  const generateAccessibilityReport = useCallback((): A11yReport => {
    const violations = validateAccessibility();
    const errors = violations.filter(v => v.type === 'error').length;
    const warnings = violations.filter(v => v.type === 'warning').length;
    const total = errors + warnings;
    
    // Calculate score (simplified)
    const score = Math.max(0, 100 - (errors * 10) - (warnings * 5));
    
    // Determine level
    let level: 'A' | 'AA' | 'AAA' = 'AAA';
    if (errors > 0 || warnings > 5) level = 'AA';
    if (errors > 3 || warnings > 10) level = 'A';
    
    const report: A11yReport = {
      score,
      level,
      violations,
      passed: Math.max(0, 50 - total), // Simplified calculation
      failed: errors,
      warnings,
      timestamp: new Date().toISOString(),
      summary: {
        perceivable: Math.max(0, 25 - violations.filter(v => v.wcagRule.includes('1.')).length * 5),
        operable: Math.max(0, 25 - violations.filter(v => v.wcagRule.includes('2.')).length * 5),
        understandable: Math.max(0, 25 - violations.filter(v => v.wcagRule.includes('3.')).length * 5),
        robust: Math.max(0, 25 - violations.filter(v => v.wcagRule.includes('4.')).length * 5),
      },
    };
    
    setReport(report);
    return report;
  }, [validateAccessibility]);

  return { violations, report, validateAccessibility, generateAccessibilityReport };
};

// Accessibility Provider Component
export interface A11yProviderProps {
  children: ReactNode;
  initialSettings?: Partial<A11ySettings>;
  onSettingsChange?: (settings: A11ySettings) => void;
}

export const A11yProvider: React.FC<A11yProviderProps> = ({
  children,
  initialSettings = {},
  onSettingsChange,
}) => {
  const { currentTheme } = useTheme();
  const [settings, setSettings] = useState<A11ySettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });
  const [landmarks, setLandmarks] = useState<HTMLElement[]>([]);
  const [headings, setHeadings] = useState<HTMLElement[]>([]);
  
  const announcerRef = useRef<((message: string, priority?: 'polite' | 'assertive') => void) | null>(null);
  const { currentFocus, setFocusToElement } = useFocusManagement();
  const { violations, report, validateAccessibility, generateAccessibilityReport } = useA11yValidator();

  // Detect system preferences
  const [isScreenReader, setIsScreenReader] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    // Detect screen reader
    const detectScreenReader = () => {
      const hasScreenReader = !!(
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        navigator.userAgent.includes('VoiceOver') ||
        window.speechSynthesis?.getVoices().length > 0
      );
      setIsScreenReader(hasScreenReader || settings.screenReader);
    };

    // Detect high contrast mode
    const detectHighContrast = () => {
      const highContrast = window.matchMedia('(prefers-contrast: high)').matches;
      setIsHighContrast(highContrast || settings.highContrast);
    };

    // Detect reduced motion preference
    const detectReducedMotion = () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setIsReducedMotion(reducedMotion || settings.reducedMotion);
    };

    detectScreenReader();
    detectHighContrast();
    detectReducedMotion();

    // Set up media query listeners
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    contrastQuery.addEventListener('change', detectHighContrast);
    motionQuery.addEventListener('change', detectReducedMotion);

    return () => {
      contrastQuery.removeEventListener('change', detectHighContrast);
      motionQuery.removeEventListener('change', detectReducedMotion);
    };
  }, [settings.screenReader, settings.highContrast, settings.reducedMotion]);

  // Update CSS custom properties based on settings
  useEffect(() => {
    const root = document.documentElement;
    
    // Font size
    root.style.setProperty('--a11y-font-size', `${settings.fontSize}px`);
    
    // High contrast
    if (isHighContrast) {
      root.style.setProperty('--a11y-bg-primary', '#000000');
      root.style.setProperty('--a11y-bg-secondary', '#1a1a1a');
      root.style.setProperty('--a11y-text-primary', '#ffffff');
      root.style.setProperty('--a11y-text-secondary', '#e0e0e0');
      root.style.setProperty('--a11y-border', '#ffffff');
      root.style.setProperty('--a11y-focus', '#ffff00');
    } else {
      // Use theme colors
      root.style.setProperty('--a11y-bg-primary', currentTheme.colors.background);
      root.style.setProperty('--a11y-bg-secondary', currentTheme.colors.card);
      root.style.setProperty('--a11y-text-primary', currentTheme.colors.text);
      root.style.setProperty('--a11y-text-secondary', currentTheme.colors.text);
      root.style.setProperty('--a11y-border', currentTheme.colors.border);
      root.style.setProperty('--a11y-focus', currentTheme.colors.primary);
    }
    
    // Focus indicator style
    const focusStyle = settings.focusIndicator === 'enhanced' 
      ? '3px solid var(--a11y-focus), 0 0 0 6px rgba(59, 130, 246, 0.3)'
      : settings.focusIndicator === 'high-contrast'
      ? '4px solid #ffff00, 0 0 0 8px #000000'
      : '2px solid var(--a11y-focus)';
    
    root.style.setProperty('--a11y-focus-outline', focusStyle);
    
    // Color blind filters
    if (settings.colorBlindMode !== 'none') {
      const filters = {
        protanopia: 'url(#protanopia)',
        deuteranopia: 'url(#deuteranopia)',
        tritanopia: 'url(#tritanopia)',
        monochrome: 'grayscale(100%)',
      };
      root.style.setProperty('filter', filters[settings.colorBlindMode]);
    } else {
      root.style.removeProperty('filter');
    }
    
    // Motion preference
    if (isReducedMotion) {
      root.style.setProperty('--a11y-animation-duration', '0s');
      root.style.setProperty('--a11y-transition-duration', '0s');
    } else {
      root.style.setProperty('--a11y-animation-duration', '0.3s');
      root.style.setProperty('--a11y-transition-duration', '0.2s');
    }
  }, [settings, isHighContrast, isReducedMotion, currentTheme]);

  // Scan for landmarks and headings
  const createLandmarkMap = useCallback(() => {
    const landmarkSelectors = [
      'main', '[role="main"]',
      'nav', '[role="navigation"]',
      'header', '[role="banner"]',
      'footer', '[role="contentinfo"]',
      'aside', '[role="complementary"]',
      'section', '[role="region"]',
      '[role="search"]',
      '[role="form"]',
    ];
    
    const foundLandmarks: HTMLElement[] = [];
    landmarkSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
      foundLandmarks.push(...Array.from(elements));
    });
    
    setLandmarks(foundLandmarks);
    
    // Headings
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6') as NodeListOf<HTMLElement>;
    setHeadings(Array.from(headingElements));
  }, []);

  // Update settings function
  const updateSettings = useCallback((newSettings: Partial<A11ySettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      if (onSettingsChange) {
        onSettingsChange(updated);
      }
      return updated;
    });
  }, [onSettingsChange]);

  // Announcement function
  const announcer = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcerRef.current) {
      announcerRef.current(message, priority);
    }
  }, []);

  // Navigation helpers
  const skipToContent = useCallback(() => {
    const main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (main) {
      (main as HTMLElement).focus();
      main.scrollIntoView({ behavior: 'smooth' });
      announcer('Moved to main content');
    }
  }, [announcer]);

  const skipToNavigation = useCallback(() => {
    const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
    if (nav) {
      (nav as HTMLElement).focus();
      nav.scrollIntoView({ behavior: 'smooth' });
      announcer('Moved to navigation');
    }
  }, [announcer]);

  const announcePageChange = useCallback((pageName: string) => {
    announcer(`Page changed to ${pageName}`, 'assertive');
  }, [announcer]);

  const announceError = useCallback((error: string) => {
    announcer(`Error: ${error}`, 'assertive');
  }, [announcer]);

  const announceSuccess = useCallback((message: string) => {
    announcer(`Success: ${message}`, 'polite');
  }, [announcer]);

  // Features object
  const features: A11yFeatures = {
    announcer,
    skipToContent,
    skipToNavigation,
    announcePageChange,
    announceError,
    announceSuccess,
    setFocusToElement,
    createLandmarkMap,
    validateAccessibility,
    generateAccessibilityReport,
  };

  // Context value
  const contextValue: A11yContextType = {
    settings,
    updateSettings,
    features,
    isScreenReader,
    isHighContrast,
    isReducedMotion,
    currentFocus,
    landmarks,
    headings,
    report,
    violations,
  };

  // Scan for landmarks on mount and when content changes
  useEffect(() => {
    createLandmarkMap();
    
    // Set up MutationObserver to detect content changes
    const observer = new MutationObserver(() => {
      createLandmarkMap();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role'],
    });
    
    return () => observer.disconnect();
  }, [createLandmarkMap]);

  return (
    <A11yContext.Provider value={contextValue}>
      {/* Color blind SVG filters */}
      <svg className="sr-only" aria-hidden="true">
        <defs>
          <filter id="protanopia">
            <feColorMatrix type="matrix" values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0" />
          </filter>
          <filter id="deuteranopia">
            <feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0" />
          </filter>
          <filter id="tritanopia">
            <feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0" />
          </filter>
        </defs>
      </svg>
      
      {/* Screen Reader Announcer */}
      <ScreenReaderAnnouncer ref={(ref: any) => {
        if (ref?.announce) announcerRef.current = ref.announce;
      }} />
      
      {/* Skip Links */}
      <SkipLinks enabled={settings.skipLinks} />
      
      {/* Main Content */}
      <div 
        className={`a11y-container ${
          settings.largeText ? 'text-lg' : ''
        } ${
          settings.simpleMode ? 'simple-mode' : ''
        } ${
          isHighContrast ? 'high-contrast' : ''
        } ${
          isReducedMotion ? 'reduced-motion' : ''
        }`}
      >
        {children}
      </div>
    </A11yContext.Provider>
  );
};

// Accessibility Dashboard Component
export interface A11yDashboardProps {
  onClose?: () => void;
  className?: string;
}

export const A11yDashboard: React.FC<A11yDashboardProps> = ({ onClose, className = '' }) => {
  const { settings, updateSettings, features, violations, report, isScreenReader, isHighContrast, isReducedMotion } = useAccessibility();
  const [activeTab, setActiveTab] = useState<'settings' | 'report' | 'violations'>('settings');
  const [scanInProgress, setScanInProgress] = useState(false);

  const runAccessibilityScan = async () => {
    setScanInProgress(true);
    features.announcer('Starting accessibility scan');
    
    setTimeout(() => {
      features.generateAccessibilityReport();
      setScanInProgress(false);
      features.announcer(`Accessibility scan completed. Score: ${report?.score || 0}`);
    }, 2000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'serious': return '#ea580c';
      case 'moderate': return '#d97706';
      case 'minor': return '#65a30d';
      default: return '#6b7280';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#22c55e';
    if (score >= 80) return '#84cc16';
    if (score >= 70) return '#eab308';
    if (score >= 60) return '#f97316';
    return '#ef4444';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 ${className}`}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Accessibility className="w-6 h-6 text-blue-400" />
              Accessibility Dashboard
            </h2>
            <div className="flex items-center gap-4">
              {/* System Detection Status */}
              <div className="flex items-center gap-2 text-sm">
                {isScreenReader && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-full">
                    <Volume2 className="w-3 h-3" />
                    <span>Screen Reader</span>
                  </div>
                )}
                {isHighContrast && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full">
                    <Contrast className="w-3 h-3" />
                    <span>High Contrast</span>
                  </div>
                )}
                {isReducedMotion && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                    <Activity className="w-3 h-3" />
                    <span>Reduced Motion</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-white/10 mb-6">
            {[
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'report', label: 'Report', icon: Gauge },
              { id: 'violations', label: `Violations (${violations.length})`, icon: AlertTriangle },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          
          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'settings' && (
                <div className="space-y-6">
                  {/* Visual Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-400" />
                      Visual
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.highContrast}
                          onChange={(e) => updateSettings({ highContrast: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">High contrast mode</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.reducedMotion}
                          onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Reduce motion</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.largeText}
                          onChange={(e) => updateSettings({ largeText: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Large text</span>
                      </label>
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-white mb-2">
                        Font Size: {settings.fontSize}px
                      </label>
                      <input
                        type="range"
                        min="12"
                        max="24"
                        value={settings.fontSize}
                        onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-white mb-2">
                        Focus Indicator
                      </label>
                      <select
                        value={settings.focusIndicator}
                        onChange={(e) => updateSettings({ focusIndicator: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="default" className="bg-gray-800">Default</option>
                        <option value="enhanced" className="bg-gray-800">Enhanced</option>
                        <option value="high-contrast" className="bg-gray-800">High Contrast</option>
                      </select>
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-white mb-2">
                        Color Blind Support
                      </label>
                      <select
                        value={settings.colorBlindMode}
                        onChange={(e) => updateSettings({ colorBlindMode: e.target.value as any })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="none" className="bg-gray-800">None</option>
                        <option value="protanopia" className="bg-gray-800">Protanopia</option>
                        <option value="deuteranopia" className="bg-gray-800">Deuteranopia</option>
                        <option value="tritanopia" className="bg-gray-800">Tritanopia</option>
                        <option value="monochrome" className="bg-gray-800">Monochrome</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Audio Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                      <Volume2 className="w-5 h-5 text-green-400" />
                      Audio
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.screenReader}
                          onChange={(e) => updateSettings({ screenReader: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Screen reader support</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.audioFeedback}
                          onChange={(e) => updateSettings({ audioFeedback: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Audio feedback</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.soundEffects}
                          onChange={(e) => updateSettings({ soundEffects: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Sound effects</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.voiceNavigation}
                          onChange={(e) => updateSettings({ voiceNavigation: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Voice navigation</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Navigation Settings */}
                  <div>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                      <Navigation className="w-5 h-5 text-purple-400" />
                      Navigation
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.skipLinks}
                          onChange={(e) => updateSettings({ skipLinks: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Skip links</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.keyboardNavigation}
                          onChange={(e) => updateSettings({ keyboardNavigation: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Keyboard navigation</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.landmarkNavigation}
                          onChange={(e) => updateSettings({ landmarkNavigation: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Landmark navigation</span>
                      </label>
                      
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={settings.headingNavigation}
                          onChange={(e) => updateSettings({ headingNavigation: e.target.checked })}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500/50"
                        />
                        <span className="text-white">Heading navigation</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'report' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">Accessibility Report</h3>
                    <button
                      onClick={runAccessibilityScan}
                      disabled={scanInProgress}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {scanInProgress ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Activity className="w-4 h-4" />
                        </motion.div>
                      ) : (
                        <Target className="w-4 h-4" />
                      )}
                      {scanInProgress ? 'Scanning...' : 'Run Scan'}
                    </button>
                  </div>
                  
                  {report ? (
                    <div className="space-y-6">
                      {/* Overall Score */}
                      <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xl font-semibold text-white">Overall Score</h4>
                          <div className="flex items-center gap-2">
                            <div 
                              className="text-3xl font-bold"
                              style={{ color: getScoreColor(report.score) }}
                            >
                              {report.score}
                            </div>
                            <div className="text-lg text-gray-400">/100</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-white">{report.passed} Passed</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-white">{report.failed} Failed</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-yellow-400" />
                            <span className="text-white">{report.warnings} Warnings</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-400" />
                            <span className="text-white">WCAG {report.level} Level</span>
                          </div>
                        </div>
                      </GlassCard>
                      
                      {/* WCAG Principles */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { name: 'Perceivable', score: report.summary.perceivable, icon: Eye },
                          { name: 'Operable', score: report.summary.operable, icon: MousePointer },
                          { name: 'Understandable', score: report.summary.understandable, icon: BookOpen },
                          { name: 'Robust', score: report.summary.robust, icon: Shield },
                        ].map(principle => {
                          const Icon = principle.icon;
                          return (
                            <GlassCard key={principle.name} className="p-4 text-center">
                              <Icon className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                              <div className="text-lg font-semibold text-white mb-1">
                                {principle.score}/25
                              </div>
                              <div className="text-sm text-gray-400">
                                {principle.name}
                              </div>
                            </GlassCard>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400 mb-4">No accessibility report available</p>
                      <p className="text-sm text-gray-500">Run a scan to generate an accessibility report</p>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'violations' && (
                <div className="space-y-4">
                  {violations.length > 0 ? (
                    violations.map((violation, index) => (
                      <motion.div
                        key={violation.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-lg border border-white/10 bg-white/5"
                      >
                        <div className="flex items-start gap-3">
                          <div 
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: getSeverityColor(violation.severity) }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-white">{violation.description}</h4>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                violation.type === 'error' ? 'bg-red-500/20 text-red-300' :
                                violation.type === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-blue-500/20 text-blue-300'
                              }`}>
                                {violation.type}
                              </span>
                              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-300 rounded-full capitalize">
                                {violation.severity}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-300 mb-2">
                              <strong>Element:</strong> {violation.element}
                            </p>
                            
                            <p className="text-sm text-blue-300 mb-2">
                              <strong>Recommendation:</strong> {violation.recommendation}
                            </p>
                            
                            <p className="text-xs text-gray-400">
                              {violation.wcagRule} ({violation.level} Level)
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                      <p className="text-green-300 mb-2">No accessibility violations found!</p>
                      <p className="text-sm text-gray-400">Your dashboard meets accessibility standards</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
};

export default A11yProvider;