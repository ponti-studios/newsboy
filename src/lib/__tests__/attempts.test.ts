import { gamesAttempts, db } from "@pontistudios/db";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanAll } from "../../data/test-db";
import { seedGame, seedGameWithPuzzles } from "./test-helpers";

beforeEach(async () => {
  await cleanAll();
});

describe("loadAttempt / createAttempt", () => {
  it("returns null before an attempt exists, then the row after creating one", async () => {
    const game = await seedGame();

    const { createAttempt, loadAttempt } = await import("../data/attempts.server");
    expect(await loadAttempt("user-1", game.id, "2026-06-25")).toBeNull();

    const created = await createAttempt("user-1", game.id, "2026-06-25");
    expect(created.status).toBe("playing");
    expect(await loadAttempt("user-1", game.id, "2026-06-25")).toEqual(created);
  });
});

describe("appendGuess", () => {
  it("appends the guess and timestamp, and updates status", async () => {
    const game = await seedGame();
    const { createAttempt, appendGuess, loadAttempt } = await import("../data/attempts.server");
    const attempt = await createAttempt("user-1", game.id, "2026-06-25");

    await appendGuess(attempt.id, { word: "BRAVO", states: ["correct"] }, "solved");

    const updated = await loadAttempt("user-1", game.id, "2026-06-25");
    expect(updated?.guesses).toEqual([{ word: "BRAVO", states: ["correct"] }]);
    expect(updated?.guessedAt).toHaveLength(1);
    expect(updated?.status).toBe("solved");
  });
});

describe("countRecentGuesses", () => {
  it("counts guesses across attempts within the time window", async () => {
    const game = await seedGame();
    const { createAttempt, appendGuess, countRecentGuesses } =
      await import("../data/attempts.server");
    const attempt = await createAttempt("user-1", game.id, "2026-06-25");
    await appendGuess(attempt.id, { word: "BRAVO", states: ["absent"] }, "playing");
    await appendGuess(attempt.id, { word: "DISCO", states: ["absent"] }, "playing");

    const result = await countRecentGuesses("user-1", 60_000);

    expect(result).toBe(2);
  });

  it("does not count another user's guesses", async () => {
    const game = await seedGame();
    const { createAttempt, appendGuess, countRecentGuesses } =
      await import("../data/attempts.server");
    const attempt = await createAttempt("user-2", game.id, "2026-06-25");
    await appendGuess(attempt.id, { word: "BRAVO", states: ["absent"] }, "playing");

    const result = await countRecentGuesses("user-1", 60_000);

    expect(result).toBe(0);
  });
});

describe("countAttemptsByDate", () => {
  it("returns a count per requested date, defaulting to 0", async () => {
    const game = await seedGame();
    await db.insert(gamesAttempts).values([
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-25" },
      { hominemUserId: "user-2", gamesTopicId: game.id, dateUtc: "2026-06-25" },
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-26" },
    ]);

    const { countAttemptsByDate } = await import("../data/attempts.server");
    const result = await countAttemptsByDate(game.id, ["2026-06-25", "2026-06-26", "2026-06-27"]);

    expect(result.get("2026-06-25")).toBe(2);
    expect(result.get("2026-06-26")).toBe(1);
    expect(result.get("2026-06-27")).toBe(0);
  });
});

describe("listAttemptsForUserInRange", () => {
  it("returns attempts within the range, newest date first, joined with their puzzle", async () => {
    const game = await seedGameWithPuzzles(["2026-06-25", "2026-06-26", "2026-06-27"]);
    await db.insert(gamesAttempts).values([
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-25", status: "solved" },
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-26", status: "failed" },
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-27", status: "playing" },
    ]);

    const { listAttemptsForUserInRange } = await import("../data/attempts.server");
    const result = await listAttemptsForUserInRange("user-1", [game.id], {
      fromKey: "2026-06-25",
      toKey: "2026-06-27",
    });

    expect(result.map((r) => r.attempt.dateUtc)).toEqual([
      "2026-06-27",
      "2026-06-26",
      "2026-06-25",
    ]);
    expect(result[0].puzzle.clue).toBe("clue for 2026-06-27");
  });

  it("excludes attempts outside the requested date window", async () => {
    const game = await seedGameWithPuzzles(["2026-06-25", "2026-06-26", "2026-06-27"]);
    await db.insert(gamesAttempts).values([
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-25", status: "solved" },
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-26", status: "solved" },
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-27", status: "solved" },
    ]);

    const { listAttemptsForUserInRange } = await import("../data/attempts.server");
    const week1 = await listAttemptsForUserInRange("user-1", [game.id], {
      fromKey: "2026-06-27",
      toKey: "2026-06-27",
    });
    const week2 = await listAttemptsForUserInRange("user-1", [game.id], {
      fromKey: "2026-06-25",
      toKey: "2026-06-26",
    });

    expect(week1.map((r) => r.attempt.dateUtc)).toEqual(["2026-06-27"]);
    expect(week2.map((r) => r.attempt.dateUtc)).toEqual(["2026-06-26", "2026-06-25"]);
  });

  it("never leaks another user's attempts", async () => {
    const game = await seedGameWithPuzzles(["2026-06-25"]);
    await db.insert(gamesAttempts).values([
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-25", status: "solved" },
      { hominemUserId: "user-2", gamesTopicId: game.id, dateUtc: "2026-06-25", status: "solved" },
    ]);

    const { listAttemptsForUserInRange } = await import("../data/attempts.server");
    const result = await listAttemptsForUserInRange("user-1", [game.id], {
      fromKey: "2026-06-25",
      toKey: "2026-06-25",
    });

    expect(result).toHaveLength(1);
    expect(result[0].attempt.hominemUserId).toBe("user-1");
  });
});

describe("loadAllAttemptsForUser", () => {
  it("returns every attempt for the user, unpaginated, newest date first", async () => {
    const game = await seedGameWithPuzzles(["2026-06-25", "2026-06-26", "2026-06-27"]);
    await db.insert(gamesAttempts).values([
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-25", status: "solved" },
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-26", status: "failed" },
      { hominemUserId: "user-1", gamesTopicId: game.id, dateUtc: "2026-06-27", status: "playing" },
    ]);

    const { loadAllAttemptsForUser } = await import("../data/attempts.server");
    const result = await loadAllAttemptsForUser("user-1", [game.id]);

    expect(result.map((r) => r.dateUtc)).toEqual(["2026-06-27", "2026-06-26", "2026-06-25"]);
  });

  it("returns an empty array when the user has no attempts", async () => {
    const game = await seedGameWithPuzzles([]);

    const { loadAllAttemptsForUser } = await import("../data/attempts.server");
    const result = await loadAllAttemptsForUser("user-1", [game.id]);

    expect(result).toEqual([]);
  });
});
