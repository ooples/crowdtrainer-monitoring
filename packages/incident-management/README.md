# Incident Management System

A comprehensive ITSM (IT Service Management) incident management system designed for high-performance monitoring environments. This system provides automated incident detection, war room collaboration, post-mortem generation, runbook integration, status pages, and MTTR optimization.

## Features

### 🚨 Automatic Incident Detection
- **Sub-30 second detection** from alerts to incident creation
- **Smart correlation** of related alerts and patterns
- **Configurable rules** with pattern matching and thresholds
- **Integration** with PagerDuty, Opsgenie, DataDog, and Sentry
- **Auto-escalation** based on severity and time thresholds

### 🏢 War Room Collaboration
- **Real-time chat** with up to 50+ concurrent users
- **Video conferencing** integration (Zoom, Teams, Google Meet)
- **Document sharing** and collaborative editing
- **Action item tracking** and assignment
- **Session recording** for post-incident analysis

### 📝 Post-Mortem Generation
- **Automated report generation** from incident data
- **Multiple formats**: Markdown, PDF, HTML
- **Timeline reconstruction** with key events
- **Root cause analysis** using AI-powered insights
- **Action item tracking** with assignees and due dates
- **Template customization** for different incident types

### 📚 Runbook Integration
- **Smart runbook matching** based on alert patterns
- **Automated execution** for supported procedures
- **Manual step guidance** with interactive workflows
- **Success rate tracking** and optimization suggestions
- **Version control** and testing framework

### 📊 Status Page System
- **Real-time component status** updates
- **Public and internal** status pages
- **Maintenance window** scheduling
- **Uptime statistics** with historical data
- **Subscriber notifications** via email/SMS
- **Custom branding** and theming

### 📈 Timeline Reconstruction
- **Automated timeline building** from multiple sources
- **Event correlation** and gap detection
- **Phase analysis** (detection, investigation, resolution)
- **Bottleneck identification** and optimization suggestions
- **Visual timeline** with interactive exploration

### ⏱️ MTTR Tracking & Optimization
- **Real-time MTTR calculation** and alerting
- **Benchmarking** against industry standards
- **Trend analysis** with seasonality detection
- **Optimization suggestions** based on historical data
- **Target setting** and performance monitoring
- **Team and component-level** metrics

## Quick Start

### Installation

```bash
npm install @crowdtrainer/incident-management
```

### Basic Setup

```typescript
import { 
  IncidentManagementSystem,
  IncidentManagementConfig 
} from '@crowdtrainer/incident-management';
import Redis from 'ioredis';
import winston from 'winston';

// Configure the system
const config: IncidentManagementConfig = {
  detection: {
    thresholds: { 'error.rate': 10 },
    cooldownPeriod: 300,
    autoEscalation: true,
    escalationTimeout: 900,
  },
  warRoom: {
    maxParticipants: 50,
    videoIntegration: 'zoom',
    autoRecording: true,
    sessionTimeout: 3600,
  },
  statusPage: {
    publicUrl: 'https://status.yourcompany.com',
    components: [],
    maintenanceMode: false,
  },
  notifications: {
    channels: ['email', 'slack'],
    escalationRules: [],
  },
  integrations: {
    pagerDuty: {
      apiKey: process.env.PAGERDUTY_API_KEY,
      serviceId: 'your-service-id',
      escalationPolicyId: 'your-policy-id',
      webhookUrl: 'https://your-app.com/webhooks/pagerduty',
    },
  },
};

// Initialize components
const redis = new Redis(process.env.REDIS_URL);
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'incident-management.log' })
  ],
});

// Create and initialize system
const incidentSystem = new IncidentManagementSystem({
  config,
  redis,
  logger,
  socketIO, // Optional: for war room functionality
});

await incidentSystem.initialize();
```

### Processing Alerts

```typescript
import { Alert, AlertSource, IncidentSeverity } from '@crowdtrainer/incident-management';

// Process an incoming alert
const alert: Alert = {
  id: 'alert-001',
  source: AlertSource.MONITORING,
  title: 'High Error Rate Detected',
  description: 'API error rate exceeded 5% threshold',
  severity: IncidentSeverity.P2_HIGH,
  timestamp: new Date(),
  labels: {
    service: 'api',
    environment: 'production',
    team: 'backend',
  },
  annotations: {
    runbook: 'https://wiki.company.com/runbooks/high-error-rate',
    dashboard: 'https://grafana.company.com/d/api-errors',
  },
  resolved: false,
};

await incidentSystem.processAlert(alert);
```

