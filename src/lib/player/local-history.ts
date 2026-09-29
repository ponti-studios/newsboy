import { deriveGameStatus } from "../puzzle/rules";
import { isDateKey } from "../puzzle/date";
import type { StatsAttempt } from "../puzzle/stats";
import { loadLocalGame, STORAGE_PREFIX } from "./local-game";

/**
 * Reconstructs an anonymous player's puzzle history from `newsboy:game:*`
 * localStorage entries — one per topic+date, never evicted by
 * `saveLocalGame` — into the same `StatsAttempt[]` shape
 * `computeHistoryStats` already consumes for signed-in players, so both
 * paths share one aggregation engine.
 */
export function loadLocalGameHistory(): StatsAttempt[] {
  try {
    const attempts: StatsAttempt[] = [];
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith(STORAGE_PREFIX)) continue;
      const rest = key.slice(STORAGE_PREFIX.length);
      const separatorIndex = rest.lastIndexOf(":");
      if (separatorIndex < 0) continue;
      const topic = rest.slice(0, separatorIndex);
      const dateKey = rest.slice(separatorIndex + 1);
      if (!topic || !isDateKey(dateKey)) continue;

      const { guesses } = loadLocalGame(topic, dateKey);
      if (guesses.length === 0) continue;
      attempts.push({ dateUtc: dateKey, status: deriveGameStatus(guesses), guesses });
    }
    return attempts;
  } catch {
    return [];
  }
}
