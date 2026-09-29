import { useEffect, useState } from "react";

import { loadLocalGameHistory } from "../lib/player/local-history";
import { computeHistoryStats, type PuzzleHistoryStats } from "../lib/puzzle/stats";

const EMPTY_STATS: PuzzleHistoryStats = computeHistoryStats([]);

/**
 * Resolves the stats to show in the post-game stats sheet.
 *
 * Signed-in players already have this computed server-side
 * (`loadPlayerStats`) and threaded through the route loader — the route's
 * automatic revalidation after every guess-submission fetcher action keeps
 * `serverStats` current, including the just-finished game.
 *
 * Anonymous players have no server-side history at all, so this
 * reconstructs it from `newsboy:game:*` localStorage entries once the game
 * ends. This runs in an effect (not a render-time memo) so it fires after
 * `useGame`'s own `saveLocalGame` effect has committed this game's final
 * guess — callers must invoke `useGame` before this hook so effect
 * ordering guarantees that.
 */
export function usePlayerStats(
  serverStats: PuzzleHistoryStats | null,
  isSignedIn: boolean,
  isGameOver: boolean,
): PuzzleHistoryStats {
  const [localStats, setLocalStats] = useState(EMPTY_STATS);

  useEffect(() => {
    if (isSignedIn || !isGameOver) return;
    setLocalStats(computeHistoryStats(loadLocalGameHistory()));
  }, [isSignedIn, isGameOver]);

  return isSignedIn ? (serverStats ?? EMPTY_STATS) : localStats;
}
