/**
 * Debug Timeline Visualizer
 * 
 * Interactive React component that visualizes all events leading to an error
 * in a chronological timeline with filtering, zooming, and detailed views.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { TraceJourney } from '../tracing/distributed';
import type { SessionData, SessionEvent } from '../replay/session';
import type { CorrelationResult } from '../correlation/logs';
import type { ErrorData } from '../clustering/errors';
import type { CodeInsight } from '../insights/code';

export interface TimelineEvent {
  /** Event ID */
  id: string;
  /** Event timestamp */
  timestamp: number;
  /** Event type */
  type: TimelineEventType;
  /** Event source */
  source: 'trace' | 'session' | 'log' | 'error' | 'code';
  /** Event title */
  title: string;
  /** Event description */
  description: string;
  /** Event severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Event duration (for span events) */
  duration?: number;
  /** Event metadata */
  metadata: Record<string, any>;
  /** Child events */
  children?: TimelineEvent[];
}

export type TimelineEventType = 
  | 'trace_start'
  | 'trace_end'
  | 'span_start'
  | 'span_end'
  | 'user_action'
  | 'network_request'
  | 'error'
  | 'log'
  | 'performance'
  | 'code_change';

export interface TimelineConfig {
  /** Timeline height */
  height?: number;
  /** Show minimap */
  showMinimap?: boolean;
  /** Enable event clustering */
  enableClustering?: boolean;
  /** Default zoom level */
  defaultZoom?: number;
  /** Color scheme */
  colorScheme?: 'light' | 'dark';
  /** Event filters */
  eventFilters?: TimelineEventType[];
  /** Show performance metrics */
  showPerformance?: boolean;
}

export interface TimelineData {
  /** Primary error */
  error: ErrorData;
  /** Trace journey */
  traceJourney?: TraceJourney;
  /** Session data */
  sessionData?: SessionData;
  /** Log correlations */
  correlations?: CorrelationResult[];
  /** Code insights */
  codeInsights?: CodeInsight;
  /** Timeline events */
  events: TimelineEvent[];
  /** Time range */
  timeRange: {
    start: number;
    end: number;
  };
}

export interface TimelineVisualizerProps {
  /** Timeline data */
  data: TimelineData;
  /** Configuration */
  config?: TimelineConfig;
  /** Event click handler */
  onEventClick?: (event: TimelineEvent) => void;
  /** Time range change handler */
  onTimeRangeChange?: (start: number, end: number) => void;
  /** Export handler */
  onExport?: (format: 'png' | 'svg' | 'json') => void;
}

const DEFAULT_CONFIG: Required<TimelineConfig> = {
  height: 600,
  showMinimap: true,
  enableClustering: true,
  defaultZoom: 1,
  colorScheme: 'light',
  eventFilters: [],
  showPerformance: true
};

const EVENT_COLORS = {
  trace_start: '#4CAF50',
  trace_end: '#4CAF50',
  span_start: '#2196F3',
  span_end: '#2196F3',
  user_action: '#FF9800',
  network_request: '#9C27B0',
  error: '#F44336',
  log: '#607D8B',
  performance: '#00BCD4',
  code_change: '#8BC34A'
};

const SEVERITY_COLORS = {
  low: '#4CAF50',
  medium: '#FF9800',
  high: '#FF5722',
  critical: '#F44336'
};

