import { describe, it, expect, vi } from 'vitest';
import {
  exportAppStateToJson,
  validateImportJson,
  generateImportDiff,
  downloadJsonBackup,
  ValidationSummary,
} from '../src/storage/exportImport';
import { CURRENT_SCHEMA_VERSION } from '../src/storage/storage';
import { AppState } from '../src/domain/types';

function createValidAppState(): AppState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    accounts: [
      {
        id: 'acc_main',
        name: 'Production Account',
        email: 'ops@example.com',
        notes: 'Main billing account',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'acc_secondary',
        name: 'Staging Account',
        archived: false,
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    services: [
      {
        id: 'srv_antigravity',
        accountId: 'acc_main',
        name: 'Antigravity',
        notes: 'Primary agent backend',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    limitWindows: [
      {
        id: 'win_hourly',
        serviceId: 'srv_antigravity',
        accountId: 'acc_main',
        name: 'Hourly Limit',
        capacity: 1000,
        unit: 'requests',
        cadence: 'hourly',
        resetAnchor: '2026-01-01T00:00:00.000Z',
        timeZone: 'UTC',
        currentUsed: 150,
        lastUpdated: '2026-01-01T01:30:00.000Z',
        archived: false,
      },
      {
        id: 'win_custom',
        serviceId: 'srv_antigravity',
        accountId: 'acc_main',
        name: 'Custom 6-Hour Limit',
        capacity: 500,
        unit: 'credits',
        cadence: 'custom',
        customIntervalHours: 6,
        resetAnchor: '2026-01-01T00:00:00.000Z',
        timeZone: 'UTC',
        currentUsed: 50,
        lastUpdated: '2026-01-01T01:30:00.000Z',
        archived: false,
      },
    ],
    projects: [
      {
        id: 'prj_dashboard',
        name: 'Analytics Dashboard',
        notes: 'Customer facing',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    usageEvents: [
      {
        id: 'evt_1',
        timestamp: '2026-01-01T01:30:00.000Z',
        projectId: 'prj_dashboard',
        accountId: 'acc_main',
        serviceId: 'srv_antigravity',
        type: 'usage',
        note: 'Batch job processing',
        effects: [
          {
            windowId: 'win_hourly',
            amount: 150,
            previousUsed: 0,
            newUsed: 150,
          },
          {
            windowId: 'win_custom',
            amount: 50,
            previousUsed: 0,
            newUsed: 50,
          },
        ],
        createdAt: '2026-01-01T01:30:00.000Z',
      },
    ],
    settings: {
      defaultTimeZone: 'America/Los_Angeles',
      lowCapacityThresholdPercent: 85,
      staleDataThresholdHours: 12,
    },
  };
}

describe('exportImport module', () => {
  describe('exportAppStateToJson', () => {
    it('serializes state into formatted JSON with format, version, and exportedAt metadata', () => {
      const state = createValidAppState();
      const json = exportAppStateToJson(state);

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.format).toBe('quota-ember-backup');
      expect(parsed.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(typeof parsed.exportedAt).toBe('string');
      expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN();
      expect(parsed.data).toEqual(state);
    });

    it('produces formatted JSON with 2-space indentation', () => {
      const state = createValidAppState();
      const json = exportAppStateToJson(state);
      expect(json).toContain('  "format": "quota-ember-backup"');
    });
  });

  describe('validateImportJson roundtrip', () => {
    it('successfully validates and imports a backup exported by exportAppStateToJson', () => {
      const originalState = createValidAppState();
      const exportedJson = exportAppStateToJson(originalState);

      const result = validateImportJson(exportedJson);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.state).toEqual(originalState);
      expect(result.summary).toEqual({
        accountsCount: 2,
        servicesCount: 1,
        windowsCount: 2,
        projectsCount: 1,
        eventsCount: 1,
      });
    });

    it('successfully validates raw AppState JSON without wrapper', () => {
      const originalState = createValidAppState();
      const rawJson = JSON.stringify(originalState);

      const result = validateImportJson(rawJson);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.state).toEqual(originalState);
      expect(result.summary?.accountsCount).toBe(2);
    });
  });

  describe('syntax & format rejection', () => {
    it('rejects empty input or non-string', () => {
      // @ts-expect-error testing runtime validation
      expect(validateImportJson(null).valid).toBe(false);
      expect(validateImportJson('').valid).toBe(false);
      expect(validateImportJson('   ').valid).toBe(false);
    });

    it('rejects malformed JSON syntax', () => {
      const res = validateImportJson('{ version: 1, accounts: ');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('invalid JSON syntax');
    });

    it('rejects non-object root JSON', () => {
      expect(validateImportJson('["array"]').valid).toBe(false);
      expect(validateImportJson('"string"').valid).toBe(false);
      expect(validateImportJson('123').valid).toBe(false);
    });

    it('rejects unknown backup format header', () => {
      const invalidFormatJson = JSON.stringify({
        format: 'some-other-app-backup',
        version: 1,
        data: createValidAppState(),
      });
      const res = validateImportJson(invalidFormatJson);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('unrecognized backup format');
    });
  });

  describe('schema version validation', () => {
    it('rejects missing or non-integer version', () => {
      const state = createValidAppState();
      // @ts-expect-error invalid version
      state.version = 'v1';
      expect(validateImportJson(JSON.stringify(state)).valid).toBe(false);

      // @ts-expect-error missing version
      delete state.version;
      expect(validateImportJson(JSON.stringify(state)).valid).toBe(false);
    });

    it('rejects version < 1', () => {
      const state = createValidAppState();
      state.version = 0;
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain('unsupported schema version');
    });

    it('rejects future version greater than CURRENT_SCHEMA_VERSION', () => {
      const state = createValidAppState();
      state.version = CURRENT_SCHEMA_VERSION + 1;
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain('newer than supported version');
    });
  });

  describe('required collections and settings validation', () => {
    it('rejects if accounts is not an array', () => {
      const state = createValidAppState();
      // @ts-expect-error testing invalid type
      state.accounts = null;
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("'accounts' must be an array");
    });

    it('rejects if services is not an array', () => {
      const state = createValidAppState();
      // @ts-expect-error testing invalid type
      state.services = 'not an array';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("'services' must be an array");
    });

    it('rejects if limitWindows is not an array', () => {
      const state = createValidAppState();
      // @ts-expect-error testing invalid type
      state.limitWindows = {};
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("'limitWindows' must be an array");
    });

    it('rejects if projects is not an array', () => {
      const state = createValidAppState();
      // @ts-expect-error testing invalid type
      state.projects = undefined;
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("'projects' must be an array");
    });

    it('rejects if usageEvents is not an array', () => {
      const state = createValidAppState();
      // @ts-expect-error testing invalid type
      state.usageEvents = 42;
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("'usageEvents' must be an array");
    });

    it('rejects invalid or missing settings', () => {
      const state = createValidAppState();
      // @ts-expect-error testing invalid settings
      delete state.settings;
      expect(validateImportJson(JSON.stringify(state)).valid).toBe(false);

      const state2 = createValidAppState();
      state2.settings.defaultTimeZone = '';
      expect(validateImportJson(JSON.stringify(state2)).valid).toBe(false);

      const state3 = createValidAppState();
      state3.settings.lowCapacityThresholdPercent = 150;
      expect(validateImportJson(JSON.stringify(state3)).valid).toBe(false);

      const state4 = createValidAppState();
      state4.settings.staleDataThresholdHours = -5;
      expect(validateImportJson(JSON.stringify(state4)).valid).toBe(false);
    });
  });

  describe('entity-level validation & duplicate IDs', () => {
    it('rejects duplicate account IDs', () => {
      const state = createValidAppState();
      state.accounts.push({
        id: 'acc_main', // Duplicate
        name: 'Duplicate Acc',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("duplicate account ID 'acc_main'");
    });

    it('rejects duplicate service IDs', () => {
      const state = createValidAppState();
      state.services.push({
        id: 'srv_antigravity', // Duplicate
        accountId: 'acc_main',
        name: 'Another service',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("duplicate service ID 'srv_antigravity'");
    });

    it('rejects duplicate limitWindow IDs', () => {
      const state = createValidAppState();
      state.limitWindows.push({
        ...state.limitWindows[0],
      });
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("duplicate limitWindow ID 'win_hourly'");
    });

    it('rejects duplicate project IDs', () => {
      const state = createValidAppState();
      state.projects.push({
        ...state.projects[0],
      });
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("duplicate project ID 'prj_dashboard'");
    });

    it('rejects duplicate usageEvent IDs', () => {
      const state = createValidAppState();
      state.usageEvents.push({
        ...state.usageEvents[0],
      });
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("duplicate usageEvent ID 'evt_1'");
    });

    it('rejects invalid limitWindow units and cadences', () => {
      const state = createValidAppState();
      // @ts-expect-error invalid unit
      state.limitWindows[0].unit = 'kilograms';
      expect(validateImportJson(JSON.stringify(state)).valid).toBe(false);

      const state2 = createValidAppState();
      // @ts-expect-error invalid cadence
      state2.limitWindows[0].cadence = 'yearly';
      expect(validateImportJson(JSON.stringify(state2)).valid).toBe(false);
    });

    it('rejects negative or non-finite numbers in limit windows', () => {
      const state = createValidAppState();
      state.limitWindows[0].capacity = -10;
      expect(validateImportJson(JSON.stringify(state)).valid).toBe(false);

      const state2 = createValidAppState();
      state2.limitWindows[0].capacity = NaN;
      expect(validateImportJson(JSON.stringify(state2)).valid).toBe(false);

      const state3 = createValidAppState();
      state3.limitWindows[0].capacity = Infinity;
      expect(validateImportJson(JSON.stringify(state3)).valid).toBe(false);
    });

    it('requires positive customIntervalHours when cadence is custom', () => {
      const state = createValidAppState();
      state.limitWindows[1].cadence = 'custom';
      delete state.limitWindows[1].customIntervalHours;
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("'customIntervalHours' is not a positive number");
    });
  });

  describe('cross-reference integrity validation', () => {
    it('rejects service pointing to non-existent accountId', () => {
      const state = createValidAppState();
      state.services[0].accountId = 'non_existent_acc';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("references non-existent account 'non_existent_acc'");
    });

    it('rejects limitWindow pointing to non-existent serviceId', () => {
      const state = createValidAppState();
      state.limitWindows[0].serviceId = 'non_existent_srv';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("references non-existent service 'non_existent_srv'");
    });

    it('rejects limitWindow pointing to non-existent accountId', () => {
      const state = createValidAppState();
      state.limitWindows[0].accountId = 'non_existent_acc';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("references non-existent account 'non_existent_acc'");
    });

    it("rejects limitWindow whose accountId doesn't match its service's accountId", () => {
      const state = createValidAppState();
      // 'acc_secondary' exists, but service 'srv_antigravity' belongs to 'acc_main'
      state.limitWindows[0].accountId = 'acc_secondary';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("does not match service 'srv_antigravity' accountId 'acc_main'");
    });

    it('rejects usageEvent pointing to non-existent projectId', () => {
      const state = createValidAppState();
      state.usageEvents[0].projectId = 'ghost_project';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("references non-existent project 'ghost_project'");
    });

    it('rejects usageEvent pointing to non-existent accountId', () => {
      const state = createValidAppState();
      state.usageEvents[0].accountId = 'ghost_acc';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("references non-existent account 'ghost_acc'");
    });

    it('rejects usageEvent pointing to non-existent serviceId', () => {
      const state = createValidAppState();
      state.usageEvents[0].serviceId = 'ghost_service';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("references non-existent service 'ghost_service'");
    });

    it("rejects usageEvent whose accountId doesn't match service's accountId", () => {
      const state = createValidAppState();
      state.usageEvents[0].accountId = 'acc_secondary';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("does not match service 'srv_antigravity' accountId 'acc_main'");
    });

    it('rejects usageEvent effect pointing to non-existent windowId', () => {
      const state = createValidAppState();
      state.usageEvents[0].effects[0].windowId = 'ghost_window';
      const res = validateImportJson(JSON.stringify(state));
      expect(res.valid).toBe(false);
      expect(res.error).toContain("references non-existent window 'ghost_window'");
    });
  });

  describe('generateImportDiff', () => {
    it('calculates the exact differences between current state and incoming summary', () => {
      const current = createValidAppState();
      const incomingSummary: ValidationSummary = {
        accountsCount: 5,
        servicesCount: 3,
        windowsCount: 2,
        projectsCount: 0,
        eventsCount: 10,
      };

      const diff = generateImportDiff(current, incomingSummary);

      expect(diff.accounts).toEqual({ current: 2, incoming: 5, delta: 3 });
      expect(diff.services).toEqual({ current: 1, incoming: 3, delta: 2 });
      expect(diff.windows).toEqual({ current: 2, incoming: 2, delta: 0 });
      expect(diff.projects).toEqual({ current: 1, incoming: 0, delta: -1 });
      expect(diff.events).toEqual({ current: 1, incoming: 10, delta: 9 });
    });
  });

  describe('downloadJsonBackup', () => {
    it('handles non-DOM environment without throwing', () => {
      const originalDoc = (globalThis as unknown as { document?: unknown }).document;
      try {
        delete (globalThis as unknown as { document?: unknown }).document;
        expect(() => downloadJsonBackup(createValidAppState())).not.toThrow();
      } finally {
        (globalThis as unknown as { document?: unknown }).document = originalDoc;
      }
    });

    it('triggers link download when DOM environment is present', () => {
      const fakeAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      const appendChildSpy = vi.fn();
      const removeChildSpy = vi.fn();
      const createObjectURLSpy = vi.fn(() => 'blob:mock-url');
      const revokeObjectURLSpy = vi.fn();

      const globalAny = globalThis as unknown as Record<string, unknown>;
      globalAny.document = {
        createElement: vi.fn(() => fakeAnchor),
        body: {
          appendChild: appendChildSpy,
          removeChild: removeChildSpy,
        },
      };

      globalAny.URL = {
        createObjectURL: createObjectURLSpy,
        revokeObjectURL: revokeObjectURLSpy,
      };

      downloadJsonBackup(createValidAppState(), 'test-export');

      expect(fakeAnchor.download).toMatch(/^test-export-.*\.json$/);
      expect(fakeAnchor.click).toHaveBeenCalledTimes(1);
      expect(appendChildSpy).toHaveBeenCalledWith(fakeAnchor);
      expect(removeChildSpy).toHaveBeenCalledWith(fakeAnchor);
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      // Cleanup
      delete globalAny.document;
      delete globalAny.URL;
    });
  });
});
