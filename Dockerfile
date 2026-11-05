# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests first for optimal layer caching
COPY package.json package-lock.json ./

# Install all dependencies including devDependencies for build
RUN npm ci

# Copy full application source code
COPY . .

# Compile TypeScript and build production distribution with Vite
RUN npm run build

# Stage 2: Production runner stage
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Copy package manifests and install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy production Express server
COPY server.js ./

# Prepare persistent data directory with proper ownership
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-privileged node user
USER node

# Expose standard HTTP port
EXPOSE 80

# Health check against server /health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/health || exit 1

# Start the Node.js production server
CMD ["node", "server.js"]
