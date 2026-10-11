import { Copy, ExternalLink, Share2 } from "lucide-react";
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

  const guessLabel = `${game.guesses.length} ${game.guesses.length === 1 ? "guess" : "guesses"}`;
  const verdictLabel = game.isSolved
    ? `Solved in ${guessLabel}`
    : `Out of guesses after ${guessLabel}`;
  const source = puzzle.sources[0];
  const headline = source?.title?.trim();

  return (
    <div className={styles.result} data-testid="game-result">
      <div className={styles.resultCard} data-testid="game-receipt">
        <div className={styles.resultBody}>
          <div className={styles.resultEyebrow}>
            <h2 className={styles.resultHeading}>The Proof</h2>
            <div
              aria-label={verdictLabel}
              className={styles.verdict}
              data-testid="game-result-badge"
              data-solved={game.isSolved ? "true" : "false"}
              data-guesses={game.guesses.length}
              role="img"
            >
              {game.guesses.map((guess, index) => {
                const state = guess.states.every((letter) => letter === "correct")
                  ? "correct"
                  : guess.states.includes("present")
                    ? "present"
                    : "absent";

                return (
                  <span
                    aria-hidden="true"
                    className={styles.verdictDot}
                    data-state={state}
                    key={`${guess.word}-${index}`}
                  />
                );
              })}
            </div>
          </div>
          {headline && <h3 className={styles.resultHeadline}>{headline}</h3>}
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
          {source && (
            <a
              aria-label="Read the source article"
              className={styles.resultAction}
              href={source.url}
              rel="noopener noreferrer"
              style={{ "--action-i": 3 } as CSSProperties}
              target="_blank"
              title={source.title || "Read the source article"}
            >
              <ExternalLink aria-hidden="true" size={18} strokeWidth={2.25} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
