---
title: "Task: hard mode"
summary: An opt-in mode that requires previously revealed correct/present letters to be reused in later guesses.
type: task
status: proposed
owner: charlesponti
tags: [gameplay, frontend, backend]
related: [../gameplay-and-ux.md, ../reliability-and-testing.md]
updated: 2026-09-29
---

# Task: hard mode

## Why

Standard genre feature: cheap to build on top of the existing guess-validation
path, gives returning players a reason to engage differently with a puzzle
they might otherwise treat as solved once they know the format.

## Scope

- A per-player toggle (persisted client-side, e.g. alongside the
  `newsboy_timezone` cookie or in local storage) that, when on, requires each
  new guess to reuse every letter already known `correct` and every letter
  known `present` from prior guesses in that game.
- Enforce this **server-side**, not just client-side, since guess validation
  already happens on the server
  (`POST /api/:topic/guess` → `evaluateGuessServer`,
  `lib/data/word-list.server.ts`) — a client-only check would be trivially
  bypassed.

## Implementation notes

- `POST /api/:topic/guess` (`src/routes/api.$topic.guess.ts`) already
  receives `previousGuesses` (word + implicitly derivable states) for the
  duplicate-guess and six-guess-cap checks. Hard-mode validation is a new
  check in the same request path: derive required letters from
  `previousGuesses`' scored states and reject a guess that doesn't reuse
  them, with a clear inline error consistent with the existing "not enough
  letters" / "already guessed" / "not in the word list" failure classes in
  [gameplay-and-ux.md](../gameplay-and-ux.md).
- The request will need an explicit `hardMode: boolean` field in
  `payloadSchema` (`zod`) so the server knows to apply the constraint — don't
  infer it from client state, since the whole point is server enforcement.
- Signed-in players' guess history is already authoritative via
  `games_attempts` (see the note in `packages/db/src/schema/game.ts` that
  `previousGuesses` exists precisely because a client-supplied array used to
  be trusted) — validate hard-mode constraints against that authoritative
  history for signed-in players rather than the client-supplied
  `previousGuesses`, to avoid reintroducing the same bypass class the
  existing schema comment warns about.
- Follow the same inline-error / shake pattern already defined for guess
  failures rather than inventing a new UI pattern.

## Acceptance criteria

- With hard mode on, submitting a guess that drops a known-correct or
  known-present letter is rejected with a clear inline message, both from a
  scripted client bypassing the frontend and from the normal UI.
- With hard mode off, behavior is unchanged from today.
- Signed-in players' hard-mode enforcement is validated against
  `games_attempts`, not client-supplied guess history.

## Out of scope

- Retroactively enforcing hard mode on games already in progress when the
  toggle changes mid-game.
- Separate hard-mode-only stats/streaks.
