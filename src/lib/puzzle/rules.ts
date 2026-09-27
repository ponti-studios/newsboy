import type { GameGuess, GameStatus, LetterState } from "./types";

export type {
  GameGuess,
  GameGuessResult,
  GameStatus,
  LetterState,
  PublicGamesPuzzle,
} from "./types";

export const MAX_GUESSES = 6;
export const GAME_ANSWER_LENGTH = 5;

export function normalizeGuess(value: string): string {
  return value.replaceAll(/[^a-z]/gi, "").toUpperCase();
}

export function isGuessLengthValid(value: string): boolean {
  return normalizeGuess(value).length === GAME_ANSWER_LENGTH;
}

export function hasGuessedWord(guesses: readonly GameGuess[], word: string): boolean {
  const normalizedWord = normalizeGuess(word);
  return guesses.some((guess) => normalizeGuess(guess.word) === normalizedWord);
}

export function evaluateGuess(answer: string, guess: string): LetterState[] {
  const normalizedAnswer = normalizeGuess(answer);
  const normalizedGuess = normalizeGuess(guess);
  const states: LetterState[] = Array.from({ length: normalizedAnswer.length }, () => "absent");
  const remaining = normalizedAnswer.split("");

  for (const [index, letter] of normalizedGuess.split("").entries()) {
    if (letter === normalizedAnswer[index]) {
      states[index] = "correct";
      remaining[index] = "";
    }
  }

  for (const [index, letter] of normalizedGuess.split("").entries()) {
    if (states[index] !== "absent") {
      continue;
    }

    const remainingIndex = remaining.indexOf(letter);
    if (remainingIndex >= 0) {
      states[index] = "present";
      remaining[remainingIndex] = "";
    }
  }

  return states;
}

const STATE_PRIORITY: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 };

/**
 * Aggregate letter states across a list of guesses for the on-screen keyboard.
 * Accepts server-evaluated `states` so the client never needs to know the answer.
 */
export function getKeyboardState(guesses: readonly GameGuess[]): Record<string, LetterState> {
  const keyboardState: Record<string, LetterState> = {};

  for (const guess of guesses) {
    for (const [index, letter] of guess.word.split("").entries()) {
      const nextState = guess.states[index] ?? "absent";
      const currentState = keyboardState[letter];

      if (!currentState || STATE_PRIORITY[nextState] > STATE_PRIORITY[currentState]) {
        keyboardState[letter] = nextState;
      }
    }
  }

  return keyboardState;
}

export function isGuessSolved(guess: GameGuess): boolean {
  return guess.states.every((state) => state === "correct");
}

export function deriveGameStatus(guesses: readonly GameGuess[]): GameStatus {
  if (guesses.some(isGuessSolved)) return "solved";
  if (guesses.length >= MAX_GUESSES) return "failed";
  return "playing";
}
