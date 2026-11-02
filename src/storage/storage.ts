import { AppState, UserSettings, Account, Service, LimitWindow, Project, UsageEvent } from '../domain/types';

export const STORAGE_KEY = 'quota_ember_app_state_v1';
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * In-memory storage fallback for non-browser environments or when localStorage is restricted.
 */
export class MemoryStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

let activeStorage: Storage | null = null;

/**
 * Returns the currently active storage backend (window.localStorage or fallback).
 */
export function getStorage(): Storage {
  if (activeStorage) {
    return activeStorage;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  activeStorage = new MemoryStorage();
  return activeStorage;
}

/**
 * Overrides the storage engine (useful for unit testing or custom environments).
 */
export function setStorage(storage: Storage | null): void {
  activeStorage = storage;
}

/**
 * Detects the user's system IANA time zone, defaulting to 'UTC' if unavailable.
 */
export function getSystemTimeZone(): string {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && typeof tz === 'string' && tz.trim().length > 0) {
        return tz;
      }
    }
  } catch {
    // Fallback to UTC
  }
  return 'UTC';
}

/**
 * Returns a clean, sample-free initial application state.
 * Empty lists for accounts, services, windows, projects, and events.
 * Default settings with the detected system timezone.
 */
export function getInitialState(): AppState {
  return {
    version: CURRENT_SCHEMA_VERSION,
    accounts: [],
    services: [],
    limitWindows: [],
    projects: [],
    usageEvents: [],
    settings: {
      defaultTimeZone: getSystemTimeZone(),
      lowCapacityThresholdPercent: 80,
      staleDataThresholdHours: 24,
    },
  };
}

/**
 * Migrates data from older schema versions to current version.
 */
export function migrateState(data: unknown): AppState {
  if (!data || typeof data !== 'object') {
    return getInitialState();
  }

  const raw = data as Record<string, unknown>;
  const version = typeof raw.version === 'number' ? raw.version : 0;

  const accounts = Array.isArray(raw.accounts) ? (raw.accounts as Account[]) : [];
  const services = Array.isArray(raw.services) ? (raw.services as Service[]) : [];
  const limitWindows = Array.isArray(raw.limitWindows) ? (raw.limitWindows as LimitWindow[]) : [];
  const projects = Array.isArray(raw.projects) ? (raw.projects as Project[]) : [];
  const usageEvents = Array.isArray(raw.usageEvents) ? (raw.usageEvents as UsageEvent[]) : [];

  const rawSettings = typeof raw.settings === 'object' && raw.settings !== null
    ? (raw.settings as Record<string, unknown>)
    : {};

  const settings: UserSettings = {
    defaultTimeZone: typeof rawSettings.defaultTimeZone === 'string' && rawSettings.defaultTimeZone.trim().length > 0
      ? rawSettings.defaultTimeZone
      : getSystemTimeZone(),
    lowCapacityThresholdPercent: typeof rawSettings.lowCapacityThresholdPercent === 'number' && !Number.isNaN(rawSettings.lowCapacityThresholdPercent)
      ? rawSettings.lowCapacityThresholdPercent
      : 80,
    staleDataThresholdHours: typeof rawSettings.staleDataThresholdHours === 'number' && !Number.isNaN(rawSettings.staleDataThresholdHours)
      ? rawSettings.staleDataThresholdHours
      : 24,
  };

  // Upgrades: v0 -> v1
  if (version < 1) {
    // Add default fields or transformations if any existed in future
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    accounts,
    services,
    limitWindows,
    projects,
    usageEvents,
    settings,
  };
}

export type StorageListener = (state: AppState) => void;
const listeners = new Set<StorageListener>();

/**
 * Subscribes a listener callback to storage changes.
 * Returns an unsubscribe function.
 */
export function subscribeToAppState(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let isNotifying = false;

/**
 * Notifies all subscribers and dispatches a window event if running in a browser.
 */
export function notifyListeners(state: AppState): void {
  if (isNotifying) {
    return;
  }
  isNotifying = true;
  try {
    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Storage listener execution error:', err);
      }
    });

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('quota_ember_state_change', { detail: state }));
      } catch {
        // Ignore in non-standard environments
      }
    }
  } finally {
    isNotifying = false;
  }
}

/**
 * Loads the AppState from localStorage.
 * If data does not exist, returns getInitialState().
 * If data exists from an older schema version, migrates and returns it.
 * If data is corrupt, logs a warning and returns getInitialState().
 */
export function loadAppState(): AppState {
  try {
    const storage = getStorage();
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return getInitialState();
    }
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch (error) {
    console.warn('Failed to load AppState from localStorage, falling back to initial state:', error);
    return getInitialState();
  }
}

/**
 * Persists the AppState to localStorage under 'quota_ember_app_state_v1'.
 * Ensures the schema version is up to date and notifies all subscribers.
 */
export function saveAppState(state: AppState): void {
  try {
    const storage = getStorage();
    const stateToSave: AppState = {
      ...state,
      version: CURRENT_SCHEMA_VERSION,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    notifyListeners(stateToSave);
  } catch (error) {
    console.error('Failed to save AppState to localStorage:', error);
    throw error;
  }
}

/**
 * Clears all quota ember data from localStorage and resets state to clean initial state.
 * Notifies all subscribers.
 */
export function clearAllData(): void {
  try {
    const storage = getStorage();
    storage.removeItem(STORAGE_KEY);
    const initial = getInitialState();
    notifyListeners(initial);
  } catch (error) {
    console.error('Failed to clear AppState from storage:', error);
    throw error;
  }
}

// Window multi-tab synchronization listener
let multiTabListenerAttached = false;

export function setupStorageEventListener(): void {
  if (multiTabListenerAttached) return;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const updated = loadAppState();
        notifyListeners(updated);
      }
    });
    multiTabListenerAttached = true;
  }
}

if (typeof window !== 'undefined') {
  setupStorageEventListener();
}
