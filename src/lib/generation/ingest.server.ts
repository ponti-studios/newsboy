/**
 * Ingest job: polls active feeds and stores newly-seen articles.
 *
 * Deliberately decoupled from puzzle generation and run on its own cadence
 * (e.g. hourly) — its only job is to make sure an article gets captured into
 * `articles` before it scrolls out of the source feed's short item window.
 * Dedup happens at the database via the `articles.url` unique constraint, so
 * re-polling a feed that returns the same items is a no-op.
 */

import { db, eq, gamesTopics, or } from "@pontistudios/db";
import type { GamesTopic } from "@pontistudios/db";
import { Readability } from "@mozilla/readability";
import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";

import { getErrorMessage } from "../errors";
import { createLogger } from "../logger.server";

import { upsertArticles } from "../data/articles.server";
import {
  MAX_ARTICLE_TEXT_LENGTH,
  MAX_FEED_DESCRIPTION_LENGTH,
  MAX_FEED_TITLE_LENGTH,
  sanitizeFeedText,
} from "./feed-text";
import type { FeedItem } from "./types";
import { GAME_CATALOG } from "./catalog";

const logger = createLogger();

function extractUrlLikeNode(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = extractUrlLikeNode(entry);
      if (url) return url;
    }
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidates = [
      record["@_url"],
      record.url,
      record["@_href"],
      record.href,
      record["#text"],
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return undefined;
}

export async function fetchFeedItems(feedUrl: string): Promise<FeedItem[]> {
  const res = await fetch(feedUrl);
  if (!res.ok) throw new Error(`Failed to fetch RSS feed: ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const rawItems: unknown = parsed?.rss?.channel?.item ?? [];
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const feedItems = items.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    const description = sanitizeFeedText(i["description"], MAX_FEED_DESCRIPTION_LENGTH);
    const imageUrl =
      extractUrlLikeNode(i["media:content"]) ??
      extractUrlLikeNode(i["media:thumbnail"]) ??
      extractUrlLikeNode(i["enclosure"]);
    return {
      title: sanitizeFeedText(i["title"], MAX_FEED_TITLE_LENGTH),
      link: String(i["link"] ?? ""),
      pubDate: String(i["pubDate"] ?? ""),
      description,
      ...(imageUrl ? { imageUrl } : {}),
    };
  });

  return Promise.all(
    feedItems.map(async (item) => ({
      ...item,
      articleText: item.link ? await fetchArticleText(item.link) : "",
    })),
  );
}

/** Extract readable article text with Mozilla Readability; RSS metadata remains the fallback. */
async function fetchArticleText(url: string): Promise<string> {
  try {
    const parsedUrl = new URL(url);
    if (!/^https?:$/.test(parsedUrl.protocol)) return "";
    const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return "";
    return extractArticleText(await response.text(), url);
  } catch {
    return "";
  }
}

/**
 * Lines matching these patterns are padding, not story content, even though
 * they commonly survive inside Readability's main-content region: related-post
 * links, subscribe/follow CTAs, share prompts, ad/sponsor markers, and social
 * embed captions. Stripping them keeps the LLM focused on the real story
 * instead of getting distracted by the fluff that sites pad articles with.
 */
const BOILERPLATE_LINE_PATTERNS: RegExp[] = [
  /^(related|read more|also read|see also|up next|more from)\b\s*[:-]?/i,
  /^(sign up|subscribe)\b.*(newsletter|updates|alerts)/i,
  /^follow (us|@\w+|reality ?blurred)\b/i,
  /^(share this|click here|tap here|watch|listen)\s*[:-]/i,
  /^(photo|image|credit)s?\s*:/i,
  /^view this post on instagram/i,
  /^advertisement$/i,
  /^sponsored\b/i,
];

/** Drop padding lines (related-post links, CTAs, ad markers) that survive main-content extraction. */
function stripBoilerplateLines(textContent: string): string {
  return textContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !BOILERPLATE_LINE_PATTERNS.some((pattern) => pattern.test(line)))
    .join("\n");
}

/** Pure HTML-to-text boundary so extraction behavior can be tested without HTTP. */
export function extractArticleText(html: string, url: string): string {
  const dom = new JSDOM(html, { url });
  try {
    // Remove obvious chrome before scoring. Readability is intentionally
    // conservative, but sparse pages can otherwise score a navigation label
    // as the article when there is no real story body.
    dom.window.document
      .querySelectorAll("nav, aside, footer, form, script, style, noscript")
      .forEach((element) => element.remove());
    const parsed = new Readability(dom.window.document).parse();
    const storyText = stripBoilerplateLines(parsed?.textContent ?? "");
    return sanitizeFeedText(storyText, MAX_ARTICLE_TEXT_LENGTH);
  } finally {
    dom.window.close();
  }
}

function parsePubDate(pubDate: string): Date | undefined {
  const date = new Date(pubDate);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Fetch one feed and store any articles not already known by url. Returns the count newly inserted. */
export async function ingestFeed(topic: GamesTopic): Promise<number> {
  const childLogger = logger.child({
    operation: "ingestFeed",
    gamesTopicId: topic.id,
    url: topic.feedUrl,
  });
  try {
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
    childLogger.info(
      { event: "[FEED_INGESTED]", itemCount: items.length, insertedCount: inserted },
      `ingested ${inserted} new article(s) from feed`,
    );
    return inserted;
  } catch (err) {
    childLogger.error(
      { event: "[FEED_INGEST_ERROR]", error: getErrorMessage(err) },
      "failed to ingest feed",
    );
    return 0;
  }
}

/** Ingest every active feed. Returns the total number of new articles inserted. */
export async function ingestAllActiveFeeds(): Promise<number> {
  const activeTopics = await db.query.gamesTopics.findMany({ where: eq(gamesTopics.active, true) });
  const results = await Promise.all(activeTopics.map((topic) => ingestFeed(topic)));
  return results.reduce((sum, n) => sum + n, 0);
}

/**
 * Ensure every production topic has its game and feed configuration before
 * ingest runs. Matches an existing row by slug *or* feed URL — `slug` and
 * `feed_url` are both unique, so a plain `ON CONFLICT (slug) DO UPDATE`
 * insert would throw on the `feed_url` constraint if a stale row already
 * holds that URL under a different slug (e.g. left over from a rename).
 * Updating that row in place (slug included) self-heals the drift instead.
 */
export async function ensureGameCatalog(): Promise<void> {
  for (const entry of GAME_CATALOG) {
    const setValues = {
      slug: entry.slug,
      name: entry.name,
      feedUrl: entry.feedUrl,
      feedLabel: entry.feedLabel,
      systemPromptPath: "src/prompts/game-generation.md",
      active: true,
    };

    const existing = await db.query.gamesTopics.findFirst({
      where: or(eq(gamesTopics.slug, entry.slug), eq(gamesTopics.feedUrl, entry.feedUrl)),
    });

    const [feed] = existing
      ? await db
          .update(gamesTopics)
          .set(setValues)
          .where(eq(gamesTopics.id, existing.id))
          .returning({ id: gamesTopics.id })
      : await db
          .insert(gamesTopics)
          .values({ ...setValues, answerLength: 5 })
          .returning({ id: gamesTopics.id });
    if (!feed) throw new Error(`Failed to provision game catalog entry: ${entry.slug}`);
  }
}
