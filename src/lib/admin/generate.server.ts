import { DEFAULT_TEXT_MODEL, getConfiguredTextModel } from "@pontistudios/ai";
import type { Article, GamesTopic } from "@pontistudios/db";
import { and, db, eq, generationCandidates, generationRuns, lt } from "@pontistudios/db";
import { countRecentGenerateActions, recordAdminAction } from "../data/admin-actions.server";
import {
  getPendingArticlesByIds,
  getPendingArticlesForGame,
  getPendingArticlesForTopics,
} from "../data/articles.server";
import { listTopicFeedHosts } from "../data/games.server";
import { getRecentAnswers, getStoredAnswers } from "../data/puzzles.server";
import { getErrorMessage } from "../errors";
import { MAX_FEED_TITLE_LENGTH, sanitizeFeedText } from "../generation/feed-text";
import {
  articleToFeedItem,
  DEFAULT_GENERATION_MAX_TOKENS,
  detectRunEnvironment,
  generateCandidates,
  getSystemPromptForGame,
  matchArticle,
} from "../generation/generate.server";
import { fetchFeedItems } from "../generation/ingest.server";
import type { FeedItem, GenerationProgressUpdate } from "../generation/types";
import { isDateKey, parseDate } from "../puzzle/date";
import { PROMPT_TEST_CASES } from "../values/prompt-test-cases";
import { GenerateReasonType } from "./generate-copy";
import {
  GENERATION_PROMPT_FILES,
  type GenerateErr,
  type GenerateFeedUrlResult,
  type GenerateProgressEvent,
  type GenerateRequest,
} from "./generate-types";
import { publishGenerationEvent } from "./generation-events.server";

const GENERATION_RATE_LIMIT = 20;
const GENERATION_ARTICLE_CAP = 12;
const GENERATION_BATCH_SIZE = 8;
const RUN_TTL_DAYS = 30;
const REAP_AFTER_MS = 10 * 60 * 1000;
const MIN_GENERATION_MAX_TOKENS = 200;
const MAX_GENERATION_MAX_TOKENS = 16_000;

type GenerationProgressUiMap = {
  [Phase in GenerationProgressUpdate["phase"]]: (
    update: Extract<GenerationProgressUpdate, { phase: Phase }>,
  ) => GenerateProgressEvent;
};

const GENERATION_PROGRESS_UI: GenerationProgressUiMap = {
  requesting: (update) => ({
    type: "stage",
    stage: "model",
    label: "Asking the model",
    detail: `Attempt ${update.attempt}/${update.maxAttempts}: sending ${update.articleCount} stories for a ranked answer batch.`,
  }),
  received: (update) => ({
    type: "stage",
    stage: "model",
    label: "Reading the model response",
    detail: update.llmError
      ? `Attempt ${update.attempt}/${update.maxAttempts}: the provider returned an error.`
      : `Attempt ${update.attempt}/${update.maxAttempts}: received ${update.candidateCount} candidates; checking them for publishability.`,
  }),
  retrying: (update) => ({
    type: "stage",
    stage: "model",
    label: "Trying a fresh batch",
    detail: `Attempt ${update.attempt}/${update.maxAttempts} produced no publishable word; asking again with those answers excluded.`,
  }),
};

function toGenerateProgressEvent(update: GenerationProgressUpdate): GenerateProgressEvent {
  return (
    GENERATION_PROGRESS_UI[update.phase] as (
      value: GenerationProgressUpdate,
    ) => GenerateProgressEvent
  )(update);
}

export function studioModelAllowlist(): string[] {
  return [...new Set([DEFAULT_TEXT_MODEL, getConfiguredTextModel()])];
}

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    return true;
  }
  if (PRIVATE_V4.some((pattern) => pattern.test(host))) return true;
  if (
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  ) {
    return true;
  }
  return false;
}

function productionLock() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT);
}

