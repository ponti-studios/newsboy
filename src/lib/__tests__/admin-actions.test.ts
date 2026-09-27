import { adminActions, db, eq, sql } from "@pontistudios/db";
import { beforeEach, describe, expect, it } from "vitest";
import { cleanAll } from "../../data/test-db";
import { seedGame } from "./test-helpers";

beforeEach(async () => {
  await cleanAll();
});

describe("recordAdminAction", () => {
  it("inserts a row with the given kind, defaulting payload/result/dryRun", async () => {
    const game = await seedGame();

    const { recordAdminAction } = await import("../data/admin-actions.server");
    await recordAdminAction({
      hominemUserId: "user-1",
      kind: "publish",
      gamesTopicId: game.id,
      dateUtc: "2026-06-25",
    });

    const row = await db.query.adminActions.findFirst({
      where: (t, { eq }) => eq(t.gamesTopicId, game.id),
    });
    expect(row?.kind).toBe("publish");
    expect(row?.hominemUserId).toBe("user-1");
    expect(row?.dryRun).toBe(false);
    expect(row?.payload).toEqual({});
    expect(row?.result).toEqual({});
  });

  it("falls back to the system actor when no hominemUserId is given", async () => {
    const game = await seedGame();

    const { recordAdminAction } = await import("../data/admin-actions.server");
    await recordAdminAction({ kind: "generate", gamesTopicId: game.id });

    const row = await db.query.adminActions.findFirst({
      where: (t, { eq }) => eq(t.gamesTopicId, game.id),
    });
    expect(row?.hominemUserId).toBe("system:generate");
  });
});

describe("countRecentGenerateActions", () => {
  it("counts only generate/preview actions for the user within the window", async () => {
    const game = await seedGame();
    await db.insert(adminActions).values([
      { hominemUserId: "user-1", kind: "generate", gamesTopicId: game.id },
      { hominemUserId: "user-1", kind: "preview", gamesTopicId: game.id },
      { hominemUserId: "user-1", kind: "publish", gamesTopicId: game.id },
      { hominemUserId: "user-2", kind: "generate", gamesTopicId: game.id },
    ]);

    const { countRecentGenerateActions } = await import("../data/admin-actions.server");
    const result = await countRecentGenerateActions("user-1", new Date(Date.now() - 60_000));

    expect(result).toBe(2);
  });

  it("excludes actions older than the since cutoff", async () => {
    const game = await seedGame();
    const [row] = await db
      .insert(adminActions)
      .values({ hominemUserId: "user-1", kind: "generate", gamesTopicId: game.id })
      .returning();
    await db
      .update(adminActions)
      .set({ at: sql`now() - interval '1 hour'` })
      .where(eq(adminActions.id, row.id));

    const { countRecentGenerateActions } = await import("../data/admin-actions.server");
    const result = await countRecentGenerateActions("user-1", new Date(Date.now() - 60_000));

    expect(result).toBe(0);
  });
});
