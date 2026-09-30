---
title: "Task: generation cost/health trend lines"
summary: Add rolling trend charts (cost per puzzle, failure rate, circuit-breaker events over time) to the admin cost dashboard.
type: task
status: proposed
owner: charlesponti
tags: [admin, ops, observability]
related: [../architecture.md, ../reliability-and-testing.md]
updated: 2026-09-29
---

# Task: generation cost/health trend lines

## Why

`/admin/costs` (`src/routes/admin.costs.tsx`) already reports 30-day
rollups by trigger, environment, and model
(`getGenerationCostReport`, `lib/data/generation-runs.server.ts`), but it's a
single-window snapshot table with no way to see a trend — so a slow cost
creep or a rising failure rate before the circuit breaker trips (per
[architecture.md](../architecture.md#scheduling-and-guardrails), it opens
after six consecutive failures) isn't visible until it's already a problem.
`generation_runs` already has per-attempt `createdAt`, `costUsd`,
`totalTokens`, and `status`, so this is a query/chart addition, not new
instrumentation.

## Scope

- A rolling time-series view (e.g. daily buckets over the last 30 days) of:
  - generation cost per day
  - success/failure rate per day
  - circuit-breaker-open events (`game_admin_actions.kind =
    "generation_circuit_open"`, per `gameAdminActionKindValues` in
    `packages/db/src/schema/game.ts`) plotted as markers alongside the
    trend, so operators can correlate a circuit trip with what the cost/
    failure trend was doing beforehand.
- Add this to the existing `/admin/costs` page rather than a new route,
  since it's the same data source and audience.

## Implementation notes

- Extend (or add alongside) `getGenerationCostReport` in
  `lib/data/generation-runs.server.ts` with a daily-bucketed query over
  `generationRuns`, grouped by `date_trunc('day', created_at)`. Keep the
  existing 30-day rollup query separate rather than reshaping it, since the
  current breakdown tables (by trigger/environment/model) are still useful
  as-is.
- Follow the `dataviz` skill's guidance for chart choice/palette/dark-mode
  consistency when building this — it's explicitly the right tool for "any
  chart, graph, plot, dashboard."
- `retained run records expire after 30 days` per architecture.md, so a
  30-day trend window is the practical ceiling without changing retention;
  call out in the PR if product wants a longer history (which would need a
  retention-policy change, out of scope here).
- This is an admin-only page (`noindex`, `GAME_ADMIN_EMAILS` allowlist per
  architecture.md's admin-console section) — no new auth work needed, reuse
  the existing `/admin` guard.

## Acceptance criteria

- `/admin/costs` shows a visible trend, not just the current single-window
  totals, for cost and failure rate over the retained run window.
- Circuit-breaker-open events are visible on or alongside the trend.
- No change to the existing per-trigger/environment/model breakdown tables'
  behavior.

## Out of scope

- Alerting/paging on cost or failure-rate thresholds (this is a dashboard,
  not a monitor).
- Extending `generation_runs` retention beyond 30 days.
