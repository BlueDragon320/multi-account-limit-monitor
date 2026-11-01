import { describe, it, expect } from 'vitest';
import {
  calculateReset,
  checkAndAdvanceWindow,
  advanceAllStateWindows,
  formatResetCountdown,
  formatLocalDateTime,
  getZonedParts,
  zonedPartsToUtcDate,
  getDaysInMonth,
} from '../src/domain/resetEngine';
import { LimitWindow } from '../src/domain/types';

describe('resetEngine: Timezone & DST Handling', () => {
  it('preserves local wall-clock time across America/New_York spring forward (EST to EDT)', () => {
    // Clocks spring forward in US on 2026-03-08 at 02:00 -> 03:00.
    const tz = 'America/New_York';
    const anchor = zonedPartsToUtcDate({
      year: 2026,
      month: 3,
      day: 7,
      hour: 9,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, tz);

    // 09:00 EST on Mar 7 is 14:00 UTC
    expect(anchor.toISOString()).toBe('2026-03-07T14:00:00.000Z');

    const window: LimitWindow = {
      id: 'win-dst-ny',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Daily NY Limit',
      capacity: 100,
      unit: 'requests',
      cadence: 'daily',
      resetAnchor: anchor.toISOString(),
      timeZone: tz,
      currentUsed: 25,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    // Evaluate at 2026-03-07 12:00:00 NY (17:00 UTC) - after anchor
    const now1 = zonedPartsToUtcDate({
      year: 2026,
      month: 3,
      day: 7,
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, tz);

    const res1 = calculateReset(window, now1);
    // Next reset should be 2026-03-08 09:00:00 EDT (13:00 UTC)
    expect(res1.nextResetDate.toISOString()).toBe('2026-03-08T13:00:00.000Z');

    const parts1 = getZonedParts(res1.nextResetDate, tz);
    expect(parts1.hour).toBe(9);
    expect(parts1.minute).toBe(0);
    expect(parts1.day).toBe(8);

    // Evaluate on DST day 2026-03-08 at 10:00 NY (14:00 UTC)
    const now2 = zonedPartsToUtcDate({
      year: 2026,
      month: 3,
      day: 8,
      hour: 10,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, tz);

    const res2 = calculateReset(window, now2);
    // Next reset is 2026-03-09 09:00:00 EDT (13:00 UTC)
    expect(res2.nextResetDate.toISOString()).toBe('2026-03-09T13:00:00.000Z');
    const parts2 = getZonedParts(res2.nextResetDate, tz);
    expect(parts2.hour).toBe(9);
    expect(parts2.minute).toBe(0);
    expect(parts2.day).toBe(9);
  });

  it('preserves local wall-clock time across America/New_York fall back (EDT to EST)', () => {
    // Clocks fall back in US on 2026-11-01 at 02:00 EDT -> 01:00 EST.
    const tz = 'America/New_York';
    // Anchor on Oct 31, 2026 at 09:00 NY (EDT, 13:00 UTC)
    const anchor = zonedPartsToUtcDate({
      year: 2026,
      month: 10,
      day: 31,
      hour: 9,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, tz);
    expect(anchor.toISOString()).toBe('2026-10-31T13:00:00.000Z');

    const window: LimitWindow = {
      id: 'win-fall-ny',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Daily Fallback Limit',
      capacity: 100,
      unit: 'requests',
      cadence: 'daily',
      resetAnchor: anchor.toISOString(),
      timeZone: tz,
      currentUsed: 10,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    // Evaluate at 2026-10-31 12:00:00 NY (16:00 UTC)
    const now = zonedPartsToUtcDate({
      year: 2026,
      month: 10,
      day: 31,
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, tz);

    const res = calculateReset(window, now);
    // Next reset should be Nov 1 at 09:00 EST (14:00 UTC)
    expect(res.nextResetDate.toISOString()).toBe('2026-11-01T14:00:00.000Z');
    const parts = getZonedParts(res.nextResetDate, tz);
    expect(parts.hour).toBe(9);
    expect(parts.minute).toBe(0);
    expect(parts.day).toBe(1);
    expect(parts.month).toBe(11);
  });

  it('preserves local wall-clock time across Europe/London spring forward (GMT to BST)', () => {
    // Europe/London springs forward on 2026-03-29 at 01:00 GMT -> 02:00 BST.
    const tz = 'Europe/London';
    const anchor = zonedPartsToUtcDate({
      year: 2026,
      month: 3,
      day: 28,
      hour: 10,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, tz);

    // Mar 28 10:00 GMT is 10:00 UTC
    expect(anchor.toISOString()).toBe('2026-03-28T10:00:00.000Z');

    const window: LimitWindow = {
      id: 'win-london',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'London Limit',
      capacity: 50,
      unit: 'requests',
      cadence: 'daily',
      resetAnchor: anchor.toISOString(),
      timeZone: tz,
      currentUsed: 0,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    // Evaluate on Mar 28 at 12:00 GMT (12:00 UTC)
    const now = zonedPartsToUtcDate({
      year: 2026,
      month: 3,
      day: 28,
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    }, tz);

    const res = calculateReset(window, now);
    // Next reset on Mar 29 10:00 BST is 09:00 UTC!
    expect(res.nextResetDate.toISOString()).toBe('2026-03-29T09:00:00.000Z');
    const parts = getZonedParts(res.nextResetDate, tz);
    expect(parts.hour).toBe(10);
    expect(parts.minute).toBe(0);
    expect(parts.day).toBe(29);
  });
});

describe('resetEngine: Month-End Clamping & Leap Years', () => {
  it('correctly reports days in month for regular and leap years', () => {
    expect(getDaysInMonth(2024, 2)).toBe(29); // Leap year
    expect(getDaysInMonth(2025, 2)).toBe(28); // Normal year
    expect(getDaysInMonth(2026, 2)).toBe(28); // Normal year
    expect(getDaysInMonth(2026, 4)).toBe(30); // April
    expect(getDaysInMonth(2026, 1)).toBe(31); // January
  });

  it('clamps monthly reset on 31st to Feb 28, advances to Mar 31, Apr 30 without skipping months', () => {
    const tz = 'UTC';
    const anchor = new Date('2026-01-31T12:00:00.000Z');

    const window: LimitWindow = {
      id: 'win-monthend',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Monthly 31st Limit',
      capacity: 500,
      unit: 'credits',
      cadence: 'monthly',
      resetAnchor: anchor.toISOString(),
      timeZone: tz,
      currentUsed: 100,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    // Step 1: During February (Feb 15)
    const nowFeb = new Date('2026-02-15T12:00:00.000Z');
    const resFeb = calculateReset(window, nowFeb);
    expect(resFeb.nextResetDate.toISOString()).toBe('2026-02-28T12:00:00.000Z');
    expect(resFeb.activePeriodStart.toISOString()).toBe('2026-01-31T12:00:00.000Z');

    // Step 2: During March (Mar 10)
    const nowMar = new Date('2026-03-10T12:00:00.000Z');
    const resMar = calculateReset(window, nowMar);
    // Crucial check: Mar 31 must restore day 31, NOT stay clamped to 28!
    expect(resMar.nextResetDate.toISOString()).toBe('2026-03-31T12:00:00.000Z');
    expect(resMar.activePeriodStart.toISOString()).toBe('2026-02-28T12:00:00.000Z');

    // Step 3: During April (Apr 05)
    const nowApr = new Date('2026-04-05T12:00:00.000Z');
    const resApr = calculateReset(window, nowApr);
    expect(resApr.nextResetDate.toISOString()).toBe('2026-04-30T12:00:00.000Z');
    expect(resApr.activePeriodStart.toISOString()).toBe('2026-03-31T12:00:00.000Z');

    // Step 4: During May (May 02)
    const nowMay = new Date('2026-05-02T12:00:00.000Z');
    const resMay = calculateReset(window, nowMay);
    expect(resMay.nextResetDate.toISOString()).toBe('2026-05-31T12:00:00.000Z');
    expect(resMay.activePeriodStart.toISOString()).toBe('2026-04-30T12:00:00.000Z');
  });

  it('correctly clamps to Feb 29 in a leap year (2024)', () => {
    const tz = 'UTC';
    const anchor = new Date('2024-01-31T10:00:00.000Z');

    const window: LimitWindow = {
      id: 'win-leap-2024',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Leap Year Window',
      capacity: 1000,
      unit: 'requests',
      cadence: 'monthly',
      resetAnchor: anchor.toISOString(),
      timeZone: tz,
      currentUsed: 50,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    const nowFeb2024 = new Date('2024-02-10T10:00:00.000Z');
    const resFeb = calculateReset(window, nowFeb2024);
    // February 2024 has 29 days
    expect(resFeb.nextResetDate.toISOString()).toBe('2024-02-29T10:00:00.000Z');
  });
});

describe('resetEngine: Multiple Missed Periods & Window Advancement', () => {
  it('correctly calculates 3 missed periods when weekly anchor was 3 weeks ago', () => {
    // Anchor: 3 weeks ago (21 days) on Thursday at 12:00:00 UTC
    const anchor = new Date('2026-10-01T12:00:00.000Z');
    // Now: exactly 3 weeks later on Thursday at 15:00:00 UTC (3 hours past the 3rd reset)
    const now = new Date('2026-10-22T15:00:00.000Z');

    const window: LimitWindow = {
      id: 'win-weekly-missed',
      serviceId: 'srv-antigravity',
      accountId: 'acc-1',
      name: 'Weekly Antigravity Limit',
      capacity: 500,
      unit: 'requests',
      cadence: 'weekly',
      resetAnchor: anchor.toISOString(),
      timeZone: 'UTC',
      currentUsed: 350,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    const res = calculateReset(window, now);

    // Resets occurred on:
    // 1: 2026-10-08T12:00:00Z
    // 2: 2026-10-15T12:00:00Z
    // 3: 2026-10-22T12:00:00Z
    // All 3 resets occurred before `now` (2026-10-22T15:00:00Z)
    expect(res.missedPeriodsCount).toBe(3);
    expect(res.isPastDue).toBe(true);

    // Current active period is [Oct 22 12:00, Oct 29 12:00]
    expect(res.activePeriodStart.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(res.activePeriodEnd.toISOString()).toBe('2026-10-29T12:00:00.000Z');
    expect(res.nextResetDate.toISOString()).toBe('2026-10-29T12:00:00.000Z');

    // Countdown before advance is Overdue because isPastDue === true
    expect(formatResetCountdown(res)).toBe('Overdue');

    // Now advance the window
    const advanceResult = checkAndAdvanceWindow(window, now);
    expect(advanceResult.advanced).toBe(true);
    expect(advanceResult.missedPeriods).toBe(3);
    expect(advanceResult.window.currentUsed).toBe(0); // Reset to 0
    expect(advanceResult.window.lastResetEvaluatedAt).toBe(now.toISOString());

    // Evaluate again on the advanced window
    const resAfterAdvance = calculateReset(advanceResult.window, now);
    expect(resAfterAdvance.missedPeriodsCount).toBe(0);
    expect(resAfterAdvance.isPastDue).toBe(false);
    expect(resAfterAdvance.nextResetDate.toISOString()).toBe('2026-10-29T12:00:00.000Z');

    // Formatted countdown should now show time remaining (approx 6d 21h)
    const countdown = formatResetCountdown(resAfterAdvance);
    expect(countdown).toMatch(/6d 2[0-1]h/);
  });

  it('advances hourly windows and clears usage', () => {
    const anchor = new Date('2026-11-01T10:15:00.000Z');
    const now = new Date('2026-11-01T14:20:00.000Z'); // 4 hours and 5 minutes later

    const window: LimitWindow = {
      id: 'win-hourly',
      serviceId: 'srv-antigravity',
      accountId: 'acc-1',
      name: 'Hourly Antigravity',
      capacity: 100,
      unit: 'requests',
      cadence: 'hourly',
      resetAnchor: anchor.toISOString(),
      timeZone: 'UTC',
      currentUsed: 80,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    const res = calculateReset(window, now);
    // Resets at 11:15, 12:15, 13:15, 14:15 = 4 resets
    expect(res.missedPeriodsCount).toBe(4);
    expect(res.isPastDue).toBe(true);
    expect(res.nextResetDate.toISOString()).toBe('2026-11-01T15:15:00.000Z');

    const advanceResult = checkAndAdvanceWindow(window, now);
    expect(advanceResult.advanced).toBe(true);
    expect(advanceResult.window.currentUsed).toBe(0);
    expect(advanceResult.missedPeriods).toBe(4);
  });

  it('does not advance windows when no reset has passed', () => {
    const anchor = new Date('2026-11-01T10:00:00.000Z');
    const now = new Date('2026-11-01T10:30:00.000Z'); // Only 30 minutes later

    const window: LimitWindow = {
      id: 'win-hourly-not-due',
      serviceId: 'srv-antigravity',
      accountId: 'acc-1',
      name: 'Hourly Antigravity',
      capacity: 100,
      unit: 'requests',
      cadence: 'hourly',
      resetAnchor: anchor.toISOString(),
      timeZone: 'UTC',
      currentUsed: 40,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    const advanceResult = checkAndAdvanceWindow(window, now);
    expect(advanceResult.advanced).toBe(false);
    expect(advanceResult.window.currentUsed).toBe(40); // Preserved
    expect(advanceResult.missedPeriods).toBe(0);
  });

  it('advances all windows in a state array accurately', () => {
    const anchorOld = new Date('2026-10-01T00:00:00.000Z');
    const anchorNew = new Date('2026-11-01T00:00:00.000Z');
    const now = new Date('2026-11-01T12:00:00.000Z');

    const windows: LimitWindow[] = [
      {
        id: 'w1',
        serviceId: 's1',
        accountId: 'a1',
        name: 'Weekly Old',
        capacity: 100,
        unit: 'requests',
        cadence: 'weekly',
        resetAnchor: anchorOld.toISOString(),
        timeZone: 'UTC',
        currentUsed: 90,
        lastUpdated: anchorOld.toISOString(),
        archived: false,
      },
      {
        id: 'w2',
        serviceId: 's1',
        accountId: 'a1',
        name: 'Daily Current',
        capacity: 100,
        unit: 'requests',
        cadence: 'daily',
        resetAnchor: anchorNew.toISOString(),
        timeZone: 'UTC',
        currentUsed: 30,
        lastUpdated: anchorNew.toISOString(),
        archived: false,
      },
    ];

    const result = advanceAllStateWindows(windows, now);
    expect(result.advancedCount).toBe(1);
    expect(result.windows[0].currentUsed).toBe(0); // w1 advanced
    expect(result.windows[1].currentUsed).toBe(30); // w2 not due yet
  });
});

describe('resetEngine: Custom Cadence', () => {
  it('correctly handles custom cadence intervals (e.g. 12 hours)', () => {
    const anchor = new Date('2026-11-01T00:00:00.000Z');
    const window: LimitWindow = {
      id: 'win-custom-12h',
      serviceId: 'srv-1',
      accountId: 'acc-1',
      name: 'Custom 12h Limit',
      capacity: 50,
      unit: 'credits',
      cadence: 'custom',
      customIntervalHours: 12,
      resetAnchor: anchor.toISOString(),
      timeZone: 'UTC',
      currentUsed: 10,
      lastUpdated: anchor.toISOString(),
      archived: false,
    };

    // At 15 hours after anchor (now = 15:00 UTC)
    const now = new Date('2026-11-01T15:00:00.000Z');
    const res = calculateReset(window, now);

    // Resets: 12:00 (1 missed), next reset: 24:00 (2026-11-02T00:00:00Z)
    expect(res.missedPeriodsCount).toBe(1);
    expect(res.isPastDue).toBe(true);
    expect(res.activePeriodStart.toISOString()).toBe('2026-11-01T12:00:00.000Z');
    expect(res.nextResetDate.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });
});

describe('resetEngine: Formatting Functions', () => {
  it('formats reset countdown for various intervals', () => {
    expect(formatResetCountdown({ timeRemainingMs: 0, isPastDue: true })).toBe('Overdue');
    expect(formatResetCountdown({ timeRemainingMs: -5000, isPastDue: false })).toBe('Overdue');

    // 4 hours and 12 minutes = 4 * 3600000 + 12 * 60000 = 15,120,000 ms
    expect(formatResetCountdown({ timeRemainingMs: 15120000, isPastDue: false })).toBe('4h 12m');

    // 3 days and 8 hours = 3 * 86400000 + 8 * 3600000 = 288,000,000 ms
    expect(formatResetCountdown({ timeRemainingMs: 288000000, isPastDue: false })).toBe('3d 8h');

    // 45 minutes = 45 * 60000 = 2,700,000 ms
    expect(formatResetCountdown({ timeRemainingMs: 2700000, isPastDue: false })).toBe('45m');

    // 30 seconds = 30,000 ms
    expect(formatResetCountdown({ timeRemainingMs: 30000, isPastDue: false })).toBe('30s');
  });

  it('formats human readable local date/time with zone string', () => {
    const d = new Date('2026-03-08T13:00:00.000Z');
    const formattedNy = formatLocalDateTime(d, 'America/New_York');
    expect(formattedNy).toContain('Mar 8, 2026');
    expect(formattedNy).toContain('9:00 AM');
    expect(formattedNy).toContain('America/New_York');

    const formattedUtc = formatLocalDateTime(d, 'UTC');
    expect(formattedUtc).toContain('Mar 8, 2026');
    expect(formattedUtc).toContain('1:00 PM');
  });
});
