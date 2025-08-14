import { 
  DashboardConfig, 
  BrandConfig, 
  DataSourceConfig, 
  AuthConfig, 
  EmbedConfig 
} from '@/types/monitoring';

// Environment variable helpers
function getEnvVar(key: string, defaultValue?: string): string | undefined {
  if (typeof window !== 'undefined') {
    return undefined; // Client-side should use NEXT_PUBLIC_ prefixed variables
  }
  return process.env[key] || defaultValue;
}

function getPublicEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[`NEXT_PUBLIC_${key}`] || getEnvVar(key, defaultValue);
}

function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = getPublicEnvVar(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = getPublicEnvVar(key);
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Default configuration
export const defaultConfig: DashboardConfig = {
  apiUrl: getPublicEnvVar('MONITORING_API_URL', 'http://localhost:4001') || 'http://localhost:4001',
  apiKey: getPublicEnvVar('MONITORING_API_KEY') || process.env.NEXT_PUBLIC_MONITORING_API_KEY,
  refreshInterval: getEnvNumber('REFRESH_INTERVAL', 5000),
  enableRealtime: getEnvBoolean('ENABLE_REALTIME', true),
  enableExport: getEnvBoolean('ENABLE_EXPORT', true),
  enableAlerts: getEnvBoolean('ENABLE_ALERTS', true),
  maxEvents: getEnvNumber('MAX_EVENTS_PER_REQUEST', 100),
  theme: {
    brandName: getPublicEnvVar('BRAND_NAME', 'Monitoring Dashboard') || 'Monitoring Dashboard',
    logoUrl: getPublicEnvVar('BRAND_LOGO_URL'),
    primaryColor: getPublicEnvVar('PRIMARY_COLOR', '#3b82f6') || '#3b82f6',
    secondaryColor: getPublicEnvVar('SECONDARY_COLOR', '#06b6d4') || '#06b6d4',
    accentColor: getPublicEnvVar('ACCENT_COLOR', '#8b5cf6') || '#8b5cf6',
    darkMode: getEnvBoolean('DARK_MODE', true),
  },
};

// Brand configuration
export const defaultBrandConfig: BrandConfig = {
  name: getPublicEnvVar('BRAND_NAME', 'Monitoring Dashboard') || 'Monitoring Dashboard',
  logo: getPublicEnvVar('BRAND_LOGO_URL') ? {
    url: getPublicEnvVar('BRAND_LOGO_URL')!,
    width: getEnvNumber('BRAND_LOGO_WIDTH', 120),
    height: getEnvNumber('BRAND_LOGO_HEIGHT', 40),
  } : undefined,
  colors: {
    primary: getPublicEnvVar('PRIMARY_COLOR', '#3b82f6') || '#3b82f6',
    secondary: getPublicEnvVar('SECONDARY_COLOR', '#06b6d4') || '#06b6d4',
    accent: getPublicEnvVar('ACCENT_COLOR', '#8b5cf6') || '#8b5cf6',
    background: getPublicEnvVar('BACKGROUND_COLOR'),
    text: getPublicEnvVar('TEXT_COLOR'),
  },
  fonts: {
    heading: getPublicEnvVar('FONT_HEADING', 'Inter, sans-serif') || 'Inter, sans-serif',
    body: getPublicEnvVar('FONT_BODY', 'Inter, sans-serif') || 'Inter, sans-serif',
  },
  customCss: getPublicEnvVar('CUSTOM_CSS'),
};

// Authentication configuration
export const authConfig: AuthConfig = {
  requireApiKey: getEnvBoolean('REQUIRE_API_KEY', false),
  adminApiKey: getEnvVar('ADMIN_API_KEY'),
  allowedOrigins: getPublicEnvVar('ALLOWED_ORIGINS', '*')?.split(',') || ['*'],
};

// Embed configuration
export const embedConfig: EmbedConfig = {
  allowedOrigins: getPublicEnvVar('ALLOWED_EMBED_ORIGINS', '*')?.split(',') || ['*'],
  timeout: getEnvNumber('EMBED_TIMEOUT', 30000),
  showHeader: getEnvBoolean('EMBED_SHOW_HEADER', false),
  showFilters: getEnvBoolean('EMBED_SHOW_FILTERS', true),
  showExport: getEnvBoolean('EMBED_SHOW_EXPORT', false),
  customCss: getPublicEnvVar('EMBED_CUSTOM_CSS'),
};

// Data source configurations
export function getDataSourceConfigs(): DataSourceConfig[] {
  const configs: DataSourceConfig[] = [];
  
  // Primary CrowdTrainer source
  if (getPublicEnvVar('PRIMARY_DATA_SOURCE') !== 'false') {
    configs.push({
      id: 'crowdtrainer',
      name: 'CrowdTrainer',
      type: 'crowdtrainer',
      endpoint: getPublicEnvVar('MONITORING_API_URL', 'http://localhost:4001') || 'http://localhost:4001',
      apiKey: getPublicEnvVar('MONITORING_API_KEY'),
      enabled: true,
      priority: 1,
    });
  }
  
  // External data sources
  const externalSources = getPublicEnvVar('EXTERNAL_DATA_SOURCES');
  if (externalSources) {
    try {
      const sources = JSON.parse(externalSources);
      sources.forEach((source: any, index: number) => {
        configs.push({
          id: source.id || `external-${index}`,
          name: source.name || `External Source ${index + 1}`,
          type: 'external',
          endpoint: source.endpoint,
          apiKey: source.apiKey,
          headers: source.headers,
          enabled: source.enabled !== false,
          priority: source.priority || index + 2,
        });
      });
    } catch (error) {
      console.error('Failed to parse external data sources:', error);
    }
  }
  
  return configs.sort((a, b) => a.priority - b.priority);
}

// Configuration validation
export function validateConfig(config: Partial<DashboardConfig>): string[] {
  const errors: string[] = [];
  
  if (config.apiUrl && !isValidUrl(config.apiUrl)) {
    errors.push('Invalid API URL format');
  }
  
  if (config.refreshInterval && config.refreshInterval < 1000) {
    errors.push('Refresh interval must be at least 1000ms');
  }
  
  if (config.maxEvents && (config.maxEvents < 1 || config.maxEvents > 1000)) {
    errors.push('Max events must be between 1 and 1000');
  }
  
  return errors;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url, window.location.origin);
    return true;
  } catch {
    return false;
  }
}

