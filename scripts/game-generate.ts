import "dotenv/config";
import { parseArgs } from "node:util";

import { getConfiguredTextModel } from "@pontistudios/ai";
import { closeDb } from "@pontistudios/db";
import { withGenerateLock } from "~/lib/infrastructure/advisory-lock.server";

import { getErrorMessage } from "../src/lib/errors";
import { createLogger } from "../src/lib/logger.server";
import { CIRCUIT_BREAKER_THRESHOLD, createCircuitBreaker } from "../src/lib/generation/circuit-breaker";
import { detectRunEnvironment } from "../src/lib/generation/generate.server";
import { getDateKey } from "../src/lib/puzzle/date";
import { resolveGenerateRange, isDisposableDatabase } from "../src/lib/generation/generate-range";
import { GAME_READY_INVENTORY_DAYS, runGenerateRange } from "../src/lib/generation/generation-runner";
import { getActiveGames } from "../src/lib/data/games.server";
import {
  backfillPuzzlePublishedAt,
  countInventoryForRange,
} from "../src/lib/data/puzzles.server";
import { LabsServerEnv } from "../src/lib/infrastructure/env";

const logger = createLogger();

function parseGenerateArgs(): {
  force: boolean;
  daysAhead: number;
  from?: string;
  to?: string;
} {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      force: { type: "boolean" },
      "days-ahead": { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
    },
    strict: true,
  });
  return {
    force: values.force ?? false,
    daysAhead: values["days-ahead"]
      ? Number.parseInt(values["days-ahead"], 10)
      : GAME_READY_INVENTORY_DAYS,
    ...(values.from !== undefined ? { from: values.from } : {}),
    ...(values.to !== undefined ? { to: values.to } : {}),
  };
}

async function main() {
  LabsServerEnv.parse(process.env);

  const args = parseGenerateArgs();
  const runDateKey = getDateKey(new Date());
  const allowLiveDates = isDisposableDatabase();
  const range = resolveGenerateRange({
    force: args.force,
    daysAhead: args.daysAhead,
    todayKey: runDateKey,
    allowLiveDates,
    ...(args.from !== undefined ? { from: args.from } : {}),
    ...(args.to !== undefined ? { to: args.to } : {}),
  });
  if (!range.ok) throw new Error(range.error);

  const generateLogger = logger.child({
    operation: "generate",
    runDateKey,
  });

  if (allowLiveDates) {
    generateLogger.warn(
      { event: "generate.run.liveGuardDisabled", reason: "local database" },
      "local database detected — live-date protection is OFF; this run may delete or regenerate today's live dates",
    );
  }
  const runStartedAt = Date.now();
  generateLogger.info(
    {
      event: "generate.run.started",
      force: range.force,
      mode: range.force ? "force" : "gap_fill",
      from: range.fromKey,
      to: range.toKey,
      environment: detectRunEnvironment(),
      model: getConfiguredTextModel(),
      allowLive: range.allowLiveDates,
    },
    `starting generate run (${range.dateKeys.length} date[s] from ${range.fromKey} to ${range.toKey})`,
  );
  await backfillPuzzlePublishedAt();
  const { expireGenerations, reapStaleGenerations } =
    await import("../src/lib/admin/generate.server");
  await reapStaleGenerations();
  await expireGenerations();

  const locked = await withGenerateLock(async () => {
    const games = await getActiveGames();
    if (games.length === 0) throw new Error("No active games found");

    let totalDeleted = 0;
    let totalGenerated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    const circuit = createCircuitBreaker();
    for (const game of games) {
      const gameStartedAt = Date.now();
      const result = await runGenerateRange(game, range, circuit);
      if (result.aborted) {
        generateLogger.error(
          { event: "generate.game.aborted", game: game.slug, aborted: result.aborted },
          `${game.slug}: regenerate aborted`,
        );
        throw new Error(`${game.slug}: regenerate aborted (${result.aborted.code})`);
      }
      const inventoryDepth = await countInventoryForRange(
        game.id,
        runDateKey,
        GAME_READY_INVENTORY_DAYS,
      );
      totalDeleted += result.deletedCount;
      totalGenerated += result.generatedCount;
      totalFailed += result.failedCount;
      totalSkipped += result.skippedCount;
      generateLogger.info(
        {
          event: "generate.game.completed",
          game: game.slug,
          force: range.force,
          durationMs: Date.now() - gameStartedAt,
          deletedCount: result.deletedCount,
          generatedCount: result.generatedCount,
          failedCount: result.failedCount,
          skippedCount: result.skippedCount,
          inventoryDepth,
        },
        `${game.slug}: ${result.generatedCount} generated, ${result.failedCount} failed, ${result.skippedCount} skipped`,
      );
      if (result.circuitOpened) {
        generateLogger.error(
          {
            event: "generate.circuit.opened",
            game: game.slug,
            consecutiveFailures: circuit.consecutiveFailures,
          },
          `${circuit.consecutiveFailures} consecutive generation failures — stopping the rest of this run instead of exhausting the attempt budget`,
        );
        break;
      }
    }
    return {
      totalDeleted,
      totalGenerated,
      totalFailed,
      totalSkipped,
      circuitOpened: circuit.open,
      games: games.map((game) => game.slug),
    };
  });

  if (!locked.ok) {
    generateLogger.error(
      { event: "generate.run.lockBusy" },
      "another generate run holds the lock; skipping",
    );
    throw new Error("lock_busy");
  }

  const { totalDeleted, totalGenerated, totalFailed, totalSkipped, circuitOpened, games } =
    locked.value;
  generateLogger.info(
    {
      event: "generate.run.completed",
      force: range.force,
      mode: range.force ? "force" : "gap_fill",
      durationMs: Date.now() - runStartedAt,
      games,
      deleted: totalDeleted,
      generated: totalGenerated,
      failed: totalFailed,
      skipped: totalSkipped,
      circuitOpened,
    },
    `generate complete across ${games.length} game(s): ${totalGenerated} generated, ${totalFailed} failed, ${totalSkipped} skipped`,
  );

  if (circuitOpened) {
    throw new Error(
      `generation circuit breaker tripped after ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures — provider likely degraded, ${totalSkipped} date(s) skipped`,
    );
  }
  if (totalFailed > 0) throw new Error(`${totalFailed} puzzle(s) failed to generate`);
}

if (!process.env.VITEST) {
  const errorStartedAt = Date.now();
  try {
    await main();
  } catch (err) {
    logger.error(
      { event: "generate.run.failed", error: getErrorMessage(err), durationMs: Date.now() - errorStartedAt },
      "generate run failed",
    );
    process.exit(1);
  } finally {
    closeDb();
  }
}
