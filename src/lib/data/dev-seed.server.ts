import { eq } from "drizzle-orm";

import { articles, db, gamesPuzzles } from "@pontistudios/db";

import { evaluateGuess, isGuessSolved, normalizeGuess } from "../puzzle/rules";
import { appendGuess, createAttempt, loadAttempt } from "./attempts.server";
import { getGameBySlug } from "./games.server";
import { loadPuzzleForDate } from "./puzzles.server";

export const GAME_SEED_SLUG = "reality";

export async function requireSeedGame() {
  const game = await getGameBySlug(GAME_SEED_SLUG);
  if (!game) {
    throw new Error(`Game not found: ${GAME_SEED_SLUG} — run migrations first.`);
  }
  return game;
}

export async function ensureSeedPuzzle(
  gameId: number,
  dateKey: string,
  rawAnswer: string,
  options: {
    title?: string;
    cluePrefix?: string;
    detailPrefix?: string;
    articleUrl?: string;
  } = {},
) {
  const existing = await loadPuzzleForDate(gameId, dateKey);
  if (existing) return existing;

  const answer = normalizeGuess(rawAnswer);
  if (answer.length !== 5) {
    throw new Error(
      `Answer must normalize to exactly 5 letters, got "${rawAnswer}" -> "${answer}"`,
    );
  }

  const url = options.articleUrl ?? `https://seed.local/game/${dateKey}/${answer.toLowerCase()}`;
  const [article] = await db
    .insert(articles)
    .values({
      gamesTopicId: gameId,
      url,
      title: options.title ?? `Seed article for ${dateKey}`,
      status: "used",
    })
    .onConflictDoNothing({ target: articles.url })
    .returning();
  const articleRow =
    article ?? (await db.query.articles.findFirst({ where: eq(articles.url, url) }));
  if (!articleRow) throw new Error(`Failed to create or find seed article for ${dateKey}`);

  await db
    .insert(gamesPuzzles)
    .values({
      gamesTopicId: gameId,
      articleId: articleRow.id,
      dateUtc: dateKey,
      answer,
      answerType: "storyline",
      normalizedAnswer: answer,
      clue: `${options.cluePrefix ?? "Seed clue"} for ${dateKey}.`,
      detail: `${options.detailPrefix ?? "Seed story detail"} for ${dateKey} — the answer was ${answer}.`,
    })
    .onConflictDoNothing({ target: [gamesPuzzles.gamesTopicId, gamesPuzzles.dateUtc] });

  const puzzle = await loadPuzzleForDate(gameId, dateKey);
  if (!puzzle) throw new Error(`Failed to create or find seed puzzle for ${dateKey}`);
  return puzzle;
}

export type SeedAttemptStatus = "solved" | "failed" | "playing" | "unplayed";

export async function seedAttempt(
  userId: string,
  gameId: number,
  dateKey: string,
  answer: string,
  status: SeedAttemptStatus,
  guesses: { solved: string[]; failed: string[]; playing: string[] },
) {
  if (status === "unplayed") return;
  const existing = await loadAttempt(userId, gameId, dateKey);
  if (existing) return;

  const attempt = await createAttempt(userId, gameId, dateKey);
  const guessPlan =
    status === "solved"
      ? [...guesses.playing, answer]
      : status === "failed"
        ? guesses.failed
        : guesses.playing;
  let attemptStatus: "playing" | "solved" | "failed" = "playing";

  for (const [index, word] of guessPlan.entries()) {
    const states = evaluateGuess(answer, word);
    const solved = isGuessSolved({ word, states });
    const isLast = index === guessPlan.length - 1;
    attemptStatus = solved ? "solved" : isLast && status === "failed" ? "failed" : "playing";
    await appendGuess(attempt.id, { word, states }, attemptStatus);
  }
}
