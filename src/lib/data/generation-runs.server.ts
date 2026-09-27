/**
 * Data access for `game_generation_runs` / `game_generation_candidates`
 * — the persisted, non-publishing record of an admin generation attempt
 * before any candidate is published to `games_puzzles`.
 */

import {
  and,
  articles,
  count,
  db,
  desc,
  eq,
  generationCandidates,
  generationRuns,
  gte,
  sql,
} from "@pontistudios/db";

export async function listGenerationsForTopic(
  gameId: number,
  options: { limit?: number; dateKey?: string } = {},
) {
  const conditions = [eq(generationRuns.gamesTopicId, gameId)];
  if (options.dateKey) {
    conditions.push(sql`${generationRuns.dateKey} = ${options.dateKey}::date`);
  }
  return db
    .select({
      id: generationRuns.id,
      dateKey: generationRuns.dateKey,
      status: generationRuns.status,
      sourceMode: generationRuns.sourceMode,
      model: generationRuns.model,
      publishable: generationRuns.publishable,
      llmError: generationRuns.llmError,
      createdByEmail: generationRuns.createdByEmail,
      createdAt: generationRuns.createdAt,
      finishedAt: generationRuns.finishedAt,
      requestedMaxTokens: generationRuns.requestedMaxTokens,
      reasoningEffort: generationRuns.reasoningEffort,
      promptTokens: generationRuns.promptTokens,
      completionTokens: generationRuns.completionTokens,
      reasoningTokens: generationRuns.reasoningTokens,
      totalTokens: generationRuns.totalTokens,
      costUsd: generationRuns.costUsd,
    })
    .from(generationRuns)
    .where(and(...conditions))
    .orderBy(desc(generationRuns.createdAt))
    .limit(options.limit ?? 20);
}

/** Most recent still-running admin-triggered run for a topic, if any — used to resume the live view on page load/reload. */
export async function getActiveAdminGenerationRun(gameId: number): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: generationRuns.id })
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.gamesTopicId, gameId),
        eq(generationRuns.status, "running"),
        eq(generationRuns.trigger, "admin_ui"),
      ),
    )
    .orderBy(desc(generationRuns.createdAt))
    .limit(1);
  return row ?? null;
}

export type GenerationCostBreakdownRow = {
  key: string | null;
  count: number;
  costUsd: number;
  totalTokens: number;
};

export type GenerationModelBreakdownRow = GenerationCostBreakdownRow & {
  succeededCount: number;
  failedCount: number;
  successRate: number | null;
  failureRate: number | null;
};

export type GenerationCostReport = {
  sinceDays: number;
  totalRuns: number;
  totalCostUsd: number;
  totalTokens: number;
  byTrigger: GenerationCostBreakdownRow[];
  byEnvironment: GenerationCostBreakdownRow[];
  byModel: GenerationModelBreakdownRow[];
};

/**
 * Aggregate cost/token spend across ALL generation runs, regardless of
 * `gamesTopicId` — the point being that CLI runs (`gamesTopicId: null`)
 * never show up in `listGenerationsForTopic`, which is scoped to one topic.
 */
