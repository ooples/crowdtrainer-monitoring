module.exports = {
  // API Configuration (standalone monitoring service)
  apiKey: 'am_o3xheckt3u9944jo5ip1u7',
  apiUrl: 'http://localhost:4001/api/v1',
  apiPort: 4001,
  
  // Dashboard Configuration  
  dashboardPort: 5002,
  dashboardUrl: 'http://localhost:5002',
  
  // Database Configuration
  database: {
    type: 'postgresql',
    host: 'localhost',
    port: 5433,
    name: 'monitoring_db',
    user: 'monitoring_user',
    password: 'dev_password'
  },
  
  // Redis Configuration
  redis: {
    host: 'localhost',
    port: 6380,
    password: 'dev_redis'
  },
  
  // Docker Configuration
  docker: {
    dbPort: 5433,
    redisPort: 6380,
    apiPort: 4001,
    dashboardPort: 5002
  },
  
  // Features
  features: {
    errorTracking: true,
    performanceMonitoring: true,
    userAnalytics: true,
    customEvents: true,
    realtimeAlerts: true
  },
  
  // Target Application Detection
  targetApp: {
    detectedPorts: [4000],
    scanTimestamp: '2025-08-13T03:30:59.715Z'
  }
};