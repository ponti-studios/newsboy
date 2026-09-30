import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, db, eq, gamesPuzzles, gamesTopics } from "@pontistudios/db";
import { cleanAll } from "../../data/test-db";
import { getArticlesNeedingText } from "../data/articles.server";
import { GAME_CATALOG } from "../generation/catalog";
import {
  ensureGameCatalog,
  extractArticleText,
  fetchArticleText,
  fetchFeedItems,
  ingestFeed,
} from "../generation/ingest.server";
import { getDateKey } from "../puzzle/date";

describe("fetchFeedItems", () => {
  it("normalizes RSS markup and keeps the feed summary separate from page extraction", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            `<rss><channel><item><title>Tea &amp; Drama</title><link>https://realityblurred.com/story</link><pubDate>not-a-date</pubDate><description><![CDATA[<p>Line one</p>\u000BLine two</b>]]></description></item></channel></rss>`,
            { status: 200 },
          ),
        )
    );

    await expect(fetchFeedItems("https://realityblurred.com/feed")).resolves.toEqual([
      {
        title: "Tea & Drama",
        link: "https://realityblurred.com/story",
        pubDate: "not-a-date",
        description: "Line one Line two",
      },
    ]);
  });

  it("returns an empty list when an RSS channel has no items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<rss><channel /></rss>")));

    await expect(fetchFeedItems("https://realityblurred.com/feed")).resolves.toEqual([]);
  });

  it("raises a feed-level error when the RSS request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 502 })));
    await expect(fetchFeedItems("https://realityblurred.com/feed")).rejects.toThrow(
      "Failed to fetch RSS feed: 502",
    );
    vi.unstubAllGlobals();
  });

  it("raises a feed-level error when the response is not an RSS channel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>maintenance</html>")));
    await expect(fetchFeedItems("https://realityblurred.com/feed")).rejects.toThrow(
      "Invalid RSS feed: missing rss/channel",
    );
    vi.unstubAllGlobals();
  });
});

describe("fetchArticleText", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("extracts readable article text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><body><article><p>The complete story body is here.</p></article></body></html>"),
      ),
    );
    await expect(fetchArticleText("https://example.com/story")).resolves.toEqual({
      ok: true,
      status: "succeeded",
      text: "The complete story body is here.",
    });
  });

  it.each([
    ["HTTP failures", new Response("blocked", { status: 403 }), "http_403"],
    ["pages without readable content", new Response("<html><body><nav>Only nav</nav></body></html>"), "no_readable_content"],
  ])("reports %s", async (_label, response, error) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(fetchArticleText("https://example.com/story")).resolves.toMatchObject({
      ok: false,
      status: "failed",
      error,
    });
  });

  it("classifies timeout and invalid URL failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));
    await expect(fetchArticleText("https://example.com/story")).resolves.toMatchObject({
      ok: false,
      error: "timeout",
      transient: true,
    });
    await expect(fetchArticleText("file:///etc/passwd")).resolves.toMatchObject({
      ok: false,
      error: "invalid_url",
      transient: false,
    });
  });
});

