import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import {
  deriveGameStatus,
  hasGuessedWord,
  isGuessLengthValid,
  normalizeGuess,
  type GameStatus,
  type PublicGamesPuzzle,
  type GameGuess,
  type GameGuessResult,
} from "../lib/puzzle";

import { useAnimation } from "./use-animation";
import { useTyping } from "./use-typing";
import { loadLocalGame, saveLocalGame } from "../lib/player/local-game";

export interface GameState {
  guesses: readonly GameGuess[];
  clue: string;
  detail: string;
  status: GameStatus;
  isSolved: boolean;
  isGameOver: boolean;
  isRevealingRow: boolean;
  isValidationPending: boolean;
  currentGuess: string;
  errorMessage: string | null;
  errorCode: string | null;
  isShaking: boolean;
  hasError: boolean;
  shakeToken: number;
  revealedTileCount: number;
  revealingGuessIndex: number | null;
  addLetter: (value: string) => void;
  removeLetter: () => void;
  submitGuess: () => void;
  clearError: () => void;
}

interface UseGameOptions {
  puzzle: PublicGamesPuzzle;
  initialGuesses: readonly GameGuess[];
  gameSlug: string;
  isSignedIn: boolean;
  onAcceptedGuess?: (guessCount: number, isSolved: boolean, isGameOver: boolean) => void;
}

