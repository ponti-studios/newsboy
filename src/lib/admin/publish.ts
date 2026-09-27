import type { GamesTopic } from "@pontistudios/db";
import {
  and,
  articles,
  db,
  eq,
  gamesAttempts,
  gamesPuzzles,
  generationCandidates,
  generationRuns,
  puzzleRevisions,
} from "@pontistudios/db";
import { recordAdminAction } from "../data/admin-actions.server";
import { markArticleUsed } from "../data/articles.server";
import { getRecentAnswers, getStoredAnswers, loadPuzzleForDate } from "../data/puzzles.server";
import { validateCandidate } from "../generation/candidate-validation";
import { parseDate } from "../puzzle/date";
import { normalizeGuess } from "../puzzle/rules";
import type { PuzzleAnswerType } from "../puzzle/types";
import { explainGenerateReason } from "./generate-copy";

import { parseCandidatePayload } from "./inventory";

const ANSWER_TYPES = new Set<PuzzleAnswerType>([
  "moment",
  "object",
  "phrase",
  "place",
  "storyline",
]);

export type PublishResult =
  | { ok: true; puzzleId: number; dateKey: string; replaced: boolean }
  | { ok: false; code: "NOT_FOUND" | "NOT_PUBLISHABLE" | "INVALID_CANDIDATE"; error: string };

function topicHost(game: GamesTopic): string | null {
  try {
    return new URL(game.feedUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function publishCandidate(input: {
  game: GamesTopic;
  generationId: number;
  candidateId: number;
  userId: string;
}): Promise<PublishResult> {
  const [generation] = await db
    .select()
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.id, input.generationId),
        eq(generationRuns.gamesTopicId, input.game.id),
      ),
    )
    .limit(1);
  if (!generation) return { ok: false, code: "NOT_FOUND", error: "Generation not found" };

  const [candidate] = await db
    .select()
    .from(generationCandidates)
    .where(eq(generationCandidates.id, input.candidateId));

  if (!candidate || candidate.runId !== generation.id) {
    return { ok: false, code: "NOT_FOUND", error: "Candidate not found" };
  }

  if (!generation.publishable) {
    return { ok: false, code: "NOT_PUBLISHABLE", error: "This generation is review-only" };
  }
  if (!candidate.valid || !candidate.articleId) {
    return { ok: false, code: "NOT_PUBLISHABLE", error: "This draft cannot be published" };
  }

  const payload = parseCandidatePayload(candidate.payload);
  const answerType = payload.answerType as PuzzleAnswerType;
  if (!ANSWER_TYPES.has(answerType)) {
    return { ok: false, code: "INVALID_CANDIDATE", error: "Answer type is not allowed" };
  }

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, candidate.articleId))
    .limit(1);
  if (!article || article.gamesTopicId !== input.game.id) {
    return { ok: false, code: "NOT_PUBLISHABLE", error: "This draft has no matching story" };
  }

  const dateKey = String(generation.dateKey);
  const date = parseDate(dateKey);
  const [recentAnswers, storedAnswers] = date
    ? await Promise.all([getRecentAnswers(input.game, date), getStoredAnswers(input.game.id)])
    : [new Set<string>(), await getStoredAnswers(input.game.id)];
  const existing = await loadPuzzleForDate(input.game.id, dateKey);
  const excluded = new Set([...recentAnswers, ...storedAnswers]);
  if (existing) excluded.delete(existing.answer);

  const host = topicHost(input.game);
  const validation = validateCandidate(payload, excluded, host ? { sourceDomains: [host] } : {});
  if (!validation.valid) {
    return {
      ok: false,
      code: "INVALID_CANDIDATE",
      error: validation.reasons[0]
        ? explainGenerateReason(validation.reasons[0])
        : "This draft failed validation",
    };
  }

  const now = new Date();
  const puzzleValues = {
    articleId: article.id,
    answerType,
    clue: payload.clue,
    detail: payload.detail,
    // Store the same canonical answer that validation checked. This keeps
    // admin-published puzzles consistent with cron-generated puzzles.
    answer: validation.answer || normalizeGuess(payload.answer),
    normalizedAnswer: validation.answer || normalizeGuess(payload.answer),
    promptPath: generation.promptPath,
    model: generation.model,
    generationRunId: generation.id,
    publishedAt: now,
    updatedAt: now,
  };

  let puzzleId: number;
  let replaced = false;
  if (existing) {
    const attemptRows = await db
      .select()
      .from(gamesAttempts)
      .where(
        and(eq(gamesAttempts.gamesTopicId, input.game.id), eq(gamesAttempts.dateUtc, dateKey)),
      );
    await db.insert(puzzleRevisions).values({
      gamesTopicId: input.game.id,
      dateUtc: dateKey,
      puzzleId: existing.id,
      snapshot: existing,
      attemptsSnapshot: attemptRows,
      replacedByHominemUserId: input.userId,
    });
    await db.update(gamesPuzzles).set(puzzleValues).where(eq(gamesPuzzles.id, existing.id));
    puzzleId = existing.id;
    replaced = true;
  } else {
    const [inserted] = await db
      .insert(gamesPuzzles)
      .values({
        gamesTopicId: input.game.id,
        dateUtc: dateKey,
        createdAt: now,
        ...puzzleValues,
      })
      .returning({ id: gamesPuzzles.id });
    if (!inserted)
      return { ok: false, code: "INVALID_CANDIDATE", error: "Failed to write the puzzle" };
    puzzleId = inserted.id;
  }

  await markArticleUsed(article.id);
  await db
    .update(generationRuns)
    .set({ selectedIndex: candidate.ordinal })
    .where(eq(generationRuns.id, generation.id));
  await recordAdminAction({
    hominemUserId: input.userId,
    kind: replaced ? "replace" : "publish",
    gamesTopicId: input.game.id,
    dateUtc: dateKey,
    payload: { generationId: generation.id, candidateId: candidate.id, puzzleId },
    result: { replaced },
  });

  return { ok: true, puzzleId, dateKey, replaced };
}
