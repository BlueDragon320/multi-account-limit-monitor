import { describe, it, expect } from 'vitest';
import {
  previewUsageEvent,
  applyUsageEvent,
  recordCorrection,
  calculateProjectTotals,
  getProjectTotals,
  isLowCapacity,
  isStaleData,
} from '../src/domain/calculations';
import {
  SERVICE_PRESETS,
  getPresetByName,
  createWindowsFromPreset,
  ANTIGRAVITY_PRESET,
} from '../src/domain/presets';
import { AppState, LimitWindow, UsageEvent } from '../src/domain/types';

describe('calculations: previewUsageEvent', () => {
  it('correctly calculates raw amount usage on standard request windows', () => {
    const window: LimitWindow = {
      id: 'win-req',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Hourly Requests',
      capacity: 100,
      unit: 'requests',
      cadence: 'hourly',
      resetAnchor: new Date().toISOString(),
      timeZone: 'UTC',
      currentUsed: 20,
      lastUpdated: new Date().toISOString(),
      archived: false,
    };

    const preview = previewUsageEvent(window, 15, false);
    expect(preview.windowId).toBe('win-req');
    expect(preview.previousUsed).toBe(20);
    expect(preview.delta).toBe(15);
    expect(preview.newUsed).toBe(35);
    expect(preview.remaining).toBe(65);
    expect(preview.percentUsed).toBe(35);
    expect(preview.percentRemaining).toBe(65);
    expect(preview.exceedsCapacity).toBe(false);
  });

  it('correctly converts percentage amounts to units for non-percent windows', () => {
    const window: LimitWindow = {
      id: 'win-cap-500',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Weekly Quota',
      capacity: 500,
      unit: 'requests',
      cadence: 'weekly',
      resetAnchor: new Date().toISOString(),
      timeZone: 'UTC',
      currentUsed: 100,
      lastUpdated: new Date().toISOString(),
      archived: false,
    };

    // 10% of 500 capacity = 50 requests
    const preview = previewUsageEvent(window, 10, true);
    expect(preview.delta).toBe(50);
    expect(preview.previousUsed).toBe(100);
    expect(preview.newUsed).toBe(150);
    expect(preview.remaining).toBe(350);
    expect(preview.percentUsed).toBe(30);
    expect(preview.exceedsCapacity).toBe(false);
  });

  it('correctly detects when usage exceeds capacity', () => {
    const window: LimitWindow = {
      id: 'win-overflow',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Small Limit',
      capacity: 50,
      unit: 'credits',
      cadence: 'daily',
      resetAnchor: new Date().toISOString(),
      timeZone: 'UTC',
      currentUsed: 40,
      lastUpdated: new Date().toISOString(),
      archived: false,
    };

    const preview = previewUsageEvent(window, 20, false);
    expect(preview.newUsed).toBe(60);
    expect(preview.remaining).toBe(0);
    expect(preview.exceedsCapacity).toBe(true);
  });
});