export async function getGenerationCostReport(
  options: { sinceDays?: number } = {},
): Promise<GenerationCostReport> {
  const sinceDays = options.sinceDays ?? 30;
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const scope = gte(generationRuns.createdAt, cutoff);

  const [totals] = await db
    .select({
      totalRuns: count(),
      totalCostUsd: sql<number>`coalesce(sum(${generationRuns.costUsd}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${generationRuns.totalTokens}), 0)`,
    })
    .from(generationRuns)
    .where(scope);

  const [byTrigger, byEnvironment, byModel] = await Promise.all([
    db
      .select({
        key: generationRuns.trigger,
        count: count(),
        costUsd: sql<number>`coalesce(sum(${generationRuns.costUsd}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${generationRuns.totalTokens}), 0)`,
      })
      .from(generationRuns)
      .where(scope)
      .groupBy(generationRuns.trigger)
      .orderBy(desc(sql`coalesce(sum(${generationRuns.costUsd}), 0)`)),
    db
      .select({
        key: generationRuns.environment,
        count: count(),
        costUsd: sql<number>`coalesce(sum(${generationRuns.costUsd}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${generationRuns.totalTokens}), 0)`,
      })
      .from(generationRuns)
      .where(scope)
      .groupBy(generationRuns.environment)
      .orderBy(desc(sql`coalesce(sum(${generationRuns.costUsd}), 0)`)),
    db
      .select({
        key: generationRuns.model,
        count: count(),
        costUsd: sql<number>`coalesce(sum(${generationRuns.costUsd}), 0)`,
        totalTokens: sql<number>`coalesce(sum(${generationRuns.totalTokens}), 0)`,
        succeededCount: sql<number>`count(*) filter (where ${generationRuns.status} = 'succeeded')`,
        failedCount: sql<number>`count(*) filter (where ${generationRuns.status} = 'failed')`,
      })
      .from(generationRuns)
      .where(scope)
      .groupBy(generationRuns.model)
      .orderBy(desc(sql`coalesce(sum(${generationRuns.costUsd}), 0)`)),
  ]);

  return {
    sinceDays,
    totalRuns: totals?.totalRuns ?? 0,
    totalCostUsd: Number(totals?.totalCostUsd ?? 0),
    totalTokens: Number(totals?.totalTokens ?? 0),
    byTrigger: byTrigger.map((row) => ({
      key: row.key,
      count: row.count,
      costUsd: Number(row.costUsd),
      totalTokens: Number(row.totalTokens),
    })),
    byEnvironment: byEnvironment.map((row) => ({
      key: row.key,
      count: row.count,
      costUsd: Number(row.costUsd),
      totalTokens: Number(row.totalTokens),
    })),
    byModel: byModel.map((row) => {
      const succeededCount = Number(row.succeededCount);
      const failedCount = Number(row.failedCount);
      const completedCount = succeededCount + failedCount;
      return {
        key: row.key,
        count: row.count,
        costUsd: Number(row.costUsd),
        totalTokens: Number(row.totalTokens),
        succeededCount,
        failedCount,
        successRate: completedCount > 0 ? succeededCount / completedCount : null,
        failureRate: completedCount > 0 ? failedCount / completedCount : null,
      };
    }),
  };
}

export async function getGenerationWithCandidates(gameId: number, generationId: number) {
  const [generation] = await db
    .select({
      id: generationRuns.id,
      dateKey: generationRuns.dateKey,
      status: generationRuns.status,
      sourceMode: generationRuns.sourceMode,
      model: generationRuns.model,
      publishable: generationRuns.publishable,
      llmError: generationRuns.llmError,
      feedError: generationRuns.feedError,
      promptSource: generationRuns.promptSource,
      promptPath: generationRuns.promptPath,
      selectedIndex: generationRuns.selectedIndex,
      feedItemCount: generationRuns.feedItemCount,
      createdByEmail: generationRuns.createdByEmail,
      createdAt: generationRuns.createdAt,
      finishedAt: generationRuns.finishedAt,
      requestedMaxTokens: generationRuns.requestedMaxTokens,
      reasoningEffort: generationRuns.reasoningEffort,
      promptTokens: generationRuns.promptTokens,
      completionTokens: generationRuns.completionTokens,
      reasoningTokens: generationRuns.reasoningTokens,
      totalTokens: generationRuns.totalTokens,
      costUsd: generationRuns.costUsd,
    })
    .from(generationRuns)
    .where(and(eq(generationRuns.id, generationId), eq(generationRuns.gamesTopicId, gameId)))
    .limit(1);
  if (!generation) return null;

  const candidates = await db
    .select({
      id: generationCandidates.id,
      ordinal: generationCandidates.ordinal,
      payload: generationCandidates.payload,
      valid: generationCandidates.valid,
      reasons: generationCandidates.reasons,
      articleId: generationCandidates.articleId,
      articleTitle: articles.title,
      articleUrl: articles.url,
    })
    .from(generationCandidates)
    .leftJoin(articles, eq(generationCandidates.articleId, articles.id))
    .where(eq(generationCandidates.runId, generationId))
    .orderBy(generationCandidates.ordinal);

  return { generation, candidates };
}
