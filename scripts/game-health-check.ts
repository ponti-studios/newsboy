import "dotenv/config";

import { closeDb } from "@pontistudios/db";

import { getDateKey } from "../src/lib/puzzle/date";
import { getErrorMessage } from "../src/lib/errors";
import { getActiveGames } from "../src/lib/data/games.server";
import { countInventoryForRange, loadPuzzleForDate } from "../src/lib/data/puzzles.server";
import { createLogger } from "../src/lib/logger.server";
import { GAME_READY_INVENTORY_DAYS } from "../src/lib/generation/candidate-validation";
import { LabsServerEnv } from "../src/lib/infrastructure/env";

const logger = createLogger();

export type HealthStatus = "OK" | "DEGRADED";

export interface HealthResult {
  status: HealthStatus;
  issues: string[];
}

export function computeHealthStatus(
  inventoryDepth: number,
  hasTodayPuzzle: boolean,
  hasAnyPuzzle: boolean,
): HealthResult {
  const issues: string[] = [];

  if (!hasAnyPuzzle) {
    issues.push("no puzzles in database");
  }
  if (!hasTodayPuzzle) {
    issues.push("no puzzle for today");
  }
  if (inventoryDepth < 1) {
    issues.push("no puzzles scheduled for upcoming days");
  }

  return { status: issues.length === 0 ? "OK" : "DEGRADED", issues };
}

async function main() {
  LabsServerEnv.parse(process.env);

  const startedAt = Date.now();
  const now = new Date();
  const dateKey = getDateKey(now);
  const healthLogger = logger.child({
    operation: "healthCheck",
    dateKey,
    timestamp: now.toISOString(),
  });

  const games = await getActiveGames();
  if (games.length === 0) throw new Error("No active games found");
  let degraded = false;
  for (const game of games) {
    const [todaysPuzzle, inventoryDepth] = await Promise.all([
      loadPuzzleForDate(game.id, dateKey),
      countInventoryForRange(game.id, dateKey, GAME_READY_INVENTORY_DAYS),
    ]);
    const result = computeHealthStatus(
      inventoryDepth,
      !!todaysPuzzle,
      !!todaysPuzzle || inventoryDepth > 0,
    );
    if (result.status !== "OK") degraded = true;
    for (const issue of result.issues) {
      healthLogger.warn({ event: "health.issue", game: game.slug }, issue);
    }
    healthLogger.info(
      {
        event: "health.game.completed",
        game: game.slug,
        status: result.status,
        hasTodaysPuzzle: !!todaysPuzzle,
        inventoryDepth,
      },
      `${game.slug} health: ${result.status}`,
    );
  }
  healthLogger.info(
    {
      event: "health.run.completed",
      gameCount: games.length,
      status: degraded ? "DEGRADED" : "OK",
      durationMs: Date.now() - startedAt,
    },
    `health check complete: ${degraded ? "DEGRADED" : "OK"}`,
  );
  if (degraded) process.exit(1);
}

if (!process.env.VITEST) {
  try {
    await main();
  } catch (err) {
    logger.error(
      { event: "health.run.failed", error: getErrorMessage(err) },
      "health check failed",
    );
    process.exit(1);
  } finally {
    closeDb();
  }
}