describe('calculations: applyUsageEvent & Double-Counting Prevention', () => {
  function createInitialState(): AppState {
    const now = new Date().toISOString();
    return {
      version: 1,
      accounts: [{ id: 'acc-1', name: 'Work Account', archived: false, createdAt: now, updatedAt: now }],
      services: [{ id: 'srv-1', accountId: 'acc-1', name: 'Antigravity', archived: false, createdAt: now }],
      limitWindows: [
        {
          id: 'win-hourly',
          serviceId: 'srv-1',
          accountId: 'acc-1',
          name: 'Antigravity Hourly',
          capacity: 100,
          unit: 'requests',
          cadence: 'hourly',
          resetAnchor: now,
          timeZone: 'UTC',
          currentUsed: 10,
          lastUpdated: now,
          archived: false,
        },
        {
          id: 'win-weekly',
          serviceId: 'srv-1',
          accountId: 'acc-1',
          name: 'Antigravity Weekly',
          capacity: 1000,
          unit: 'requests',
          cadence: 'weekly',
          resetAnchor: now,
          timeZone: 'UTC',
          currentUsed: 100,
          lastUpdated: now,
          archived: false,
        },
      ],
      projects: [{ id: 'proj-ember', name: 'Ember Project', archived: false, createdAt: now }],
      usageEvents: [],
      settings: {
        defaultTimeZone: 'UTC',
        lowCapacityThresholdPercent: 80,
        staleDataThresholdHours: 24,
      },
    };
  }

  it('applies a single event affecting multiple windows with explicit per-window effects', () => {
    const state = createInitialState();
    const result = applyUsageEvent(state, {
      projectId: 'proj-ember',
      accountId: 'acc-1',
      serviceId: 'srv-1',
      note: 'Batch prompt run',
      windowIds: ['win-hourly', 'win-weekly'],
      amount: 15,
      isPercentage: false,
    });

    // Exactly one event is created in history
    expect(result.state.usageEvents.length).toBe(1);
    const event = result.event;
    expect(event.type).toBe('usage');
    expect(event.projectId).toBe('proj-ember');
    expect(event.note).toBe('Batch prompt run');
    expect(event.effects.length).toBe(2);

    // Hourly window effect
    const hourlyEffect = event.effects.find((e) => e.windowId === 'win-hourly');
    expect(hourlyEffect).toBeDefined();
    expect(hourlyEffect?.previousUsed).toBe(10);
    expect(hourlyEffect?.amount).toBe(15);
    expect(hourlyEffect?.newUsed).toBe(25);

    // Weekly window effect
    const weeklyEffect = event.effects.find((e) => e.windowId === 'win-weekly');
    expect(weeklyEffect).toBeDefined();
    expect(weeklyEffect?.previousUsed).toBe(100);
    expect(weeklyEffect?.amount).toBe(15);
    expect(weeklyEffect?.newUsed).toBe(115);

    // Verify windows in state were updated
    const updatedHourly = result.state.limitWindows.find((w) => w.id === 'win-hourly');
    expect(updatedHourly?.currentUsed).toBe(25);

    const updatedWeekly = result.state.limitWindows.find((w) => w.id === 'win-weekly');
    expect(updatedWeekly?.currentUsed).toBe(115);
  });

  it('prevents accidental duplicate application if the same windowId is specified multiple times', () => {
    const state = createInitialState();
    const result = applyUsageEvent(state, {
      projectId: 'proj-ember',
      accountId: 'acc-1',
      serviceId: 'srv-1',
      windows: [
        { windowId: 'win-hourly', amount: 20 },
        { windowId: 'win-hourly', amount: 20 }, // duplicate entry
      ],
    });

    // Should dedupe windowId and only apply once
    expect(result.event.effects.length).toBe(1);
    expect(result.event.effects[0].newUsed).toBe(30); // 10 + 20
    const win = result.state.limitWindows.find((w) => w.id === 'win-hourly');
    expect(win?.currentUsed).toBe(30);
  });
});

describe('calculations: recordCorrection', () => {
  it('records an audit correction preserving previous value and distinguishing from project usage', () => {
    const now = new Date().toISOString();
    const state: AppState = {
      version: 1,
      accounts: [{ id: 'acc-1', name: 'Work Account', archived: false, createdAt: now, updatedAt: now }],
      services: [{ id: 'srv-1', accountId: 'acc-1', name: 'Google Flow', archived: false, createdAt: now }],
      limitWindows: [
        {
          id: 'win-flow',
          serviceId: 'srv-1',
          accountId: 'acc-1',
          name: 'Monthly Flow Allowance',
          capacity: 500,
          unit: 'credits',
          cadence: 'monthly',
          resetAnchor: now,
          timeZone: 'UTC',
          currentUsed: 120,
          lastUpdated: now,
          archived: false,
        },
      ],
      projects: [],
      usageEvents: [],
      settings: {
        defaultTimeZone: 'UTC',
        lowCapacityThresholdPercent: 80,
        staleDataThresholdHours: 24,
      },
    };

    const result = recordCorrection(state, {
      windowId: 'win-flow',
      newUsed: 150,
      reason: 'Calibrated from provider console balance',
    });

    expect(result.state.usageEvents.length).toBe(1);
    const event = result.event;
    expect(event.type).toBe('correction');
    expect(event.projectId).toBe(''); // No project attributed
    expect(event.note).toBe('Calibrated from provider console balance');

    expect(event.effects.length).toBe(1);
    expect(event.effects[0].previousUsed).toBe(120);
    expect(event.effects[0].newUsed).toBe(150);
    expect(event.effects[0].amount).toBe(30); // Delta

    const win = result.state.limitWindows.find((w) => w.id === 'win-flow');
    expect(win?.currentUsed).toBe(150);
  });
});

