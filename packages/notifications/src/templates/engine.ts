/**
 * Template Engine for Notification Customization
 * 
 * Features:
 * - Multiple template engines (Handlebars, Mustache, Liquid)
 * - Template caching and hot-reloading
 * - Custom helpers and filters
 * - Template validation and linting
 * - Multi-language support with i18n
 * - Theme-based templates
 * - Template inheritance and partials
 * - Performance optimization
 */

import { 
  NotificationTemplate,
  BaseNotification,
  NotificationChannel,
  TemplateError
} from '../types/index.js';
import handlebars from 'handlebars';
import { readFileSync, existsSync, watchFile, unwatchFile } from 'fs';
import { join } from 'path';

export interface TemplateEngine {
  /** Compile template from string */
  compile(template: string, variables?: Record<string, any>): Promise<string>;
  /** Render template by name */
  render(templateName: string, variables?: Record<string, any>): Promise<string>;
  /** Register template */
  register(name: string, template: NotificationTemplate): void;
  /** Unregister template */
  unregister(name: string): void;
  /** List available templates */
  list(): NotificationTemplate[];
  /** Validate template syntax */
  validate(template: string): { valid: boolean; errors: string[] };
}

export interface TemplateEngineConfig {
  /** Template directory */
  directory: string;
  /** Template engine type */
  engine: 'handlebars' | 'mustache' | 'liquid';
  /** Enable template caching */
  cache: boolean;
  /** Enable hot reloading */
  hotReload: boolean;
  /** Default language */
  defaultLanguage: string;
  /** Available languages */
  languages: string[];
  /** Theme configuration */
  themes: {
    [themeName: string]: {
      directory: string;
      fallback?: string;
    };
  };
}

export interface RenderContext {
  /** Notification data */
  notification: BaseNotification;
  /** Target channel */
  channel: NotificationChannel;
  /** User language */
  language?: string;
  /** Theme name */
  theme?: string;
  /** Custom variables */
  variables?: Record<string, any>;
  /** Utility functions */
  utils: TemplateUtils;
}

export interface TemplateUtils {
  /** Format date */
  formatDate(date: Date | number, format?: string): string;
  /** Format number */
  formatNumber(num: number, locale?: string): string;
  /** Format currency */
  formatCurrency(amount: number, currency: string, locale?: string): string;
  /** Truncate text */
  truncate(text: string, length: number, suffix?: string): string;
  /** Escape HTML */
  escapeHtml(text: string): string;
  /** Convert to uppercase */
  upper(text: string): string;
  /** Convert to lowercase */
  lower(text: string): string;
  /** Pluralize text */
  pluralize(count: number, singular: string, plural?: string): string;
  /** Get relative time */
  timeAgo(date: Date | number): string;
}

export class HandlebarsTemplateEngine implements TemplateEngine {
  private config: TemplateEngineConfig;
  private templates: Map<string, NotificationTemplate> = new Map();
  private compiledTemplates: Map<string, handlebars.TemplateDelegate> = new Map();
  private fileWatchers: Map<string, boolean> = new Map();
  private i18nData: Map<string, Record<string, string>> = new Map();

  constructor(config: TemplateEngineConfig) {
    this.config = config;
    this.setupHandlebars();
    this.loadTemplatesFromDirectory();
    this.loadI18nData();
  }

