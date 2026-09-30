---
title: "Task: stats modal"
summary: A post-game stats view showing win rate, guess distribution, and streaks, for anonymous and signed-in players.
type: task
status: done
owner: charlesponti
tags: [gameplay, retention, frontend]
related: [./streaks.md, ../gameplay-and-ux.md]
updated: 2026-09-29
---

# Task: stats modal

**Implemented.** Re-exploring the codebase before implementation found that
the streak/win-rate/guess-distribution aggregation (`computeHistoryStats` in
`lib/puzzle/stats.ts`) and the full signed-in stats experience already
existed, serving `/history`. The actual gaps closed here:

- **Anonymous players had no stats at all.** `lib/player/local-history.ts`
  (new) reconstructs a `StatsAttempt[]` history from the `newsboy:game:*`
  localStorage entries `local-game.ts` already writes (never evicted), and
  feeds it into the same `computeHistoryStats` signed-in stats already use —
  one aggregation engine for both paths, not a second one.
- **Nobody saw stats right after finishing a game.** Added
  `components/game/stats-sheet.tsx`, a `Sheet`-based trigger in
  `GameResult`'s action row (alongside Share/Copy/source-link), showing
  current/max streak, games played, win rate, and the guess distribution.
  Signed-in stats come from a new `loadPlayerStats(userId)` in
  `history.server.ts` (reusing `getActiveGames` + `loadAllAttemptsForUser`),
  threaded through the `topic.tsx` / `topic.$dateKey.tsx` loaders; the
  existing automatic loader revalidation after every guess-submission
  fetcher action keeps it current through the finishing guess.

Stats are cross-topic by design (matching `computeHistoryStats`'
`aggregateByDate`, which already treats a day as one cell across every topic
played), not per-topic as originally scoped below.

## Why

Genre-standard payoff for finishing a game. Depends on the same data as
[streaks](./streaks.md) and reinforces the same retention loop; building them
together avoids computing attempt history twice.

## Scope

- A modal/panel shown after a game ends (win or loss), per topic:
  - games played, win %
  - guess distribution (count of wins by guess-count 1–6)
  - current streak, max streak (reuses [streaks](./streaks.md))
- Available to both anonymous and signed-in players, sourced consistently
  with the anonymous/signed-in split already used for progress storage.

## Implementation notes

- Signed-in: aggregate over `gamesAttempts` rows for the player, scoped by
  `gamesTopicId` (per-topic stats, matching how attempts are already scoped).
  Guess distribution comes from `guesses.length` on `status = "solved"` rows.
- Anonymous: aggregate the same shape client-side from whatever local-storage
  history already backs "resumes the same game" behavior
  (gameplay-and-ux.md). If that storage currently only holds the
  in-progress/most-recent puzzle rather than history, this task needs a
  small storage-schema extension to retain a rolling history — call that out
  explicitly in the PR since it changes what's kept client-side.
- Reuse whatever query builds streaks from [streaks.md](./streaks.md) rather
  than writing a second aggregation path.
- No new API route is obviously required if this is computed from data the
  player's own session already has access to (their own attempts); if a
  signed-in aggregate needs a server round trip, it should be a new
  read-only endpoint scoped to the authenticated user's own rows, following
  the existing `GET /api/:topic/*` conventions in
  [architecture.md](../architecture.md#api-surface).

## Acceptance criteria

- Opening stats after a finished game shows accurate counts that match the
  player's actual attempt history for that topic.
- No answers, guesses, or clue text ever appear in a request/response outside
  the player's own authenticated session (matches the existing privacy
  constraint on `POST /api/events`).
- Works with zero history (first-ever game) without erroring.

## Out of scope

- Cross-topic aggregate stats (unless product wants it later).
- Any server-side anonymous stats persistence.
