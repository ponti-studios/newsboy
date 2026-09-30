---
title: Reliability and Testing
summary: The failure modes Newsboy guards against, and how the test suite covers them.
type: reference
status: active
owner: charlesponti
tags: [testing, reliability, frontend]
related: [./architecture.md, ./gameplay-and-ux.md]
updated: 2026-08-16
---

# Reliability and Testing

Newsboy's failure modes are quiet state mismatches, not crashes — a guess accepted twice, stale state carried across a day boundary, an interstitial reveal state that accepts a new guess. Each guard below closes one of those.

## Concurrent validation submissions are serialized

A pending validation request can be overwritten by another submit if nothing guards it — repeated Enter presses during server validation is the trigger. A new submission can only begin when the fetcher is idle, so validation is a controlled handoff, not a loose async race.

## Input locking covers every input path, not just the primary one

Physical keyboard input and the on-screen keyboard both route through the same shared `addLetter`/`removeLetter`/`submitGuess` handlers, so a single `canMutateGuess` flag locks both at once while validation is active — there is no separate mobile-fallback path that needs its own lock. The same flag applies during staged reveal: a guess still resolving blocks the next one.

## Persistence rejects stale state

Local persistence stores a puzzle key alongside the saved game state and rejects a restore whose key doesn't match the current puzzle. Without that check, an open tab left overnight would carry yesterday's board state into today's puzzle at day rollover.

## Test coverage

- database-backed daily puzzle loading,
- serving-time fallback to the most recent puzzle when today's has not published,
- date-boundary puzzle changes,
- async validation,
- reveal sequencing and locking,
- clue reveal,
- share visibility,
- locked input while a guess is in flight.

Pure helper tests cover normalization, date stability, duplicate-letter evaluation, keyboard-state priority, and guess limits, separately from share formatting and daily puzzle validation — so the route doesn't have to carry every guarantee on its own.

## Known tradeoff

There is no curated-archive fallback at generation time, only a serving-time rule that repeats the most recent approved puzzle. That's acceptable for continuity but gets repetitive if generation is unavailable for an extended stretch — the clearest remaining reliability lever if it becomes a problem.

## Read next

- [Architecture and daily pipeline details](./architecture.md)
- [Gameplay and UX decisions](./gameplay-and-ux.md)
