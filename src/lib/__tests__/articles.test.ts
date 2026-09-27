import { beforeEach, describe, expect, it } from "vitest";
import { articles, db } from "@pontistudios/db";
import { cleanAll } from "../../data/test-db";
import { seedGame } from "./test-helpers";

beforeEach(async () => {
  await cleanAll();
});

describe("upsertArticles", () => {
  it("dedupes on url via onConflictDoNothing and returns the inserted count", async () => {
    const game = await seedGame();

    const { upsertArticles } = await import("../data/articles.server");
    const result = await upsertArticles(game.id, [
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/a", title: "A duplicate" },
    ]);

    expect(result).toBe(1);
  });

  it("returns 0 without querying when given no items", async () => {
    const { upsertArticles } = await import("../data/articles.server");
    const result = await upsertArticles(1, []);
    expect(result).toBe(0);
  });
});

describe("getPendingArticlesForGame", () => {
  it("delegates to getPendingArticlesForTopics for a single game", async () => {
    const game = await seedGame();
    await db.insert(articles).values([
      { gamesTopicId: game.id, url: "https://example.com/1", title: "One", status: "pending" },
      { gamesTopicId: game.id, url: "https://example.com/2", title: "Two", status: "used" },
    ]);

    const { getPendingArticlesForGame } = await import("../data/articles.server");
    const result = await getPendingArticlesForGame(game, 10);

    expect(result).toHaveLength(1);
    expect(result[0]?.url).toBe("https://example.com/1");
  });
});

describe("getPendingArticlesForTopics", () => {
  it("returns pending articles across multiple topics, most recently published first", async () => {
    const game1 = await seedGame({ slug: "reality", feedUrl: "https://example.com/f1" });
    const game2 = await seedGame({ slug: "sports", feedUrl: "https://example.com/f2" });
    await db.insert(articles).values([
      {
        gamesTopicId: game1.id,
        url: "https://example.com/older",
        title: "Older",
        status: "pending",
        publishedAt: new Date("2026-06-01"),
      },
      {
        gamesTopicId: game2.id,
        url: "https://example.com/newer",
        title: "Newer",
        status: "pending",
        publishedAt: new Date("2026-06-02"),
      },
    ]);

    const { getPendingArticlesForTopics } = await import("../data/articles.server");
    const result = await getPendingArticlesForTopics([game1.id, game2.id], 10);

    expect(result.map((a) => a.url)).toEqual([
      "https://example.com/newer",
      "https://example.com/older",
    ]);
  });

  it("sorts undated articles last rather than first", async () => {
    const game = await seedGame();
    await db.insert(articles).values([
      {
        gamesTopicId: game.id,
        url: "https://example.com/undated",
        title: "Undated",
        status: "pending",
      },
      {
        gamesTopicId: game.id,
        url: "https://example.com/dated",
        title: "Dated",
        status: "pending",
        publishedAt: new Date("2026-06-01"),
      },
    ]);

    const { getPendingArticlesForTopics } = await import("../data/articles.server");
    const result = await getPendingArticlesForTopics([game.id], 10);

    expect(result.map((a) => a.url)).toEqual([
      "https://example.com/dated",
      "https://example.com/undated",
    ]);
  });

  it("returns an empty array without querying when given no topic ids", async () => {
    const { getPendingArticlesForTopics } = await import("../data/articles.server");
    expect(await getPendingArticlesForTopics([], 10)).toEqual([]);
  });
});

describe("getPendingArticlesByIds", () => {
  it("filters to pending articles among the given ids, capped at limit", async () => {
    const game = await seedGame();
    const [pending, used] = await db
      .insert(articles)
      .values([
        { gamesTopicId: game.id, url: "https://example.com/p", title: "P", status: "pending" },
        { gamesTopicId: game.id, url: "https://example.com/u", title: "U", status: "used" },
      ])
      .returning();

    const { getPendingArticlesByIds } = await import("../data/articles.server");
    const result = await getPendingArticlesByIds([pending.id, used.id], 10);

    expect(result.map((a) => a.id)).toEqual([pending.id]);
  });

  it("returns an empty array without querying when given no ids", async () => {
    const { getPendingArticlesByIds } = await import("../data/articles.server");
    expect(await getPendingArticlesByIds([], 10)).toEqual([]);
  });
});

describe("markArticleUsed", () => {
  it("flips status to used", async () => {
    const game = await seedGame();
    const [article] = await db
      .insert(articles)
      .values({
        gamesTopicId: game.id,
        url: "https://example.com/a",
        title: "A",
        status: "pending",
      })
      .returning();

    const { markArticleUsed } = await import("../data/articles.server");
    await markArticleUsed(article.id);

    const updated = (await db.query.articles.findFirst({
      where: (t, { eq }) => eq(t.id, article.id),
    }))!;
    expect(updated.status).toBe("used");
  });
});

