import { describe, expect, it } from "vitest";

import { getTopicEmoji } from "../generation/catalog";
import { buildGameShareText } from "../player/share";
import type { GameGuess } from "../puzzle/types";

const guesses: GameGuess[] = [
  {
    word: "FLANK",
    states: ["absent", "absent", "present", "absent", "present"],
  },
  {
    word: "BACKS",
    states: ["correct", "present", "correct", "correct", "correct"],
  },
];

describe("game sharing", () => {
  it("shares the spoiler-free emoji result without guess words", () => {
    const text = buildGameShareText(
      guesses,
      true,
      "Realitea",
      "reality",
      new Date("2026-08-20T00:00:00Z"),
    );

    expect(text).toContain("Newsboy · 🩷 Realitea · 20 Aug 2026");
    expect(text).toContain("🟠");
    expect(text).not.toContain("FLANK");
    expect(text).not.toContain("BACKS");
    expect(text).toContain("https://newsboy.ponti.io/reality?src=share");
  });

  it("falls back to a default emoji for an unrecognized topic slug", () => {
    const text = buildGameShareText(
      guesses,
      true,
      "Mystery",
      "unknown-topic",
      new Date("2026-08-20T00:00:00Z"),
    );

    expect(text).toContain("Newsboy · 📰 Mystery · 20 Aug 2026");
  });

  it("uses the topic's emoji for correct tiles instead of the generic green square", () => {
    const text = buildGameShareText(
      guesses,
      true,
      "Realitea",
      "reality",
      new Date("2026-08-20T00:00:00Z"),
    );

    expect(text).not.toContain("🟩");
    expect(text).toContain("⚪⚪🟠⚪🟠");
    expect(text).toContain("🩷🟠🩷🩷🩷");
  });

  it("falls back to the default correct tile for an unrecognized topic slug", () => {
    const text = buildGameShareText(
      guesses,
      true,
      "Mystery",
      "unknown-topic",
      new Date("2026-08-20T00:00:00Z"),
    );

    expect(text).toContain("📰🟠📰📰📰");
  });
});

describe("getTopicEmoji", () => {
  it("falls back to the default for inherited Object properties instead of leaking them", () => {
    expect(getTopicEmoji("toString")).toBe("📰");
    expect(getTopicEmoji("__proto__")).toBe("📰");
    expect(getTopicEmoji("constructor")).toBe("📰");
  });
});
