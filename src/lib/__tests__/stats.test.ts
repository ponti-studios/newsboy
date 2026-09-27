import { describe, expect, it } from "vitest";

import { buildWeekGrid, computeHistoryStats } from "../puzzle/stats";

type StoredGuess = { word: string; states: ("absent" | "correct" | "present")[] };
type Fixture = { dateUtc: string; status: "playing" | "solved" | "failed"; guesses: StoredGuess[] };

function attempt(dateUtc: string, status: Fixture["status"], guessCount = 0): Fixture {
  return {
    dateUtc,
    status,
    guesses: Array.from({ length: guessCount }, () => ({ word: "WORDY", states: [] })),
  };
}

describe("computeHistoryStats", () => {
  it("returns all-zero stats for an empty history", () => {
    const stats = computeHistoryStats([]);

    expect(stats).toEqual({
      gamesPlayed: 0,
      gamesSolved: 0,
      winRate: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    });
  });

  it("counts a contiguous run of solved days as one streak", () => {
    const stats = computeHistoryStats([
      attempt("2026-07-29", "solved", 3),
      attempt("2026-07-28", "solved", 4),
      attempt("2026-07-27", "solved", 2),
    ]);

    expect(stats.gamesPlayed).toBe(3);
    expect(stats.gamesSolved).toBe(3);
    expect(stats.winRate).toBe(1);
    expect(stats.currentStreak).toBe(3);
    expect(stats.maxStreak).toBe(3);
  });

  it("breaks the streak on a gap (an unattempted date in between)", () => {
    const stats = computeHistoryStats([
      attempt("2026-07-29", "solved", 3),
      // 2026-07-28 has no attempt row at all — a gap
      attempt("2026-07-27", "solved", 2),
    ]);

    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(1);
  });

  it("breaks the streak on a failed day", () => {
    const stats = computeHistoryStats([
      attempt("2026-07-29", "solved", 3),
      attempt("2026-07-28", "failed", 6),
      attempt("2026-07-27", "solved", 2),
    ]);

    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(1);
  });

  it("breaks the streak on a still-in-progress day", () => {
    const stats = computeHistoryStats([
      attempt("2026-07-29", "playing", 2),
      attempt("2026-07-28", "solved", 3),
      attempt("2026-07-27", "solved", 4),
    ]);

    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(2);
  });

  it("finds the max streak in the middle of history, distinct from the current streak", () => {
    const stats = computeHistoryStats([
      attempt("2026-07-29", "solved", 3), // current streak: 1
      attempt("2026-07-28", "failed", 6),
      attempt("2026-07-27", "solved", 2),
      attempt("2026-07-26", "solved", 3),
      attempt("2026-07-25", "solved", 4), // best run: 3 (07-25..07-27)
    ]);

    expect(stats.currentStreak).toBe(1);
    expect(stats.maxStreak).toBe(3);
  });

  it("only counts solved attempts in the guess distribution, keyed by guess count at solve", () => {
    const stats = computeHistoryStats([
      attempt("2026-07-29", "solved", 3),
      attempt("2026-07-28", "solved", 3),
      attempt("2026-07-27", "failed", 6),
      attempt("2026-07-26", "solved", 1),
    ]);

    expect(stats.guessDistribution).toEqual({ 1: 1, 2: 0, 3: 2, 4: 0, 5: 0, 6: 0 });
  });

  it("computes win rate across solved and unsolved attempts", () => {
    const stats = computeHistoryStats([
      attempt("2026-07-29", "solved", 3),
      attempt("2026-07-28", "failed", 6),
      attempt("2026-07-27", "playing", 2),
      attempt("2026-07-26", "solved", 4),
    ]);

    expect(stats.gamesPlayed).toBe(4);
    expect(stats.gamesSolved).toBe(2);
    expect(stats.winRate).toBe(0.5);
  });
});

describe("buildWeekGrid", () => {
  const topics = [
    { id: 1, slug: "reality", name: "Reality" },
    { id: 2, slug: "markets", name: "Markets" },
  ];
  const range = { fromKey: "2026-07-27", toKey: "2026-07-29" };

  it("marks a day with no puzzle at all as no-puzzle", () => {
    const rows = buildWeekGrid(topics, [], [], range);

    expect(rows).toEqual([
      {
        topicSlug: "reality",
        topicName: "Reality",
        cells: [
          { dateKey: "2026-07-27", status: "no-puzzle", guessCount: null },
          { dateKey: "2026-07-28", status: "no-puzzle", guessCount: null },
          { dateKey: "2026-07-29", status: "no-puzzle", guessCount: null },
        ],
      },
      {
        topicSlug: "markets",
        topicName: "Markets",
        cells: [
          { dateKey: "2026-07-27", status: "no-puzzle", guessCount: null },
          { dateKey: "2026-07-28", status: "no-puzzle", guessCount: null },
          { dateKey: "2026-07-29", status: "no-puzzle", guessCount: null },
        ],
      },
    ]);
  });

  it("marks a day with a puzzle but no attempt as unplayed", () => {
    const existingPuzzles = [{ topicId: 1, dateUtc: "2026-07-28" }];
    const rows = buildWeekGrid(topics, [], existingPuzzles, range);

    const realityCells = rows.find((r) => r.topicSlug === "reality")?.cells;
    expect(realityCells?.[1]).toEqual({
      dateKey: "2026-07-28",
      status: "unplayed",
      guessCount: null,
    });
  });

  it("reflects each topic's own attempt independently, one row per topic", () => {
    const existingPuzzles = [
      { topicId: 1, dateUtc: "2026-07-27" },
      { topicId: 2, dateUtc: "2026-07-27" },
    ];
    const attempts = [
      { topicId: 1, dateUtc: "2026-07-27", status: "solved" as const, guesses: [1, 2] },
      { topicId: 2, dateUtc: "2026-07-27", status: "failed" as const, guesses: [1, 2, 3, 4, 5, 6] },
    ];
    const rows = buildWeekGrid(topics, attempts, existingPuzzles, range);

    expect(rows[0].topicSlug).toBe("reality");
    expect(rows[0].cells[0]).toEqual({ dateKey: "2026-07-27", status: "solved", guessCount: 2 });
    expect(rows[1].topicSlug).toBe("markets");
    expect(rows[1].cells[0]).toEqual({ dateKey: "2026-07-27", status: "failed", guessCount: null });
  });

  it("marks an in-progress attempt as playing with no guess count", () => {
    const existingPuzzles = [{ topicId: 1, dateUtc: "2026-07-27" }];
    const attempts = [
      { topicId: 1, dateUtc: "2026-07-27", status: "playing" as const, guesses: [1] },
    ];
    const rows = buildWeekGrid(topics, attempts, existingPuzzles, range);

    expect(rows[0].cells[0]).toEqual({
      dateKey: "2026-07-27",
      status: "playing",
      guessCount: null,
    });
  });
});
