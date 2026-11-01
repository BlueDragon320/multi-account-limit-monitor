/**
 * Core Reset Engine for Quota Ember
 *
 * Handles reset cadence calculations, timezone conversions via Intl.DateTimeFormat,
 * local wall-clock preservation across DST transitions, month-end clamping (e.g. Jan 31 -> Feb 28/29 -> Mar 31),
 * active period identification, countdown formatting, and window advancement.
 */

import { CadenceType, LimitWindow, ResetCalculationResult, WindowAdvanceResult } from './types';

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  millisecond: number;
}

/**
 * Validates whether an IANA timezone string is recognized by the runtime.
 */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a valid IANA timezone or defaults to UTC.
 */
export function getSafeTimeZone(tz?: string): string {
  if (tz && isValidTimeZone(tz)) return tz;
  return 'UTC';
}

/**
 * Deconstructs a Date into its local components in the target timezone.
 */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const safeTz = getSafeTimeZone(timeZone);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  });

  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    millisecond: parseInt(map.fractionalSecond || '0', 10),
  };
}

/**
 * Converts local date parts in a specific timezone to a UTC Date object.
 * Uses bounded convergence iterations to accurately account for standard and daylight saving offsets.
 */
export function zonedPartsToUtcDate(parts: ZonedParts, timeZone: string): Date {
  const safeTz = getSafeTimeZone(timeZone);
  let utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond || 0
  );

  for (let i = 0; i < 4; i++) {
    const curParts = getZonedParts(new Date(utcMs), safeTz);
    const curAsUtcMs = Date.UTC(
      curParts.year,
      curParts.month - 1,
      curParts.day,
      curParts.hour,
      curParts.minute,
      curParts.second,
      curParts.millisecond
    );
    const targetAsUtcMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond || 0
    );
    const diff = curAsUtcMs - targetAsUtcMs;
    if (diff === 0) break;
    utcMs -= diff;
  }

  return new Date(utcMs);
}

/**
 * Returns the number of days in the specified month (1-12) of a given year.
 * Handles leap years correctly (e.g. Feb 2024 -> 29, Feb 2026 -> 28).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calculates the next reset date strictly after `refDate`.
 * Respects local wall-clock time across DST transitions and clamps month-ends.
 */
