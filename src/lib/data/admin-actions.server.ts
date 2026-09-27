/**
 * Data access for `game_admin_actions` — the audit trail of operator
 * writes (generate, publish, replace, etc) made through the admin console.
 */

import type { GameAdminActionKind } from "@pontistudios/db";
import { adminActions, and, count, db, eq, gte, inArray } from "@pontistudios/db";

export async function countRecentGenerateActions(
  hominemUserId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(adminActions)
    .where(
      and(
        eq(adminActions.hominemUserId, hominemUserId),
        inArray(adminActions.kind, ["generate", "preview"]),
        gte(adminActions.at, since),
      ),
    );
  return row?.value ?? 0;
}

export async function recordAdminAction(input: {
  hominemUserId?: string;
  kind: GameAdminActionKind;
  gamesTopicId: number;
  dateUtc?: string;
  dryRun?: boolean;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(adminActions).values({
    hominemUserId: input.hominemUserId ?? "system:generate",
    kind: input.kind,
    gamesTopicId: input.gamesTopicId,
    dateUtc: input.dateUtc,
    dryRun: input.dryRun ?? false,
    payload: input.payload ?? {},
    result: input.result ?? {},
  });
}
