import { createLogger } from "../logger.server";
import type { HominemUser } from "../infrastructure/hominem-auth";
import { addDaysToDateKey, getDateKey } from "../puzzle/date";
import {
  evaluateGuess,
  GAME_ANSWER_LENGTH,
  hasGuessedWord,
  isGuessSolved,
  MAX_GUESSES,
  normalizeGuess,
  type GameGuess,
  type GameGuessResult,
  type GameStatus,
  type PublicGamesPuzzle,
} from "../puzzle/rules";
import { DEFAULT_GAME_SLUG } from "../generation/catalog";
import { appendGuess, countRecentGuesses, createAttempt, loadAttempt } from "./attempts.server";
import { getGameBySlug } from "./games.server";
import { loadMostRecentPuzzle, loadPuzzleForDate } from "./puzzles.server";
import type { PuzzleRecord } from "./types";
import { isValidWord } from "./word-list.server";

const logger = createLogger();

// Guesses-per-minute limit, enforced across all of a user's puzzles at once
// (not per-puzzle) — see countRecentGuesses in attempts.server.ts.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_GUESSES = 10;

async function requireGame(gameSlug = DEFAULT_GAME_SLUG) {
  const game = await getGameBySlug(gameSlug);
  if (!game) throw new Error(`Game not found: ${gameSlug}`);
  return game;
}

// ── DTO mapping ──────────────────────────────────────────────────────────────

/**
 * The clue and detail are spoiler content — `clue` is only meant to appear
 * as the last-resort hint on a player's final guess, and `detail` is the
 * story reveal shown only once a puzzle is over. Gating them client-side
 * isn't enough (the full DTO still round-trips through the loader JSON), so
 * this strips both down to "" server-side unless the attempt actually
 * qualifies — no attempt (anonymous/unstarted) never qualifies for either.
 */
function redactSpoilers(
  record: PuzzleRecord,
  attempt: { status: GameStatus; guesses: GameGuess[] } | null,
): Pick<PuzzleRecord, "clue" | "detail"> {
  const isFinished = attempt?.status === "solved" || attempt?.status === "failed";
  const isFinalGuess = attempt?.status === "playing" && attempt.guesses.length === MAX_GUESSES - 1;
  return {
    clue: isFinalGuess ? record.clue : "",
    detail: isFinished ? record.detail : "",
  };
}