// Configuration merger
export function mergeConfigs(
  base: DashboardConfig,
  override: Partial<DashboardConfig>
): DashboardConfig {
  return {
    ...base,
    ...override,
    theme: {
      ...base.theme,
      ...override.theme,
    },
  };
}

// Configuration persistence (client-side)
export const configStorage = {
  save(key: string, config: any): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`monitoring-dashboard-${key}`, JSON.stringify(config));
      } catch (error) {
        console.warn('Failed to save configuration to localStorage:', error);
      }
    }
  },
  
  load<T>(key: string): T | null {
    if (typeof window !== 'undefined') {
      try {
        const item = localStorage.getItem(`monitoring-dashboard-${key}`);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.warn('Failed to load configuration from localStorage:', error);
        return null;
      }
    }
    return null;
  },
  
  remove(key: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`monitoring-dashboard-${key}`);
      } catch (error) {
        console.warn('Failed to remove configuration from localStorage:', error);
      }
    }
  },
  
  clear(): void {
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage).filter(key => 
          key.startsWith('monitoring-dashboard-')
        );
        keys.forEach(key => localStorage.removeItem(key));
      } catch (error) {
        console.warn('Failed to clear configuration from localStorage:', error);
      }
    }
  },
};

// Dynamic configuration loader for embed mode
export function loadEmbedConfig(searchParams: URLSearchParams): Partial<DashboardConfig> {
  const config: Partial<DashboardConfig> = {};
  
  // API configuration
  const apiUrl = searchParams.get('apiUrl');
  if (apiUrl) config.apiUrl = apiUrl;
  
  const apiKey = searchParams.get('apiKey');
  if (apiKey) config.apiKey = apiKey;
  
  // Theme configuration
  const theme: Partial<DashboardConfig['theme']> = {};
  
  const brandName = searchParams.get('brandName');
  if (brandName) theme.brandName = brandName;
  
  const primaryColor = searchParams.get('primaryColor');
  if (primaryColor) theme.primaryColor = primaryColor;
  
  const secondaryColor = searchParams.get('secondaryColor');
  if (secondaryColor) theme.secondaryColor = secondaryColor;
  
  const accentColor = searchParams.get('accentColor');
  if (accentColor) theme.accentColor = accentColor;
  
  if (Object.keys(theme).length > 0) {
    config.theme = theme;
  }
  
  // Feature flags
  const enableRealtime = searchParams.get('enableRealtime');
  if (enableRealtime !== null) config.enableRealtime = enableRealtime === 'true';
  
  const enableExport = searchParams.get('enableExport');
  if (enableExport !== null) config.enableExport = enableExport === 'true';
  
  const enableAlerts = searchParams.get('enableAlerts');
  if (enableAlerts !== null) config.enableAlerts = enableAlerts === 'true';
  
  return config;
}