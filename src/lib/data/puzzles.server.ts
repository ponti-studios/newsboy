/**
 * Data access for `games_puzzles` — the published-puzzle table. Puzzles are
 * queried by (gameId, dateUtc), the intended game and date they should be
 * served on. There is no promotion or status lifecycle; puzzles are created
 * for their date and served directly.
 */

import type { GamesTopic } from "@pontistudios/db";
import {
  and,
  articles,
  count,
  db,
  desc,
  eq,
  gamesPuzzles,
  gte,
  inArray,
  lte,
  sql,
} from "@pontistudios/db";

import { addDaysToDateKey, buildDateRange, getDateKey } from "../puzzle/date";
import type { PuzzleRecord } from "./types";

/**
 * Collect all unique normalized answers from this game's repeat-cooldown
 * window (`game.repeatWindowDays` days back from `date`).
 *
 * Used during puzzle generation to avoid repeating an answer that was used
 * too recently within the same game.
 */
export async function getRecentAnswers(game: GamesTopic, date: Date): Promise<Set<string>> {
  const cutoff = new Date(date);
  cutoff.setUTCDate(cutoff.getUTCDate() - game.repeatWindowDays);
  const cutoffDateValue = getDateKey(cutoff);
  const rows = await db
    .select({ answer: gamesPuzzles.answer })
    .from(gamesPuzzles)
    .where(and(eq(gamesPuzzles.gamesTopicId, game.id), gte(gamesPuzzles.dateUtc, cutoffDateValue)));
  return new Set(rows.map((r) => r.answer));
}

/**
 * Collect all unique normalized answers ever stored for this game.
 *
 * Used both during generation (to avoid clashes with existing inventory) and
 * during word validation (to allow stored puzzle answers as valid guesses).
 */
export async function getStoredAnswers(gameId: number): Promise<Set<string>> {
  const rows = await db
    .select({ answer: gamesPuzzles.answer })
    .from(gamesPuzzles)
    .where(eq(gamesPuzzles.gamesTopicId, gameId));
  return new Set(rows.map((r) => r.answer));
}

/**
 * Find the puzzle for a given game and date key, preferring the most
 * recently created record if multiple exist, joined with the article it
 * was generated from.
 *
 * Returns `null` if no puzzle exists for that date.
 */
export async function loadPuzzleForDate(
  gameId: number,
  dateKey: string,
): Promise<PuzzleRecord | null> {
  const rows = await db
    .select({ puzzle: gamesPuzzles, article: articles })
    .from(gamesPuzzles)
    .innerJoin(articles, eq(gamesPuzzles.articleId, articles.id))
    .where(and(eq(gamesPuzzles.gamesTopicId, gameId), eq(gamesPuzzles.dateUtc, dateKey)))
    .orderBy(desc(gamesPuzzles.createdAt))
    .limit(1);
  const row = rows[0];
  return row ? { ...row.puzzle, article: row.article } : null;
}

/**
 * Most-recently-created puzzle for a game, optionally bounded to a calendar
 * date. The unbounded form is used by tooling; active-puzzle fallback always
 * supplies `dateKey` so future inventory cannot be served.
 */
export async function loadMostRecentPuzzle(
  gameId: number,
  dateKey?: string,
): Promise<PuzzleRecord | null> {
  const rows = await db
    .select({ puzzle: gamesPuzzles, article: articles })
    .from(gamesPuzzles)
    .innerJoin(articles, eq(gamesPuzzles.articleId, articles.id))
    .where(
      dateKey
        ? and(eq(gamesPuzzles.gamesTopicId, gameId), lte(gamesPuzzles.dateUtc, dateKey))
        : eq(gamesPuzzles.gamesTopicId, gameId),
    )
    .orderBy(desc(gamesPuzzles.createdAt))
    .limit(1);
  const row = rows[0];
  return row ? { ...row.puzzle, article: row.article } : null;
}

/**
 * Count the number of puzzle records for `gameId` in the inventory window
 * that starts one day after `fromDateKey` and extends `days` days forward.
 *
 * Used by health checks to verify adequate future puzzle coverage.
 */
export async function countInventoryForRange(
  gameId: number,
  fromDateKey: string,
  days: number,
): Promise<number> {
  const startKey = addDaysToDateKey(fromDateKey, 1);
  if (!startKey) return 0;
  const dateKeys = buildDateRange(startKey, { daysAhead: days });
  if (dateKeys.length === 0) return 0;
  const [row] = await db
    .select({ value: count() })
    .from(gamesPuzzles)
    .where(and(eq(gamesPuzzles.gamesTopicId, gameId), inArray(gamesPuzzles.dateUtc, dateKeys)));
  return row?.value ?? 0;
}

/**
 * Return the `date_utc` values that already have a puzzle for `gameId` in
 * [fromKey, toKey].
 *
 * Used by the generate script to determine which dates need gap-filling
 * without an inline Drizzle query.
 */
