import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

function apiStatePlugin(): Plugin {
  const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
  const stateFile = path.join(dataDir, 'quota-ember-state.json');

  const defaultState = {
    version: 1,
    accounts: [],
    services: [],
    limitWindows: [],
    projects: [],
    usageEvents: [],
    settings: {
      defaultTimeZone: 'UTC',
      lowCapacityThresholdPercent: 80,
      staleDataThresholdHours: 24,
    },
  };

  let currentState = JSON.parse(JSON.stringify(defaultState));
  let revision = 1;
  let updatedAt = new Date().toISOString();

  function loadState() {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(stateFile)) {
      try {
        const raw = fs.readFileSync(stateFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          if (data.state && typeof data.state === 'object') {
            currentState = { ...defaultState, ...data.state };
            if (typeof data.revision === 'number') revision = data.revision;
            if (typeof data.updatedAt === 'string') updatedAt = data.updatedAt;
          } else if (Array.isArray(data.accounts)) {
            currentState = { ...defaultState, ...data };
            if (typeof data.revision === 'number') revision = data.revision;
            if (typeof data.updatedAt === 'string') updatedAt = data.updatedAt;
          }
        }
      } catch (err) {
        console.error('Failed to load state in vite plugin:', err);
      }
    }
  }

  function saveState() {
    fs.mkdirSync(dataDir, { recursive: true });
    const payload = { revision, updatedAt, state: currentState };
    const tmp = `${stateFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmp, stateFile);
  }

  function validateAppState(candidate: any) {
    if (!candidate || typeof candidate !== 'object') return false;
    return (
      Array.isArray(candidate.accounts) &&
      Array.isArray(candidate.services) &&
      Array.isArray(candidate.limitWindows) &&
      Array.isArray(candidate.projects) &&
      Array.isArray(candidate.usageEvents)
    );
  }

  loadState();

  return {
    name: 'api-state-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';

        if (url === '/api/state/meta' && req.method === 'GET') {
          const hasData =
            (Array.isArray(currentState.accounts) && currentState.accounts.length > 0) ||
            (Array.isArray(currentState.usageEvents) && currentState.usageEvents.length > 0);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ revision, updatedAt, hasData: Boolean(hasData) }));
          return;
        }

        if (url === '/api/state' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ state: currentState, revision, updatedAt }));
          return;
        }

        if (url === '/api/state' && req.method === 'POST') {
          let rawBody = '';
          req.on('data', (chunk) => {
            rawBody += chunk;
          });
          req.on('end', () => {
            try {
              const body = JSON.parse(rawBody);
              const candidate = body && body.state && typeof body.state === 'object' ? body.state : body;

              if (!validateAppState(candidate)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error:
                      'Invalid state payload. Expected AppState object with accounts, services, limitWindows, projects, and usageEvents arrays.',
                  })
                );
                return;
              }

              currentState = {
                version: typeof candidate.version === 'number' ? candidate.version : 1,
                accounts: candidate.accounts,
                services: candidate.services,
                limitWindows: candidate.limitWindows,
                projects: candidate.projects,
                usageEvents: candidate.usageEvents,
                settings: candidate.settings || defaultState.settings,
              };

              revision += 1;
              updatedAt = new Date().toISOString();
              saveState();

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, revision, updatedAt }));
            } catch {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
          });
          return;
        }

        if (url === '/env-config.js' && req.method === 'GET') {
          const password = (process.env.VITE_APP_PASSWORD || 'password123').replace(/"/g, '\\"');
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-store');
          res.end(`window.__ENV__ = { VITE_APP_PASSWORD: "${password}" };`);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiStatePlugin()],
  server: {
    port: 5190,
    host: true,
    allowedHosts: true,
  },
});
