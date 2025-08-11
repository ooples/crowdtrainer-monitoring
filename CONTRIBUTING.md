# Contributing to Monitoring Service

Thank you for your interest in contributing to the Monitoring Service! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. We expect all contributors to be respectful, inclusive, and collaborative.

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0  
- **Git**
- **PostgreSQL** >= 14 (for local development)
- **Redis** >= 6.0 (for local development)

### Local Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/monitoring-service.git
   cd monitoring-service
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development services**
   ```bash
   # Option 1: Use Docker (recommended)
   pnpm docker:up

   # Option 2: Local services
   # Make sure PostgreSQL and Redis are running locally
   pnpm dev
   ```

5. **Verify setup**
   - Dashboard: http://localhost:3000
   - API Server: http://localhost:8080
   - API Docs: http://localhost:8080/docs

## Development Workflow

### Branch Naming

Use descriptive branch names with the following prefixes:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/improvements
- `chore/` - Maintenance tasks

Examples:
- `feature/real-time-alerts`
- `fix/dashboard-memory-leak`
- `docs/api-reference-update`

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow our coding standards (see below)
   - Add tests for new functionality
   - Update documentation as needed

3. **Run quality checks**
   ```bash
   # Type checking
   pnpm type-check

   # Linting
   pnpm lint

   # Tests
   pnpm test

   # Format code
   pnpm format
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add real-time alert notifications"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `style:` - Code style changes
   - `refactor:` - Code refactoring
   - `test:` - Test updates
   - `chore:` - Maintenance

5. **Push and create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### TypeScript Guidelines

- Use strict TypeScript settings
- Prefer explicit types over `any`
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer functional programming patterns

### Code Style

We use Prettier and ESLint for consistent code formatting:

```bash
# Fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Testing Guidelines

- Write tests for all new functionality
- Maintain high test coverage (>80%)
- Use descriptive test names
- Test both happy path and error scenarios
- Mock external dependencies

#### Test Types

1. **Unit Tests** - Test individual functions/components
2. **Integration Tests** - Test package interactions
3. **E2E Tests** - Test complete user workflows

```bash
# Run specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e

# Run tests with coverage
pnpm test:coverage
```

### Package Structure

When creating new packages, follow this structure:

```
packages/your-package/
├── src/
│   ├── index.ts          # Main entry point
│   ├── types.ts          # Type definitions
│   └── ...
├── tests/
│   ├── unit/
│   ├── integration/
│   └── ...
├── package.json
├── tsconfig.json         # Extends from root
├── README.md
└── CHANGELOG.md
```

### Documentation

- Update README files for significant changes
- Add JSDoc comments to public APIs
- Include examples in documentation
- Update CHANGELOG.md with your changes

## Pull Request Process

### Before Submitting

1. **Ensure all checks pass**
   ```bash
   pnpm type-check
   pnpm lint
   pnpm test
   pnpm build
   ```

2. **Update documentation**
   - Update relevant README files
   - Add/update JSDoc comments
   - Update API documentation if needed

3. **Add changeset** (for package updates)
   ```bash
   pnpm changeset
   ```

### Pull Request Template

When creating a PR, include:

1. **Description** - What does this PR do?
2. **Motivation** - Why is this change needed?
3. **Testing** - How was this tested?
4. **Breaking Changes** - Any breaking changes?
5. **Screenshots** - For UI changes

### Review Process

1. **Automated Checks** - CI must pass
2. **Code Review** - At least one maintainer review
3. **Testing** - Manual testing if needed
4. **Documentation** - Ensure docs are updated

## Package Management

### Adding Dependencies

Always use the workspace catalog when possible:

```bash
# Add to catalog (preferred)
# Edit pnpm-workspace.yaml catalog section

# Add to specific package
cd packages/your-package
pnpm add dependency-name
```

### Workspace Dependencies

Reference other packages in the monorepo:

```json
{
  "dependencies": {
    "@monitoring-service/core": "workspace:*"
  }
}
```

## Release Process

We use [Changesets](https://github.com/changesets/changesets) for version management:

1. **Add changeset for your changes**
   ```bash
   pnpm changeset
   ```

2. **Maintainers handle releases**
   ```bash
   pnpm changeset:version  # Updates versions
   pnpm release           # Publishes packages
   ```

## Performance Guidelines

### Bundle Size

- Keep SDK bundles under 50KB gzipped
- Use tree-shaking friendly exports
- Avoid unnecessary dependencies
- Use dynamic imports for large features

### API Performance

- Response times < 100ms (p95)
- Efficient database queries
- Proper caching strategies
- Monitoring and alerting

### Frontend Performance

- Core Web Vitals compliance
- Lazy loading for non-critical features
- Optimized images and assets
- Progressive enhancement

## Security

### Security Guidelines

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all user inputs
- Follow OWASP security guidelines
- Regular dependency updates

### Reporting Security Issues

Please report security vulnerabilities privately:
- Email: security@yourorg.com
- Do not create public issues for security problems

## Getting Help

### Resources

- **Documentation**: [docs.yourorg.com](https://docs.yourorg.com)
- **API Reference**: [api.yourorg.com](https://api.yourorg.com)
- **Discord**: [Join our community](https://discord.gg/yourorg)

### Common Issues

1. **Build Failures**
   - Clear node_modules: `rm -rf node_modules && pnpm install`
   - Check Node.js version matches .nvmrc

2. **Test Failures**
   - Ensure test services are running
   - Check environment variables

3. **Type Errors**
   - Run `pnpm type-check` for detailed errors
   - Ensure dependencies are up to date

## Recognition

Contributors will be recognized in:
- CHANGELOG.md
- GitHub contributors
- Annual contributor report

Thank you for contributing to Monitoring Service! 🎉