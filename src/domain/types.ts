/**
 * Domain Models for Quota Ember Quota & Limit Tracker
 */

export type UnitType = 'percent' | 'credits' | 'requests' | 'custom';

export type CadenceType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface Account {
  id: string;
  name: string;
  email?: string;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  accountId: string;
  name: string; // e.g., Antigravity, Google Flow, Google AI Studio, Gemini, or custom
  notes?: string;
  archived: boolean;
  createdAt: string;
}

export interface LimitWindow {
  id: string;
  serviceId: string;
  accountId: string;
  name: string; // e.g., "Hourly Limit", "Weekly Limit"
  capacity: number;
  unit: UnitType;
  customUnitName?: string;
  cadence: CadenceType;
  customIntervalHours?: number; // Used when cadence === 'custom'
  resetAnchor: string; // ISO date/time string from which intervals are anchored
  timeZone: string; // IANA Time Zone string, e.g., "UTC", "America/New_York"
  currentUsed: number;
  lastUpdated: string; // ISO timestamp of manual update or adjustment
  lastResetEvaluatedAt?: string;
  archived: boolean;
}

export interface Project {
  id: string;
  name: string;
  notes?: string;
  archived: boolean;
  createdAt: string;
}

export interface WindowEffect {
  windowId: string;
  amount: number; // delta added (or set in correction)
  previousUsed: number;
  newUsed: number;
}

export interface UsageEvent {
  id: string;
  timestamp: string; // Event occurrence timestamp
  projectId: string; // Associated project
  accountId: string;
  serviceId: string;
  type: 'usage' | 'correction';
  note?: string;
  effects: WindowEffect[];
  createdAt: string;
}

export interface UserSettings {
  defaultTimeZone: string;
  lowCapacityThresholdPercent: number; // default 80% (i.e. remaining <= 20%)
  staleDataThresholdHours: number; // default 24h
}

export interface AppState {
  version: number;
  accounts: Account[];
  services: Service[];
  limitWindows: LimitWindow[];
  projects: Project[];
  usageEvents: UsageEvent[];
  settings: UserSettings;
}

export interface ServicePreset {
  name: string;
  suggestedWindows: {
    name: string;
    cadence: CadenceType;
    unit: UnitType;
    defaultCapacity?: number;
    description: string;
  }[];
}

export interface ResetCalculationResult {
  nextResetDate: Date;
  nextResetIso: string;
  timeRemainingMs: number;
  isPastDue: boolean;
  activePeriodStart: Date;
  activePeriodEnd: Date;
  missedPeriodsCount: number;
}

export interface WindowAdvanceResult {
  advanced: boolean;
  window: LimitWindow;
  missedPeriods: number;
}

export interface UsagePreview {
  windowId: string;
  windowName: string;
  unit: UnitType;
  customUnitName?: string;
  capacity: number;
  previousUsed: number;
  delta: number;
  newUsed: number;
  remaining: number;
  percentUsed: number;
  percentRemaining: number;
  exceedsCapacity: boolean;
}

export interface ApplyUsageEventInput {
  projectId: string;
  accountId: string;
  serviceId: string;
  timestamp?: string;
  note?: string;
  amount?: number;
  isPercentage?: boolean;
  windowIds?: string[];
  windows?: Array<{
    windowId: string;
    amount?: number;
    isPercentage?: boolean;
  }>;
}

export interface RecordCorrectionInput {
  windowId: string;
  newUsed: number;
  reason?: string;
  timestamp?: string;
}

export interface ProjectWindowUsageTotal {
  windowId: string;
  windowName: string;
  serviceId: string;
  unit: UnitType;
  customUnitName?: string;
  capacity: number;
  totalAmount: number;
  eventCount: number;
}

export interface SegregatedBucketTotal {
  bucketKey: string;
  windowId: string;
  windowName: string;
  serviceId: string;
  unit: UnitType;
  customUnitName?: string;
  capacity: number;
  totalAmount: number;
  eventCount: number;
}

export interface ProjectTotalsReport {
  projectId: string;
  byWindow: ProjectWindowUsageTotal[];
  segregatedTotals: SegregatedBucketTotal[];
}
