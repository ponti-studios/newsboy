import { CheckCircle2, Copy, ExternalLink, Share2, XCircle } from "lucide-react";
import type { CSSProperties } from "react";

import type { PublicGamesPuzzle } from "../../lib/puzzle";
import type { PuzzleHistoryStats } from "../../lib/puzzle/stats";

import type { GameState } from "../../hooks/use-game";
import styles from "./game-result.module.css";
import { StatsSheet } from "./stats-sheet";

interface GameResultProps {
  game: GameState;
  puzzle: PublicGamesPuzzle;
  detail: string;
  onShare: () => void;
  onCopy: () => void;
  stats: PuzzleHistoryStats;
}

export function GameResult({ game, puzzle, detail, onShare, onCopy, stats }: GameResultProps) {
  if (!game.isGameOver) return null;

  return (
    <div className={styles.result} data-testid="game-result">
      <div className={styles.resultCard} data-testid="game-receipt">
        <div className={styles.resultBody}>
          <div className="flex items-center justify-between">
            <h2 className={styles.resultHeading}>Story</h2>
            <div
              className={styles.verdict}
              data-testid="game-result-badge"
              data-solved={game.isSolved ? "true" : "false"}
              data-guesses={game.guesses.length}
            >
              {game.isSolved ? (
                <CheckCircle2 aria-hidden="true" size={18} strokeWidth={2.5} />
              ) : (
                <XCircle aria-hidden="true" size={18} strokeWidth={2.5} />
              )}
              <span className={styles.verdictLabel}>
                {game.isSolved ? `Solved in ${game.guesses.length}` : "Out of guesses"}
              </span>
            </div>
          </div>
          <p>{detail}</p>
        </div>
        <div className={styles.resultActions}>
          <button
            aria-label="Share the drama"
            className={styles.resultAction}
            data-testid="game-share"
            onClick={onShare}
            style={{ "--action-i": 0 } as CSSProperties}
            title="Share the drama"
            type="button"
          >
            <Share2 aria-hidden="true" size={18} strokeWidth={2.25} />
          </button>
          <button
            aria-label="Copy story"
            className={styles.resultAction}
            data-testid="game-copy-story"
            onClick={onCopy}
            style={{ "--action-i": 1 } as CSSProperties}
            title="Copy story"
            type="button"
          >
            <Copy aria-hidden="true" size={18} strokeWidth={2.25} />
          </button>
          <StatsSheet stats={stats} actionIndex={2} />
          {puzzle.sources.length > 0 && (
            <a
              aria-label="Read the source article"
              className={styles.resultAction}
              href={puzzle.sources[0].url}
              rel="noopener noreferrer"
              style={{ "--action-i": 3 } as CSSProperties}
              target="_blank"
              title={puzzle.sources[0].title ?? "Read the source article"}
            >
              <ExternalLink aria-hidden="true" size={18} strokeWidth={2.25} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