export async function assertGenerateFeedUrl(raw: string): Promise<GenerateFeedUrlResult> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, code: "INVALID_URL" };
  }
  if (parsed.protocol !== "https:") return { ok: false, code: "HTTP_NOT_ALLOWED" };
  if (isBlockedHostname(parsed.hostname)) return { ok: false, code: "PRIVATE_HOST" };
  if (productionLock()) {
    const allowed = new Set(await listTopicFeedHosts());
    const host = parsed.hostname.replace(/^www\./, "");
    if (!allowed.has(host) && !allowed.has(parsed.hostname)) {
      return { ok: false, code: "HOST_NOT_ALLOWED" };
    }
  }
  return { ok: true, href: parsed.href };
}

export async function expireGenerations(olderThanDays = RUN_TTL_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(generationRuns)
    .where(lt(generationRuns.createdAt, cutoff))
    .returning({ id: generationRuns.id });
  return deleted.length;
}

export async function reapStaleGenerations(): Promise<number> {
  const cutoff = new Date(Date.now() - REAP_AFTER_MS);
  const updated = await db
    .update(generationRuns)
    .set({
      status: "failed",
      llmError: "reaped",
      finishedAt: new Date(),
    })
    .where(and(eq(generationRuns.status, "running"), lt(generationRuns.createdAt, cutoff)))
    .returning({ id: generationRuns.id });
  return updated.length;
}

/**
 * Validates the request, resolves sources, and inserts the "running" row —
 * all fast, synchronous work bounded by one HTTP request/response. The slow
 * part (the actual LLM call) is handed off to `runGenerationInBackground`
 * WITHOUT being awaited, so this returns as soon as the run exists. Progress
 * after that point is delivered over the in-memory bus (see
 * generation-events.server.ts) and picked up by the SSE route — the run
 * itself is never tied to the *client's* request/response lifecycle, so a
 * closed tab, a proxy timeout, or a page reload can reconnect and resume
 * watching it. "Resumable" here means the UI can reattach — it does NOT mean
 * the generation survives a server process restart: `runGenerationInBackground`
 * is an unawaited in-process promise, so a deploy or crash mid-run kills the
 * work and the row is left stuck at "running" until `reapStaleGenerations`
 * marks it failed.
 */
export async function startGeneration(
  game: GamesTopic,
  input: GenerateRequest,
  userId: string,
): Promise<{ ok: true; runId: number } | GenerateErr> {
  if (!isDateKey(input.dateKey)) {
    return { ok: false, code: "INVALID_DATE", error: "dateKey must be YYYY-MM-DD" };
  }

  const model = input.model ?? getConfiguredTextModel();
  if (!studioModelAllowlist().includes(model)) {
    return { ok: false, code: "INVALID_MODEL", error: `model is not on the studio allowlist` };
  }

  if (
    input.maxTokens !== undefined &&
    (input.maxTokens < MIN_GENERATION_MAX_TOKENS || input.maxTokens > MAX_GENERATION_MAX_TOKENS)
  ) {
    return {
      ok: false,
      code: "INVALID_MAX_TOKENS",
      error: `maxTokens must be between ${MIN_GENERATION_MAX_TOKENS} and ${MAX_GENERATION_MAX_TOKENS}`,
    };
  }
  const maxTokens = input.maxTokens ?? DEFAULT_GENERATION_MAX_TOKENS;
  const reasoningEffort = input.reasoningEffort ?? "default";

  const prompt = resolvePrompt(game, input);
  if (!prompt.ok) return prompt;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await countRecentGenerateActions(userId, hourAgo);
  if (recent >= GENERATION_RATE_LIMIT) {
    return { ok: false, code: "RATE_LIMITED", error: "generation rate limit is 20 per hour" };
  }

  await reapStaleGenerations();
  await expireGenerations();

  const source = await resolveSource(game, input);
  if (!source.ok) return source;

  const date = parseDate(input.dateKey);
  const [recentAnswers, storedAnswers] = date
    ? await Promise.all([getRecentAnswers(game, date), getStoredAnswers(game.id)])
    : [new Set<string>(), await getStoredAnswers(game.id)];
  const excludedAnswers = [...new Set([...recentAnswers, ...storedAnswers])];

  const [run] = await db
    .insert(generationRuns)
    .values({
      gamesTopicId: game.id,
      dateKey: input.dateKey,
      status: "running",
      sourceMode: input.sourceMode,
      articleIds: input.articleIds ?? [],
      promptSource: prompt.promptSource,
      promptPath: prompt.promptPath,
      promptText: prompt.promptText,
      model,
      excludedAnswerCount: excludedAnswers.length,
      feedItemCount: source.feedItems.length,
      publishable: source.publishable,
      compareGroupId: input.compareGroupId,
      createdByHominemUserId: userId,
      requestedMaxTokens: maxTokens,
      reasoningEffort,
      trigger: "admin_ui",
      environment: detectRunEnvironment(),
    })
    .returning();
  if (!run) return { ok: false, code: "INVALID_SOURCE", error: "failed to create generation" };

  void runGenerationInBackground(run.id, game, input, userId, {
    model,
    maxTokens,
    reasoningEffort,
    prompt,
    source,
    excludedAnswers,
  });

  return { ok: true, runId: run.id };
}

