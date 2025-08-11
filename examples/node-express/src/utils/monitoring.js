// Re-export monitoring functions from middleware for easy access
const {
  track,
  trackPerformance,
  trackError,
  getSystemMetrics,
  monitorDatabaseQuery,
  monitorExternalAPI,
} = require('../middleware/monitoring');

module.exports = {
  track,
  trackPerformance,
  trackError,
  getSystemMetrics,
  monitorDatabaseQuery,
  monitorExternalAPI,
};