/**
 * Session Replay Implementation
 * 
 * Efficient session recording and replay system with intelligent compression
 * and privacy controls. Maintains <5MB storage per session.
 */

import { EventEmitter } from 'events';
import * as LZString from 'lz-string';

export interface SessionReplayConfig {
  /** Maximum session size in bytes */
  maxSessionSize?: number;
  /** Compression level (1-9) */
  compressionLevel?: number;
  /** Enable privacy masking */
  maskSensitiveData?: boolean;
  /** Sampling rate for events (0-1) */
  sampleRate?: number;
  /** Maximum recording duration in milliseconds */
  maxDuration?: number;
  /** Elements to mask */
  maskSelectors?: string[];
  /** Elements to ignore */
  ignoreSelectors?: string[];
  /** Enable network request recording */
  recordNetwork?: boolean;
  /** Enable console log recording */
  recordConsole?: boolean;
}

export interface SessionEvent {
  /** Event type */
  type: SessionEventType;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data: any;
  /** Event size in bytes */
  size?: number;
}

export type SessionEventType = 
  | 'dom_mutation'
  | 'mouse_move'
  | 'mouse_click'
  | 'key_press'
  | 'scroll'
  | 'resize'
  | 'focus'
  | 'blur'
  | 'input'
  | 'network_request'
  | 'console_log'
  | 'error'
  | 'performance_mark';

export interface SessionData {
  /** Session ID */
  sessionId: string;
  /** Session start time */
  startTime: number;
  /** Session end time */
  endTime?: number;
  /** Session duration */
  duration: number;
  /** Page URL */
  url: string;
  /** User agent */
  userAgent: string;
  /** Viewport size */
  viewport: { width: number; height: number };
  /** Session events */
  events: SessionEvent[];
  /** Compressed size */
  compressedSize: number;
  /** Uncompressed size */
  uncompressedSize: number;
  /** Metadata */
  metadata: {
    /** Event counts by type */
    eventCounts: Record<SessionEventType, number>;
    /** Performance metrics */
    performance: {
      /** Recording overhead in ms */
      recordingOverhead: number;
      /** Compression ratio */
      compressionRatio: number;
    };
  };
}

export interface ReplayOptions {
  /** Playback speed multiplier */
  speed?: number;
  /** Start from specific timestamp */
  startTime?: number;
  /** End at specific timestamp */
  endTime?: number;
  /** Skip certain event types */
  skipEvents?: SessionEventType[];
  /** Target container element */
  container?: HTMLElement;
}

export class SessionReplay extends EventEmitter {
  private config: Required<SessionReplayConfig>;
  private isRecording = false;
  private sessionId: string | null = null;
  private startTime: number = 0;
  private events: SessionEvent[] = [];
  private currentSize = 0;
  private observers: Map<string, any> = new Map();
  private eventListeners: Map<string, EventListener> = new Map();

  constructor(config: SessionReplayConfig = {}) {
    super();
    this.config = {
      maxSessionSize: 5 * 1024 * 1024, // 5MB
      compressionLevel: 6,
      maskSensitiveData: true,
      sampleRate: 1.0,
      maxDuration: 30 * 60 * 1000, // 30 minutes
      maskSelectors: [
        'input[type="password"]',
        'input[type="email"]',
        '[data-sensitive]',
        '.sensitive'
      ],
      ignoreSelectors: [
        '[data-ignore-replay]',
        '.ignore-replay'
      ],
      recordNetwork: true,
      recordConsole: true,
      ...config
    };
  }

  /**
   * Start recording session
   */
  async startRecording(): Promise<string> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    // Generate session ID
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.events = [];
    this.currentSize = 0;
    this.isRecording = true;

    // Record initial page state
    await this.recordInitialState();

    // Setup observers and listeners
    this.setupDOMObserver();
    this.setupEventListeners();
    
    if (this.config.recordNetwork) {
      this.setupNetworkRecording();
    }
    
    if (this.config.recordConsole) {
      this.setupConsoleRecording();
    }

    // Setup auto-stop timer
    setTimeout(() => {
      if (this.isRecording) {
        this.stopRecording();
      }
    }, this.config.maxDuration);

    this.emit('recordingStarted', { sessionId: this.sessionId });
    
