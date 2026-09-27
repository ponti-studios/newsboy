import { describe, expect, it, vi } from "vitest";

const { getGameUserMock, loadPuzzleHistoryMock } = vi.hoisted(() => ({
  getGameUserMock: vi.fn(),
  loadPuzzleHistoryMock: vi.fn(),
}));

vi.mock("../server/auth", () => ({
  getGameUser: getGameUserMock,
  loginUrl: () => "https://api.ponti.io/login?next=https://game.example.com/history",
}));

vi.mock("../lib/data/history.server", () => ({
  loadPuzzleHistory: loadPuzzleHistoryMock,
}));

async function importLoader() {
  const mod = await import("./history");
  return mod.loader;
}

function request(url: string) {
  return new Request(url);
}

describe("history route loader", () => {
  it("returns signedIn false with a login URL for anonymous visitors", async () => {
    getGameUserMock.mockResolvedValueOnce(null);
    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/history"),
      params: {},
      context: {} as never,
    } as never);
    expect(result).toMatchObject({ signedIn: false });
    expect(loadPuzzleHistoryMock).not.toHaveBeenCalled();
  });

  it("paginates via ?page= for a signed-in user", async () => {
    getGameUserMock.mockResolvedValueOnce({ id: "user-1", email: null });
    loadPuzzleHistoryMock.mockResolvedValueOnce({
      rows: [],
      page: 2,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
      weekStartKey: "2026-05-08",
      weekEndKey: "2026-05-14",
      stats: {
        gamesPlayed: 0,
        gamesSolved: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      },
      playableUnplayed: [],
    } as never);

    const loader = await importLoader();
    const result = await loader({
      request: request("https://game.example.com/history?page=2"),
      params: {},
      context: {} as never,
    } as never);

    expect(loadPuzzleHistoryMock).toHaveBeenCalledWith("user-1", { page: 2 });
    expect(result).toMatchObject({ signedIn: true });
  });

  it("falls back to page 1 for an invalid ?page= value", async () => {
    getGameUserMock.mockResolvedValueOnce({ id: "user-1", email: null });
    loadPuzzleHistoryMock.mockResolvedValueOnce({
      rows: [],
      page: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      weekStartKey: "2026-05-14",
      weekEndKey: "2026-05-20",
      stats: {
        gamesPlayed: 0,
        gamesSolved: 0,
        winRate: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      },
      playableUnplayed: [],
    } as never);

    const loader = await importLoader();
    await loader({
      request: request("https://game.example.com/history?page=not-a-number"),
      params: {},
      context: {} as never,
    } as never);

    expect(loadPuzzleHistoryMock).toHaveBeenCalledWith("user-1", { page: 1 });
  });
});
