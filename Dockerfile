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

# Install dependencies (including dev for build)
RUN npm ci --include=dev --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client and build
RUN npx prisma generate && \
    npm run build && \
    npm prune --production && \
    npm cache clean --force

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

# Create necessary directories
RUN mkdir -p logs storage tmp && \
    chown -R buildhive:nodejs logs storage tmp

# Switch to non-root user
USER buildhive

# Expose port
EXPOSE 3000

# Production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=1024" \
    UV_THREADPOOL_SIZE=4

# Health check using Node.js instead of curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start with graceful shutdown support
CMD ["dumb-init", "node", "--enable-source-maps", "dist/server.js"]

# Labels for production tracking
LABEL maintainer="FlameGreat-1" \
      version="1.0.0" \
      description="BuildHive Construction Marketplace API" \
      org.opencontainers.image.source="https://github.com/FlameGreat-1/BuildHive-Backend"
