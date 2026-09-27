import type { CSSProperties } from "react";

import { cn } from "../../lib/cn";
import tileStyles from "./tile.module.css";

export type GameTileState = "empty" | "typed" | "absent" | "present" | "correct";

type GameTileProps = {
  state: GameTileState;
  letter?: string;
  ariaLabel?: string;
  isRevealing?: boolean;
  isIncorrectGuess?: boolean;
  hasError?: boolean;
  loading?: boolean;
  isPending?: boolean;
  isSolved?: boolean;
  tileIndex?: number;
  mini?: boolean;
  style?: CSSProperties;
};

export function GameTile({
  state,
  letter = "",
  ariaLabel,
  isRevealing = false,
  isIncorrectGuess = false,
  hasError = false,
  loading = false,
  isPending = false,
  isSolved = false,
  tileIndex = 0,
  mini = false,
  style,
}: GameTileProps) {
  if (loading) {
    return <div className={cn(tileStyles.tile, tileStyles.skeleton)} aria-hidden style={style} />;
  }

  const hasStagger = isPending || isSolved;

  return (
    <div
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      data-testid="game-tile"
      className={cn(
        tileStyles.tile,
        mini && tileStyles.mini,
        isRevealing && (isIncorrectGuess ? tileStyles.revealIncorrect : tileStyles.reveal),
        hasError && tileStyles.error,
        isPending && tileStyles.pending,
        isSolved && tileStyles.solved,
      )}
      data-state={state}
      style={hasStagger ? ({ ...style, "--game-tile-i": tileIndex } as CSSProperties) : style}
    >
      <span className={tileStyles.tileLetter}>{letter}</span>
    </div>
  );
}