export function getNextResetAfter(
  refDate: Date,
  anchorDate: Date,
  cadence: CadenceType,
  timeZone: string,
  customIntervalHours: number = 24
): Date {
  const safeTz = getSafeTimeZone(timeZone);
  const anchorParts = getZonedParts(anchorDate, safeTz);

  switch (cadence) {
    case 'hourly': {
      const refParts = getZonedParts(refDate, safeTz);
      // Candidate at refDate's hour with anchor's minute & second
      const candidate = zonedPartsToUtcDate(
        {
          year: refParts.year,
          month: refParts.month,
          day: refParts.day,
          hour: refParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );

      if (candidate.getTime() > refDate.getTime()) {
        return candidate;
      }

      // Advance 1 hour in wall-clock time
      const nextHourUtc = new Date(candidate.getTime() + 3600 * 1000);
      const nextHourParts = getZonedParts(nextHourUtc, safeTz);
      let nextCandidate = zonedPartsToUtcDate(
        {
          year: nextHourParts.year,
          month: nextHourParts.month,
          day: nextHourParts.day,
          hour: nextHourParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );

      // In case of a DST transition where local hour skipped
      if (nextCandidate.getTime() <= refDate.getTime()) {
        nextCandidate = new Date(nextCandidate.getTime() + 3600 * 1000);
      }
      return nextCandidate;
    }

    case 'daily': {
      const refParts = getZonedParts(refDate, safeTz);
      const candidate = zonedPartsToUtcDate(
        {
          year: refParts.year,
          month: refParts.month,
          day: refParts.day,
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );

      if (candidate.getTime() > refDate.getTime()) {
        return candidate;
      }

      // Next local day
      const nextDayUtc = new Date(Date.UTC(refParts.year, refParts.month - 1, refParts.day + 1));
      return zonedPartsToUtcDate(
        {
          year: nextDayUtc.getUTCFullYear(),
          month: nextDayUtc.getUTCMonth() + 1,
          day: nextDayUtc.getUTCDate(),
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );
    }

    case 'weekly': {
      // Find the day of week of the anchor in safeTz (0 = Sun, ..., 6 = Sat)
      const anchorDow = new Date(Date.UTC(anchorParts.year, anchorParts.month - 1, anchorParts.day)).getUTCDay();
      const refParts = getZonedParts(refDate, safeTz);
      const refDow = new Date(Date.UTC(refParts.year, refParts.month - 1, refParts.day)).getUTCDay();

      const daysSinceAnchorDow = (refDow - anchorDow + 7) % 7;
      const candidateDayUtc = new Date(Date.UTC(refParts.year, refParts.month - 1, refParts.day - daysSinceAnchorDow));

      const candidate = zonedPartsToUtcDate(
        {
          year: candidateDayUtc.getUTCFullYear(),
          month: candidateDayUtc.getUTCMonth() + 1,
          day: candidateDayUtc.getUTCDate(),
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );

      if (candidate.getTime() > refDate.getTime()) {
        return candidate;
      }

      // Next week (+7 days in local time)
      const nextWeekUtc = new Date(Date.UTC(
        candidateDayUtc.getUTCFullYear(),
        candidateDayUtc.getUTCMonth(),
        candidateDayUtc.getUTCDate() + 7
      ));

      return zonedPartsToUtcDate(
        {
          year: nextWeekUtc.getUTCFullYear(),
          month: nextWeekUtc.getUTCMonth() + 1,
          day: nextWeekUtc.getUTCDate(),
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );
    }

    case 'monthly': {
      const refParts = getZonedParts(refDate, safeTz);
      const anchorTargetDay = anchorParts.day;

      // Candidate for the current reference month
      const daysInCurMonth = getDaysInMonth(refParts.year, refParts.month);
      const clampedCurDay = Math.min(anchorTargetDay, daysInCurMonth);

      const candidate = zonedPartsToUtcDate(
        {
          year: refParts.year,
          month: refParts.month,
          day: clampedCurDay,
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );

      if (candidate.getTime() > refDate.getTime()) {
        return candidate;
      }

      // Next month
      let nextYear = refParts.year;
      let nextMonth = refParts.month + 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }

      const daysInNextMonth = getDaysInMonth(nextYear, nextMonth);
      const clampedNextDay = Math.min(anchorTargetDay, daysInNextMonth);

      return zonedPartsToUtcDate(
        {
          year: nextYear,
          month: nextMonth,
          day: clampedNextDay,
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );
    }

    case 'custom': {
      const intervalHours = customIntervalHours > 0 ? customIntervalHours : 24;
      const intervalMs = intervalHours * 3600 * 1000;
      const anchorMs = anchorDate.getTime();
      const diff = refDate.getTime() - anchorMs;
      const steps = Math.floor(diff / intervalMs) + 1;
      return new Date(anchorMs + steps * intervalMs);
    }
  }
}

/**
 * Calculates the reset date immediately preceding `nextResetDate`.
 * This defines the start of the active period leading up to `nextResetDate`.
 */
export function getPreviousResetBefore(
  nextResetDate: Date,
  anchorDate: Date,
  cadence: CadenceType,
  timeZone: string,
  customIntervalHours: number = 24
): Date {
  const safeTz = getSafeTimeZone(timeZone);
  const anchorParts = getZonedParts(anchorDate, safeTz);

  switch (cadence) {
    case 'hourly': {
      const nextParts = getZonedParts(nextResetDate, safeTz);
      const prevHourUtc = new Date(nextResetDate.getTime() - 3600 * 1000);
      const prevHourParts = getZonedParts(prevHourUtc, safeTz);
      return zonedPartsToUtcDate(
        {
          year: prevHourParts.year,
          month: prevHourParts.month,
          day: prevHourParts.day,
          hour: prevHourParts.hour,
          minute: nextParts.minute,
          second: nextParts.second,
          millisecond: 0,
        },
        safeTz
      );
    }

    case 'daily': {
      const nextParts = getZonedParts(nextResetDate, safeTz);
      const prevDayUtc = new Date(Date.UTC(nextParts.year, nextParts.month - 1, nextParts.day - 1));
      return zonedPartsToUtcDate(
        {
          year: prevDayUtc.getUTCFullYear(),
          month: prevDayUtc.getUTCMonth() + 1,
          day: prevDayUtc.getUTCDate(),
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );
    }

    case 'weekly': {
      const nextParts = getZonedParts(nextResetDate, safeTz);
      const prevWeekUtc = new Date(Date.UTC(nextParts.year, nextParts.month - 1, nextParts.day - 7));
      return zonedPartsToUtcDate(
        {
          year: prevWeekUtc.getUTCFullYear(),
          month: prevWeekUtc.getUTCMonth() + 1,
          day: prevWeekUtc.getUTCDate(),
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );
    }

    case 'monthly': {
      const nextParts = getZonedParts(nextResetDate, safeTz);
      let prevYear = nextParts.year;
      let prevMonth = nextParts.month - 1;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear--;
      }
      const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
      const clampedPrevDay = Math.min(anchorParts.day, daysInPrevMonth);

      return zonedPartsToUtcDate(
        {
          year: prevYear,
          month: prevMonth,
          day: clampedPrevDay,
          hour: anchorParts.hour,
          minute: anchorParts.minute,
          second: anchorParts.second,
          millisecond: 0,
        },
        safeTz
      );
    }

    case 'custom': {
      const intervalHours = customIntervalHours > 0 ? customIntervalHours : 24;
      const intervalMs = intervalHours * 3600 * 1000;
      return new Date(nextResetDate.getTime() - intervalMs);
    }
  }
}

/**
 * Calculates complete reset details for a limit window evaluated at `now`.
 *
 * Accurately determines:
 * - nextResetDate & nextResetIso
 * - activePeriodStart & activePeriodEnd
 * - timeRemainingMs
 * - missedPeriodsCount (since last evaluation or anchor)
 * - isPastDue
 */
export function calculateReset(window: LimitWindow, now: Date = new Date()): ResetCalculationResult {
  const safeTz = getSafeTimeZone(window.timeZone);
  const anchorDate = new Date(window.resetAnchor);
  const customHours = window.customIntervalHours || 24;

  // The reference point from which missed periods are evaluated
  const lastEvaluatedAt = window.lastResetEvaluatedAt
    ? new Date(window.lastResetEvaluatedAt)
    : anchorDate;

  // 1. Identify the upcoming reset strictly after `now`
  let nextResetDate: Date;
  if (now.getTime() < anchorDate.getTime()) {
    nextResetDate = anchorDate;
  } else {
    nextResetDate = getNextResetAfter(now, anchorDate, window.cadence, safeTz, customHours);
  }

  // 2. Identify active period start (previous reset before nextResetDate)
  let activePeriodStart = getPreviousResetBefore(nextResetDate, anchorDate, window.cadence, safeTz, customHours);
  let activePeriodEnd = nextResetDate;

  // If anchor is in the future relative to activePeriodStart, clamp start to anchor
  if (anchorDate.getTime() > activePeriodStart.getTime() && anchorDate.getTime() <= now.getTime()) {
    activePeriodStart = anchorDate;
  }

  // 3. Count missed periods between lastEvaluatedAt and now
  let missedPeriodsCount = 0;
  if (now.getTime() > lastEvaluatedAt.getTime()) {
    // Fast path: if anchor/lastEvaluated is within current active period
    if (lastEvaluatedAt.getTime() >= activePeriodStart.getTime()) {
      missedPeriodsCount = 0;
    } else {
      // Step through resets that occurred after lastEvaluatedAt up to `now`
      let checkDate = lastEvaluatedAt;
      const maxSteps = 1000; // Guard against pathological loops
      let steps = 0;

      while (steps < maxSteps) {
        const resetPoint = getNextResetAfter(checkDate, anchorDate, window.cadence, safeTz, customHours);
        if (resetPoint.getTime() <= now.getTime()) {
          missedPeriodsCount++;
          checkDate = resetPoint;
          steps++;
        } else {
          break;
        }
      }
    }
  }

  const isPastDue = missedPeriodsCount > 0;
  const timeRemainingMs = Math.max(0, nextResetDate.getTime() - now.getTime());

  return {
    nextResetDate,
    nextResetIso: nextResetDate.toISOString(),
    timeRemainingMs,
    isPastDue,
    activePeriodStart,
    activePeriodEnd,
    missedPeriodsCount,
  };
}

/**
 * Checks if a window has crossed any reset boundaries and advances its state.
 * If resets have occurred:
 * - Resets `currentUsed` to 0
 * - Records `lastResetEvaluatedAt = now.toISOString()`
 * - Preserves audit history
 */
export function checkAndAdvanceWindow(
  window: LimitWindow,
  now: Date = new Date()
): WindowAdvanceResult {
  const result = calculateReset(window, now);

  if (result.missedPeriodsCount > 0) {
    return {
      advanced: true,
      window: {
        ...window,
        currentUsed: 0,
        lastResetEvaluatedAt: now.toISOString(),
      },
      missedPeriods: result.missedPeriodsCount,
    };
  }

  return {
    advanced: false,
    window,
    missedPeriods: 0,
  };
}

/**
 * Advances all active windows in an AppState.
 */
export function advanceAllStateWindows(
  windows: LimitWindow[],
  now: Date = new Date()
): { windows: LimitWindow[]; advancedCount: number } {
  let advancedCount = 0;
  const updatedWindows = windows.map((w) => {
    const res = checkAndAdvanceWindow(w, now);
    if (res.advanced) {
      advancedCount++;
      return res.window;
    }
    return w;
  });

  return { windows: updatedWindows, advancedCount };
}

/**
 * Formats a reset countdown string.
 *
 * Returns:
 * - "Overdue" when past due or remaining time is zero
 * - "3d 8h" for days and hours
 * - "4h 12m" for hours and minutes
 * - "45m 30s" or "45m" for minutes
 * - "15s" for seconds
 */
export function formatResetCountdown(
  input: ResetCalculationResult | number | { timeRemainingMs: number; isPastDue?: boolean }
): string {
  let ms: number;
  let isPastDue = false;

  if (typeof input === 'number') {
    ms = input;
    isPastDue = ms <= 0;
  } else {
    ms = input.timeRemainingMs;
    isPastDue = !!input.isPastDue || ms <= 0;
  }

  if (isPastDue) {
    return 'Overdue';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);

  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (totalHours > 0) {
    return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
  }
  if (totalMinutes > 0) {
    return seconds > 0 ? `${totalMinutes}m` : `${totalMinutes}m`;
  }
  return `${Math.max(1, seconds)}s`;
}

/**
 * Formats a date into a human-readable local date and time string with timezone.
 * Example: "Mar 8, 2026, 9:00 AM EDT (America/New_York)"
 */
export function formatLocalDateTime(
  date: Date | string,
  timeZone: string,
  options?: { includeZoneId?: boolean }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const safeTz = getSafeTimeZone(timeZone);

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const formatted = dtf.format(d);
  const includeZoneId = options?.includeZoneId ?? true;

  if (includeZoneId && safeTz !== 'UTC') {
    return `${formatted} (${safeTz})`;
  }
  return formatted;
}
