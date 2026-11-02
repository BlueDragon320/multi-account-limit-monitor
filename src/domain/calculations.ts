/**
 * Calculations & State Mutations for Quota Ember
 *
 * Implements usage event previews, multi-window event application without double-counting,
 * audit corrections, segregated project total aggregations, and threshold checks.
 */

import type {
  AppState,
  ApplyUsageEventInput,
  LimitWindow,
  ProjectTotalsReport,
  RecordCorrectionInput,
  UsageEvent,
  UsagePreview,
} from './types';

/**
 * Generates a unique pseudo-random ID with a specified prefix.
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Previews the effect of a usage amount on a limit window without modifying state.
 *
 * - Correctly translates percentage amounts to unit deltas when the window unit is requests/credits/custom.
 * - Accurately computes remaining capacity and checks for overflow.
 */
export function previewUsageEvent(
  window: LimitWindow,
  amount: number,
  isPercentage: boolean = false
): UsagePreview {
  let delta: number;

  if (isPercentage) {
    if (window.unit === 'percent') {
      delta = amount;
    } else {
      delta = (amount / 100) * window.capacity;
    }
  } else {
    delta = amount;
  }

  const previousUsed = window.currentUsed;
  const newUsed = previousUsed + delta;
  const remaining = Math.max(0, window.capacity - newUsed);
  const percentUsed = window.capacity > 0 ? (newUsed / window.capacity) * 100 : 0;
  const percentRemaining = Math.max(0, 100 - percentUsed);
  const exceedsCapacity = newUsed > window.capacity;

  return {
    windowId: window.id,
    windowName: window.name,
    unit: window.unit,
    customUnitName: window.customUnitName,
    capacity: window.capacity,
    previousUsed,
    delta,
    newUsed,
    remaining,
    percentUsed,
    percentRemaining,
    exceedsCapacity,
  };
}

/**
 * Applies a usage event across one or more limit windows.
 *
 * - Dedupes windows to prevent accidental double-counting within a single event.
 * - Stores individual WindowEffect entries preserving audit history (previousUsed -> newUsed).
 * - Updates limitWindows in the returned AppState.
 */
export function applyUsageEvent(
  state: AppState,
  input: ApplyUsageEventInput
): { state: AppState; event: UsageEvent } {
  const timestamp = input.timestamp || new Date().toISOString();

  // Normalize targets
  const rawTargets: Array<{ windowId: string; amount?: number; isPercentage?: boolean }> = [];
  if (input.windows && input.windows.length > 0) {
    rawTargets.push(...input.windows);
  } else if (input.windowIds && input.windowIds.length > 0) {
    for (const wId of input.windowIds) {
      rawTargets.push({
        windowId: wId,
        amount: input.amount,
        isPercentage: input.isPercentage,
      });
    }
  }

  // Deduplicate by windowId to prevent double counting
  const targetMap = new Map<string, { windowId: string; amount?: number; isPercentage?: boolean }>();
  for (const t of rawTargets) {
    if (!targetMap.has(t.windowId)) {
      targetMap.set(t.windowId, t);
    }
  }

  const effects = [];
  const updatedWindows = [...state.limitWindows];

  for (const target of targetMap.values()) {
    const windowIndex = updatedWindows.findIndex((w) => w.id === target.windowId);
    if (windowIndex === -1) {
      continue;
    }

    const currentWin = updatedWindows[windowIndex];
    const amount = target.amount ?? input.amount ?? 0;
    const isPercentage = target.isPercentage ?? input.isPercentage ?? false;

    const preview = previewUsageEvent(currentWin, amount, isPercentage);

    effects.push({
      windowId: currentWin.id,
      amount: preview.delta,
      previousUsed: preview.previousUsed,
      newUsed: preview.newUsed,
    });

    updatedWindows[windowIndex] = {
      ...currentWin,
      currentUsed: preview.newUsed,
      lastUpdated: timestamp,
    };
  }

  const account = state.accounts?.find((a) => a.id === input.accountId);
  const service = state.services?.find((s) => s.id === input.serviceId);

  const newEvent: UsageEvent = {
    id: generateId('evt'),
    timestamp,
    projectId: input.projectId,
    accountId: input.accountId,
    accountName: account?.name,
    serviceId: input.serviceId,
    serviceName: service?.name,
    type: 'usage',
    note: input.note,
    effects,
    createdAt: timestamp,
  };

  const updatedState: AppState = {
    ...state,
    limitWindows: updatedWindows,
    usageEvents: [...state.usageEvents, newEvent],
  };

  return { state: updatedState, event: newEvent };
}

/**
 * Records a manual balance correction for a specific limit window.
 *
 * - Preserves the previous balance in history.
 * - Clearly distinguishes corrections (`type: 'correction'`) from project usage.
 */
