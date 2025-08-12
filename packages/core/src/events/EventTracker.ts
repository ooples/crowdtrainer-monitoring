/**
 * Event tracking system for monitoring SDK
 */

import { 
  BaseEvent, 
  PageViewEvent, 
  ClickEvent, 
  FormSubmitEvent, 
  CustomEvent,
  Context,
  JSONValue,
  Logger,
  Plugin
} from '../types/index.js';
import { generateId, getCurrentTimestamp } from '../utils/index.js';

export interface EventTrackerConfig {
  /** Maximum events in buffer before forcing flush */
  maxBufferSize?: number;
  /** Enable automatic page view tracking */
  autoTrackPageViews?: boolean;
  /** Enable automatic click tracking */
  autoTrackClicks?: boolean;
  /** Enable automatic form tracking */
  autoTrackForms?: boolean;
  /** Event sampling rate (0-1) */
  sampleRate?: number;
  /** Logger instance */
  logger?: Logger;
  /** Plugins to apply to events */
  plugins?: Plugin[];
}

export class EventTracker {
  private config: Required<EventTrackerConfig>;
  private eventBuffer: BaseEvent[] = [];
  private context: Context = {};
  private listeners: Map<string, Array<(event: Event) => void>> = new Map();
  private isDestroyed = false;

  constructor(config: EventTrackerConfig = {}) {
    this.config = {
      maxBufferSize: config.maxBufferSize ?? 100,
      autoTrackPageViews: config.autoTrackPageViews ?? false,
      autoTrackClicks: config.autoTrackClicks ?? false,
      autoTrackForms: config.autoTrackForms ?? false,
      sampleRate: config.sampleRate ?? 1.0,
      logger: config.logger ?? console,
      plugins: config.plugins ?? []
    };

    this.setupAutoTracking();
  }

