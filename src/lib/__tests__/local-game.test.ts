import { afterEach, describe, expect, it, vi } from "vitest";

import { loadLocalGame, saveLocalGame, type LocalGameState } from "../player/local-game";

describe("anonymous local game persistence", () => {
  const values = new Map<string, string>();

  afterEach(() => {
    values.clear();
    vi.unstubAllGlobals();
  });

  it("restores guesses and unlocked spoiler content for the same puzzle", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    const game: LocalGameState = {
      guesses: [{ word: "DORIT", states: ["absent", "present", "absent", "correct", "absent"] }],
      clue: "The clue already earned by the player.",
      detail: "The revealed story.",
    };
    saveLocalGame("reality", "2026-09-27", game);

    expect(loadLocalGame("reality", "2026-09-27")).toEqual(game);
    expect(loadLocalGame("technology", "2026-09-27")).toEqual({ guesses: [], clue: "", detail: "" });
    expect(loadLocalGame("reality", "2026-09-28")).toEqual({ guesses: [], clue: "", detail: "" });
  });

  it("ignores malformed local data", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "{not valid json",
        setItem: vi.fn(),
      },
    });
    expect(loadLocalGame("reality", "2026-09-27")).toEqual({ guesses: [], clue: "", detail: "" });
  });
});
