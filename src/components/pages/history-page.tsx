import { useState } from "react";

import type { PlayableUnplayedPuzzle, PuzzleHistoryPage } from "../../lib/player/history-types";
import type { GameStatus } from "../../lib/puzzle";
import { GameTile, WeekStreakGrid } from "../game";
import {
  Button,
  EmptyState,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  StatusBadge,
  type StatusBadgeConfig,
} from "../primitives";
import styles from "./history-page.module.css";

const UNPLAYED_PAGE_SIZE = 10;

const STATUS_CONFIG: Record<GameStatus, StatusBadgeConfig> = {
  solved: { label: "Solved", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  playing: { label: "In progress", variant: "outline" },
};

function formatDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function HistoryGuestView({ loginUrl }: { loginUrl: string }) {
  return (
    <div className={styles.guestWrap}>
      <EmptyState
        title="Sign in to see your puzzle history"
        description="Track every puzzle you've played, your win rate, and your streak."
        action={
          <Button asChild variant="default">
            <a href={loginUrl}>Sign in</a>
          </Button>
        }
      />
    </div>
  );
}

export interface HistoryPageViewProps {
  history: PuzzleHistoryPage;
  onPageChange: (page: number) => void;
}

export function HistoryPageView({ history, onPageChange }: HistoryPageViewProps) {
  const hasPlayed = history.stats.gamesPlayed > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your history</h1>
        <UnplayedSheet puzzles={history.playableUnplayed} />
      </header>

      {history.weekGrid.length > 0 && <WeekStreakGrid rows={history.weekGrid} />}

      {history.rows.length === 0 ? (
        <EmptyState
          title={hasPlayed ? "No puzzles played this week" : "No puzzles played yet"}
          description={
            hasPlayed
              ? "Try another week, or jump into today's puzzle."
              : "Jump into today's puzzle to start your streak."
          }
          action={
            <Button asChild variant="default">
              <a href="/">Play today&apos;s puzzle</a>
            </Button>
          }
        />
      ) : (
        <ul className={styles.rowList}>
          {history.rows.map((row) => {
            const lastGuess = row.guesses.at(-1);
            return (
              <li key={`${row.gameSlug}:${row.dateKey}`}>
                <a className={styles.row} href={`/${row.gameSlug}/${row.dateKey}`}>
                  <div className={styles.rowTop}>
                    <div className={styles.rowMini}>
                      {lastGuess?.states.map((state, i) => (
                        <GameTile key={i} state={state} letter={lastGuess.word[i] ?? ""} />
                      ))}
                    </div>
                    <StatusBadge status={row.status} config={STATUS_CONFIG} />
                  </div>
                  <div className={styles.rowBottom}>
                    <span className={styles.rowDateText}>{formatDate(row.dateKey)}</span>
                    <span className={styles.rowGame}>{row.gameName}</span>
                  </div>
                  {row.clue && <p className={styles.rowClue}>{row.clue}</p>}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <WeekPagination history={history} onPageChange={onPageChange} />
    </div>
  );
}

function UnplayedSheet({ puzzles }: { puzzles: readonly PlayableUnplayedPuzzle[] }) {
  const [page, setPage] = useState(0);
  const newestFirst = [...puzzles].reverse();
  const totalPages = Math.max(1, Math.ceil(newestFirst.length / UNPLAYED_PAGE_SIZE));
  const shown = newestFirst.slice(page * UNPLAYED_PAGE_SIZE, (page + 1) * UNPLAYED_PAGE_SIZE);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <span className={styles.triggerLabel}>
            Unplayed
            {puzzles.length > 0 && <span className={styles.unplayedCount}>{puzzles.length}</span>}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Puzzles you haven&apos;t played</SheetTitle>
          <small className={styles.triggerLabelSub}>past 90 days</small>
        </SheetHeader>
        {shown.length === 0 ? (
          <p className={styles.unplayedCount}>You&apos;re all caught up.</p>
        ) : (
          <ul className={styles.unplayedList}>
            {shown.map((puzzle) => (
              <li key={`${puzzle.gameSlug}:${puzzle.dateKey}`}>
                <a className={styles.unplayedLink} href={`/${puzzle.gameSlug}/${puzzle.dateKey}`}>
                  <span className={styles.rowDateText}>{formatDate(puzzle.dateKey)}</span>
                  <span className={styles.rowGame}>{puzzle.gameName}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 && (
          <div className={styles.unplayedFooter}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <span aria-hidden>‹</span>
            </Button>
            <span className={styles.unplayedCount}>
              {page + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <span aria-hidden>›</span>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function WeekPagination({
  history,
  onPageChange,
}: {
  history: PuzzleHistoryPage;
  onPageChange: (page: number) => void;
}) {
  if (history.totalPages <= 1) return null;

  return (
    <div className={styles.pagination}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Previous week"
        disabled={!history.hasNext}
        onClick={() => onPageChange(history.page + 1)}
      >
        <span aria-hidden>‹</span>
      </Button>
      <span className={styles.pageLabel}>Week of {formatShortDate(history.weekStartKey)}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Next week"
        disabled={!history.hasPrev}
        onClick={() => onPageChange(history.page - 1)}
      >
        <span aria-hidden>›</span>
      </Button>
    </div>
  );
}
