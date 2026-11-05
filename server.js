import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '80', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'quota-ember-state.json');
const DIST_DIR = path.join(__dirname, 'dist');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_STATE = {
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

let currentState = JSON.parse(JSON.stringify(DEFAULT_STATE));
let revision = 1;
let updatedAt = new Date().toISOString();

// Load persisted state if exists
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.state && typeof data.state === 'object') {
          currentState = { ...DEFAULT_STATE, ...data.state };
          if (typeof data.revision === 'number') revision = data.revision;
          if (typeof data.updatedAt === 'string') updatedAt = data.updatedAt;
        } else if (Array.isArray(data.accounts)) {
          currentState = { ...DEFAULT_STATE, ...data };
          if (typeof data.revision === 'number') revision = data.revision;
          if (typeof data.updatedAt === 'string') updatedAt = data.updatedAt;
        }
      }
      console.log(`Loaded state from ${STATE_FILE} (revision: ${revision})`);
    } catch (err) {
      console.error(`Failed to load state from ${STATE_FILE}:`, err);
    }
  } else {
    console.log(`No existing state file found at ${STATE_FILE}, starting with default state.`);
  }
}

// Atomic file persistence helper
function persistState() {
  const tempFile = `${STATE_FILE}.tmp`;
  const payload = {
    revision,
    updatedAt,
    state: currentState,
  };
  fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tempFile, STATE_FILE);
}

function validateAppState(candidate) {
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

const app = express();

// Parse JSON bodies up to 50MB
app.use(express.json({ limit: '50mb' }));

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Dynamic environment configuration
app.get('/env-config.js', (req, res) => {
  const password = (process.env.VITE_APP_PASSWORD || 'password123').replace(/"/g, '\\"');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__ENV__ = { VITE_APP_PASSWORD: "${password}" };`);
});

// GET /api/state: Returns { state, revision, updatedAt }
app.get('/api/state', (req, res) => {
  res.json({
    state: currentState,
    revision,
    updatedAt,
  });
});

// GET /api/state/meta: Returns { revision, updatedAt, hasData }
app.get('/api/state/meta', (req, res) => {
  const hasData =
    (Array.isArray(currentState.accounts) && currentState.accounts.length > 0) ||
    (Array.isArray(currentState.usageEvents) && currentState.usageEvents.length > 0);
  res.json({
    revision,
    updatedAt,
    hasData: Boolean(hasData),
  });
});

// POST /api/state: Accepts { state: AppState } or direct AppState
app.post('/api/state', (req, res) => {
  const body = req.body;
  const candidate = (body && body.state && typeof body.state === 'object') ? body.state : body;

  if (!validateAppState(candidate)) {
    return res.status(400).json({
      error: 'Invalid state payload. Expected AppState object with accounts, services, limitWindows, projects, and usageEvents arrays.',
    });
  }

  currentState = {
    version: typeof candidate.version === 'number' ? candidate.version : 1,
    accounts: candidate.accounts,
    services: candidate.services,
    limitWindows: candidate.limitWindows,
    projects: candidate.projects,
    usageEvents: candidate.usageEvents,
    settings: candidate.settings || DEFAULT_STATE.settings,
  };

  revision += 1;
  updatedAt = new Date().toISOString();
  persistState();

  res.json({
    ok: true,
    revision,
    updatedAt,
  });
});

// Serve /assets with immutable cache headers
app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), {
  immutable: true,
  maxAge: '1y',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Serve remaining static assets from dist
app.use(express.static(DIST_DIR));

// SPA routing fallback for any route not starting with /api
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Quota Ember server listening on http://0.0.0.0:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`State file: ${STATE_FILE}`);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing server...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, closing server...');
  server.close(() => {
    process.exit(0);
  });
});

export default app;
