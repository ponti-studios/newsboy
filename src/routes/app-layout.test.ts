import { beforeEach, describe, expect, it, vi } from "vitest";

const { canAccessGameAdminMock, getActiveGamesMock, getGameUserMock, loginUrlMock } = vi.hoisted(
  () => ({
    canAccessGameAdminMock: vi.fn(),
    getActiveGamesMock: vi.fn(),
    getGameUserMock: vi.fn(),
    loginUrlMock: vi.fn(() => "https://api.ponti.io/login?next=https://newsboy.ponti.io/history"),
  }),
);

vi.mock("~/lib/admin/auth", () => ({
  canAccessGameAdmin: canAccessGameAdminMock,
}));

vi.mock("~/lib/data/games.server", () => ({
  getActiveGames: getActiveGamesMock,
}));

vi.mock("~/server/auth", () => ({
  getGameUser: getGameUserMock,
  loginUrl: loginUrlMock,
}));

async function importLoader() {
  const mod = await import("./app-layout");
  return mod.loader;
}

function request() {
  return new Request("https://newsboy.ponti.io/history");
}

describe("app layout loader", () => {
  beforeEach(() => {
    getActiveGamesMock.mockReset();
    getGameUserMock.mockReset();
    canAccessGameAdminMock.mockReset();
    loginUrlMock.mockClear();
  });

  it("returns every active game and signed-out navigation", async () => {
    getGameUserMock.mockResolvedValueOnce(null);
    getActiveGamesMock.mockResolvedValueOnce([
      { id: 1, slug: "culture", name: "Culture", active: true },
      { id: 2, slug: "reality", name: "Reality", active: true },
    ]);
    canAccessGameAdminMock.mockReturnValueOnce(false);

    const loader = await importLoader();
    const result = await loader({ request: request(), params: {}, context: {} as never } as never);

    expect(result).toEqual({
      games: [
        { slug: "culture", name: "Culture" },
        { slug: "reality", name: "Reality" },
      ],
      signedIn: false,
      canAccessAdmin: false,
      loginUrl: "https://api.ponti.io/login?next=https://newsboy.ponti.io/history",
    });
    expect(canAccessGameAdminMock).toHaveBeenCalledWith(null);
  });

  it("exposes admin navigation only when the shared authorization check allows it", async () => {
    const user = { id: "admin-1", email: "ops@ponti.io" };
    getGameUserMock.mockResolvedValueOnce(user);
    getActiveGamesMock.mockResolvedValueOnce([{ slug: "reality", name: "Reality" }]);
    canAccessGameAdminMock.mockReturnValueOnce(true);

    const loader = await importLoader();
    const result = await loader({ request: request(), params: {}, context: {} as never } as never);

    expect(result).toMatchObject({ signedIn: true, canAccessAdmin: true });
    expect(canAccessGameAdminMock).toHaveBeenCalledWith(user);
  });

  it("keeps admin navigation hidden for a signed-in player", async () => {
    const user = { id: "player-1", email: "player@ponti.io" };
    getGameUserMock.mockResolvedValueOnce(user);
    getActiveGamesMock.mockResolvedValueOnce([{ slug: "reality", name: "Reality" }]);
    canAccessGameAdminMock.mockReturnValueOnce(false);

    const loader = await importLoader();
    const result = await loader({ request: request(), params: {}, context: {} as never } as never);

    expect(result).toMatchObject({ signedIn: true, canAccessAdmin: false });
  });

  it("keeps the application shell usable when game discovery fails", async () => {
    getGameUserMock.mockResolvedValueOnce(null);
    getActiveGamesMock.mockRejectedValueOnce(new Error("database unavailable"));
    canAccessGameAdminMock.mockReturnValueOnce(false);

    const loader = await importLoader();
    const result = await loader({ request: request(), params: {}, context: {} as never } as never);

    expect(result.games).toEqual([]);
  });

  it("treats an unexpected auth lookup failure as signed out", async () => {
    getGameUserMock.mockRejectedValueOnce(new Error("auth unavailable"));
    getActiveGamesMock.mockResolvedValueOnce([]);
    canAccessGameAdminMock.mockReturnValueOnce(false);

    const loader = await importLoader();
    const result = await loader({ request: request(), params: {}, context: {} as never } as never);

    expect(result).toMatchObject({ signedIn: false, canAccessAdmin: false });
    expect(canAccessGameAdminMock).toHaveBeenCalledWith(null);
  });
});
