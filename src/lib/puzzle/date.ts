const DATE_KEY_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

// `en-CA` produces the stable `YYYY-MM-DD` order used by our date keys;
// the locale is intentional and is not a timezone choice.
export const DATE_KEY_LOCALE = "en-CA";

export function getDateKey(date: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat(DATE_KEY_LOCALE, { timeZone }).format(date);
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY_FORMAT.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value || !isDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/** Convert a date key to a local calendar Date for a date-picker UI. */
export function dateKeyToLocalDate(value: string): Date | null {
  const date = parseDate(value);
  if (!date) return null;

  const localDate = new Date(0);
  localDate.setHours(0, 0, 0, 0);
  localDate.setFullYear(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return localDate;
}

/** Convert a date-picker's local calendar Date back to a date key. */
export function localDateToDateKey(date: Date | null | undefined): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${month}-${day}`;
}

export function addDaysToDateKey(value: string, days: number): string | null {
  const date = parseDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return getDateKey(date);
}

/** Whole days between two date keys (`toKey` - `fromKey`), or `null` if either is malformed. */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number | null {
  const from = parseDate(fromKey);
  const to = parseDate(toKey);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Build a contiguous array of date keys from `startKey` forward.
 *
 * - If `daysAhead` is set, returns exactly that many keys.
 * - If `endKey` is set, returns all keys from start through endKey (inclusive).
 * - If neither is set, returns a single-element array with `startKey`.
 */
export function buildDateRange(
  startKey: string,
  options: { endKey?: string; daysAhead?: number } = {},
): string[] {
  if (!isDateKey(startKey)) return [];

  const dates: string[] = [];
  let current = startKey;

  if (options.daysAhead !== undefined) {
    for (let i = 0; i < options.daysAhead; i++) {
      dates.push(current);
      const next = addDaysToDateKey(current, 1);
      if (!next) break;
      current = next;
    }
    return dates;
  }

  if (options.endKey) {
    const span = daysBetweenDateKeys(startKey, options.endKey);
    if (span === null || span < 0) {
      return [];
    }
    while (true) {
      dates.push(current);
      if (current === options.endKey) break;
      const next = addDaysToDateKey(current, 1);
      if (!next) break;
      current = next;
    }
    return dates;
  }

  return [startKey];
}