    return this.sessionId;
  }

  /**
   * Stop recording session
   */
  async stopRecording(): Promise<SessionData> {
    if (!this.isRecording || !this.sessionId) {
      throw new Error('No recording in progress');
    }

    this.isRecording = false;
    const endTime = Date.now();

    // Cleanup observers and listeners
    this.cleanup();

    // Create session data
    const sessionData: SessionData = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      events: this.events,
      compressedSize: 0,
      uncompressedSize: 0,
      metadata: {
        eventCounts: this.calculateEventCounts(),
        performance: {
          recordingOverhead: 0, // TODO: Calculate actual overhead
          compressionRatio: 0
        }
      }
    };

    // Compress session data
    const compressed = await this.compressSessionData(sessionData);
    sessionData.compressedSize = compressed.length;
    sessionData.uncompressedSize = JSON.stringify(sessionData).length;
    sessionData.metadata.performance.compressionRatio = 
      sessionData.uncompressedSize / sessionData.compressedSize;

    this.emit('recordingStopped', sessionData);
    
    return sessionData;
  }

  /**
   * Get current session data
   */
  async getSessionData(): Promise<SessionData | null> {
    if (!this.sessionId) return null;

    const sessionData: SessionData = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      events: [...this.events],
      compressedSize: 0,
      uncompressedSize: 0,
      metadata: {
        eventCounts: this.calculateEventCounts(),
        performance: {
          recordingOverhead: 0,
          compressionRatio: 0
        }
      }
    };

    // Calculate sizes
    const uncompressedSize = JSON.stringify(sessionData).length;
    const compressedSize = (await this.compressSessionData(sessionData)).length;
    
    sessionData.uncompressedSize = uncompressedSize;
    sessionData.compressedSize = compressedSize;
    sessionData.metadata.performance.compressionRatio = uncompressedSize / compressedSize;

    return sessionData;
  }

  /**
   * Replay session
   */
  async replaySession(
    sessionData: SessionData | string, 
    options: ReplayOptions = {}
  ): Promise<void> {
    let data: SessionData;
    
    if (typeof sessionData === 'string') {
      data = await this.decompressSessionData(sessionData);
    } else {
      data = sessionData;
    }

    const replayOptions = {
      speed: 1.0,
      skipEvents: [],
      ...options
    };

    // Filter events based on options
    let events = data.events;
    
    if (replayOptions.startTime) {
      events = events.filter(e => e.timestamp >= replayOptions.startTime!);
    }
    
    if (replayOptions.endTime) {
      events = events.filter(e => e.timestamp <= replayOptions.endTime!);
    }
    
    events = events.filter(e => !replayOptions.skipEvents!.includes(e.type));

    // Start replay
    this.emit('replayStarted', { sessionId: data.sessionId });

    const startTime = Date.now();
    let eventIndex = 0;

    const playNextEvent = () => {
      if (eventIndex >= events.length) {
        this.emit('replayCompleted', { sessionId: data.sessionId });
        return;
      }

      const event = events[eventIndex];
      const expectedTime = startTime + (event.timestamp - data.startTime) / replayOptions.speed!;
      const currentTime = Date.now();
      const delay = Math.max(0, expectedTime - currentTime);

      setTimeout(() => {
        this.playEvent(event, replayOptions.container);
        eventIndex++;
        playNextEvent();
      }, delay);
    };

    playNextEvent();
  }

  /**
   * Pause/resume recording
   */
  pauseRecording(): void {
    if (!this.isRecording) return;
    
    // TODO: Implement pause functionality
    this.emit('recordingPaused');
  }

  resumeRecording(): void {
    if (!this.isRecording) return;
    
    // TODO: Implement resume functionality
    this.emit('recordingResumed');
  }

  // Private methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async recordInitialState(): Promise<void> {
    const event: SessionEvent = {
      type: 'dom_mutation',
      timestamp: Date.now(),
      data: {
        type: 'initial_state',
        html: this.serializeDOM(document.documentElement),
        css: this.extractCSS(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };

    this.addEvent(event);
  }

  private setupDOMObserver(): void {
    const observer = new MutationObserver((mutations) => {
      if (!this.isRecording) return;

      for (const mutation of mutations) {
        if (this.shouldIgnoreElement(mutation.target as Element)) {
          continue;
        }

        const event: SessionEvent = {
          type: 'dom_mutation',
          timestamp: Date.now(),
          data: {
            type: mutation.type,
            target: this.getElementSelector(mutation.target as Element),
            addedNodes: Array.from(mutation.addedNodes).map(node => 
              this.serializeNode(node)
            ),
            removedNodes: Array.from(mutation.removedNodes).map(node => 
              this.serializeNode(node)
            ),
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue
          }
        };

        this.addEvent(event);
      }
    });

    observer.observe(document, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
      characterDataOldValue: true
    });

    this.observers.set('dom', observer);
  }

  private setupEventListeners(): void {
    const events = [
      'click', 'mousemove', 'keypress', 'scroll', 'resize', 
      'focus', 'blur', 'input'
    ];

    events.forEach(eventType => {
      const listener = (e: Event) => {
        if (!this.isRecording) return;
        if (this.shouldIgnoreElement(e.target as Element)) return;

        // Sample events to reduce size
        if (eventType === 'mousemove' && Math.random() > this.config.sampleRate) {
          return;
        }

        const event: SessionEvent = {
          type: this.mapEventType(eventType),
          timestamp: Date.now(),
          data: this.serializeEvent(e)
        };

        this.addEvent(event);
      };

      document.addEventListener(eventType, listener, true);
      this.eventListeners.set(eventType, listener);
    });
  }

  private setupNetworkRecording(): void {
    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const response = await originalFetch(...args);
      
      if (this.isRecording) {
        const event: SessionEvent = {
          type: 'network_request',
          timestamp: startTime,
          data: {
            url: args[0],
            method: (args[1] as RequestInit)?.method || 'GET',
            status: response.status,
            duration: Date.now() - startTime,
            // Don't record response body to save space
            hasError: !response.ok
          }
        };
        
        this.addEvent(event);
      }
      
      return response;
    };

    // TODO: Intercept XMLHttpRequest as well
  }

  private setupConsoleRecording(): void {
    const originalMethods = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    ['log', 'warn', 'error'].forEach(method => {
      (console as any)[method] = (...args: any[]) => {
        if (this.isRecording) {
          const event: SessionEvent = {
            type: 'console_log',
            timestamp: Date.now(),
            data: {
              level: method,
              message: args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ')
            }
          };
          
          this.addEvent(event);
        }
        
        (originalMethods as any)[method].apply(console, args);
      };
    });
  }

  private addEvent(event: SessionEvent): void {
    // Calculate event size
    event.size = JSON.stringify(event).length;
    
    // Check if adding this event would exceed size limit
    if (this.currentSize + event.size > this.config.maxSessionSize) {
      // Remove oldest events to make room
      while (this.events.length > 0 && 
             this.currentSize + event.size > this.config.maxSessionSize) {
        const removed = this.events.shift();
        if (removed) {
          this.currentSize -= removed.size || 0;
        }
      }
    }

    this.events.push(event);
    this.currentSize += event.size;

    this.emit('eventRecorded', event);
  }

  private serializeDOM(element: Element): any {
    if (this.shouldIgnoreElement(element)) {
      return null;
    }

    const result: any = {
      tagName: element.tagName.toLowerCase(),
      attributes: {},
      children: []
    };

    // Serialize attributes
    for (const attr of element.attributes) {
      result.attributes[attr.name] = this.maskSensitiveAttribute(attr.name, attr.value);
    }

    // Serialize children
    for (const child of element.children) {
      const serialized = this.serializeDOM(child);
      if (serialized) {
        result.children.push(serialized);
      }
    }

    // Handle text content
    if (element.childNodes.length === 1 && 
        element.firstChild?.nodeType === Node.TEXT_NODE) {
      result.textContent = this.maskSensitiveText(element.textContent || '');
    }

    return result;
  }

  private serializeNode(node: Node): any {
    if (node.nodeType === Node.ELEMENT_NODE) {
      return this.serializeDOM(node as Element);
    } else if (node.nodeType === Node.TEXT_NODE) {
      return {
        nodeType: 'text',
        textContent: this.maskSensitiveText(node.textContent || '')
      };
    }
    return null;
  }

  private serializeEvent(event: Event): any {
    const data: any = {
      type: event.type,
      target: this.getElementSelector(event.target as Element)
    };

    // Add event-specific data
    if (event instanceof MouseEvent) {
      data.clientX = event.clientX;
      data.clientY = event.clientY;
      data.button = event.button;
    }

    if (event instanceof KeyboardEvent) {
      data.key = event.key;
      data.code = event.code;
      data.ctrlKey = event.ctrlKey;
      data.shiftKey = event.shiftKey;
      data.altKey = event.altKey;
    }

    if (event instanceof InputEvent && event.target instanceof HTMLInputElement) {
      data.value = this.maskSensitiveInput(event.target);
    }

    return data;
  }

  private shouldIgnoreElement(element: Element | null): boolean {
    if (!element) return true;
    
    return this.config.ignoreSelectors.some(selector => 
      element.matches && element.matches(selector)
    );
  }

  private maskSensitiveAttribute(name: string, value: string): string {
    if (!this.config.maskSensitiveData) return value;
    
    const sensitiveAttrs = ['data-sensitive', 'data-private'];
    if (sensitiveAttrs.includes(name)) {
      return '[MASKED]';
    }
    
    return value;
  }

  private maskSensitiveText(text: string): string {
    if (!this.config.maskSensitiveData) return text;
    
    // Simple masking - replace with asterisks but preserve length
    return '*'.repeat(Math.min(text.length, 20));
  }

  private maskSensitiveInput(input: HTMLInputElement): string {
    if (!this.config.maskSensitiveData) return input.value;
    
    const sensitiveTypes = ['password', 'email', 'tel'];
    if (sensitiveTypes.includes(input.type) || 
        this.config.maskSelectors.some(selector => input.matches(selector))) {
      return '[MASKED]';
    }
    
    return input.value;
  }

  private getElementSelector(element: Element | null): string {
    if (!element) return '';
    
    // Generate CSS selector for element
    const parts: string[] = [];
    
    while (element && element !== document.documentElement) {
      let part = element.tagName.toLowerCase();
      
      if (element.id) {
        part += `#${element.id}`;
        parts.unshift(part);
        break;
      }
      
      if (element.className) {
        const classes = element.className.split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          part += `.${classes.join('.')}`;
        }
      }
      
      // Add nth-child selector if needed
      const siblings = Array.from(element.parentElement?.children || []);
      const index = siblings.indexOf(element) + 1;
      if (siblings.length > 1) {
        part += `:nth-child(${index})`;
      }
      
      parts.unshift(part);
      element = element.parentElement;
    }
    
    return parts.join(' > ');
  }

  private extractCSS(): string {
    // Extract inline styles and critical CSS
    const styles: string[] = [];
    
    // Get all stylesheets
    for (const sheet of document.styleSheets) {
      try {
        if (sheet.href && !sheet.href.startsWith(window.location.origin)) {
          continue; // Skip external stylesheets
        }
        
        const rules = sheet.cssRules || sheet.rules;
        for (const rule of rules) {
          styles.push(rule.cssText);
        }
      } catch (e) {
        // Cross-origin stylesheet - skip
        continue;
      }
    }
    
    return styles.join('\n');
  }

  private mapEventType(eventType: string): SessionEventType {
    const mapping: Record<string, SessionEventType> = {
      'click': 'mouse_click',
      'mousemove': 'mouse_move',
      'keypress': 'key_press',
      'scroll': 'scroll',
      'resize': 'resize',
      'focus': 'focus',
      'blur': 'blur',
      'input': 'input'
    };
    
    return mapping[eventType] || 'dom_mutation';
  }

  private calculateEventCounts(): Record<SessionEventType, number> {
    const counts: Record<SessionEventType, number> = {
      'dom_mutation': 0,
      'mouse_move': 0,
      'mouse_click': 0,
      'key_press': 0,
      'scroll': 0,
      'resize': 0,
      'focus': 0,
      'blur': 0,
      'input': 0,
      'network_request': 0,
      'console_log': 0,
      'error': 0,
      'performance_mark': 0
    };
    
    this.events.forEach(event => {
      counts[event.type]++;
    });
    
    return counts;
  }

  private async compressSessionData(sessionData: SessionData): Promise<string> {
    const jsonString = JSON.stringify(sessionData);
    return LZString.compressToUTF16(jsonString);
  }

  private async decompressSessionData(compressedData: string): Promise<SessionData> {
    const jsonString = LZString.decompressFromUTF16(compressedData);
    if (!jsonString) {
      throw new Error('Failed to decompress session data');
    }
    return JSON.parse(jsonString);
  }

  private playEvent(event: SessionEvent, _container?: HTMLElement): void {
    // TODO: Implement event playback logic
    // _container parameter reserved for future event playback implementation
    this.emit('eventPlayed', event);
  }

  private cleanup(): void {
    // Cleanup observers
    this.observers.forEach(observer => {
      if (observer.disconnect) {
        observer.disconnect();
      }
    });
    this.observers.clear();

    // Cleanup event listeners
    this.eventListeners.forEach((listener, eventType) => {
      document.removeEventListener(eventType, listener, true);
    });
    this.eventListeners.clear();

    // TODO: Restore original console methods and fetch
  }
}

export default SessionReplay;