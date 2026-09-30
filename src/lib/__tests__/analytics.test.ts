import { afterEach, describe, expect, it } from "vitest";

import { db, gameEvents, like, sql } from "~/lib/infrastructure/db";
import { loadFunnelReport } from "../data/analytics.server";

const SESSION_PREFIX = "analytics-review-limit-";

async function cleanFixtures() {
  await db.delete(gameEvents).where(like(gameEvents.sessionId, `${SESSION_PREFIX}%`));
}

describe("loadFunnelReport", () => {
  afterEach(cleanFixtures);

  it("applies the topic filter before the global event limit", async () => {
    await cleanFixtures();
    await db.execute(sql`
      INSERT INTO labs.game_events
        (event, session_id, topic_slug, puzzle_date, attempt_count, clue_count, acquisition_source, created_at)
      SELECT
        'game_started', ${SESSION_PREFIX} || series::text, 'noise', '2026-09-30', 0, 0, NULL,
        '2026-09-30T00:00:00Z'::timestamptz
      FROM generate_series(1, 10000) AS generated(series)
    `);
    await db.insert(gameEvents).values({
      event: "game_started",
      sessionId: `${SESSION_PREFIX}target`,
      topicSlug: "target",
      puzzleDate: "2026-09-30",
      createdAt: new Date("2026-09-29T00:00:00Z"),
    });

    await expect(
      loadFunnelReport({ topicSlug: "target", now: new Date("2026-10-01T00:00:00Z") }),
    ).resolves.toMatchObject([{ topicSlug: "target", starts: 1 }]);
  });
});
