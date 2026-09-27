/**
 * Pure aggregation over a user's game attempts — no DB access, so this
 * is trivially unit-testable against hand-built fixtures. Callers (see
 * history.server.ts) are responsible for fetching the full, unpaginated
 * attempt list this operates on.
 */
import { addDaysToDateKey, buildDateRange } from "./date";

export interface PuzzleHistoryStats {
  gamesPlayed: number;
  gamesSolved: number;
  /** 0..1. 0 when gamesPlayed is 0. */
  winRate: number;
  currentStreak: number;
  maxStreak: number;
  /** Guess count at solve, solved attempts only. */
  guessDistribution: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
}

export type StatsAttempt = {
  dateUtc: string;
  status: "playing" | "solved" | "failed";
  guesses: readonly unknown[];
};

/**
 * Collapse possibly-multiple attempts on the same date (one per topic, once
 * a user can play several topics per day) into a single day-status entry,
 * for streak/mosaic logic that's inherently one-cell-per-day. A day only
 * counts as "solved" once every topic played that day is solved; a topic
 * still `"playing"` keeps the whole day open; otherwise the day reads as
 * "failed" — the same all-or-nothing rule a single-topic streak already
 * applied to guesses within one puzzle, just lifted to the day level.
 */
function aggregateByDate(attempts: readonly StatsAttempt[]): StatsAttempt[] {
  const byDate = new Map<string, StatsAttempt[]>();
  for (const attempt of attempts) {
    const dayAttempts = byDate.get(attempt.dateUtc) ?? [];
    dayAttempts.push(attempt);
    byDate.set(attempt.dateUtc, dayAttempts);
  }

  return [...byDate.entries()].map(([dateUtc, dayAttempts]) => {
    const status = dayAttempts.some((a) => a.status === "playing")
      ? "playing"
      : dayAttempts.every((a) => a.status === "solved")
        ? "solved"
        : "failed";
    const guesses = dayAttempts.reduce((longest, a) =>
      a.guesses.length > longest.guesses.length ? a : longest,
    ).guesses;
    return { dateUtc, status, guesses };
  });
}

function emptyDistribution(): PuzzleHistoryStats["guessDistribution"] {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
}

/**
 * Streak rule: sorted newest-first, a streak only continues across
 * calendar-contiguous dates (no gap — an unattempted puzzle date isn't in
 * `attempts` at all, since anonymous/unplayed dates never get a row) where
 * every entry is `status === "solved"`. A failed or still-`"playing"` entry
 * breaks it, same as a gap does.
 */
export function computeHistoryStats(attempts: readonly StatsAttempt[]): PuzzleHistoryStats {
  const gamesPlayed = attempts.length;
  const guessDistribution = emptyDistribution();
  let gamesSolved = 0;

  for (const attempt of attempts) {
    if (attempt.status !== "solved") continue;
    gamesSolved++;
    const guessCount = attempt.guesses.length;
    if (guessCount >= 1 && guessCount <= 6) {
      guessDistribution[guessCount as 1 | 2 | 3 | 4 | 5 | 6]++;
    }
  }

  const winRate = gamesPlayed === 0 ? 0 : gamesSolved / gamesPlayed;

  const sorted = aggregateByDate(attempts).sort((a, b) =>
    a.dateUtc < b.dateUtc ? 1 : a.dateUtc > b.dateUtc ? -1 : 0,
  );

  let currentStreak = 0;
  for (let i = 0; i < sorted.length; i++) {
    const attempt = sorted[i];
    if (attempt.status !== "solved") break;
    if (i > 0 && addDaysToDateKey(sorted[i - 1].dateUtc, -1) !== attempt.dateUtc) break;
    currentStreak++;
  }

  let maxStreak = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    const attempt = sorted[i];
    const contiguous = i === 0 || addDaysToDateKey(sorted[i - 1].dateUtc, -1) === attempt.dateUtc;
    if (attempt.status === "solved" && contiguous) {
      run++;
    } else if (attempt.status === "solved") {
      run = 1;
    } else {
      run = 0;
    }
    maxStreak = Math.max(maxStreak, run);
  }

  return { gamesPlayed, gamesSolved, winRate, currentStreak, maxStreak, guessDistribution };
}

export type WeekGridCellStatus = "solved" | "failed" | "playing" | "unplayed" | "no-puzzle";

export interface WeekGridCell {
  /** YYYY-MM-DD */
  dateKey: string;
  status: WeekGridCellStatus;
  /** Guess count at solve (1-6). Only meaningful when status is "solved". */
  guessCount: number | null;
}

export interface WeekGridRow {
  topicSlug: string;
  topicName: string;
  /** One cell per calendar day in the requested range, oldest first. */
  cells: WeekGridCell[];
}

export interface WeekGridTopic {
  id: number;
  slug: string;
  name: string;
}

export interface WeekGridAttempt {
  topicId: number;
  /** YYYY-MM-DD */
  dateUtc: string;
  status: "playing" | "solved" | "failed";
  guesses: readonly unknown[];
}

export interface WeekGridPuzzleExistence {
  topicId: number;
  /** YYYY-MM-DD */
  dateUtc: string;
}

/**
 * One row per topic, one cell per calendar day in `[fromKey, toKey]`
 * (inclusive) — the per-topic counterpart of the old single-track mosaic,
 * sized to line up with the weekly puzzle list rather than a full year. A
 * cell reads "no-puzzle" when the topic simply didn't publish that day (vs.
 * "unplayed", where a puzzle existed but the player skipped it), so a
 * caller can render both states distinctly instead of conflating them.
 */
export function buildWeekGrid(
  topics: readonly WeekGridTopic[],
  attempts: readonly WeekGridAttempt[],
  existingPuzzles: readonly WeekGridPuzzleExistence[],
  { fromKey, toKey }: { fromKey: string; toKey: string },
): WeekGridRow[] {
  const dateKeys = buildDateRange(fromKey, { endKey: toKey });
  const attemptByKey = new Map(attempts.map((a) => [`${a.topicId}:${a.dateUtc}`, a]));
  const existingKeys = new Set(existingPuzzles.map((p) => `${p.topicId}:${p.dateUtc}`));

  return topics.map((topic) => ({
    topicSlug: topic.slug,
    topicName: topic.name,
    cells: dateKeys.map((dateKey) => {
      const key = `${topic.id}:${dateKey}`;
      const attempt = attemptByKey.get(key);
      if (attempt) {
        if (attempt.status === "solved") {
          return { dateKey, status: "solved" as const, guessCount: attempt.guesses.length };
        }
        if (attempt.status === "failed") {
          return { dateKey, status: "failed" as const, guessCount: null };
        }
        return { dateKey, status: "playing" as const, guessCount: null };
      }
      if (!existingKeys.has(key)) {
        return { dateKey, status: "no-puzzle" as const, guessCount: null };
      }
      return { dateKey, status: "unplayed" as const, guessCount: null };
    }),
  }));
}
