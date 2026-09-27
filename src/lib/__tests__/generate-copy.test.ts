import { describe, expect, it } from "vitest";

import {
  explainGenerateReason,
  GenerateReasonType,
  generateStagePercent,
} from "../admin/generate-copy";

describe("generate copy", () => {
  it("turns machine reasons into operator language", () => {
    expect(explainGenerateReason(GenerateReasonType.UnmatchedArticle)).toContain("stories we sent");
    expect(explainGenerateReason(GenerateReasonType.AnswerLeaked)).toContain("gives the word away");
    expect(explainGenerateReason("answer is leaked in clue or detail")).toContain(
      "gives the word away",
    );
    expect(explainGenerateReason("something unknown")).toBe("something unknown");
  });

  it("maps stages to a rising percent", () => {
    expect(generateStagePercent("prepare")).toBeLessThan(generateStagePercent("model"));
    expect(generateStagePercent("done")).toBe(100);
  });
});