export async function getExistingDateKeys(
  gameId: number,
  fromKey: string,
  toKey: string,
): Promise<string[]> {
  const rows = await db
    .select({ dateUtc: gamesPuzzles.dateUtc })
    .from(gamesPuzzles)
    .where(
      and(
        eq(gamesPuzzles.gamesTopicId, gameId),
        gte(gamesPuzzles.dateUtc, fromKey),
        lte(gamesPuzzles.dateUtc, toKey),
      ),
    );
  return rows.map((r) => r.dateUtc);
}

/**
 * Return the `(gamesTopicId, dateUtc)` pairs that have a puzzle across
 * `gameIds` in [fromKey, toKey] — the cross-topic counterpart of
 * `getExistingDateKeys`, used by the unified history page to find playable,
 * unplayed puzzles across every topic at once (a date key alone isn't
 * enough once more than one topic can publish on the same day).
 */
export async function getExistingPuzzlesAcrossTopics(
  gameIds: number[],
  fromKey: string,
  toKey: string,
): Promise<{ gameId: number; dateUtc: string }[]> {
  if (gameIds.length === 0) return [];
  const rows = await db
    .select({ gameId: gamesPuzzles.gamesTopicId, dateUtc: gamesPuzzles.dateUtc })
    .from(gamesPuzzles)
    .where(
      and(
        inArray(gamesPuzzles.gamesTopicId, gameIds),
        gte(gamesPuzzles.dateUtc, fromKey),
        lte(gamesPuzzles.dateUtc, toKey),
      ),
    );
  return rows;
}

/** Every published puzzle date for a topic, oldest first. */
export async function listAllPuzzleDateKeys(gameId: number): Promise<string[]> {
  const rows = await db
    .select({ dateUtc: gamesPuzzles.dateUtc })
    .from(gamesPuzzles)
    .where(eq(gamesPuzzles.gamesTopicId, gameId))
    .orderBy(gamesPuzzles.dateUtc);
  return rows.map((r) => r.dateUtc);
}

/**
 * Delete puzzles for `gameId` whose `dateUtc` is in `[fromKey, toKey]` and
 * return their source articles to the pending inventory. Articles still
 * referenced by another puzzle are left untouched.
 */
export async function deletePuzzlesInRange(
  gameId: number,
  fromKey: string,
  toKey: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .select({ articleId: gamesPuzzles.articleId })
      .from(gamesPuzzles)
      .where(
        and(
          eq(gamesPuzzles.gamesTopicId, gameId),
          gte(gamesPuzzles.dateUtc, fromKey),
          lte(gamesPuzzles.dateUtc, toKey),
        ),
      );

    if (deleted.length === 0) return 0;

    const result = await tx
      .delete(gamesPuzzles)
      .where(
        and(
          eq(gamesPuzzles.gamesTopicId, gameId),
          gte(gamesPuzzles.dateUtc, fromKey),
          lte(gamesPuzzles.dateUtc, toKey),
        ),
      )
      .returning({ id: gamesPuzzles.id });

    const deletedArticleIds = [...new Set(deleted.map((puzzle) => puzzle.articleId))];
    const remaining = await tx
      .select({ articleId: gamesPuzzles.articleId })
      .from(gamesPuzzles)
      .where(inArray(gamesPuzzles.articleId, deletedArticleIds));
    const remainingArticleIds = new Set(remaining.map((puzzle) => puzzle.articleId));
    const reusableArticleIds = deletedArticleIds.filter(
      (articleId) => !remainingArticleIds.has(articleId),
    );

    if (reusableArticleIds.length > 0) {
      await tx
        .update(articles)
        .set({ status: "pending" })
        .where(inArray(articles.id, reusableArticleIds));
    }

    return result.length;
  });
}

/** Earliest `dateUtc` with a puzzle for `gameId`, or `null` if none exist yet. */
export async function getEarliestPuzzleDateKey(gameId: number): Promise<string | null> {
  const rows = await db
    .select({ dateUtc: gamesPuzzles.dateUtc })
    .from(gamesPuzzles)
    .where(eq(gamesPuzzles.gamesTopicId, gameId))
    .orderBy(gamesPuzzles.dateUtc)
    .limit(1);
  return rows[0]?.dateUtc ?? null;
}

/** Earliest `dateUtc` with a puzzle across `gameIds`, or `null` if none exist yet. */
export async function getEarliestPuzzleDateKeyAcrossTopics(
  gameIds: number[],
): Promise<string | null> {
  if (gameIds.length === 0) return null;
  const rows = await db
    .select({ dateUtc: gamesPuzzles.dateUtc })
    .from(gamesPuzzles)
    .where(inArray(gamesPuzzles.gamesTopicId, gameIds))
    .orderBy(gamesPuzzles.dateUtc)
    .limit(1);
  return rows[0]?.dateUtc ?? null;
}

export async function backfillPuzzlePublishedAt(): Promise<number> {
  const result = await db
    .update(gamesPuzzles)
    .set({ publishedAt: sql`${gamesPuzzles.createdAt}` })
    .where(sql`${gamesPuzzles.publishedAt} IS NULL`)
    .returning({ id: gamesPuzzles.id });
  return result.length;
}

export type { GamesPuzzle } from "@pontistudios/db";
