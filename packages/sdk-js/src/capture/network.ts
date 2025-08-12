import type { NetworkCaptureData, Breadcrumb } from '../types';
import { now, isBrowser } from '../utils';

/**
 * Network capture functionality
 */
export class NetworkCapture {
  private isEnabled: boolean = false;
  private listeners: Array<(request: NetworkCaptureData) => void> = [];
  private originalFetch?: typeof fetch;
  private originalXHROpen?: typeof XMLHttpRequest.prototype.open;
  private originalXHRSend?: typeof XMLHttpRequest.prototype.send;

  constructor() {
    this.patchFetch = this.patchFetch.bind(this);
    this.patchXHR = this.patchXHR.bind(this);
  }

  /** Start capturing network requests */
  start(): void {
    if (!isBrowser() || this.isEnabled) return;

    this.isEnabled = true;
    this.patchFetch();
    this.patchXHR();
  }

  /** Stop capturing network requests */
  stop(): void {
    if (!this.isEnabled) return;

    this.isEnabled = false;
    this.unpatchFetch();
    this.unpatchXHR();
  }

  /** Add network listener */
  addListener(listener: (request: NetworkCaptureData) => void): void {
    this.listeners.push(listener);
  }

  /** Remove network listener */
  removeListener(listener: (request: NetworkCaptureData) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /** Manually capture a network request */
  captureRequest(request: NetworkCaptureData): void {
    this.notifyListeners(request);
  }

  /** Patch fetch API */
  private patchFetch(): void {
    if (typeof fetch === 'undefined') return;

    this.originalFetch = fetch;

    const self = this;
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const startTime = now();
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';

      return self.originalFetch!.call(this, input, init)
        .then((response) => {
          const endTime = now();
          const duration = endTime - startTime;

          const networkCapture: NetworkCaptureData = {
            url,
            method: method.toUpperCase(),
            status: response.status,
            duration,
            timestamp: startTime,
          };

          // Try to get request/response sizes
          if (init?.body) {
            networkCapture.requestSize = self.getBodySize(init.body);
          }

          // Response size from headers (if available)
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            networkCapture.responseSize = parseInt(contentLength, 10);
          }

          self.notifyListeners(networkCapture);
          return response;
        })
        .catch((error) => {
          const endTime = now();
          const duration = endTime - startTime;

          const networkCapture: NetworkCaptureData = {
            url,
            method: method.toUpperCase(),
            status: 0, // Network error
            duration,
            timestamp: startTime,
          };

          self.notifyListeners(networkCapture);
          throw error;
        });
    };
  }

  /** Unpatch fetch API */
  private unpatchFetch(): void {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      delete this.originalFetch;
    }
  }

  /** Patch XMLHttpRequest */
  private patchXHR(): void {
    if (typeof XMLHttpRequest === 'undefined') return;

    const self = this;

    // Store original methods
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;

    // Patch open method
    XMLHttpRequest.prototype.open = function(
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      password?: string | null
    ) {
      (this as any).__monitoring = {
        method: method.toUpperCase(),
        url: url.toString(),
        startTime: 0,
      };

      return self.originalXHROpen!.call(this, method, url, async ?? true, user, password);
    };

    // Patch send method
    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      const monitoring = (this as any).__monitoring;
      if (!monitoring) {
        return self.originalXHRSend!.call(this, body);
      }

      monitoring.startTime = now();
      
      // Add request size
      if (body) {
        monitoring.requestSize = self.getBodySize(body);
      }

      // Add event listeners
      const handleResponse = () => {
        const endTime = now();
        const duration = endTime - monitoring.startTime;

        const networkCapture: NetworkCaptureData = {
          url: monitoring.url,
          method: monitoring.method,
          status: this.status,
          duration,
          timestamp: monitoring.startTime,
          requestSize: monitoring.requestSize,
        };

        // Try to get response size
        const contentLength = this.getResponseHeader('content-length');
        if (contentLength) {
          networkCapture.responseSize = parseInt(contentLength, 10);
        }

        self.notifyListeners(networkCapture);
      };

      this.addEventListener('load', handleResponse);
      this.addEventListener('error', handleResponse);
      this.addEventListener('abort', handleResponse);
      this.addEventListener('timeout', handleResponse);

      return self.originalXHRSend!.call(this, body);
    };
  }

  /** Unpatch XMLHttpRequest */
  private unpatchXHR(): void {
    if (this.originalXHROpen) {
      XMLHttpRequest.prototype.open = this.originalXHROpen;
      delete this.originalXHROpen;
    }

    if (this.originalXHRSend) {
      XMLHttpRequest.prototype.send = this.originalXHRSend;
      delete this.originalXHRSend;
    }
  }

  /** Get size of request body */
  private getBodySize(body: any): number | undefined {
    if (!body) return undefined;

    if (typeof body === 'string') {
      return new Blob([body]).size;
    }

    if (body instanceof FormData) {
      // FormData size is harder to calculate, approximate
      return undefined;
    }

    if (body instanceof Blob) {
      return body.size;
    }

    if (body instanceof ArrayBuffer) {
      return body.byteLength;
    }

    if (body instanceof URLSearchParams) {
      return new Blob([body.toString()]).size;
    }

    // For other types, try to stringify
    try {
      return new Blob([JSON.stringify(body)]).size;
    } catch {
      return undefined;
    }
  }

  /** Notify all listeners of network request */
  private notifyListeners(request: NetworkCaptureData): void {
    this.listeners.forEach(listener => {
      try {
        listener(request);
      } catch (err) {
        console.warn('Monitor SDK: Error in network listener:', err);
      }
    });
  }

  /** Check if network capture is enabled */
  isActive(): boolean {
    return this.isEnabled;
  }

  /** Filter requests by URL pattern */
  shouldCapture(url: string): boolean {
    // Don't capture requests to monitoring API itself
    return !url.includes('/monitoring/') && !url.includes('/events');
  }

  /** Get statistics for captured requests */
  getStats(requests: NetworkCaptureData[]): {
    total: number;
    failed: number;
    slow: number;
    averageDuration: number;
  } {
    const total = requests.length;
    const failed = requests.filter(r => r.status >= 400 || r.status === 0).length;
    const slow = requests.filter(r => r.duration > 3000).length; // >3s
    const averageDuration = requests.reduce((sum, r) => sum + r.duration, 0) / total || 0;

    return { total, failed, slow, averageDuration };
  }

  /** Generate breadcrumb from network request */
  static toBreadcrumb(request: NetworkCaptureData): Breadcrumb {
    return {
      timestamp: request.timestamp,
      type: 'http',
      message: `${request.method} ${request.url} ${request.status}`,
      data: {
        method: request.method,
        status: request.status,
        duration: request.duration,
        url: request.url,
        requestSize: request.requestSize,
        responseSize: request.responseSize,
      },
    };
  }
}