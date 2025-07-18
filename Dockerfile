FROM node:18-alpine AS base

RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

WORKDIR /app

FROM base AS builder
ENV NODE_ENV=production

RUN npm install -g firebase-tools

COPY package*.json ./

RUN if [ -f package-lock.json ]; then \
        echo "📦 Found package-lock.json - using npm ci for faster, reliable builds"; \
        npm ci --include=dev --frozen-lockfile; \
    else \
        echo "⚠️  No package-lock.json found - using npm install (will generate lockfile)"; \
        npm install --include=dev; \
        echo "✅ Generated package-lock.json during build"; \
    fi

COPY . .

RUN echo "🏗️  Building application..." && \
    npm run build && \
    echo "🔥 Deploying Firebase rules and indexes..." && \
    if [ -n "$FIREBASE_TOKEN" ]; then \
        firebase deploy --only firestore:rules --token "$FIREBASE_TOKEN" --non-interactive; \
        firebase deploy --only firestore:indexes --token "$FIREBASE_TOKEN" --non-interactive; \
        echo "✅ Firebase deployment completed"; \
    else \
        echo "⚠️  FIREBASE_TOKEN not provided - skipping Firebase deployment"; \
    fi && \
    echo "🧹 Cleaning up dev dependencies..." && \
    npm prune --production && \
    npm cache clean --force && \
    echo "✅ Build completed successfully"

FROM node:18-alpine AS production

RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    && rm -rf /var/cache/apk/* \
    && rm -rf /tmp/*

RUN addgroup -g 1001 -S nodejs && \
    adduser -S buildhive -u 1001 -G nodejs

WORKDIR /app

COPY --from=builder --chown=buildhive:nodejs /app/dist ./dist
COPY --from=builder --chown=buildhive:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=buildhive:nodejs /app/package*.json ./

RUN mkdir -p logs storage tmp && \
    chown -R buildhive:nodejs logs storage tmp && \
    chmod 755 logs storage tmp

RUN mkdir -p uploads uploads/jobs uploads/temp && \
    chown -R buildhive:nodejs uploads && \
    chmod 755 uploads uploads/jobs uploads/temp

USER buildhive

EXPOSE 3000

ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=1024 --unhandled-rejections=strict" \
    UV_THREADPOOL_SIZE=4 \
    TZ=UTC

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e " \
        const http = require('http'); \
        const options = { \
            hostname: 'localhost', \
            port: 3000, \
            path: '/health', \
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

ENTRYPOINT ["/sbin/tini", "--"]

CMD ["dumb-init", "node", "--enable-source-maps", "--trace-warnings", "dist/server.js"]

LABEL maintainer="FlameGreat-1" \
      version="1.0.0" \
      description="BuildHive Construction Marketplace API" \
      org.opencontainers.image.source="https://github.com/FlameGreat-1/BuildHive-Backend" \
      org.opencontainers.image.documentation="https://github.com/FlameGreat-1/BuildHive-Backend#readme" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.title="BuildHive API" \
      org.opencontainers.image.description="Construction Marketplace Backend API"
