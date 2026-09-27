import styles from "./game-header.module.css";

interface GameHeaderProps {
  /** The date key (YYYY-MM-DD) of the puzzle this page is showing. */
  dateKey: string;
}

export function GameHeader({ dateKey }: GameHeaderProps) {
  return (
    <header aria-label="Puzzle date">
      <div className={styles.inner}>
        <span className={styles.dateKey} data-testid="game-date-key">
          {dateKey}
        </span>
      </div>
    </header>
  );
}
