import type { CSSProperties } from "react";

import { getTopicEmoji } from "../../lib/generation/catalog";
import type { WeekGridCellStatus, WeekGridRow } from "../../lib/puzzle/stats";
import styles from "./week-streak-grid.module.css";

export type { WeekGridCell, WeekGridCellStatus, WeekGridRow } from "../../lib/puzzle/stats";

interface WeekStreakGridProps {
  /** One row per active topic, one cell per day of the currently paged
   *  week — same window as the puzzle list rendered below it. */
  rows: readonly WeekGridRow[];
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "short" });

// Solved-in-1 is the boldest fill; solved-in-6 is the palest. The floor is
// kept well above 0 so even the palest solved cell stays visually distinct
// from an unplayed cell instead of fading into the paper background.
function guessShade(guessCount: number): number {
  const clamped = Math.min(6, Math.max(1, guessCount));
  return 1 - (clamped - 1) * 0.11;
}

function cellStyle(
  status: WeekGridCellStatus,
  guessCount: number | null,
): CSSProperties | undefined {
  if (status === "solved" && guessCount) {
    return { "--mosaic-shade": guessShade(guessCount) } as CSSProperties;
  }
  return undefined;
}

function cellLabel(
  topicName: string,
  dateKey: string,
  status: WeekGridCellStatus,
  guessCount: number | null,
): string {
  const date = new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  switch (status) {
    case "solved":
      return `${topicName}, ${date}: solved in ${guessCount}`;
    case "failed":
      return `${topicName}, ${date}: out of guesses`;
    case "playing":
      return `${topicName}, ${date}: in progress`;
    case "unplayed":
      return `${topicName}, ${date}: not played`;
    case "no-puzzle":
      return `${topicName}, ${date}: no puzzle`;
  }
}

function weekdayLabel(dateKey: string): string {
  return WEEKDAY_FORMATTER.format(new Date(`${dateKey}T12:00:00`));
}

export function WeekStreakGrid({ rows }: WeekStreakGridProps) {
  if (rows.length === 0) return null;
  const dateKeys = rows[0].cells.map((cell) => cell.dateKey);

  return (
    <div className={styles.grid} data-testid="week-streak-grid">
      <div className={styles.headerRow} aria-hidden="true">
        <span className={styles.rowLabel} />
        {dateKeys.map((dateKey) => (
          <span key={dateKey} className={styles.weekdayLabel}>
            {weekdayLabel(dateKey)}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.topicSlug}
          className={styles.row}
          role="list"
          aria-label={`${row.topicName} history`}
        >
          <span className={styles.rowLabel} aria-hidden="true" title={row.topicName}>
            {getTopicEmoji(row.topicSlug)}
          </span>
          {row.cells.map((cell) => (
            <span
              key={cell.dateKey}
              className={styles.cell}
              data-status={cell.status}
              role="listitem"
              style={cellStyle(cell.status, cell.guessCount)}
              title={cellLabel(row.topicName, cell.dateKey, cell.status, cell.guessCount)}
              aria-label={cellLabel(row.topicName, cell.dateKey, cell.status, cell.guessCount)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