describe("recordArticleRejection", () => {
  it("returns the article to pending while under the rejection cap", async () => {
    const game = await seedGame();
    const [article] = await db
      .insert(articles)
      .values({ gamesTopicId: game.id, url: "https://example.com/a", title: "A" })
      .returning();

    const { recordArticleRejection } = await import("../data/articles.server");
    await recordArticleRejection(article.id, "no valid candidate", 3);

    const updated = (await db.query.articles.findFirst({
      where: (t, { eq }) => eq(t.id, article.id),
    }))!;
    expect(updated.status).toBe("pending");
    expect(updated.rejectionCount).toBe(1);
    expect(updated.rejectionReason).toBe("no valid candidate");
  });

  it("permanently rejects once rejectionCount exceeds maxRejections", async () => {
    const game = await seedGame();
    const [article] = await db
      .insert(articles)
      .values({
        gamesTopicId: game.id,
        url: "https://example.com/a",
        title: "A",
        rejectionCount: 3,
      })
      .returning();

    const { recordArticleRejection } = await import("../data/articles.server");
    await recordArticleRejection(article.id, "no valid candidate", 3);

    const updated = (await db.query.articles.findFirst({
      where: (t, { eq }) => eq(t.id, article.id),
    }))!;
    expect(updated.status).toBe("rejected");
    expect(updated.rejectionCount).toBe(4);
  });

  it("is a no-op when the article no longer exists", async () => {
    const { recordArticleRejection } = await import("../data/articles.server");
    await expect(recordArticleRejection(999_999, "gone", 3)).resolves.toBeUndefined();
  });
});

describe("expireStaleArticles", () => {
  it("expires pending articles older than the game's articleExpiryDays", async () => {
    const game = await seedGame({ articleExpiryDays: 10 });
    await db.insert(articles).values([
      {
        gamesTopicId: game.id,
        url: "https://example.com/stale",
        title: "Stale",
        status: "pending",
        publishedAt: new Date("2026-06-01"),
      },
      {
        gamesTopicId: game.id,
        url: "https://example.com/fresh",
        title: "Fresh",
        status: "pending",
        publishedAt: new Date("2026-06-20"),
      },
    ]);

    const { expireStaleArticles } = await import("../data/articles.server");
    const count = await expireStaleArticles(game, new Date("2026-06-25T00:00:00.000Z"));

    expect(count).toBe(1);
    const stale = await db.query.articles.findFirst({
      where: (t, { eq }) => eq(t.url, "https://example.com/stale"),
    });
    expect(stale?.status).toBe("expired");
  });
});

describe("countArticlesByStatus", () => {
  it("groups counts by status, defaulting missing statuses to 0", async () => {
    const game = await seedGame();
    await db.insert(articles).values([
      { gamesTopicId: game.id, url: "https://example.com/1", title: "1", status: "pending" },
      { gamesTopicId: game.id, url: "https://example.com/2", title: "2", status: "pending" },
      { gamesTopicId: game.id, url: "https://example.com/3", title: "3", status: "used" },
    ]);

    const { countArticlesByStatus } = await import("../data/articles.server");
    const result = await countArticlesByStatus(game.id);

    expect(result).toEqual({ pending: 2, used: 1, rejected: 0, expired: 0 });
  });
});

describe("listArticlesForTopic", () => {
  it("filters by status and orders newest published first", async () => {
    const game = await seedGame();
    await db.insert(articles).values([
      {
        gamesTopicId: game.id,
        url: "https://example.com/1",
        title: "Older",
        status: "pending",
        publishedAt: new Date("2026-06-01"),
      },
      {
        gamesTopicId: game.id,
        url: "https://example.com/2",
        title: "Newer",
        status: "pending",
        publishedAt: new Date("2026-06-02"),
      },
      {
        gamesTopicId: game.id,
        url: "https://example.com/3",
        title: "Used",
        status: "used",
        publishedAt: new Date("2026-06-03"),
      },
    ]);

    const { listArticlesForTopic } = await import("../data/articles.server");
    const result = await listArticlesForTopic(game.id, { status: "pending" });

    expect(result.map((a) => a.title)).toEqual(["Newer", "Older"]);
  });
});

describe("countPendingArticlesForGame", () => {
  it("counts only pending articles for the game", async () => {
    const game = await seedGame();
    await db.insert(articles).values([
      { gamesTopicId: game.id, url: "https://example.com/1", title: "1", status: "pending" },
      { gamesTopicId: game.id, url: "https://example.com/2", title: "2", status: "used" },
    ]);

    const { countPendingArticlesForGame } = await import("../data/articles.server");
    const result = await countPendingArticlesForGame(game.id);

    expect(result).toBe(1);
  });
});