export function recordCorrection(
  state: AppState,
  input: RecordCorrectionInput
): { state: AppState; event: UsageEvent } {
  const timestamp = input.timestamp || new Date().toISOString();
  const windowIndex = state.limitWindows.findIndex((w) => w.id === input.windowId);

  if (windowIndex === -1) {
    throw new Error(`Limit window with ID ${input.windowId} not found.`);
  }

  const currentWin = state.limitWindows[windowIndex];
  const previousUsed = currentWin.currentUsed;
  const newUsed = input.newUsed;
  const delta = newUsed - previousUsed;

  const updatedWindows = [...state.limitWindows];
  updatedWindows[windowIndex] = {
    ...currentWin,
    currentUsed: newUsed,
    lastUpdated: timestamp,
  };

  const account = state.accounts?.find((a) => a.id === currentWin.accountId);
  const service = state.services?.find((s) => s.id === currentWin.serviceId);

  const correctionEvent: UsageEvent = {
    id: generateId('corr'),
    timestamp,
    projectId: '', // Distinct from project usage
    accountId: currentWin.accountId,
    accountName: account?.name,
    serviceId: currentWin.serviceId,
    serviceName: service?.name,
    type: 'correction',
    note: input.reason,
    effects: [
      {
        windowId: currentWin.id,
        amount: delta,
        previousUsed,
        newUsed,
      },
    ],
    createdAt: timestamp,
  };

  const updatedState: AppState = {
    ...state,
    limitWindows: updatedWindows,
    usageEvents: [...state.usageEvents, correctionEvent],
  };

  return { state: updatedState, event: correctionEvent };
}

/**
 * Calculates project usage totals from history, strictly segregating unlike units and capacities.
 *
 * Rules:
 * 1. Corrections are excluded from project totals.
 * 2. Unlike units (credits vs requests vs percent vs custom) are NEVER combined.
 * 3. Percentages from windows with different capacities are NEVER combined.
 * 4. Per-window breakdowns are maintained so that multi-window events (e.g. hourly + weekly)
 *    are never summed together into an inflated total.
 */
export function calculateProjectTotals(
  usageEvents: UsageEvent[],
  limitWindows: LimitWindow[]
): Record<string, ProjectTotalsReport> {
  const windowMap = new Map<string, LimitWindow>();
  for (const w of limitWindows) {
    windowMap.set(w.id, w);
  }

  const reports: Record<string, ProjectTotalsReport> = {};

  for (const event of usageEvents) {
    // Corrections are NOT project usage
    if (event.type === 'correction') continue;
    if (!event.projectId) continue;

    if (!reports[event.projectId]) {
      reports[event.projectId] = {
        projectId: event.projectId,
        byWindow: [],
        segregatedTotals: [],
      };
    }

    const report = reports[event.projectId];

    for (const effect of event.effects) {
      const window = windowMap.get(effect.windowId);
      const unit = window ? window.unit : 'custom';
      const customUnitName = window?.customUnitName;
      const capacity = window ? window.capacity : 0;
      const windowName = window ? window.name : effect.windowId;
      const serviceId = window ? window.serviceId : event.serviceId;

      // 1. Update byWindow total
      let winTotal = report.byWindow.find((item) => item.windowId === effect.windowId);
      if (!winTotal) {
        winTotal = {
          windowId: effect.windowId,
          windowName,
          serviceId,
          unit,
          customUnitName,
          capacity,
          totalAmount: 0,
          eventCount: 0,
        };
        report.byWindow.push(winTotal);
      }
      winTotal.totalAmount += effect.amount;
      winTotal.eventCount += 1;

      // 2. Update segregated bucket
      // Bucket key enforces strict segregation: unit + customUnitName + capacity + windowId
      const bucketKey = `${unit}:${customUnitName || ''}:${capacity}:${effect.windowId}`;
      let bucket = report.segregatedTotals.find((b) => b.bucketKey === bucketKey);
      if (!bucket) {
        bucket = {
          bucketKey,
          windowId: effect.windowId,
          windowName,
          serviceId,
          unit,
          customUnitName,
          capacity,
          totalAmount: 0,
          eventCount: 0,
        };
        report.segregatedTotals.push(bucket);
      }
      bucket.totalAmount += effect.amount;
      bucket.eventCount += 1;
    }
  }

  return reports;
}

/**
 * Gets the aggregated totals report for a single project.
 */
export function getProjectTotals(
  projectId: string,
  usageEvents: UsageEvent[],
  limitWindows: LimitWindow[]
): ProjectTotalsReport {
  const all = calculateProjectTotals(usageEvents, limitWindows);
  return (
    all[projectId] || {
      projectId,
      byWindow: [],
      segregatedTotals: [],
    }
  );
}

/**
 * Checks if a window has reached or exceeded the low-capacity threshold.
 * (e.g. used >= 80%, meaning remaining <= 20%).
 */
export function isLowCapacity(window: LimitWindow, thresholdPercent: number = 80): boolean {
  if (window.capacity <= 0) {
    return window.currentUsed > 0;
  }
  const usedPercent = (window.currentUsed / window.capacity) * 100;
  return usedPercent >= thresholdPercent;
}

/**
 * Checks if a window's data is stale (has not been updated within thresholdHours).
 */
export function isStaleData(
  window: LimitWindow,
  thresholdHours: number = 24,
  now: Date = new Date()
): boolean {
  if (!window.lastUpdated) {
    return true;
  }
  const lastUpdatedMs = new Date(window.lastUpdated).getTime();
  if (isNaN(lastUpdatedMs)) {
    return true;
  }
  const elapsedHours = (now.getTime() - lastUpdatedMs) / (1000 * 60 * 60);
  return elapsedHours > thresholdHours;
}
