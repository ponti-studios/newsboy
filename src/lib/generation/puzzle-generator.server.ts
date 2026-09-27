import { getConfiguredTextModel } from "@pontistudios/ai";
import type { Article, GamesTopic, ReasoningEffort } from "@pontistudios/db";
import { and, db, eq, gamesPuzzles, generationRuns } from "@pontistudios/db";
import { randomUUID } from "node:crypto";

import { recordAdminAction } from "../data/admin-actions.server";
import {
  expireStaleArticles,
  getPendingArticlesForGame,
  markArticleUsed,
  recordArticleRejection,
} from "../data/articles.server";
import { getRecentAnswers, getStoredAnswers, loadPuzzleForDate } from "../data/puzzles.server";
import type { PuzzleRecord } from "../data/types";
import { getErrorMessage } from "../errors";
import { createLogger } from "../logger.server";
import { getDateKey, parseDate } from "../puzzle/date";
import { GAME_ANSWER_LENGTH, normalizeGuess } from "../puzzle/rules";
import type { PuzzleAnswerType } from "../puzzle/types";
import type { GenerateReasonType } from "../admin/generate-copy";
import {
  articleToFeedItem,
  callGenerationApiForCandidates,
  detectRunEnvironment,
  getConfiguredMaxTokens,
  getConfiguredReasoningEffort,
  getSourceDomains,
  getSystemPromptForGame,
  matchArticle,
} from "./candidate-generator.server";
import type { GenerationUsage } from "./types";

const GENERATION_BATCH_SIZE = 8;
const MAX_ARTICLE_REJECTIONS = 3;
const logger = createLogger();

async function recordGenerateFailure(
  gamesTopicId: number,
  dateKey: string,
  actor: string,
  code: string,
  extra: Record<string, unknown> = {},
) {
  await recordAdminAction({
    hominemUserId: actor,
    kind: "gap_fill_one",
    gamesTopicId,
    dateUtc: dateKey,
    payload: { code, ...extra },
  });
}

type GenerationAttempt = {
  candidate: Parameters<typeof matchArticle>[0] | null;
  article: Article | null;
  llmError: string | null;
  usage: GenerationUsage;
  /** Answers the model proposed that failed validation, with their reasons. */
  rejected: { answer: string; reasons: GenerateReasonType[] }[];
  /** Answers the model proposed that cited no article from the offered batch. */
  unmatched: string[];
};

async function requestPuzzleCandidate(
  game: GamesTopic,
  dateKey: string,
  actor: string,
  excludedAnswers: string[],
  pendingArticles: Article[],
  systemPrompt: string,
  maxTokens: number,
  reasoningEffort: string | undefined,
  attempt: number,
): Promise<GenerationAttempt> {
  const childLogger = logger.child({
    operation: "requestPuzzleCandidate",
    game: game.slug,
    dateKey,
    attempt,
  });
  const sourceDomains = getSourceDomains(pendingArticles.map((article) => article.url));
  const { candidates, llmError, usage } = await callGenerationApiForCandidates(
    dateKey,
    excludedAnswers,
    pendingArticles.map(articleToFeedItem),
    systemPrompt,
    GAME_ANSWER_LENGTH,
    sourceDomains,
    getConfiguredTextModel(),
    maxTokens,
    reasoningEffort,
  );

  if (llmError) {
    childLogger.error(
      { event: "generate.api.error", error: llmError },
      "generation API call failed",
    );
    await recordGenerateFailure(game.id, dateKey, actor, "GENERATION_API_ERROR", {
      error: llmError,
    });
    return {
      candidate: null,
      article: null,
      llmError,
      usage,
      rejected: [],
      unmatched: [],
    };
  }

  const rejected: GenerationAttempt["rejected"] = [];
  const unmatched: string[] = [];
  try {
    for (const { candidate, validation } of candidates) {
      const article = matchArticle(candidate, pendingArticles);
      if (!article) {
        unmatched.push(candidate.answer);
        childLogger.debug(
          { event: "generate.candidate.unmatched", answer: candidate.answer },
          "candidate cited a source outside the offered article batch; skipping",
        );
        continue;
      }
      if (validation.valid) {
        return {
          candidate,
          article,
          llmError: null,
          usage,
          rejected,
          unmatched,
        };
      }

      rejected.push({ answer: candidate.answer, reasons: validation.reasons });
      childLogger.debug(
        {
          event: "generate.candidate.rejected",
          answer: candidate.answer,
          articleId: article.id,
          reasons: validation.reasons,
        },
        `candidate rejected: ${candidate.answer}`,
      );
      await recordArticleRejection(
        article.id,
        validation.reasons.join("; "),
        MAX_ARTICLE_REJECTIONS,
      );
    }
  } catch (err) {
    const matchError = getErrorMessage(err);
    childLogger.error(
      { event: "generate.api.matchError", error: matchError },
      "candidate matching/scoring failed",
    );
    await recordGenerateFailure(game.id, dateKey, actor, "GENERATION_MATCH_ERROR", {
      error: matchError,
    });
    return {
      candidate: null,
      article: null,
      llmError: matchError,
      usage,
      rejected,
      unmatched,
    };
  }

  return { candidate: null, article: null, llmError: null, usage, rejected, unmatched };
}

