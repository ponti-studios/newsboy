import { describe, expect, it, vi } from "vitest";

const { getGameUserMock, getGameBySlugMock, loadGuestPuzzleHistoryPreviewMock, loadPuzzleForSpecificDateMock } = vi.hoisted(() => ({
  getGameUserMock: vi.fn(),
  getGameBySlugMock: vi.fn(),
  loadGuestPuzzleHistoryPreviewMock: vi.fn(),
  loadPuzzleForSpecificDateMock: vi.fn(),
}));

vi.mock("../server/auth", () => ({
  getGameUser: getGameUserMock,
  loginUrl: () => "https://api.ponti.io/login?next=https://game.example.com/",
}));

vi.mock("../lib/data/games.server", () => ({
  getGameBySlug: getGameBySlugMock,
}));

vi.mock("../lib/data/puzzle.server", () => ({
  loadPuzzleForSpecificDate: loadPuzzleForSpecificDateMock,
}));

vi.mock("../lib/data/history.server", () => ({
  loadGuestPuzzleHistoryPreview: loadGuestPuzzleHistoryPreviewMock,
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
  const mod = await import("./topic.$dateKey");
  return mod.loader;
}

function request(url: string) {
  return new Request(url);
}

describe("dated-puzzle route loader", () => {
  it("404s for an unknown topic", async () => {
    getGameBySlugMock.mockResolvedValueOnce(null);
    const loader = await importLoader();
    await expect(
      loader({
        request: request("https://game.example.com/reality/2026-05-20"),
        params: { topic: "reality", dateKey: "2026-05-20" },
        context: {} as never,
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("400s for an invalid date format", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    const loader = await importLoader();
    await expect(
      loader({
        request: request("https://game.example.com/reality/not-a-date"),
        params: { topic: "reality", dateKey: "not-a-date" },
        context: {} as never,
      } as never),
    ).rejects.toMatchObject({ status: 400 });
    expect(loadPuzzleForSpecificDateMock).not.toHaveBeenCalled();
  });

  it("404s when no puzzle exists for that exact date (no fallback)", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    loadPuzzleForSpecificDateMock.mockResolvedValueOnce(null);
    getGameUserMock.mockResolvedValueOnce(null);
    const loader = await importLoader();
    await expect(
      loader({
        request: request("https://game.example.com/reality/2026-05-20"),
        params: { topic: "reality", dateKey: "2026-05-20" },
        context: {} as never,
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns the envelope with signedIn true for an authenticated user", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce({ id: "user-1", email: null });
    loadPuzzleForSpecificDateMock.mockResolvedValueOnce({
      puzzle: PUZZLE,
      attempt: { guesses: [], status: "playing" },
    } as never);

    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/reality/2026-05-20"),
      params: { topic: "reality", dateKey: "2026-05-20" },
      context: {} as never,
    } as never);

    expect(loadPuzzleForSpecificDateMock).toHaveBeenCalledWith(
      "2026-05-20",
      { id: "user-1", email: null },
      "reality",
    );
    expect(result).toMatchObject({ puzzle: PUZZLE, signedIn: true, gameSlug: "reality" });
  });

  it("returns signedIn false with attempt null for an anonymous visitor", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce(null);
    loadPuzzleForSpecificDateMock.mockResolvedValueOnce({ puzzle: PUZZLE, attempt: null });
    loadGuestPuzzleHistoryPreviewMock.mockResolvedValueOnce([
      { gameSlug: "reality", dateKey: "2026-05-20", gameName: "Reality" },
    ]);

    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/reality/2026-05-20"),
      params: { topic: "reality", dateKey: "2026-05-20" },
      context: {} as never,
    } as never);

    expect(result).toMatchObject({ puzzle: PUZZLE, attempt: null, signedIn: false, canPlayAsGuest: true });
  });

  it("does not allow anonymous play for dates outside the two-puzzle history preview", async () => {
    getGameBySlugMock.mockResolvedValueOnce({ id: 1, slug: "reality", active: true });
    getGameUserMock.mockResolvedValueOnce(null);
    loadPuzzleForSpecificDateMock.mockResolvedValueOnce({ puzzle: PUZZLE, attempt: null });
    loadGuestPuzzleHistoryPreviewMock.mockResolvedValueOnce([
      { gameSlug: "reality", dateKey: "2026-05-19", gameName: "Reality" },
      { gameSlug: "culture", dateKey: "2026-05-18", gameName: "Culture" },
    ]);

    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/reality/2026-05-20"),
      params: { topic: "reality", dateKey: "2026-05-20" },
      context: {} as never,
    } as never);

    expect(result).toMatchObject({ signedIn: false, canPlayAsGuest: false });
  });
});
