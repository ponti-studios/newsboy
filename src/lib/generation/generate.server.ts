/**
 * Generation service public boundary.
 *
 * Candidate generation and puzzle persistence live in separate modules. Keep
 * these exports here so callers do not need to know the internal pipeline
 * layout.
 */
export {
  articleToFeedItem,
  buildMessages,
  callGenerationApiForCandidates,
  DEFAULT_GENERATION_MAX_TOKENS,
  DEFAULT_GENERATION_PROMPT_PATH,
  detectRunEnvironment,
  generateCandidates,
  getConfiguredMaxTokens,
  getConfiguredReasoningEffort,
  getSourceDomains,
  getSystemPromptForGame,
  matchArticle,
} from "./candidate-generator.server";

export type { Candidate } from "./candidate-generator.server";
export { generatePuzzleForGame } from "./puzzle-generator.server";
export type { GeneratePuzzleForGameOptions } from "./puzzle-generator.server";
