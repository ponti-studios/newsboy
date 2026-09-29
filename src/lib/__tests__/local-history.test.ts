import { afterEach, describe, expect, it, vi } from "vitest";

import { loadLocalGameHistory } from "../player/local-history";
import { computeHistoryStats } from "../puzzle/stats";

function fakeLocalStorage(entries: Record<string, string>) {
  return {
    ...entries,
    getItem: (key: string) => entries[key] ?? null,
    setItem: () => {},
  };
}

const SOLVED_IN_3 = JSON.stringify({
  guesses: [
    { word: "ALERT", states: ["absent", "present", "absent", "correct", "absent"] },
    { word: "RIVAL", states: ["present", "absent", "correct", "absent", "absent"] },
    { word: "DRAMA", states: ["correct", "correct", "correct", "correct", "correct"] },
  ],
  clue: "",
  detail: "",
});

const FAILED = JSON.stringify({
  guesses: Array.from({ length: 6 }, () => ({
    word: "WRONG",
    states: ["absent", "absent", "absent", "absent", "absent"],
  })),
  clue: "",
  detail: "",
});

describe("loadLocalGameHistory", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reconstructs attempts across topics and dates from newsboy:game: entries", () => {
    vi.stubGlobal("window", {
      localStorage: fakeLocalStorage({
        "newsboy:game:reality:2026-07-29": SOLVED_IN_3,
        "newsboy:game:technology:2026-07-28": FAILED,
      }),
    });

    const attempts = loadLocalGameHistory();

    expect(attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dateUtc: "2026-07-29", status: "solved" }),
        expect.objectContaining({ dateUtc: "2026-07-28", status: "failed" }),
      ]),
    );
    expect(attempts).toHaveLength(2);

    // Feeds directly into the same aggregation engine signed-in stats use.
    const stats = computeHistoryStats(attempts);
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.gamesSolved).toBe(1);
  });

  it("ignores unrelated localStorage keys and games with no guesses yet", () => {
    vi.stubGlobal("window", {
      localStorage: fakeLocalStorage({
        "newsboy:analytics:session": "some-uuid",
        "newsboy:game:reality:2026-07-29": JSON.stringify({ guesses: [], clue: "", detail: "" }),
      }),
    });

    expect(loadLocalGameHistory()).toEqual([]);
  });

  it("returns an empty list when localStorage access throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("denied");
      },
    });

    expect(loadLocalGameHistory()).toEqual([]);
  });
});
