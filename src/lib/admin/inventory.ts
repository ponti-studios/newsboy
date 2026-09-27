import type {
  GenerationPromptSource,
  GenerationRunStatus,
  GenerationSourceMode,
} from "@pontistudios/db";

import { addDaysToDateKey, buildDateRange, getDateKey } from "../puzzle/date";
import { isLiveDate, liveDateKeys, PRIMARY_PLAYER_TZ } from "../generation/generate-range";
import { GAME_READY_INVENTORY_DAYS } from "../generation/candidate-validation";
import { MAX_FEED_TITLE_LENGTH, sanitizeFeedText } from "../generation/feed-text";
import { countAttemptsByDate } from "../data/attempts.server";
import { countPendingArticlesForGame } from "../data/articles.server";
import { getActiveGames, getGameBySlug } from "../data/games.server";
import {
  getGenerationWithCandidates,
  listGenerationsForTopic,
} from "../data/generation-runs.server";
import {
  countInventoryForRange,
  getExistingDateKeys,
  listAllPuzzleDateKeys,
  loadPuzzleForDate,
} from "../data/puzzles.server";
import type { GenerateErr, GenerateOk } from "./generate-types";
import { reapStaleGenerations } from "./generate.server";

/** Default overview window: 5 days ago, today, 5 days ahead. */
export const ADMIN_INVENTORY_LOOKBACK_DAYS = 5;
export const ADMIN_INVENTORY_LOOKAHEAD_DAYS = 5;
export const ADMIN_RECENT_GENERATIONS_LIMIT = 20;

export type InventoryCellState = "live" | "ready" | "missing";

export type InventoryCell = {
  dateKey: string;
  state: InventoryCellState;
  isUtcToday: boolean;
  isPacificToday: boolean;
  attemptCount: number;
};

export type AdminGeneration = {
  id: number;
  dateKey: string;
  status: GenerationRunStatus;
  sourceMode: GenerationSourceMode;
  model: string;
  publishable: boolean;
  llmError: string | null;
  createdByEmail: string | null;
  createdAt: string;
  finishedAt: string | null;
  requestedMaxTokens: number | null;
  reasoningEffort: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
};

export type AdminGenerationCandidate = {
  id: number;
  ordinal: number;
  valid: boolean;
  reasons: string[];
  articleId: number | null;
  articleTitle: string | null;
  articleUrl: string | null;
  candidate: {
    answer: string;
    answerType: string;
    articleAbout?: string;
    concept?: string;
    answerMeaning?: string;
    relationship?: string;
    clue: string;
    detail: string;
    sources: Array<{ url: string; title: string; publishedAt: string }>;
  };
};

export type AdminGenerationDetail = AdminGeneration & {
  feedError: string | null;
  promptSource: GenerationPromptSource;
  promptPath: string | null;
  selectedIndex: number | null;
  feedItemCount: number;
  candidates: AdminGenerationCandidate[];
};

export function overviewInventoryDateKeys(utcToday: string): string[] {
  const startKey = addDaysToDateKey(utcToday, -ADMIN_INVENTORY_LOOKBACK_DAYS);
  if (!startKey) return [];
  return buildDateRange(startKey, {
    daysAhead: ADMIN_INVENTORY_LOOKBACK_DAYS + 1 + ADMIN_INVENTORY_LOOKAHEAD_DAYS,
  });
}

function mergeInventoryDateKeys(utcToday: string, existingKeys: string[]): string[] {
  return [...new Set([...overviewInventoryDateKeys(utcToday), ...existingKeys])].sort();
}

export function buildInventoryCells(input: {
  now: Date;
  existingKeys: string[];
  attemptCounts: Map<string, number>;
  dateKeys?: string[];
}): InventoryCell[] {
  const utcToday = getDateKey(input.now, "UTC");
  const pacificToday = getDateKey(input.now, PRIMARY_PLAYER_TZ);
  const dateKeys = input.dateKeys ?? overviewInventoryDateKeys(utcToday);
  const existing = new Set(input.existingKeys);
  const live = liveDateKeys(input.now);

  return dateKeys.map((dateKey) => {
    const hasPuzzle = existing.has(dateKey);
    const state: InventoryCellState = !hasPuzzle ? "missing" : live.has(dateKey) ? "live" : "ready";
    return {
      dateKey,
      state,
      isUtcToday: dateKey === utcToday,
      isPacificToday: dateKey === pacificToday,
      attemptCount: input.attemptCounts.get(dateKey) ?? 0,
    };
  });
}

