/**
 * UI Controller for Vanilla JavaScript Monitoring Example
 * Handles DOM updates and real-time statistics display
 */

(function() {
  'use strict';

  class UIController {
    constructor() {
      this.updateInterval = null;
      this.notificationQueue = [];
      this.isUpdating = false;
      
      this.init();
    }

    init() {
      this.setupEventListeners();
      this.startStatsUpdater();
      this.setupMonitoringEventListeners();
    }

    /**
     * Set up event listeners for monitoring events
     */
    setupMonitoringEventListeners() {
      // Listen for monitoring events
      window.addEventListener('crowdtrainer:eventTracked', (e) => {
        this.updateRecentEvents(e.detail);
        this.showNotification(`Event tracked: ${e.detail.category}/${e.detail.action}`, 'success');
      });

      window.addEventListener('crowdtrainer:performanceTracked', (e) => {
        this.updatePerformanceMetrics(e.detail);
      });

      window.addEventListener('crowdtrainer:errorTracked', (e) => {
        this.showNotification(`Error tracked: ${e.detail.metadata.error.message}`, 'error');
      });
    }

    /**
     * Set up UI event listeners
     */
    setupEventListeners() {
      // Navigation
      document.addEventListener('click', (e) => {
        if (e.target.matches('.nav-link')) {
          e.preventDefault();
          this.navigateToPage(e.target.dataset.page);
        }
      });

      // Track button interactions
      this.trackButtonClicks();
    }

    /**
     * Track button clicks for analytics
     */
    trackButtonClicks() {
      document.addEventListener('click', (e) => {
        if (e.target.matches('.btn')) {
          const buttonText = e.target.textContent.trim();
          const buttonId = e.target.id;
          const buttonClass = e.target.className;

          CrowdTrainerMonitoring.track({
            category: 'user_interaction',
            action: 'button_click',
            label: buttonId || buttonText,
            metadata: {
              button_id: buttonId,
              button_text: buttonText,
              button_class: buttonClass,
            },
          });
        }
      });
    }

    /**
     * Navigate to page
     * @param {string} pageId - Page identifier
     */
    navigateToPage(pageId) {
      // Hide all pages
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });

      // Show target page
      const targetPage = document.getElementById(`${pageId}-page`);
      if (targetPage) {
        targetPage.classList.add('active');
      }

      // Update navigation
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });
      
      document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');

      // Track page navigation
      CrowdTrainerMonitoring.track({
        category: 'navigation',
        action: 'page_change',
        label: pageId,
        metadata: {
          from_page: this.getCurrentPage(),
          to_page: pageId,
        },
      });

      // Update URL hash
      window.location.hash = pageId;
    }

    /**
     * Get current active page
     */
    getCurrentPage() {
      const activePage = document.querySelector('.page.active');
      return activePage ? activePage.id.replace('-page', '') : 'unknown';
    }

    /**
     * Start automatic statistics updater
     */
    startStatsUpdater() {
      this.updateInterval = setInterval(() => {
        this.updateStatistics();
      }, 1000);

      // Initial update
      this.updateStatistics();
    }

    /**
     * Update statistics display
     */
    updateStatistics() {
      if (this.isUpdating) return;
      this.isUpdating = true;

      try {
        const stats = CrowdTrainerMonitoring.getStats();
        
        // Update header stats
        this.updateElement('page-views', stats.pageViews);
        this.updateElement('events-tracked', stats.events);
        this.updateElement('session-time', this.formatDuration(stats.sessionDuration));

        // Update analytics page stats
        this.updateElement('session-duration', this.formatDuration(stats.sessionDuration));
        this.updateElement('total-page-views', stats.pageViews);
        this.updateElement('total-events', stats.events);
        this.updateElement('total-errors', stats.errors);

        // Update connection status
        this.updateConnectionStatus(stats.isOnline, stats.bufferSize);

        // Update user journey
        this.updateUserJourney(stats.userJourney);

      } catch (error) {
        console.error('[UI] Failed to update statistics:', error);
      } finally {
        this.isUpdating = false;
      }
    }

    /**
     * Update element text content
     * @param {string} id - Element ID
     * @param {string|number} value - New value
     */
    updateElement(id, value) {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    }

    /**
     * Update connection status
     * @param {boolean} isOnline - Online status
     * @param {number} bufferSize - Number of queued events
     */
    updateConnectionStatus(isOnline, bufferSize) {
      const indicator = document.getElementById('connection-indicator');
      const queued = document.getElementById('events-queued');

      if (indicator) {
        indicator.textContent = isOnline ? '🟢 Connected' : '🔴 Offline';
        indicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
      }

      if (queued) {
        queued.textContent = `${bufferSize} events queued`;
      }
    }

    /**
     * Update recent events display
     * @param {Object} eventData - Event data
     */
    updateRecentEvents(eventData) {
      const container = document.getElementById('recent-events');
      if (!container) return;

      // Remove "no events" message
      const noEvents = container.querySelector('.no-events');
      if (noEvents) {
        noEvents.remove();
      }

      // Create event element
      const eventElement = document.createElement('div');
      eventElement.className = 'event-item';
      eventElement.innerHTML = `
        <div class="event-header">
          <span class="event-category">${eventData.category}</span>
          <span class="event-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="event-details">
          <strong>${eventData.action}</strong>
          ${eventData.label ? ` - ${eventData.label}` : ''}
          ${eventData.value ? ` (${eventData.value})` : ''}
        </div>
      `;

      // Add to top of list
      container.insertBefore(eventElement, container.firstChild);

      // Limit to 10 recent events
      const events = container.querySelectorAll('.event-item');
      if (events.length > 10) {
        events[events.length - 1].remove();
      }

      // Animate new event
      eventElement.style.opacity = '0';
      requestAnimationFrame(() => {
        eventElement.style.transition = 'opacity 0.3s';
        eventElement.style.opacity = '1';
      });
    }

    /**
     * Update performance metrics display
     * @param {Object} metricData - Performance metric data
     */
    updatePerformanceMetrics(metricData) {
      const container = document.getElementById('performance-metrics');
      if (!container) return;

      // Remove "no metrics" message
      const noMetrics = container.querySelector('.no-metrics');
      if (noMetrics) {
        noMetrics.remove();
      }

      // Create metric element
      const metricElement = document.createElement('div');
      metricElement.className = 'metric-item';
      metricElement.innerHTML = `
        <div class="metric-name">${metricData.name.replace(/_/g, ' ')}</div>
        <div class="metric-value">${Math.round(metricData.value)}${metricData.unit}</div>
      `;

      // Add to list (replace if exists)
      const existingMetric = container.querySelector(`[data-metric="${metricData.name}"]`);
      if (existingMetric) {
        existingMetric.replaceWith(metricElement);
      } else {
        container.appendChild(metricElement);
      }

      metricElement.dataset.metric = metricData.name;
    }

    /**
     * Update user journey display
     * @param {Array} journey - User journey data
     */
    updateUserJourney(journey) {
      const container = document.getElementById('user-journey');
      if (!container) return;

      if (journey.length === 0) {
        container.innerHTML = '<p class="no-journey">User journey will be tracked here...</p>';
        return;
      }

      container.innerHTML = '';
      
      journey.forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = 'journey-step';
        
        const url = new URL(step.url);
        const timeAgo = this.formatTimeAgo(step.timestamp);
        
        stepElement.innerHTML = `
          <div class="step-number">${index + 1}</div>
          <div class="step-details">
            <div class="step-url">${url.pathname}</div>
            <div class="step-time">${timeAgo}</div>
            <div class="step-title">${step.title}</div>
          </div>
        `;
        
        container.appendChild(stepElement);
      });
    }

    /**
     * Show notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     */
    showNotification(message, type = 'info') {
      const container = document.getElementById('notifications');
      if (!container) return;

      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `
        <div class="notification-content">
          <span class="notification-message">${message}</span>
          <button class="notification-close">&times;</button>
        </div>
      `;

      // Add close functionality
      notification.querySelector('.notification-close').addEventListener('click', () => {
        this.removeNotification(notification);
      });

      // Add to container
      container.appendChild(notification);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        this.removeNotification(notification);
      }, 5000);

      // Animate in
      requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
      });
    }

    /**
     * Remove notification
     * @param {HTMLElement} notification - Notification element
     */
    removeNotification(notification) {
      if (!notification || !notification.parentNode) return;

      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }

    /**
     * Format duration in milliseconds to human-readable string
     * @param {number} ms - Duration in milliseconds
     */
    formatDuration(ms) {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    }

    /**
     * Format timestamp to "time ago" string
     * @param {number} timestamp - Timestamp in milliseconds
     */
    formatTimeAgo(timestamp) {
      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        return `${hours}h ago`;
      } else if (minutes > 0) {
        return `${minutes}m ago`;
      } else {
        return `${seconds}s ago`;
      }
    }

    /**
     * Handle page loading states
     */
    showLoading() {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.style.display = 'flex';
      }
    }

    hideLoading() {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.style.display = 'none';
      }
    }
  }

  // Initialize UI controller when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    window.UIController = new UIController();
  });

})();