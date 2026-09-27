import { describe, expect, it, vi } from "vitest";

const {
  generatePuzzleForGameMock,
  getExistingDateKeysMock,
  getPendingArticlesForGameMock,
  recordAdminActionMock,
} = vi.hoisted(() => ({
  generatePuzzleForGameMock: vi.fn(),
  getExistingDateKeysMock: vi.fn(),
  getPendingArticlesForGameMock: vi.fn(),
  recordAdminActionMock: vi.fn(),
}));

vi.mock("../generation/generate.server", () => ({
  generatePuzzleForGame: generatePuzzleForGameMock,
}));

vi.mock("../data/puzzles.server", () => ({
  getExistingDateKeys: getExistingDateKeysMock,
}));

vi.mock("../data/articles.server", () => ({
  getPendingArticlesForGame: getPendingArticlesForGameMock,
}));

vi.mock("../data/admin-actions.server", () => ({
  recordAdminAction: recordAdminActionMock,
}));

import { gapFillOne, planGapFill, runGenerateRange } from "../generation/generation-runner";

describe("generation runner", () => {
  it("plans only requested dates that are missing from the inventory", async () => {
    const game = { id: 42 } as Parameters<typeof planGapFill>[0];
    const range = {
      ok: true as const,
      fromKey: "2026-08-13",
      toKey: "2026-08-15",
      dateKeys: ["2026-08-13", "2026-08-14", "2026-08-15"],
      force: false,
      allowLiveDates: false,
    };
    getExistingDateKeysMock.mockResolvedValue(["2026-08-14", "2026-08-20"]);

    await expect(planGapFill(game, range)).resolves.toEqual({
      dateKeys: range.dateKeys,
      existingKeys: ["2026-08-14", "2026-08-20"],
      missingKeys: ["2026-08-13", "2026-08-15"],
    });
    expect(getExistingDateKeysMock).toHaveBeenCalledWith(game.id, range.fromKey, range.toKey);
  });

  it("uses the system actor and default attempt count for one puzzle", async () => {
    const game = { id: 42 } as Parameters<typeof gapFillOne>[0];
    generatePuzzleForGameMock.mockResolvedValue({ id: 7 });

    await expect(gapFillOne(game, "2026-08-14")).resolves.toEqual({ id: 7 });
    expect(generatePuzzleForGameMock).toHaveBeenCalledWith(game, "2026-08-14", {
      maxAttempts: 1,
      actor: "system:generate",
    });
  });

  it("skips topics without pending articles without opening the circuit", async () => {
    const game = { id: 42 } as Parameters<typeof runGenerateRange>[0];
    const range = {
      ok: true as const,
      fromKey: "2026-08-13",
      toKey: "2026-08-13",
      dateKeys: ["2026-08-13"],
      force: false,
      allowLiveDates: false,
    };
    getExistingDateKeysMock.mockResolvedValue([]);
    getPendingArticlesForGameMock.mockResolvedValue([]);

    await expect(runGenerateRange(game, range)).resolves.toMatchObject({
      generatedCount: 0,
      failedCount: 0,
      skippedCount: 1,
      circuitOpened: false,
    });
    expect(generatePuzzleForGameMock).not.toHaveBeenCalled();
  });
});
