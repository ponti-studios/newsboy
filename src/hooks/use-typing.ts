import { useCallback, useState } from "react";
import { normalizeGuess, GAME_ANSWER_LENGTH } from "../lib/puzzle";

export function useTyping(disabled: boolean) {
  const [currentGuess, setCurrentGuess] = useState("");

  const addLetter = useCallback(
    (value: string) => {
      if (disabled) return;
      const letter = normalizeGuess(value).charAt(0);
      if (!letter) return;
      setCurrentGuess((prev) => (prev.length >= GAME_ANSWER_LENGTH ? prev : prev + letter));
    },
    [disabled],
  );

  const removeLetter = useCallback(() => {
    if (disabled) return;
    setCurrentGuess((prev) => prev.slice(0, -1));
  }, [disabled]);

  return { currentGuess, setCurrentGuess, addLetter, removeLetter };
}
