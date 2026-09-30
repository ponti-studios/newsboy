# Newsboy Agent Rules

This repository owns the Newsboy app, its GitHub workflows, and its Railway
service configuration.

## Cross-repository ownership

- Newsboy owns its AI client, database client/schema, environment schemas, and
  migration files under this repository. Do not add dependencies on Labs
  workspace paths or Git subdirectory packages.
- Labs continues to run the production migration job for the shared `labs`
  PostgreSQL schema. Keep the Newsboy migration journal, SQL, and snapshots in
  sync with Labs' migration history so Railway's pre-deploy hash check remains
  valid. Newsboy deployment verifies migration state; it never applies DDL.
- Before changing a database, environment, auth, route ownership, or deployment
  boundary, read the [Labs core development flows](https://github.com/ponti-studios/labs/blob/main/docs/operations/core-development-flows.md),
  [deployment and routing lessons](https://github.com/ponti-studios/labs/blob/main/docs/operations/deployment-and-routing.md),
  and, for environment changes, the [environment configuration contract](https://github.com/ponti-studios/labs/blob/main/docs/operations/environment-configuration.md).

## Database and scripts

- Use the Foundation test database at
  `postgresql://postgres:postgres@localhost:4433/hominem-test` for tests.
- Do not reset or drop the persistent test database to work around a migration
  failure. Inspect it and repair the Drizzle chain in Labs.
- Every script under `scripts/*.ts` that accesses generation configuration must
  parse `NewsboyGenerationEnv` from `src/lib/infrastructure/env.ts`. Do not add
  ad-hoc environment checks.

## Puzzle generation

- `scripts/game-generate.ts` is the single entry point for puzzle generation.
  `pnpm newsboy:generate` gap-fills missing dates; `pnpm newsboy:generate -- --force`
  force-regenerates its allowed window.
- The scheduled and manual generation modes share
  `.github/workflows/newsboy-generate.yml`. The nightly schedule has a primary
  run at `22:00 UTC` and a retry at `23:00 UTC`; each runs the same bare
  `pnpm newsboy:generate` command. Manual dispatch supports `gap_fill` or
  `force`, `daysAhead`, and optional inclusive `from`/`to` dates.
- Live dates are protected from force regeneration except for loopback
  databases. Explicit gap-fill ranges may include the live date but never dates
  before the earliest live date.
- Keep the GitHub Actions production secrets in the `realitea-production`
  environment. Never print or commit their values.

## UI and build

- Authenticated Newsboy browser tests use the dedicated local account
  `test@lvh.me`; never use a personal account or submit test credentials to
  production.
- For UI changes, verify the result in a browser before considering the change
  complete.
- Storybook is development-only. Do not build a static Storybook export.
- Use conventional commit messages.
