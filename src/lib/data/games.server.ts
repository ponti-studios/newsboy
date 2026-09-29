/**
 * Data access for `games_topics` — the per-game configuration row (feed URL,
 * system prompt path, repeat window, etc).
 */

import type { GamesTopic } from "@pontistudios/db";
import { and, db, eq, gamesTopics, inArray, or } from "@pontistudios/db";

export async function getGameBySlug(slug: string): Promise<GamesTopic | null> {
  const row = await db.query.gamesTopics.findFirst({ where: eq(gamesTopics.slug, slug) });
  return row ?? null;
}

export async function getActiveGames(): Promise<GamesTopic[]> {
  return db.query.gamesTopics.findMany({
    where: eq(gamesTopics.active, true),
    orderBy: gamesTopics.name,
  });
}

/** Active topics plus launch-pending topics that need puzzles before activation. */
export async function getGamesForGeneration(topicSlugs: string[] = []): Promise<GamesTopic[]> {
  const eligible = or(eq(gamesTopics.active, true), eq(gamesTopics.activationPending, true));
  return db.query.gamesTopics.findMany({
    where: topicSlugs.length > 0 ? and(eligible, inArray(gamesTopics.slug, topicSlugs)) : eligible,
    orderBy: gamesTopics.name,
  });
}

export async function listTopicFeedHosts(): Promise<string[]> {
  const rows = await db
    .select({ feedUrl: gamesTopics.feedUrl })
    .from(gamesTopics)
    .where(eq(gamesTopics.active, true));
  return rows.flatMap((row) => {
    try {
      return [new URL(row.feedUrl).hostname.replace(/^www\./, "")];
    } catch {
      return [];
    }
  });
}
