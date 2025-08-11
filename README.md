# Monitoring Service

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-8+-orange.svg)](https://pnpm.io/)

Enterprise-grade monitoring service built as a TypeScript monorepo with real-time insights, comprehensive alerting, and multi-platform SDK support.

## 🚀 Features

- **Real-time Monitoring** - Live metrics, traces, and logs with sub-second latency
- **Multi-platform SDKs** - Native support for JavaScript, React, and React Native
- **Scalable Architecture** - Built on modern microservices with horizontal scaling
- **Advanced Analytics** - AI-powered insights and anomaly detection
- **Custom Dashboards** - Drag-and-drop dashboard builder with rich visualizations
- **Intelligent Alerting** - Smart thresholds with ML-based predictions
- **Enterprise Security** - SOC2 compliant with end-to-end encryption
- **Developer Experience** - TypeScript-first with comprehensive documentation

## 📦 Packages

This monorepo contains the following packages:

| Package | Description | Version |
|---------|-------------|---------|
| [`@monitoring-service/core`](./packages/core) | Core monitoring logic and utilities | ![npm](https://img.shields.io/npm/v/@monitoring-service/core) |
| [`@monitoring-service/server`](./packages/server) | High-performance API server (Fastify) | ![npm](https://img.shields.io/npm/v/@monitoring-service/server) |
| [`@monitoring-service/dashboard`](./packages/dashboard) | Next.js monitoring dashboard | ![npm](https://img.shields.io/npm/v/@monitoring-service/dashboard) |
| [`@monitoring-service/sdk-js`](./packages/sdk-js) | JavaScript/TypeScript SDK | ![npm](https://img.shields.io/npm/v/@monitoring-service/sdk-js) |
| [`@monitoring-service/sdk-react`](./packages/sdk-react) | React hooks and components | ![npm](https://img.shields.io/npm/v/@monitoring-service/sdk-react) |
| [`@monitoring-service/sdk-react-native`](./packages/sdk-react-native) | React Native SDK | ![npm](https://img.shields.io/npm/v/@monitoring-service/sdk-react-native) |

## 🛠️ Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **PostgreSQL** >= 14 (for data persistence)
- **Redis** >= 6.0 (for caching and real-time features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/monitoring-service.git
cd monitoring-service

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
pnpm db:migrate

# Start all services in development mode
pnpm dev
```

### Development URLs

- **Dashboard**: http://localhost:3000
- **API Server**: http://localhost:8080
- **API Documentation**: http://localhost:8080/docs
- **Storybook**: http://localhost:6006

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │   API Server    │    │   Core Logic    │
│   (Next.js)     │◄──►│   (Fastify)     │◄──►│   (TypeScript)  │
│   Port: 3000    │    │   Port: 8080    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SDK     │    │ JavaScript SDK  │    │ React Native    │
│                 │    │                 │    │ SDK             │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, Recharts
- **Backend**: Node.js, Fastify, PostgreSQL, Redis
- **SDKs**: TypeScript, React, React Native
- **Infrastructure**: Docker, Kubernetes, OpenTelemetry
- **Testing**: Vitest, Playwright, Testing Library
- **CI/CD**: GitHub Actions, Changesets

## 🚀 Scripts

### Development
```bash
pnpm dev                    # Start all packages in development mode
pnpm dev:core              # Start core package only
pnpm dev:server            # Start API server only  
pnpm dev:dashboard         # Start dashboard only
```

### Building
```bash
pnpm build                 # Build all packages
pnpm build:core            # Build core package
pnpm build:sdks            # Build all SDK packages
```

### Testing
```bash
pnpm test                  # Run all tests
pnpm test:unit             # Run unit tests
pnpm test:integration      # Run integration tests
pnpm test:e2e              # Run end-to-end tests
pnpm test:coverage         # Run tests with coverage
```

### Code Quality
```bash
pnpm lint                  # Lint all packages
pnpm lint:fix              # Fix linting issues
pnpm type-check            # Type check all packages
pnpm format                # Format code with Prettier
```

### Docker
```bash
pnpm docker:build          # Build Docker images
pnpm docker:up             # Start services with Docker
pnpm docker:down           # Stop Docker services
```

## 📚 Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [SDK Documentation](./docs/sdk-guide.md)
- [Deployment Guide](./docs/deployment.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/monitoring"

# Redis
REDIS_URL="redis://localhost:6379"

# API Configuration
API_PORT=8080
API_HOST=0.0.0.0
JWT_SECRET="your-jwt-secret"

# Dashboard
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
OPENTELEMETRY_ENDPOINT="http://localhost:4317"
```

### Package Configuration

Each package has its own `package.json` and configuration files. See individual package README files for specific setup instructions.

## 🧪 Testing

We maintain high test coverage across all packages:

- **Unit Tests**: Testing individual functions and components
- **Integration Tests**: Testing package interactions
- **E2E Tests**: Testing complete user workflows
- **Performance Tests**: Load testing and benchmarking

```bash
# Run specific test suites
pnpm test packages/core
pnpm test packages/server
pnpm test packages/dashboard
```

## 🔄 Release Process

We use [Changesets](https://github.com/changesets/changesets) for version management:

```bash
# Add a changeset
pnpm changeset

# Version packages
pnpm changeset:version

# Publish packages
pnpm release
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests and ensure they pass
5. Submit a pull request

## 📈 Performance

- **API Response Time**: < 100ms (p95)
- **Dashboard Load Time**: < 2s (p95)
- **SDK Bundle Size**: < 50KB (gzipped)
- **Real-time Latency**: < 500ms
- **Throughput**: 10K+ requests/second

## 🛡️ Security

- All dependencies are regularly audited
- Automated security scanning with Snyk
- SOC2 compliance ready
- End-to-end encryption
- Role-based access control (RBAC)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@yourorg.com
- 💬 Discord: [Join our community](https://discord.gg/yourorg)
- 📖 Documentation: https://docs.yourorg.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/monitoring-service/issues)

---

Built with ❤️ by [Your Organization](https://yourorg.com)