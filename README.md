# Newsboy

Newsboy is Ponti Studios' multi-topic daily news puzzle. This repository owns
its player and admin app, generation scripts, tests, and scheduled ingestion.

## Development

Requirements: Node.js 24 and pnpm 11.10.0.

```sh
pnpm install
pnpm dev
```

Copy `.env.example` to `.env` and set the database, Hominem, and OpenRouter
values before using database-backed routes or generation scripts.

## Database ownership

Newsboy owns its AI client, database access, Drizzle schema, environment
validation, and migration history in this repository. CI applies the local
migrations to its disposable test database. The production database uses the
same `labs` schema and migration hashes as Labs; production DDL remains gated by
the Labs migration workflow. Railway runs
`scripts/check-production-migration.mjs` before deploy and refuses to activate
Newsboy unless its latest local migration is already recorded in production.
Keep migration SQL, snapshots, and journal changes in sync with Labs.

## Workflows

- `CI` runs lint, typecheck, tests, build, and the test database migration.
- `newsboy - generate` supports manual `gap_fill` and `force` dispatches. Its
  production schedules are enabled after the Labs workflow cutover.
- `newsboy - prompt eval` runs the prompt comparison workflow on demand.

The `realitea-production` environment needs `DATABASE_URL` and
`OPENROUTER_API_KEY` for generation and prompt evaluation. Railway owns app
deployments through its GitHub source integration.
Railway service settings live in `.railway/railway.ts`; review changes with
`railway config plan` and apply them with `railway config apply`.