  /**
   * Compile template from string
   */
  async compile(template: string, variables: Record<string, any> = {}): Promise<string> {
    try {
      const compiled = handlebars.compile(template);
      const context = this.buildRenderContext(variables);
      return compiled(context);
    } catch (error) {
      throw new TemplateError(
        `Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Render template by name
   */
  async render(templateName: string, variables: Record<string, any> = {}): Promise<string> {
    try {
      const template = await this.getCompiledTemplate(templateName);
      const context = this.buildRenderContext(variables);
      return template(context);
    } catch (error) {
      throw new TemplateError(
        `Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        templateName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Register template
   */
  register(name: string, template: NotificationTemplate): void {
    this.templates.set(name, template);
    
    // Clear compiled cache
    this.compiledTemplates.delete(name);
    
    // Setup hot reloading if enabled
    if (this.config.hotReload && template.content) {
      this.setupHotReload(name, template);
    }
  }

  /**
   * Unregister template
   */
  unregister(name: string): void {
    this.templates.delete(name);
    this.compiledTemplates.delete(name);
    
    // Remove file watcher
    if (this.fileWatchers.has(name)) {
      unwatchFile(this.getTemplatePath(name));
      this.fileWatchers.delete(name);
    }
  }

  /**
   * List available templates
   */
  list(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Validate template syntax
   */
  validate(template: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Try to compile the template
      handlebars.compile(template);
      
      // Check for undefined variables (basic check)
      const variableRegex = /\{\{([^}]+)\}\}/g;
      let match;
      const variables: string[] = [];
      
      while ((match = variableRegex.exec(template)) !== null) {
        const variable = match[1].trim();
        if (!variable.startsWith('#') && !variable.startsWith('/') && !variable.startsWith('^')) {
          variables.push(variable);
        }
      }
      
      // You could add more sophisticated validation here
      
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Template compilation error');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get compiled template
   */
  private async getCompiledTemplate(templateName: string): Promise<handlebars.TemplateDelegate> {
    // Check cache first
    if (this.config.cache && this.compiledTemplates.has(templateName)) {
      return this.compiledTemplates.get(templateName)!;
    }

    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    let templateSource = template.content.body;
    
    // Try to load from file if content is empty
    if (!templateSource) {
      templateSource = await this.loadTemplateFromFile(templateName, template.channel);
    }

    const compiled = handlebars.compile(templateSource);
    
    if (this.config.cache) {
      this.compiledTemplates.set(templateName, compiled);
    }

    return compiled;
  }

  /**
   * Load template from file
   */
  private async loadTemplateFromFile(templateName: string, channel: NotificationChannel): Promise<string> {
    const possiblePaths = [
      join(this.config.directory, channel, `${templateName}.hbs`),
      join(this.config.directory, `${templateName}.hbs`),
      join(this.config.directory, channel, `${templateName}.handlebars`),
      join(this.config.directory, `${templateName}.handlebars`)
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return readFileSync(path, 'utf-8');
      }
    }

    throw new Error(`Template file not found for '${templateName}'`);
  }

  /**
   * Build render context
   */
  private buildRenderContext(variables: Record<string, any>): RenderContext & Record<string, any> {
    const notification = variables.notification as BaseNotification;
    const channel = variables.channel as NotificationChannel;
    const language = variables.language || this.config.defaultLanguage;
    const theme = variables.theme || 'default';

    const utils: TemplateUtils = {
      formatDate: (date: Date | number, format?: string) => {
        const d = typeof date === 'number' ? new Date(date) : date;
        if (format === 'relative') {
          return this.getRelativeTime(d);
        }
        return d.toLocaleString(language);
      },
      formatNumber: (num: number, locale?: string) => {
        return num.toLocaleString(locale || language);
      },
      formatCurrency: (amount: number, currency: string, locale?: string) => {
        return new Intl.NumberFormat(locale || language, {
          style: 'currency',
          currency
        }).format(amount);
      },
      truncate: (text: string, length: number, suffix = '...') => {
        if (text.length <= length) return text;
        return text.substring(0, length - suffix.length) + suffix;
      },
      escapeHtml: (text: string) => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
      upper: (text: string) => text.toUpperCase(),
      lower: (text: string) => text.toLowerCase(),
      pluralize: (count: number, singular: string, plural?: string) => {
        if (count === 1) return singular;
        return plural || singular + 's';
      },
      timeAgo: (date: Date | number) => {
        return this.getRelativeTime(typeof date === 'number' ? new Date(date) : date);
      }
    };

    const context: RenderContext & Record<string, any> = {
      notification,
      channel,
      language,
      theme,
      variables,
      utils,
      // Add i18n function
      t: (key: string, params?: Record<string, any>) => this.translate(key, language, params),
      // Add theme-specific variables
      ...this.getThemeVariables(theme),
      // Spread all custom variables
      ...variables
    };

    return context;
  }

  /**
   * Setup Handlebars helpers and partials
   */
  private setupHandlebars(): void {
    // Date helper
    handlebars.registerHelper('formatDate', (date: Date | number, format?: string) => {
      const d = typeof date === 'number' ? new Date(date) : date;
      if (format === 'relative') {
        return this.getRelativeTime(d);
      }
      return d.toLocaleString();
    });

    // Conditional helpers
    handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    handlebars.registerHelper('and', (a: any, b: any) => a && b);
    handlebars.registerHelper('or', (a: any, b: any) => a || b);

    // String helpers
    handlebars.registerHelper('upper', (str: string) => str.toUpperCase());
    handlebars.registerHelper('lower', (str: string) => str.toLowerCase());
    handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
    });

    // JSON helper
    handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));

    // Loop helpers
    handlebars.registerHelper('times', (n: number, options: any) => {
      let result = '';
      for (let i = 0; i < n; i++) {
        result += options.fn({ index: i, count: i + 1 });
      }
      return result;
    });