describe('calculations: calculateProjectTotals (Strict Segregation & Double-Counting Safeguards)', () => {
  it('strictly segregates units and capacities across projects', () => {
    const windows: LimitWindow[] = [
      {
        id: 'win-req-100',
        serviceId: 'srv-antigravity',
        accountId: 'acc-1',
        name: 'Hourly 100 req',
        capacity: 100,
        unit: 'requests',
        cadence: 'hourly',
        resetAnchor: '2026-11-01T00:00:00Z',
        timeZone: 'UTC',
        currentUsed: 0,
        lastUpdated: '2026-11-01T00:00:00Z',
        archived: false,
      },
      {
        id: 'win-req-1000',
        serviceId: 'srv-antigravity',
        accountId: 'acc-1',
        name: 'Weekly 1000 req',
        capacity: 1000,
        unit: 'requests',
        cadence: 'weekly',
        resetAnchor: '2026-11-01T00:00:00Z',
        timeZone: 'UTC',
        currentUsed: 0,
        lastUpdated: '2026-11-01T00:00:00Z',
        archived: false,
      },
      {
        id: 'win-credits',
        serviceId: 'srv-flow',
        accountId: 'acc-1',
        name: 'Flow Credits',
        capacity: 500,
        unit: 'credits',
        cadence: 'monthly',
        resetAnchor: '2026-11-01T00:00:00Z',
        timeZone: 'UTC',
        currentUsed: 0,
        lastUpdated: '2026-11-01T00:00:00Z',
        archived: false,
      },
      {
        id: 'win-pct-100',
        serviceId: 'srv-gemini-a',
        accountId: 'acc-1',
        name: 'Gemini A (100 cap)',
        capacity: 100,
        unit: 'percent',
        cadence: 'daily',
        resetAnchor: '2026-11-01T00:00:00Z',
        timeZone: 'UTC',
        currentUsed: 0,
        lastUpdated: '2026-11-01T00:00:00Z',
        archived: false,
      },
      {
        id: 'win-pct-1000',
        serviceId: 'srv-gemini-b',
        accountId: 'acc-1',
        name: 'Gemini B (1000 cap)',
        capacity: 1000,
        unit: 'percent',
        cadence: 'daily',
        resetAnchor: '2026-11-01T00:00:00Z',
        timeZone: 'UTC',
        currentUsed: 0,
        lastUpdated: '2026-11-01T00:00:00Z',
        archived: false,
      },
    ];

    const events: UsageEvent[] = [
      // Event 1: Project Alpha uses 10 requests affecting both hourly and weekly windows
      {
        id: 'e1',
        timestamp: '2026-11-01T10:00:00Z',
        projectId: 'proj-alpha',
        accountId: 'acc-1',
        serviceId: 'srv-antigravity',
        type: 'usage',
        effects: [
          { windowId: 'win-req-100', amount: 10, previousUsed: 0, newUsed: 10 },
          { windowId: 'win-req-1000', amount: 10, previousUsed: 0, newUsed: 10 },
        ],
        createdAt: '2026-11-01T10:00:00Z',
      },
      // Event 2: Project Alpha uses 25 credits on Google Flow
      {
        id: 'e2',
        timestamp: '2026-11-01T11:00:00Z',
        projectId: 'proj-alpha',
        accountId: 'acc-1',
        serviceId: 'srv-flow',
        type: 'usage',
        effects: [
          { windowId: 'win-credits', amount: 25, previousUsed: 0, newUsed: 25 },
        ],
        createdAt: '2026-11-01T11:00:00Z',
      },
      // Event 3: Project Beta uses 50% on win-pct-100
      {
        id: 'e3',
        timestamp: '2026-11-01T12:00:00Z',
        projectId: 'proj-beta',
        accountId: 'acc-1',
        serviceId: 'srv-gemini-a',
        type: 'usage',
        effects: [
          { windowId: 'win-pct-100', amount: 50, previousUsed: 0, newUsed: 50 },
        ],
        createdAt: '2026-11-01T12:00:00Z',
      },
      // Event 4: Project Beta uses 50% on win-pct-1000
      {
        id: 'e4',
        timestamp: '2026-11-01T13:00:00Z',
        projectId: 'proj-beta',
        accountId: 'acc-1',
        serviceId: 'srv-gemini-b',
        type: 'usage',
        effects: [
          { windowId: 'win-pct-1000', amount: 50, previousUsed: 0, newUsed: 50 },
        ],
        createdAt: '2026-11-01T13:00:00Z',
      },
      // Event 5: A correction event (MUST NOT be counted in project usage)
      {
        id: 'corr-1',
        timestamp: '2026-11-01T14:00:00Z',
        projectId: 'proj-alpha', // Even if tagged with a project, correction is ignored
        accountId: 'acc-1',
        serviceId: 'srv-flow',
        type: 'correction',
        effects: [
          { windowId: 'win-credits', amount: 100, previousUsed: 25, newUsed: 125 },
        ],
        createdAt: '2026-11-01T14:00:00Z',
      },
    ];

    const reports = calculateProjectTotals(events, windows);

    // Verify Project Alpha
    const alpha = reports['proj-alpha'];
    expect(alpha).toBeDefined();

    // Check byWindow: hourly has 10, weekly has 10, credits has 25
    expect(alpha.byWindow.length).toBe(3);
    const hourly = alpha.byWindow.find((w) => w.windowId === 'win-req-100');
    expect(hourly?.totalAmount).toBe(10);
    expect(hourly?.unit).toBe('requests');

    const weekly = alpha.byWindow.find((w) => w.windowId === 'win-req-1000');
    expect(weekly?.totalAmount).toBe(10);
    expect(weekly?.unit).toBe('requests');

    const credits = alpha.byWindow.find((w) => w.windowId === 'win-credits');
    expect(credits?.totalAmount).toBe(25); // Excludes the 100 correction!
    expect(credits?.unit).toBe('credits');

    // Verify segregated buckets:
    // Credits and requests are NEVER combined
    expect(alpha.segregatedTotals.some((b) => b.unit === 'credits' && b.totalAmount === 25)).toBe(true);
    expect(alpha.segregatedTotals.some((b) => b.unit === 'requests' && b.windowId === 'win-req-100')).toBe(true);
    expect(alpha.segregatedTotals.some((b) => b.unit === 'requests' && b.windowId === 'win-req-1000')).toBe(true);

    // Verify Project Beta:
    // win-pct-100 (capacity 100) vs win-pct-1000 (capacity 1000) MUST NOT be merged into "100%"!
    const beta = reports['proj-beta'];
    expect(beta).toBeDefined();
    expect(beta.byWindow.length).toBe(2);

    const pct100 = beta.byWindow.find((w) => w.windowId === 'win-pct-100');
    expect(pct100?.totalAmount).toBe(50);
    expect(pct100?.capacity).toBe(100);

    const pct1000 = beta.byWindow.find((w) => w.windowId === 'win-pct-1000');
    expect(pct1000?.totalAmount).toBe(50);
    expect(pct1000?.capacity).toBe(1000);

    // Segregated buckets must have 2 separate percentage entries
    expect(beta.segregatedTotals.length).toBe(2);
    expect(beta.segregatedTotals.find((b) => b.capacity === 100)?.totalAmount).toBe(50);
    expect(beta.segregatedTotals.find((b) => b.capacity === 1000)?.totalAmount).toBe(50);
  });

  it('getProjectTotals returns clean default structure for project with no usage', () => {
    const report = getProjectTotals('proj-nonexistent', [], []);
    expect(report.projectId).toBe('proj-nonexistent');
    expect(report.byWindow).toEqual([]);
    expect(report.segregatedTotals).toEqual([]);
  });
});