export async function resolveAdminGame(slug: string) {
  const requested = await getGameBySlug(slug);
  if (requested) return requested;
  const [fallback] = await getActiveGames();
  return fallback ?? null;
}

function asDateKey(value: string | Date): string {
  return value instanceof Date ? getDateKey(value, "UTC") : value;
}

function serializeGeneration(
  generation: Awaited<ReturnType<typeof listGenerationsForTopic>>[number],
): AdminGeneration {
  return {
    id: generation.id,
    dateKey: asDateKey(generation.dateKey),
    status: generation.status,
    sourceMode: generation.sourceMode,
    model: generation.model,
    publishable: generation.publishable,
    llmError: generation.llmError,
    createdByEmail: generation.createdByEmail,
    createdAt: generation.createdAt.toISOString(),
    finishedAt: generation.finishedAt?.toISOString() ?? null,
    requestedMaxTokens: generation.requestedMaxTokens,
    reasoningEffort: generation.reasoningEffort,
    promptTokens: generation.promptTokens,
    completionTokens: generation.completionTokens,
    reasoningTokens: generation.reasoningTokens,
    totalTokens: generation.totalTokens,
    costUsd: generation.costUsd,
  };
}

export function parseCandidatePayload(value: unknown): AdminGenerationCandidate["candidate"] {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sources = Array.isArray(row.sources)
    ? row.sources.flatMap((source) => {
        if (!source || typeof source !== "object") return [];
        const entry = source as Record<string, unknown>;
        return [
          {
            url: typeof entry.url === "string" ? entry.url : "",
            title: typeof entry.title === "string" ? entry.title : "",
            publishedAt: typeof entry.publishedAt === "string" ? entry.publishedAt : "",
          },
        ];
      })
    : [];
  return {
    answer: typeof row.answer === "string" ? row.answer : "",
    answerType: typeof row.answerType === "string" ? row.answerType : "",
    ...(typeof row.articleAbout === "string" ? { articleAbout: row.articleAbout } : {}),
    ...(typeof row.concept === "string" ? { concept: row.concept } : {}),
    ...(typeof row.answerMeaning === "string" ? { answerMeaning: row.answerMeaning } : {}),
    ...(typeof row.relationship === "string" ? { relationship: row.relationship } : {}),
    clue: typeof row.clue === "string" ? row.clue : "",
    detail: typeof row.detail === "string" ? row.detail : "",
    sources,
  };
}

/** Adapts a persisted run into the wire shape the generate UI already renders (GenerateResult/CandidateCards). */
export function toGenerateOk(detail: AdminGenerationDetail): GenerateOk | GenerateErr {
  if (
    detail.status === "failed" &&
    detail.candidates.length === 0 &&
    !detail.llmError &&
    !detail.feedError
  ) {
    return { ok: false, code: "INVALID_SOURCE", error: "Generation failed" };
  }
  return {
    ok: true,
    generationId: detail.id,
    publishable: detail.publishable,
    model: detail.model,
    promptSource: detail.promptSource,
    selectedIndex: detail.selectedIndex,
    feedError: detail.feedError,
    llmError: detail.llmError,
    articleCount: detail.feedItemCount,
    usage: {
      requestedMaxTokens: detail.requestedMaxTokens,
      reasoningEffort: detail.reasoningEffort,
      promptTokens: detail.promptTokens,
      completionTokens: detail.completionTokens,
      reasoningTokens: detail.reasoningTokens,
      totalTokens: detail.totalTokens,
      costUsd: detail.costUsd,
    },
    candidates: detail.candidates,
  };
}

export async function loadAdminGeneration(slug: string, generationId: number) {
  const game = await resolveAdminGame(slug);
  if (!game) return null;
  const detail = await getGenerationWithCandidates(game.id, generationId);
  if (!detail) return null;

  return {
    game: { id: game.id, slug: game.slug, name: game.name },
    generation: {
      ...serializeGeneration(detail.generation),
      feedError: detail.generation.feedError,
      promptSource: detail.generation.promptSource,
      promptPath: detail.generation.promptPath,
      selectedIndex: detail.generation.selectedIndex,
      feedItemCount: detail.generation.feedItemCount,
      candidates: detail.candidates.map((candidate) => ({
        id: candidate.id,
        ordinal: candidate.ordinal,
        valid: candidate.valid,
        reasons: candidate.reasons,
        articleId: candidate.articleId,
        articleTitle: candidate.articleTitle
          ? sanitizeFeedText(candidate.articleTitle, MAX_FEED_TITLE_LENGTH)
          : null,
        articleUrl: candidate.articleUrl,
        candidate: parseCandidatePayload(candidate.payload),
      })),
    } satisfies AdminGenerationDetail,
  };
}

