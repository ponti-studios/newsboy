import { cn } from "../../lib/cn";
import styles from "./onscreen-keyboard.module.css";

export type LetterState = "absent" | "correct" | "present";

export interface OnscreenKeyboardProps {
  /** Maps each uppercase letter to its current state. */
  letterStates?: Record<string, LetterState>;
  onLetter?: (letter: string) => void;
  onEnter?: () => void;
  onBackspace?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
}

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;

function keyClass(kind: "letter" | "action", state: LetterState | "action" | "inactive") {
  const stateClass =
    state === "correct"
      ? styles.keyCorrect
      : state === "present"
        ? styles.keyPresent
        : state === "absent"
          ? styles.keyAbsent
          : undefined;
  return cn(styles.key, stateClass, kind === "letter" ? styles.keyLetter : styles.keyAction);
}

function keyLabel(letter: string, state: LetterState | "action" | "inactive") {
  if (state === "action") return letter === "Enter" ? "Enter guess" : "Delete last letter";
  if (state === "correct") return `${letter} — correct`;
  if (state === "present") return `${letter} — present in word`;
  if (state === "absent") return `${letter} — not in word`;
  return letter;
}

/** The tabloid skin (colors) lives in this component's CSS module. */
export function OnscreenKeyboard({
  letterStates = {},
  onLetter,
  onEnter,
  onBackspace,
  disabled = false,
  readOnly = false,
  className,
}: OnscreenKeyboardProps) {
  return (
    <div
      data-game-keyboard
      className={cn(styles.keyboard, readOnly && styles.readOnly, className)}
      data-testid="onscreen-keyboard"
    >
      {ROWS.map((row, i) => (
        <div key={row} className={styles.keyboardRow}>
          {i === 2 && (
            <button
              className={cn(keyClass("action", "action"), disabled && styles.disabled)}
              disabled={disabled}
              aria-label={keyLabel("Enter", "action")}
              data-testid="keyboard-key-enter"
              tabIndex={readOnly ? -1 : undefined}
              onClick={onEnter ? () => onEnter() : undefined}
              type="button"
            >
              Enter
            </button>
          )}
          {row.split("").map((letter) => (
            <button
              key={letter}
              className={cn(
                keyClass("letter", letterStates[letter] ?? "inactive"),
                disabled && styles.disabled,
              )}
              disabled={disabled}
              aria-label={keyLabel(letter, letterStates[letter] ?? "inactive")}
              data-testid={`keyboard-key-${letter}`}
              tabIndex={readOnly ? -1 : undefined}
              onClick={onLetter ? () => onLetter(letter) : undefined}
              type="button"
            >
              {letter}
            </button>
          ))}
          {i === 2 && (
            <button
              className={cn(keyClass("action", "action"), disabled && styles.disabled)}
              disabled={disabled}
              aria-label={keyLabel("Backspace", "action")}
              data-testid="keyboard-key-backspace"
              tabIndex={readOnly ? -1 : undefined}
              onClick={onBackspace ? () => onBackspace() : undefined}
              type="button"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