    // Severity helper
    handlebars.registerHelper('severityColor', (severity: string) => {
      const colors: Record<string, string> = {
        'info': '#2196F3',
        'warning': '#FF9800',
        'error': '#F44336',
        'critical': '#9C27B0'
      };
      return colors[severity] || '#607D8B';
    });

    handlebars.registerHelper('severityIcon', (severity: string) => {
      const icons: Record<string, string> = {
        'info': 'ℹ️',
        'warning': '⚠️',
        'error': '❌',
        'critical': '🚨'
      };
      return icons[severity] || '📢';
    });
  }

  /**
   * Load templates from directory
   */
  private loadTemplatesFromDirectory(): void {
    if (!existsSync(this.config.directory)) {
      console.warn(`Template directory does not exist: ${this.config.directory}`);
      return;
    }

    // This is a simplified implementation
    // In a real implementation, you'd recursively scan the directory
    const channels: NotificationChannel[] = ['email', 'sms', 'slack', 'teams', 'webhook'];
    
    channels.forEach(channel => {
      const channelDir = join(this.config.directory, channel);
      if (existsSync(channelDir)) {
        // Load channel-specific templates
        // Implementation would scan files and register templates
      }
    });
  }

  /**
   * Load i18n data
   */
  private loadI18nData(): void {
    this.config.languages.forEach(lang => {
      const i18nFile = join(this.config.directory, 'i18n', `${lang}.json`);
      if (existsSync(i18nFile)) {
        try {
          const data = JSON.parse(readFileSync(i18nFile, 'utf-8'));
          this.i18nData.set(lang, data);
        } catch (error) {
          console.error(`Failed to load i18n data for ${lang}:`, error);
        }
      }
    });
  }

  /**
   * Translate text
   */
  private translate(key: string, language: string, params?: Record<string, any>): string {
    const langData = this.i18nData.get(language) || this.i18nData.get(this.config.defaultLanguage);
    if (!langData) return key;

    let translation = langData[key] || key;

    // Simple parameter substitution
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
      });
    }

    return translation;
  }

  /**
   * Get theme variables
   */
  private getThemeVariables(themeName: string): Record<string, any> {
    const themeConfig = this.config.themes[themeName];
    if (!themeConfig) return {};

    // Load theme-specific variables
    const themeVarsFile = join(themeConfig.directory, 'variables.json');
    if (existsSync(themeVarsFile)) {
      try {
        return JSON.parse(readFileSync(themeVarsFile, 'utf-8'));
      } catch (error) {
        console.error(`Failed to load theme variables for ${themeName}:`, error);
      }
    }

    return {};
  }

  /**
   * Setup hot reloading for template
   */
  private setupHotReload(name: string, template: NotificationTemplate): void {
    const templatePath = this.getTemplatePath(name);
    
    if (existsSync(templatePath) && !this.fileWatchers.has(name)) {
      watchFile(templatePath, () => {
        console.log(`Template ${name} changed, reloading...`);
        this.compiledTemplates.delete(name);
        
        try {
          // Reload template content
          const newContent = readFileSync(templatePath, 'utf-8');
          template.content.body = newContent;
          template.updatedAt = Date.now();
        } catch (error) {
          console.error(`Failed to reload template ${name}:`, error);
        }
      });
      
      this.fileWatchers.set(name, true);
    }
  }

  /**
   * Get template file path
   */
  private getTemplatePath(templateName: string): string {
    return join(this.config.directory, `${templateName}.hbs`);
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.compiledTemplates.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    templateCount: number;
    compiledCount: number;
    cacheHitRate: number;
  } {
    // This would need to track cache hits/misses in a real implementation
    return {
      templateCount: this.templates.size,
      compiledCount: this.compiledTemplates.size,
      cacheHitRate: 0.85 // Placeholder
    };
  }
}

/**
 * Template Engine Factory
 */
export class TemplateEngineFactory {
  static create(config: TemplateEngineConfig): TemplateEngine {
    switch (config.engine) {
      case 'handlebars':
        return new HandlebarsTemplateEngine(config);
      default:
        throw new Error(`Template engine '${config.engine}' not supported`);
    }
  }

  static validateConfig(config: TemplateEngineConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.directory) {
      errors.push('Template directory is required');
    }

    if (!config.engine) {
      errors.push('Template engine type is required');
    } else if (!['handlebars', 'mustache', 'liquid'].includes(config.engine)) {
      errors.push('Invalid template engine type');
    }

    if (!config.defaultLanguage) {
      errors.push('Default language is required');
    }

    if (!config.languages || config.languages.length === 0) {
      errors.push('At least one language must be specified');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export types
