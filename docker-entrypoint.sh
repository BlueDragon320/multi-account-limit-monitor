#!/bin/sh
set -e

# Generate runtime env config for browser consumption in Docker
PASSWORD="${VITE_APP_PASSWORD:-${APP_PASSWORD:-password123}}"
cat <<EOF > /usr/share/nginx/html/env-config.js
window.__ENV__ = {
  VITE_APP_PASSWORD: "${PASSWORD}"
};
EOF

exec "$@"
