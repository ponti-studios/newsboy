import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  articles,
  db,
  eq,
  gamesPuzzles,
  gamesTopics,
  generationCandidates,
  generationRuns,
} from "@pontistudios/db";
import { cleanAll } from "../../data/test-db";
import { publishCandidate } from "../admin/publish";

const ACTOR = "ops-1";

async function seedPublishable() {
  const [game] = await db
    .insert(gamesTopics)
    .values({
      slug: "reality",
      name: "Reality",
      feedUrl: "https://realityblurred.com/feed",
      feedLabel: "Test Feed",
      systemPromptPath: "src/prompts/game-generation.md",
    })
    .returning();
  const [article] = await db
    .insert(articles)
    .values({
      gamesTopicId: game.id,
      url: "https://realityblurred.com/story",
      title: "A clash",
      status: "pending",
    })
    .returning();
  const [generation] = await db
    .insert(generationRuns)
    .values({
      gamesTopicId: game.id,
      dateKey: "2026-06-25",
      status: "succeeded",
      sourceMode: "inventory",
      promptSource: "file",
      promptPath: "src/prompts/game-generation.md",
      promptText: "prompt",
      model: "deepseek/deepseek-v4-flash",
      publishable: true,
      createdByHominemUserId: "user-1",
    })
    .returning();
  const payload = {
    answer: "Drama",
    answerType: "moment",
    clue: "A clash that keeps the whole cast spinning.",
    detail: "A single conflict can dominate the full episode.",
    sources: [{ url: "https://realityblurred.com/story", title: "A clash", publishedAt: "" }],
  };
  const [candidate] = await db
    .insert(generationCandidates)
    .values({
      runId: generation.id,
      ordinal: 0,
      payload,
      normalizedAnswer: "DRAMA",
      valid: true,
      reasons: [],
      articleId: article.id,
    })
    .returning();
  return { game, article, generation, candidate };
}

describe("publishCandidate", () => {
  beforeEach(async () => {
    await cleanAll();
  });

  afterEach(async () => {
    await cleanAll();
  });

  it("writes a new puzzle for an empty date", async () => {
    const { game, article, generation, candidate } = await seedPublishable();
    const result = await publishCandidate({
      game,
      generationId: generation.id,
      candidateId: candidate.id,
      userId: ACTOR,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replaced).toBe(false);
    const puzzle = await db.query.gamesPuzzles.findFirst({
      where: (table, { eq }) => eq(table.id, result.puzzleId),
    });
    expect(puzzle?.answer).toBe("DRAMA");
    expect(puzzle?.generationRunId).toBe(generation.id);
    const used = await db.query.articles.findFirst({
      where: (table, { eq }) => eq(table.id, article.id),
    });
    expect(used?.status).toBe("used");
  });

  it("replaces an existing puzzle for that date", async () => {
    const { game, article, generation, candidate } = await seedPublishable();
    const [otherArticle] = await db
      .insert(articles)
      .values({
        gamesTopicId: game.id,
        url: "https://realityblurred.com/old",
        title: "Old",
        status: "used",
      })
      .returning();
    await db.insert(gamesPuzzles).values({
      gamesTopicId: game.id,
      articleId: otherArticle.id,
      dateUtc: "2026-06-25",
      answer: "House",
      answerType: "place",
      normalizedAnswer: "HOUSE",
      clue: "old clue",
      detail: "old detail",
    });

    const result = await publishCandidate({
      game,
      generationId: generation.id,
      candidateId: candidate.id,
      userId: ACTOR,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replaced).toBe(true);
    const puzzle = await db.query.gamesPuzzles.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.gamesTopicId, game.id), eq(table.dateUtc, "2026-06-25")),
    });
    expect(puzzle?.answer).toBe("DRAMA");
    expect(puzzle?.articleId).toBe(article.id);
  });

  it("refuses a review-only generation", async () => {
    const { game, generation, candidate } = await seedPublishable();
    await db
      .update(generationRuns)
      .set({ publishable: false })
      .where(eq(generationRuns.id, generation.id));
    const result = await publishCandidate({
      game,
      generationId: generation.id,
      candidateId: candidate.id,
      userId: ACTOR,
    });
    expect(result).toMatchObject({ ok: false, code: "NOT_PUBLISHABLE" });
  });
});
