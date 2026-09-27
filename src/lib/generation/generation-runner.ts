import type { GamesTopic } from "@pontistudios/db";

import {
  CIRCUIT_BREAKER_THRESHOLD,
  createCircuitBreaker,
  recordCircuitAttempt,
  type CircuitBreaker,
} from "./circuit-breaker";
import { isLiveDate, type GenerateRange } from "./generate-range";
import { GAME_READY_INVENTORY_DAYS } from "./candidate-validation";
import { generatePuzzleForGame } from "./generate.server";
import { recordAdminAction } from "../data/admin-actions.server";
import { countAttemptsByDate } from "../data/attempts.server";
import { getPendingArticlesForGame } from "../data/articles.server";
import { deletePuzzlesInRange, getExistingDateKeys } from "../data/puzzles.server";
import { createLogger } from "../logger.server";

export const GENERATE_ACTOR = "system:generate";

const logger = createLogger();

export async function planGapFill(game: GamesTopic, range: Extract<GenerateRange, { ok: true }>) {
  const existingKeys = await getExistingDateKeys(game.id, range.fromKey, range.toKey);
  const existing = new Set(existingKeys);
  return {
    dateKeys: range.dateKeys,
    existingKeys,
    missingKeys: range.dateKeys.filter((dateKey) => !existing.has(dateKey)),
  };
}

export async function planScopedRegenerate(
  game: GamesTopic,
  range: Extract<GenerateRange, { ok: true }>,
  now = new Date(),
) {
  const liveInRange = range.dateKeys.filter((dateKey) => isLiveDate(dateKey, now));
  if (!range.allowLiveDates && liveInRange.length > 0)
    return { ok: false as const, code: "LIVE_DATE" as const, liveInRange };
  const attemptCounts = await countAttemptsByDate(game.id, range.dateKeys);
  const datesWithAttempts = [...attemptCounts.entries()].filter(([, count]) => count > 0);
  if (datesWithAttempts.length > 0)
    return { ok: false as const, code: "HAS_ATTEMPTS" as const, datesWithAttempts };
  const existingKeys = await getExistingDateKeys(game.id, range.fromKey, range.toKey);
  return { ok: true as const, dateKeys: range.dateKeys, existingKeys, attemptCounts };
}

export async function gapFillOne(game: GamesTopic, dateKey: string, maxAttempts = 1) {
  return generatePuzzleForGame(game, dateKey, { maxAttempts, actor: GENERATE_ACTOR });
}

async function recordCircuitOpen(
  game: GamesTopic,
  dateKey: string,
  circuit: CircuitBreaker,
): Promise<void> {
  await recordAdminAction({
    kind: "generation_circuit_open",
    gamesTopicId: game.id,
    dateUtc: dateKey,
    payload: {
      consecutiveFailures: circuit.consecutiveFailures,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
    },
  });
}

async function generateDates(game: GamesTopic, dateKeys: string[], circuit: CircuitBreaker) {
  const childLogger = logger.child({ operation: "generateDates", game: game.slug });
  let generatedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let circuitOpened = false;
  for (const dateKey of dateKeys) {
    if (circuit.open) {
      skippedCount++;
      childLogger.debug(
        { event: "generate.puzzle.skipped", dateKey, reason: "circuit-open" },
        `${game.slug} ${dateKey}: skipped (circuit open)`,
      );
      continue;
    }
    const pendingArticles = await getPendingArticlesForGame(game, 1);
    if (pendingArticles.length === 0) {
      skippedCount++;
      childLogger.debug(
        { event: "generate.puzzle.skipped", dateKey, reason: "no-articles" },
        `${game.slug} ${dateKey}: skipped (no pending articles)`,
      );
      continue;
    }
    const puzzle = await generatePuzzleForGame(game, dateKey, { actor: GENERATE_ACTOR });
    if (puzzle) generatedCount++;
    else failedCount++;
    if (recordCircuitAttempt(circuit, puzzle !== null)) {
      circuitOpened = true;
      await recordCircuitOpen(game, dateKey, circuit);
    }
  }
  return { generatedCount, failedCount, skippedCount, circuitOpened };
}

export async function runGenerateRange(
  game: GamesTopic,
  range: Extract<GenerateRange, { ok: true }>,
  circuit: CircuitBreaker = createCircuitBreaker(),
) {
  const childLogger = logger.child({ operation: "generateRange", game: game.slug });
  if (range.force) {
    const plan = await planScopedRegenerate(game, range);
    if (!plan.ok) {
      await recordAdminAction({
        kind: "regenerate_dry_run",
        gamesTopicId: game.id,
        payload: { from: range.fromKey, to: range.toKey, code: plan.code },
        result: plan,
      });
      childLogger.error(
        { event: "generate.game.aborted", code: plan.code },
        `${game.slug}: force regenerate denied (${plan.code})`,
      );
      return {
        deletedCount: 0,
        generatedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        circuitOpened: false,
        aborted: plan,
      };
    }
    const deletedCount = await deletePuzzlesInRange(game.id, range.fromKey, range.toKey);
    childLogger.info(
      {
        event: "generate.game.planned",
        mode: "force",
        from: range.fromKey,
        to: range.toKey,
        dateCount: plan.dateKeys.length,
      },
      `${game.slug}: force regenerate ${plan.dateKeys.length} date(s)`,
    );
    const result = await generateDates(game, range.dateKeys, circuit);
    await recordAdminAction({
      kind: "gap_fill",
      gamesTopicId: game.id,
      payload: { force: true, from: range.fromKey, to: range.toKey },
      result: { deletedCount, ...result },
    });
    return { deletedCount, ...result, aborted: null };
  }

  const plan = await planGapFill(game, range);
  childLogger.info(
    {
      event: "generate.game.planned",
      mode: "gap_fill",
      from: range.fromKey,
      to: range.toKey,
      dateCount: plan.dateKeys.length,
      missingCount: plan.missingKeys.length,
    },
    `${game.slug}: gap fill ${plan.missingKeys.length} of ${plan.dateKeys.length} date(s)`,
  );
  const result = await generateDates(game, plan.missingKeys, circuit);
  await recordAdminAction({
    kind: "gap_fill",
    gamesTopicId: game.id,
    dateUtc: range.fromKey,
    payload: { force: false, from: range.fromKey, to: range.toKey, missing: plan.missingKeys },
    result,
  });
  return { deletedCount: 0, ...result, aborted: null };
}

export { GAME_READY_INVENTORY_DAYS };
