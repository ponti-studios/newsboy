import {
  addDaysToDateKey,
  buildDateRange,
  daysBetweenDateKeys,
  getDateKey,
  isDateKey,
} from "../puzzle/date";

export const PRIMARY_PLAYER_TZ = "America/Los_Angeles";
export const MAX_GENERATE_SPAN_DAYS = 14;

export function liveDateKeys(now = new Date()): Set<string> {
  return new Set([getDateKey(now, "UTC"), getDateKey(now, PRIMARY_PLAYER_TZ)]);
}

export function isLiveDate(dateKey: string, now = new Date()): boolean {
  return liveDateKeys(now).has(dateKey);
}

export type GenerateRangeInput = {
  force: boolean;
  daysAhead: number;
  from?: string;
  to?: string;
  todayKey: string;
  now?: Date;
  /**
   * Dev-only escape hatch: when the target database is a local scratch
   * database (localhost), allow ranges that start on or before today's live
   * dates so prompts/models can be rehearsed against today's puzzle.
   * Never set from CI — production always leaves this false.
   */
  allowLiveDates?: boolean;
};

export type GenerateRange =
  | {
      ok: true;
      fromKey: string;
      toKey: string;
      dateKeys: string[];
      force: boolean;
      allowLiveDates: boolean;
    }
  | { ok: false; error: string };

/**
 * True when DATABASE_URL points at a loopback host — the only databases this
 * script ever runs against that are safe to mutate without live-date
 * protection. Everywhere else (Railway, CI, remote hosts) returns false.
 */
export function isDisposableDatabase(
  databaseUrl: string = process.env.DATABASE_URL ?? "",
): boolean {
  try {
    const host = new URL(databaseUrl).hostname;
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(host);
  } catch {
    return false;
  }
}

export function resolveGenerateRange(input: GenerateRangeInput): GenerateRange {
  if ((input.from === undefined) !== (input.to === undefined)) {
    return { ok: false, error: "--from and --to must be provided together" };
  }

  if (input.from !== undefined && input.to !== undefined) {
    const from = input.from;
    const to = input.to;
    if (!isDateKey(from) || !isDateKey(to)) {
      return { ok: false, error: "--from and --to must be YYYY-MM-DD" };
    }
    const span = daysBetweenDateKeys(from, to);

    if (span === null || span < 0) {
      return { ok: false, error: "--from must be on or before --to" };
    }

    if (span + 1 > MAX_GENERATE_SPAN_DAYS) {
      return { ok: false, error: `range cannot exceed ${MAX_GENERATE_SPAN_DAYS} days` };
    }

    const live = liveDateKeys(input.now);
    const liveKeys = [...live].sort();
    const latestLive = liveKeys[liveKeys.length - 1];

    if (!input.allowLiveDates && from <= latestLive) {
      const earliestFrom = addDaysToDateKey(latestLive, 1);
      return {
        ok: false,
        error: `range must start after the live dates (today: ${liveKeys.join(" / ")}); --from=${from} is too early — use --from=${earliestFrom} or later`,
      };
    }

    return {
      ok: true,
      fromKey: from,
      toKey: to,
      dateKeys: buildDateRange(from, { endKey: to }),
      force: input.force,
      allowLiveDates: input.allowLiveDates ?? false,
    };
  }

  if (
    !Number.isInteger(input.daysAhead) ||
    input.daysAhead < 1 ||
    input.daysAhead > MAX_GENERATE_SPAN_DAYS
  ) {
    return {
      ok: false,
      error: `--days-ahead must be an integer from 1 to ${MAX_GENERATE_SPAN_DAYS}`,
    };
  }

  const fromKey = addDaysToDateKey(input.todayKey, 1);
  if (!fromKey) return { ok: false, error: "failed to compute tomorrow from todayKey" };

  const dateKeys = buildDateRange(fromKey, { daysAhead: input.daysAhead });
  const toKey = dateKeys[dateKeys.length - 1];
  if (!toKey) return { ok: false, error: "empty generate range" };

  return {
    ok: true,
    fromKey,
    toKey,
    dateKeys,
    force: input.force,
    allowLiveDates: input.allowLiveDates ?? false,
  };
}
