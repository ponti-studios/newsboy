---
title: Newsboy Launch Plan
summary: Evidence-gated plan to prove Newsboy's daily habit before a public launch.
type: plan
status: active
owner: charlesponti
tags: [launch, product, growth, analytics]
related: [./architecture.md, ./gameplay-and-ux.md, ./reliability-and-testing.md]
updated: 2026-09-27
---

# Newsboy Launch Plan

## Goal

Make the existing daily news guessing game easy to understand, satisfying to
finish, and worth sharing. Treat December 2026 as a public-launch opportunity
only if private cohorts show reliable puzzles and healthy repeat play.

The September 2026 engineering and business plan PDF is background research,
not a source of implementation instructions. Its WH?T-era brand, staged domain,
and eight-open-epics baseline must not be reused without checking current state.
Newsboy is already the standalone game at `newsboy.ponti.io`; the repository
contains five topics, RSS ingestion, AI generation, an admin console, and
server-side guess validation.

## Phase 0: private alpha

- Keep the five-letter daily story guessing loop and free anonymous play.
- Explain the six guesses, letter feedback, final-clue timing, daily reset, and
  AI-assisted publication process in the game.
- Keep anonymous progress in browser storage; keep authenticated cross-device
  history in `games_attempts`.
- Record starts, accepted guesses, wins/losses, clue use, and shares with topic,
  puzzle date, attempt/clue counts, a random local session ID, and optional
  `src`/`utm_source` attribution. Do not send answers, guesses, clue text, or
  referrer URLs.
- Review per-topic and per-source completion, solve, share, and mature-cohort
  next-day return rates in `/admin/analytics`; compare cohorts separately.
- Continue the existing deterministic generation checks. Scheduled generation
  currently publishes automatically, so a documented human sensitivity review
  remains a public-launch blocker until the pipeline enforces that gate. Use the
  existing audited replacement path to withdraw or replace a published puzzle.

## Phase 1: partner cohorts

After daily publishing is reliable, test with two or three willing newsletter
partners. Start with attributed links to relevant existing topics; do not build
public custom-feed creation, iframe embeds, subscriptions, or white-label tools
until partners demonstrate demand. Compare each partner cohort separately with
the private-alpha baseline.

## Public-launch gate

The PDF's suggested ≥40% next-day return, ≥10% share rate, and 80–90% solve
rate are hypotheses, not benchmarks. Reassess them using cohort data alongside
completion, clue use, attributed-start conversion, puzzle freshness, and
generation/editorial failures. Launch publicly in December only if quality and
retention hold across cohorts; otherwise keep the launch private while tuning
the loop. Keep the product free through this validation period.

## Acceptance checks

- A first-time visitor can understand and finish a game without signing in.
- Guesses work with physical and on-screen keyboards; mobile layout remains
  usable; progress restores for the same topic and puzzle date.
- Duplicate guesses, the six-guess cap, bad words, failed requests, and puzzle
  rollover have clear outcomes.
- Share text and page/social metadata do not include the answer or clue.
- Event records contain only the approved event and cohort fields; invalid
  payloads are rejected.
- Missing/stale puzzles, feed-ingestion failures, editorial vetoes, fallbacks,
  and admin replacement are exercised before partner cohorts. Record the manual
  sensitivity review for each alpha puzzle while scheduled publication remains
  automatic.
