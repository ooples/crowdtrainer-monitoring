# Monitoring Service API Server

A comprehensive, production-ready monitoring API server built with Fastify, TypeScript, PostgreSQL with TimescaleDB, and Redis.

## Features

- **Real-time Event Ingestion**: High-performance event collection with WebSocket streaming
- **Metrics Collection**: Time-series metrics storage with aggregation and querying
- **Alert Management**: Configurable alerts with multiple notification channels
- **Dashboard API**: Rich dashboard data endpoints for visualization
- **Authentication**: API key-based authentication with role-based permissions
- **Rate Limiting**: Configurable rate limiting per API key and IP
- **WebSocket Support**: Real-time data streaming and subscriptions
- **TimescaleDB Integration**: Optimized time-series data storage and querying
- **Redis Caching**: Fast caching and real-time pub/sub messaging
- **Docker Support**: Complete containerization with Docker Compose
- **Production Ready**: Comprehensive logging, health checks, and monitoring

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd monitoring-service/packages/server
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Start the services:
```bash
# Development mode with hot reloading
docker-compose up -d

# Production mode
docker-compose -f docker-compose.yml --profile production up -d
```

4. The API will be available at:
   - API Server: http://localhost:3001
   - API Documentation: http://localhost:3001/docs
   - Health Check: http://localhost:3001/health

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start PostgreSQL and Redis:
```bash
docker-compose up timescaledb redis -d
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication

All API endpoints (except `/health` and `/docs`) require authentication using API keys:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3001/api/v1/events
```

### Core Endpoints

#### Events API (`/api/v1/events`)
- `POST /` - Create single event
- `POST /bulk` - Create multiple events
- `GET /` - Query events with filtering
- `GET /:id` - Get event by ID
- `GET /stats` - Get event statistics
- `DELETE /:id` - Delete event (admin only)

#### Metrics API (`/api/v1/metrics`)
- `POST /` - Create single metric
- `POST /bulk` - Create multiple metrics
- `GET /` - Query metrics with aggregation
- `GET /latest` - Get latest metric values
- `GET /names` - Get available metric names
- `GET /sources` - Get available metric sources
- `GET /stats` - Get metric statistics
- `POST /increment/:name` - Increment counter metric
- `DELETE /:id` - Delete metric (admin only)

#### Dashboard API (`/api/v1/dashboard`)
- `GET /overview` - Get dashboard overview statistics
- `GET /timeseries` - Get time series data for charts
- `GET /top/:type` - Get top lists (errors, slow requests, etc.)
- `GET /heatmap` - Get heatmap data
- `GET /realtime` - Get real-time dashboard metrics
- `POST /widgets` - Create custom dashboard widget
- `GET /widgets` - Get dashboard widgets

#### Alerts API (`/api/v1/alerts`)
- `POST /` - Create alert configuration
- `GET /` - Get alert configurations
- `GET /:id` - Get alert configuration by ID
- `PUT /:id` - Update alert configuration
- `DELETE /:id` - Delete alert configuration
- `POST /:id/test` - Test alert configuration
- `GET /instances` - Get alert instances
- `POST /instances/:id/resolve` - Resolve alert instance

### WebSocket API

Connect to WebSocket endpoints for real-time data:

```javascript
// Basic WebSocket connection
const ws = new WebSocket('ws://localhost:3001/ws');

// Authenticated WebSocket connection
const ws = new WebSocket('ws://localhost:3001/ws/authenticated?apiKey=your-api-key');

// Subscribe to real-time events
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'events:realtime'
}));

// Subscribe to real-time metrics
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'metrics:realtime'
}));
```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Server
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/monitoring_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=monitoring_db
DATABASE_USER=monitoring_user
DATABASE_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Authentication
JWT_SECRET=your-super-secret-jwt-key
API_KEY_SECRET=your-api-key-secret
```

### API Key Management

Create API keys programmatically:

```typescript
import { getAuthManager } from './src/auth';

const auth = getAuthManager();
const { key, apiKey } = await auth.generateApiKey(
  'My App Key',
  ['read', 'write'], // permissions
  1000, // rate limit per hour
  '2024-12-31T23:59:59Z' // expiration (optional)
);