export type GeneratePuzzleForGameOptions = {
  maxAttempts?: number;
  actor?: string;
  maxTokens?: number;
  reasoningEffort?: string;
};

export const DEFAULT_GENERATION_MAX_ATTEMPTS = 5;

export function resolveGenerationMaxAttempts(maxAttempts?: number): number {
  return maxAttempts ?? DEFAULT_GENERATION_MAX_ATTEMPTS;
}

export async function generatePuzzleForGame(
  game: GamesTopic,
  dateKey: string,
  options: GeneratePuzzleForGameOptions = {},
): Promise<PuzzleRecord | null> {
  const startedAt = Date.now();
  const maxAttempts = resolveGenerationMaxAttempts(options.maxAttempts);
  const actor = options.actor ?? "system:generate";
  const maxTokens = options.maxTokens ?? getConfiguredMaxTokens();
  const reasoningEffort = options.reasoningEffort ?? getConfiguredReasoningEffort();
  const model = getConfiguredTextModel();
  const compareGroupId = randomUUID();
  const runEnvironment = detectRunEnvironment();
  const childLogger = logger.child({
    operation: "generatePuzzleForGame",
    game: game.slug,
    dateKey,
  });

  const existing = await loadPuzzleForDate(game.id, dateKey);
  if (existing) {
    childLogger.debug(
      { event: "generate.puzzle.skipped", puzzleId: existing.id, reason: "already-exists" },
      "puzzle already exists for date",
    );
    return existing;
  }

  const date = parseDate(dateKey);
  if (!date) {
    childLogger.error(
      { event: "generate.pipeline.invalidDateKey", input: dateKey },
      "invalid date key",
    );
    await recordGenerateFailure(game.id, dateKey, actor, "ERROR_INVALID_DATEKEY");
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  await expireStaleArticles(game, date);
  const [recentAnswers, inventoryAnswers, pendingArticles] = await Promise.all([
    getRecentAnswers(game, date),
    getStoredAnswers(game.id),
    getPendingArticlesForGame(game, GENERATION_BATCH_SIZE),
  ]);
  const excludedAnswers = [...new Set([...recentAnswers, ...inventoryAnswers])];

  if (pendingArticles.length === 0) {
    childLogger.error(
      { event: "generate.pipeline.backlogEmpty" },
      "no pending articles available, cannot generate puzzle",
    );
    await recordGenerateFailure(game.id, dateKey, actor, "ARTICLE_BACKLOG_EMPTY");
    return null;
  }

  const systemPrompt = getSystemPromptForGame(game);

  let result: { candidate: NonNullable<GenerationAttempt["candidate"]>; article: Article } | null =
    null;
  let winningRunId: number | null = null;
  let lastRejected: GenerationAttempt["rejected"] = [];
  const attemptExclusions = new Set(excludedAnswers);
  const articleTextCount = pendingArticles.filter((article) => Boolean(article.articleText)).length;
  childLogger.info(
    {
      event: "generate.config",
      model,
      reasoningEffort: reasoningEffort ?? "default",
      promptPath: game.systemPromptPath,
      maxAttempts,
      excludedCount: attemptExclusions.size,
      articleTextCount,
    },
    `${game.slug} ${dateKey}: configured with ${articleTextCount}/${pendingArticles.length} article(s) with full text`,
  );

  for (let attempt = 0; attempt < maxAttempts && !result; attempt++) {
    const attemptStartedAt = Date.now();
    childLogger.debug(
      {
        event: "generate.attempt.started",
        attempt: attempt + 1,
        maxAttempts,
        excludedCount: attemptExclusions.size,
      },
      `attempt ${attempt + 1}/${maxAttempts}`,
    );

    const [run] = await db
      .insert(generationRuns)
      .values({
        gamesTopicId: game.id,
        dateKey,
        status: "running",
        sourceMode: "inventory",
        articleIds: pendingArticles.map((article) => article.id),
        promptSource: "file",
        promptPath: game.systemPromptPath,
        promptText: systemPrompt,
        model,
        excludedAnswerCount: attemptExclusions.size,
        feedItemCount: pendingArticles.length,
        publishable: true,
        compareGroupId,
        requestedMaxTokens: maxTokens,
        reasoningEffort: (reasoningEffort ?? "default") as ReasoningEffort,
        trigger: "cron",
        environment: runEnvironment,
        createdByHominemUserId: actor,
      })
      .returning();

    const attemptResult = await requestPuzzleCandidate(
      game,
      dateKey,
      actor,
      [...attemptExclusions],
      pendingArticles,
      systemPrompt,
      maxTokens,
      reasoningEffort,
      attempt + 1,
    );
    lastRejected = attemptResult.rejected;
    for (const { answer } of attemptResult.rejected) attemptExclusions.add(answer);

    if (run) {
      await db
        .update(generationRuns)
        .set({
          status: attemptResult.candidate ? "succeeded" : "failed",
          llmError: attemptResult.llmError,
          promptTokens: attemptResult.usage.promptTokens,
          completionTokens: attemptResult.usage.completionTokens,
          reasoningTokens: attemptResult.usage.reasoningTokens,
          totalTokens: attemptResult.usage.totalTokens,
          costUsd: attemptResult.usage.costUsd,
          finishedAt: new Date(),
        })
        .where(and(eq(generationRuns.id, run.id), eq(generationRuns.status, "running")));
    }

    if (attemptResult.candidate && attemptResult.article) {
      result = { candidate: attemptResult.candidate, article: attemptResult.article };
      winningRunId = run?.id ?? null;
      break;
    }

    // No usable candidate this attempt (API error, all candidates rejected, or
    // none matched an offered article). Rejected answers are now excluded, so
    // the next attempt can only improve.
    childLogger.warn(
      {
        event: "generate.attempt.failed",
        attempt: attempt + 1,
        maxAttempts,
        durationMs: Date.now() - attemptStartedAt,
        apiError: attemptResult.llmError ?? undefined,
        rejectedCount: attemptResult.rejected.length,
        rejectedAnswers: attemptResult.rejected.map((item) => item.answer),
        rejectedReasons: [...new Set(attemptResult.rejected.flatMap((item) => item.reasons))],
        unmatchedCount: attemptResult.unmatched.length,
      },
      `attempt ${attempt + 1}/${maxAttempts} produced no usable candidate`,
    );

    if (attempt < maxAttempts - 1)
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
  }

  if (!result) {
    childLogger.error(
      {
        event: "generate.puzzle.failed",
        maxAttempts,
        rejectedCount: lastRejected.length,
        rejectedAnswers: lastRejected.map((item) => item.answer),
        rejectedReasons: [...new Set(lastRejected.flatMap((item) => item.reasons))],
        durationMs: Date.now() - startedAt,
      },
      "puzzle generation failed after all attempts",
    );
    await recordGenerateFailure(game.id, dateKey, actor, "GENERATION_EXHAUSTED", {
      maxAttempts,
      rejected: lastRejected,
    });
    return null;
  }

  const { candidate, article } = result;
  const now = new Date();
  const [inserted] = await db
    .insert(gamesPuzzles)
    .values({
      gamesTopicId: game.id,
      articleId: article.id,
      answer: normalizeGuess(candidate.answer),
      answerType: candidate.answerType as PuzzleAnswerType,
      clue: candidate.clue,
      createdAt: now,
      dateUtc: getDateKey(date),
      detail: candidate.detail,
      normalizedAnswer: normalizeGuess(candidate.answer),
      promptPath: game.systemPromptPath,
      model,
      generationRunId: winningRunId,
      publishedAt: now,
      updatedAt: now,
    })
    .returning();

  await markArticleUsed(article.id);
  childLogger.info(
    {
      event: "generate.puzzle.created",
      puzzleId: inserted.id,
      answer: candidate.answer,
      articleId: article.id,
      model,
      durationMs: Date.now() - startedAt,
    },
    `puzzle #${inserted.id} created: ${candidate.answer}`,
  );
  return { ...inserted, article } as PuzzleRecord;
}
