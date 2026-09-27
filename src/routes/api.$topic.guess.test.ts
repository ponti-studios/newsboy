import { describe, expect, it, vi } from "vitest";

const { getGameUserMock, evaluateGuessServerMock } = vi.hoisted(() => ({
  getGameUserMock: vi.fn(),
  evaluateGuessServerMock: vi.fn(),
}));

vi.mock("../server/auth", () => ({
  getGameUser: getGameUserMock,
}));

vi.mock("../lib/data/puzzle.server", () => ({
  evaluateGuessServer: evaluateGuessServerMock,
}));

async function importAction() {
  const mod = await import("./api.$topic.guess");
  return mod.action;
}

function postRequest(body: unknown) {
  return new Request("https://game.example.com/api/reality/guess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api.$topic.guess action", () => {
  it("rejects non-POST requests", async () => {
    const action = await importAction();
    const response = await action({
      request: new Request("https://game.example.com/api/reality/guess"),
      params: { topic: "reality" },
      context: {} as never,
    } as never);
    expect(response.status).toBe(405);
  });

  it("rejects an invalid payload", async () => {
    const action = await importAction();
    const response = await action({
      request: postRequest({ dateKey: "2026-05-20" }),
      params: { topic: "reality" },
      context: {} as never,
    } as never);
    expect(response.status).toBe(400);
    expect(evaluateGuessServerMock).not.toHaveBeenCalled();
  });

  it("forwards a valid payload to evaluateGuessServer and returns its result", async () => {
    getGameUserMock.mockResolvedValueOnce({ id: "user-1", email: "user@example.com" });
    evaluateGuessServerMock.mockResolvedValueOnce({
      valid: true,
      word: "ERIKA",
      states: ["correct", "correct", "correct", "correct", "correct"],
      isSolved: true,
      isGameOver: true,
      status: "solved",
      remainingGuesses: 5,
    } as never);

    const action = await importAction();
    const response = await action({
      request: postRequest({
        dateKey: "2026-05-20",
        previousGuesses: [{ word: "ABABA" }],
        word: "erika",
      } as never),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(evaluateGuessServerMock).toHaveBeenCalledWith(
      "2026-05-20",
      "erika",
      { id: "user-1", email: "user@example.com" },
      1,
      "reality",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ valid: true, word: "ERIKA" });
  });

  it("defaults previousGuesses when omitted", async () => {
    getGameUserMock.mockResolvedValueOnce(null);
    evaluateGuessServerMock.mockResolvedValueOnce({
      valid: false,
      word: "ABCDE",
      reason: "wrong-length",
    });

    const action = await importAction();
    await action({
      request: postRequest({ dateKey: "2026-05-20", word: "abcde" }),
      params: { topic: "reality" },
      context: {} as never,
    } as never);

    expect(evaluateGuessServerMock).toHaveBeenCalledWith("2026-05-20", "abcde", null, 0, "reality");
  });
});