describe("ensureGameCatalog", () => {
  beforeEach(async () => {
    await cleanAll();
  });

  afterEach(async () => {
    await cleanAll();
  });

  it("provisions every catalog entry from an empty table", async () => {
    await ensureGameCatalog();

    const rows = await db.query.gamesTopics.findMany();
    expect(rows.map((row) => row.slug).sort()).toEqual(
      GAME_CATALOG.map((entry) => entry.slug).sort(),
    );
  });

  it("includes the BBC topics with their requested names and feeds", () => {
    const bbcTopics = GAME_CATALOG.filter(
      (entry) => entry.slug !== "reality" && entry.feedLabel.startsWith("BBC"),
    );

    expect(
      bbcTopics.map(({ slug, name, feedUrl, feedLabel }) => ({ slug, name, feedUrl, feedLabel })),
    ).toEqual([
      {
        slug: "politics",
        name: "Politics",
        feedUrl: "https://feeds.bbci.co.uk/news/politics/rss.xml",
        feedLabel: "BBC Politics",
      },
      {
        slug: "business",
        name: "Business",
        feedUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
        feedLabel: "BBC Business",
      },
      {
        slug: "science",
        name: "Science",
        feedUrl: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
        feedLabel: "BBC Science & Environment",
      },
      {
        slug: "world",
        name: "World News",
        feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml",
        feedLabel: "BBC World",
      },
      {
        slug: "health",
        name: "Health",
        feedUrl: "https://feeds.bbci.co.uk/news/health/rss.xml",
        feedLabel: "BBC Health",
      },
    ]);
  });

  it("keeps new BBC topics pending until a puzzle exists for the current UTC date", async () => {
    await ensureGameCatalog();
    const politics = await db.query.gamesTopics.findFirst({
      where: (table, { eq }) => eq(table.slug, "politics"),
    });
    expect(politics).toMatchObject({ active: false, activationPending: true });

    const [article] = await db
      .insert(articles)
      .values({ gamesTopicId: politics!.id, url: "https://example.com/today", title: "Today" })
      .returning();
    await db.insert(gamesPuzzles).values({
      gamesTopicId: politics!.id,
      articleId: article!.id,
      dateUtc: getDateKey(new Date()),
      answer: "BRAVO",
      answerType: "storyline",
      normalizedAnswer: "BRAVO",
      clue: "A current puzzle",
      detail: "Ready to play",
    });

    await ensureGameCatalog();

    const activated = await db.query.gamesTopics.findFirst({
      where: (table, { eq }) => eq(table.slug, "politics"),
    });
    expect(activated).toMatchObject({ active: true, activationPending: false });
  });

  it("renames a stale row that already holds a catalog feed URL under a different slug", async () => {
    const reality = GAME_CATALOG[0];
    await db.insert(gamesTopics).values({
      slug: "reality",
      name: "Old Name",
      feedUrl: reality.feedUrl,
      feedLabel: "Old Label",
      systemPromptPath: "old/prompt.md",
      active: false,
    });

    await ensureGameCatalog();

    const rows = await db.query.gamesTopics.findMany();
    expect(rows).toHaveLength(GAME_CATALOG.length);
    const updated = rows.find((row) => row.feedUrl === reality.feedUrl);
    expect(updated?.slug).toBe(reality.slug);
    expect(updated?.name).toBe(reality.name);
    expect(updated?.active).toBe(true);
  });
});

describe("ingestFeed", () => {
  beforeEach(async () => cleanAll());
  afterEach(async () => {
    vi.unstubAllGlobals();
    await cleanAll();
  });

  it("stores RSS description separately and persists extracted articleText", async () => {
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug: "bbc-world",
        name: "BBC World",
        feedUrl: "https://feeds.example.com/world.xml",
        feedLabel: "BBC World",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response('<rss><channel><item><title>Story</title><link>https://example.com/story</link><description>RSS excerpt</description></item></channel></rss>'),
        )
        .mockResolvedValueOnce(
          new Response("<html><body><article><p>Full article body from the page.</p></article></body></html>"),
        ),
    );

    const summary = await ingestFeed(topic!);
    const row = await db.query.articles.findFirst({ where: (table, { eq }) => eq(table.gamesTopicId, topic!.id) });
    expect(summary).toMatchObject({ inserted: 1, scanned: 1, extracted: 1, failed: 0 });
    expect(row).toMatchObject({
      description: "RSS excerpt",
      articleText: "Full article body from the page.",
      articleTextStatus: "succeeded",
      articleTextAttempts: 1,
    });
  });

  it("continues extracting other feed items when one article page fails", async () => {
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug: "partial-feed",
        name: "Partial feed",
        feedUrl: "https://feeds.example.com/partial.xml",
        feedLabel: "Partial feed",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(
          new Response('<rss><channel><item><title>Blocked</title><link>https://example.com/blocked</link></item><item><title>Readable</title><link>https://example.com/readable</link></item></channel></rss>'),
        )
        .mockResolvedValueOnce(new Response("blocked", { status: 403 }))
        .mockResolvedValueOnce(
          new Response("<html><body><article><p>This page has readable story text.</p></article></body></html>"),
        ),
    );

    const summary = await ingestFeed(topic!);
    const rows = await db.query.articles.findMany({ where: (table, { eq }) => eq(table.gamesTopicId, topic!.id) });
    expect(summary).toMatchObject({ inserted: 2, scanned: 2, extracted: 1, failed: 1 });
    expect(rows.map(({ articleTextStatus, articleTextError }) => [articleTextStatus, articleTextError])).toEqual([
      ["failed", "http_403"],
      ["succeeded", null],
    ]);
  });

  it("backfills legacy empty text, honors automatic retry dates, and lets manual refresh retry failures", async () => {
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug: "backfill",
        name: "Backfill",
        feedUrl: "https://feeds.example.com/backfill.xml",
        feedLabel: "Backfill",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    const [legacy] = await db
      .insert(articles)
      .values({ gamesTopicId: topic!.id, url: "https://example.com/legacy", title: "Legacy" })
      .returning();
    await db
      .update(articles)
      .set({ articleTextStatus: "failed", articleTextAttempts: 1, articleTextNextAttemptAt: new Date(Date.now() + 60_000) })
      .where(eq(articles.id, legacy!.id));

    expect(await getArticlesNeedingText(topic!.id, new Date())).toEqual([]);
    expect(await getArticlesNeedingText(topic!.id, new Date(Date.now() + 61_000))).toHaveLength(1);
    expect(await getArticlesNeedingText(topic!.id, new Date(), { forceRetry: true })).toHaveLength(1);

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response("<rss><channel /></rss>"))
        .mockResolvedValueOnce(new Response("<html><body><article><p>Recovered legacy text.</p></article></body></html>")),
    );
    const summary = await ingestFeed(topic!, { forceRetry: true });
    const repaired = await db.query.articles.findFirst({ where: (table, { eq }) => eq(table.id, legacy!.id) });
    expect(summary).toMatchObject({ scanned: 0, extracted: 1, updated: 1 });
    expect(repaired).toMatchObject({
      articleText: "Recovered legacy text.",
      articleTextStatus: "succeeded",
      articleTextAttempts: 2,
      articleTextError: null,
    });
  });
});

