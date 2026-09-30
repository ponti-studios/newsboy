---
title: "Task: compare with a friend via share link"
summary: Encode a shared result in the share URL so opening a friend's link shows a side-by-side after finishing your own game.
type: task
status: proposed
owner: charlesponti
tags: [growth, frontend]
related: [./share-og-images.md, ../launch-plan.md]
updated: 2026-09-29
---

# Task: compare with a friend via share link

## Why

Adds a social hook to the existing share flow without building accounts,
subscriptions, or embeds — all explicitly out of scope per
[launch-plan.md](../launch-plan.md#phase-1-partner-cohorts) until partner
demand is shown. This stays inside "attributed links to relevant existing
topics": it's just a richer query param on the link the player already
generates.

## Scope

- Extend the share URL (`shareUrl` in `buildGameShareText`,
  `src/lib/player/share.ts`) with an encoded, spoiler-safe summary of the
  sharer's result (guess count, win/loss, per-guess letter-state pattern —
  the same information already shown in the emoji grid, nothing more).
- When a visitor opens that link and later finishes their own game for that
  topic/date, show a side-by-side: "you" vs. "your friend" using the emoji
  tiles already defined in `shareTiles`.

## Implementation notes

- Encode compactly (e.g. base64/short encoding of guess count + per-tile
  states) as a query param, not the full word list. It must never encode the
  actual answer or guessed words — only the color states, matching exactly
  what's already visible in the plain-text share grid, so this reveals
  nothing that isn't already shared today.
- Read the param client-side only (never persisted server-side, no new DB
  table, no new API route) since the "friend" data is just a client-to-
  client artifact of one link.
- The comparison UI only appears after the visiting player finishes their
  own game, consistent with the existing "clue after five guesses" pattern
  of not front-loading information that would change how someone plays.
- Validate/ignore malformed or missing params gracefully — this is a nice-to-
  have layered onto an already-working share flow, not a required game
  state.

## Acceptance criteria

- A share link with the new param, opened by someone who hasn't played that
  puzzle yet, plays exactly like today's link (no spoiler, no behavior
  change) until they finish their own game.
- After finishing, they see their friend's result pattern alongside their
  own.
- A share link without the param (old links, or a topic where this hasn't
  shipped yet) continues to work unchanged.

## Out of scope

- Persisting "friend" relationships or any social graph.
- Any comparison across more than two results (a full leaderboard is a
  different, larger feature and would revisit the "no public custom-feed /
  subscription tooling" guardrail in the launch plan).
