import type { MonitorEvent, TransportOptions } from '../types';
import { safeStringify } from '../utils';

/**
 * Fetch-based transport for sending monitoring data
 */
export class FetchTransport {
  private apiUrl: string;
  private projectId: string;
  private options: Required<TransportOptions>;

  constructor(
    apiUrl: string,
    projectId: string,
    options: TransportOptions = {}
  ) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.projectId = projectId;
    this.options = {
      timeout: 5000,
      retries: 3,
      useBeacon: false,
      ...options,
    };
  }

  /** Send single event */
  async send(event: MonitorEvent): Promise<boolean> {
    return this.sendBatch([event]);
  }

  /** Send multiple events in batch */
  async sendBatch(events: MonitorEvent[]): Promise<boolean> {
    if (events.length === 0) return true;

    const payload = {
      projectId: this.projectId,
      events: events,
      timestamp: Date.now(),
    };

    return this.makeRequest('/events', payload);
  }

  /** Make HTTP request with retries */
  private async makeRequest(endpoint: string, data: any): Promise<boolean> {
    const url = `${this.apiUrl}${endpoint}`;
    const body = safeStringify(data);

    for (let attempt = 0; attempt <= this.options.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.options.timeout
        );

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Project-ID': this.projectId,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return true;
        }

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          console.warn(`Monitor SDK: Client error ${response.status}`);
          return false;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        const isLastAttempt = attempt === this.options.retries;
        
        if (isLastAttempt) {
          console.warn('Monitor SDK: Failed to send events after retries:', error);
          return false;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this.sleep(delay);
      }
    }

    return false;
  }

  /** Sleep for specified milliseconds */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Check if transport is available */
  isAvailable(): boolean {
    return typeof fetch !== 'undefined';
  }

  /** Update API URL */
  setApiUrl(apiUrl: string): void {
    this.apiUrl = apiUrl.replace(/\/$/, '');
  }

  /** Update project ID */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /** Update transport options */
  setOptions(options: Partial<TransportOptions>): void {
    this.options = { ...this.options, ...options };
  }
}