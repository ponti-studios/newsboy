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

The Drizzle schema and production migration chain remain in
[`ponti-studios/labs`](https://github.com/ponti-studios/labs), under
`packages/db`. This app pins the `ai`, `db`, and `env` source packages to one
immutable Labs commit in `package.json`. Update those three pins together only
after the Labs production migration workflow succeeds for that commit.

The CI migration step applies that pinned migration set to its disposable test
database. Production migrations run only in Labs CI. Railway runs
`scripts/check-production-migration.mjs` as a pre-deploy check and refuses to
activate Newsboy unless the latest migration in the pinned DB package is already
recorded in production.

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