### War Room Integration (React)

```tsx
import React from 'react';
import { WarRoomCollaboration } from '@crowdtrainer/incident-management';

function IncidentResponsePage({ incident, currentUser, config }) {
  return (
    <div className="incident-response">
      <WarRoomCollaboration
        incident={incident}
        currentUser={currentUser}
        config={config}
        onIncidentUpdate={(updatedIncident) => {
          console.log('Incident updated:', updatedIncident);
        }}
      />
    </div>
  );
}
```

### Status Page

```tsx
import React from 'react';
import { StatusPage } from '@crowdtrainer/incident-management';

function PublicStatusPage({ config }) {
  return (
    <StatusPage
      config={config}
      isPublic={true}
      theme="light"
    />
  );
}
```

## Advanced Usage

### Custom Detection Rules

```typescript
const detectionSystem = incidentSystem.getDetection();

// Add custom detection rule
detectionSystem.addDetectionRule({
  id: 'custom-database-rule',
  name: 'Database Connection Failures',
  description: 'Detect when database connections start failing',
  enabled: true,
  conditions: {
    alertPattern: 'database.*connection.*fail',
    threshold: 3,
    timeWindow: 180, // 3 minutes
    severity: IncidentSeverity.P1_CRITICAL,
  },
  actions: {
    createIncident: true,
    assignToTeam: 'database-team',
    escalateAfter: 300, // 5 minutes
    runbook: 'database-connection-failure-runbook',
  },
});
```

### Custom Runbooks

```typescript
const runbookSystem = incidentSystem.getRunbooks();

// Create custom runbook
const customRunbook: Runbook = {
  id: 'api-restart-procedure',
  title: 'API Service Restart Procedure',
  description: 'Standard procedure for restarting API services',
  category: 'Operations',
  tags: ['api', 'restart', 'operations'],
  steps: [
    {
      id: 'verify-health',
      title: 'Verify Service Health',
      description: 'Check current service health status',
      command: 'http:GET|/health',
      order: 1,
      automatable: true,
    },
    {
      id: 'drain-connections',
      title: 'Drain Active Connections',
      description: 'Gracefully drain existing connections',
      command: 'kubectl:kubectl patch service api-service -p \'{"spec":{"selector":{"version":"maintenance"}}}\'',
      order: 2,
      automatable: true,
    },
    {
      id: 'restart-service',
      title: 'Restart Service',
      description: 'Restart the API service pods',
      command: 'kubectl:kubectl rollout restart deployment/api-service',
      order: 3,
      automatable: false, // Requires manual approval
    },
  ],
  triggers: {
    alertPatterns: ['api.*down', 'service.*unavailable'],
    conditions: ['severity == "P1_CRITICAL"'],
  },
  metadata: {
    estimatedTime: 15,
    skillLevel: 'intermediate',
    lastTested: new Date(),
    successRate: 0.95,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  version: '1.0',
};

await runbookSystem.saveRunbook(customRunbook);
```

### MTTR Analysis

```typescript
const mttrTracker = incidentSystem.getMTTR();

// Get MTTR analysis for an incident
const analysis = await mttrTracker.analyzeMTTR('incident-123');
console.log('MTTR Analysis:', {
  totalTime: analysis.metrics.durations.totalTime,
  optimization: analysis.optimization.immediate,
  benchmarks: analysis.benchmarks,
});

// Update MTTR targets
await mttrTracker.updateTargets({
  severity: {
    [IncidentSeverity.P1_CRITICAL]: 2 * 60 * 60 * 1000, // 2 hours
    [IncidentSeverity.P2_HIGH]: 4 * 60 * 60 * 1000,     // 4 hours
  },
  overall: 6 * 60 * 60 * 1000, // 6 hours
});
```

### Post-Mortem Generation

