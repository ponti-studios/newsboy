import type { Article, GamesTopic } from "@pontistudios/db";

import { getErrorMessage } from "../errors";
import { MAX_FEED_TITLE_LENGTH, sanitizeFeedText } from "../generation/feed-text";
import { fetchFeedItems } from "../generation/ingest.server";
import { recordAdminAction } from "../data/admin-actions.server";
import {
  countArticlesByStatus,
  expireStaleArticles,
  listArticlesForTopic,
  upsertArticles,
} from "../data/articles.server";
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
  rejectionCount: number;
};

function parsePubDate(pubDate: string): Date | undefined {
  const date = new Date(pubDate);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

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
  status?: Article["status"],
): Promise<{ topic: TopicArticleSummary; articles: TopicArticleRow[] } | null> {
  const topic = await getGameBySlug(slug);
  if (!topic) return null;
  const [counts, rows] = await Promise.all([
    countArticlesByStatus(topic.id),
    listArticlesForTopic(topic.id, { ...(status ? { status } : {}), limit: 100 }),
  ]);
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
      rejectionCount: article.rejectionCount,
    })),
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
  { ok: true; inserted: number; scanned: number; expired: number } | { ok: false; error: string }
> {
  try {
    const expired = await expireStaleArticles(topic, new Date());
    const items = await fetchFeedItems(topic.feedUrl);
    const inserted = await upsertArticles(
      topic.id,
      items
        .filter((item) => item.link)
        .map((item) => ({
          url: item.link,
          title: item.title,
          description: item.description || undefined,
          articleText: item.articleText || undefined,
          imageUrl: item.imageUrl,
          publishedAt: parsePubDate(item.pubDate),
        })),
    );
    await recordAdminAction({
      hominemUserId: userId,
      kind: "ingest",
      gamesTopicId: topic.id,
      payload: { slug: topic.slug },
      result: { inserted, scanned: items.length, expired },
    });
    return { ok: true, inserted, scanned: items.length, expired };
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
