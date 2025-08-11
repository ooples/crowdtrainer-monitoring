# Node.js Express Backend Monitoring Integration Example

This example demonstrates comprehensive monitoring integration for a Node.js Express backend API, including database monitoring, external API tracking, webhooks, and system metrics.

## Features

- **🔄 API Monitoring**: Automatic request/response tracking with performance metrics
- **🗄️ Database Monitoring**: Query performance and error tracking
- **🌐 External API Monitoring**: Third-party API call tracking and performance
- **📊 System Metrics**: Memory, CPU, and connection monitoring
- **🚨 Error Tracking**: Comprehensive error handling and reporting
- **🔒 Security Monitoring**: Rate limiting, authentication, and security events
- **📡 Webhook Management**: Webhook delivery tracking and retry mechanisms
- **📈 Real-time Metrics**: Live performance and usage statistics
- **🛡️ Production Ready**: Logging, error handling, and graceful shutdown

## Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Or Start Production Server**:
   ```bash
   npm start
   ```

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Monitoring Configuration
MONITORING_ENDPOINT=http://localhost:3001/api/monitoring
LOG_LEVEL=info

# Security
API_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database (SQLite is used by default for demo)
DATABASE_URL=./data/demo.db
```

## Architecture Overview

### Middleware Stack

```
Request → Rate Limiter → CORS → Security → Logging → Monitoring → Routes → Error Handler
```

### Monitoring Integration Points

1. **Request Middleware**: Tracks all HTTP requests
2. **Database Wrapper**: Monitors all database operations
3. **External API Wrapper**: Tracks third-party API calls
4. **Error Handler**: Captures and reports all errors
5. **Webhook Dispatcher**: Monitors webhook deliveries
6. **System Metrics**: Periodic collection of server metrics

## API Endpoints

### Core Endpoints

- `GET /` - Service information
- `GET /health` - Health check endpoint
- `GET /api/metrics` - System metrics and statistics

### User Management

- `POST /api/users` - Create user
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### API Key Management

- `POST /api/keys` - Create API key
- `GET /api/keys` - List API keys
- `DELETE /api/keys/:id` - Revoke API key

### Webhooks

- `POST /webhooks/stripe` - Stripe webhook handler
- `POST /webhooks/github` - GitHub webhook handler
- `POST /webhooks/generic` - Generic webhook handler

## Monitoring Integration

### Basic Usage

```javascript
const { track, trackPerformance, trackError } = require('./utils/monitoring');

// Track custom events
track({
  category: 'user_action',
  action: 'profile_updated',
  metadata: {
    user_id: userId,
    fields_changed: ['email', 'name'],
  },
});

// Track performance metrics
trackPerformance({
  name: 'file_upload_duration',
  value: uploadTime,
  unit: 'ms',
  metadata: {
    file_size: fileSize,
    file_type: fileType,
  },
});

// Track errors with context
trackError(error, {
  category: 'payment_processing',
  action: 'stripe_charge_failed',
  severity: 'high',
  metadata: {
    amount: chargeAmount,
    customer_id: customerId,
  },
});
```

### Database Monitoring

```javascript
const { monitorDatabaseQuery } = require('./utils/monitoring');
const database = require('./database/connection');

// All database operations are automatically monitored
const users = await database.all('SELECT * FROM users WHERE active = ?', [1]);

// Custom database monitoring
const result = await monitorDatabaseQuery(
  'Complex user analytics query',
  async () => {
    // Your complex database operation
    return await database.all(complexQuery, params);
  }
);
```

### External API Monitoring

```javascript
const { monitorExternalAPI } = require('./utils/monitoring');
const axios = require('axios');

// Monitor external API calls
const response = await monitorExternalAPI(
  'https://api.stripe.com/v1/charges',
  { method: 'POST' },
  () => axios.post('https://api.stripe.com/v1/charges', chargeData, {
    headers: { Authorization: `Bearer ${stripeKey}` }
  })
);
```

## Route Examples

### User Management with Monitoring

```javascript
const express = require('express');
const { asyncHandler } = require('../middleware/error-handler');
const { track } = require('../utils/monitoring');
const database = require('../database/connection');

const router = express.Router();

// Create user with comprehensive monitoring
router.post('/', asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  
  // Track user creation attempt
  track({
    category: 'user_management',
    action: 'create_user_attempt',
    metadata: {
      email_domain: email.split('@')[1],
      registration_source: req.get('X-Registration-Source') || 'direct',
    },
  });

  // Create user (database operation is automatically monitored)
  const result = await database.run(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, await hashPassword(password)]
  );

  // Track successful creation
  track({
    category: 'user_management',
    action: 'user_created',
    metadata: {
      user_id: result.lastID,
      email_domain: email.split('@')[1],
    },
  });

  res.status(201).json({
    message: 'User created successfully',
    userId: result.lastID,
  });
}));

