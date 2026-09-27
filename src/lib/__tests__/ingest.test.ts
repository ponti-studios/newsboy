import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db, gamesTopics } from "@pontistudios/db";
import { cleanAll } from "../../data/test-db";
import { GAME_CATALOG } from "../generation/catalog";
import { ensureGameCatalog, extractArticleText, fetchFeedItems } from "../generation/ingest.server";

describe("fetchFeedItems", () => {
  it("normalizes RSS markup and control content while preserving safe fields", async () => {
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
        .mockResolvedValueOnce(
          new Response("<html><body><article><p>The full story text.</p></article></body></html>"),
        ),
    );

    await expect(fetchFeedItems("https://realityblurred.com/feed")).resolves.toEqual([
      {
        title: "Tea & Drama",
        link: "https://realityblurred.com/story",
        pubDate: "not-a-date",
        description: "Line one Line two",
        articleText: "The full story text.",
      },
    ]);
  });

  it("returns an empty list when an RSS channel has no items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<rss><channel /></rss>")));

    await expect(fetchFeedItems("https://realityblurred.com/feed")).resolves.toEqual([]);
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