export function toPublicGamesPuzzle(
  record: PuzzleRecord,
  isFallback = false,
  topic?: string,
  attempt: { status: GameStatus; guesses: GameGuess[] } | null = null,
): PublicGamesPuzzle {
  return {
    answerType: record.answerType,
    dateKey: record.dateUtc,
    ...redactSpoilers(record, attempt),
    isFallback,
    topic,
    sources: [
      {
        url: record.article.url,
        title: record.article.title,
        publishedAt: record.article.publishedAt?.toISOString() ?? "",
      },
    ],
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolves the puzzle actually served for "today" — today's own puzzle, or
 * (grace-period fallback) the most recently created one if today's isn't
 * ready yet. Shared by loadActivePublicPuzzle and
 * loadActivePublicPuzzleWithAttempt (and, through it, loadActivePuzzleAttempt)
 * so all agree on exactly which puzzle "today" refers to; an attempt must be
 * looked up against the *served* date, not the nominal one, since that's
 * what evaluateGuessServer keys guesses by too.
 */
async function resolveActivePuzzle(
  now: Date,
  timeZone: string,
  gameSlug = DEFAULT_GAME_SLUG,
): Promise<{ gameId: number; puzzle: PuzzleRecord; isFallback: boolean; topic: string } | null> {
  const dateKey = getDateKey(now, timeZone);
  const childLogger = logger.child({
    operation: "resolveActivePuzzle",
    dateKey,
    timestamp: now.toISOString(),
  });

  const game = await requireGame(gameSlug);
  const gameId = game.id;
  let puzzle = await loadPuzzleForDate(gameId, dateKey);

  // Fallback: serve the most-recently created puzzle from today or earlier.
  // Never serve future inventory across a timezone boundary.
  if (!puzzle) {
    puzzle = await loadMostRecentPuzzle(gameId, dateKey);
    if (puzzle) {
      childLogger.warn(
        {
          event: "[FALLBACK_ACTIVATED_ANY_PUZZLE]",
          puzzle_id: puzzle.id,
          intended_dateKey: dateKey,
          served_dateKey: puzzle.dateUtc,
        },
        "no puzzle for today; serving most recent puzzle as fallback",
      );
    }
  }

  if (!puzzle) {
    childLogger.error({ event: "[ERROR_NO_PUZZLE_AVAILABLE]" }, "no puzzle available");
    return null;
  }

  childLogger.info(
    {
      event: "[PUZZLE_AVAILABLE]",
      puzzle_id: puzzle.id,
      dateKey: puzzle.dateUtc,
    },
    "puzzle loaded",
  );
  return { gameId, puzzle, isFallback: puzzle.dateUtc !== dateKey, topic: game.name };
}

export async function loadActivePublicPuzzle(
  now: Date,
  timeZone = "UTC",
  gameSlug = DEFAULT_GAME_SLUG,
): Promise<{ puzzle: PublicGamesPuzzle } | null> {
  const resolved = await resolveActivePuzzle(now, timeZone, gameSlug);
  if (!resolved) return null;
  return { puzzle: toPublicGamesPuzzle(resolved.puzzle, resolved.isFallback, resolved.topic) };
}

export interface ActivePuzzleAttempt {
  guesses: GameGuess[];
  status: GameStatus;
}

export interface ActivePuzzleEnvelope {
  puzzle: PublicGamesPuzzle;
  attempt: ActivePuzzleAttempt | null;
}

/**
 * Loads the public puzzle and the signed-in player's progress from one active
 * puzzle resolution. The daily route uses this to avoid making the browser
 * wait for a second attempt request after the page has already rendered.
 */
export async function loadActivePublicPuzzleWithAttempt(
  now: Date,
  timeZone = "UTC",
  user: HominemUser | null,
  gameSlug = DEFAULT_GAME_SLUG,
): Promise<ActivePuzzleEnvelope | null> {
  const resolved = await resolveActivePuzzle(now, timeZone, gameSlug);
  if (!resolved) return null;

  let attempt: ActivePuzzleAttempt | null = null;
  if (user) {
    const attemptRow = await loadAttempt(user.id, resolved.gameId, resolved.puzzle.dateUtc);
    if (attemptRow) {
      attempt = { guesses: attemptRow.guesses as GameGuess[], status: attemptRow.status };
    }
  }

  return {
    puzzle: toPublicGamesPuzzle(resolved.puzzle, resolved.isFallback, resolved.topic, attempt),
    attempt,
  };
}

/**
 * The signed-in player's existing progress on "today"'s puzzle, read
 * straight from `games_attempts` — the same table evaluateGuessServer
 * writes to. This is what the client's React Query hook polls/refetches so
 * a solve on one device shows up on another without relying on
 * device-local storage. Returns null for anonymous callers or a
 * signed-in player who hasn't attempted today's puzzle yet — both mean
 * "no prior guesses to seed."
 */
export async function loadActivePuzzleAttempt(
  now: Date,
  timeZone: string,
  user: HominemUser | null,
  gameSlug = DEFAULT_GAME_SLUG,
): Promise<ActivePuzzleAttempt | null> {
  if (!user) return null;
  const envelope = await loadActivePublicPuzzleWithAttempt(now, timeZone, user, gameSlug);
  return envelope?.attempt ?? null;
}

export interface DatedPuzzleEnvelope {
  puzzle: PublicGamesPuzzle;
  /** null when signed out, or when signed in but the date has never been
   *  attempted — both cases mean "no prior guesses to seed." */
  attempt: { guesses: GameGuess[]; status: GameStatus } | null;
}

/**
 * Resolves a puzzle for an *exact* requested date — no previous-day grace
 * period, unlike loadActivePublicPuzzle/evaluateGuessServer. Grace period
 * exists there for midnight-rollover on "today"; a request for a specific
 * historical date should 404 if that exact date has no puzzle, not silently
 * substitute a different one.
 *
 * Only loads the signed-in user's attempt for this date; anonymous callers
 * always get `attempt: null` — the route decides what to do with that (see
 * topic.$dateKey.tsx: anonymous visitors get a read-only sign-in prompt, not
 * a playable board, since the per-date anonymous free-guess design in
 * evaluateGuessServer isn't meant to be exercised against arbitrary dates).
 * A `null` attempt also means `toPublicGamesPuzzle` redacts clue and detail,
 * so the teaser never leaks either.
 */
export async function loadPuzzleForSpecificDate(
  dateKey: string,
  user: HominemUser | null,
  gameSlug = DEFAULT_GAME_SLUG,
): Promise<DatedPuzzleEnvelope | null> {
  const game = await requireGame(gameSlug);
  const gameId = game.id;
  const puzzle = await loadPuzzleForDate(gameId, dateKey);
  if (!puzzle) return null;

  const attemptRow = user ? await loadAttempt(user.id, gameId, dateKey) : null;
  const attempt = attemptRow
    ? { guesses: attemptRow.guesses as GameGuess[], status: attemptRow.status }
    : null;

  return {
    puzzle: toPublicGamesPuzzle(puzzle, false, game.name, attempt),
    attempt,
  };
}

/**
 * Server-evaluates a guess. The answer never leaves the server: callers receive
 * per-letter states and the post-guess status only.
 *
 * `user` is the resolved Hominem session (null for anonymous). Anonymous
 * players get exactly one unpersisted guess, gated by `anonymousGuessCount` —
 * the number of guesses the client has already accumulated in its own local
 * state. That count is client-reported and therefore not adversarially
 * secure, but nothing sensitive depends on it: the six-guess cap, the
 * duplicate-guess check, and the guesses-per-minute rate limit are all
 * authoritative only once a user is signed in and backed by
 * `games_attempts`, which is the actual gap this closes.
 */
export async function evaluateGuessServer(
  dateKey: string,
  rawWord: string,
  user: HominemUser | null,
  anonymousGuessCount: number,
  gameSlug = DEFAULT_GAME_SLUG,
): Promise<GameGuessResult> {
  const childLogger = logger.child({
    operation: "evaluateGuessServer",
    requestedDateKey: dateKey,
    userId: user?.id ?? null,
  });
  const word = normalizeGuess(rawWord);

  if (word.length !== GAME_ANSWER_LENGTH) {
    return { valid: false, word, reason: "wrong-length" };
  }

  // Try exact dateKey, then previous day as grace period for midnight-rollover games
  const gameId = (await requireGame(gameSlug)).id;
  let puzzle = await loadPuzzleForDate(gameId, dateKey);
  if (!puzzle) {
    const prevDateKey = addDaysToDateKey(dateKey, -1);
    if (prevDateKey) {
      puzzle = await loadPuzzleForDate(gameId, prevDateKey);
      if (puzzle) {
        childLogger.info(
          { event: "[GUESS_GRACE_PERIOD_ACCEPTED]", acceptedDateKey: prevDateKey, word },
          "guess accepted via previous-day grace period",
        );
      }
    }
  }

  if (!puzzle) {
    childLogger.warn({ event: "[GUESS_PUZZLE_NOT_FOUND]", word }, "no puzzle found for dateKey");
    return { valid: false, word, reason: "not-in-word-list" };
  }

  const resolvedDateKey = puzzle.dateUtc;

  let attempt = null as Awaited<ReturnType<typeof loadAttempt>>;
  if (user) {
    attempt = await loadAttempt(user.id, gameId, resolvedDateKey);

    if (attempt) {
      if (attempt.status !== "playing") {
        return {
          valid: false,
          word,
          reason: "game-over",
          isGameOver: true,
          status: attempt.status,
        };
      }
      if (hasGuessedWord(attempt.guesses as GameGuess[], word)) {
        return { valid: false, word, reason: "already-guessed" };
      }
    }

    const recentGuessCount = await countRecentGuesses(user.id, RATE_LIMIT_WINDOW_MS);
    if (recentGuessCount >= RATE_LIMIT_MAX_GUESSES) {
      childLogger.warn({ event: "[GUESS_RATE_LIMITED]", recentGuessCount }, "rate limit exceeded");
      return { valid: false, word, reason: "rate-limited" };
    }
  } else if (anonymousGuessCount >= 1) {
    return { valid: false, word, reason: "auth-required", authRequired: true };
  }

  const inWordList = await isValidWord(word, gameId);
  if (!inWordList) {
    return { valid: false, word, reason: "not-in-word-list" };
  }

  const states = evaluateGuess(puzzle.answer, word);
  const isSolved = isGuessSolved({ word, states });

  if (!user) {
    // Anonymous free guess: scored but never persisted. Game is over either
    // way — solved outright, or the player must sign in to keep going.
    return {
      valid: true,
      word,
      states,
      isSolved,
      isGameOver: true,
      status: isSolved ? "solved" : "playing",
      authRequired: !isSolved,
    };
  }

  if (!attempt) {
    try {
      attempt = await createAttempt(user.id, gameId, resolvedDateKey);
    } catch {
      // Concurrent request already created it (unique index on
      // hominem_user_id/games_topic_id/date_utc) — reload rather than fail.
      attempt = await loadAttempt(user.id, gameId, resolvedDateKey);
      if (!attempt) throw new Error("Failed to create or load game attempt");
    }
  }

  const guessCount = attempt.guesses.length + 1;
  const isGameOver = isSolved || guessCount >= MAX_GUESSES;
  const status: GameGuessResult["status"] = isSolved
    ? "solved"
    : guessCount >= MAX_GUESSES
      ? "failed"
      : "playing";

  await appendGuess(attempt.id, { word, states }, status);

  return {
    valid: true,
    word,
    states,
    isSolved,
    isGameOver,
    status,
    remainingGuesses: Math.max(0, MAX_GUESSES - guessCount),
  };
}
