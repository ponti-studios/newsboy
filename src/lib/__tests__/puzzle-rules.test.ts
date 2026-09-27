import { describe, expect, it } from "vitest";

import { deriveGameStatus, evaluateGuess, normalizeGuess } from "../puzzle/rules";

describe("game rules", () => {
  it("evaluates correct, present, and absent letters", () => {
    expect(evaluateGuess("TILLY", "TULLY")).toEqual([
      "correct",
      "absent",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("normalizes guesses to letters only", () => {
    expect(normalizeGuess(" t!i-ll y ")).toBe("TILLY");
  });

  it("derives the game status from guesses", () => {
    expect(deriveGameStatus([])).toBe("playing");
    expect(
      deriveGameStatus([
        { word: "TILLY", states: ["correct", "correct", "correct", "correct", "correct"] },
      ]),
    ).toBe("solved");
  });
});
