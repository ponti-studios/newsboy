import { describe, expect, it } from "vitest";

import { readGenerateForm } from "../admin/generate-form";

describe("readGenerateForm", () => {
  it("parses and normalizes the generate form", () => {
    const form = new FormData();
    form.set("dateKey", "2026-08-20");
    form.set("sourceMode", "articles");
    form.set("promptChoice", "custom");
    form.set("promptText", "Use these stories to generate candidates.");
    form.set("articleIds", "12, invalid, 34");
    form.set("maxTokens", "8000");
    form.set("reasoningEffort", "high");

    expect(readGenerateForm(form)).toEqual({
      dateKey: "2026-08-20",
      sourceMode: "articles",
      promptSource: "paste",
      promptText: "Use these stories to generate candidates.",
      articleIds: [12, 34],
      maxTokens: 8000,
      reasoningEffort: "high",
    });
  });

  it("uses defaults and omits blank optional fields", () => {
    const form = new FormData();
    form.set("dateKey", "2026-08-20");
    form.set("promptSource", "file");
    form.set("fixtureId", "none");
    form.set("maxTokens", "");

    expect(readGenerateForm(form)).toEqual({
      dateKey: "2026-08-20",
      sourceMode: "inventory",
      promptSource: "file",
    });
  });

  it("rejects an unsupported source mode", () => {
    const form = new FormData();
    form.set("sourceMode", "unknown");

    expect(() => readGenerateForm(form)).toThrow();
  });
});
