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

  // Subscribe to external storage changes (e.g. multi-tab sync)
  useEffect(() => {
    const unsubscribe = subscribeToAppState((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Periodic reset check every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const currentWindows = stateRef.current.limitWindows;
      const { windows: advancedWindows, advancedCount } = advanceAllStateWindows(currentWindows, new Date());
      if (advancedCount > 0) {
        setState((prev) => {
          const updated = { ...prev, limitWindows: advancedWindows };
          saveAppState(updated);
          return updated;
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Save helper
  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveAppState(next);
      return next;
    });
  }, []);

  // Account actions
  const addAccount = useCallback((account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAccount: Account = {
      ...account,
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
    }));
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

  // Service actions
  const addService = useCallback((
    service: Omit<Service, 'id' | 'createdAt'>,
    initialWindows?: Omit<LimitWindow, 'id' | 'serviceId' | 'accountId' | 'currentUsed' | 'lastUpdated' | 'archived'>[]
  ) => {
    const serviceId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newService: Service = {
      ...service,
      id: serviceId,
      createdAt: new Date().toISOString(),
    };

    const newWindows: LimitWindow[] = (initialWindows || []).map((w, idx) => ({
      ...w,
      id: `win_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      serviceId,
      accountId: service.accountId,
      currentUsed: 0,
      lastUpdated: new Date().toISOString(),
      archived: false,
    }));

    updateState((prev) => ({
      ...prev,
      services: [...prev.services, newService],
      limitWindows: [...prev.limitWindows, ...newWindows],
    }));

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
    windowData: Omit<LimitWindow, 'id' | 'currentUsed' | 'lastUpdated' | 'archived'>
  ) => {
    const newWindow: LimitWindow = {
      ...windowData,
      id: `win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      currentUsed: 0,
      lastUpdated: new Date().toISOString(),
      archived: false,
    };
    updateState((prev) => ({
      ...prev,
      limitWindows: [...prev.limitWindows, newWindow],
    }));
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
  const addProject = useCallback((project: Omit<Project, 'id' | 'createdAt'>) => {
    const newProject: Project = {
      ...project,
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    updateState((prev) => ({
      ...prev,
      projects: [...prev.projects, newProject],
    }));
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
    setState(newState);
    saveAppState(newState);
  }, []);

  // Reset to initial clean state
  const resetAllData = useCallback(() => {
    const fresh = getInitialState();
    setState(fresh);
    saveAppState(fresh);
  }, []);

  return {
    state,
    addAccount,
    updateAccount,
    archiveAccount,
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
