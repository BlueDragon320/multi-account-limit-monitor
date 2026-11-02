# Quota Ember — Personal Quota & Reset Tracker

A calm, personal control panel for comparing available quota across accounts and tracking which projects consumed it.

Quota Ember is a local-first, zero-dependency client web application built for engineers navigating multiple Google accounts, AI studio tiers, and quota windows. The user maintains figures manually, so recency and reset timing matter as much as remaining capacity.

---

## Key Features

1. **Overview Dashboard**
   - Live comparison of remaining quota and capacity across all accounts and limit windows.
   - Text and color badges for **Low Capacity** (default $\ge 80\%$ used) and **Stale Data** (default $> 24\text{h}$ since last update).
   - Real-time countdowns (`in 3h 12m`, `in 2d 5h`) and absolute local timestamps with IANA timezone indicators.
   - Quick actions to log usage or correct balances in one click.
   - Sample-free onboarding: clear empty state prevents confusion between demo samples and real manual records.
   - Editorial note detailing the manual nature of the tool and reset mechanics.

2. **Accounts & Limits Management**
   - Independent management of Accounts, Services, and Limit Windows.
   - Account archiving and restoration preserving historical integrity.
   - Editable presets for the four named services without inventing numerical claims:
     - **Antigravity**: coexisting independent Hourly and Weekly request limit windows.
     - **Google Flow**: Monthly credit allowance with month-end clamping.
     - **Google AI Studio**: Daily requests limit.
     - **Gemini**: Daily prompts limit.
     - **Custom Service**: Arbitrary custom cadence, units, and intervals.
   - Live reset preview when editing window cadence or anchors.

3. **Projects & Usage History**
   - Multi-window usage events: records a single event affecting multiple windows (e.g. hourly burst + weekly ceiling) without accidental double-counting.
   - Balance previews before saving: see previous, delta, new balance, and overflow status before committing.
   - Balance corrections: distinct from project consumption, maintaining an audit trail with previous values and reason.
   - Strict unit segregation: project totals never blend unlike units (`credits` vs `requests` vs `custom`) and never sum percentages of differing capacities.

4. **Settings & Data Management**
   - Configurable low-capacity percentage and stale-data hour thresholds.
   - Default timezone selector with automatic local timezone detection.
   - Versioned JSON export with timestamped filename (`quota-ember-backup-*.json`).
   - Strict JSON import validation: checks structure, enums, numbers, and referential integrity (e.g., window-to-service links) before presenting a comparison preview (accounts, services, windows, projects, events counts) with an explicit Replace vs Cancel confirmation.
   - Local browser storage transparency warning.

---

## Architecture & Design

### Terminal Ember Aesthetic
Follows the **Terminal Ember** developer-tool specification:
- Background: `#181818` near-black body with `#252422` surface panels and `#030302` recess depths.
- Accent: `#FF6542` coral glow rationed strictly to the hero radial glow, nav CTA pill, and status badges.
- Typography: Monospace (`GeistMono`, system mono fallback) across all labels, tables, and buttons; human-centered display headings; and handwritten annotation flourishes.
- Bounded floating navbar and cream paper card (`#FBFAF9` with `#0C0B09` ink).

### Separation of Concerns
```
src/
├── domain/                  # Pure TypeScript business logic (zero UI dependencies)
│   ├── types.ts             # Strict domain models, interfaces, and inputs
│   ├── resetEngine.ts       # Timezone, DST, month-end clamping, and cadence calculations
│   ├── presets.ts           # Service templates & window configurations
│   ├── calculations.ts      # Usage preview, multi-window application, segregated totals
│   └── useAppState.ts       # React state hook with periodic reset checks
├── storage/                 # Local persistence and versioned migration
│   ├── storage.ts           # LocalStorage adapter, reactive multi-tab sync, clean seed
│   └── exportImport.ts      # JSON export, schema validation, import diff summary
├── components/              # Responsive React UI components and modals
│   ├── Navbar.tsx           # Floating bounded navigation bar
│   ├── OverviewScreen.tsx   # Quota dashboard, window cards, and founder note
│   ├── AccountsScreen.tsx   # Account and service/window configuration
│   ├── ProjectsScreen.tsx   # Segregated project totals and usage history
│   ├── SettingsScreen.tsx   # Timezones, thresholds, export/import
│   └── modals/              # Log usage, balance correction, and confirmation dialogs
└── styles/
    └── theme.css            # Terminal Ember CSS design tokens and layout rules
```

---

## Reset Cadence Rules

All reset calculations preserve the local wall-clock time in the configured IANA time zone:

1. **Hourly**:
   - Resets every hour at the exact minute and second of the configured `resetAnchor`.
2. **Daily**:
   - Resets every 24 hours at the configured anchor time.
   - Automatically shifts UTC timestamps across **Daylight Saving Time (DST)** transitions to keep local clock time constant (e.g., 09:00 AM EDT $\rightarrow$ 09:00 AM EST).
3. **Weekly**:
   - Resets every 7 days on the configured day of the week and local clock time.
4. **Monthly & Month-End Clamping**:
   - Anchors on the 29th, 30th, or 31st automatically clamp to the last day of shorter months (e.g., Jan 31 $\rightarrow$ Feb 28 in regular years, Feb 29 in leap years, Mar 31, Apr 30) without skipping or shifting future months.