export async function loadAdminOverview(slug: string, now = new Date()) {
  const game = await resolveAdminGame(slug);
  if (!game) return null;

  await reapStaleGenerations();

  const utcToday = getDateKey(now, "UTC");
  const dateKeys = overviewInventoryDateKeys(utcToday);
  const startKey = dateKeys[0];
  const endKey = dateKeys[dateKeys.length - 1];
  if (!startKey || !endKey) return null;

  const [existingKeys, pendingArticles, inventoryDepth, todayPuzzle, runs] = await Promise.all([
    getExistingDateKeys(game.id, startKey, endKey),
    countPendingArticlesForGame(game.id),
    countInventoryForRange(game.id, utcToday, GAME_READY_INVENTORY_DAYS),
    loadPuzzleForDate(game.id, utcToday),
    listGenerationsForTopic(game.id, { limit: ADMIN_RECENT_GENERATIONS_LIMIT }),
  ]);
  const attemptCounts = await countAttemptsByDate(game.id, dateKeys);

  return {
    game: { id: game.id, slug: game.slug, name: game.name, feedLabel: game.feedLabel },
    utcToday,
    pacificToday: getDateKey(now, PRIMARY_PLAYER_TZ),
    pendingArticles,
    inventoryDepth,
    todayPuzzlePresent: todayPuzzle !== null,
    cells: buildInventoryCells({ now, existingKeys, attemptCounts, dateKeys }).reverse(),
    generations: runs.map(serializeGeneration),
    recentGenerationCostUsd: runs.reduce((sum, run) => sum + (run.costUsd ?? 0), 0),
  };
}

export async function loadAdminInventory(slug: string, now = new Date()) {
  const game = await resolveAdminGame(slug);
  if (!game) return null;

  const utcToday = getDateKey(now, "UTC");
  const publishedKeys = await listAllPuzzleDateKeys(game.id);
  const dateKeys = mergeInventoryDateKeys(utcToday, publishedKeys);
  const attemptCounts = await countAttemptsByDate(game.id, dateKeys);

  return {
    game: { id: game.id, slug: game.slug, name: game.name },
    utcToday,
    pacificToday: getDateKey(now, PRIMARY_PLAYER_TZ),
    cells: buildInventoryCells({
      now,
      existingKeys: publishedKeys,
      attemptCounts,
      dateKeys,
    }).reverse(),
  };
}

export async function loadAdminDate(slug: string, dateKey: string, now = new Date()) {
  const game = await resolveAdminGame(slug);
  if (!game) return null;
  await reapStaleGenerations();
  const [puzzle, attemptCounts, runs] = await Promise.all([
    loadPuzzleForDate(game.id, dateKey),
    countAttemptsByDate(game.id, [dateKey]),
    listGenerationsForTopic(game.id, { dateKey }),
  ]);
  return {
    game: { id: game.id, slug: game.slug, name: game.name },
    dateKey,
    live: isLiveDate(dateKey, now),
    playerCount: attemptCounts.get(dateKey) ?? 0,
    generations: runs.map(serializeGeneration),
    puzzle: puzzle
      ? {
          id: puzzle.id,
          answer: puzzle.answer,
          answerType: puzzle.answerType,
          clue: puzzle.clue,
          detail: puzzle.detail,
          promptPath: puzzle.promptPath,
          model: puzzle.model,
          publishedAt: puzzle.publishedAt,
          article: {
            id: puzzle.article.id,
            url: puzzle.article.url,
            title: sanitizeFeedText(puzzle.article.title, MAX_FEED_TITLE_LENGTH),
            status: puzzle.article.status,
            rejectionCount: puzzle.article.rejectionCount,
            rejectionReason: puzzle.article.rejectionReason,
            articleTextLength: puzzle.article.articleText?.length ?? 0,
          },
        }
      : null,
  };
}