async function runGenerationInBackground(
  runId: number,
  game: GamesTopic,
  input: GenerateRequest,
  userId: string,
  ctx: {
    model: string;
    maxTokens: number;
    reasoningEffort: string;
    prompt: { promptSource: "file" | "paste"; promptPath: string | null; promptText: string };
    source: { feedItems: FeedItem[]; articles: Article[]; feedUrl: string; publishable: boolean };
    excludedAnswers: string[];
  },
): Promise<void> {
  const publish = (event: GenerateProgressEvent) => publishGenerationEvent(runId, event);
  try {
    publish({
      type: "stage",
      stage: "model",
      label: "Asking the model",
      detail: `One completion on ${ctx.model}. This can take up to a minute.`,
    });

    const generated = await generateCandidates(input.dateKey, {
      feedItems: ctx.source.feedItems,
      feedUrl: ctx.source.feedUrl,
      systemPrompt: ctx.prompt.promptText,
      excludedAnswers: ctx.excludedAnswers,
      model: ctx.model,
      maxTokens: ctx.maxTokens,
      reasoningEffort: ctx.reasoningEffort,
      onProgress: (update) => publish(toGenerateProgressEvent(update)),
    });

    publish({
      type: "stage",
      stage: "score",
      label: "Checking each word",
      detail: "Five letters, dictionary, leaks, and a matching story.",
    });

    const storedCandidates = generated.candidates.map((entry, ordinal) => {
      const article = ctx.source.publishable
        ? matchArticle(entry.candidate, ctx.source.articles)
        : null;
      const reasons = [...entry.validation.reasons];
      if (ctx.source.publishable && !article) reasons.push(GenerateReasonType.UnmatchedArticle);
      const valid = ctx.source.publishable
        ? entry.validation.valid && article !== null
        : entry.validation.valid;
      return {
        ordinal,
        payload: entry.candidate,
        answer: entry.validation.answer,
        valid,
        reasons,
        articleId: article?.id ?? null,
        articleTitle:
          sanitizeFeedText(
            article?.title ?? entry.candidate.sources[0]?.title ?? "",
            MAX_FEED_TITLE_LENGTH,
          ) || null,
        articleUrl: article?.url ?? entry.candidate.sources[0]?.url ?? null,
        candidate: entry.candidate,
      };
    });

    if (storedCandidates.length > 0) {
      await db.insert(generationCandidates).values(
        storedCandidates.map((candidate) => ({
          runId,
          ordinal: candidate.ordinal,
          payload: candidate.payload,
          normalizedAnswer: candidate.answer,
          valid: candidate.valid,
          reasons: candidate.reasons,
          articleId: candidate.articleId,
        })),
      );
    }

    const selectedIndex = storedCandidates.findIndex((candidate) => candidate.valid);
    const failed = Boolean(generated.llmError || generated.feedError);
    await db
      .update(generationRuns)
      .set({
        status: failed ? "failed" : "succeeded",
        selectedIndex: selectedIndex === -1 ? null : selectedIndex,
        feedError: generated.feedError,
        llmError: generated.llmError,
        feedItemCount: generated.feedItemCount,
        promptTokens: generated.usage.promptTokens,
        completionTokens: generated.usage.completionTokens,
        reasoningTokens: generated.usage.reasoningTokens,
        totalTokens: generated.usage.totalTokens,
        costUsd: generated.usage.costUsd,
        finishedAt: new Date(),
      })
      .where(and(eq(generationRuns.id, runId), eq(generationRuns.status, "running")));

    await recordAdminAction({
      hominemUserId: userId,
      kind: "generate",
      gamesTopicId: game.id,
      dateUtc: input.dateKey,
      payload: { sourceMode: input.sourceMode, model: ctx.model, generationId: runId },
      result: { candidateCount: storedCandidates.length, selectedIndex, failed },
    });

    publish({
      type: "stage",
      stage: "done",
      label: "Ready to review",
      detail: `${storedCandidates.filter((candidate) => candidate.valid).length} of ${storedCandidates.length} could become a puzzle.`,
    });
  } catch (err) {
    await db
      .update(generationRuns)
      .set({ status: "failed", llmError: getErrorMessage(err), finishedAt: new Date() })
      .where(and(eq(generationRuns.id, runId), eq(generationRuns.status, "running")));
    publish({
      type: "stage",
      stage: "done",
      label: "Ready to review",
      detail: "The generation failed.",
    });
  }
}