module.exports = router;
```

### Webhook Handler with Monitoring

```javascript
// Webhook processing with comprehensive tracking
router.post('/stripe', asyncHandler(async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const payload = req.body;

  // Verify webhook signature (automatically monitored for errors)
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  // Track webhook received
  track({
    category: 'webhook',
    action: 'stripe_webhook_received',
    metadata: {
      event_type: event.type,
      event_id: event.id,
      livemode: event.livemode,
    },
  });

  try {
    // Process webhook based on type
    await processStripeEvent(event);

    // Track successful processing
    track({
      category: 'webhook',
      action: 'stripe_webhook_processed',
      metadata: {
        event_type: event.type,
        event_id: event.id,
        processing_time: Date.now() - startTime,
      },
    });

    res.json({ received: true });

  } catch (error) {
    // Error tracking is handled by error middleware
    throw error;
  }
}));
```

## Advanced Features

### Rate Limiting with Monitoring

```javascript
const { rateLimiter, strictRateLimiter } = require('./middleware/rate-limiter');

// Apply different rate limits to different endpoints
app.use('/api/auth', strictRateLimiter); // 10 requests per 15 minutes
app.use('/api', rateLimiter); // 100 requests per 15 minutes

// Rate limit violations are automatically tracked
```

### Custom Error Classes

```javascript
const { ValidationError, UnauthorizedError } = require('./middleware/error-handler');

// Throw custom errors with automatic monitoring
if (!user) {
  throw new NotFoundError('User not found');
}

if (!user.isActive) {
  throw new UnauthorizedError('User account is disabled');
}
```

### System Metrics Collection

```javascript
const { getSystemMetrics } = require('./utils/monitoring');

// Get current system metrics
const metrics = getSystemMetrics();
console.log(metrics);
// {
//   uptime: 3600000,
//   memory: { rss: 45678592, heapTotal: 20971520, heapUsed: 18874368 },
//   cpu: { user: 1234567, system: 987654 },
//   requests: { total: 1500, errors: 23, success: 1477 },
//   activeConnections: 12,
// }
```

## Production Configuration

### Docker Support

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

EXPOSE 3000

CMD ["npm", "start"]
```

### Environment-Specific Settings

```javascript
// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // Increase buffer sizes for better performance
  initializeMonitoring({
    bufferSize: 100,
    flushInterval: 30000,
    enableDebugLogs: false,
  });
}
```

### Health Checks

```javascript
// Comprehensive health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {
      database: await checkDatabaseHealth(),
      memory: checkMemoryHealth(),
      monitoring: checkMonitoringHealth(),
    },
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Load Testing

```bash
npm run test:load
```

### Example Test with Monitoring

```javascript
const request = require('supertest');
const { app } = require('../src/server');

describe('User API with Monitoring', () => {
  it('should track user creation events', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(201);
    expect(response.body.userId).toBeDefined();

    // Verify monitoring events were tracked
    // (In real tests, you'd check your monitoring system)
  });
});
```

## Deployment

### Using PM2

```json
{
  "apps": [{
    "name": "express-monitoring-demo",
    "script": "src/server.js",
    "instances": "max",
    "exec_mode": "cluster",
    "env": {
      "NODE_ENV": "production",
      "PORT": 3000
    }
  }]
}
```

### Using Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONITORING_ENDPOINT=http://monitoring:3001/api/monitoring
    depends_on:
      - monitoring
      
  monitoring:
    image: crowdtrainer/monitoring-service
    ports:
      - "3001:3001"
```

## Monitoring Dashboard

Access real-time metrics at:
- System metrics: `GET /api/metrics`
- Health status: `GET /health`
- Request logs: Check application logs

### Metrics Response Example

```json
{
  "system": {
    "uptime": 3600,
    "memory": {
      "heapUsed": 18.5,
      "heapTotal": 25.2,
      "rss": 45.6
    },
    "cpu": {
      "user": 1234567,
      "system": 987654
    }
  },
  "requests": {
    "total": 1500,
    "success": 1477,
    "errors": 23,
    "activeConnections": 12
  },
  "database": {
    "users": 150,
    "api_keys": 25,
    "request_logs": 5000,
    "webhooks": 10
  }
}
```

## Best Practices

### Error Handling

- Always use `asyncHandler` wrapper for async routes
- Throw specific error types for different scenarios
- Include relevant context in error metadata
- Never expose sensitive information in error responses

### Performance

- Use connection pooling for databases
- Implement proper caching strategies
- Monitor and optimize slow queries
- Set appropriate rate limits

### Security

- Validate all input data
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Monitor for suspicious activity patterns

### Monitoring

- Track business metrics, not just technical metrics
- Include relevant context in all events
- Use appropriate severity levels for errors
- Monitor both success and failure rates

## Troubleshooting

### Common Issues

1. **High memory usage**: Check for memory leaks in event listeners
2. **Slow database queries**: Monitor query performance and add indexes
3. **Rate limit issues**: Adjust rate limiting configuration
4. **Webhook failures**: Check webhook URL accessibility and retry logic

### Debug Mode

Enable debug logging:

```bash
NODE_ENV=development LOG_LEVEL=debug npm run dev
```

This will show detailed monitoring events and system information.

## Next Steps

- Integrate with your preferred monitoring service (Datadog, New Relic, etc.)
- Set up alerting for critical errors and performance issues
- Implement custom business metric tracking
- Add distributed tracing for microservices
- Set up automated performance testing
- Implement custom dashboards for business metrics