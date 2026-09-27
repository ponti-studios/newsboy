import { useCallback } from "react";

import { BRAND_NAME } from "../config/brand";
import type { GameGuess } from "../lib/puzzle";
import { buildGameShareText } from "../lib/player/share";

export type ShareOutcome = "shared" | "prompt" | "cancelled" | "error";

export interface UseShare {
  share: () => Promise<ShareOutcome>;
}

export function useShare({
  guesses,
  isSolved,
  topic,
  topicSlug,
  onResult,
}: {
  guesses: readonly GameGuess[];
  isSolved: boolean;
  topic?: string;
  topicSlug?: string;
  onResult: (outcome: ShareOutcome) => void;
}): UseShare {
  const share = useCallback(async (): Promise<ShareOutcome> => {
    const shareText = buildGameShareText(guesses, isSolved, topic, topicSlug);

    try {
      if (navigator.share) {
        await navigator.share({
          title: BRAND_NAME,
          text: shareText,
        });
        onResult("shared");
        return "shared";
      }

      window.prompt(`Share your ${BRAND_NAME} result:`, shareText);
      onResult("prompt");
      return "prompt";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        onResult("cancelled");
        return "cancelled";
      }

      onResult("error");
      return "error";
    }
  }, [guesses, isSolved, onResult, topic, topicSlug]);

  return { share };
}
