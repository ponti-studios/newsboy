/**
 * Data access for `games_topics` — the per-game configuration row (feed URL,
 * system prompt path, repeat window, etc).
 */

import type { GamesTopic } from "@pontistudios/db";
import { db, eq, gamesTopics } from "@pontistudios/db";

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
