import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";

import { createLogger } from "../lib/logger.server";
import { getGameUser } from "../server/auth";
import { evaluateGuessServer } from "../lib/data/puzzle.server";

const logger = createLogger({ route: "api.guess" });

const payloadSchema = z.object({
  dateKey: z.string().min(1),
  // Used to reject duplicate guesses and enforce the guess cap for anonymous
  // on-device games. Signed-in players are checked against games_attempts.
  previousGuesses: z
    .array(z.object({ word: z.string().min(1) }))
    .max(6)
    .default([]),
  word: z.string().min(1).max(64),
});

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const gameSlug = params.topic!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn(
      {
        event: "guess.payload.parse_failed",
        contentType: request.headers.get("content-type"),
        contentLength: request.headers.get("content-length"),
      },
      "Guess request body could not be parsed as JSON",
    );
    return Response.json({ error: "Invalid guess payload" }, { status: 400 });
  }

  const parsedPayload = payloadSchema.safeParse(body);
  if (!parsedPayload.success) {
    const bodyRecord: Record<string, unknown> | null =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    const bodyKeys = bodyRecord ? Object.keys(bodyRecord) : [];
    const previousGuesses = bodyRecord?.previousGuesses;
    logger.warn(
      {
        event: "guess.payload.validation_failed",
        bodyType: Array.isArray(body) ? "array" : body === null ? "null" : typeof body,
        fieldPresence: {
          dateKey: bodyKeys.includes("dateKey"),
          previousGuesses: bodyKeys.includes("previousGuesses"),
          word: bodyKeys.includes("word"),
        },
        previousGuessesType: Array.isArray(previousGuesses) ? "array" : typeof previousGuesses,
        previousGuessesCount: Array.isArray(previousGuesses) ? previousGuesses.length : null,
        issues: parsedPayload.error.issues.map(({ code, path }) => ({ code, path: path.join(".") })),
      },
      "Guess request payload failed validation",
    );
    return Response.json({ error: "Invalid guess payload" }, { status: 400 });
  }
  const parsed = parsedPayload.data;

  const user = await getGameUser(request);
  const result = await evaluateGuessServer(
    parsed.dateKey,
    parsed.word,
    user,
    parsed.previousGuesses,
    gameSlug,
  );

  return Response.json(result);
}
