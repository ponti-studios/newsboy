---
title: "Task: daily streaks"
summary: Track and display a player's current and max daily-solve streak, for both anonymous and signed-in play.
type: task
status: done
owner: charlesponti
tags: [gameplay, retention, frontend]
related: [../gameplay-and-ux.md, ../architecture.md, ./stats-modal.md]
updated: 2026-09-29
---

# Task: daily streaks

**Implemented.** The streak/win-rate math already existed
(`lib/puzzle/stats.ts::computeHistoryStats`, already serving the signed-in
`/history` page) and is cross-topic by design, not per-topic as originally
scoped below — see [stats-modal.md](./stats-modal.md) for what was actually
built: surfacing that existing engine for anonymous players too, and inline
post-game via a Stats sheet, rather than building streak math from scratch.

## Why

Streaks are the single highest-leverage retention lever in the Wordle-genre
playbook, and Newsboy already has the data (`games_attempts` for signed-in
players, `localStorage` for anonymous ones per
[gameplay-and-ux.md](../gameplay-and-ux.md)) to compute one without new
infrastructure.

## Scope

- Compute a player's current streak (consecutive calendar days, in the
  player's timezone, with a `solved` result — a `failed` result breaks it)
  and their max streak.
- Show the streak after a finished game, next to the share button.
- Support both anonymous (device-local) and signed-in (cross-device) players
  consistently with the existing split.

## Implementation notes

- Signed-in: derive from `gamesAttempts` (`packages/db/src/schema/game.ts`),
  keyed on `hominemUserId` + `gamesTopicId` + `dateUtc` + `status`. Decide
  whether a streak is per-topic or cross-topic — per-topic is more consistent
  with how the rest of the schema is scoped (games_attempts is unique on
  `(hominemUserId, gamesTopicId, dateUtc)`).
- Anonymous: extend the existing browser-storage shape that already stores
  scored guesses "by topic and puzzle date" (see gameplay-and-ux.md) with a
  derived streak computed client-side from the stored dates — do not persist
  anonymous streaks server-side.
- Missing a day breaks the streak; the break must be computed against the
  player's local date (`newsboy_timezone` cookie /
  `lib/puzzle/timezone.ts`), not UTC, consistent with how `resolveActivePuzzle`
  already resolves "today."
- Surface in the post-game UI alongside the existing share flow
  (`src/lib/player/share.ts`, `src/hooks/use-share.ts`).

## Acceptance criteria

- A signed-in player who solves the same topic on consecutive local-timezone
  days sees an incrementing streak; missing a day resets it to 1 on the next
  solve.
- An anonymous player sees an equivalent streak computed from local storage,
  with no server round trip and no new persisted PII.
- Streak state survives a page refresh for both anonymous and signed-in
  players.

## Out of scope

- Streak leaderboards or any cross-player comparison.
- Streak-based notifications/reminders.