export const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({
  data,
  config = {},
  onEventClick,
  onTimeRangeChange,
  onExport
}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [zoom, setZoom] = useState(finalConfig.defaultZoom);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [visibleTimeRange, setVisibleTimeRange] = useState(data.timeRange);
  const [filters, setFilters] = useState<Set<TimelineEventType>>(
    new Set(finalConfig.eventFilters)
  );
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    return data.events
      .filter(event => {
        // Apply type filters
        if (filters.size > 0 && !filters.has(event.type)) {
          return false;
        }
        
        // Apply search filter
        if (searchTerm && !event.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !event.description.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        // Apply time range filter
        if (event.timestamp < visibleTimeRange.start || 
            event.timestamp > visibleTimeRange.end) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data.events, filters, searchTerm, visibleTimeRange]);

  // Calculate timeline dimensions
  const timelineDimensions = useMemo(() => {
    const totalDuration = data.timeRange.end - data.timeRange.start;
    const visibleDuration = visibleTimeRange.end - visibleTimeRange.start;
    const pixelsPerMs = (800 * zoom) / visibleDuration; // 800px base width
    
    return {
      totalDuration,
      visibleDuration,
      pixelsPerMs,
      width: Math.max(800, totalDuration * pixelsPerMs / 1000)
    };
  }, [data.timeRange, visibleTimeRange, zoom]);

  // Event position calculator
  const getEventPosition = useCallback((event: TimelineEvent) => {
    const relativeTime = event.timestamp - visibleTimeRange.start;
    return (relativeTime * timelineDimensions.pixelsPerMs) / 1000;
  }, [visibleTimeRange, timelineDimensions]);

  // Handle event click
  const handleEventClick = useCallback((event: TimelineEvent) => {
    setSelectedEvent(event);
    onEventClick?.(event);
  }, [onEventClick]);

  // Handle zoom
  const handleZoom = useCallback((delta: number, centerTime?: number) => {
    const newZoom = Math.max(0.1, Math.min(10, zoom + delta));
    setZoom(newZoom);
    
    if (centerTime) {
      // Adjust visible range to center on the specified time
      const currentCenter = (visibleTimeRange.start + visibleTimeRange.end) / 2;
      const offset = centerTime - currentCenter;
      const newStart = visibleTimeRange.start + offset;
      const newEnd = visibleTimeRange.end + offset;
      
      setVisibleTimeRange({ start: newStart, end: newEnd });
      onTimeRangeChange?.(newStart, newEnd);
    }
  }, [zoom, visibleTimeRange, onTimeRangeChange]);

  // Handle pan - TODO: Implement pan gesture support
  // const handlePan = useCallback((deltaTime: number) => {
  //   const newStart = Math.max(data.timeRange.start, visibleTimeRange.start + deltaTime);
  //   const newEnd = Math.min(data.timeRange.end, visibleTimeRange.end + deltaTime);
  //   
  //   if (newEnd - newStart === visibleTimeRange.end - visibleTimeRange.start) {
  //     setVisibleTimeRange({ start: newStart, end: newEnd });
  //     onTimeRangeChange?.(newStart, newEnd);
  //   }
  // }, [data.timeRange, visibleTimeRange, onTimeRangeChange]);

  // Event lanes assignment (for better visualization)
  const eventLanes = useMemo(() => {
    const lanes: TimelineEvent[][] = [];
    const sortedEvents = [...filteredEvents].sort((a, b) => a.timestamp - b.timestamp);
    
    for (const event of sortedEvents) {
      // Find the first lane where this event fits
      let assignedLane = -1;
      
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const lastEventInLane = lane[lane.length - 1];
        
        if (!lastEventInLane || 
            event.timestamp > (lastEventInLane.timestamp + (lastEventInLane.duration || 0))) {
          assignedLane = i;
          break;
        }
      }
      
      // If no existing lane fits, create a new one
      if (assignedLane === -1) {
        lanes.push([]);
        assignedLane = lanes.length - 1;
      }
      
      lanes[assignedLane].push(event);
    }
    
    return lanes;
  }, [filteredEvents]);

  return (
    <div className={`timeline-visualizer ${finalConfig.colorScheme}`}>
      {/* Header */}
      <div className="timeline-header">
        <h2>Debug Timeline - {data.error.message}</h2>
        
        {/* Controls */}
        <div className="timeline-controls">
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <div className="zoom-controls">
            <button onClick={() => handleZoom(-0.5)}>-</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => handleZoom(0.5)}>+</button>
          </div>
          
          <button onClick={() => setVisibleTimeRange(data.timeRange)}>
            Reset View
          </button>
          
          {onExport && (
            <div className="export-controls">
              <button onClick={() => onExport('png')}>PNG</button>
              <button onClick={() => onExport('svg')}>SVG</button>
              <button onClick={() => onExport('json')}>JSON</button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="timeline-filters">
        {Object.keys(EVENT_COLORS).map(eventType => (
          <label key={eventType} className="filter-checkbox">
            <input
              type="checkbox"
              checked={!filters.has(eventType as TimelineEventType)}
              onChange={(e) => {
                const newFilters = new Set(filters);
                if (e.target.checked) {
                  newFilters.delete(eventType as TimelineEventType);
                } else {
                  newFilters.add(eventType as TimelineEventType);
                }
                setFilters(newFilters);
              }}
            />
            <span 
              className="filter-color" 
              style={{ backgroundColor: EVENT_COLORS[eventType as TimelineEventType] }}
            />
            {eventType.replace('_', ' ')}
          </label>
        ))}
      </div>

      {/* Main Timeline */}
      <div className="timeline-main" style={{ height: finalConfig.height }}>
        {/* Time axis */}
        <div className="timeline-axis">
          {Array.from({ length: 10 }, (_, i) => {
            const time = visibleTimeRange.start + 
              (i * (visibleTimeRange.end - visibleTimeRange.start)) / 9;
            const position = getEventPosition({ timestamp: time } as TimelineEvent);
            
            return (
              <div
                key={i}
                className="time-marker"
                style={{ left: position }}
              >
                {new Date(time).toLocaleTimeString()}
              </div>
            );
          })}
        </div>

        {/* Event lanes */}
        <div className="timeline-lanes">
          {eventLanes.map((lane, laneIndex) => (
            <div key={laneIndex} className="timeline-lane">
              {lane.map(event => {
                const position = getEventPosition(event);
                const width = event.duration 
                  ? (event.duration * timelineDimensions.pixelsPerMs) / 1000
                  : 20; // Minimum width for point events
                
                return (
                  <div
                    key={event.id}
                    className={`timeline-event ${event.type} ${event.severity}`}
                    style={{
                      left: position,
                      width: width,
                      backgroundColor: EVENT_COLORS[event.type],
                      borderColor: SEVERITY_COLORS[event.severity]
                    }}
                    onClick={() => handleEventClick(event)}
                    title={`${event.title}: ${event.description}`}
                  >
                    <div className="event-content">
                      <div className="event-title">{event.title}</div>
                      {event.duration && (
                        <div className="event-duration">
                          {event.duration}ms
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Error marker */}
        <div
          className="error-marker"
          style={{ left: getEventPosition({ timestamp: data.error.timestamp } as TimelineEvent) }}
        >
          <div className="error-line" />
          <div className="error-label">ERROR</div>
        </div>
      </div>

      {/* Minimap */}
      {finalConfig.showMinimap && (
        <div className="timeline-minimap">
          <div className="minimap-track">
            {data.events.map(event => (
              <div
                key={event.id}
                className="minimap-event"
                style={{
                  left: `${((event.timestamp - data.timeRange.start) / 
                    (data.timeRange.end - data.timeRange.start)) * 100}%`,
                  backgroundColor: EVENT_COLORS[event.type]
                }}
              />
            ))}
          </div>
          <div
            className="minimap-viewport"
            style={{
              left: `${((visibleTimeRange.start - data.timeRange.start) / 
                (data.timeRange.end - data.timeRange.start)) * 100}%`,
              width: `${((visibleTimeRange.end - visibleTimeRange.start) / 
                (data.timeRange.end - data.timeRange.start)) * 100}%`
            }}
          />
        </div>
      )}

      {/* Event details panel */}
      {selectedEvent && (
        <div className="event-details-panel">
          <div className="panel-header">
            <h3>{selectedEvent.title}</h3>
            <button onClick={() => setSelectedEvent(null)}>×</button>
          </div>
          
          <div className="panel-content">
            <div className="detail-row">
              <label>Type:</label>
              <span className={`event-type ${selectedEvent.type}`}>
                {selectedEvent.type}
              </span>
            </div>
            
            <div className="detail-row">
              <label>Time:</label>
              <span>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
            </div>
            
            <div className="detail-row">
              <label>Source:</label>
              <span>{selectedEvent.source}</span>
            </div>
            
            <div className="detail-row">
              <label>Severity:</label>
              <span className={`severity ${selectedEvent.severity}`}>
                {selectedEvent.severity}
              </span>
            </div>
            
            {selectedEvent.duration && (
              <div className="detail-row">
                <label>Duration:</label>
                <span>{selectedEvent.duration}ms</span>
              </div>
            )}
            
            <div className="detail-row">
              <label>Description:</label>
              <span>{selectedEvent.description}</span>
            </div>
            
            {Object.keys(selectedEvent.metadata).length > 0 && (
              <div className="metadata-section">
                <label>Metadata:</label>
                <pre>{JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance metrics */}
      {finalConfig.showPerformance && (
        <div className="performance-metrics">
          <div className="metric">
            <label>Total Events:</label>
            <span>{data.events.length}</span>
          </div>
          
          <div className="metric">
            <label>Visible Events:</label>
            <span>{filteredEvents.length}</span>
          </div>
          
          <div className="metric">
            <label>Timeline Duration:</label>
            <span>{Math.round(data.timeRange.end - data.timeRange.start)}ms</span>
          </div>
          
          <div className="metric">
            <label>Error Rate:</label>
            <span>
              {Math.round(
                (data.events.filter(e => e.type === 'error').length / data.events.length) * 100
              )}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Utility functions for creating timeline events
export const createTimelineEventsFromTrace = (traceJourney: TraceJourney): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  
  // Add trace start/end events
  events.push({
    id: `trace-start-${traceJourney.traceId}`,
    timestamp: traceJourney.rootSpan.startTime,
    type: 'trace_start',
    source: 'trace',
    title: 'Trace Started',
    description: `Trace ${traceJourney.traceId} started`,
    severity: 'low',
    metadata: { traceId: traceJourney.traceId }
  });
  
  if (traceJourney.rootSpan.endTime) {
    events.push({
      id: `trace-end-${traceJourney.traceId}`,
      timestamp: traceJourney.rootSpan.endTime,
      type: 'trace_end',
      source: 'trace',
      title: 'Trace Ended',
      description: `Trace ${traceJourney.traceId} ended`,
      severity: 'low',
      duration: traceJourney.duration,
      metadata: { traceId: traceJourney.traceId }
    });
  }
  
  // Add span events
  traceJourney.spans.forEach(span => {
    events.push({
      id: `span-${span.name}-${span.startTime}`,
      timestamp: span.startTime,
      type: 'span_start',
      source: 'trace',
      title: span.name,
      description: `Span: ${span.name}`,
      severity: span.status.code === 2 ? 'high' : 'low', // ERROR = 2
      duration: span.endTime ? span.endTime - span.startTime : undefined,
      metadata: { span }
    });
  });
  
  return events;
};

export const createTimelineEventsFromSession = (sessionData: SessionData): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  
  sessionData.events.forEach(sessionEvent => {
    const severity = sessionEvent.type === 'error' ? 'high' : 
                    sessionEvent.type === 'network_request' ? 'medium' : 'low';
    
    events.push({
      id: `session-${sessionEvent.type}-${sessionEvent.timestamp}`,
      timestamp: sessionEvent.timestamp,
      type: sessionEvent.type as TimelineEventType,
      source: 'session',
      title: getSessionEventTitle(sessionEvent),
      description: getSessionEventDescription(sessionEvent),
      severity,
      metadata: sessionEvent.data
    });
  });
  
  return events;
};

export const createTimelineEventsFromCorrelations = (
  correlations: CorrelationResult[]
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  
  correlations.forEach(correlation => {
    // Add log event
    events.push({
      id: `log-${correlation.logEntry.id}`,
      timestamp: correlation.logEntry.timestamp,
      type: 'log',
      source: 'log',
      title: `${correlation.logEntry.level.toUpperCase()} Log`,
      description: correlation.logEntry.message,
      severity: correlation.logEntry.level === 'error' ? 'high' : 'low',
      metadata: correlation.logEntry.metadata || {}
    });
    
    // Add correlated events
    correlation.traces.forEach(trace => {
      events.push({
        id: `correlated-trace-${trace.traceId}-${trace.spanId}`,
        timestamp: trace.startTime,
        type: 'span_start',
        source: 'trace',
        title: trace.operationName,
        description: `Correlated trace: ${trace.operationName}`,
        severity: trace.status === 'error' ? 'high' : 'low',
        duration: trace.endTime ? trace.endTime - trace.startTime : undefined,
        metadata: { trace }
      });
    });
  });
  
  return events;
};

export const createTimelineEventsFromCodeInsights = (
  codeInsights: CodeInsight
): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  
  codeInsights.relatedCommits.forEach(commit => {
    events.push({
      id: `commit-${commit.hash}`,
      timestamp: commit.date.getTime(),
      type: 'code_change',
      source: 'code',
      title: `Commit: ${commit.hash.substring(0, 7)}`,
      description: commit.message,
      severity: commit.stats.filesChanged > 10 ? 'medium' : 'low',
      metadata: { commit }
    });
  });
  
  return events;
};

// Helper functions
const getSessionEventTitle = (event: SessionEvent): string => {
  switch (event.type) {
    case 'mouse_click':
      return 'User Click';
    case 'key_press':
      return 'Key Press';
    case 'network_request':
      return 'Network Request';
    case 'error':
      return 'JavaScript Error';
    default:
      return event.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
};

const getSessionEventDescription = (event: SessionEvent): string => {
  switch (event.type) {
    case 'mouse_click':
      return `Clicked at ${event.data.clientX}, ${event.data.clientY}`;
    case 'network_request':
      return `${event.data.method} ${event.data.url} - ${event.data.status}`;
    case 'error':
      return event.data.message;
    default:
      return JSON.stringify(event.data);
  }
};

export default TimelineVisualizer;