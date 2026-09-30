import { describe, expect, it } from "vitest";

import { LabsServerEnv } from "../infrastructure/env";

describe("LabsServerEnv", () => {
  const baseEnv = { OPENROUTER_API_KEY: "test-key" };

  it("rejects an empty NEWSBOY_AI_MODEL override", () => {
    expect(LabsServerEnv.safeParse({ ...baseEnv, NEWSBOY_AI_MODEL: "" }).success).toBe(false);
  });

  it("accepts a non-empty NEWSBOY_AI_MODEL override", () => {
    const result = LabsServerEnv.safeParse({
      ...baseEnv,
      NEWSBOY_AI_MODEL: "meta/muse-spark-1.3-contributor",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.newsboyAiModel).toBe("meta/muse-spark-1.3-contributor");
  });

  it("accepts valid generation tuning values", () => {
    const result = LabsServerEnv.safeParse({
      ...baseEnv,
      GAME_REASONING_EFFORT: "low",
      GAME_MAX_TOKENS: "8000",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gameReasoningEffort).toBe("low");
      expect(result.data.gameMaxTokens).toBe(8000);
    }
  });

  it("leaves generation tuning unset by default", () => {
    const result = LabsServerEnv.safeParse(baseEnv);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gameReasoningEffort).toBeUndefined();
      expect(result.data.gameMaxTokens).toBeUndefined();
    }
  });

  it.each([
    { GAME_REASONING_EFFORT: "extreme" },
    { GAME_MAX_TOKENS: "abc" },
    { GAME_MAX_TOKENS: "0" },
    { GAME_MAX_TOKENS: "16001" },
    { GAME_MAX_TOKENS: "1.5" },
  ])("rejects malformed generation tuning %o", (override) => {
    expect(LabsServerEnv.safeParse({ ...baseEnv, ...override }).success).toBe(false);
  });
});
