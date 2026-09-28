import type { GameGuess, LetterState } from "../puzzle/types";

const STORAGE_PREFIX = "newsboy:game:";
const letterStates = new Set<LetterState>(["absent", "present", "correct"]);

export interface LocalGameState {
  guesses: GameGuess[];
  clue: string;
  detail: string;
}

function storageKey(topic: string, dateKey: string): string {
  return `${STORAGE_PREFIX}${topic}:${dateKey}`;
}

export function loadLocalGame(topic: string, dateKey: string): LocalGameState {
  try {
    const raw = window.localStorage.getItem(storageKey(topic, dateKey));
    if (!raw) return { guesses: [], clue: "", detail: "" };
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("guesses" in value) || !Array.isArray(value.guesses)) {
      return { guesses: [], clue: "", detail: "" };
    }
    const guesses = value.guesses.filter((guess): guess is GameGuess => {
      if (typeof guess !== "object" || guess === null) return false;
      const candidate = guess as Partial<GameGuess>;
      return (
        typeof candidate.word === "string" &&
        /^[A-Z]{5}$/.test(candidate.word) &&
        Array.isArray(candidate.states) &&
        candidate.states.length === 5 &&
        candidate.states.every((state) => letterStates.has(state))
      );
    }).slice(0, 6);
    return {
      guesses,
      clue: "clue" in value && typeof value.clue === "string" ? value.clue.slice(0, 2000) : "",
      detail: "detail" in value && typeof value.detail === "string" ? value.detail.slice(0, 4000) : "",
    };
  } catch {
    return { guesses: [], clue: "", detail: "" };
  }
}

export function saveLocalGame(topic: string, dateKey: string, game: LocalGameState): void {
  try {
    window.localStorage.setItem(storageKey(topic, dateKey), JSON.stringify(game));
  } catch {
    // Private browsing modes may deny storage. The current game remains playable.
  }
}