  /**
   * Track a generic event
   */
  track(eventData: Omit<BaseEvent, 'id' | 'timestamp'>): void {
    if (this.isDestroyed) {
      this.config.logger.warn('EventTracker: Cannot track event - tracker is destroyed');
      return;
    }

    // Apply sampling
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const event: BaseEvent = {
      id: generateId(),
      timestamp: getCurrentTimestamp(),
      context: { ...this.context, ...eventData.context },
      ...eventData
    };

    // Apply plugins
    const processedEvent = this.applyPlugins(event);
    if (!processedEvent) {
      return; // Event was filtered out by plugins
    }

    this.config.logger.debug('EventTracker: Tracking event', processedEvent);
    this.eventBuffer.push(processedEvent);

    if (this.eventBuffer.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Track page view event
   */
  trackPageView(url: string, title?: string, referrer?: string, loadTime?: number): void {
    const event: Omit<PageViewEvent, 'id' | 'timestamp'> = {
      type: 'page_view',
      category: 'navigation',
      url,
      title,
      referrer,
      loadTime
    };

    this.track(event);
  }

  /**
   * Track click event
   */
  trackClick(selector?: string, text?: string, coordinates?: { x: number; y: number }): void {
    const event: Omit<ClickEvent, 'id' | 'timestamp'> = {
      type: 'click',
      category: 'interaction',
      selector,
      text,
      coordinates
    };

    this.track(event);
  }

  /**
   * Track form submit event
   */
  trackFormSubmit(selector?: string, fieldCount?: number, errors?: string[]): void {
    const event: Omit<FormSubmitEvent, 'id' | 'timestamp'> = {
      type: 'form_submit',
      category: 'interaction',
      selector,
      fieldCount,
      errors
    };

    this.track(event);
  }

  /**
   * Track custom event
   */
  trackCustom(name: string, properties?: Record<string, JSONValue>, category?: string): void {
    const event: Omit<CustomEvent, 'id' | 'timestamp'> = {
      type: 'custom',
      category: category ?? 'custom',
      name,
      properties
    };

    this.track(event);
  }

  /**
   * Set global context
   */
  setContext(context: Partial<Context>): void {
    this.context = { ...this.context, ...context };
    this.config.logger.debug('EventTracker: Context updated', this.context);
  }

  /**
   * Get current context
   */
  getContext(): Context {
    return { ...this.context };
  }

  /**
   * Get events from buffer
   */
  getEvents(): BaseEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Flush events from buffer
   */
  flush(): BaseEvent[] {
    const events = [...this.eventBuffer];
    this.eventBuffer = [];
    this.config.logger.debug(`EventTracker: Flushed ${events.length} events`);
    return events;
  }

  /**
   * Clear event buffer
   */
  clear(): void {
    this.eventBuffer = [];
    this.config.logger.debug('EventTracker: Buffer cleared');
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EventTrackerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Re-setup auto tracking if configuration changed
    if (config.autoTrackPageViews !== undefined ||
        config.autoTrackClicks !== undefined ||
        config.autoTrackForms !== undefined) {
      this.removeAutoTracking();
      this.setupAutoTracking();
    }
  }

  /**
   * Destroy event tracker
   */
  destroy(): void {
    this.removeAutoTracking();
    this.eventBuffer = [];
    this.context = {};
    this.isDestroyed = true;
    this.config.logger.debug('EventTracker: Destroyed');
  }

  /**
   * Apply plugins to event
   */
  private applyPlugins(event: BaseEvent): BaseEvent | null {
    let processedEvent = event;

    for (const plugin of this.config.plugins) {
      if (plugin.handlers?.onEvent) {
        const result = plugin.handlers.onEvent(processedEvent);
        if (result === null) {
          return null; // Plugin filtered out the event
        }
        processedEvent = result;
      }
    }

    return processedEvent;
  }

  /**
   * Setup automatic event tracking
   */
  private setupAutoTracking(): void {
    if (typeof window === 'undefined') {
      return; // Not in browser environment
    }

    if (this.config.autoTrackPageViews) {
      this.setupPageViewTracking();
    }

    if (this.config.autoTrackClicks) {
      this.setupClickTracking();
    }

    if (this.config.autoTrackForms) {
      this.setupFormTracking();
    }
  }

  /**
   * Setup page view tracking
   */
  private setupPageViewTracking(): void {
    // Track initial page view
    this.trackPageView(window.location.href, document.title, document.referrer);

    // Track navigation changes (for SPAs)
    const handlePopState = () => {
      this.trackPageView(window.location.href, document.title);
    };

    window.addEventListener('popstate', handlePopState);
    this.listeners.set('popstate', [handlePopState]);

    // Override history methods for SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => {
        window.dispatchEvent(new Event('locationchange'));
      }, 0);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => {
        window.dispatchEvent(new Event('locationchange'));
      }, 0);
    };

    const handleLocationChange = () => {
      this.trackPageView(window.location.href, document.title);
    };

    window.addEventListener('locationchange', handleLocationChange);
    this.listeners.set('locationchange', [handleLocationChange]);
  }

  /**
   * Setup click tracking
   */
  private setupClickTracking(): void {
    const handleClick = (event: Event) => {
      if (!(event instanceof MouseEvent) || !event.target) {
        return;
      }

      const target = event.target as Element;
      const selector = this.getElementSelector(target);
      const text = target.textContent?.trim().substring(0, 100);
      const coordinates = { x: event.clientX, y: event.clientY };

      this.trackClick(selector, text, coordinates);
    };

    document.addEventListener('click', handleClick, true);
    this.listeners.set('click', [handleClick]);
  }

  /**
   * Setup form tracking
   */
  private setupFormTracking(): void {
    const handleFormSubmit = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement)) {
        return;
      }

      const form = event.target;
      const selector = this.getElementSelector(form);
      const fieldCount = form.elements.length;
      const errors: string[] = [];

      // Check for validation errors
      for (let i = 0; i < form.elements.length; i++) {
        const element = form.elements[i] as HTMLInputElement;
        if (element.validationMessage) {
          errors.push(`${element.name}: ${element.validationMessage}`);
        }
      }

      this.trackFormSubmit(selector, fieldCount, errors.length > 0 ? errors : undefined);
    };

    document.addEventListener('submit', handleFormSubmit, true);
    this.listeners.set('submit', [handleFormSubmit]);
  }

  /**
   * Remove automatic event tracking
   */
  private removeAutoTracking(): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Remove all event listeners
    this.listeners.forEach((listeners, eventType) => {
      listeners.forEach(listener => {
        if (eventType === 'click' || eventType === 'submit') {
          document.removeEventListener(eventType, listener, true);
        } else {
          window.removeEventListener(eventType, listener);
        }
      });
    });

    this.listeners.clear();
  }

  /**
   * Get CSS selector for element
   */
  private getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }

    // Fallback to tag name with nth-child
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${index})`;
    }

    return element.tagName.toLowerCase();
  }
}