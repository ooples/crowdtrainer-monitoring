import type { MonitorEvent } from '../types';
import { hasBeaconAPI, safeStringify } from '../utils';

/**
 * Beacon-based transport for sending monitoring data during page unload
 */
export class BeaconTransport {
  private apiUrl: string;
  private projectId: string;

  constructor(apiUrl: string, projectId: string) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.projectId = projectId;
  }

  /** Send single event using beacon */
  send(event: MonitorEvent): boolean {
    return this.sendBatch([event]);
  }

  /** Send multiple events in batch using beacon */
  sendBatch(events: MonitorEvent[]): boolean {
    if (!this.isAvailable() || events.length === 0) {
      return false;
    }

    const payload = {
      projectId: this.projectId,
      events: events,
      timestamp: Date.now(),
    };

    const url = `${this.apiUrl}/events`;
    const blob = new Blob([safeStringify(payload)], {
      type: 'application/json',
    });

    try {
      return navigator.sendBeacon(url, blob);
    } catch (error) {
      console.warn('Monitor SDK: Beacon send failed:', error);
      return false;
    }
  }

  /** Check if beacon API is available */
  isAvailable(): boolean {
    return hasBeaconAPI();
  }

  /** Send data on page visibility change or beforeunload */
  setupPageUnloadHandler(getEvents: () => MonitorEvent[]): void {
    if (!this.isAvailable()) return;

    const sendPendingEvents = () => {
      const events = getEvents();
      if (events.length > 0) {
        this.sendBatch(events);
      }
    };

    // Use page visibility API if available
    if ('visibilityState' in document) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          sendPendingEvents();
        }
      });
    }

    // Fallback to beforeunload (less reliable)
    window.addEventListener('beforeunload', sendPendingEvents);

    // Also handle page freeze/resume (mobile Safari)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        // Page restored from back-forward cache
      }
    });

    window.addEventListener('pagehide', (event) => {
      if (event.persisted) {
        // Page might be restored, send events
        sendPendingEvents();
      }
    });
  }

  /** Update API URL */
  setApiUrl(apiUrl: string): void {
    this.apiUrl = apiUrl.replace(/\/$/, '');
  }

  /** Update project ID */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /** Get maximum payload size for beacon (usually 64KB) */
  getMaxPayloadSize(): number {
    // Most browsers support 64KB, but be conservative
    return 60 * 1024; // 60KB
  }

  /** Check if payload size is within limits */
  canSendPayload(events: MonitorEvent[]): boolean {
    if (!this.isAvailable()) return false;

    const payload = {
      projectId: this.projectId,
      events: events,
      timestamp: Date.now(),
    };

    const size = new Blob([safeStringify(payload)]).size;
    return size <= this.getMaxPayloadSize();
  }

  /** Split large batches into smaller chunks */
  splitBatch(events: MonitorEvent[]): MonitorEvent[][] {
    if (events.length === 0) return [];
    if (this.canSendPayload(events)) return [events];

    const chunks: MonitorEvent[][] = [];
    let currentChunk: MonitorEvent[] = [];

    for (const event of events) {
      currentChunk.push(event);
      
      if (!this.canSendPayload(currentChunk)) {
        // Remove the last event and start a new chunk
        const lastEvent = currentChunk.pop()!;
        if (currentChunk.length > 0) {
          chunks.push([...currentChunk]);
        }
        currentChunk = [lastEvent];
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}