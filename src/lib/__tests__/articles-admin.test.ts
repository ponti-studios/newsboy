import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, db, gamesTopics } from "@pontistudios/db";
import { cleanAll } from "../../data/test-db";

vi.mock("../generation/ingest.server", () => ({
  fetchFeedItems: vi.fn(),
}));

import { loadAdminTopics, refreshTopicArticles } from "../admin/articles.server";
import { fetchFeedItems } from "../generation/ingest.server";

const ACTOR = "ops-1";
const fetchFeedItemsMock = vi.mocked(fetchFeedItems);

describe("admin article views", () => {
  beforeEach(async () => {
    await cleanAll();
    fetchFeedItemsMock.mockReset();
  });

  afterEach(async () => {
    await cleanAll();
  });

  it("lists topics with article counts", async () => {
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug: "reality",
        name: "Reality",
        feedUrl: "https://realityblurred.com/feed",
        feedLabel: "Blurb",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    await db.insert(articles).values([
      { gamesTopicId: topic.id, url: "https://example.com/a", title: "A", status: "pending" },
      { gamesTopicId: topic.id, url: "https://example.com/b", title: "B", status: "used" },
    ]);

    const rows = await loadAdminTopics();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.counts.pending).toBe(1);
    expect(rows[0]?.counts.used).toBe(1);
  });

  it("inserts new feed items and reports the count", async () => {
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug: "reality",
        name: "Reality",
        feedUrl: "https://realityblurred.com/feed",
        feedLabel: "Blurb",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    fetchFeedItemsMock.mockResolvedValue([
      {
        title: "New story",
        link: "https://realityblurred.com/new",
        pubDate: "Wed, 12 Aug 2026 00:00:00 GMT",
        description: "A new item",
        articleText: "Body",
      },
    ]);

    const result = await refreshTopicArticles(topic, ACTOR);
    expect(result).toEqual({ ok: true, inserted: 1, scanned: 1, expired: 0 });
    const stored = await db.query.articles.findFirst({
      where: (table, { eq }) => eq(table.url, "https://realityblurred.com/new"),
    });
    expect(stored?.title).toBe("New story");
  });

  it("returns an error when the feed fetch fails", async () => {
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug: "reality",
        name: "Reality",
        feedUrl: "https://realityblurred.com/feed",
        feedLabel: "Blurb",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    fetchFeedItemsMock.mockRejectedValue(new Error("Failed to fetch RSS feed: 502"));

    const result = await refreshTopicArticles(topic, ACTOR);
    expect(result).toMatchObject({ ok: false, error: "Failed to fetch RSS feed: 502" });
  });
});