5. **Custom**:
   - Advances in custom step intervals of hours (e.g., every 12 hours).
6. **Missed Periods**:
   - If an account has not been viewed across multiple reset periods, Quota Ember calculates the current active period, resets `currentUsed` to 0 for the active window, and records the evaluation timestamp while keeping all historical entries intact.

---

## Development & Verification

### Prerequisites
- Node.js $\ge 18$ (Tested with Node v22.23.4)
- npm $\ge 9$

### Setup
```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run all test suites
npm test

# Build production bundle
npm run build
```

### Test Coverage
Quota Ember includes 92 unit tests covering:
- **`tests/resetEngine.test.ts`**: DST shifts (New York EST/EDT, London GMT/BST), month-end clamping (Feb 28/29, Mar 31, Apr 30), multiple missed reset intervals, custom cadence, and countdown formatting.
- **`tests/calculations.test.ts`**: Multi-window usage events without double counting, balance preview calculation, manual correction audits, project totals unit segregation, and capacity thresholds.
- **`tests/storage.test.ts`**: LocalStorage save/load roundtrips, corrupted JSON recovery, reactive multi-tab subscriptions, and clear operations.
- **`tests/exportImport.test.ts`**: Versioned JSON serialization, structural and referential schema validation, duplicate ID rejection, and import replacement diff summaries.
- **`tests/components.test.tsx`**: UI rendering, modal workflows, quick balance actions, and settings import/export flows.

---

## Production Hosting & Docker

Quota Ember is fully containerized and production-ready with a multi-stage Docker build served via a high-performance, secure Nginx Alpine server.

### Architecture Overview
- **Stage 1 (Builder)**: Uses `node:22-alpine` to install dependencies via `npm ci` and compile static assets with Vite and TypeScript.
- **Stage 2 (Runner)**: Uses `nginx:alpine` to serve optimized static HTML/CSS/JS with gzip compression enabled, client-side SPA routing (`try_files $uri $uri/ /index.html;`), immutable asset caching for `/assets/`, security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`), and an embedded healthcheck endpoint at `/health`.
- **Zero Backend Dependencies**: By design, no external database (PostgreSQL, Redis, MySQL), backend runtime, or authentication server is required.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v20.10+) or [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/) (v2.0+)

### Running with Docker Compose (Recommended)

Start the production container in detached mode:
```bash
docker compose up -d
```
The application will be accessible at: **`http://localhost:5190`**

#### Customizing the Host Port
You can specify a custom host port using the `PORT` environment variable:
```bash
PORT=8080 docker compose up -d
```
Access the application at: **`http://localhost:8080`**

#### Access Password Protection (.env)
Quota Ember includes a master password gate to protect your terminal against unauthorized access.
- **Configured in `.env`**: Set `VITE_APP_PASSWORD=your_password` in `.env` (default is `password123`).
- **Dynamic Docker Runtime Injection**: When running in Docker, `docker-entrypoint.sh` injects the password into the web client at container startup. Changing the password in `.env` or setting `-e VITE_APP_PASSWORD=newpassword` takes effect immediately on container restart without needing to rebuild the image!
- **Session Locking**: Click the lock icon in the top header or **Lock Terminal Now** in Settings to lock your session anytime. "Remember this device" preserves unlock across browser reloads.


### Running Standalone with Docker CLI

1. **Build the Docker image**:
   ```bash
   docker build -t quota-ember .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     -p 5190:80 \
     --name quota-ember \
     --restart unless-stopped \
     quota-ember
   ```

3. **Verify the container is running and healthy**:
   ```bash
   docker ps -f name=quota-ember
   ```

### Stopping and Updating the Container

- **Stop Docker Compose**:
  ```bash
  docker compose down
  ```
- **Rebuild and restart after updates**:
  ```bash
  docker compose up -d --build
  ```
- **Stop and remove standalone container**:
  ```bash
  docker stop quota-ember
  docker rm quota-ember
  ```

### Local Storage & Data Persistence Notice

> [!IMPORTANT]
> **Quota Ember is a local-first application storing state directly in the user's browser `localStorage`.**
>
> - **Container Role**: Running Quota Ember in Docker provides a static web server delivering compiled HTML, JavaScript, and CSS to your web browser. The Docker container itself does **not** store your quota balances, account limits, or project events.
> - **Multi-Device / Multi-Browser Isolation**: Browsing to `http://localhost:5190` from different browsers (e.g. Chrome vs. Firefox) or different client machines will each maintain their own independent, isolated `localStorage`. Docker does **not** synchronize or share state across clients.
> - **Backup & Migration**: To transfer data between browsers or preserve data across browser cache purges, navigate to the **Settings** screen and click **Export Backup (JSON)**. You can restore your data at any time via **Import Backup (JSON)**.

---

## Local-First Storage & Privacy

- **No Remote Servers**: Quota Ember does not transmit any data over the network.
- **No Google Passwords or API Tokens**: Tracking is purely based on manual owner records; no credentials or Google Cloud tokens are ever requested or stored.
- **Browser-Specific**: Data is saved to `window.localStorage` under key `quota_ember_app_state_v1`. To avoid data loss if browser storage is cleared, use the **Export Backup** feature in Settings regularly.
