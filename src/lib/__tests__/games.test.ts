import { beforeEach, describe, expect, it } from "vitest";
import { cleanAll } from "../../data/test-db";
import { seedGame } from "./test-helpers";

beforeEach(async () => {
  await cleanAll();
});

describe("getGameBySlug", () => {
  it("returns the game row when one exists", async () => {
    const game = await seedGame();
    const { getGameBySlug } = await import("../data/games.server");
    const result = await getGameBySlug("reality");
    expect(result).toEqual(game);
  });

  it("returns null when no game exists", async () => {
    const { getGameBySlug } = await import("../data/games.server");
    const result = await getGameBySlug("missing");
    expect(result).toBeNull();
  });
});

describe("getActiveGames", () => {
  it("returns only active games, alphabetized by name", async () => {
    await seedGame({ slug: "sports", name: "Sports", feedUrl: "https://example.com/sports" });
    await seedGame({ slug: "reality", name: "Reality", feedUrl: "https://example.com/reality" });
    await seedGame({
      slug: "retired",
      name: "Retired",
      feedUrl: "https://example.com/retired",
      active: false,
    });

    const { getActiveGames } = await import("../data/games.server");
    const result = await getActiveGames();

    expect(result.map((g) => g.slug)).toEqual(["reality", "sports"]);
  });
});

describe("listTopicFeedHosts", () => {
  it("returns deduped, www-stripped hostnames for active games only", async () => {
    await seedGame({
      slug: "reality",
      name: "Reality",
      feedUrl: "https://www.realityblurred.com/feed",
    });
    await seedGame({
      slug: "sports",
      name: "Sports",
      feedUrl: "https://realityblurred.com/sports",
    });
    await seedGame({
      slug: "retired",
      name: "Retired",
      feedUrl: "https://example.com/retired",
      active: false,
    });

    const { listTopicFeedHosts } = await import("../data/games.server");
    const result = await listTopicFeedHosts();

    expect(result).toEqual(["realityblurred.com", "realityblurred.com"]);
  });

  it("skips a feed URL that fails to parse instead of throwing", async () => {
    await seedGame({ slug: "reality", name: "Reality", feedUrl: "not-a-valid-url" });

    const { listTopicFeedHosts } = await import("../data/games.server");
    const result = await listTopicFeedHosts();

    expect(result).toEqual([]);
  });
});
