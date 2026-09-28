import { useCallback, useEffect, useMemo, useState } from "react";

import { OnscreenKeyboard } from "../keyboard/onscreen-keyboard";
import keyboardStyles from "../keyboard/onscreen-keyboard.module.css";
import {
  GAME_ANSWER_LENGTH,
  getKeyboardState,
  MAX_GUESSES,
  type GameGuess,
  type PublicGamesPuzzle,
} from "../../lib/puzzle";
import { buildGameShareText } from "../../lib/player/share";

import styles from "./game-board.module.css";
import { GameResult } from "./game-result";
import { GameTile } from "./game-tile";
import { GuessGrid } from "./guess-grid";
import { useGame } from "../../hooks/use-game";
import { useShare } from "../../hooks/use-share";
import { useGameAnalytics } from "../../hooks/use-game-analytics";

export interface GameBoardProps {
  puzzle: PublicGamesPuzzle;
  initialGuesses: readonly GameGuess[];
  gameSlug: string;
  isSignedIn: boolean;
}

/**
 * The interactive game board — feature sections live in focused components
 * so this file owns only game orchestration and composition.
 */
export function GameBoard({ puzzle, initialGuesses, gameSlug, isSignedIn }: GameBoardProps) {
  const [isOffline, setIsOffline] = useState(false);
  const analytics = useGameAnalytics(gameSlug, puzzle.dateKey);
  const { track } = analytics;
  const onAcceptedGuess = useCallback((count: number, solved: boolean, over: boolean) => {
    const clueCount = !solved && count >= MAX_GUESSES - 1 ? 1 : 0;
    track("guess_made", count, clueCount);
    if (solved) track("game_won", count, clueCount, true);
    else if (over) track("game_lost", count, clueCount, true);
  }, [track]);
  const game = useGame({ puzzle, initialGuesses, gameSlug, isSignedIn, onAcceptedGuess });
  const keyboardState = useMemo(() => getKeyboardState(game.guesses), [game.guesses]);
  const shouldShowClue = !game.isGameOver && game.guesses.length === MAX_GUESSES - 1;

  useEffect(() => {
    track("game_started", game.guesses.length, game.clue ? 1 : 0, true);
  }, [track, game.clue, game.guesses.length]);

  useEffect(() => {
    if (game.clue && !game.isGameOver) track("clue_used", game.guesses.length, 1, true);
  }, [track, game.clue, game.guesses.length, game.isGameOver]);

  const { share } = useShare({
    guesses: game.guesses,
    isSolved: game.isSolved,
    topic: puzzle.topic,
    topicSlug: gameSlug,
    onResult: (outcome) => {
      game.clearError();
      if (outcome === "shared") track("shared", game.guesses.length, game.clue ? 1 : 0);
    },
  });

  const copyStory = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        buildGameShareText(game.guesses, game.isSolved, puzzle.topic, gameSlug, undefined, window.location.origin),
      );
      track("shared", game.guesses.length, game.clue ? 1 : 0);
      game.clearError();
    } catch {
      // Clipboard permission denied or unavailable; the share fallback remains available.
    }
  }, [track, game.clue, game.guesses, game.isSolved, game.clearError, puzzle.topic, gameSlug]);

  useEffect(() => {
    const updateOnlineState = () => setIsOffline(!navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  return (
    <div className={styles.shell}>
      {isOffline && (
        <div role="status" className={styles.offlineBanner}>
          You&apos;re offline. Reconnect to submit guesses.
        </div>
      )}

      <details className={styles.howToPlay}>
        <summary>How to play</summary>
        <p>
          Guess the five-letter answer from today&apos;s news story in six tries.
          Each guess shows which letters match and where they belong. Your final
          clue appears before your last guess.
        </p>
        <p>
          There&apos;s one shared puzzle per topic each day. You can play without
          an account; this device saves your progress. Newsboy uses AI to draft
          puzzles from current stories and runs automated checks before
          publication.
        </p>
      </details>

      {shouldShowClue && (
        <div className={styles.clue}>
          <p className={styles.clueLabel}>Final clue</p>
          <p className={styles.clueText}>{game.clue}</p>
        </div>
      )}

      <GuessGrid game={game} dateKey={puzzle.dateKey} />

      <GameResult
        game={game}
        puzzle={puzzle}
        detail={game.detail}
        onShare={share}
        onCopy={copyStory}
      />

      {!game.isGameOver && (
        <div className={keyboardStyles.keyboardDock}>
          <OnscreenKeyboard
            letterStates={keyboardState}
            onLetter={game.addLetter}
            onEnter={game.submitGuess}
            onBackspace={game.removeLetter}
          />
        </div>
      )}
    </div>
  );
}

/** Skeleton matching the live grid dimensions to avoid layout shift on load. */
export function GameBoardSkeleton() {
  return (
    <div className={styles.skeletonWrap}>
      <div className={styles.skeleton}>
        {Array.from({ length: MAX_GUESSES }).map((_, row) => (
          <div className={styles.skeletonRow} key={row}>
            {Array.from({ length: GAME_ANSWER_LENGTH }).map((_, col) => (
              <GameTile
                key={col}
                state="empty"
                loading
                style={{ animationDelay: `${(row * GAME_ANSWER_LENGTH + col) * 100}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
