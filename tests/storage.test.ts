import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  CURRENT_SCHEMA_VERSION,
  getInitialState,
  getSystemTimeZone,
  loadAppState,
  saveAppState,
  clearAllData,
  subscribeToAppState,
  migrateState,
  setStorage,
  MemoryStorage,
} from '../src/storage/storage';
import { AppState } from '../src/domain/types';

describe('storage module', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    setStorage(memoryStorage);
  });

  describe('getSystemTimeZone', () => {
    it('returns a valid non-empty timezone string', () => {
      const tz = getSystemTimeZone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    it('falls back gracefully to UTC when Intl is unavailable or throws', () => {
      const originalIntl = globalThis.Intl;
      try {
        // @ts-expect-error deliberately testing fallback
        globalThis.Intl = undefined;
        expect(getSystemTimeZone()).toBe('UTC');
      } finally {
        globalThis.Intl = originalIntl;
      }
    });
  });

  describe('getInitialState', () => {
    it('generates a clean sample-free onboarding state', () => {
      const state = getInitialState();
      expect(state.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(state.accounts).toEqual([]);
      expect(state.services).toEqual([]);
      expect(state.limitWindows).toEqual([]);
      expect(state.projects).toEqual([]);
      expect(state.usageEvents).toEqual([]);
    });

    it('initializes default settings with system timezone and sane thresholds', () => {
      const state = getInitialState();
      expect(state.settings).toBeDefined();
      expect(state.settings.defaultTimeZone).toBe(getSystemTimeZone());
      expect(state.settings.lowCapacityThresholdPercent).toBe(80);
      expect(state.settings.staleDataThresholdHours).toBe(24);
    });
  });

  describe('saveAppState and loadAppState', () => {
    it('loads initial state when storage is empty', () => {
      const state = loadAppState();
      expect(state).toEqual(getInitialState());
    });

    it('saves and loads AppState roundtrip', () => {
      const testState: AppState = {
        version: CURRENT_SCHEMA_VERSION,
        accounts: [
          {
            id: 'acc_1',
            name: 'Personal Account',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        services: [
          {
            id: 'srv_1',
            accountId: 'acc_1',
            name: 'Antigravity',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        limitWindows: [
          {
            id: 'win_1',
            serviceId: 'srv_1',
            accountId: 'acc_1',
            name: 'Hourly Limit',
            capacity: 100,
            unit: 'credits',
            cadence: 'hourly',
            resetAnchor: '2026-01-01T00:00:00.000Z',
            timeZone: 'UTC',
            currentUsed: 25,
            lastUpdated: '2026-01-01T01:00:00.000Z',
            archived: false,
          },
        ],
        projects: [
          {
            id: 'prj_1',
            name: 'Agent Research',
            archived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        usageEvents: [
          {
            id: 'evt_1',
            timestamp: '2026-01-01T01:00:00.000Z',
            projectId: 'prj_1',
            accountId: 'acc_1',
            serviceId: 'srv_1',
            type: 'usage',
            effects: [
              {
                windowId: 'win_1',
                amount: 25,
                previousUsed: 0,
                newUsed: 25,
              },
            ],
            createdAt: '2026-01-01T01:00:00.000Z',
          },
        ],
        settings: {
          defaultTimeZone: 'America/New_York',
          lowCapacityThresholdPercent: 75,
          staleDataThresholdHours: 12,
        },
      };

      saveAppState(testState);

      const rawInStorage = memoryStorage.getItem(STORAGE_KEY);
      expect(rawInStorage).not.toBeNull();

      const loaded = loadAppState();
      expect(loaded).toEqual(testState);
    });

    it('ensures saved state has CURRENT_SCHEMA_VERSION', () => {
      const stateWithoutVersion = {
        ...getInitialState(),
        version: 0,
      };
      saveAppState(stateWithoutVersion);

      const loaded = loadAppState();
      expect(loaded.version).toBe(CURRENT_SCHEMA_VERSION);
    });
  });

  describe('clearAllData', () => {
    it('removes storage key and resets to initial state', () => {
      const customState = getInitialState();
      customState.accounts.push({
        id: 'acc_1',
        name: 'Test',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      saveAppState(customState);
      expect(memoryStorage.getItem(STORAGE_KEY)).not.toBeNull();

      clearAllData();
      expect(memoryStorage.getItem(STORAGE_KEY)).toBeNull();

      const loaded = loadAppState();
      expect(loaded.accounts).toEqual([]);
    });
  });

  describe('corrupt data and migration handling', () => {
    it('falls back to initial state when storage contains corrupted JSON', () => {
      memoryStorage.setItem(STORAGE_KEY, '{ invalid JSON :;;');
      const loaded = loadAppState();
      expect(loaded).toEqual(getInitialState());
    });

    it('migrates legacy v0 state missing version', () => {
      const legacyRaw = {
        accounts: [
          {
            id: 'legacy_acc',
            name: 'Legacy Account',
            archived: false,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      };
      memoryStorage.setItem(STORAGE_KEY, JSON.stringify(legacyRaw));

      const loaded = loadAppState();
      expect(loaded.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(loaded.accounts.length).toBe(1);
      expect(loaded.accounts[0].id).toBe('legacy_acc');
      expect(loaded.services).toEqual([]);
      expect(loaded.limitWindows).toEqual([]);
      expect(loaded.projects).toEqual([]);
      expect(loaded.usageEvents).toEqual([]);
      expect(loaded.settings.lowCapacityThresholdPercent).toBe(80);
      expect(loaded.settings.staleDataThresholdHours).toBe(24);
    });

    it('migrateState returns initial state when given null or non-object', () => {
      expect(migrateState(null)).toEqual(getInitialState());
      expect(migrateState('string')).toEqual(getInitialState());
      expect(migrateState(123)).toEqual(getInitialState());
    });
  });

  describe('reactive subscriptions', () => {
    it('notifies subscribers on saveAppState', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToAppState(listener);

      const state = getInitialState();
      saveAppState(state);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ version: CURRENT_SCHEMA_VERSION }));

      unsubscribe();
      saveAppState(state);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies subscribers on clearAllData', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToAppState(listener);

      clearAllData();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(getInitialState());

      unsubscribe();
    });

    it('continues notifying other listeners if one throws', () => {
      const faultyListener = vi.fn(() => {
        throw new Error('Explosion');
      });
      const healthyListener = vi.fn();

      const unsub1 = subscribeToAppState(faultyListener);
      const unsub2 = subscribeToAppState(healthyListener);

      expect(() => saveAppState(getInitialState())).not.toThrow();
      expect(faultyListener).toHaveBeenCalled();
      expect(healthyListener).toHaveBeenCalled();

      unsub1();
      unsub2();
    });
  });

  describe('MemoryStorage behavior', () => {
    it('supports basic Storage API operations', () => {
      const store = new MemoryStorage();
      expect(store.length).toBe(0);

      store.setItem('k1', 'v1');
      store.setItem('k2', 'v2');
      expect(store.length).toBe(2);
      expect(store.getItem('k1')).toBe('v1');
      expect(store.getItem('k2')).toBe('v2');
      expect(store.getItem('nonexistent')).toBeNull();

      expect(store.key(0)).toBe('k1');
      expect(store.key(1)).toBe('k2');

      store.removeItem('k1');
      expect(store.getItem('k1')).toBeNull();
      expect(store.length).toBe(1);

      store.clear();
      expect(store.length).toBe(0);
      expect(store.getItem('k2')).toBeNull();
    });
  });
});
