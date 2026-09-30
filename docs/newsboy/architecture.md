title: Newsboy Architecture
summary: How gameplay, article ingest, puzzle generation, publishing, and serving fit together in Newsboy.
type: architecture
status: active
owner: charlesponti
tags: [architecture, backend, react-router, generation]
related: [./reliability-and-testing.md, ./candidate-generation.md]
updated: 2026-09-29
---

# Newsboy Architecture

Newsboy keeps a clean split: the browser handles the responsive game, the server
owns validation and publishing, and one scheduled GitHub Actions workflow keeps
tomorrow's puzzles ready. This page is the map for that whole setup.

## Package layout

Newsboy lives in `packages/newsboy` (`newsboy`) on the [labs monorepo](../../README.md) alongside Labs (`packages/labs`). Shared code is in workspace packages: `@pontistudios/db` (Drizzle schema + migrations in `packages/db/src/schema/`), `@pontistudios/ai` (OpenRouter client), `@pontistudios/env` (shared env schemas). The database schema is a fixed Postgres schema named `labs`; generation tables are defined in `packages/db/src/schema/game.ts`.

The pipeline lives in `packages/newsboy/src/lib/`:

- The feed catalog is in `lib/generation/catalog.ts`; ingest is in
  `lib/generation/ingest.server.ts`.
- The generation core is `lib/generation/puzzle-generator.server.ts`, with
  `generate.server.ts` as its public boundary. Candidate requests and checks
  live in `candidate-generator.server.ts` and `candidate-validation.ts`.
- Range planning, gap-fill, force regeneration, and the circuit breaker live
  in `generate-range.ts`, `generation-runner.ts`, and `circuit-breaker.ts`.
- Database access is under `lib/data/`; serving resolves through
  `lib/data/puzzle.server.ts`; the operator UI lives in `src/routes/admin.*`
  and `lib/admin/*`.

Entry-point scripts live in `packages/newsboy/scripts/` (`game-ingest.ts`,
`game-generate.ts`, `game-health-check.ts`) and run as `pnpm newsboy:ingest`,
`pnpm newsboy:generate`, `pnpm newsboy:health-check` from the repo root.
Generation accepts repeated `--topic <slug>` options to target active or
launch-pending topics; scheduled runs omit the option and process all eligible
topics.

## Core layers

### Pure gameplay logic

The lowest layer (`lib/puzzle/`) holds rules that stay deterministic and testable: date-key handling, guess normalization, answer-length rules, and timezone resolution. Player timezone travels in the `newsboy_timezone` cookie (`lib/puzzle/timezone.ts`); missing, malformed, or invalid values fall back to `UTC`. `tz` query parameters are ignored.

### Server-only word validation

Dictionary validation lives on the server (`lib/data/word-list.server.ts`). Answers are exactly 5 letters (`GAME_ANSWER_LENGTH`); the word list is never sent to the browser. Every normalized answer ever published is also accepted, so franchise recognition works through previously published puzzles, not a separate fallback list.

### Server-only generation and publishing

Each game has its own RSS feed, pending-article inventory, and system prompt.
The generator only publishes a puzzle after an OpenRouter candidate passes the
game's checks. A failed date stays empty for the next gap-fill run; it does not
quietly pull in an archive puzzle. If the provider is having a rough day, a
shared circuit breaker stops the run after six consecutive failures rather than
spending through the remaining attempt budget.

## The topic catalog

`lib/generation/catalog.ts` defines the catalog. `ensureGameCatalog` upserts it
into `games_topics` whenever ingest runs, so adding a catalog entry provisions
the topic. The default slug is `reality`.

