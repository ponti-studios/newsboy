import { db, eq, generationCandidates, generationRuns, sql } from "@pontistudios/db";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanAll } from "../../data/test-db";
import { seedGame } from "./test-helpers";

beforeEach(async () => {
  await cleanAll();
});

function baseRun(
  gameId: number | null,
  overrides: Partial<typeof generationRuns.$inferInsert> = {},
) {
  return {
    gamesTopicId: gameId,
    dateKey: "2026-06-25",
    sourceMode: "feeds" as const,
    promptSource: "file" as const,
    promptText: "prompt",
    model: "test-model",
    createdByHominemUserId: "user-1",
    ...overrides,
  };
}

describe("listGenerationsForTopic", () => {
  it("returns runs newest first, scoped to the topic", async () => {
    const game = await seedGame();
    const [older] = await db
      .insert(generationRuns)
      .values(baseRun(game.id, { dateKey: "2026-06-24" }))
      .returning();
    const [newer] = await db
      .insert(generationRuns)
      .values(baseRun(game.id, { dateKey: "2026-06-25" }))
      .returning();

    const { listGenerationsForTopic } = await import("../data/generation-runs.server");
    const result = await listGenerationsForTopic(game.id);

    expect(result.map((r) => r.id)).toEqual([newer.id, older.id]);
  });

  it("filters by dateKey when given", async () => {
    const game = await seedGame();
    await db.insert(generationRuns).values(baseRun(game.id, { dateKey: "2026-06-24" }));
    const [match] = await db
      .insert(generationRuns)
      .values(baseRun(game.id, { dateKey: "2026-06-25" }))
      .returning();

    const { listGenerationsForTopic } = await import("../data/generation-runs.server");
    const result = await listGenerationsForTopic(game.id, { dateKey: "2026-06-25" });

    expect(result.map((r) => r.id)).toEqual([match.id]);
  });
});

describe("getActiveAdminGenerationRun", () => {
  it("returns the most recent running admin_ui run for the topic", async () => {
    const game = await seedGame();
    await db
      .insert(generationRuns)
      .values(baseRun(game.id, { status: "succeeded", trigger: "admin_ui" }));
    const [running] = await db
      .insert(generationRuns)
      .values(baseRun(game.id, { status: "running", trigger: "admin_ui" }))
      .returning();

    const { getActiveAdminGenerationRun } = await import("../data/generation-runs.server");
    const result = await getActiveAdminGenerationRun(game.id);

    expect(result?.id).toBe(running.id);
  });

  it("ignores running runs triggered outside the admin UI", async () => {
    const game = await seedGame();
    await db.insert(generationRuns).values(baseRun(game.id, { status: "running", trigger: "cli" }));

    const { getActiveAdminGenerationRun } = await import("../data/generation-runs.server");
    const result = await getActiveAdminGenerationRun(game.id);

    expect(result).toBeNull();
  });
});

describe("getGenerationCostReport", () => {
  it("aggregates cost and tokens across all runs, including topic-less CLI runs", async () => {
    const game = await seedGame();
    await db.insert(generationRuns).values([
      baseRun(game.id, {
        trigger: "admin_ui",
        environment: "railway",
        status: "succeeded",
        costUsd: 0.5,
        totalTokens: 100,
      }),
      baseRun(null, {
        trigger: "cli",
        environment: "local",
        status: "failed",
        costUsd: 0.25,
        totalTokens: 50,
      }),
    ]);

    const { getGenerationCostReport } = await import("../data/generation-runs.server");
    const report = await getGenerationCostReport({ sinceDays: 30 });

    expect(report.totalRuns).toBe(2);
    expect(report.totalCostUsd).toBeCloseTo(0.75);
    expect(report.totalTokens).toBe(150);
    expect(report.byTrigger.map((r) => r.key).sort()).toEqual(["admin_ui", "cli"]);
    expect(report.byModel).toMatchObject([
      {
        key: "test-model",
        count: 2,
        succeededCount: 1,
        failedCount: 1,
        successRate: 0.5,
        failureRate: 0.5,
      },
    ]);
  });

  it("excludes runs created before the sinceDays cutoff", async () => {
    const game = await seedGame();
    const [oldRun] = await db
      .insert(generationRuns)
      .values(baseRun(game.id, { costUsd: 1, totalTokens: 10 }))
      .returning();
    await db
      .update(generationRuns)
      .set({ createdAt: sql`now() - interval '60 days'` })
      .where(eq(generationRuns.id, oldRun.id));

    const { getGenerationCostReport } = await import("../data/generation-runs.server");
    const report = await getGenerationCostReport({ sinceDays: 30 });

    expect(report.totalRuns).toBe(0);
  });
});

describe("getGenerationWithCandidates", () => {
  it("returns the run with its candidates, ordinal-ordered", async () => {
    const game = await seedGame();
    const [run] = await db.insert(generationRuns).values(baseRun(game.id)).returning();
    await db.insert(generationCandidates).values([
      {
        runId: run.id,
        ordinal: 1,
        payload: { answer: "B" },
        normalizedAnswer: "B",
        valid: true,
      },
      {
        runId: run.id,
        ordinal: 0,
        payload: { answer: "A" },
        normalizedAnswer: "A",
        valid: true,
      },
    ]);

    const { getGenerationWithCandidates } = await import("../data/generation-runs.server");
    const result = await getGenerationWithCandidates(game.id, run.id);

    expect(result?.generation.id).toBe(run.id);
    expect(result?.candidates.map((c) => c.ordinal)).toEqual([0, 1]);
  });

  it("returns null when the run doesn't belong to that topic", async () => {
    const game = await seedGame();
    const other = await seedGame({ slug: "sports", feedUrl: "https://example.com/sports" });
    const [run] = await db.insert(generationRuns).values(baseRun(other.id)).returning();

    const { getGenerationWithCandidates } = await import("../data/generation-runs.server");
    const result = await getGenerationWithCandidates(game.id, run.id);

    expect(result).toBeNull();
  });
});
