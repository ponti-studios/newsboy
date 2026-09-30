---
title: "Task: article reveal after solve"
summary: Show the sourced news article after a puzzle ends, turning the answer's provenance into a news-discovery payoff.
type: task
status: proposed
owner: charlesponti
tags: [gameplay, product, frontend]
related: [../architecture.md, ../candidate-generation.md]
updated: 2026-09-29
---

# Task: article reveal after solve

## Why

Every Newsboy answer is sourced from a real article
(`games_puzzles.articleId` → `articles`, per
[architecture.md](../architecture.md#storage-and-serving)). `GameResult`
(`components/game/game-result.tsx`) already links to it: a bare
`ExternalLink` icon button in the post-game action row, pointing at
`puzzle.sources[0].url`. The article's title already reaches the client too
(`PuzzleSource.title`, `lib/puzzle/types.ts`) but only as the icon's hover
`title` attribute — nothing about the source is ever visually shown, and
there's no publication/source name or image at all. Turning that icon into
a real, visibly attributed article card is the most Newsboy-specific
differentiator available (vs. a generic Wordle clone) and needs little new
data — the title and link are already on the client-safe puzzle payload.

## Scope

- After a game ends (win or loss), replace the existing bare icon-only
  source link with a card showing at minimum the article's title and
  publication/source name, alongside the outbound link it already provides.
  Consider the existing `imageUrl` on `articles` for a richer card.
- Only reveal after the game is over — never before, and never in a way that
  spoils the answer for an in-progress guesser (e.g. no reveal in page
  metadata/OG tags, which the launch plan already treats as spoiler-free).
  The existing icon link already respects this (only rendered once
  `GameResult` itself is showing), so the replacement card should keep that
  same gating.

## Implementation notes

- Title and URL need no new plumbing — `PuzzleSource` (`lib/puzzle/types.ts`)
  already carries both to the client via `puzzle.sources[0]`, consumed today
  in `GameResult`'s icon link. Just render them instead of only using title
  as a tooltip.
- Source name and image are the actual gap: `articles.imageUrl` exists in
  the schema but `PuzzleSource` doesn't include it or a source/publication
  name. Decide whether to add `imageUrl` (and a source-name field, likely
  derived from the per-topic `feedLabel` on `games_topics`) to
  `PuzzleSource`, threaded through wherever it's currently built (the
  puzzle-serving path resolving through `resolveActivePuzzle` in
  `lib/data/puzzle.server.ts`).
- Sending the article's full text/description at all remains a separate,
  larger decision — keep this task to title + link + source name + image,
  which is enough for a card, without growing the payload further.
- Respect `articles.status` — a puzzle's source article is always the one
  marked `used` for that puzzle, so there's no ambiguity about which article
  to show.
- If the source publication's terms require attribution wording (e.g. "via
  TechCrunch"), match the existing per-topic `feedLabel` field on
  `games_topics` for consistent naming.

## Acceptance criteria

- After finishing a puzzle, the player sees the source article's title and a
  working outbound link.
- The article is never present in any pre-solve API response or page
  metadata for that puzzle/date.
- Works across all five topics without topic-specific frontend branching
  beyond what `feedLabel`/branding already provides.

## Out of scope

- In-app article reader (link out to the original source instead).
- Historical "browse past puzzles' articles" archive — that's a separate,
  larger feature.