describe('calculations: Threshold Detections (isLowCapacity & isStaleData)', () => {
  it('correctly detects low capacity when currentUsed >= threshold percentage', () => {
    const win1: LimitWindow = {
      id: 'w1',
      serviceId: 's1',
      accountId: 'a1',
      name: 'High Usage Window',
      capacity: 100,
      unit: 'requests',
      cadence: 'daily',
      resetAnchor: new Date().toISOString(),
      timeZone: 'UTC',
      currentUsed: 80, // exactly 80%
      lastUpdated: new Date().toISOString(),
      archived: false,
    };
    expect(isLowCapacity(win1, 80)).toBe(true);

    const win2: LimitWindow = {
      ...win1,
      currentUsed: 79.9, // below 80%
    };
    expect(isLowCapacity(win2, 80)).toBe(false);

    const win3: LimitWindow = {
      ...win1,
      currentUsed: 95, // above 80%
    };
    expect(isLowCapacity(win3, 80)).toBe(true);
  });

  it('correctly detects stale data when elapsed hours exceeds threshold', () => {
    const now = new Date('2026-11-02T12:00:00Z');

    // Updated 10 hours ago -> not stale (threshold = 24h)
    const freshWin: LimitWindow = {
      id: 'w-fresh',
      serviceId: 's1',
      accountId: 'a1',
      name: 'Fresh Window',
      capacity: 100,
      unit: 'requests',
      cadence: 'daily',
      resetAnchor: '2026-11-01T00:00:00Z',
      timeZone: 'UTC',
      currentUsed: 10,
      lastUpdated: '2026-11-02T02:00:00Z', // 10h ago
      archived: false,
    };
    expect(isStaleData(freshWin, 24, now)).toBe(false);

    // Updated 25 hours ago -> stale
    const staleWin: LimitWindow = {
      ...freshWin,
      lastUpdated: '2026-11-01T11:00:00Z', // 25h ago
    };
    expect(isStaleData(staleWin, 24, now)).toBe(true);

    // Missing lastUpdated -> stale
    const noUpdateWin: LimitWindow = {
      ...freshWin,
      lastUpdated: '',
    };
    expect(isStaleData(noUpdateWin, 24, now)).toBe(true);
  });
});

