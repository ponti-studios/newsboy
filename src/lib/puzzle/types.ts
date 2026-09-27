export type PuzzleAnswerType = "moment" | "object" | "phrase" | "place" | "storyline";

// ── Game engine types ─────────────────────────────────────────────────────

export type LetterState = "absent" | "correct" | "present";
export type GameStatus = "playing" | "solved" | "failed";

export interface PuzzleSource {
  url: string;
  title: string;
  publishedAt: string;
}

/**
 * Server-side puzzle with the answer. Never leaves the server.
 * `PublicGamesPuzzle` is the client-safe counterpart.
 */
interface GamesPuzzleDto {
  answer: string;
  answerType: PuzzleAnswerType;
  clue: string;
  dateKey: string;
  detail: string;
  topic?: string;
  sources: PuzzleSource[];
}

// Do not send the `answer` to the client.
export interface PublicGamesPuzzle extends Omit<GamesPuzzleDto, "answer"> {
  /** True when today's bounded previous-puzzle fallback is being served. */
  isFallback: boolean;
}

export interface GameGuess {
  word: string;
  states: LetterState[];
}

type GuessRejectReason =
  | "not-in-word-list"
  | "wrong-length"
  | "already-guessed"
  | "auth-required"
  | "rate-limited"
  | "game-over";

export interface GameGuessResult {
  valid: boolean;
  word?: string;
  states?: LetterState[];
  isSolved?: boolean;
  isGameOver?: boolean;
  status?: GameStatus;
  reason?: GuessRejectReason;
  authRequired?: boolean;
  remainingGuesses?: number;
}
