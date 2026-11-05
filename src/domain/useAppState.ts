import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  Account,
  Service,
  LimitWindow,
  Project,
  ApplyUsageEventInput,
  RecordCorrectionInput,
  UserSettings,
} from './types';
import {
  loadAppState,
  saveAppState,
  subscribeToAppState,
  getInitialState,
  fetchRemoteState,
  fetchRemoteMeta,
  pushRemoteState,
} from '../storage';
import { advanceAllStateWindows } from './resetEngine';
import { applyUsageEvent, recordCorrection } from './calculations';

export function useAppState() {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadAppState();
    // Advance any windows that are due for a reset right at startup
    const { windows: advancedWindows, advancedCount } = advanceAllStateWindows(loaded.limitWindows, new Date());
    if (advancedCount > 0) {
      const updated = { ...loaded, limitWindows: advancedWindows };
      saveAppState(updated);
      return updated;
    }
    return loaded;
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Track the current synchronized revision from the backend database
  const revisionRef = useRef<number>(0);

  // Sync and concurrency guards
  const isInternalUpdateRef = useRef(false);
  const isInitialMount = useRef(true);
  const isPushingRef = useRef(false);
  const isFetchingRemoteRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPushStateRef = useRef<AppState | null>(null);

  const isPushInProgressOrPending = useCallback(() => {
    return (
      isPushingRef.current ||
      debounceTimerRef.current !== null ||
      pendingPushStateRef.current !== null
    );
  }, []);

  // Debounced/queued push to remote database
  const queuePush = useCallback((stateToPush: AppState, immediate: boolean = false) => {
    pendingPushStateRef.current = stateToPush;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const executePush = async () => {
      if (isPushingRef.current) {
        // A push is already in flight; when it finishes, it will pick up pendingPushStateRef
        return;
      }
      const stateToSend = pendingPushStateRef.current;
      if (!stateToSend) return;

      pendingPushStateRef.current = null;
      isPushingRef.current = true;
      try {
        const result = await pushRemoteState(stateToSend);
        if (result && result.ok) {
          revisionRef.current = result.revision;
        }
      } catch (err) {
        console.warn('[useAppState] Failed to push state to remote server:', err);
      } finally {
        isPushingRef.current = false;
        // If state changed while we were pushing, push the latest state immediately
        if (pendingPushStateRef.current !== null) {
          executePush();
        }
      }
    };

    if (immediate) {
      executePush();
    } else {
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        executePush();
      }, 300);
    }
  }, []);

  // Subscribe to external storage changes (e.g. multi-tab sync)
  useEffect(() => {
    const unsubscribe = subscribeToAppState((newState) => {
      if (isInternalUpdateRef.current) return;
      setState((prev) => {
        if (prev === newState || JSON.stringify(prev) === JSON.stringify(newState)) {
          return prev;
        }
        return newState;
      });
    });
    return unsubscribe;
  }, []);

  // Persist state updates outside of setState updater to avoid cyclic listener calls and double execution
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    isInternalUpdateRef.current = true;
    try {
      saveAppState(state);
    } finally {
      isInternalUpdateRef.current = false;
    }
  }, [state]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  // Initial mount remote state synchronization and seeding
  useEffect(() => {
    let isCancelled = false;

    async function initialSync() {
      try {
        const remote = await fetchRemoteState();
        if (isCancelled || !remote) return;

        // If local push is already queued or running, do not overwrite
        if (isPushInProgressOrPending()) {
          return;
        }

        const remoteAccounts = remote.state?.accounts || [];
        const remoteEvents = remote.state?.usageEvents || [];
        const remoteHasData = remoteAccounts.length > 0 || remoteEvents.length > 0;

        const currentLocal = stateRef.current;
        const localAccounts = currentLocal?.accounts || [];
        const localHasAccounts = localAccounts.length > 0;

        if (remoteHasData) {
          // Case A: Remote has data
          // Update local state with remote.state, save to localStorage, set revisionRef.current = remote.revision
          revisionRef.current = remote.revision;
          const { windows: advancedWindows } = advanceAllStateWindows(
            remote.state.limitWindows || [],
            new Date()
          );
          const finalRemoteState: AppState = {
            ...remote.state,
            limitWindows: advancedWindows,
          };

          isInternalUpdateRef.current = true;
          try {
            setState(finalRemoteState);
            saveAppState(finalRemoteState);
            stateRef.current = finalRemoteState;
          } finally {
            isInternalUpdateRef.current = false;
          }
        } else if (localHasAccounts) {
          // Case B: Remote state is empty (0 accounts, 0 events) BUT local localStorage has existing accounts
          // Automatically call pushRemoteState(localState) to seed the central server with this device's existing data
          const pushRes = await pushRemoteState(currentLocal);
          if (pushRes && pushRes.ok) {
            revisionRef.current = pushRes.revision;
          }
        } else {
          // Case C: Both are empty: keep initial state
          if (typeof remote.revision === 'number') {
            revisionRef.current = remote.revision;
          }
        }
      } catch (err) {
        console.warn('[useAppState] Initial remote sync error:', err);
      }
    }

    initialSync();

    return () => {
      isCancelled = true;
    };
  }, [isPushInProgressOrPending]);

  // Live Polling & Visibility Sync
  useEffect(() => {
    let isMounted = true;

    const checkRemoteMetaAndSync = async () => {
      if (!isMounted) return;
      if (isPushInProgressOrPending() || isFetchingRemoteRef.current) {
        return;
      }
      try {
        const meta = await fetchRemoteMeta();
        if (!isMounted || !meta) return;

        if (meta.revision > revisionRef.current) {
          if (isPushInProgressOrPending()) {
            return;
          }
          isFetchingRemoteRef.current = true;
          try {
            const remote = await fetchRemoteState();
            if (!isMounted || !remote) return;

            // Check again if local edits arrived while fetching full state
            if (isPushInProgressOrPending()) {
              return;
            }

            if (remote.revision > revisionRef.current) {
              revisionRef.current = remote.revision;
              const { windows: advancedWindows } = advanceAllStateWindows(
                remote.state.limitWindows || [],
                new Date()
              );
              const finalRemoteState: AppState = {
                ...remote.state,
                limitWindows: advancedWindows,
              };

              isInternalUpdateRef.current = true;
              try {
                setState(finalRemoteState);
                saveAppState(finalRemoteState);
                stateRef.current = finalRemoteState;
              } finally {
                isInternalUpdateRef.current = false;
              }
            }
          } finally {
            isFetchingRemoteRef.current = false;
          }
        }
      } catch (err) {
        console.warn('[useAppState] Polling sync error:', err);
      }
    };

    // Periodically (every 5 seconds) poll fetchRemoteMeta()
    const pollInterval = setInterval(() => {
      checkRemoteMetaAndSync();
    }, 5000);

    // Also check when user switches back to the tab or focuses the window
    const handleFocusOrVisibility = () => {
      if (typeof document !== 'undefined') {
        if (document.visibilityState === 'visible') {
          checkRemoteMetaAndSync();
        }
      } else {
        checkRemoteMetaAndSync();
      }
    };

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleFocusOrVisibility);
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', handleFocusOrVisibility);
    }

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('focus', handleFocusOrVisibility);
      }
    };
  }, [isPushInProgressOrPending]);

  // Periodic reset check every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const currentWindows = stateRef.current.limitWindows;
      const { windows: advancedWindows, advancedCount } = advanceAllStateWindows(currentWindows, new Date());
      if (advancedCount > 0) {
        updateState((prev) => ({
          ...prev,
          limitWindows: advancedWindows,
        }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Pure state updater helper without side-effects inside setState
  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    let nextState: AppState | null = null;
    setState((prev) => {
      const next = updater(prev);
      if (next === prev) return prev;
      nextState = next;
      return next;
    });
    // In environments where setState updater is deferred or no-op (such as SSR / test runners),
    // compute nextState from stateRef if setState did not execute synchronously
    if (!nextState) {
      const next = updater(stateRef.current);
      if (next !== stateRef.current) {
        nextState = next;
      }
    }
    if (nextState) {
      stateRef.current = nextState;
      isInternalUpdateRef.current = true;
      try {
        saveAppState(nextState);
      } finally {
        isInternalUpdateRef.current = false;
      }
      queuePush(nextState, false);
    }
  }, [queuePush]);

  // Account actions
  const addAccount = useCallback((account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const newAccount: Account = {
      ...account,
      id: account.id || `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateState((prev) => {
      if (prev.accounts.some((a) => a.id === newAccount.id)) {
        return prev;
      }
      return {
        ...prev,
        accounts: [...prev.accounts, newAccount],
      };
    });
    return newAccount;
  }, [updateState]);

  const updateAccount = useCallback((id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => {
    updateState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
      ),
    }));
  }, [updateState]);

  const archiveAccount = useCallback((id: string, archived: boolean = true) => {
    updateAccount(id, { archived });
  }, [updateAccount]);

  const deleteAccount = useCallback((id: string) => {
    updateState((prev) => {
      const targetAccount = prev.accounts.find((a) => a.id === id);
      if (!targetAccount) {
        return prev;
      }
      const accountName = targetAccount.name;

      const serviceNameMap = new Map<string, string>();
      prev.services.forEach((s) => {
        if (s.accountId === id) {
          serviceNameMap.set(s.id, s.name);
        }
      });

      return {
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== id),
        services: prev.services.filter((s) => s.accountId !== id),
        limitWindows: prev.limitWindows.filter((w) => w.accountId !== id),
        usageEvents: prev.usageEvents.map((evt) => {
          if (evt.accountId === id) {
            return {
              ...evt,
              accountName: evt.accountName || accountName,
              serviceName: evt.serviceName || serviceNameMap.get(evt.serviceId) || (prev.services.find((s) => s.id === evt.serviceId)?.name),
            };
          }
          return evt;
        }),
      };
    });
  }, [updateState]);

  // Service actions
  const addService = useCallback((
    service: Omit<Service, 'id' | 'createdAt'> & { id?: string },
    initialWindows?: (Omit<LimitWindow, 'id' | 'serviceId' | 'accountId' | 'currentUsed' | 'lastUpdated' | 'archived'> & { id?: string })[]
  ) => {
    const serviceId = service.id || `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newService: Service = {
      ...service,
      id: serviceId,
      createdAt: new Date().toISOString(),
    };

    const newWindows: LimitWindow[] = (initialWindows || []).map((w, idx) => ({
      ...w,
      id: w.id || `win_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      serviceId,
      accountId: service.accountId,
      currentUsed: 0,
      lastUpdated: new Date().toISOString(),
      archived: false,
    }));

    updateState((prev) => {
      if (prev.services.some((s) => s.id === newService.id)) {
        return prev;
      }
      const existingWinIds = new Set(prev.limitWindows.map((w) => w.id));
      const windowsToAdd = newWindows.filter((w) => !existingWinIds.has(w.id));
      return {
        ...prev,
        services: [...prev.services, newService],
        limitWindows: [...prev.limitWindows, ...windowsToAdd],
      };
    });

    return { service: newService, windows: newWindows };
  }, [updateState]);

  const updateService = useCallback((id: string, updates: Partial<Omit<Service, 'id' | 'createdAt'>>) => {
    updateState((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  }, [updateState]);

  const archiveService = useCallback((id: string, archived: boolean = true) => {
    updateService(id, { archived });
  }, [updateService]);

  // Window actions
  const addLimitWindow = useCallback((
    windowData: Omit<LimitWindow, 'id' | 'currentUsed' | 'lastUpdated' | 'archived'> & { id?: string }
  ) => {
    const newWindow: LimitWindow = {
      ...windowData,
      id: windowData.id || `win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      currentUsed: 0,
      lastUpdated: new Date().toISOString(),
      archived: false,
    };
    updateState((prev) => {
      if (prev.limitWindows.some((w) => w.id === newWindow.id)) {
        return prev;
      }
      return {
        ...prev,
        limitWindows: [...prev.limitWindows, newWindow],
      };
    });
    return newWindow;
  }, [updateState]);

  const updateLimitWindow = useCallback((id: string, updates: Partial<Omit<LimitWindow, 'id'>>) => {
    updateState((prev) => ({
      ...prev,
      limitWindows: prev.limitWindows.map((w) =>
        w.id === id ? { ...w, ...updates, lastUpdated: new Date().toISOString() } : w
      ),
    }));
  }, [updateState]);

  const archiveLimitWindow = useCallback((id: string, archived: boolean = true) => {
    updateLimitWindow(id, { archived });
  }, [updateLimitWindow]);

  // Project actions
  const addProject = useCallback((project: Omit<Project, 'id' | 'createdAt'> & { id?: string }) => {
    const newProject: Project = {
      ...project,
      id: project.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    updateState((prev) => {
      if (prev.projects.some((p) => p.id === newProject.id)) {
        return prev;
      }
      return {
        ...prev,
        projects: [...prev.projects, newProject],
      };
    });
    return newProject;
  }, [updateState]);

  const updateProject = useCallback((id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
    updateState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, [updateState]);

  const archiveProject = useCallback((id: string, archived: boolean = true) => {
    updateProject(id, { archived });
  }, [updateProject]);

  // Usage and Correction actions
  const recordUsage = useCallback((input: ApplyUsageEventInput) => {
    updateState((prev) => {
      const res = applyUsageEvent(prev, input);
      return res.state;
    });
  }, [updateState]);

  const recordBalanceCorrection = useCallback((input: RecordCorrectionInput) => {
    updateState((prev) => {
      const res = recordCorrection(prev, input);
      return res.state;
    });
  }, [updateState]);

  const updateUsageEvent = useCallback((eventId: string, updates: { note?: string; timestamp?: string }) => {
    updateState((prev) => ({
      ...prev,
      usageEvents: prev.usageEvents.map((e) =>
        e.id === eventId ? { ...e, ...updates } : e
      ),
    }));
  }, [updateState]);

  const deleteUsageEvent = useCallback((eventId: string) => {
    updateState((prev) => ({
      ...prev,
      usageEvents: prev.usageEvents.filter((e) => e.id !== eventId),
    }));
  }, [updateState]);

  // Settings
  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    updateState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings },
    }));
  }, [updateState]);

  // Restore/Replace entire state (e.g. from JSON import)
  const replaceAllState = useCallback((newState: AppState) => {
    isInternalUpdateRef.current = true;
    try {
      setState(newState);
      saveAppState(newState);
      stateRef.current = newState;
    } finally {
      isInternalUpdateRef.current = false;
    }
    queuePush(newState, true);
  }, [queuePush]);

  // Reset to initial clean state
  const resetAllData = useCallback(() => {
    const fresh = getInitialState();
    isInternalUpdateRef.current = true;
    try {
      setState(fresh);
      saveAppState(fresh);
      stateRef.current = fresh;
    } finally {
      isInternalUpdateRef.current = false;
    }
    queuePush(fresh, true);
  }, [queuePush]);

  return {
    state,
    revision: revisionRef.current,
    addAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
    addService,
    updateService,
    archiveService,
    addLimitWindow,
    updateLimitWindow,
    archiveLimitWindow,
    addProject,
    updateProject,
    archiveProject,
    recordUsage,
    recordBalanceCorrection,
    updateUsageEvent,
    deleteUsageEvent,
    updateSettings,
    replaceAllState,
    resetAllData,
  };
}