describe('presets: Service Preset Definitions', () => {
  it('defines presets for Antigravity, Google Flow, Google AI Studio, Gemini, and Custom', () => {
    expect(SERVICE_PRESETS.length).toBeGreaterThanOrEqual(5);

    const antigravity = getPresetByName('Antigravity');
    expect(antigravity).toBeDefined();
    expect(antigravity?.suggestedWindows.some((w) => w.cadence === 'hourly')).toBe(true);
    expect(antigravity?.suggestedWindows.some((w) => w.cadence === 'weekly')).toBe(true);

    const flow = getPresetByName('Google Flow');
    expect(flow).toBeDefined();
    expect(flow?.suggestedWindows[0].cadence).toBe('monthly');
    expect(flow?.suggestedWindows[0].unit).toBe('credits');

    const aiStudio = getPresetByName('Google AI Studio');
    expect(aiStudio).toBeDefined();
    expect(aiStudio?.suggestedWindows[0].cadence).toBe('daily');

    const gemini = getPresetByName('Gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.suggestedWindows[0].cadence).toBe('daily');
  });

  it('creates LimitWindow instances with unique IDs and initial fields from preset', () => {
    const windows = createWindowsFromPreset(
      ANTIGRAVITY_PRESET,
      'srv-anti',
      'acc-1',
      'America/New_York',
      '2026-11-01T09:00:00Z'
    );

    expect(windows.length).toBe(2);
    expect(windows[0].serviceId).toBe('srv-anti');
    expect(windows[0].accountId).toBe('acc-1');
    expect(windows[0].timeZone).toBe('America/New_York');
    expect(windows[0].currentUsed).toBe(0);
    expect(windows[0].cadence).toBe('hourly');
    expect(windows[1].cadence).toBe('weekly');
    expect(windows[0].id).not.toBe(windows[1].id);
  });
});