```typescript
const postMortemSystem = incidentSystem.getPostMortem();

// Generate post-mortem
const postMortem = await postMortemSystem.generatePostMortem(incident);

// Export as Markdown
const markdown = await postMortemSystem.generateMarkdown(postMortem);

// Export as PDF
const pdf = await postMortemSystem.generatePDF(postMortem);

// Save PDF to file
require('fs').writeFileSync(`postmortem-${incident.id}.pdf`, pdf);
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Incident Management System               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │   Detection │ │  War Room   │ │ Post-Mortem │       │
│  │             │ │             │ │             │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  Runbooks   │ │ Status Page │ │  Timeline   │       │
│  │             │ │             │ │             │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐                                       │
│  │    MTTR     │           Central Event Bus            │
│  │             │                                       │
│  └─────────────┘                                       │
├─────────────────────────────────────────────────────────┤
│              Data Layer (Redis)                         │
└─────────────────────────────────────────────────────────┘
```

## Performance

- **Detection Latency**: < 30 seconds from alert to incident
- **War Room Capacity**: 50+ concurrent users per incident
- **MTTR Calculation**: Real-time with < 1 second latency
- **Status Page Load**: < 2 seconds for public pages
- **Post-Mortem Generation**: < 30 seconds for typical incidents
- **Timeline Reconstruction**: < 10 seconds for 1000+ events

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=detection

# Run tests in watch mode
npm run test:watch
```

The test suite includes:
- **Unit tests** for all components (>80% coverage)
- **Integration tests** for end-to-end workflows
- **Performance tests** for high-load scenarios
- **Load tests** for concurrent user scenarios

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Integrations
PAGERDUTY_API_KEY=your_api_key
OPSGENIE_API_KEY=your_api_key
SLACK_WEBHOOK_URL=your_webhook_url

# Video Conferencing
ZOOM_API_KEY=your_zoom_key
TEAMS_WEBHOOK_URL=your_teams_webhook

# Status Page
STATUS_PAGE_URL=https://status.yourcompany.com

# SMTP for Notifications
SMTP_HOST=smtp.yourcompany.com
SMTP_PORT=587
SMTP_USER=notifications@yourcompany.com
SMTP_PASS=your_password
```

### Configuration Schema

See the [Configuration Guide](./docs/CONFIGURATION.md) for detailed configuration options.

## API Reference

### REST API Endpoints

```typescript
// Incidents
GET    /api/incidents                    // List incidents
POST   /api/incidents                    // Create incident
GET    /api/incidents/:id                // Get incident
PATCH  /api/incidents/:id                // Update incident
DELETE /api/incidents/:id                // Delete incident

// Post-Mortems
GET    /api/incidents/:id/postmortem     // Get post-mortem
POST   /api/incidents/:id/postmortem     // Generate post-mortem
GET    /api/postmortems/:id/markdown     // Export as Markdown
GET    /api/postmortems/:id/pdf          // Export as PDF

// Runbooks
GET    /api/runbooks                     // List runbooks
POST   /api/runbooks                     // Create runbook
GET    /api/runbooks/:id                 // Get runbook
POST   /api/runbooks/:id/execute         // Execute runbook

// Status Page
GET    /api/status                       // Get status page data
GET    /api/status/public                // Get public status data
POST   /api/status/subscribe             // Subscribe to updates

// MTTR & Metrics
GET    /api/metrics/mttr                 // Get MTTR metrics
GET    /api/metrics/dashboard            // Get dashboard data
POST   /api/metrics/targets              // Update MTTR targets
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: support@crowdtrainer.com
- 💬 Slack: [#incident-management](https://crowdtrainer.slack.com)
- 📖 Documentation: [docs.crowdtrainer.com](https://docs.crowdtrainer.com)
- 🐛 Issues: [GitHub Issues](https://github.com/crowdtrainer/monitoring-service/issues)

## Roadmap

- [ ] **AI-Powered Root Cause Analysis** - Machine learning for automated RCA
- [ ] **Mobile App** - iOS/Android app for incident response
- [ ] **Slack/Teams Bot** - Native chat bot integration
- [ ] **Terraform Provider** - Infrastructure as Code integration
- [ ] **Advanced Analytics** - Predictive incident modeling
- [ ] **Multi-tenant Architecture** - Support for multiple organizations
- [ ] **Compliance Reports** - SOC2, ISO27001 compliance reporting

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.