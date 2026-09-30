---
title: "Task: multi-topic same-day badge"
summary: A small in-session badge for playing all five topics on the same day, to encourage cross-topic play.
type: task
status: proposed
owner: charlesponti
tags: [gameplay, retention, frontend]
related: [./streaks.md, ../architecture.md]
updated: 2026-09-29
---

# Task: multi-topic same-day badge

## Why

Newsboy has five independent topic games
([architecture.md](../architecture.md#the-five-games)) but nothing currently
nudges a player to try more than one. A lightweight badge for completing all
five on the same local day is a cheap way to grow per-player topic coverage
without building any new backend surface.

## Scope

- Detect, client-side, when a player has finished (solved or failed — "played",
  not necessarily won) all five active topics for the current local date.
- Show a small one-time badge/toast when the fifth is completed that day.
- Signed-in: can be derived from `gamesAttempts` filtered to `dateUtc` = the
  player's current local date, across all active `gamesTopics`.
- Anonymous: derived from the same per-topic local-storage completion state
  already used to resume games (gameplay-and-ux.md).

## Implementation notes

- Active topic count must come from `getActiveGames()` (already used in
  `admin.generate.tsx` and elsewhere) rather than a hardcoded "5", since the
  catalog is data-driven (`lib/generation/catalog.ts`,
  `ensureGameCatalog`) and topic count can change.
- The "current local date" must use the same `newsboy_timezone` cookie logic
  as puzzle resolution, not client `Date()`, so the badge's notion of "today"
  matches what puzzles are actually being served.
- This is purely a client-side UX signal — no new event type or schema is
  obviously required. If product wants to measure how often this fires,
  consider whether it fits within the existing `POST /api/events` event
  enum (`game_started`, `guess_made`, `game_won`, `game_lost`, `shared`,
  `clue_used`) rather than adding a new one for a single UI nicety.

## Acceptance criteria

- Playing all active topics on the same local day triggers the badge exactly
  once per day.
- The badge does not fire again on refresh/replay of an already-completed
  topic that day.
- Works correctly when the catalog has a different number of active topics
  than five (no hardcoded count).

## Out of scope

- Server-persisted "multi-topic" achievements/history for signed-in users.
- Any reward beyond a UI badge (no unlocks, no extra guesses, etc).
