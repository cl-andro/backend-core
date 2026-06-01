// ─── Force Push Happy Hour ──────────────────────────────────
// Three daily 1-hour windows (UTC) calibrated for India, Brazil/EU, and US:
//   15:00 UTC → India primetime (20:30 IST)
//   22:00 UTC → Brazil + EU primetime (19:00 BRT / 23:00 UK)
//   02:00 UTC → US primetime (21:00 EST / 18:00 PST)
// During a window, PvP kill XP is doubled.

export const HAPPY_HOUR_UTC_STARTS = [15, 22, 2] as const;
export const HAPPY_HOUR_DURATION_MS = 60 * 60 * 1000;
export const HAPPY_HOUR_MULTIPLIER = 2;

export interface HappyHourStatus {
  active: boolean;
  multiplier: number;
  /** Milliseconds until the current window ends (0 if not active). */
  endsInMs: number;
  /** Milliseconds until the next window starts (0 if active). */
  startsInMs: number;
}

/** Compute the Happy Hour status for a given timestamp (defaults to now). */
export function getHappyHourStatus(now: Date = new Date()): HappyHourStatus {
  const hour = now.getUTCHours();
  const ms = now.getTime();

  // Find the closest window the current time is inside, if any.
  for (const startHour of HAPPY_HOUR_UTC_STARTS) {
    if (hour === startHour) {
      const windowStart = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        startHour,
        0,
        0,
        0,
      );
      const endsAt = windowStart + HAPPY_HOUR_DURATION_MS;
      return {
        active: true,
        multiplier: HAPPY_HOUR_MULTIPLIER,
        endsInMs: Math.max(0, endsAt - ms),
        startsInMs: 0,
      };
    }
  }

  // Not active — compute when the next window starts.
  let nextStartMs = Infinity;
  for (const startHour of HAPPY_HOUR_UTC_STARTS) {
    for (const dayOffset of [0, 1]) {
      const candidate = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + dayOffset,
        startHour,
        0,
        0,
        0,
      );
      if (candidate > ms && candidate < nextStartMs) {
        nextStartMs = candidate;
      }
    }
  }

  return {
    active: false,
    multiplier: 1,
    endsInMs: 0,
    startsInMs: Math.max(0, nextStartMs - ms),
  };
}

/** Format milliseconds remaining as `MM:SS`. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Format milliseconds as `Hh Mm` for "starts in" labels. */
export function formatStartsIn(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