export function useGame({
  puzzle,
  initialGuesses,
  gameSlug,
  isSignedIn,
  onAcceptedGuess,
}: UseGameOptions): GameState {
  const [guesses, setGuesses] = useState<GameGuess[]>(() => [...initialGuesses]);
  const [revealedClue, setRevealedClue] = useState(puzzle.clue);
  const [revealedDetail, setRevealedDetail] = useState(puzzle.detail);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const fetcher = useFetcher<GameGuessResult>();
  const isValidationPending = fetcher.state !== "idle";

  // Guards against a response landing after the puzzle has already changed
  // underneath it (midnight rollover mid-flight), and against re-processing
  // the same fetcher.data object on a later, unrelated render — set back to
  // null once a response has been consumed.
  const inFlightDateKeyRef = useRef<string | null>(null);

  const anim = useAnimation();
  const isRevealingRow = anim.revealingGuessIndex !== null;
  const status = useMemo(() => deriveGameStatus(guesses), [guesses]);
  const isGameOver = status !== "playing";
  const canMutateGuess = !isGameOver && !isValidationPending && !isRevealingRow;

  const typing = useTyping(!canMutateGuess);
  const currentStorageKey = `${gameSlug}:${puzzle.dateKey}`;

  useEffect(() => {
    if (isSignedIn) {
      setLoadedStorageKey(currentStorageKey);
      return;
    }
    const localGame = loadLocalGame(gameSlug, puzzle.dateKey);
    setGuesses(localGame.guesses);
    setRevealedClue(localGame.clue || puzzle.clue);
    setRevealedDetail(localGame.detail || puzzle.detail);
    setLoadedStorageKey(currentStorageKey);
  }, [currentStorageKey, gameSlug, isSignedIn, puzzle.dateKey]);

  useEffect(() => {
    if (isSignedIn || loadedStorageKey !== currentStorageKey) return;
    saveLocalGame(gameSlug, puzzle.dateKey, {
      guesses,
      clue: revealedClue,
      detail: revealedDetail,
    });
  }, [
    currentStorageKey,
    gameSlug,
    guesses,
    isSignedIn,
    loadedStorageKey,
    puzzle.dateKey,
    revealedClue,
    revealedDetail,
  ]);

  // Reset everything when the active puzzle changes (midnight rollover).
  // The ref guard prevents the effect from firing on the initial mount,
  // which would otherwise overwrite the localStorage-restored guesses.
  const prevDateKeyRef = useRef(puzzle.dateKey);
  useEffect(() => {
    if (puzzle.dateKey === prevDateKeyRef.current) return;
    prevDateKeyRef.current = puzzle.dateKey;
    const localGame = isSignedIn ? null : loadLocalGame(gameSlug, puzzle.dateKey);
    setGuesses(localGame?.guesses ?? []);
    setRevealedClue(puzzle.clue);
    setRevealedDetail(puzzle.detail);
    if (localGame?.clue) setRevealedClue(localGame.clue);
    if (localGame?.detail) setRevealedDetail(localGame.detail);
    inFlightDateKeyRef.current = null;
    typing.setCurrentGuess("");
    anim.resetAnimation();
  }, [gameSlug, isSignedIn, puzzle.clue, puzzle.dateKey, puzzle.detail]);

  // Stable refs so the keydown listener never needs to be re-registered
  // when these callbacks change identity between renders.
  const addLetterRef = useRef(typing.addLetter);
  const removeLetterRef = useRef(typing.removeLetter);
  const submitGuessRef = useRef(() => {});
  addLetterRef.current = typing.addLetter;
  removeLetterRef.current = typing.removeLetter;

  useEffect(() => {
    if (isGameOver) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName))
      ) {
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submitGuessRef.current();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        removeLetterRef.current();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        addLetterRef.current(e.key);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isGameOver]);

  const submitGuess = useCallback(() => {
    if (!canMutateGuess) return;
    const guess = normalizeGuess(typing.currentGuess);

    if (!isGuessLengthValid(guess)) {
      anim.animateError("Not enough letters", true, "wrong-length");
      return;
    }

    if (hasGuessedWord(guesses, guess)) {
      anim.animateError("Already guessed", true, "already-guessed");
      return;
    }

    const dateKey = puzzle.dateKey;
    inFlightDateKeyRef.current = dateKey;

    fetcher.submit(
      {
        dateKey,
        previousGuesses: guesses.map((g) => ({ word: g.word })),
        word: guess,
      },
      { method: "POST", action: `/api/${gameSlug}/guess`, encType: "application/json" },
    );
  }, [canMutateGuess, typing, guesses, puzzle.dateKey, gameSlug, fetcher, anim]);
  submitGuessRef.current = submitGuess;

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const dateKey = inFlightDateKeyRef.current;
    // The puzzle rolled over while this request was in flight — the
    // puzzle-change effect above already reset state, so drop it. Also
    // guards against re-processing the same fetcher.data on a later render.
    if (dateKey === null) return;
    inFlightDateKeyRef.current = null;

    const result = fetcher.data;
    const guessIndex = guesses.length;

    if (!result.valid) {
      if (result.reason === "not-in-word-list")
        anim.animateError("Not in word list", true, "not-in-word-list");
      else if (result.reason === "wrong-length")
        anim.animateError("Not enough letters", true, "wrong-length");
      else if (result.reason === "already-guessed")
        anim.animateError("Already guessed", true, "already-guessed");
      else if (result.reason === "rate-limited")
        anim.animateError("Too many guesses — slow down", true, "rate-limited");
      else if (result.reason === "game-over")
        anim.animateError("This puzzle is already over", true, "game-over");
      return;
    }

    if (result.word && result.states) {
      if (result.clue) setRevealedClue(result.clue);
      if (result.detail) setRevealedDetail(result.detail);
      onAcceptedGuess?.(guesses.length + 1, result.isSolved ?? false, result.isGameOver ?? false);
      setGuesses((prev) => {
        if (hasGuessedWord(prev, result.word!)) return prev;
        return [...prev, { word: result.word!, states: result.states! }];
      });
      typing.setCurrentGuess("");
      anim.startReveal(guessIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data, fetcher.state, guesses.length, onAcceptedGuess]);

  return {
    guesses,
    clue: revealedClue,
    detail: revealedDetail,
    status,
    isSolved: status === "solved",
    isGameOver,
    isRevealingRow,
    isValidationPending,
    currentGuess: typing.currentGuess,
    errorMessage: anim.errorMessage,
    errorCode: anim.errorCode,
    isShaking: anim.isShaking,
    hasError: anim.hasError,
    shakeToken: anim.shakeToken,
    revealedTileCount: anim.revealedTileCount,
    revealingGuessIndex: anim.revealingGuessIndex,
    addLetter: typing.addLetter,
    removeLetter: typing.removeLetter,
    submitGuess,
    clearError: anim.clearError,
  };
}