function resolvePrompt(
  game: GamesTopic,
  input: GenerateRequest,
):
  | { ok: true; promptSource: "file" | "paste"; promptPath: string | null; promptText: string }
  | GenerateErr {
  if (input.promptSource === "paste") {
    const promptText = input.promptText?.trim() ?? "";
    if (promptText.length < 20) {
      return { ok: false, code: "INVALID_PROMPT", error: "pasted prompt is empty" };
    }
    return { ok: true, promptSource: "paste", promptPath: null, promptText };
  }
  const promptPath = input.promptPath ?? game.systemPromptPath;
  if (
    !GENERATION_PROMPT_FILES.includes(promptPath as (typeof GENERATION_PROMPT_FILES)[number]) &&
    promptPath !== game.systemPromptPath
  ) {
    return { ok: false, code: "INVALID_PROMPT", error: "prompt file is not allowed" };
  }
  return {
    ok: true,
    promptSource: "file",
    promptPath,
    promptText: getSystemPromptForGame({ systemPromptPath: promptPath }),
  };
}

async function resolveSource(
  game: GamesTopic,
  input: GenerateRequest,
): Promise<
  | { ok: true; feedItems: FeedItem[]; articles: Article[]; feedUrl: string; publishable: boolean }
  | GenerateErr
> {
  if (input.sourceMode === "rss") {
    if (!input.feedUrl) return { ok: false, code: "INVALID_SOURCE", error: "feedUrl is required" };
    const allowed = await assertGenerateFeedUrl(input.feedUrl);
    if (!allowed.ok) return { ok: false, code: allowed.code, error: allowed.code };
    try {
      const feedItems = await fetchFeedItems(allowed.href);
      return { ok: true, feedItems, articles: [], feedUrl: allowed.href, publishable: false };
    } catch {
      return { ok: false, code: "INVALID_SOURCE", error: "failed to fetch RSS feed" };
    }
  }

  if (input.sourceMode === "fixtures") {
    const fixture = PROMPT_TEST_CASES.find((entry) => entry.id === input.fixtureId);
    if (!fixture) return { ok: false, code: "INVALID_SOURCE", error: "unknown fixture id" };
    return {
      ok: true,
      feedItems: fixture.feedItems,
      articles: [],
      feedUrl: `fixture:${fixture.id}`,
      publishable: false,
    };
  }

  let articles: Article[] = [];
  if (input.sourceMode === "articles") {
    articles = await getPendingArticlesByIds(input.articleIds ?? [], GENERATION_ARTICLE_CAP);
  } else if (input.sourceMode === "feeds") {
    articles = await getPendingArticlesForTopics(input.feedIds ?? [game.id], GENERATION_BATCH_SIZE);
  } else {
    articles = await getPendingArticlesForGame(game, GENERATION_BATCH_SIZE);
  }

  return {
    ok: true,
    feedItems: articles.map(articleToFeedItem),
    articles,
    feedUrl: game.feedUrl,
    publishable: true,
  };
}
