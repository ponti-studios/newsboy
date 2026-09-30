---
title: Newsboy feature task backlog
summary: Proposed, scoped tasks for Newsboy features, grounded in the current architecture and launch plan.
type: index
status: active
owner: charlesponti
tags: [tasks, backlog]
related: [../architecture.md, ../launch-plan.md]
updated: 2026-09-29
---

# Newsboy feature task backlog

Each file here is one proposed feature, scoped against the current
implementation (`packages/newsboy`) and checked against
[launch-plan.md](../launch-plan.md)'s guardrail against building public
custom feeds, embeds, subscriptions, or white-label tooling before partner
demand is shown. Each file's own `status` frontmatter is the source of
truth — most are `proposed` and not yet started; [Daily
streaks](./streaks.md) and [Stats modal](./stats-modal.md) are `done`.

## Highest priority

- [Human sensitivity review gate for scheduled generation](./admin-review-queue.md) —
  the launch plan names this directly as a public-launch blocker.

## Gameplay / retention

- [Daily streaks](./streaks.md) — done
- [Stats modal](./stats-modal.md) (builds on streaks) — done
- [Article reveal after solve](./article-reveal.md)
- [Multi-topic same-day badge](./multi-topic-badge.md)
- [Hard mode](./hard-mode.md)

## Social / growth

- [Per-topic share/OG images](./share-og-images.md)
- [Compare with a friend via share link](./compare-with-friend.md) (builds on
  the same share flow as OG images)

## Admin / ops

- [Human sensitivity review gate](./admin-review-queue.md)
- [Generation cost/health trend lines](./cost-health-trends.md)

## Read next

- [Architecture](../architecture.md)
- [Launch plan](../launch-plan.md)