- `reality` uses Reality Blurred: `https://realityblurred.com/realitytv/feed`
- `technology` uses TechCrunch: `https://techcrunch.com/feed/`
- `page-six` uses Page Six: `https://pagesix.com/feed/`
- `tmz` uses TMZ: `https://www.tmz.com/rss.xml`
- `sports` uses CBS Sports: `https://www.cbssports.com/rss/headlines/`
- `politics` uses BBC Politics: `https://feeds.bbci.co.uk/news/politics/rss.xml`
- `business` uses BBC Business: `https://feeds.bbci.co.uk/news/business/rss.xml`
- `science` uses BBC Science & Environment: `https://feeds.bbci.co.uk/news/science_and_environment/rss.xml`
- `world` uses BBC World: `https://feeds.bbci.co.uk/news/world/rss.xml`
- `health` uses BBC Health: `https://feeds.bbci.co.uk/news/health/rss.xml`

BBC topics remain launch-pending until a puzzle exists for the current UTC
date. Ingest and scheduled generation include pending topics so they can build
that puzzle; navigation and health checks include only active topics.

Per-game tunables live on `games_topics`: answers are five letters, repeats are
blocked for 90 days, articles expire after 45 days, and every current game
uses `src/prompts/game-generation.md`.

## How a puzzle gets made

### Ingest builds the article inventory

`pnpm newsboy:ingest` runs `packages/newsboy/scripts/game-ingest.ts`. It polls every
active feed in parallel, parses RSS with `fast-xml-parser`, fetches each item,
and tries Mozilla Readability to pull out article text. When extraction cannot
help, the title and description are still useful fallback material.

Articles are inserted through `upsertArticles`. URLs are unique within a topic,
so polling a feed again is harmless while stories that appear in multiple feeds
remain available in each topic's pending inventory.
Ingest is deliberately not trying to make puzzles. Its job is just to catch
stories before they disappear from a short RSS feed window.

### Selection stays fresh without crossing games

Before generating for a date, `generatePuzzleForGame` expires that game's
pending articles older than its 45-day limit. It then offers the newest eight
pending articles, ordered by published date. Newest first matters: there are
usually more incoming articles than daily puzzles, so oldest first would make
the game drift toward stale news.

Everything is scoped to one `games_topics` row. Reality never borrows a
TechCrunch story, for example. The generator also excludes answers used in the
last 90 days and every answer ever published for that game.

### Generate, check, and retry

`generatePuzzleForGame` is idempotent. If the game already has a puzzle for
the requested date, it returns that record untouched.

For a missing date, it makes up to five OpenRouter requests. Each request asks
for one to five JSON candidates and carries the date, excluded answers, and
the eight articles as explicitly untrusted data. The prompt tells the model to
ignore commands or role claims that happen to appear in an article.

Candidates are checked in the order they arrive. A winner must be a five-letter
dictionary word, not a person, not leaked in its clue or detail, free of prompt
control markers, not a repeated answer, and cited from a URL in the offered
batch. The first candidate that passes and matches an offered article wins.

Rejected answers are added to the exclusions for the next attempt. Rejections
tied to a real article are tracked; after three, that article becomes
`rejected`, otherwise it can come back in a later batch. Failed attempts back
off for $2^n$ seconds and write one `generation_runs` audit record with status,
token use, and cost. If all five attempts fail, the date stays missing and a
`GENERATION_EXHAUSTED` admin action records what happened.

Publishing writes a `games_puzzles` row and marks only the source article for
the winning candidate as `used`. The other seven articles remain pending.

## Scheduling and guardrails

`.github/workflows/newsboy-generate.yml` runs the same three-step sequence every
day: ingest, generate, then health check. It runs at 22:00 UTC to prepare
tomorrow from that day's articles, then again at 23:00 UTC as a cheap gap-fill
retry. Both runs serialize through the `game-generate` concurrency group and
time out after 30 minutes.

`pnpm newsboy:generate` defaults to gap-fill mode. It plans tomorrow's missing
puzzles only, so an existing future puzzle is left alone. Manual dispatches
can request either gap fill or force regeneration, with a bounded date range.
Force mode is the only path that deletes future puzzles before replacing them;
it also refuses dates that have recorded attempts.

