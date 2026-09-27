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
});
