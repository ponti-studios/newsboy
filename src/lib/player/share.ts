import { BRAND_NAME } from "../../config/brand";
import { getTopicEmoji } from "../generation/catalog";
import type { GameGuess, LetterState } from "../puzzle/types";

function shareTiles(topicSlug: string | undefined): Record<LetterState, string> {
  return {
    absent: "⚪",
    present: "🟠",
    correct: getTopicEmoji(topicSlug),
  };
}

function formatShareDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildGameShareText(
  guesses: readonly GameGuess[],
  isSolved: boolean,
  topic?: string,
  topicSlug?: string,
  date = new Date(),
): string {
  const tiles = shareTiles(topicSlug);
  const score = isSolved ? `${guesses.length}/6` : "X/6";
  const rows = guesses.map((guess) => guess.states.map((state) => tiles[state]).join(""));
  const topicLabel = topic ? ` · ${getTopicEmoji(topicSlug)} ${topic}` : "";

  return [`${BRAND_NAME}${topicLabel} · ${formatShareDate(date)}`, score, "", ...rows].join("\n");
}
