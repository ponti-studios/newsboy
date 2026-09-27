/**
 * Data access for `games_attempts` — server-side guess tracking and player
 * history/stats.
 */

import type { GamesAttempt } from "@pontistudios/db";
import {
  and,
  articles,
  count,
  db,
  desc,
  eq,
  gamesAttempts,
  gamesPuzzles,
  gamesTopics,
  gte,
  inArray,
  lte,
  sql,
} from "@pontistudios/db";

import type { PuzzleRecord } from "./types";

export async function loadAttempt(
  userId: string,
  gameId: number,
  dateUtc: string,
): Promise<GamesAttempt | null> {
  const row = await db.query.gamesAttempts.findFirst({
    where: and(
      eq(gamesAttempts.hominemUserId, userId),
      eq(gamesAttempts.gamesTopicId, gameId),
      eq(gamesAttempts.dateUtc, dateUtc),
    ),
  });
  return row ?? null;
}

export async function createAttempt(
  userId: string,
  gameId: number,
  dateUtc: string,
): Promise<GamesAttempt> {
  const [row] = await db
    .insert(gamesAttempts)
    .values({ hominemUserId: userId, gamesTopicId: gameId, dateUtc })
    .returning();
  return row;
}

export async function appendGuess(
  attemptId: number,
  guess: { word: string; states: ("absent" | "correct" | "present")[] },
  status: "playing" | "solved" | "failed",
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(gamesAttempts)
    .set({
      guesses: sql`${gamesAttempts.guesses} || ${JSON.stringify([guess])}::jsonb`,
      guessedAt: sql`${gamesAttempts.guessedAt} || ${JSON.stringify([now])}::jsonb`,
      status,
      updatedAt: new Date(),
    })
    .where(eq(gamesAttempts.id, attemptId));
}

export async function countRecentGuesses(userId: string, windowMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const rows = await db
    .select({ guessedAt: gamesAttempts.guessedAt })
    .from(gamesAttempts)
    .where(
      and(eq(gamesAttempts.hominemUserId, userId), gte(gamesAttempts.updatedAt, new Date(cutoff))),
    );
  let total = 0;
  for (const row of rows) {
    for (const ts of row.guessedAt as string[]) {
      if (ts >= cutoff) total++;
    }
  }
  return total;
}

export async function countAttemptsByDate(
  gameId: number,
  dateKeys: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(dateKeys.map((dateKey) => [dateKey, 0]));
  if (dateKeys.length === 0) return counts;
  const rows = await db
    .select({ dateUtc: gamesAttempts.dateUtc, value: count() })
    .from(gamesAttempts)
    .where(and(eq(gamesAttempts.gamesTopicId, gameId), inArray(gamesAttempts.dateUtc, dateKeys)))
    .groupBy(gamesAttempts.dateUtc);
  for (const row of rows) {
    counts.set(row.dateUtc, row.value);
  }
  return counts;
}

export interface AttemptTopic {
  slug: string;
  name: string;
}

export interface AttemptWithPuzzle {
  attempt: GamesAttempt;
  puzzle: PuzzleRecord;
  topic: AttemptTopic;
}

/**
 * A user's attempts across `gameIds` within `[fromKey, toKey]` (inclusive),
 * newest date first (ties broken by topic name so a day with several topics
 * renders in a stable order), joined with the puzzle each attempt belongs to
 * and the topic it was played under. There's no FK between `gamesAttempts`
 * and `gamesPuzzles` (see the schema's design note), so the join matches on
 * `gameId` + `dateUtc` instead — the same key `loadAttempt`/`createAttempt`
 * already use to correlate the two tables.
 *
 * The history page paginates by calendar week rather than row count, so the
 * caller supplies a 7-day window instead of a page/pageSize offset.
 */
export async function listAttemptsForUserInRange(
  userId: string,
  gameIds: number[],
  { fromKey, toKey }: { fromKey: string; toKey: string },
): Promise<AttemptWithPuzzle[]> {
  if (gameIds.length === 0) return [];

  const rows = await db
    .select({ attempt: gamesAttempts, puzzle: gamesPuzzles, article: articles, topic: gamesTopics })
    .from(gamesAttempts)
    .innerJoin(
      gamesPuzzles,
      and(
        eq(gamesPuzzles.gamesTopicId, gamesAttempts.gamesTopicId),
        eq(gamesPuzzles.dateUtc, gamesAttempts.dateUtc),
      ),
    )
    .innerJoin(articles, eq(gamesPuzzles.articleId, articles.id))
    .innerJoin(gamesTopics, eq(gamesTopics.id, gamesAttempts.gamesTopicId))
    .where(
      and(
        eq(gamesAttempts.hominemUserId, userId),
        inArray(gamesAttempts.gamesTopicId, gameIds),
        gte(gamesAttempts.dateUtc, fromKey),
        lte(gamesAttempts.dateUtc, toKey),
      ),
    )
    .orderBy(desc(gamesAttempts.dateUtc), gamesTopics.name);

  return rows.map((row) => ({
    attempt: row.attempt,
    puzzle: { ...row.puzzle, article: row.article },
    topic: { slug: row.topic.slug, name: row.topic.name },
  }));
}

/**
 * ALL of a user's attempts across `gameIds`, unpaginated, newest date
 * first — used only as input to stats/streak computation (see stats.ts),
 * never rendered directly. Row count is bounded by days-since-launch times
 * topic count for a given user, so a full fetch here is cheap even for a
 * long-lived player.
 */
export async function loadAllAttemptsForUser(
  userId: string,
  gameIds: number[],
): Promise<GamesAttempt[]> {
  if (gameIds.length === 0) return [];
  return db.query.gamesAttempts.findMany({
    where: and(
      eq(gamesAttempts.hominemUserId, userId),
      inArray(gamesAttempts.gamesTopicId, gameIds),
    ),
    orderBy: desc(gamesAttempts.dateUtc),
  });
}
