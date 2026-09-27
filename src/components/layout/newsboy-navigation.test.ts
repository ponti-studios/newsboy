import { describe, expect, it } from "vitest";

import { getCurrentGame, type NavigationGame } from "./newsboy-navigation";

const games: NavigationGame[] = [
  { slug: "culture", name: "Culture" },
  { slug: "reality", name: "Reality" },
];

describe("getCurrentGame", () => {
  it("selects the game on today's route", () => {
    expect(getCurrentGame("/reality", games)).toEqual(games[1]);
  });

  it("keeps the game selected on a dated puzzle route", () => {
    expect(getCurrentGame("/culture/2026-08-12", games)).toEqual(games[0]);
  });

  it.each(["/", "/history", "/admin", "/unknown", "/inactive/2026-08-12"])(
    "returns a neutral selection for %s",
    (pathname) => {
      expect(getCurrentGame(pathname, games)).toBeNull();
    },
  );

  it("stays neutral when there are no active games", () => {
    expect(getCurrentGame("/reality", [])).toBeNull();
  });
});
