# Multi-stage build for optimized production image
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install production dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    ca-certificates \
    tzdata \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S monitoring -u 1001

# Set working directory
WORKDIR /app

# Copy built application and production dependencies
COPY --from=builder --chown=monitoring:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=monitoring:nodejs /app/dist ./dist
COPY --from=builder --chown=monitoring:nodejs /app/package.json ./

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R monitoring:nodejs /app

# Switch to non-root user
USER monitoring

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Metadata
LABEL maintainer="CrowdTrainer Team"
LABEL description="Monitoring Service API Server"
LABEL version="1.0.0"