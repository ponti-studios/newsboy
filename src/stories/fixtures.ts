import type { GameState, WeekGridCellStatus, WeekGridRow } from "../components/game";
import type { PublicGamesPuzzle, GameGuess, GameStatus } from "../lib/puzzle";
import type { PuzzleHistoryPage } from "../lib/player/history-types";
import { buildDateRange } from "../lib/puzzle/date";

export const puzzle: PublicGamesPuzzle = {
  answerType: "storyline",
  clue: "A tiny disagreement becomes a very public spectacle.",
  dateKey: "2026-08-20",
  detail: "The neighborhood group chat has opinions.",
  isFallback: false,
  sources: [
    {
      url: "https://example.com/source",
      title: "The source article",
      publishedAt: "2026-08-20T12:00:00.000Z",
    },
  ],
};

export const fallbackPuzzle = { ...puzzle, isFallback: true };

export const guesses: GameGuess[] = [
  { word: "ALERT", states: ["absent", "present", "absent", "correct", "absent"] },
  { word: "RIVAL", states: ["present", "absent", "correct", "absent", "absent"] },
];

// A guess history that actually ends in a solve — the last guess must be
// all "correct" states, since that's what "solved" means.
export const solvedGuesses: GameGuess[] = [
  ...guesses,
  { word: "DRAMA", states: ["correct", "correct", "correct", "correct", "correct"] },
];

// Five non-solving guesses — a "playing" attempt on its last guess, which is
// also the only case where history reveals the clue (see history.server.ts).
export const inProgressGuesses: GameGuess[] = [
  ...guesses,
  { word: "SNEAK", states: ["absent", "absent", "present", "absent", "absent"] },
  { word: "TOAST", states: ["absent", "correct", "absent", "absent", "present"] },
  { word: "GLARE", states: ["absent", "absent", "absent", "correct", "absent"] },
];

const noop = () => undefined;

export function gameState(overrides: Partial<GameState> = {}): GameState {
  return {
    guesses: [],
    status: "playing",
    isSolved: false,
    isGameOver: false,
    authRequired: false,
    isRevealingRow: false,
    isValidationPending: false,
    currentGuess: "",
    errorMessage: null,
    errorCode: null,
    isShaking: false,
    hasError: false,
    shakeToken: 0,
    revealedTileCount: 0,
    revealingGuessIndex: null,
    addLetter: noop,
    removeLetter: noop,
    submitGuess: noop,
    clearError: noop,
    ...overrides,
  };
}

export const activeGame = gameState({ guesses, currentGuess: "DR" });
export const errorGame = gameState({
  currentGuess: "DRAMA",
  errorMessage: "Not in word list",
  errorCode: "not-in-word-list",
  hasError: true,
  isShaking: true,
  shakeToken: 1,
});
export const solvedGame = gameState({
  guesses: [
    ...guesses,
    { word: "DRAMA", states: ["correct", "correct", "correct", "correct", "correct"] },
  ],
  status: "solved",
  isSolved: true,
  isGameOver: true,
});
export const failedGame = gameState({
  guesses: [...guesses, ...guesses, ...guesses],
  status: "failed",
  isGameOver: true,
});
export const authRequiredGame = gameState({ authRequired: true, isGameOver: true });

const stats = {
  gamesPlayed: 8,
  gamesSolved: 6,
  winRate: 0.75,
  currentStreak: 3,
  maxStreak: 5,
  guessDistribution: { 1: 0, 2: 1, 3: 2, 4: 2, 5: 1, 6: 0 },
};

export const history: PuzzleHistoryPage = {
  page: 0,
  totalPages: 2,
  hasNext: true,
  hasPrev: false,
  weekStartKey: "2026-08-16",
  weekEndKey: "2026-08-22",
  stats,
  playableUnplayed: [
    { dateKey: "2026-08-18", gameSlug: "reality", gameName: "Reality" },
    { dateKey: "2026-08-19", gameSlug: "reality", gameName: "Reality" },
    { dateKey: "2026-08-20", gameSlug: "markets", gameName: "Markets" },
  ],
  weekGrid: buildWeekGridFixture(
    [
      { slug: "reality", name: "Reality" },
      { slug: "markets", name: "Markets" },
    ],
    "2026-08-16",
    "2026-08-22",
    7,
  ),
  rows: [
    {
      dateKey: "2026-08-20",
      gameSlug: "reality",
      gameName: "Reality",
      status: "solved",
      guesses: solvedGuesses,
      answerType: "storyline",
      clue: puzzle.clue,
      detail: puzzle.detail,
    },
    {
      dateKey: "2026-08-19",
      gameSlug: "markets",
      gameName: "Markets",
      status: "failed",
      guesses: guesses.slice(0, 1),
      answerType: "moment",
      clue: "A headline takes a turn.",
      detail: null,
    },
    {
      dateKey: "2026-08-18",
      gameSlug: "reality",
      gameName: "Reality",
      status: "playing",
      guesses: inProgressGuesses,
      answerType: "object",
      clue: "What is everyone suddenly discussing?",
      detail: null,
    },
  ],
};

export const emptyHistory: PuzzleHistoryPage = {
  ...history,
  rows: [],
  totalPages: 1,
  hasNext: false,
  playableUnplayed: [],
  stats: { ...stats, gamesPlayed: 0, gamesSolved: 0, winRate: 0, currentStreak: 0, maxStreak: 0 },
};

// Small seeded PRNG so grid fixtures are identical on every render/CI run
// instead of drifting with Math.random().
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWeekGridFixture(
  topics: { slug: string; name: string }[],
  weekStartKey: string,
  weekEndKey: string,
  seed: number,
): WeekGridRow[] {
  const dateKeys = buildDateRange(weekStartKey, { endKey: weekEndKey });
  const rand = mulberry32(seed);

  return topics.map((topic) => ({
    topicSlug: topic.slug,
    topicName: topic.name,
    cells: dateKeys.map((dateKey) => {
      const roll = rand();
      if (roll < 0.12)
        return { dateKey, status: "no-puzzle" as WeekGridCellStatus, guessCount: null };
      if (roll < 0.28)
        return { dateKey, status: "unplayed" as WeekGridCellStatus, guessCount: null };
      if (roll < 0.4) return { dateKey, status: "failed" as WeekGridCellStatus, guessCount: null };
      if (roll < 0.48)
        return { dateKey, status: "playing" as WeekGridCellStatus, guessCount: null };
      const guessCount = 1 + Math.floor(rand() * 6);
      return { dateKey, status: "solved" as WeekGridCellStatus, guessCount };
    }),
  }));
}

export const statusConfig: Record<
  GameStatus,
  { label: string; variant: "default" | "destructive" | "outline" }
> = {
  solved: { label: "Solved", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  playing: { label: "In progress", variant: "outline" },
};
