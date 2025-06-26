# Multi-stage build for BuildHive API - Production Ready
FROM node:18-alpine AS base

# Install system dependencies and security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Create app directory
WORKDIR /app

# Build stage
FROM base AS builder
ENV NODE_ENV=production

# Copy package files first (for better caching)
COPY package*.json ./
COPY prisma ./prisma/

# Smart dependency installation - handles missing package-lock.json
RUN if [ -f package-lock.json ]; then \
        echo "📦 Found package-lock.json - using npm ci for faster, reliable builds"; \
        npm ci --include=dev --frozen-lockfile; \
    else \
        echo "⚠️  No package-lock.json found - using npm install (will generate lockfile)"; \
        npm install --include=dev; \
        echo "✅ Generated package-lock.json during build"; \
    fi

# Copy source code
COPY . .

# Generate Prisma client and build
RUN echo "🔄 Generating Prisma client..." && \
    npx prisma generate && \
    echo "🏗️  Building application..." && \
    npm run build && \
    echo "🧹 Cleaning up dev dependencies..." && \
    npm prune --production && \
    npm cache clean --force && \
    echo "✅ Build completed successfully"

# Production stage
FROM node:18-alpine AS production

# Install production system dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S buildhive -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application with proper ownership
COPY --from=builder --chown=buildhive:nodejs /app/dist ./dist
COPY --from=builder --chown=buildhive:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=buildhive:nodejs /app/package*.json ./
COPY --from=builder --chown=buildhive:nodejs /app/prisma ./prisma

# Create necessary directories with proper permissions
RUN mkdir -p logs storage tmp && \
    chown -R buildhive:nodejs logs storage tmp && \
    chmod 755 logs storage tmp

# Switch to non-root user
USER buildhive

# Expose port
EXPOSE 3000

# Production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=1024 --unhandled-rejections=strict" \
    UV_THREADPOOL_SIZE=4 \
    TZ=UTC

# Health check using Node.js instead of curl (more secure and reliable)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e " \
        const http = require('http'); \
        const options = { \
            hostname: 'localhost', \
            port: 3000, \
            path: '/api/health', \
            method: 'GET', \
            timeout: 5000 \
        }; \
        const req = http.request(options, (res) => { \
            process.exit(res.statusCode === 200 ? 0 : 1); \
        }); \
        req.on('error', () => process.exit(1)); \
        req.on('timeout', () => process.exit(1)); \
        req.end(); \
    "

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start with graceful shutdown support and better error handling
CMD ["dumb-init", "node", "--enable-source-maps", "--trace-warnings", "dist/server.js"]

# Labels for production tracking and metadata
LABEL maintainer="FlameGreat-1" \
      version="1.0.0" \
      description="BuildHive Construction Marketplace API" \
      org.opencontainers.image.source="https://github.com/FlameGreat-1/BuildHive-Backend" \
      org.opencontainers.image.documentation="https://github.com/FlameGreat-1/BuildHive-Backend#readme" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.title="BuildHive API" \
      org.opencontainers.image.description="Construction Marketplace Backend API"
