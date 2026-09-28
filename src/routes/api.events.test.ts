import { describe, expect, it, vi } from "vitest";

const { recordGameEventMock } = vi.hoisted(() => ({ recordGameEventMock: vi.fn() }));

vi.mock("../lib/data/events.server", () => ({ recordGameEvent: recordGameEventMock }));

describe("game event endpoint", () => {
  it("stores only the validated funnel fields", async () => {
    const { action } = await import("./api.events");
    const response = await action({
      request: new Request("https://newsboy.example/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: "game_started",
          sessionId: "22f2be3d-ecfb-4ce5-a9a3-71b75aa8cadc",
          topicSlug: "reality",
          puzzleDate: "2026-09-27",
          attemptCount: 0,
          clueCount: 0,
          acquisitionSource: "newsletter-one",
          answer: "ERIKA",
          clue: "private clue",
        }),
      }),
      params: {},
      context: {} as never,
    } as never);

    expect(response.status).toBe(204);
    expect(recordGameEventMock).toHaveBeenCalledWith({
      event: "game_started",
      sessionId: "22f2be3d-ecfb-4ce5-a9a3-71b75aa8cadc",
      topicSlug: "reality",
      puzzleDate: "2026-09-27",
      attemptCount: 0,
      clueCount: 0,
      acquisitionSource: "newsletter-one",
    });
  });

  it("rejects incomplete payloads even when answer and clue fields are supplied", async () => {
    const { action } = await import("./api.events");
    const response = await action({
      request: new Request("https://newsboy.example/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "game_won", answer: "ERIKA", clue: "private" }),
      }),
      params: {},
      context: {} as never,
    } as never);

    expect(response.status).toBe(400);
  });
});
