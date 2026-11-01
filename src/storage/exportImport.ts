import { AppState, UserSettings, Account, Service, LimitWindow, Project, UsageEvent, WindowEffect, UnitType, CadenceType } from '../domain/types';
import { CURRENT_SCHEMA_VERSION } from './storage';

export interface ExportBackupPayload {
  format: 'quota-ember-backup';
  version: number;
  exportedAt: string;
  data: AppState;
}

export interface ValidationSummary {
  accountsCount: number;
  servicesCount: number;
  windowsCount: number;
  projectsCount: number;
  eventsCount: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  state?: AppState;
  summary?: ValidationSummary;
}

export interface ImportDiffMetric {
  current: number;
  incoming: number;
  delta: number;
}

export interface ImportDiff {
  accounts: ImportDiffMetric;
  services: ImportDiffMetric;
  windows: ImportDiffMetric;
  projects: ImportDiffMetric;
  events: ImportDiffMetric;
}

const VALID_UNITS = new Set<UnitType>(['percent', 'credits', 'requests', 'custom']);
const VALID_CADENCES = new Set<CadenceType>(['hourly', 'daily', 'weekly', 'monthly', 'custom']);

/**
 * Serializes the full AppState into formatted JSON with metadata (format, version, exportedAt).
 */
export function exportAppStateToJson(state: AppState): string {
  const version = typeof state.version === 'number' && state.version > 0 ? state.version : CURRENT_SCHEMA_VERSION;
  const payload: ExportBackupPayload = {
    format: 'quota-ember-backup',
    version,
    exportedAt: new Date().toISOString(),
    data: {
      ...state,
      version,
    },
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Triggers a client-side file download of the JSON backup.
 */
export function downloadJsonBackup(state: AppState, filenamePrefix = 'quota-ember-backup'): void {
  const json = exportAppStateToJson(state);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${filenamePrefix}-${timestamp}.json`;

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    console.warn('downloadJsonBackup: DOM environment not available.');
    return;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Validates an imported JSON string.
 * Performs strict checks: JSON structure, schema version, required collections,
 * type validity, unique IDs, and cross-reference referential integrity.
 */
export function validateImportJson(jsonString: string): ValidationResult {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return { valid: false, error: 'Import failed: input is empty or not a string' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Syntax error';
    return { valid: false, error: `Import failed: invalid JSON syntax (${message})` };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Import failed: root must be a JSON object' };
  }

  const rawObj = raw as Record<string, unknown>;
  let candidate: Record<string, unknown>;

  // Check if wrapped in standard backup format
  if (rawObj.data && typeof rawObj.data === 'object' && !Array.isArray(rawObj.data)) {
    if ('format' in rawObj && rawObj.format !== 'quota-ember-backup') {
      return { valid: false, error: `Import failed: unrecognized backup format '${String(rawObj.format)}'` };
    }
    candidate = rawObj.data as Record<string, unknown>;
  } else {
    candidate = rawObj;
  }

  // Version check
  const version = typeof candidate.version === 'number'
    ? candidate.version
    : (typeof rawObj.version === 'number' ? rawObj.version : undefined);

  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { valid: false, error: "Import failed: missing or invalid schema 'version', must be an integer" };
  }
  if (version < 1) {
    return { valid: false, error: `Import failed: unsupported schema version (${version}), must be >= 1` };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Import failed: schema version ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    };
  }

  // Required arrays check
  const requiredArrays = ['accounts', 'services', 'limitWindows', 'projects', 'usageEvents'] as const;
  for (const arrayName of requiredArrays) {
    if (!Array.isArray(candidate[arrayName])) {
      return { valid: false, error: `Import failed: '${arrayName}' must be an array` };
    }
  }

  // Settings check
  if (!candidate.settings || typeof candidate.settings !== 'object' || Array.isArray(candidate.settings)) {
    return { valid: false, error: "Import failed: 'settings' must be an object" };
  }
  const s = candidate.settings as Record<string, unknown>;
  if (typeof s.defaultTimeZone !== 'string' || !s.defaultTimeZone.trim()) {
    return { valid: false, error: "Import failed: 'settings.defaultTimeZone' must be a non-empty string" };
  }
  if (
    typeof s.lowCapacityThresholdPercent !== 'number' ||
    !Number.isFinite(s.lowCapacityThresholdPercent) ||
    s.lowCapacityThresholdPercent < 0 ||
    s.lowCapacityThresholdPercent > 100
  ) {
    return {
      valid: false,
      error: "Import failed: 'settings.lowCapacityThresholdPercent' must be a number between 0 and 100",
    };
  }
  if (
    typeof s.staleDataThresholdHours !== 'number' ||
    !Number.isFinite(s.staleDataThresholdHours) ||
    s.staleDataThresholdHours <= 0
  ) {
    return { valid: false, error: "Import failed: 'settings.staleDataThresholdHours' must be a positive number" };
  }

  // Validate Accounts & collect IDs
  const rawAccounts = candidate.accounts as unknown[];
  const accountIds = new Set<string>();
  const validatedAccounts: Account[] = [];

  for (let i = 0; i < rawAccounts.length; i++) {
    const item = rawAccounts[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: `Import failed: account at index ${i} is not a valid object` };
    }
    const acc = item as Record<string, unknown>;

    if (typeof acc.id !== 'string' || !acc.id.trim()) {
      return { valid: false, error: `Import failed: account at index ${i} has missing or empty 'id'` };
    }
    if (accountIds.has(acc.id)) {
      return { valid: false, error: `Import failed: duplicate account ID '${acc.id}' found` };
    }
    accountIds.add(acc.id);

    if (typeof acc.name !== 'string' || !acc.name.trim()) {
      return { valid: false, error: `Import failed: account '${acc.id}' has missing or empty 'name'` };
    }
    if (typeof acc.archived !== 'boolean') {
      return { valid: false, error: `Import failed: account '${acc.id}' property 'archived' must be a boolean` };
    }
    if (typeof acc.createdAt !== 'string' || !acc.createdAt.trim()) {
      return { valid: false, error: `Import failed: account '${acc.id}' property 'createdAt' must be a non-empty string` };
    }
    if (typeof acc.updatedAt !== 'string' || !acc.updatedAt.trim()) {
      return { valid: false, error: `Import failed: account '${acc.id}' property 'updatedAt' must be a non-empty string` };
    }
    if (acc.email !== undefined && typeof acc.email !== 'string') {
      return { valid: false, error: `Import failed: account '${acc.id}' property 'email' must be a string` };
    }
    if (acc.notes !== undefined && typeof acc.notes !== 'string') {
      return { valid: false, error: `Import failed: account '${acc.id}' property 'notes' must be a string` };
    }

    validatedAccounts.push({
      id: acc.id,
      name: acc.name,
      email: acc.email as string | undefined,
      notes: acc.notes as string | undefined,
      archived: acc.archived,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    });
  }

  // Validate Services & collect IDs + account associations
  const rawServices = candidate.services as unknown[];
  const serviceMap = new Map<string, { id: string; accountId: string }>();
  const validatedServices: Service[] = [];

  for (let i = 0; i < rawServices.length; i++) {
    const item = rawServices[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: `Import failed: service at index ${i} is not a valid object` };
    }
    const srv = item as Record<string, unknown>;

    if (typeof srv.id !== 'string' || !srv.id.trim()) {
      return { valid: false, error: `Import failed: service at index ${i} has missing or empty 'id'` };
    }
    if (serviceMap.has(srv.id)) {
      return { valid: false, error: `Import failed: duplicate service ID '${srv.id}' found` };
    }

    if (typeof srv.accountId !== 'string' || !srv.accountId.trim()) {
      return { valid: false, error: `Import failed: service '${srv.id}' has missing or empty 'accountId'` };
    }
    if (!accountIds.has(srv.accountId)) {
      return {
        valid: false,
        error: `Import failed: service '${srv.id}' references non-existent account '${srv.accountId}'`,
      };
    }

    if (typeof srv.name !== 'string' || !srv.name.trim()) {
      return { valid: false, error: `Import failed: service '${srv.id}' has missing or empty 'name'` };
    }
    if (typeof srv.archived !== 'boolean') {
      return { valid: false, error: `Import failed: service '${srv.id}' property 'archived' must be a boolean` };
    }
    if (typeof srv.createdAt !== 'string' || !srv.createdAt.trim()) {
      return { valid: false, error: `Import failed: service '${srv.id}' property 'createdAt' must be a non-empty string` };
    }
    if (srv.notes !== undefined && typeof srv.notes !== 'string') {
      return { valid: false, error: `Import failed: service '${srv.id}' property 'notes' must be a string` };
    }

    serviceMap.set(srv.id, { id: srv.id, accountId: srv.accountId });
    validatedServices.push({
      id: srv.id,
      accountId: srv.accountId,
      name: srv.name,
      notes: srv.notes as string | undefined,
      archived: srv.archived,
      createdAt: srv.createdAt,
    });
  }

  // Validate LimitWindows & check references to services and accounts
  const rawWindows = candidate.limitWindows as unknown[];
  const windowMap = new Map<string, { id: string; serviceId: string; accountId: string }>();
  const validatedWindows: LimitWindow[] = [];

  for (let i = 0; i < rawWindows.length; i++) {
    const item = rawWindows[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: `Import failed: limitWindow at index ${i} is not a valid object` };
    }
    const win = item as Record<string, unknown>;

    if (typeof win.id !== 'string' || !win.id.trim()) {
      return { valid: false, error: `Import failed: limitWindow at index ${i} has missing or empty 'id'` };
    }
    if (windowMap.has(win.id)) {
      return { valid: false, error: `Import failed: duplicate limitWindow ID '${win.id}' found` };
    }

    if (typeof win.serviceId !== 'string' || !win.serviceId.trim()) {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' has missing or empty 'serviceId'` };
    }
    const parentService = serviceMap.get(win.serviceId);
    if (!parentService) {
      return {
        valid: false,
        error: `Import failed: limitWindow '${win.id}' references non-existent service '${win.serviceId}'`,
      };
    }

    if (typeof win.accountId !== 'string' || !win.accountId.trim()) {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' has missing or empty 'accountId'` };
    }
    if (!accountIds.has(win.accountId)) {
      return {
        valid: false,
        error: `Import failed: limitWindow '${win.id}' references non-existent account '${win.accountId}'`,
      };
    }
    if (parentService.accountId !== win.accountId) {
      return {
        valid: false,
        error: `Import failed: limitWindow '${win.id}' accountId '${win.accountId}' does not match service '${win.serviceId}' accountId '${parentService.accountId}'`,
      };
    }

    if (typeof win.name !== 'string' || !win.name.trim()) {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' has missing or empty 'name'` };
    }
    if (typeof win.capacity !== 'number' || !Number.isFinite(win.capacity) || win.capacity < 0) {
      return {
        valid: false,
        error: `Import failed: limitWindow '${win.id}' has invalid 'capacity', must be a non-negative finite number`,
      };
    }
    if (typeof win.unit !== 'string' || !VALID_UNITS.has(win.unit as UnitType)) {
      return {
        valid: false,
        error: `Import failed: limitWindow '${win.id}' has invalid 'unit' '${String(win.unit)}', must be one of ${Array.from(VALID_UNITS).join(', ')}`,
      };
    }
    if (typeof win.cadence !== 'string' || !VALID_CADENCES.has(win.cadence as CadenceType)) {
      return {
        valid: false,
        error: `Import failed: limitWindow '${win.id}' has invalid 'cadence' '${String(win.cadence)}', must be one of ${Array.from(VALID_CADENCES).join(', ')}`,
      };
    }
    if (win.cadence === 'custom') {
      if (
        typeof win.customIntervalHours !== 'number' ||
        !Number.isFinite(win.customIntervalHours) ||
        win.customIntervalHours <= 0
      ) {
        return {
          valid: false,
          error: `Import failed: limitWindow '${win.id}' has cadence 'custom' but 'customIntervalHours' is not a positive number`,
        };
      }
    }
    if (typeof win.resetAnchor !== 'string' || !win.resetAnchor.trim()) {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' has missing or empty 'resetAnchor'` };
    }
    if (typeof win.timeZone !== 'string' || !win.timeZone.trim()) {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' has missing or empty 'timeZone'` };
    }
    if (typeof win.currentUsed !== 'number' || !Number.isFinite(win.currentUsed)) {
      return {
        valid: false,
        error: `Import failed: limitWindow '${win.id}' has invalid 'currentUsed', must be a finite number`,
      };
    }
    if (typeof win.lastUpdated !== 'string' || !win.lastUpdated.trim()) {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' has missing or empty 'lastUpdated'` };
    }
    if (typeof win.archived !== 'boolean') {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' property 'archived' must be a boolean` };
    }

    if (win.customUnitName !== undefined && typeof win.customUnitName !== 'string') {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' property 'customUnitName' must be a string` };
    }
    if (win.lastResetEvaluatedAt !== undefined && typeof win.lastResetEvaluatedAt !== 'string') {
      return { valid: false, error: `Import failed: limitWindow '${win.id}' property 'lastResetEvaluatedAt' must be a string` };
    }

    windowMap.set(win.id, { id: win.id, serviceId: win.serviceId, accountId: win.accountId });
    validatedWindows.push({
      id: win.id,
      serviceId: win.serviceId,
      accountId: win.accountId,
      name: win.name,
      capacity: win.capacity,
      unit: win.unit as UnitType,
      customUnitName: win.customUnitName as string | undefined,
      cadence: win.cadence as CadenceType,
      customIntervalHours: win.customIntervalHours as number | undefined,
      resetAnchor: win.resetAnchor,
      timeZone: win.timeZone,
      currentUsed: win.currentUsed,
      lastUpdated: win.lastUpdated,
      lastResetEvaluatedAt: win.lastResetEvaluatedAt as string | undefined,
      archived: win.archived,
    });
  }

  // Validate Projects & collect IDs
  const rawProjects = candidate.projects as unknown[];
  const projectIds = new Set<string>();
  const validatedProjects: Project[] = [];

  for (let i = 0; i < rawProjects.length; i++) {
    const item = rawProjects[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: `Import failed: project at index ${i} is not a valid object` };
    }
    const prj = item as Record<string, unknown>;

    if (typeof prj.id !== 'string' || !prj.id.trim()) {
      return { valid: false, error: `Import failed: project at index ${i} has missing or empty 'id'` };
    }
    if (projectIds.has(prj.id)) {
      return { valid: false, error: `Import failed: duplicate project ID '${prj.id}' found` };
    }
    projectIds.add(prj.id);

    if (typeof prj.name !== 'string' || !prj.name.trim()) {
      return { valid: false, error: `Import failed: project '${prj.id}' has missing or empty 'name'` };
    }
    if (typeof prj.archived !== 'boolean') {
      return { valid: false, error: `Import failed: project '${prj.id}' property 'archived' must be a boolean` };
    }
    if (typeof prj.createdAt !== 'string' || !prj.createdAt.trim()) {
      return { valid: false, error: `Import failed: project '${prj.id}' property 'createdAt' must be a non-empty string` };
    }
    if (prj.notes !== undefined && typeof prj.notes !== 'string') {
      return { valid: false, error: `Import failed: project '${prj.id}' property 'notes' must be a string` };
    }

    validatedProjects.push({
      id: prj.id,
      name: prj.name,
      notes: prj.notes as string | undefined,
      archived: prj.archived,
      createdAt: prj.createdAt,
    });
  }

  // Validate UsageEvents & verify relationships
  const rawEvents = candidate.usageEvents as unknown[];
  const eventIds = new Set<string>();
  const validatedEvents: UsageEvent[] = [];

  for (let i = 0; i < rawEvents.length; i++) {
    const item = rawEvents[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: `Import failed: usageEvent at index ${i} is not a valid object` };
    }
    const evt = item as Record<string, unknown>;

    if (typeof evt.id !== 'string' || !evt.id.trim()) {
      return { valid: false, error: `Import failed: usageEvent at index ${i} has missing or empty 'id'` };
    }
    if (eventIds.has(evt.id)) {
      return { valid: false, error: `Import failed: duplicate usageEvent ID '${evt.id}' found` };
    }
    eventIds.add(evt.id);

    if (typeof evt.timestamp !== 'string' || !evt.timestamp.trim()) {
      return { valid: false, error: `Import failed: usageEvent '${evt.id}' has missing or empty 'timestamp'` };
    }
    if (typeof evt.projectId !== 'string' || !evt.projectId.trim()) {
      return { valid: false, error: `Import failed: usageEvent '${evt.id}' has missing or empty 'projectId'` };
    }
    if (!projectIds.has(evt.projectId)) {
      return {
        valid: false,
        error: `Import failed: usageEvent '${evt.id}' references non-existent project '${evt.projectId}'`,
      };
    }

    if (typeof evt.accountId !== 'string' || !evt.accountId.trim()) {
      return { valid: false, error: `Import failed: usageEvent '${evt.id}' has missing or empty 'accountId'` };
    }
    if (!accountIds.has(evt.accountId)) {
      return {
        valid: false,
        error: `Import failed: usageEvent '${evt.id}' references non-existent account '${evt.accountId}'`,
      };
    }

    if (typeof evt.serviceId !== 'string' || !evt.serviceId.trim()) {
      return { valid: false, error: `Import failed: usageEvent '${evt.id}' has missing or empty 'serviceId'` };
    }
    const targetService = serviceMap.get(evt.serviceId);
    if (!targetService) {
      return {
        valid: false,
        error: `Import failed: usageEvent '${evt.id}' references non-existent service '${evt.serviceId}'`,
      };
    }
    if (targetService.accountId !== evt.accountId) {
      return {
        valid: false,
        error: `Import failed: usageEvent '${evt.id}' accountId '${evt.accountId}' does not match service '${evt.serviceId}' accountId '${targetService.accountId}'`,
      };
    }

    if (evt.type !== 'usage' && evt.type !== 'correction') {
      return {
        valid: false,
        error: `Import failed: usageEvent '${evt.id}' has invalid 'type' '${String(evt.type)}', must be 'usage' or 'correction'`,
      };
    }

    if (typeof evt.createdAt !== 'string' || !evt.createdAt.trim()) {
      return { valid: false, error: `Import failed: usageEvent '${evt.id}' property 'createdAt' must be a non-empty string` };
    }
    if (evt.note !== undefined && typeof evt.note !== 'string') {
      return { valid: false, error: `Import failed: usageEvent '${evt.id}' property 'note' must be a string` };
    }

    if (!Array.isArray(evt.effects)) {
      return { valid: false, error: `Import failed: usageEvent '${evt.id}' property 'effects' must be an array` };
    }

    const validatedEffects: WindowEffect[] = [];
    const rawEffects = evt.effects as unknown[];

    for (let j = 0; j < rawEffects.length; j++) {
      const effectItem = rawEffects[j];
      if (!effectItem || typeof effectItem !== 'object' || Array.isArray(effectItem)) {
        return { valid: false, error: `Import failed: usageEvent '${evt.id}' effect at index ${j} must be an object` };
      }
      const ef = effectItem as Record<string, unknown>;

      if (typeof ef.windowId !== 'string' || !ef.windowId.trim()) {
        return {
          valid: false,
          error: `Import failed: usageEvent '${evt.id}' effect at index ${j} has missing or empty 'windowId'`,
        };
      }
      if (!windowMap.has(ef.windowId)) {
        return {
          valid: false,
          error: `Import failed: usageEvent '${evt.id}' effect references non-existent window '${ef.windowId}'`,
        };
      }

      if (typeof ef.amount !== 'number' || !Number.isFinite(ef.amount)) {
        return {
          valid: false,
          error: `Import failed: usageEvent '${evt.id}' effect at index ${j} has invalid 'amount', must be a finite number`,
        };
      }
      if (typeof ef.previousUsed !== 'number' || !Number.isFinite(ef.previousUsed)) {
        return {
          valid: false,
          error: `Import failed: usageEvent '${evt.id}' effect at index ${j} has invalid 'previousUsed', must be a finite number`,
        };
      }
      if (typeof ef.newUsed !== 'number' || !Number.isFinite(ef.newUsed)) {
        return {
          valid: false,
          error: `Import failed: usageEvent '${evt.id}' effect at index ${j} has invalid 'newUsed', must be a finite number`,
        };
      }

      validatedEffects.push({
        windowId: ef.windowId,
        amount: ef.amount,
        previousUsed: ef.previousUsed,
        newUsed: ef.newUsed,
      });
    }

    validatedEvents.push({
      id: evt.id,
      timestamp: evt.timestamp,
      projectId: evt.projectId,
      accountId: evt.accountId,
      serviceId: evt.serviceId,
      type: evt.type,
      note: evt.note as string | undefined,
      effects: validatedEffects,
      createdAt: evt.createdAt,
    });
  }

  const validatedSettings: UserSettings = {
    defaultTimeZone: s.defaultTimeZone as string,
    lowCapacityThresholdPercent: s.lowCapacityThresholdPercent as number,
    staleDataThresholdHours: s.staleDataThresholdHours as number,
  };

  const state: AppState = {
    version,
    accounts: validatedAccounts,
    services: validatedServices,
    limitWindows: validatedWindows,
    projects: validatedProjects,
    usageEvents: validatedEvents,
    settings: validatedSettings,
  };

  const summary: ValidationSummary = {
    accountsCount: state.accounts.length,
    servicesCount: state.services.length,
    windowsCount: state.limitWindows.length,
    projectsCount: state.projects.length,
    eventsCount: state.usageEvents.length,
  };

  return {
    valid: true,
    state,
    summary,
  };
}

/**
 * Computes the entity count differences between the current AppState
 * and an incoming backup before replacing or merging data.
 */
export function generateImportDiff(currentState: AppState, incomingSummary: ValidationSummary): ImportDiff {
  return {
    accounts: {
      current: currentState.accounts.length,
      incoming: incomingSummary.accountsCount,
      delta: incomingSummary.accountsCount - currentState.accounts.length,
    },
    services: {
      current: currentState.services.length,
      incoming: incomingSummary.servicesCount,
      delta: incomingSummary.servicesCount - currentState.services.length,
    },
    windows: {
      current: currentState.limitWindows.length,
      incoming: incomingSummary.windowsCount,
      delta: incomingSummary.windowsCount - currentState.limitWindows.length,
    },
    projects: {
      current: currentState.projects.length,
      incoming: incomingSummary.projectsCount,
      delta: incomingSummary.projectsCount - currentState.projects.length,
    },
    events: {
      current: currentState.usageEvents.length,
      incoming: incomingSummary.eventsCount,
      delta: incomingSummary.eventsCount - currentState.usageEvents.length,
    },
  };
}
