/**
 * Service Presets for Quota Ember
 *
 * Provides sensible, editable templates for Antigravity, Google Flow,
 * Google AI Studio, Gemini, and custom services.
 * Note: These are user-configured tracking templates and do not assert
 * official provider quota guarantees.
 */

import { LimitWindow, ServicePreset } from './types';

export const ANTIGRAVITY_PRESET: ServicePreset = {
  name: 'Antigravity',
  suggestedWindows: [
    {
      name: 'Hourly Request Limit',
      cadence: 'hourly',
      unit: 'requests',
      defaultCapacity: 100,
      description:
        'Tracks short-term burst quota resetting every hour from the anchor minute. Customize capacity to match your account tier.',
    },
    {
      name: 'Weekly Quota',
      cadence: 'weekly',
      unit: 'requests',
      defaultCapacity: 1000,
      description:
        'Tracks cumulative weekly allotment resetting once per week on the specified anchor day and time.',
    },
  ],
};

export const GOOGLE_FLOW_PRESET: ServicePreset = {
  name: 'Google Flow',
  suggestedWindows: [
    {
      name: 'Monthly Allowance',
      cadence: 'monthly',
      unit: 'credits',
      defaultCapacity: 1000,
      description:
        'Tracks monthly credit or balance allowance resetting on your billing or anchor date. Month-end clamping (e.g. 31st to 28th/30th) is automatically applied.',
    },
  ],
};

export const GOOGLE_AI_STUDIO_PRESET: ServicePreset = {
  name: 'Google AI Studio',
  suggestedWindows: [
    {
      name: 'Daily Request Limit',
      cadence: 'daily',
      unit: 'requests',
      defaultCapacity: 1500,
      description:
        'Tracks daily requests per day (RPD) resetting every 24 hours at the configured local wall-clock time.',
    },
  ],
};

export const GEMINI_PRESET: ServicePreset = {
  name: 'Gemini',
  suggestedWindows: [
    {
      name: 'Daily Prompts Limit',
      cadence: 'daily',
      unit: 'requests',
      defaultCapacity: 100,
      description:
        'Tracks daily prompt or message allowance resetting every 24 hours at your chosen local time anchor.',
    },
  ],
};

export const CUSTOM_SERVICE_PRESET: ServicePreset = {
  name: 'Custom Service',
  suggestedWindows: [
    {
      name: 'Custom Window',
      cadence: 'daily',
      unit: 'requests',
      defaultCapacity: 100,
      description:
        'General-purpose limit window. Configure with your own capacity, unit (credits, requests, percent, or custom), cadence, and anchor.',
    },
  ],
};

export const SERVICE_PRESETS: ServicePreset[] = [
  ANTIGRAVITY_PRESET,
  GOOGLE_FLOW_PRESET,
  GOOGLE_AI_STUDIO_PRESET,
  GEMINI_PRESET,
  CUSTOM_SERVICE_PRESET,
];

/**
 * Finds a service preset by name (case-insensitive).
 */
export function getPresetByName(name: string): ServicePreset | undefined {
  const normalized = name.trim().toLowerCase();
  return SERVICE_PRESETS.find((p) => p.name.toLowerCase() === normalized);
}

/**
 * Instantiates LimitWindow objects from a service preset with unique IDs and initial states.
 */
export function createWindowsFromPreset(
  preset: ServicePreset,
  serviceId: string,
  accountId: string,
  timeZone: string,
  anchorIso?: string
): LimitWindow[] {
  const anchor = anchorIso || new Date().toISOString();
  const now = new Date().toISOString();

  return preset.suggestedWindows.map((suggested, index) => ({
    id: `win_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
    serviceId,
    accountId,
    name: suggested.name,
    capacity: suggested.defaultCapacity ?? 100,
    unit: suggested.unit,
    cadence: suggested.cadence,
    resetAnchor: anchor,
    timeZone,
    currentUsed: 0,
    lastUpdated: now,
    archived: false,
  }));
}
