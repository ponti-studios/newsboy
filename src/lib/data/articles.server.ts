/**
 * Data access for `articles` — the per-game ingested article inventory that
 * puzzle generation draws from. Normal reuse is prevented by status: once an
 * article is consumed by a puzzle its `status` flips to 'used' and it drops
 * out of future pending selection. Force regeneration explicitly returns
 * source articles from deleted future puzzles to 'pending'.
 */

import type { Article, GamesTopic } from "@pontistudios/db";
import { and, articles, count, db, desc, eq, inArray, lt, sql } from "@pontistudios/db";

/**
 * Insert newly-seen articles for a feed, deduped globally on `url`.
 * Re-ingesting a feed that returns the same items is a no-op.
 */
export async function upsertArticles(
  gamesTopicId: number,
  items: {
    url: string;
    title: string;
    description?: string;
    articleText?: string;
    imageUrl?: string;
    publishedAt?: Date;
  }[],
): Promise<number> {
  if (items.length === 0) return 0;
  const inserted = await db
    .insert(articles)
    .values(
      items.map((item) => ({
        gamesTopicId,
        url: item.url,
        title: item.title,
        description: item.description ?? null,
        articleText: item.articleText ?? null,
        imageUrl: item.imageUrl ?? null,
        publishedAt: item.publishedAt ?? null,
      })),
    )
    .onConflictDoNothing({ target: articles.url })
    .returning({ id: articles.id });
  return inserted.length;
}

/**
 * Pending articles eligible for `game`, most recently published first,
 * capped at `limit`.
 *
 * Newest-first matters: ingestion runs daily and typically adds more
 * candidates than a single day's generation consumes, so a backlog of
 * pending articles accumulates. Ordering oldest-first would keep offering
 * the LLM the same aging cohort ahead of freshly ingested articles until it
 * neared `articleExpiryDays`, producing puzzles built on month-old news.
 * Sorting newest-first ensures each day's game is generated from the
 * freshest available article instead.
 *
 * `publishedAt` is nullable, and Postgres sorts `NULL` first in a plain
 * `DESC` order — that would put undated articles ahead of the freshest
 * dated ones, defeating the point of this ordering. `NULLS LAST` keeps
 * undated articles as a last resort rather than the default pick.
 */
export async function getPendingArticlesForGame(
  game: GamesTopic,
  limit: number,
): Promise<Article[]> {
  return getPendingArticlesForTopics([game.id], limit);
}

/** Same as {@link getPendingArticlesForGame}, but across multiple topics — see its docstring for the newest-first rationale. */
export async function getPendingArticlesForTopics(
  topicIds: number[],
  limit: number,
): Promise<Article[]> {
  if (topicIds.length === 0) return [];
  const rows = await db
    .select({ article: articles })
    .from(articles)
    .where(and(inArray(articles.gamesTopicId, topicIds), eq(articles.status, "pending")))
    .orderBy(sql`${articles.publishedAt} DESC NULLS LAST`)
    .limit(limit);
  return rows.map((r) => r.article);
}

export async function getPendingArticlesByIds(
  articleIds: number[],
  limit: number,
): Promise<Article[]> {
  if (articleIds.length === 0) return [];
  const rows = await db
    .select({ article: articles })
    .from(articles)
    .where(and(inArray(articles.id, articleIds.slice(0, limit)), eq(articles.status, "pending")));
  return rows.map((r) => r.article);
}

export async function markArticleUsed(articleId: number): Promise<void> {
  await db.update(articles).set({ status: "used" }).where(eq(articles.id, articleId));
}

/**
 * Record a failed generation attempt against its source article. Retries
 * with a cap: the article goes back to 'pending' until `rejectionCount`
 * exceeds `maxRejections`, then it's permanently marked 'rejected'.
 */
export async function recordArticleRejection(
  articleId: number,
  reason: string,
  maxRejections: number,
): Promise<void> {
  const row = await db.query.articles.findFirst({ where: eq(articles.id, articleId) });
  if (!row) return;
  const rejectionCount = row.rejectionCount + 1;
  await db
    .update(articles)
    .set({
      rejectionCount,
      rejectionReason: reason,
      status: rejectionCount > maxRejections ? "rejected" : "pending",
    })
    .where(eq(articles.id, articleId));
}

/**
 * Mark pending articles older than `game.articleExpiryDays` as 'expired' so
 * they drop out of future selection. Returns the number expired.
 */
export async function expireStaleArticles(game: GamesTopic, now: Date): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - game.articleExpiryDays);
  const result = await db
    .update(articles)
    .set({ status: "expired" })
    .where(
      and(
        eq(articles.status, "pending"),
        lt(articles.publishedAt, cutoff),
        eq(articles.gamesTopicId, game.id),
      ),
    )
    .returning({ id: articles.id });
  return result.length;
}

export async function countArticlesByStatus(
  topicId: number,
): Promise<Record<Article["status"], number>> {
  const counts: Record<Article["status"], number> = {
    pending: 0,
    used: 0,
    rejected: 0,
    expired: 0,
  };
  const rows = await db
    .select({ status: articles.status, value: count() })
    .from(articles)
    .where(eq(articles.gamesTopicId, topicId))
    .groupBy(articles.status);
  for (const row of rows) {
    counts[row.status] = row.value;
  }
  return counts;
}

export async function listArticlesForTopic(
  topicId: number,
  options: { status?: Article["status"]; limit?: number } = {},
): Promise<Article[]> {
  const filters = [eq(articles.gamesTopicId, topicId)];
  if (options.status) filters.push(eq(articles.status, options.status));
  return db
    .select()
    .from(articles)
    .where(and(...filters))
    .orderBy(desc(articles.publishedAt), desc(articles.id))
    .limit(options.limit ?? 100);
}

/** Count of pending (usable) articles for a game — the ingest backlog depth. */
export async function countPendingArticlesForGame(gameId: number): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(articles)
    .where(and(eq(articles.gamesTopicId, gameId), eq(articles.status, "pending")));
  return rows[0]?.value ?? 0;
}

export type { Article };
