/**
 * Ingest job: polls active and launch-pending feeds and stores new articles.
 *
 * Deliberately decoupled from puzzle generation and run on its own cadence
 * (e.g. hourly) — its only job is to make sure an article gets captured into
 * `articles` before it scrolls out of the source feed's short item window.
 * Dedup happens at the database via the `(games_topic_id, url)` unique index,
 * so repeated items within one topic are a no-op while cross-listed stories
 * remain available to each topic.
 */

import { db, eq, gamesTopics, or } from "@pontistudios/db";
import type { GamesTopic } from "@pontistudios/db";
import { Readability } from "@mozilla/readability";
import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";

import { getErrorMessage } from "../errors";
import { createLogger } from "../logger.server";

import {
  expireStaleArticles,
  getArticlesNeedingText,
  markExistingArticleTextSucceeded,
  saveArticleTextAttempt,
  upsertArticles,
} from "../data/articles.server";
import {
  MAX_ARTICLE_TEXT_LENGTH,
  MAX_FEED_DESCRIPTION_LENGTH,
  MAX_FEED_TITLE_LENGTH,
  sanitizeFeedText,
} from "./feed-text";
import type { ArticleTextFetchResult, FeedItem, IngestSummary } from "./types";
import { GAME_CATALOG } from "./catalog";
import { getDateKey } from "../puzzle/date";

const logger = createLogger();
const ARTICLE_TEXT_CONCURRENCY = 5;
const ARTICLE_TEXT_TIMEOUT_MS = 8_000;
const MAX_AUTOMATIC_TEXT_ATTEMPTS = 3;

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
  if (!parsed?.rss || typeof parsed.rss !== "object" || !Object.hasOwn(parsed.rss, "channel")) {
    throw new Error("Invalid RSS feed: missing rss/channel");
  }
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

  return feedItems;
}

/** Fetch and extract readable article text; keep the RSS excerpt separate. */
export async function fetchArticleText(url: string): Promise<ArticleTextFetchResult> {
  const fail = (error: string, transient: boolean): ArticleTextFetchResult =>
    ({ ok: false, text: "", status: "failed", error, transient }) as const;
  try {
    const parsedUrl = new URL(url);
    if (!/^https?:$/.test(parsedUrl.protocol)) return fail("invalid_url", false);
    const response = await fetch(parsedUrl, {
      signal: AbortSignal.timeout(ARTICLE_TEXT_TIMEOUT_MS),
    });
    if (!response.ok) {
      return fail(`http_${response.status}`, response.status === 429 || response.status >= 500);
    }
    const text = extractArticleText(await response.text(), url);
    return text ? { ok: true, text, status: "succeeded" } : fail("no_readable_content", false);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";
    return fail(isTimeout ? "timeout" : "fetch_error", true);
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
export async function ingestFeed(
  topic: GamesTopic,
  options: { forceRetry?: boolean } = {},
): Promise<IngestSummary> {
  const runStartedAt = new Date();
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
          imageUrl: item.imageUrl,
          publishedAt: parsePubDate(item.pubDate),
        })),
    );
    const expired = await expireStaleArticles(topic, new Date());
    await markExistingArticleTextSucceeded(topic.id);
    const outcomes = await processArticleText(topic.id, options, runStartedAt);
    const summary = { inserted, scanned: items.length, expired, ...outcomes };
    childLogger.info(
      { event: "[FEED_INGESTED]", ...summary },
      `ingested ${inserted} new article(s) from feed`,
    );
    return summary;
  } catch (err) {
    childLogger.error(
      { event: "[FEED_INGEST_ERROR]", error: getErrorMessage(err) },
      "failed to ingest feed",
    );
    throw err;
  }
}

async function processArticleText(
  topicId: number,
  options: { forceRetry?: boolean },
  runStartedAt: Date,
): Promise<Pick<IngestSummary, "updated" | "extracted" | "emptyBody" | "failed">> {
  const rows = await getArticlesNeedingText(topicId, new Date(), {
    forceRetry: options.forceRetry,
  });
  let cursor = 0;
  let updated = 0;
  let extracted = 0;
  let emptyBody = 0;
  let failed = 0;
  await Promise.all(
    Array.from({ length: Math.min(ARTICLE_TEXT_CONCURRENCY, rows.length) }, async () => {
      while (cursor < rows.length) {
        const article = rows[cursor++];
        if (!article) continue;
        const attemptedAt = new Date();
        const result = article.url
          ? await fetchArticleText(article.url)
          : {
              ok: false as const,
              text: "" as const,
              status: "failed" as const,
              error: "missing_url",
              transient: false,
            };
        const attempts = article.articleTextAttempts + 1;
        let nextAttemptAt: Date | undefined;
        if (!result.ok && result.transient && attempts < MAX_AUTOMATIC_TEXT_ATTEMPTS) {
          nextAttemptAt = new Date(attemptedAt.getTime() + 60 * 60 * 1000 * 4 ** (attempts - 1));
        }
        await saveArticleTextAttempt(article.id, {
          text: result.text,
          status: result.status,
          error: result.ok ? undefined : result.error,
          attemptedAt,
          nextAttemptAt,
        });
        if (result.ok) {
          extracted++;
          if (article.fetchedAt < runStartedAt) updated++;
        } else if (result.error === "no_readable_content") emptyBody++;
        else failed++;
      }
    }),
  );
  return { updated, extracted, emptyBody, failed };
}

/** Ingest active and launch-pending feeds. Returns newly inserted article count. */
export async function ingestAllActiveFeeds(): Promise<IngestSummary> {
  const topics = await db.query.gamesTopics.findMany({
    where: or(eq(gamesTopics.active, true), eq(gamesTopics.activationPending, true)),
  });
  const results = await Promise.all(
    topics.map(async (topic) => {
      try {
        return await ingestFeed(topic);
      } catch {
        return {
          inserted: 0,
          scanned: 0,
          updated: 0,
          extracted: 0,
          emptyBody: 0,
          failed: 1,
          expired: 0,
        };
      }
    }),
  );
  return results.reduce(
    (sum, result) => ({
      inserted: sum.inserted + result.inserted,
      scanned: sum.scanned + result.scanned,
      updated: sum.updated + result.updated,
      extracted: sum.extracted + result.extracted,
      emptyBody: sum.emptyBody + result.emptyBody,
      failed: sum.failed + result.failed,
      expired: sum.expired + result.expired,
    }),
    { inserted: 0, scanned: 0, updated: 0, extracted: 0, emptyBody: 0, failed: 0, expired: 0 },
  );
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
    const existing = await db.query.gamesTopics.findFirst({
      where: or(eq(gamesTopics.slug, entry.slug), eq(gamesTopics.feedUrl, entry.feedUrl)),
    });
    const deferActivation =
      "deferActivationUntilCurrentPuzzle" in entry && entry.deferActivationUntilCurrentPuzzle;
    let hasCurrentPuzzle = false;
    if (deferActivation && existing) {
      const puzzle = await db.query.gamesPuzzles.findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.gamesTopicId, existing.id), eq(table.dateUtc, getDateKey(new Date()))),
        columns: { id: true },
      });
      hasCurrentPuzzle = Boolean(puzzle);
    }
    const setValues = {
      slug: entry.slug,
      name: entry.name,
      feedUrl: entry.feedUrl,
      feedLabel: entry.feedLabel,
      systemPromptPath: "src/prompts/game-generation.md",
      active: deferActivation ? hasCurrentPuzzle : true,
      activationPending: deferActivation ? !hasCurrentPuzzle : false,
    };

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
