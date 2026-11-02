# Stage 1: Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests first for optimal layer caching
COPY package.json package-lock.json ./

# Install project dependencies deterministically
RUN npm ci

# Copy full application source code
COPY . .

# Compile TypeScript and build production distribution with Vite
RUN npm run build

# Stage 2: Serve stage
FROM nginx:alpine AS runner

# Remove default static welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ensure standard permissions for serving files
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Health check to ensure web server is responding
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

# Launch Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
