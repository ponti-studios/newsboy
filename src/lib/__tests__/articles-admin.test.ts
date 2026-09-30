import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

import { adminActions, articles, db, eq, gamesTopics, inArray } from "~/lib/infrastructure/db";

vi.mock("../generation/ingest.server", () => ({
  ingestFeed: vi.fn(),
}));

import { loadAdminTopics, refreshTopicArticles } from "../admin/articles.server";
import { ingestFeed } from "../generation/ingest.server";

const ACTOR = `ops-test-${randomUUID()}`;
const ingestFeedMock = vi.mocked(ingestFeed);
const createdTopicIds: number[] = [];

describe("admin article views", () => {
  beforeEach(() => {
    ingestFeedMock.mockReset();
  });

  afterEach(async () => {
    await db.delete(adminActions).where(eq(adminActions.hominemUserId, ACTOR));
    if (createdTopicIds.length === 0) return;
    await db.delete(articles).where(inArray(articles.gamesTopicId, createdTopicIds));
    await db.delete(gamesTopics).where(inArray(gamesTopics.id, createdTopicIds));
    createdTopicIds.length = 0;
  });

  it("lists topics with article counts", async () => {
    const slug = `reality-test-${randomUUID()}`;
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug,
        name: "Reality",
        feedUrl: `https://feeds.example.com/${slug}.xml`,
        feedLabel: "Blurb",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    createdTopicIds.push(topic!.id);
    await db.insert(articles).values([
      { gamesTopicId: topic.id, url: "https://example.com/a", title: "A", status: "pending" },
      { gamesTopicId: topic.id, url: "https://example.com/b", title: "B", status: "used" },
    ]);

    const rows = await loadAdminTopics();
    const row = rows.find((candidate) => candidate.slug === topic!.slug);
    expect(row?.counts.pending).toBe(1);
    expect(row?.counts.used).toBe(1);
  });

  it("inserts new feed items and reports the count", async () => {
    const slug = `reality-test-${randomUUID()}`;
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug,
        name: "Reality",
        feedUrl: `https://feeds.example.com/${slug}.xml`,
        feedLabel: "Blurb",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    createdTopicIds.push(topic!.id);
    ingestFeedMock.mockResolvedValue({
      inserted: 1,
      scanned: 1,
      updated: 1,
      extracted: 1,
      emptyBody: 0,
      failed: 0,
      expired: 0,
    });

    const result = await refreshTopicArticles(topic, ACTOR);
    expect(ingestFeedMock).toHaveBeenCalledWith(topic, { forceRetry: true, maxTextArticles: 5 });
    expect(result).toEqual({
      ok: true,
      inserted: 1,
      scanned: 1,
      updated: 1,
      extracted: 1,
      emptyBody: 0,
      failed: 0,
      expired: 0,
    });
  });

  it("returns an error when the feed fetch fails", async () => {
    const slug = `reality-test-${randomUUID()}`;
    const [topic] = await db
      .insert(gamesTopics)
      .values({
        slug,
        name: "Reality",
        feedUrl: `https://feeds.example.com/${slug}.xml`,
        feedLabel: "Blurb",
        systemPromptPath: "src/prompts/game-generation.md",
      })
      .returning();
    createdTopicIds.push(topic!.id);
    ingestFeedMock.mockRejectedValue(new Error("Failed to fetch RSS feed: 502"));

    const result = await refreshTopicArticles(topic, ACTOR);
    expect(result).toMatchObject({ ok: false, error: "Failed to fetch RSS feed: 502" });
  });
});
