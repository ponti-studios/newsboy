import type { Article, GamesTopic } from "@pontistudios/db";
import { and, articles, count, db, desc, eq, ilike, or, sql } from "@pontistudios/db";

import { getErrorMessage } from "../errors";
import { MAX_FEED_TITLE_LENGTH, sanitizeFeedText } from "../generation/feed-text";
import { ingestFeed } from "../generation/ingest.server";
import { recordAdminAction } from "../data/admin-actions.server";
import { countArticlesByStatus } from "../data/articles.server";
import { getActiveGames, getGameBySlug } from "../data/games.server";

export type TopicArticleSummary = {
  id: number;
  slug: string;
  name: string;
  feedUrl: string;
  feedLabel: string;
  active: boolean;
  counts: Record<Article["status"], number>;
};

export type TopicArticleRow = {
  id: number;
  title: string;
  url: string;
  status: Article["status"];
  publishedAt: string | null;
  articleTextLength: number;
  articleTextStatus: "pending" | "succeeded" | "failed";
  articleTextAttempts: number;
  articleTextError: string | null;
  rejectionCount: number;
};

export async function loadAdminTopics(): Promise<TopicArticleSummary[]> {
  const topics = await getActiveGames();
  return Promise.all(
    topics.map(async (topic) => ({
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
      feedUrl: topic.feedUrl,
      feedLabel: topic.feedLabel,
      active: topic.active,
      counts: await countArticlesByStatus(topic.id),
    })),
  );
}

export async function loadAdminTopicArticles(
  slug: string,
  options: { status?: Article["status"]; query?: string; page?: number } = {},
): Promise<{
  topic: TopicArticleSummary;
  articles: TopicArticleRow[];
  total: number;
  page: number;
} | null> {
  const topic = await getGameBySlug(slug);
  if (!topic) return null;
  const requestedPage = Math.max(0, options.page ?? 0);
  const query = options.query?.trim().slice(0, 100) ?? "";
  const filters = [eq(articles.gamesTopicId, topic.id)];
  if (options.status) filters.push(eq(articles.status, options.status));
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push(or(ilike(articles.title, pattern), ilike(articles.url, pattern))!);
  }
  const where = and(...filters);
  const pageSize = 50;
  const [counts, [totalRow]] = await Promise.all([
    countArticlesByStatus(topic.id),
    db.select({ value: count() }).from(articles).where(where),
  ]);
  const total = totalRow?.value ?? 0;
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(total / pageSize) - 1));
  const rows = await db
    .select()
    .from(articles)
    .where(where)
    .orderBy(sql`${articles.publishedAt} DESC NULLS LAST`, desc(articles.id))
    .limit(pageSize)
    .offset(page * pageSize);
  return {
    topic: {
      id: topic.id,
      slug: topic.slug,
      name: topic.name,
      feedUrl: topic.feedUrl,
      feedLabel: topic.feedLabel,
      active: topic.active,
      counts,
    },
    articles: rows.map((article) => ({
      id: article.id,
      title: sanitizeFeedText(article.title, MAX_FEED_TITLE_LENGTH),
      url: article.url,
      status: article.status,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      articleTextLength: article.articleText?.length ?? 0,
      articleTextStatus: article.articleTextStatus,
      articleTextAttempts: article.articleTextAttempts,
      articleTextError: article.articleTextError,
      rejectionCount: article.rejectionCount,
    })),
    total,
    page,
  };
}

export async function refreshTopicArticlesBySlug(slug: string, userId: string) {
  const topic = await getGameBySlug(slug);
  if (!topic) return { ok: false as const, error: "Topic not found" };
  return refreshTopicArticles(topic, userId);
}

export async function refreshTopicArticles(
  topic: GamesTopic,
  userId: string,
): Promise<
  | {
      ok: true;
      inserted: number;
      scanned: number;
      updated: number;
      extracted: number;
      emptyBody: number;
      failed: number;
      expired: number;
    }
  | { ok: false; error: string }
> {
  try {
    const result = await ingestFeed(topic, { forceRetry: true });
    await recordAdminAction({
      hominemUserId: userId,
      kind: "ingest",
      gamesTopicId: topic.id,
      payload: { slug: topic.slug },
      result: { ...result },
    });
    return { ok: true, ...result };
  } catch (error) {
    await recordAdminAction({
      hominemUserId: userId,
      kind: "ingest",
      gamesTopicId: topic.id,
      payload: { slug: topic.slug },
      result: { error: getErrorMessage(error) },
    });
    return { ok: false, error: getErrorMessage(error) };
  }
}
