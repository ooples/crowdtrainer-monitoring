# CrowdTrainer Monitoring Service - Deployment Guide

## 🚀 Production Deployment

This guide covers deploying the CrowdTrainer monitoring service to production environments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Cloud Deployments](#cloud-deployments)
3. [Docker Deployment](#docker-deployment)
4. [Manual Deployment](#manual-deployment)
5. [Configuration](#configuration)
6. [Security](#security)
7. [Monitoring & Maintenance](#monitoring--maintenance)

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for building)
- PostgreSQL 14+ with TimescaleDB extension
- Redis 6+
- SSL certificates for HTTPS

### One-Click Deploy Options

#### Deploy to Vercel (Dashboard Only)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fooples%2Fcrowdtrainer-monitoring&env=NEXT_PUBLIC_API_URL,NEXT_PUBLIC_WS_URL&envDescription=API%20endpoints%20for%20the%20monitoring%20dashboard&project-name=monitoring-dashboard&repository-name=monitoring-dashboard)

#### Deploy to Railway (Full Stack)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/monitoring-service)

#### Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ooples/crowdtrainer-monitoring)

## Cloud Deployments

### AWS Deployment

#### Using AWS CDK

```bash
# Install AWS CDK
npm install -g aws-cdk

# Deploy infrastructure
cd deployment/aws
cdk deploy MonitoringStack
```

#### Using Terraform

```bash
cd deployment/terraform/aws
terraform init
terraform plan
terraform apply
```

### Google Cloud Platform

```bash
# Configure gcloud
gcloud config set project YOUR_PROJECT_ID

# Deploy with Cloud Run
gcloud run deploy monitoring-server \
  --source packages/server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# Deploy dashboard
gcloud run deploy monitoring-dashboard \
  --source packages/dashboard \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Azure Deployment

```bash
# Create resource group
az group create --name monitoring-rg --location eastus

# Deploy with Container Instances
az container create \
  --resource-group monitoring-rg \
  --name monitoring-service \
  --image ghcr.io/ooples/crowdtrainer-monitoring:latest \
  --dns-name-label monitoring \
  --ports 3001
```

### DigitalOcean App Platform

```yaml
# .do/app.yaml
name: monitoring-service
region: nyc
services:
  - name: api
    github:
      repo: ooples/crowdtrainer-monitoring
      branch: main
      deploy_on_push: true
    source_dir: packages/server
    environment_slug: node-js
    instance_size_slug: professional-xs
    instance_count: 2
    http_port: 3001
    
  - name: dashboard
    github:
      repo: ooples/crowdtrainer-monitoring
      branch: main
    source_dir: packages/dashboard
    environment_slug: node-js
    instance_size_slug: basic-xxs
    routes:
      - path: /

databases:
  - name: monitoring-db
    engine: PG
    version: "14"
    size: db-s-dev-database
    num_nodes: 1
```

## Docker Deployment

### Production Docker Compose

```bash
# Clone repository
git clone https://github.com/ooples/crowdtrainer-monitoring.git
cd crowdtrainer-monitoring

# Configure environment
cp .env.example .env.production
# Edit .env.production with your settings

# Start services
docker-compose -f docker-compose.production.yml up -d
```

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-stack.yml monitoring
```

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f deployment/k8s/namespace.yaml
kubectl apply -f deployment/k8s/configmap.yaml
kubectl apply -f deployment/k8s/secrets.yaml
kubectl apply -f deployment/k8s/deployment.yaml
kubectl apply -f deployment/k8s/service.yaml
kubectl apply -f deployment/k8s/ingress.yaml

# Check status
kubectl get pods -n monitoring
kubectl get services -n monitoring
```

### Helm Chart

```bash
# Add repository
helm repo add crowdtrainer https://charts.crowdtrainer.io
helm repo update

# Install
helm install monitoring crowdtrainer/monitoring \
  --namespace monitoring \
  --create-namespace \
  --values values.production.yaml
```

## Manual Deployment

### 1. Database Setup

```sql
-- Create database
CREATE DATABASE monitoring_db;

-- Enable TimescaleDB
\c monitoring_db
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Run migrations
psql -U postgres -d monitoring_db -f packages/server/init-db.sql
```

### 2. Redis Setup

```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: requirepass YOUR_REDIS_PASSWORD
# Set: maxmemory 2gb
# Set: maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis
```

### 3. Build Services

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Or build individually
cd packages/server && npm run build
cd packages/dashboard && npm run build
```

### 4. Deploy API Server

```bash
cd packages/server

# Install PM2
npm install -g pm2

# Start server
pm2 start dist/index.js --name monitoring-api \
  --instances max \
  --exec-mode cluster \
  --env production

# Save PM2 configuration
pm2 save
pm2 startup
```

### 5. Deploy Dashboard

```bash
cd packages/dashboard

# Build for production
npm run build

# Deploy with PM2
pm2 start npm --name monitoring-dashboard -- start

# Or use a web server
npm install -g serve
serve -s out -p 3000
```

### 6. Configure Nginx

```nginx
# /etc/nginx/sites-available/monitoring
upstream api_backend {
    least_conn;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    server 127.0.0.1:3004;
}

server {
    listen 80;
    server_name monitoring.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name monitoring.yourdomain.com;

    ssl_certificate /etc/ssl/certs/monitoring.crt;
    ssl_certificate_key /etc/ssl/private/monitoring.key;

    # API routes
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Dashboard
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Configuration

### Environment Variables

```bash
# API Server (.env)
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/monitoring_db
REDIS_URL=redis://:password@localhost:6379
JWT_SECRET=your-super-secret-jwt-key
API_KEY_SECRET=your-api-key-secret
CORS_ORIGINS=https://dashboard.yourdomain.com,https://app.yourdomain.com

# Dashboard (.env)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com/ws
NEXT_PUBLIC_ENVIRONMENT=production
```

### Production Optimizations

```javascript
// packages/server/src/config/production.ts
export const productionConfig = {
  // Database pooling
  database: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Redis clustering
  redis: {
    cluster: true,
    nodes: [
      { host: 'redis-1', port: 6379 },
      { host: 'redis-2', port: 6379 },
      { host: 'redis-3', port: 6379 },
    ],
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
  },
  
  // Caching
  cache: {
    ttl: 300,
    checkPeriod: 60,
  },
};
```

## Security

### SSL/TLS Configuration

```bash
# Generate SSL certificates with Let's Encrypt
sudo apt-get install certbot
sudo certbot certonly --standalone -d monitoring.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 0 * * * /usr/bin/certbot renew --quiet
```

### API Key Management

```bash
# Generate secure API keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Store in environment variables or secret management system
export MONITORING_API_KEY=your-generated-key
```

### Security Headers

```javascript
// packages/server/src/middleware/security.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

### Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw allow 3001/tcp # API (if needed)
sudo ufw enable
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check API health
curl https://api.yourdomain.com/health

# Check dashboard
curl https://dashboard.yourdomain.com/api/health

# Database health
psql -U postgres -d monitoring_db -c "SELECT 1"

# Redis health
redis-cli ping
```

### Backup Strategy

```bash
# Database backup
pg_dump -U postgres monitoring_db > backup_$(date +%Y%m%d).sql

# Automated backups
0 2 * * * pg_dump -U postgres monitoring_db | gzip > /backups/monitoring_$(date +\%Y\%m\%d).sql.gz

# Redis backup
redis-cli BGSAVE
```

### Monitoring with Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'monitoring-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
```

### Log Management

```bash
# Configure log rotation
sudo nano /etc/logrotate.d/monitoring

/var/log/monitoring/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 monitoring monitoring
    sharedscripts
    postrotate
        systemctl reload monitoring
    endscript
}
```

### Performance Tuning

```sql
-- TimescaleDB compression
SELECT add_compression_policy('events', INTERVAL '7 days');
SELECT add_compression_policy('metrics', INTERVAL '1 day');

-- Retention policies
SELECT add_retention_policy('events', INTERVAL '90 days');
SELECT add_retention_policy('metrics', INTERVAL '30 days');

-- Continuous aggregates
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', timestamp) AS hour,
    name,
    AVG(value) as avg_value,
    MAX(value) as max_value,
    MIN(value) as min_value
FROM metrics
GROUP BY hour, name;
```

## Troubleshooting

### Common Issues

1. **Connection refused to database**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Check connection settings
   psql -h localhost -U postgres -d monitoring_db
   ```

2. **High memory usage**
   ```bash
   # Check memory usage
   pm2 monit
   
   # Restart services
   pm2 restart all
   ```

3. **Slow queries**
   ```sql
   -- Find slow queries
   SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

## Support

For issues and questions:
- GitHub Issues: https://github.com/ooples/crowdtrainer-monitoring/issues
- Documentation: https://docs.crowdtrainer.io/monitoring
- Email: support@crowdtrainer.io

## License

MIT License - See LICENSE file for details.