console.log('API Key:', key); // Save this securely
console.log('Key ID:', apiKey.id);
```

## Development

### Project Structure

```
src/
├── auth/           # Authentication and API key management
├── database/       # Database connection and schema
├── middleware/     # Custom middleware
├── redis/          # Redis client and utilities
├── routes/         # API route handlers
├── types/          # TypeScript type definitions
├── websocket/      # WebSocket server implementation
└── index.ts        # Main server entry point
```

### Scripts

```bash
npm run build          # Build TypeScript
npm run dev            # Start development server with hot reload
npm run start          # Start production server
npm run test           # Run tests
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues

# Docker scripts
npm run docker:build   # Build Docker image
npm run docker:run     # Start with Docker Compose
npm run docker:stop    # Stop Docker services
```

### Testing

Run the test suite:

```bash
npm test                # Run all tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage
```

### Database Migrations

The server automatically initializes the database schema on startup. For manual migration management:

```bash
npm run migrate        # Run database migrations
npm run seed           # Seed database with sample data
```

## Deployment

### Docker Production Deployment

1. Build the production image:
```bash
docker build -t monitoring-server .
```

2. Run with production compose file:
```bash
docker-compose -f docker-compose.yml --profile production up -d
```

3. Include Nginx reverse proxy:
```bash
# Copy SSL certificates to ./ssl/ directory
docker-compose -f docker-compose.yml --profile production up -d nginx
```

### Environment-Specific Deployments

The service supports multiple deployment profiles:

```bash
# Development with debugging tools
docker-compose --profile development up -d

# Production with Nginx and SSL
docker-compose --profile production up -d

# With Prometheus and Grafana monitoring
docker-compose --profile monitoring up -d
```

### Health Checks

The service includes comprehensive health checks:

- HTTP health check: `GET /health`
- Database connectivity check
- Redis connectivity check
- Docker health checks with automatic restarts

### Monitoring and Observability

#### Built-in Monitoring

- Server statistics: `GET /stats`
- Real-time metrics via WebSocket
- Structured logging with configurable levels
- Performance metrics collection

#### External Monitoring

Optional Prometheus and Grafana stack:

```bash
docker-compose --profile monitoring up -d
```

Access Grafana at http://localhost:3000 (admin/admin)

### Security

#### Production Security Checklist

- [ ] Change default passwords and secrets
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS with valid certificates
- [ ] Set up proper firewall rules
- [ ] Configure rate limiting appropriately
- [ ] Enable security headers (Helmet.js)
- [ ] Regular security updates
- [ ] Monitor for unauthorized access

#### API Key Security

- Store API keys securely (never in plain text)
- Implement proper key rotation
- Monitor key usage and revoke suspicious keys
- Use least-privilege permissions

## Performance

### Optimization Tips

1. **Database Optimization**:
   - Use appropriate time-based partitioning
   - Configure TimescaleDB compression policies
   - Set up appropriate retention policies
   - Monitor query performance

2. **Redis Optimization**:
   - Configure appropriate memory limits
   - Use Redis clustering for high availability
   - Monitor memory usage and eviction policies

3. **Application Optimization**:
   - Enable cluster mode for multiple CPU cores
   - Configure appropriate connection pooling
   - Use bulk operations for high-throughput scenarios
   - Implement proper caching strategies

### Scaling

The service supports horizontal scaling:

1. **Database Scaling**: Use TimescaleDB clustering
2. **Application Scaling**: Deploy multiple instances behind a load balancer
3. **Redis Scaling**: Use Redis Cluster for high availability
4. **WebSocket Scaling**: Use Redis pub/sub for multi-instance WebSocket support

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Check PostgreSQL service status
   - Verify database credentials
   - Ensure TimescaleDB extension is installed

2. **Redis Connection Issues**:
   - Verify Redis service status
   - Check Redis authentication
   - Monitor Redis memory usage

3. **High Memory Usage**:
   - Monitor TimescaleDB compression
   - Check Redis memory limits
   - Review application memory leaks

4. **Performance Issues**:
   - Check database query performance
   - Monitor rate limiting settings
   - Review connection pool configuration

### Logs and Debugging

- Application logs: `./logs/` directory or Docker logs
- Database logs: TimescaleDB container logs
- Redis logs: Redis container logs
- Nginx logs: Nginx container logs

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Create a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review the API documentation at `/docs`