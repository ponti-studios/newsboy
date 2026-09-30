---
title: Candidate Generation
summary: How one date's puzzle gets from the article inventory to an approved, published record — the per-date, per-game generate-validate-retry loop.
type: reference
status: active
owner: charlesponti
tags: [generation, llm, pipeline]
related: [./architecture.md, ./prompt-evaluation.md]
updated: 2026-09-23
---

# Candidate Generation

This is the per-date, per-game loop `generatePuzzleForGame`
(`packages/newsboy/src/lib/generation/puzzle-generator.server.ts`) runs.
`runGenerateRange` (`generation-runner.ts`) calls it once per missing date,
per active game — see [Newsboy Architecture](./architecture.md) for scheduling
and circuit-breaking.

## 1. Inputs

- The game's newest 8 pending articles (`GENERATION_BATCH_SIZE`,
  `getPendingArticlesForGame`, ordered newest-`publishedAt` first).
- Excluded answers: every answer the game used within `repeatWindowDays` (90)
  plus every answer it has ever published (`getRecentAnswers` /
  `getStoredAnswers`) — the LLM must not land on a duplicate.

## 2. Generation and validation loop — 5 attempts max

- **Request:** one OpenRouter chat completion per attempt via
  `callGenerationApiForCandidates` (`candidate-generator.server.ts`) with a
  strict JSON-schema response (`generationResponseSchema`, `min(1).max(5)`
  candidates). The prompt marks the article payload as untrusted data and
  instructs the model to ignore any commands or role claims inside it
  (`buildMessages`).
- **Sequential validation:** candidates are scored in the order returned by
  `validateCandidate` (`candidate-validation.ts`): exactly 5 letters,
  dictionary word, no `answerType: "person"`, answer not leaked into
  clue/detail, no prompt-control markers, not a repeat answer, and at least
  one cited source URL inside the offered article domains. The **first**
  candidate that both passes validation and matches an offered article
  (`matchArticle`, source URL ∈ batch) wins — it is written to
  `games_puzzles`, the rest of the batch is discarded, and generation exits
  successfully for that date.
- **Rejections:** a rejected candidate whose source matched a real article
  calls `recordArticleRejection` (cap 3 before the article is permanently
  `'rejected'`). Logged individually at `debug`
  (`generate.candidate.rejected`). **Rejected answers are added to the
  exclusion set for the next attempt**, so a later attempt is never re-asked
  for the same invalid answer.
- **Batch failure:** if a full attempt produces no usable candidate, one
  `generate.attempt.failed` `warn` is logged with the attempt index
  (`attempt n/maxAttempts`), rejection reasons, and duration, then the worker
  backs off exponentially (`2^attempt * 1000` ms) and requests a fresh batch.
  Each attempt inserts and updates a `generation_runs` row (status, prompt
  tokens, completion tokens, cost) for the admin cost surface.

## 3. Exhaustion

If all `maxAttempts` (default 5) fail validation, generation logs
`generate.puzzle.failed` ("puzzle generation failed after all attempts"),
records `GENERATION_EXHAUSTED` via `recordAdminAction`, and returns `null` for
that slot. There is no curated-archive fallback at generation time — the
route-level serving fallback (most recent prior puzzle, `isFallback`) covers
the day, not a second content source.

## Above this loop

A single degraded-provider day is not retried indefinitely. The circuit breaker
(`circuit-breaker.ts`, `CIRCUIT_BREAKER_THRESHOLD = 6` consecutive failures)
stops the run across dates and games. See [Scheduling and guardrails](./architecture.md#scheduling-and-guardrails).
