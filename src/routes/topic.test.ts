import { describe, expect, it, vi } from "vitest";

const {
  getGameUserMock,
  getGameBySlugMock,
  loadActivePublicPuzzleWithAttemptMock,
  loadPlayerStatsMock,
} = vi.hoisted(() => ({
  getGameUserMock: vi.fn(),
  getGameBySlugMock: vi.fn(),
  loadActivePublicPuzzleWithAttemptMock: vi.fn(),
  loadPlayerStatsMock: vi.fn(),
}));

vi.mock("../server/auth", () => ({
  getGameUser: getGameUserMock,
  loginUrl: () => "https://api.ponti.io/login?next=https://game.example.com/",
}));

vi.mock("../lib/data/games.server", () => ({
  getGameBySlug: getGameBySlugMock,
}));

vi.mock("../lib/data/puzzle.server", () => ({
  loadActivePublicPuzzleWithAttempt: loadActivePublicPuzzleWithAttemptMock,
}));

vi.mock("../lib/data/history.server", () => ({
  loadPlayerStats: loadPlayerStatsMock,
}));

const PUZZLE = {
  answerType: "storyline" as const,
  clue: "clue",
  dateKey: "2026-05-20",
  detail: "detail",
  isFallback: false,
  sources: [
    { url: "https://example.com", title: "Example", publishedAt: "2026-05-19T00:00:00.000Z" },
  ],
};

async function importLoader() {
  const mod = await import("./topic");
  return mod.loader;
}

function request(url: string, headers?: HeadersInit) {
  return new Request(url, { headers });
}

describe("today route loader", () => {
  it("404s for a topic that isn't an active game", async () => {
    getGameBySlugMock.mockResolvedValueOnce(null);
    const loader = await importLoader();
    await expect(
      loader({
        request: request("https://game.example.com/reality"),
        params: { topic: "reality" },
        context: {} as never,
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns the active puzzle with an attempt and stats for a signed-in user", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce({ id: "user-1", email: null });
    loadActivePublicPuzzleWithAttemptMock.mockResolvedValueOnce({
      puzzle: PUZZLE,
      attempt: { guesses: [], status: "playing" },
    } as never);
    const stats = {
      gamesPlayed: 4,
      gamesSolved: 3,
      winRate: 0.75,
      currentStreak: 2,
      maxStreak: 3,
      guessDistribution: { 1: 0, 2: 1, 3: 1, 4: 1, 5: 0, 6: 0 },
    };
    loadPlayerStatsMock.mockResolvedValueOnce(stats);

    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/reality", {
        Cookie: "newsboy_timezone=America%2FNew_York",
      }),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(loadActivePublicPuzzleWithAttemptMock).toHaveBeenCalledWith(
      expect.any(Date),
      "America/New_York",
      { id: "user-1", email: null },
      "reality",
    );
    expect(loadPlayerStatsMock).toHaveBeenCalledWith("user-1");
    expect(result).toMatchObject({
      puzzle: PUZZLE,
      attempt: { guesses: [], status: "playing" },
      gameSlug: "reality",
      stats,
    } as never);
  });

  it("returns null stats for an anonymous player, without calling loadPlayerStats", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce(null);
    loadActivePublicPuzzleWithAttemptMock.mockResolvedValueOnce({ puzzle: PUZZLE, attempt: null });

    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/reality"),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(loadPlayerStatsMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ stats: null });
  });

  it("returns a null-puzzle empty state (not a 404) when no puzzle is available", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce(null);
    loadActivePublicPuzzleWithAttemptMock.mockResolvedValueOnce(null);

    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/reality"),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(result).toMatchObject({ puzzle: null, gameSlug: "reality", stats: null });
  });

  it("defaults the time zone to UTC when no timezone cookie is present", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce(null);
    loadActivePublicPuzzleWithAttemptMock.mockResolvedValueOnce({ puzzle: PUZZLE, attempt: null });

    const loader = await importLoader();
    await loader({
      request: request("https://game.example.com/reality"),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(loadActivePublicPuzzleWithAttemptMock).toHaveBeenCalledWith(
      expect.any(Date),
      "UTC",
      null,
      "reality",
    );
  });

  it("defaults invalid timezone cookies to UTC", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce(null);
    loadActivePublicPuzzleWithAttemptMock.mockResolvedValueOnce({ puzzle: PUZZLE, attempt: null });

    const loader = await importLoader();
    await loader({
      request: request("https://game.example.com/reality", {
        Cookie: "newsboy_timezone=Not%2FA%20Timezone",
      }),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(loadActivePublicPuzzleWithAttemptMock).toHaveBeenCalledWith(
      expect.any(Date),
      "UTC",
      null,
      "reality",
    );
  });

  it("defaults malformed timezone cookies to UTC", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce(null);
    loadActivePublicPuzzleWithAttemptMock.mockResolvedValueOnce({ puzzle: PUZZLE, attempt: null });

    const loader = await importLoader();
    await loader({
      request: request("https://game.example.com/reality", {
        Cookie: "newsboy_timezone=%ZZ",
      }),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(loadActivePublicPuzzleWithAttemptMock).toHaveBeenCalledWith(
      expect.any(Date),
      "UTC",
      null,
      "reality",
    );
  });
});
