import { BarChart3 } from "lucide-react";
import type { CSSProperties } from "react";

import type { PuzzleHistoryStats } from "../../lib/puzzle/stats";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../primitives";
import resultStyles from "./game-result.module.css";
import styles from "./stats-sheet.module.css";

const GUESS_COUNTS = [1, 2, 3, 4, 5, 6] as const;

interface StatsSheetProps {
  stats: PuzzleHistoryStats;
  /** Position in the result card's action row, for the same stagger-in
   *  animation the other action buttons use (`--action-i`). */
  actionIndex?: number;
}

export function StatsSheet({ stats, actionIndex = 3 }: StatsSheetProps) {
  const maxDistribution = Math.max(
    1,
    ...GUESS_COUNTS.map((count) => stats.guessDistribution[count]),
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="View your stats"
          className={resultStyles.resultAction}
          data-testid="game-stats"
          style={{ "--action-i": actionIndex } as CSSProperties}
          title="Your stats"
          type="button"
        >
          <BarChart3 aria-hidden="true" size={18} strokeWidth={2.25} />
        </button>
      </SheetTrigger>
      <SheetContent data-testid="stats-sheet">
        <SheetHeader>
          <SheetTitle>Your stats</SheetTitle>
        </SheetHeader>

        <div className={styles.streaks}>
          <div className={styles.streakStat}>
            <span className={styles.streakValue}>{stats.currentStreak}</span>
            <span className={styles.streakLabel}>Current streak</span>
          </div>
          <div className={styles.streakStat}>
            <span className={styles.streakValue}>{stats.maxStreak}</span>
            <span className={styles.streakLabel}>Max streak</span>
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryStat}>
            <span className={styles.summaryValue}>{stats.gamesPlayed}</span>
            <span className={styles.summaryLabel}>Played</span>
          </div>
          <div className={styles.summaryStat}>
            <span className={styles.summaryValue}>{Math.round(stats.winRate * 100)}%</span>
            <span className={styles.summaryLabel}>Win rate</span>
          </div>
        </div>

        <div className={styles.distribution} aria-label="Guess distribution">
          {GUESS_COUNTS.map((count) => {
            const value = stats.guessDistribution[count];
            const widthPercent = Math.max(6, Math.round((value / maxDistribution) * 100));
            return (
              <div className={styles.distributionRow} key={count}>
                <span className={styles.distributionLabel}>{count}</span>
                <div className={styles.distributionTrack}>
                  <div className={styles.distributionBar} style={{ width: `${widthPercent}%` }}>
                    <span className={styles.distributionValue}>{value}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
