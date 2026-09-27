import { GenerateReasonType } from "../admin/generate-copy";
import { isDictionaryWord } from "../data/word-list.server";
import { GAME_ANSWER_LENGTH, normalizeGuess } from "../puzzle/rules";
import type { ValidationResult } from "./types";

const DEFAULT_SOURCE_DOMAIN = "realityblurred.com";
// How many days of forward inventory the pipeline maintains. Deliberately 1:
// each nightly 22:00 UTC run generates exactly tomorrow from that same day's
// articles (the same-day freshness contract). Wider windows generate far-end
// dates early from older articles. The nightly 23:00 UTC retry pass plus the
// bounded serving fallback cover a failed run, so no spare day is kept.
export const GAME_READY_INVENTORY_DAYS = 1;

const PROMPT_CONTROL_MARKERS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /\bsystem\s*:/i,
  /\bdeveloper\s*:/i,
  /\bassistant\s*:/i,
];

function containsPromptControlText(value: string): boolean {
  return PROMPT_CONTROL_MARKERS.some((marker) => marker.test(value));
}

/** Whole-word, case-insensitive match, so "SPLIT" doesn't match inside "SPLITTING". */
function containsWholeWordToken(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

export function validateCandidate(
  candidate: {
    answer: string;
    answerType: string;
    relationship?: string;
    clue: string;
    detail: string;
    sources: { url: string; title?: string; publishedAt?: string }[];
  },
  previousAnswers: Set<string> = new Set(),
  options: { sourceDomains?: string[]; requireLiteralMatch?: boolean; articleText?: string } = {},
): ValidationResult {
  const reasons: GenerateReasonType[] = [];
  const answer = normalizeGuess(candidate.answer);

  if (answer.length !== GAME_ANSWER_LENGTH) {
    reasons.push(GenerateReasonType.NotFiveLetters);
  }
  // `normalizeGuess` is intentionally forgiving for player input, but answer
  // generation must be strict. Otherwise values such as "S P L I T" or
  // "SPL-IT" normalize to a valid five-letter word and are then stored/displayed
  // in their non-five-letter raw form.
  if (!/^[A-Za-z]{5}$/.test(candidate.answer)) {
    reasons.push(GenerateReasonType.NotLetters);
  }
  if (answer.length === GAME_ANSWER_LENGTH && !isDictionaryWord(answer)) {
    reasons.push(GenerateReasonType.NotDictionaryWord);
  }
  if (!candidate.answerType) {
    reasons.push(GenerateReasonType.MissingAnswerType);
  }
  if (candidate.answerType === "person") {
    reasons.push(GenerateReasonType.PersonAnswerType);
  }
  if (
    candidate.relationship &&
    !["direct-summary", "direct-subject", "direct-action", "direct-consequence"].includes(
      candidate.relationship,
    )
  ) {
    reasons.push(GenerateReasonType.SemanticMismatch);
  }
  if (normalizeGuess(candidate.clue).includes(answer)) {
    reasons.push(GenerateReasonType.AnswerLeaked);
  }
  if (containsPromptControlText(candidate.clue) || containsPromptControlText(candidate.detail)) {
    reasons.push(GenerateReasonType.PromptControlText);
  }
  if (previousAnswers.has(answer)) {
    reasons.push(GenerateReasonType.RepeatInWindow);
  }
  if (options.requireLiteralMatch && !containsWholeWordToken(options.articleText ?? "", answer)) {
    reasons.push(GenerateReasonType.AnswerNotInArticle);
  }
  const allowedSourceDomains = options.sourceDomains ?? [DEFAULT_SOURCE_DOMAIN];
  const hasAllowedSource = candidate.sources.some((s) => {
    try {
      return allowedSourceDomains.includes(new URL(s.url).hostname.replace(/^www\./, ""));
    } catch {
      return false;
    }
  });
  if (!hasAllowedSource) {
    reasons.push(GenerateReasonType.MissingSource);
  }

  return { answer, reasons, valid: reasons.length === 0 };
}
