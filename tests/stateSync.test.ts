import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppState } from '../src/domain/useAppState';
import { AppState } from '../src/domain/types';
import {
  setStorage,
  MemoryStorage,
  loadAppState,
  saveAppState,
  getInitialState,
} from '../src/storage/storage';
import * as apiModule from '../src/storage/api';

describe('useAppState State Sync & Backend Integration', () => {
  let memoryStorage: MemoryStorage;
  let capturedEffects: Array<{ fn: () => void | (() => void); deps?: unknown[] }>;
  let cleanupFns: Array<() => void>;

  const flushPromises = async () => {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
  };

  // React hook harness using React 19 client internals
  function setupHookHarness(initialState?: AppState) {
    if (initialState) {
      saveAppState(initialState);
    }

    capturedEffects = [];
    cleanupFns = [];

    const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    let hookState: any = null;

    internals.H = {
      useState: (init: any) => {
        if (hookState === null) {
          hookState = typeof init === 'function' ? init() : init;
        }
        const setHookState = (updater: any) => {
          hookState = typeof updater === 'function' ? updater(hookState) : updater;
        };
        return [hookState, setHookState];
      },
      useRef: (init: any) => {
        const refObj = { current: init };
        return refObj;
      },
      useEffect: (fn: any, deps: any) => {
        capturedEffects.push({ fn, deps });
      },
      useCallback: (fn: any) => fn,
      useMemo: (fn: any) => fn(),
    };

    const hookResult = useAppState();
    return {
      getHook: () => hookResult,
      getEffects: () => capturedEffects,
      runEffect: (index: number) => {
        const entry = capturedEffects[index];
        if (entry && typeof entry.fn === 'function') {
          const cleanup = entry.fn();
          if (typeof cleanup === 'function') {
            cleanupFns.push(cleanup);
          }
        }
      },
      runAllMountEffects: () => {
        capturedEffects.forEach((entry) => {
          if (entry && typeof entry.fn === 'function') {
            const cleanup = entry.fn();
            if (typeof cleanup === 'function') {
              cleanupFns.push(cleanup);
            }
          }
        });
      },
      cleanup: () => {
        cleanupFns.forEach((fn) => {
          try {
            fn();
          } catch {
            // ignore
          }
        });
        internals.H = null;
      },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    memoryStorage = new MemoryStorage();
    setStorage(memoryStorage);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Mount Synchronization & Smart Seeding', () => {
    it('Case A: Loads remote state when remote has existing data and updates localStorage & revision', async () => {
      const remoteState = getInitialState();
      remoteState.accounts.push({
        id: 'acc_remote_1',
        name: 'Shared Team Workspace',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const fetchRemoteSpy = vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue({
        state: remoteState,
        revision: 4,
        updatedAt: new Date().toISOString(),
      });
      const pushRemoteSpy = vi.spyOn(apiModule, 'pushRemoteState').mockResolvedValue({
        ok: true,
        revision: 5,
        updatedAt: new Date().toISOString(),
      });

      const harness = setupHookHarness();
      harness.runAllMountEffects();

      // Allow async initialSync promise to resolve
      await flushPromises();

      expect(fetchRemoteSpy).toHaveBeenCalledTimes(1);
      expect(pushRemoteSpy).not.toHaveBeenCalled();

      // Verify localStorage was updated with the remote state
      const stored = loadAppState();
      expect(stored.accounts).toHaveLength(1);
      expect(stored.accounts[0].name).toBe('Shared Team Workspace');

      harness.cleanup();
    });

    it('Case B: Seeds central server when remote is empty but localStorage has existing accounts', async () => {
      const localState = getInitialState();
      localState.accounts.push({
        id: 'acc_local_1',
        name: 'Local Existing Workspace',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const fetchRemoteSpy = vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue({
        state: getInitialState(), // empty remote state
        revision: 1,
        updatedAt: new Date().toISOString(),
      });
      const pushRemoteSpy = vi.spyOn(apiModule, 'pushRemoteState').mockResolvedValue({
        ok: true,
        revision: 2,
        updatedAt: new Date().toISOString(),
      });

      const harness = setupHookHarness(localState);
      harness.runAllMountEffects();

      await flushPromises();

      expect(fetchRemoteSpy).toHaveBeenCalledTimes(1);
      expect(pushRemoteSpy).toHaveBeenCalledTimes(1);
      expect(pushRemoteSpy).toHaveBeenCalledWith(expect.objectContaining({
        accounts: expect.arrayContaining([
          expect.objectContaining({ name: 'Local Existing Workspace' }),
        ]),
      }));

      harness.cleanup();
    });

    it('Case C: Keeps initial clean state when both local and remote are empty', async () => {
      const fetchRemoteSpy = vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue({
        state: getInitialState(),
        revision: 1,
        updatedAt: new Date().toISOString(),
      });
      const pushRemoteSpy = vi.spyOn(apiModule, 'pushRemoteState');

      const harness = setupHookHarness(getInitialState());
      harness.runAllMountEffects();

      await flushPromises();

      expect(fetchRemoteSpy).toHaveBeenCalledTimes(1);
      expect(pushRemoteSpy).not.toHaveBeenCalled();
      expect(loadAppState().accounts).toHaveLength(0);

      harness.cleanup();
    });
  });

  describe('State Mutations & Debounced Remote Push', () => {
    it('saves to localStorage immediately and debounces pushRemoteState by 300ms', async () => {
      vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue(null);
      const pushRemoteSpy = vi.spyOn(apiModule, 'pushRemoteState').mockResolvedValue({
        ok: true,
        revision: 10,
        updatedAt: new Date().toISOString(),
      });

      const harness = setupHookHarness();
      const hook = harness.getHook();

      // Add account
      hook.addAccount({
        name: 'Debounced Test Account',
        archived: false,
      });

      // Local storage is updated synchronously
      expect(loadAppState().accounts).toHaveLength(1);
      expect(loadAppState().accounts[0].name).toBe('Debounced Test Account');

      // Network push has NOT been called before debounce timeout
      expect(pushRemoteSpy).not.toHaveBeenCalled();

      // Advance timers by 350ms
      vi.advanceTimersByTime(350);
      await flushPromises();

      // Network push was triggered with the latest state
      expect(pushRemoteSpy).toHaveBeenCalledTimes(1);
      expect(pushRemoteSpy).toHaveBeenCalledWith(expect.objectContaining({
        accounts: expect.arrayContaining([
          expect.objectContaining({ name: 'Debounced Test Account' }),
        ]),
      }));

      harness.cleanup();
    });

    it('multiple rapid mutations collapse into debounced sync', async () => {
      vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue(null);
      const pushRemoteSpy = vi.spyOn(apiModule, 'pushRemoteState').mockResolvedValue({
        ok: true,
        revision: 11,
        updatedAt: new Date().toISOString(),
      });

      const harness = setupHookHarness();
      const hook = harness.getHook();

      hook.addAccount({ name: 'Rapid Acc 1', archived: false });
      hook.addAccount({ name: 'Rapid Acc 2', archived: false });
      hook.addAccount({ name: 'Rapid Acc 3', archived: false });

      expect(loadAppState().accounts).toHaveLength(3);
      expect(pushRemoteSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(350);
      await flushPromises();

      expect(pushRemoteSpy).toHaveBeenCalledTimes(1);
      expect(pushRemoteSpy).toHaveBeenCalledWith(expect.objectContaining({
        accounts: expect.arrayContaining([
          expect.objectContaining({ name: 'Rapid Acc 1' }),
          expect.objectContaining({ name: 'Rapid Acc 2' }),
          expect.objectContaining({ name: 'Rapid Acc 3' }),
        ]),
      }));

      harness.cleanup();
    });
  });

  describe('replaceAllState & resetAllData Immediate Push', () => {
    it('replaceAllState saves locally and immediately initiates push to /api/state', async () => {
      vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue(null);
      const pushRemoteSpy = vi.spyOn(apiModule, 'pushRemoteState').mockResolvedValue({
        ok: true,
        revision: 20,
        updatedAt: new Date().toISOString(),
      });

      const harness = setupHookHarness();
      const hook = harness.getHook();

      const importedState = getInitialState();
      importedState.accounts.push({
        id: 'acc_imported',
        name: 'Imported Production Tier',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      hook.replaceAllState(importedState);

      expect(loadAppState().accounts[0].name).toBe('Imported Production Tier');
      // Immediate push without waiting for 300ms debounce
      expect(pushRemoteSpy).toHaveBeenCalledTimes(1);

      harness.cleanup();
    });

    it('resetAllData clears state locally and immediately pushes clean state to /api/state', async () => {
      const pushRemoteSpy = vi.spyOn(apiModule, 'pushRemoteState').mockResolvedValue({
        ok: true,
        revision: 21,
        updatedAt: new Date().toISOString(),
      });

      const existingState = getInitialState();
      existingState.accounts.push({
        id: 'acc_old',
        name: 'To Be Cleared',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const harness = setupHookHarness(existingState);
      const hook = harness.getHook();

      hook.resetAllData();

      expect(loadAppState().accounts).toHaveLength(0);
      expect(pushRemoteSpy).toHaveBeenCalledTimes(1);
      expect(pushRemoteSpy).toHaveBeenCalledWith(expect.objectContaining({
        accounts: [],
      }));

      harness.cleanup();
    });
  });

  describe('Live Polling & Visibility Sync', () => {
    it('polls fetchRemoteMeta and pulls full state when remote revision is higher', async () => {
      // Mount with revision 2
      vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValueOnce({
        state: getInitialState(),
        revision: 2,
        updatedAt: new Date().toISOString(),
      });

      const harness = setupHookHarness();
      harness.runAllMountEffects();
      await flushPromises();

      // Setup meta poll returning revision 5 (device B made changes!)
      const remoteUpdatedState = getInitialState();
      remoteUpdatedState.accounts.push({
        id: 'acc_dev_b',
        name: 'Device B Account',
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const fetchMetaSpy = vi.spyOn(apiModule, 'fetchRemoteMeta').mockResolvedValue({
        revision: 5,
        updatedAt: new Date().toISOString(),
        hasData: true,
      });

      const fetchStateSpy = vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValueOnce({
        state: remoteUpdatedState,
        revision: 5,
        updatedAt: new Date().toISOString(),
      });

      // Advance 5 seconds to trigger polling interval
      vi.advanceTimersByTime(5000);
      await flushPromises();

      expect(fetchMetaSpy).toHaveBeenCalled();
      expect(fetchStateSpy).toHaveBeenCalled();

      // State and localStorage should reflect Device B's changes
      expect(loadAppState().accounts).toHaveLength(1);
      expect(loadAppState().accounts[0].name).toBe('Device B Account');

      harness.cleanup();
    });

    it('concurrency guard: does not overwrite state during active local edit/push', async () => {
      vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue(null);
      vi.spyOn(apiModule, 'pushRemoteState');

      const harness = setupHookHarness();
      harness.runAllMountEffects();
      await flushPromises();

      const hook = harness.getHook();

      // User makes an edit locally (pending in debounce queue)
      hook.addAccount({ name: 'Unpushed Local Edit', archived: false });

      // In the middle of debounce, a poll arrives with higher revision
      vi.spyOn(apiModule, 'fetchRemoteMeta').mockResolvedValue({
        revision: 99,
        updatedAt: new Date().toISOString(),
        hasData: true,
      });
      const fetchStateSpy = vi.spyOn(apiModule, 'fetchRemoteState').mockResolvedValue({
        state: getInitialState(), // empty stale state
        revision: 99,
        updatedAt: new Date().toISOString(),
      });

      // Poll interval triggers
      vi.advanceTimersByTime(100);
      await flushPromises();

      // fetchRemoteState must NOT have been called because a local push is pending
      expect(fetchStateSpy).not.toHaveBeenCalled();

      // Verify local edit was not overwritten
      expect(loadAppState().accounts).toHaveLength(1);
      expect(loadAppState().accounts[0].name).toBe('Unpushed Local Edit');

      harness.cleanup();
    });
  });

  describe('Offline Resilience', () => {
    it('gracefully handles network errors without breaking application functionality', async () => {
      // Simulate complete network failure
      vi.spyOn(apiModule, 'fetchRemoteState').mockRejectedValue(new Error('Network offline'));
      vi.spyOn(apiModule, 'pushRemoteState').mockRejectedValue(new Error('Network offline'));
      vi.spyOn(apiModule, 'fetchRemoteMeta').mockRejectedValue(new Error('Network offline'));

      const harness = setupHookHarness();
      harness.runAllMountEffects();
      await flushPromises();

      const hook = harness.getHook();

      // Actions should not throw and continue persisting locally
      expect(() => {
        hook.addAccount({ name: 'Offline Account', archived: false });
      }).not.toThrow();

      expect(loadAppState().accounts).toHaveLength(1);
      expect(loadAppState().accounts[0].name).toBe('Offline Account');

      // Debounce timer advances and attempts network sync, which fails silently
      vi.advanceTimersByTime(350);
      await flushPromises();

      // Still intact
      expect(loadAppState().accounts).toHaveLength(1);

      harness.cleanup();
    });
  });
});