Live puzzles are protected for both UTC and `America/Los_Angeles`, because
those dates can differ during part of a day. A local, loopback database can
opt into regenerating a live date for rehearsal, and logs that clearly.
Production cannot bypass this check.

The generator takes a Postgres advisory lock before it starts. It also cleans
up stale generation runs, expires retained runs after 30 days, and opens the
circuit after six consecutive failures. This keeps a manual run and the cron
from racing each other and avoids turning a provider outage into a pile of
expensive retries.

## Storage and serving

The database lives in the `labs` Postgres schema. `games_topics` holds the game
settings and feeds; `articles` holds `pending`, `used`, `rejected`, or
`expired` source material; `generation_runs` keeps the per-attempt audit and
cost data; and `games_puzzles` is the published puzzle itself. A puzzle always
keeps a source article, while deleting old generation-run records only clears
their optional link from a puzzle.

`resolveActivePuzzle` is the shared serving chokepoint for the game and guess
routes. It gets the player's local date from the `newsboy_timezone` cookie and
loads that date's puzzle.

When that date has no puzzle, serving falls back to the latest puzzle whose
date is not in the player's future. The response is marked `isFallback` and
logs `FALLBACK_ACTIVATED_ANY_PUZZLE`. That trade-off prioritizes a playable
game during an outage, though the fallback has no maximum age. The guess path
also gives yesterday's puzzle a one-day grace period.

## Admin console

`/admin` (`src/routes/admin.*`) is an authenticated operator surface, `noindex`, no public nav. Access requires a signed-in Hominem user whose email is on the `GAME_ADMIN_EMAILS` allowlist, enforced when `NODE_ENV === "production"` or on Railway (`lib/admin/auth.ts`). Every operator write goes through `recordAdminAction` into `admin_actions` — an audit trail.

Generation is a persisted run before it is a puzzle. An operator can use
inventory, feeds, selected articles, RSS previews, or fixtures; candidates
stream to the UI over SSE. RSS and fixture sources are preview-only, while
publishing goes through `lib/admin/publish.ts`. Every operator write lands in
`admin_actions`. Player attempts are in `games_attempts`; replacing a played
puzzle snapshots its earlier version in `game_puzzle_revisions`.

## API surface

- `GET /api/games` — active game list.
- `POST /api/events` — privacy-limited first-party game funnel events; answers,
  guesses, and clue text are never accepted.
- `/admin/analytics` — 45-day topic/source funnel, solve, share, and next-day
  return summary for operators.
- `GET /api/:topic/puzzle` — today's puzzle for the player's timezone.
- `GET /api/:topic/puzzle/:date` — a specific date's puzzle (history/dated views).
- `POST /api/:topic/guess` — submit a guess.
- `POST /api/:topic/attempt` — record an attempt lifecycle.
- `POST /api/words/validate` — check whether a word is a playable answer.
- `GET /api/history` — player history.
- `GET /healthz` — service health.

## Health and observability

`pnpm newsboy:health-check` marks the workflow `DEGRADED` when today's puzzle is
missing or there is no scheduled puzzle for tomorrow. That fails the GitHub
run, which gives the normal workflow notification path a clear signal.

Structured logs use scoped event names such as `ingest.*`,
`generate.puzzle.created`, `generate.attempt.failed`, and `health.*`. Local
TTY output is readable and pretty; CI and Railway receive lean JSON logs with
durations where they matter. `LOG_LEVEL=debug` enables candidate detail.

## A few useful limits

- One run offers eight articles, makes up to five LLM attempts, and accepts
  one to five candidates per attempt.
- Articles expire after 45 days; an article reaches permanent rejection after
  three candidate rejections.
- The generation range spans at most 14 days. Normal scheduling fills only
  tomorrow, and retained run records expire after 30 days.
- The serving fallback never serves a future puzzle, but it has no lower age
  bound. Availability wins during a prolonged generation outage.

## Read next

- [Candidate generation](./candidate-generation.md)
- [Reliability and testing](./reliability-and-testing.md)
