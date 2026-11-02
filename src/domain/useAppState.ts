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

  const isInternalUpdateRef = useRef(false);
  const isInitialMount = useRef(true);

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

  // Periodic reset check every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const currentWindows = stateRef.current.limitWindows;
      const { windows: advancedWindows, advancedCount } = advanceAllStateWindows(currentWindows, new Date());
      if (advancedCount > 0) {
        setState((prev) => ({
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
    }
  }, []);

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
    } finally {
      isInternalUpdateRef.current = false;
    }
  }, []);

  // Reset to initial clean state
  const resetAllData = useCallback(() => {
    const fresh = getInitialState();
    isInternalUpdateRef.current = true;
    try {
      setState(fresh);
      saveAppState(fresh);
    } finally {
      isInternalUpdateRef.current = false;
    }
  }, []);

  return {
    state,
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