describe("extractArticleText", () => {
  it("keeps the article body while excluding navigation and page chrome", () => {
    const text = extractArticleText(
      `<!doctype html><html><head><title>Story</title></head><body>
        <nav>Home Celebrity Shopping Subscribe</nav>
        <main><article>
          <header><h1>Celebrity reveals a surprise move</h1><p>By Reporter</p></header>
          <p>The actor announced the move during an interview.</p>
          <p>The decision followed months of private planning.</p>
        </article></main>
        <aside>Read more Trending stories</aside><footer>Terms Privacy</footer>
      </body></html>`,
      "https://example.com/story",
    );

    expect(text).toContain("The actor announced the move during an interview.");
    expect(text).toContain("The decision followed months of private planning.");
    expect(text).not.toContain("Subscribe");
    expect(text).not.toContain("Terms Privacy");
  });

  it("drops padding lines interspersed within the article body", () => {
    const text = extractArticleText(
      `<!doctype html><html><head><title>Story</title></head><body>
        <main><article>
          <p>The cast member confirmed the split during a live interview.</p>
          <p>RELATED: See every look from the reunion</p>
          <p>Sign up for our newsletter to get the latest updates.</p>
          <p>Follow us on Instagram for more.</p>
          <p>Sources say the announcement caught co-stars off guard.</p>
          <p>View this post on Instagram</p>
          <p>Advertisement</p>
        </article></main>
      </body></html>`,
      "https://example.com/story",
    );

    expect(text).toContain("The cast member confirmed the split during a live interview.");
    expect(text).toContain("Sources say the announcement caught co-stars off guard.");
    expect(text).not.toContain("RELATED");
    expect(text).not.toContain("newsletter");
    expect(text).not.toContain("Follow us");
    expect(text).not.toContain("Instagram");
    expect(text).not.toContain("Advertisement");
  });

  it("does not strip a real sentence that merely starts with sign up or subscribe", () => {
    const text = extractArticleText(
      `<!doctype html><html><head><title>Story</title></head><body>
        <main><article>
          <p>Sign up sheets for the charity event sold out within an hour.</p>
          <p>Subscribe numbers for the show's spinoff have already doubled.</p>
        </article></main>
      </body></html>`,
      "https://example.com/story",
    );

    expect(text).toContain("Sign up sheets for the charity event sold out within an hour.");
    expect(text).toContain("Subscribe numbers for the show's spinoff have already doubled.");
  });

  it("returns empty text when no readable article is present", () => {
    expect(
      extractArticleText(
        "<html><body><nav>Only navigation</nav><footer>Only footer</footer></body></html>",
        "https://example.com/no-article",
      ),
    ).toBe("");
  });
});
