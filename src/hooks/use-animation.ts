import { useCallback, useEffect, useRef, useState } from "react";

import { GAME_ANSWER_LENGTH } from "../lib/puzzle";

/** How long (ms) each tile takes to power on during the reveal animation.
 *  Must match the `reveal` keyframe duration in game/tile.module.css. */
export const TILE_REVEAL_STEP_MS = 420;

export function useAnimation() {
  const [revealingGuessIndex, setRevealingGuessIndex] = useState<number | null>(null);
  const [revealedTileCount, setRevealedTileCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [shakeToken, setShakeToken] = useState(0);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasError = isShaking;

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  const animateError = useCallback((message: string, shake: boolean, code?: string) => {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setErrorMessage(message);
    setErrorCode(code ?? null);
    setIsShaking(shake);
    if (shake) setShakeToken((token) => token + 1);
    shakeTimerRef.current = setTimeout(() => {
      setIsShaking(false);
      setErrorMessage(null);
    }, 400);
  }, []);

  const clearError = useCallback(() => {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setErrorMessage(null);
    setErrorCode(null);
    setIsShaking(false);
  }, []);

  const startReveal = useCallback((guessIndex: number) => {
    setRevealingGuessIndex(guessIndex);
    setRevealedTileCount(0);
  }, []);

  const resetAnimation = useCallback(() => {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setErrorMessage(null);
    setErrorCode(null);
    setIsShaking(false);
    setRevealingGuessIndex(null);
    setRevealedTileCount(0);
  }, []);

  useEffect(() => {
    if (revealingGuessIndex === null) return;

    revealTimerRef.current = setTimeout(() => {
      if (revealedTileCount >= GAME_ANSWER_LENGTH) {
        setRevealingGuessIndex(null);
        setRevealedTileCount(0);
      } else {
        setRevealedTileCount((count) => count + 1);
      }
    }, TILE_REVEAL_STEP_MS);

    return () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [revealedTileCount, revealingGuessIndex]);

  return {
    revealingGuessIndex,
    revealedTileCount,
    errorMessage,
    errorCode,
    isShaking,
    hasError,
    shakeToken,
    animateError,
    clearError,
    startReveal,
    resetAnimation,
  };
}
